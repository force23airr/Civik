import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '../../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Generate a police incident report PDF
 */
export async function generatePoliceReport(incident, policeStation, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const reportId = `RPT-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
      const filename = `police-report-${reportId}.pdf`;
      const filepath = path.join(reportsDir, filename);

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).font('Helvetica-Bold')
        .text('CIVIK INCIDENT REPORT', { align: 'center' });

      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .fillColor('#666666')
        .text(`Report ID: ${reportId}`, { align: 'center' })
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.moveDown(1);
      doc.strokeColor('#333333').lineWidth(1)
        .moveTo(50, doc.y).lineTo(562, doc.y).stroke();

      doc.moveDown(1);

      // Police Station Info
      if (policeStation) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
          .text('SUBMITTED TO:');
        doc.fontSize(10).font('Helvetica')
          .text(policeStation.name)
          .text(policeStation.jurisdiction)
          .text(policeStation.email);
        if (policeStation.phone) {
          doc.text(policeStation.phone);
        }
        doc.moveDown(1);
      }

      // Incident Summary Box
      doc.rect(50, doc.y, 512, 80).fillAndStroke('#f5f5f5', '#cccccc');
      const boxY = doc.y + 10;

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
        .text('INCIDENT SUMMARY', 60, boxY);

      doc.fontSize(10).font('Helvetica')
        .text(`Type: ${formatType(incident.type)}`, 60, boxY + 20)
        .text(`Severity: ${incident.severity?.toUpperCase() || 'N/A'}`, 300, boxY + 20)
        .text(`Status: ${incident.status?.toUpperCase() || 'PENDING'}`, 60, boxY + 35)
        .text(`Date: ${new Date(incident.createdAt).toLocaleDateString()}`, 300, boxY + 35)
        .text(`Time: ${new Date(incident.createdAt).toLocaleTimeString()}`, 60, boxY + 50);

      doc.y = boxY + 90;

      // Location
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold')
        .text('LOCATION');
      doc.fontSize(10).font('Helvetica')
        .text(incident.location?.address || 'Not specified');
      if (incident.location?.lat && incident.location?.lng) {
        doc.text(`GPS: ${incident.location.lat.toFixed(6)}, ${incident.location.lng.toFixed(6)}`);
      }

      // Reporter Information
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold')
        .text('REPORTER INFORMATION');

      if (options.anonymize) {
        doc.fontSize(10).font('Helvetica')
          .text('Reporter information withheld for privacy');
      } else {
        doc.fontSize(10).font('Helvetica')
          .text(`Username: ${incident.user?.username || 'Anonymous'}`)
          .text(`User ID: ${incident.user?._id || 'N/A'}`);
      }

      // Incident Details
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold')
        .text('INCIDENT TITLE');
      doc.fontSize(10).font('Helvetica')
        .text(incident.title);

      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold')
        .text('DESCRIPTION');
      doc.fontSize(10).font('Helvetica')
        .text(incident.description, {
          width: 512,
          align: 'justify'
        });

      // Media Files
      if (incident.mediaFiles && incident.mediaFiles.length > 0) {
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold')
          .text('ATTACHED MEDIA FILES');

        incident.mediaFiles.forEach((file, index) => {
          doc.fontSize(10).font('Helvetica')
            .text(`${index + 1}. ${file.filename} (${file.mimetype})`);
        });

        if (options.baseUrl) {
          doc.moveDown(0.5);
          doc.fontSize(9).font('Helvetica').fillColor('#0066cc')
            .text('Media files can be accessed via secure links provided separately.', {
              link: options.baseUrl
            });
          doc.fillColor('#000000');
        }
      }

      // Footer
      doc.moveDown(2);
      doc.strokeColor('#333333').lineWidth(1)
        .moveTo(50, doc.y).lineTo(562, doc.y).stroke();

      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
        .text('DISCLAIMER: This report was generated automatically by the Civik platform. ', { continued: true })
        .text('The accuracy of the information depends on user submissions. ')
        .text('Civik is not responsible for the accuracy of incident details provided by users.');

      doc.moveDown(0.5);
      doc.text(`© ${new Date().getFullYear()} Civik - Community Dash Cam Safety Platform`, { align: 'center' });

      // Finalize
      doc.end();

      stream.on('finish', () => {
        resolve({
          reportId,
          filename,
          filepath,
          path: `/reports/${filename}`,
          generatedAt: new Date()
        });
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate an insurance claim report PDF
 */
export async function generateInsuranceClaimPDF(claim, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `insurance-claim-${claim.claimId}.pdf`;
      const filepath = path.join(reportsDir, filename);

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(18).font('Helvetica-Bold')
        .text('INSURANCE CLAIM DOCUMENT', { align: 'center' });

      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .fillColor('#666666')
        .text(`Claim ID: ${claim.claimId}`, { align: 'center' })
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.moveDown(1);
      doc.strokeColor('#333333').lineWidth(2)
        .moveTo(50, doc.y).lineTo(562, doc.y).stroke();

      doc.moveDown(1).fillColor('#000000');

      // Claimant Information
      doc.fontSize(14).font('Helvetica-Bold')
        .text('CLAIMANT INFORMATION');
      doc.moveDown(0.5);

      const claimant = claim.claimant || {};
      doc.fontSize(10).font('Helvetica');

      if (claimant.name) {
        const fullName = [claimant.name.first, claimant.name.middle, claimant.name.last]
          .filter(Boolean).join(' ');
        doc.text(`Name: ${fullName || 'N/A'}`);
      }
      doc.text(`Policy Number: ${claimant.policyNumber || 'N/A'}`);
      doc.text(`Insurance Company: ${claimant.insuranceCompany || 'N/A'}`);
      doc.text(`Contact Email: ${claimant.contactEmail || 'N/A'}`);
      doc.text(`Contact Phone: ${claimant.contactPhone || 'N/A'}`);

      // Vehicle Information
      if (claimant.vehicleInfo) {
        doc.moveDown(1);
        doc.fontSize(14).font('Helvetica-Bold')
          .text('VEHICLE INFORMATION');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');

        const vehicle = claimant.vehicleInfo;
        doc.text(`Make: ${vehicle.make || 'N/A'}`);
        doc.text(`Model: ${vehicle.model || 'N/A'}`);
        doc.text(`Year: ${vehicle.year || 'N/A'}`);
        doc.text(`VIN: ${vehicle.vin || 'N/A'}`);
        doc.text(`License Plate: ${vehicle.licensePlate || 'N/A'}`);
      }

      // Loss Details
      doc.moveDown(1);
      doc.fontSize(14).font('Helvetica-Bold')
        .text('LOSS DETAILS');
      doc.moveDown(0.5);

      const loss = claim.lossDetails || {};
      doc.fontSize(10).font('Helvetica');
      doc.text(`Date of Loss: ${loss.dateOfLoss ? new Date(loss.dateOfLoss).toLocaleDateString() : 'N/A'}`);
      doc.text(`Time of Loss: ${loss.timeOfLoss || 'N/A'}`);

      if (loss.locationOfLoss) {
        doc.text(`Location: ${loss.locationOfLoss.address || 'N/A'}, ${loss.locationOfLoss.city || ''}, ${loss.locationOfLoss.state || ''}`);
      }

      doc.text(`Estimated Damage: $${loss.estimatedDamage?.toLocaleString() || 'N/A'}`);
      doc.text(`Injuries Reported: ${loss.injuries ? 'Yes' : 'No'}`);

      doc.moveDown(0.5);
      doc.text('Description:', { continued: false });
      doc.text(loss.descriptionOfLoss || 'No description provided', {
        width: 512,
        align: 'justify'
      });

      // Third Party
      if (claim.thirdParty?.involved) {
        doc.moveDown(1);
        doc.fontSize(14).font('Helvetica-Bold')
          .text('THIRD PARTY INFORMATION');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica')
          .text('Third party involvement: Yes');

        if (claim.thirdParty.parties && claim.thirdParty.parties.length > 0) {
          claim.thirdParty.parties.forEach((party, index) => {
            doc.text(`Party ${index + 1}: ${party.name || 'Unknown'}`);
          });
        }
      }

      // Evidence
      doc.moveDown(1);
      doc.fontSize(14).font('Helvetica-Bold')
        .text('EVIDENCE & DOCUMENTATION');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      if (claim.evidence?.policeReportNumber) {
        doc.text(`Police Report #: ${claim.evidence.policeReportNumber}`);
      }

      if (claim.evidence?.mediaFiles && claim.evidence.mediaFiles.length > 0) {
        doc.text(`Attached Media Files: ${claim.evidence.mediaFiles.length}`);
      }

      if (claim.evidence?.witnesses && claim.evidence.witnesses.length > 0) {
        doc.text(`Witnesses: ${claim.evidence.witnesses.length}`);
      }

      // Footer
      doc.moveDown(2);
      doc.strokeColor('#333333').lineWidth(1)
        .moveTo(50, doc.y).lineTo(562, doc.y).stroke();

      doc.moveDown(0.5);
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
        .text('This document was generated by Civik for insurance claim purposes. ', { continued: true })
        .text('All information is provided by the claimant and should be verified independently.');

      doc.end();

      stream.on('finish', () => {
        resolve({
          claimId: claim.claimId,
          filename,
          filepath,
          path: `/reports/${filename}`,
          generatedAt: new Date()
        });
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
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
  generatePoliceReport,
  generateInsuranceClaimPDF
};
