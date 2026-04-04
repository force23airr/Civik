import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import fs from 'fs';
import ViolationReport from '../../models/ViolationReport.js';
import { generatePackage, generateEvidenceManifest } from '../evidence/evidencePackager.js';
import { getApplicableStatutes } from '../../config/trafficCodes.js';

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
 * Insurance database types
 */
export const INSURANCE_DATABASES = {
  CLUE: {
    name: 'C.L.U.E. (Comprehensive Loss Underwriting Exchange)',
    description: 'LexisNexis database used by insurers for claims history'
  },
  ISO_ClaimSearch: {
    name: 'ISO ClaimSearch',
    description: 'Verisk database for insurance claims information'
  },
  direct_insurer: {
    name: 'Direct Insurer Submission',
    description: 'Direct submission to a specific insurance company'
  }
};

/**
 * Report a violation to insurance databases
 * @param {Object} violationReport - ViolationReport document
 * @param {Object} options - Submission options
 * @returns {Promise<Object>} Submission record
 */
export async function reportViolation(violationReport, options = {}) {
  const submission = {
    submissionId: `INS-${Date.now()}-${uuidv4().slice(0, 8)}`,
    targetDatabase: options.database || 'direct_insurer',
    insurerName: options.insurerName,
    submittedAt: new Date(),
    status: 'pending',
    referenceNumber: null,
    lastUpdated: new Date()
  };

  try {
    // Generate evidence manifest for insurance
    const manifestPath = await generateEvidenceManifest(violationReport);

    if (options.database === 'direct_insurer' && options.insurerEmail) {
      // Send to specific insurer's claims/fraud department
      await sendToInsurer(violationReport, {
        email: options.insurerEmail,
        name: options.insurerName,
        manifestPath
      });

      submission.status = 'received';
      submission.referenceNumber = `REF-${Date.now().toString(36).toUpperCase()}`;
    } else {
      // For CLUE/ISO - these would be API integrations
      // Placeholder for future integration
      submission.status = 'pending';
    }

  } catch (error) {
    console.error('Error reporting to insurance:', error);
    submission.status = 'pending';
  }

  // Add submission to report
  violationReport.insuranceSubmissions.push(submission);

  // Add custody entry
  violationReport.addCustodyEntry(
    'submitted_to_insurance',
    options.userId,
    `Reported to ${submission.targetDatabase}${submission.insurerName ? ` (${submission.insurerName})` : ''}. Submission ID: ${submission.submissionId}`,
    options.ipAddress,
    options.userAgent
  );

  await violationReport.save();
  return submission;
}

/**
 * Send violation report to insurance company
 */
async function sendToInsurer(report, insurerInfo) {
  const transport = getTransporter();

  const violationTypeDisplay = report.violationTypeDisplay || report.violationType.replace(/_/g, ' ');

  const subject = `Traffic Violation Report - License Plate ${report.offendingVehicle?.licensePlate} - ${violationTypeDisplay}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .summary-box { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 15px 0; }
    .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { background: #f0f0f0; padding: 15px; font-size: 12px; color: #666; }
    .license-plate { font-size: 24px; font-weight: bold; background: #fff; border: 2px solid #000; padding: 10px 20px; display: inline-block; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Traffic Violation Report</h1>
    <p>Civik Community Safety Platform</p>
  </div>

  <div class="content">
    <p>Dear ${insurerInfo.name} Claims Department,</p>

    <p>This report documents a traffic violation by an insured driver, submitted by a witness through the Civik platform.</p>

    <div class="alert-box">
      <h3>Vehicle of Interest</h3>
      <p class="license-plate">${report.offendingVehicle?.licensePlate}</p>
      <p><strong>State:</strong> ${report.offendingVehicle?.plateState}</p>
      ${report.offendingVehicle?.make ? `<p><strong>Vehicle:</strong> ${[report.offendingVehicle.color, report.offendingVehicle.make, report.offendingVehicle.model].filter(Boolean).join(' ')}</p>` : ''}
    </div>

    <div class="summary-box">
      <h3>Violation Details</h3>
      <p><strong>Report Number:</strong> ${report.reportNumber}</p>
      <p><strong>Violation Type:</strong> ${violationTypeDisplay}</p>
      <p><strong>Severity:</strong> ${report.severity?.toUpperCase()}</p>
      <p><strong>Date/Time:</strong> ${new Date(report.incidentDateTime).toLocaleString()}</p>
      <p><strong>Location:</strong> ${report.location?.address || 'Not specified'}</p>
      ${report.location?.roadType ? `<p><strong>Road Type:</strong> ${report.location.roadType}</p>` : ''}
    </div>

    <h3>Incident Description</h3>
    <p>${report.description}</p>

    ${report.applicableStatutes?.length > 0 ? `
    <h3>Applicable Traffic Violations</h3>
    <ul>
      ${report.applicableStatutes.map(s => `<li><strong>${s.state} ${s.code}</strong>: ${s.description} (${s.points} points)</li>`).join('')}
    </ul>
    ` : ''}

    <h3>Evidence</h3>
    <p>This report includes ${report.evidence?.length || 0} evidence file(s) with verified integrity hashes. The detailed evidence manifest is attached to this email.</p>

    <h3>Reason for Submission</h3>
    <p>This violation report is being submitted to aid in:</p>
    <ul>
      <li>Risk assessment for the identified vehicle/driver</li>
      <li>Claims investigation if relevant to future claims</li>
      <li>Accurate premium pricing based on driving behavior</li>
    </ul>

    <p>For questions or to access the full evidence package, please contact us.</p>

    <p>Best regards,<br>Civik Insurance Reporting Team</p>
  </div>

  <div class="footer">
    <p><strong>Notice:</strong> This report is submitted in good faith by a community member. The evidence has been preserved with cryptographic integrity verification. All information is subject to verification.</p>
    <p>&copy; ${new Date().getFullYear()} Civik - Community Safety Platform</p>
  </div>
</body>
</html>
  `;

  const textBody = `
TRAFFIC VIOLATION REPORT
========================

Report Number: ${report.reportNumber}

Dear ${insurerInfo.name} Claims Department,

This report documents a traffic violation submitted through the Civik platform.

VEHICLE OF INTEREST
-------------------
License Plate: ${report.offendingVehicle?.licensePlate}
State: ${report.offendingVehicle?.plateState}
${report.offendingVehicle?.make ? `Vehicle: ${[report.offendingVehicle.color, report.offendingVehicle.make, report.offendingVehicle.model].filter(Boolean).join(' ')}` : ''}

VIOLATION DETAILS
-----------------
Type: ${violationTypeDisplay}
Severity: ${report.severity?.toUpperCase()}
Date/Time: ${new Date(report.incidentDateTime).toLocaleString()}
Location: ${report.location?.address || 'Not specified'}

DESCRIPTION
-----------
${report.description}

Evidence files: ${report.evidence?.length || 0} file(s) with verified integrity hashes

---
© ${new Date().getFullYear()} Civik - Community Safety Platform
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Civik <noreply@civik.com>',
    to: insurerInfo.email,
    subject: subject,
    text: textBody,
    html: htmlBody,
    attachments: []
  };

  if (insurerInfo.manifestPath && fs.existsSync(insurerInfo.manifestPath)) {
    mailOptions.attachments.push({
      filename: `evidence_manifest_${report.reportNumber}.pdf`,
      path: insurerInfo.manifestPath,
      contentType: 'application/pdf'
    });
  }

  if (!transport) {
    console.log('=== INSURANCE REPORT EMAIL ===');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    console.log('Attachments:', mailOptions.attachments.length);
    console.log('==============================');
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  const info = await transport.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

/**
 * Create a witness report from InsuranceClaim form data
 * This completes the backend for InsuranceClaim.jsx witness report feature
 * @param {Object} claimData - Data from the InsuranceClaim form
 * @param {Object} witnessUser - User who is submitting as witness
 * @returns {Promise<Object>} Created ViolationReport
 */
export async function createWitnessReport(claimData, witnessUser) {
  // Map incident type to violation type
  const violationTypeMap = {
    'collision': 'reckless_driving',
    'hit_and_run': 'hit_and_run',
    'near_miss': 'aggressive_driving',
    'road_rage': 'road_rage',
    'reckless_driving': 'reckless_driving',
    'dui': 'dui_suspected',
    'speeding': 'speeding',
    'red_light': 'running_red_light',
    'stop_sign': 'running_stop_sign',
    'other': 'other'
  };

  const violationType = violationTypeMap[claimData.incidentType] || 'other';

  // Get applicable statutes
  const state = claimData.location?.state || claimData.otherPartyState;
  const statutes = state ? getApplicableStatutes(violationType, state) : [];

  const violationReport = new ViolationReport({
    reporter: witnessUser._id,
    violationType,
    severity: claimData.severity || 'moderate',
    offendingVehicle: {
      licensePlate: claimData.otherPartyPlate?.toUpperCase(),
      plateState: claimData.otherPartyState,
      plateCountry: 'US',
      make: claimData.otherPartyVehicle?.make,
      model: claimData.otherPartyVehicle?.model,
      color: claimData.otherPartyVehicle?.color,
      vehicleType: claimData.otherPartyVehicle?.type
    },
    location: {
      address: claimData.location?.address || claimData.incidentAddress,
      city: claimData.location?.city,
      state: claimData.location?.state,
      zipCode: claimData.location?.zipCode,
      lat: claimData.location?.lat || 0,
      lng: claimData.location?.lng || 0,
      roadType: claimData.location?.roadType
    },
    incidentDateTime: claimData.incidentDate ? new Date(claimData.incidentDate) : new Date(),
    description: claimData.description || 'Witness report submitted via insurance claim form.',
    reporterVehicle: {
      wasInvolved: claimData.reporterWasInvolved || false,
      damageDescription: claimData.reporterDamage,
      estimatedDamage: claimData.estimatedDamage
    },
    applicableStatutes: statutes,
    consent: {
      tosAccepted: true,
      tosAcceptedAt: new Date(),
      certifyTruthful: true,
      authorizePoliceContact: claimData.authorizePoliceContact || false,
      authorizeInsuranceReport: true,
      willingToTestify: claimData.willingToTestify || false
    },
    status: 'submitted'
  });

  // Add initial custody entry
  violationReport.addCustodyEntry(
    'created',
    witnessUser._id,
    'Witness report created via insurance claim form',
    claimData.ipAddress,
    claimData.userAgent
  );

  await violationReport.save();

  return violationReport;
}

/**
 * Get insurance submission history for a violation report
 * @param {Object} violationReport - ViolationReport document
 * @returns {Array} Insurance submissions
 */
export function getInsuranceSubmissions(violationReport) {
  return violationReport.insuranceSubmissions || [];
}

/**
 * Update insurance submission status
 * @param {Object} violationReport - ViolationReport document
 * @param {string} submissionId - Submission ID to update
 * @param {Object} updateData - New status data
 */
export async function updateInsuranceSubmission(violationReport, submissionId, updateData) {
  const submission = violationReport.insuranceSubmissions.find(
    s => s.submissionId === submissionId
  );

  if (!submission) {
    throw new Error('Submission not found');
  }

  if (updateData.status) submission.status = updateData.status;
  if (updateData.referenceNumber) submission.referenceNumber = updateData.referenceNumber;
  submission.lastUpdated = new Date();

  violationReport.addCustodyEntry(
    'status_changed',
    updateData.performedBy,
    `Insurance submission status updated to: ${updateData.status}${updateData.referenceNumber ? `. Ref: ${updateData.referenceNumber}` : ''}`
  );

  await violationReport.save();
  return submission;
}

/**
 * Get common insurance companies by state
 * @param {string} state - Two-letter state code
 * @returns {Array} Common insurers in that state
 */
export function getCommonInsurers(state) {
  // Major national insurers
  const nationalInsurers = [
    { name: 'State Farm', email: 'claims@statefarm.com' },
    { name: 'GEICO', email: 'claims@geico.com' },
    { name: 'Progressive', email: 'claims@progressive.com' },
    { name: 'Allstate', email: 'claims@allstate.com' },
    { name: 'USAA', email: 'claims@usaa.com' },
    { name: 'Liberty Mutual', email: 'claims@libertymutual.com' },
    { name: 'Farmers', email: 'claims@farmers.com' },
    { name: 'Nationwide', email: 'claims@nationwide.com' },
    { name: 'American Family', email: 'claims@amfam.com' },
    { name: 'Travelers', email: 'claims@travelers.com' }
  ];

  // Note: These are placeholder emails. Real integration would use actual claims APIs
  return nationalInsurers;
}

export default {
  INSURANCE_DATABASES,
  reportViolation,
  createWitnessReport,
  getInsuranceSubmissions,
  updateInsuranceSubmission,
  getCommonInsurers
};
