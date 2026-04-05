import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { generatePackage } from '../evidence/evidencePackager.js';
import PoliceStation from '../../models/PoliceStation.js';

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Create transporter (configured via environment variables)
const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  console.log('Law Enforcement Service: No SMTP configured, emails will be logged to console');
  return null;
};

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

/**
 * Submit violation report to police station / traffic division
 * @param {Object} violationReport - ViolationReport document
 * @param {Object} policeStation - PoliceStation document
 * @param {Object} options - Submission options
 * @returns {Promise<Object>} Submission record
 */
export async function submitToPolice(violationReport, policeStation, options = {}) {
  const submission = {
    submissionId: `SUB-${Date.now()}-${uuidv4().slice(0, 8)}`,
    policeStation: policeStation._id,
    trafficDivision: options.trafficDivision || policeStation.trafficDivisionEmail,
    municipalCourt: options.municipalCourt,
    submittedAt: new Date(),
    method: options.method || 'email',
    status: 'pending',
    notes: ''
  };

  try {
    if (options.method === 'email' || !options.method) {
      // Generate evidence package
      const { zipPath, manifestPath, packageHash } = await generatePackage(violationReport, {
        userId: options.userId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      });

      // Send email with attachments
      await sendViolationReportEmail(policeStation, violationReport, {
        zipPath,
        manifestPath,
        packageHash
      });

      submission.status = 'received';
      submission.notes = `Email sent successfully. Package hash: ${packageHash}`;
    } else if (options.method === 'portal') {
      // Placeholder for police department portal integration
      submission.status = 'pending';
      submission.notes = 'Submitted via department portal - awaiting confirmation';
    } else if (options.method === 'api') {
      // Placeholder for API integration
      submission.status = 'pending';
      submission.notes = 'Submitted via API - awaiting confirmation';
    }
  } catch (error) {
    console.error('Error submitting to police:', error);
    submission.status = 'pending';
    submission.notes = `Submission error: ${error.message}`;
  }

  // Add submission to report
  violationReport.lawEnforcementSubmissions.push(submission);

  // Add custody entry
  violationReport.addCustodyEntry(
    'submitted_to_police',
    options.userId,
    `Submitted to ${policeStation.name} via ${submission.method}. Submission ID: ${submission.submissionId}`,
    options.ipAddress,
    options.userAgent
  );

  // Update report status
  if (violationReport.status === 'verified') {
    violationReport.status = 'submitted_to_authorities';
  }

  await violationReport.save();
  return submission;
}

/**
 * Send violation report email to police station
 */
async function sendViolationReportEmail(policeStation, report, attachments) {
  const transport = getTransporter();

  const violationTypeDisplay = report.violationTypeDisplay || report.violationType.replace(/_/g, ' ');
  const incidentDate = new Date(report.incidentDateTime).toLocaleDateString();

  const subject = `Traffic Violation Report - ${report.reportNumber} - ${violationTypeDisplay}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .summary-box { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
    .evidence-box { background: #fffbeb; border: 1px solid #f59e0b; padding: 15px; margin: 15px 0; }
    .footer { background: #f0f0f0; padding: 15px; font-size: 12px; color: #666; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
    .badge-minor { background: #fef3c7; color: #92400e; }
    .badge-moderate { background: #fed7aa; color: #c2410c; }
    .badge-severe { background: #fecaca; color: #dc2626; }
    .badge-critical { background: #dc2626; color: white; }
    .vehicle-info { background: #e0e7ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Traffic Violation Report</h1>
    <p>Civik Community Traffic Enforcement</p>
  </div>

  <div class="content">
    <p>Dear ${policeStation.contactPerson?.name || policeStation.name},</p>

    <p>A traffic violation has been reported and documented through the Civik platform. This report includes video/photo evidence with verified integrity hashes suitable for court proceedings.</p>

    <div class="summary-box">
      <h3>Violation Summary</h3>
      <p><strong>Report Number:</strong> ${report.reportNumber}</p>
      <p><strong>Violation Type:</strong> ${violationTypeDisplay}</p>
      <p><strong>Severity:</strong> <span class="badge badge-${report.severity}">${report.severity?.toUpperCase()}</span></p>
      <p><strong>Date/Time:</strong> ${new Date(report.incidentDateTime).toLocaleString()}</p>
      <p><strong>Location:</strong> ${escapeHtml(report.location?.address || 'Not specified')}</p>
      <p><strong>GPS Coordinates:</strong> ${report.location?.lat}, ${report.location?.lng}</p>
    </div>

    <div class="vehicle-info">
      <h3>Offending Vehicle</h3>
      <p><strong>License Plate:</strong> <span style="font-size: 18px; font-weight: bold;">${escapeHtml(report.offendingVehicle?.licensePlate)}</span></p>
      <p><strong>State:</strong> ${escapeHtml(report.offendingVehicle?.plateState)}</p>
      ${report.offendingVehicle?.make ? `<p><strong>Vehicle:</strong> ${escapeHtml([report.offendingVehicle.color, report.offendingVehicle.make, report.offendingVehicle.model].filter(Boolean).join(' '))}</p>` : ''}
      ${report.offendingVehicle?.vehicleType ? `<p><strong>Type:</strong> ${escapeHtml(report.offendingVehicle.vehicleType)}</p>` : ''}
    </div>

    <h3>Description</h3>
    <p>${escapeHtml(report.description)}</p>

    ${report.applicableStatutes?.length > 0 ? `
    <h3>Applicable Traffic Codes</h3>
    <ul>
      ${report.applicableStatutes.map(s => `<li><strong>${s.state} ${s.code}</strong>: ${s.description} (Fine: $${s.fineRange?.min}-$${s.fineRange?.max}, Points: ${s.points})</li>`).join('')}
    </ul>
    ` : ''}

    <div class="evidence-box">
      <h3>Evidence Package</h3>
      <p>Attached to this email:</p>
      <ul>
        <li><strong>Evidence Manifest PDF</strong> - Complete documentation with chain of custody</li>
        <li><strong>Evidence Package ZIP</strong> - All media files with integrity verification</li>
      </ul>
      <p><strong>Package Hash (SHA-256):</strong> <code>${attachments.packageHash}</code></p>
      <p><em>This hash can be used to verify the evidence package has not been tampered with.</em></p>
    </div>

    <h3>Reporter Consent</h3>
    <ul>
      <li>Terms of Service Accepted: ${report.consent?.tosAccepted ? 'Yes' : 'No'}</li>
      <li>Certified Truthful: ${report.consent?.certifyTruthful ? 'Yes' : 'No'}</li>
      <li>Authorized Police Contact: ${report.consent?.authorizePoliceContact ? 'Yes' : 'No'}</li>
      <li>Willing to Testify: ${report.consent?.willingToTestify ? 'Yes' : 'No'}</li>
    </ul>

    <p>For questions or to request additional information, please contact us.</p>

    <p>Best regards,<br>Civik Traffic Enforcement Team</p>
  </div>

  <div class="footer">
    <p><strong>Chain of Custody Notice:</strong> All evidence files have been preserved with SHA-256 integrity hashes. The chain of custody is documented in the attached manifest PDF. This evidence package is designed to be court-admissible.</p>
    <p>&copy; ${new Date().getFullYear()} Civik - Community Traffic Enforcement Platform</p>
  </div>
</body>
</html>
  `;

  const textBody = `
TRAFFIC VIOLATION REPORT
========================

Report Number: ${report.reportNumber}
Date Generated: ${new Date().toLocaleString()}

Dear ${policeStation.contactPerson?.name || policeStation.name},

A traffic violation has been reported through the Civik platform.

VIOLATION SUMMARY
-----------------
Type: ${violationTypeDisplay}
Severity: ${report.severity?.toUpperCase()}
Date/Time: ${new Date(report.incidentDateTime).toLocaleString()}
Location: ${report.location?.address || 'Not specified'}
GPS: ${report.location?.lat}, ${report.location?.lng}

OFFENDING VEHICLE
-----------------
License Plate: ${report.offendingVehicle?.licensePlate}
State: ${report.offendingVehicle?.plateState}
${report.offendingVehicle?.make ? `Vehicle: ${[report.offendingVehicle.color, report.offendingVehicle.make, report.offendingVehicle.model].filter(Boolean).join(' ')}` : ''}

DESCRIPTION
-----------
${report.description}

EVIDENCE PACKAGE
----------------
Package Hash (SHA-256): ${attachments.packageHash}
Attached files: Evidence manifest PDF and evidence package ZIP

---
Chain of Custody Notice: All evidence files have been preserved with SHA-256 integrity hashes.
© ${new Date().getFullYear()} Civik - Community Traffic Enforcement Platform
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Civik <noreply@civik.com>',
    to: policeStation.email,
    cc: policeStation.trafficDivisionEmail || undefined,
    subject: subject,
    text: textBody,
    html: htmlBody,
    attachments: []
  };

  // Attach manifest PDF
  if (attachments.manifestPath && fs.existsSync(attachments.manifestPath)) {
    mailOptions.attachments.push({
      filename: `evidence_manifest_${report.reportNumber}.pdf`,
      path: attachments.manifestPath,
      contentType: 'application/pdf'
    });
  }

  // Attach evidence ZIP
  if (attachments.zipPath && fs.existsSync(attachments.zipPath)) {
    mailOptions.attachments.push({
      filename: `evidence_package_${report.reportNumber}.zip`,
      path: attachments.zipPath,
      contentType: 'application/zip'
    });
  }

  // If no transporter (dev mode), log and return mock result
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP not configured — cannot send enforcement emails in production');
    }
    console.log('=== VIOLATION REPORT EMAIL (dev mode) ===');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    console.log('==============================');
    return {
      success: false,
      mock: true,
      messageId: `mock-${Date.now()}`,
      preview: 'Email logged to console (no SMTP configured)'
    };
  }

  const info = await transport.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId,
    response: info.response
  };
}

/**
 * Check submission status (for departments with tracking APIs)
 * @param {string} submissionId - Submission ID to check
 * @returns {Promise<Object>} Status information
 */
export async function checkSubmissionStatus(submissionId) {
  // Future: integrate with police department APIs
  // For now, return a placeholder response
  return {
    status: 'pending',
    message: 'Status check not available for this department',
    submissionId,
    checkedAt: new Date()
  };
}

/**
 * Update submission status (called by webhook or manual update)
 * @param {Object} violationReport - ViolationReport document
 * @param {string} submissionId - Submission ID to update
 * @param {Object} updateData - New status data
 */
export async function updateSubmissionStatus(violationReport, submissionId, updateData) {
  const submission = violationReport.lawEnforcementSubmissions.find(
    s => s.submissionId === submissionId
  );

  if (!submission) {
    throw new Error('Submission not found');
  }

  if (updateData.status) submission.status = updateData.status;
  if (updateData.caseNumber) submission.caseNumber = updateData.caseNumber;
  if (updateData.citationNumber) submission.citationNumber = updateData.citationNumber;
  if (updateData.officerAssigned) submission.officerAssigned = updateData.officerAssigned;
  if (updateData.notes) submission.notes = updateData.notes;
  submission.lastUpdated = new Date();

  violationReport.addCustodyEntry(
    'status_changed',
    updateData.performedBy,
    `Law enforcement submission status updated to: ${updateData.status}${updateData.caseNumber ? `. Case #: ${updateData.caseNumber}` : ''}`
  );

  await violationReport.save();
  return submission;
}

/**
 * Find nearby police stations for a location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} maxDistance - Maximum distance in miles
 * @returns {Promise<Array>} Nearby police stations
 */
export async function findNearbyStations(lat, lng, maxDistance = 50) {
  // Convert miles to meters for MongoDB
  const maxDistanceMeters = maxDistance * 1609.34;

  try {
    const stations = await PoliceStation.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: maxDistanceMeters
        }
      },
      acceptsOnlineReports: true
    }).limit(10);

    return stations;
  } catch (error) {
    // If geospatial query fails, fall back to finding all accepting stations
    console.warn('Geospatial query failed, returning all stations:', error.message);
    return await PoliceStation.find({ acceptsOnlineReports: true }).limit(10);
  }
}

/**
 * Get recommended police station for a violation report
 * @param {Object} violationReport - ViolationReport document
 * @returns {Promise<Object>} Recommended station
 */
export async function getRecommendedStation(violationReport) {
  const { lat, lng, state, city } = violationReport.location;

  // First try to find station by location
  const nearbyStations = await findNearbyStations(lat, lng, 25);

  if (nearbyStations.length > 0) {
    // Prefer traffic divisions or stations accepting online reports
    const trafficStation = nearbyStations.find(s => s.trafficDivisionEmail);
    return trafficStation || nearbyStations[0];
  }

  // Fall back to finding station by city/state
  const stateStation = await PoliceStation.findOne({
    $or: [
      { 'address.city': city, 'address.state': state },
      { 'address.state': state }
    ],
    acceptsOnlineReports: true
  });

  return stateStation;
}

export default {
  submitToPolice,
  checkSubmissionStatus,
  updateSubmissionStatus,
  findNearbyStations,
  getRecommendedStation
};
