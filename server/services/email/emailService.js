import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Create transporter (configured via environment variables)
const createTransporter = () => {
  // Use environment variables or fallback to ethereal for testing
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

  // For development/testing - use console logging
  console.log('Email service: No SMTP configured, emails will be logged to console');
  return null;
};

let transporter = null;

const getTransporter = async () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

/**
 * Send a police report via email
 */
export async function sendPoliceReport(policeStation, incident, pdfPath, options = {}) {
  const transport = await getTransporter();

  const reportId = options.reportId || `RPT-${Date.now()}`;
  const incidentDate = new Date(incident.createdAt).toLocaleDateString();
  const incidentType = formatType(incident.type);

  const subject = `Civik Incident Report - ${incidentType} - ${incidentDate} - Ref: ${reportId}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .summary-box { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
    .footer { background: #f0f0f0; padding: 15px; font-size: 12px; color: #666; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
    .badge-high { background: #fed7d7; color: #c53030; }
    .badge-critical { background: #c53030; color: white; }
    .badge-medium { background: #fefcbf; color: #744210; }
    .badge-low { background: #c6f6d5; color: #276749; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Civik Incident Report</h1>
    <p>Community Dash Cam Safety Platform</p>
  </div>

  <div class="content">
    <p>Dear ${policeStation.contactPerson?.name || policeStation.name},</p>

    <p>A new incident has been reported through the Civik platform that falls within your jurisdiction.</p>

    <div class="summary-box">
      <h3>Incident Summary</h3>
      <p><strong>Report ID:</strong> ${reportId}</p>
      <p><strong>Type:</strong> ${incidentType}</p>
      <p><strong>Severity:</strong> <span class="badge badge-${incident.severity}">${incident.severity?.toUpperCase()}</span></p>
      <p><strong>Date:</strong> ${incidentDate}</p>
      <p><strong>Location:</strong> ${escapeHtml(incident.location?.address || 'Not specified')}</p>
    </div>

    <h3>Incident Title</h3>
    <p>${escapeHtml(incident.title)}</p>

    <h3>Description</h3>
    <p>${escapeHtml(incident.description)}</p>

    ${incident.mediaFiles?.length > 0 ? `
    <h3>Attached Evidence</h3>
    <p>${incident.mediaFiles.length} media file(s) are attached to this report.</p>
    ${options.mediaAccessUrl ? `<p><a href="${options.mediaAccessUrl}">Click here to access media files</a> (link expires in 24 hours)</p>` : ''}
    ` : ''}

    <p>The full incident report is attached to this email as a PDF document.</p>

    <p>If you have any questions or need additional information, please contact our support team.</p>

    <p>Best regards,<br>Civik Team</p>
  </div>

  <div class="footer">
    <p><strong>Disclaimer:</strong> This report was generated automatically by the Civik platform.
    The accuracy of the information depends on user submissions. Civik is not responsible for
    the accuracy of incident details provided by users.</p>
    <p>© ${new Date().getFullYear()} Civik - Community Dash Cam Safety Platform</p>
  </div>
</body>
</html>
  `;

  const textBody = `
CIVIK INCIDENT REPORT
=========================

Report ID: ${reportId}
Date Generated: ${new Date().toLocaleString()}

Dear ${policeStation.contactPerson?.name || policeStation.name},

A new incident has been reported through the Civik platform.

INCIDENT SUMMARY
----------------
Type: ${incidentType}
Severity: ${incident.severity?.toUpperCase()}
Date: ${incidentDate}
Location: ${incident.location?.address || 'Not specified'}

INCIDENT TITLE
--------------
${incident.title}

DESCRIPTION
-----------
${incident.description}

${incident.mediaFiles?.length > 0 ? `EVIDENCE: ${incident.mediaFiles.length} media file(s) attached to this report.` : ''}

The full incident report is attached to this email as a PDF document.

Best regards,
Civik Team

---
Disclaimer: This report was generated automatically by the Civik platform.
© ${new Date().getFullYear()} Civik - Community Dash Cam Safety Platform
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Civik <noreply@civik.com>',
    to: policeStation.email,
    subject: subject,
    text: textBody,
    html: htmlBody,
    attachments: []
  };

  // Attach PDF if path provided
  if (pdfPath && fs.existsSync(pdfPath)) {
    mailOptions.attachments.push({
      filename: `Civik-Report-${reportId}.pdf`,
      path: pdfPath,
      contentType: 'application/pdf'
    });
  }

  // If no transporter (dev mode), log and return mock result
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP not configured — cannot send emails in production');
    }
    console.log('=== EMAIL WOULD BE SENT (dev mode) ===');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    console.log('===========================');
    return {
      success: false,
      mock: true,
      messageId: `mock-${Date.now()}`,
      preview: 'Email logged to console (no SMTP configured)'
    };
  }

  // Send email
  const info = await transport.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId,
    response: info.response
  };
}

/**
 * Send insurance claim notification
 */
export async function sendClaimNotification(recipientEmail, claim, type = 'submitted') {
  const transport = await getTransporter();

  const subjects = {
    'submitted': `Insurance Claim Submitted - ${claim.claimId}`,
    'approved': `Insurance Claim Approved - ${claim.claimId}`,
    'rejected': `Insurance Claim Status Update - ${claim.claimId}`,
    'update': `Insurance Claim Update - ${claim.claimId}`
  };

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Civik <noreply@civik.com>',
    to: recipientEmail,
    subject: subjects[type] || subjects['update'],
    text: `Your insurance claim (${claim.claimId}) has been ${type}. Log in to Civik to view details.`,
    html: `
      <h2>Insurance Claim ${type.charAt(0).toUpperCase() + type.slice(1)}</h2>
      <p>Your insurance claim with ID <strong>${claim.claimId}</strong> has been ${type}.</p>
      <p>Log in to Civik to view full details and next steps.</p>
    `
  };

  if (!transport) {
    console.log('=== CLAIM NOTIFICATION EMAIL ===');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    console.log('================================');
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  const info = await transport.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

// Helper to format incident type
function formatType(type) {
  const types = {
    'dangerous_driving': 'Dangerous Driving',
    'crime': 'Crime',
    'security': 'Security Concern',
    'other': 'Other'
  };
  return types[type] || type || 'Unknown';
}

export default {
  sendPoliceReport,
  sendClaimNotification
};
