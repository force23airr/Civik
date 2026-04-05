import https from 'https';
import http from 'http';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import MunicipalDepartment from '../../models/MunicipalDepartment.js';
import MunicipalReport from '../../models/MunicipalReport.js';
import Incident from '../../models/Incident.js';

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// ─── Incident type → Department type map ─────────────────────────────────────
export const INCIDENT_TO_DEPT = {
  infrastructure_pothole:     'public_works',
  infrastructure_road_damage: 'public_works',
  infrastructure_construction:'public_works',
  infrastructure_lighting:    'public_works',
  infrastructure_signage:     'traffic_engineering',
  weather_flooding:           'stormwater',
  weather_ice:                'public_works',
  weather_debris:             'parks_recreation',
  weather_obstruction:        'public_works',
  weather_visibility:         'public_works',
  traffic_signal_issue:       'traffic_engineering',
  traffic_congestion:         'traffic_engineering',
  traffic_closure:            'public_works',
  traffic_accident:           'public_works',
  traffic_unusual_pattern:    'traffic_engineering'
};

// These types go to police, not municipal — skip routing
const POLICE_TYPES = new Set(['dangerous_driving', 'crime', 'security', 'other']);

/**
 * Main entry point — called non-blocking after incident creation.
 * Routes the incident to the correct municipal department.
 */
export async function routeIncident(incident) {
  // Skip non-infrastructure types
  if (POLICE_TYPES.has(incident.type) || !INCIDENT_TO_DEPT[incident.type]) {
    return null;
  }

  const departmentType = INCIDENT_TO_DEPT[incident.type];
  const { lat, lng, city, state, zipCode } = incident.location || {};

  let department = null;
  let protocol = 'internal';

  try {
    department = await MunicipalDepartment.findForIncident(lat, lng, departmentType, city, state, zipCode);
    if (department) {
      protocol = department.protocol;
    }
  } catch (err) {
    console.error('[Municipal] Department lookup failed:', err.message);
  }

  // Create the report record
  const submissionId = `MUN-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const report = await MunicipalReport.create({
    incident: incident._id,
    reporter: incident.user,
    department: department?._id || null,
    submissionId,
    protocol,
    status: department ? 'submitted' : 'unassigned',
    statusHistory: [{
      status: department ? 'submitted' : 'unassigned',
      note: department
        ? `Auto-routed to ${department.name} via ${protocol}`
        : `No matching department found for ${departmentType} in ${city || 'unknown city'}, ${state || ''}`
    }]
  });

  // Update the incident with municipal report reference
  await Incident.findByIdAndUpdate(incident._id, {
    $push: {
      municipalReports: {
        department: department?._id,
        reportId: report._id,
        submittedAt: new Date(),
        status: report.status
      }
    }
  });

  if (!department) {
    console.log(`[Municipal] No department found for ${incident.type} in ${city}, ${state}. Queued internally.`);
    return report;
  }

  // Submit via the appropriate protocol
  try {
    if (protocol === 'open311') {
      await submitViaOpen311(department, incident, report);
    } else if (protocol === 'email') {
      await submitViaEmail(department, incident, report);
    }
    // internal = already stored, nothing more to do
  } catch (err) {
    console.error(`[Municipal] Submission failed (${protocol}) to ${department.name}:`, err.message);
    // Don't throw — report is saved, city worker can see it in the portal
  }

  // Increment department stats
  MunicipalDepartment.findByIdAndUpdate(department._id, {
    $inc: { 'stats.reportsReceived': 1 },
    'stats.lastActivityAt': new Date()
  }).catch(() => {});

  console.log(`[Municipal] Routed ${incident.type} → ${department.name} (${protocol})`);
  return report;
}

// ─── Open311 submission ───────────────────────────────────────────────────────
async function submitViaOpen311(dept, incident, report) {
  const cfg = dept.open311Config;
  if (!cfg?.endpoint) throw new Error('No Open311 endpoint configured');

  // Get the service code for this incident type
  const serviceCode = cfg.serviceCodes?.[incident.type];
  if (!serviceCode) {
    console.log(`[Municipal/Open311] No service code for ${incident.type} at ${dept.name}, using email fallback`);
    return submitViaEmail(dept, incident, report);
  }

  // Resolve API key from environment if stored as env var reference
  const apiKey = cfg.apiKey ? (process.env[cfg.apiKey] || cfg.apiKey) : undefined;

  const params = new URLSearchParams({
    service_code: serviceCode,
    lat: incident.location.lat.toString(),
    long: incident.location.lng.toString(),
    address_string: incident.location.address || `${incident.location.city}, ${incident.location.state}`,
    description: `[Civik Report ${incident._id}] ${incident.title}: ${incident.description}`.slice(0, 4000),
    email: 'reports@civik.app',
    first_name: 'Civik',
    last_name: 'Platform'
  });

  if (apiKey) params.append('api_key', apiKey);
  if (cfg.jurisdiction_id) params.append('jurisdiction_id', cfg.jurisdiction_id);

  const url = new URL(`${cfg.endpoint}/requests.json`);
  const payload = params.toString();

  const response = await httpPost(url, payload);

  const ticketNumber = response?.[0]?.service_request_id || response?.[0]?.token;

  await MunicipalReport.findByIdAndUpdate(report._id, {
    status: 'acknowledged',
    ticketNumber: ticketNumber || undefined,
    responsePayload: response,
    submissionPayload: { service_code: serviceCode, lat: incident.location.lat, lng: incident.location.lng },
    $push: { statusHistory: { status: 'acknowledged', note: `Open311 ticket created: ${ticketNumber || 'pending'}` } }
  });

  console.log(`[Municipal/Open311] Ticket ${ticketNumber} created at ${dept.name}`);
  return ticketNumber;
}

// ─── Email submission ─────────────────────────────────────────────────────────
async function submitViaEmail(dept, incident, report) {
  if (!dept.contact?.email) {
    console.log(`[Municipal/Email] No email for ${dept.name}, storing in internal queue`);
    return;
  }

  // Import email service (same pattern as law enforcement)
  const { default: nodemailer } = await import('nodemailer');

  const transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      })
    : null;

  const subject = `[Civik] ${formatType(incident.type)} Report — ${incident.location.address || `${incident.location.city}, ${incident.location.state}`}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="color:#3b82f6;margin:0">Civik Citizen Report</h2>
        <p style="color:#94a3b8;margin:4px 0 0">Auto-routed from ${incident.location.city || 'Unknown City'}, ${incident.location.state || ''}</p>
      </div>
      <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;font-weight:bold;color:#374151;width:140px">Report ID</td><td style="padding:8px;color:#111827">${incident._id}</td></tr>
          <tr style="background:#f1f5f9"><td style="padding:8px;font-weight:bold;color:#374151">Type</td><td style="padding:8px;color:#111827">${formatType(incident.type)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#374151">Severity</td><td style="padding:8px;color:#111827">${incident.severity?.toUpperCase()}</td></tr>
          <tr style="background:#f1f5f9"><td style="padding:8px;font-weight:bold;color:#374151">Location</td><td style="padding:8px;color:#111827">${escapeHtml(incident.location.address || '')}<br/>${escapeHtml(incident.location.city || '')}, ${escapeHtml(incident.location.state || '')} ${escapeHtml(incident.location.zipCode || '')}<br/><a href="https://maps.google.com/?q=${incident.location.lat},${incident.location.lng}">View on Map (${incident.location.lat?.toFixed(5)}, ${incident.location.lng?.toFixed(5)})</a></td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#374151">Description</td><td style="padding:8px;color:#111827">${escapeHtml(incident.description)}</td></tr>
          <tr style="background:#f1f5f9"><td style="padding:8px;font-weight:bold;color:#374151">Reported</td><td style="padding:8px;color:#111827">${new Date(incident.createdAt).toLocaleString()}</td></tr>
          ${incident.mediaFiles?.length ? `<tr><td style="padding:8px;font-weight:bold;color:#374151">Evidence</td><td style="padding:8px;color:#111827">${incident.mediaFiles.length} file(s) attached</td></tr>` : ''}
        </table>
        <div style="margin-top:16px;padding:12px;background:#dbeafe;border-radius:6px">
          <p style="margin:0;font-size:13px;color:#1e40af">This report was automatically routed to your department by Civik (civik.app). Citizens can track the status of this report. Please update the ticket status at your earliest convenience.</p>
        </div>
      </div>
      <div style="background:#1e293b;padding:12px;border-radius:0 0 8px 8px;text-align:center">
        <p style="color:#64748b;margin:0;font-size:12px">Civik — Community Safety & Infrastructure Platform | reports@civik.app</p>
      </div>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Civik Reports" <reports@civik.app>',
      to: dept.contact.email,
      subject,
      html
    });
    console.log(`[Municipal/Email] Sent to ${dept.contact.email}`);
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP not configured — cannot send municipal emails in production');
    }
    console.log(`[Municipal/Email] DEV MODE — would send to ${dept.contact.email}`);
    console.log(`  Subject: ${subject}`);
  }

  await MunicipalReport.findByIdAndUpdate(report._id, {
    $push: { statusHistory: { status: 'submitted', note: `Email sent to ${dept.contact.email}` } },
    submissionPayload: { to: dept.contact.email, subject }
  });
}

// ─── HTTP POST helper for Open311 ─────────────────────────────────────────────
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Open311 request timed out')); });
    req.write(body);
    req.end();
  });
}

function formatType(type) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
}
