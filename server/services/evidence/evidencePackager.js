import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import { createWriteStream, createReadStream } from 'fs';

const execFileAsync = promisify(execFile);

// Directory for exported evidence packages
const EXPORTS_DIR = path.join(process.cwd(), 'exports');
const KEY_FRAMES_DIR = path.join(process.cwd(), 'uploads', 'keyframes');

/**
 * Evidence Packager Service
 * Handles file integrity, metadata extraction, and court-ready packaging
 */

/**
 * Ensure export directories exist
 */
async function ensureDirectories() {
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
  await fs.mkdir(KEY_FRAMES_DIR, { recursive: true });
}

/**
 * Calculate SHA-256 hash for file integrity verification
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} SHA-256 hash in hexadecimal
 */
export async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Extract video metadata using FFprobe
 * @param {string} filePath - Path to the video file
 * @returns {Promise<Object>} Video metadata
 */
export async function extractVideoMetadata(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', filePath
    ], { encoding: 'utf-8' });
    const data = JSON.parse(stdout);

    const videoStream = data.streams?.find(s => s.codec_type === 'video');
    const frameRateStr = videoStream?.r_frame_rate || '0/1';
    const [num, den] = frameRateStr.split('/').map(Number);
    const frameRate = den > 0 ? num / den : 0;

    return {
      duration: parseFloat(data.format?.duration) || 0,
      resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
      frameRate: Math.round(frameRate * 100) / 100,
      codec: videoStream?.codec_name || 'unknown',
      creationTime: data.format?.tags?.creation_time || null,
      bitRate: parseInt(data.format?.bit_rate) || 0,
      size: parseInt(data.format?.size) || 0
    };
  } catch (error) {
    console.error('Error extracting video metadata:', error.message);
    return {
      duration: 0,
      resolution: 'unknown',
      frameRate: 0,
      codec: 'unknown',
      creationTime: null,
      bitRate: 0,
      size: 0
    };
  }
}

/**
 * Extract EXIF data from images using exiftool or built-in parsing
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Object>} EXIF metadata
 */
export async function extractExifData(filePath) {
  try {
    // Try using exiftool if available
    const { stdout } = await execFileAsync('exiftool', ['-json', filePath], { encoding: 'utf-8' });
    const data = JSON.parse(stdout)[0];

    return {
      captureDevice: data.Model || data.CameraModelName || null,
      originalTimestamp: data.DateTimeOriginal || data.CreateDate || null,
      gpsLat: parseGpsCoordinate(data.GPSLatitude, data.GPSLatitudeRef),
      gpsLng: parseGpsCoordinate(data.GPSLongitude, data.GPSLongitudeRef),
      gpsAltitude: data.GPSAltitude ? parseFloat(data.GPSAltitude) : null,
      imageWidth: data.ImageWidth || null,
      imageHeight: data.ImageHeight || null,
      make: data.Make || null
    };
  } catch (error) {
    // Fallback: return empty metadata if exiftool not available
    console.warn('Could not extract EXIF data:', error.message);
    return {
      captureDevice: null,
      originalTimestamp: null,
      gpsLat: null,
      gpsLng: null,
      gpsAltitude: null,
      imageWidth: null,
      imageHeight: null,
      make: null
    };
  }
}

/**
 * Parse GPS coordinate from EXIF format
 */
function parseGpsCoordinate(coord, ref) {
  if (!coord) return null;
  // Handle string format like "25 deg 46' 0.00" N"
  const match = coord.match(/(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"/);
  if (match) {
    const decimal = parseFloat(match[1]) + parseFloat(match[2]) / 60 + parseFloat(match[3]) / 3600;
    return (ref === 'S' || ref === 'W') ? -decimal : decimal;
  }
  return parseFloat(coord) || null;
}

/**
 * Extract key frames from video at specified timestamps
 * @param {string} videoPath - Path to the video file
 * @param {string} outputDir - Directory to save frames
 * @param {Array<number>} timestamps - Array of timestamps in seconds
 * @returns {Promise<Array>} Array of extracted frame info
 */
export async function extractKeyFrames(videoPath, outputDir, timestamps = []) {
  await fs.mkdir(outputDir, { recursive: true });

  const frames = [];
  for (const ts of timestamps) {
    const outputPath = path.join(outputDir, `frame_${ts}s.jpg`);
    try {
      await execFileAsync('ffmpeg', [
        '-ss', String(ts), '-i', videoPath,
        '-vframes', '1', '-q:v', '2', outputPath, '-y'
      ]);
      frames.push({
        timestamp: ts,
        path: outputPath,
        filename: `frame_${ts}s.jpg`
      });
    } catch (error) {
      console.error(`Failed to extract frame at ${ts}s:`, error.message);
    }
  }
  return frames;
}

/**
 * Auto-extract key frames from video (beginning, middle, end)
 * @param {string} videoPath - Path to the video file
 * @param {string} reportNumber - Report number for directory naming
 * @param {number} duration - Video duration in seconds
 * @returns {Promise<Array>} Array of extracted frame info
 */
export async function autoExtractKeyFrames(videoPath, reportNumber, duration) {
  const outputDir = path.join(KEY_FRAMES_DIR, reportNumber);

  // Extract frames at beginning, 25%, 50%, 75%, and end
  const timestamps = [
    1, // Start
    Math.floor(duration * 0.25),
    Math.floor(duration * 0.5),
    Math.floor(duration * 0.75),
    Math.max(1, Math.floor(duration) - 1) // End
  ].filter((t, i, arr) => t > 0 && arr.indexOf(t) === i); // Remove duplicates and zeros

  return extractKeyFrames(videoPath, outputDir, timestamps);
}

/**
 * Generate court-admissible evidence manifest PDF
 * @param {Object} report - ViolationReport document
 * @returns {Promise<string>} Path to generated PDF
 */
export async function generateEvidenceManifest(report) {
  await ensureDirectories();

  const outputPath = path.join(EXPORTS_DIR, `evidence_manifest_${report.reportNumber}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = createWriteStream(outputPath);

    doc.pipe(stream);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('TRAFFIC VIOLATION EVIDENCE PACKAGE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Report Number: ${report.reportNumber}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();

    // Horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Violation Details
    doc.fontSize(14).font('Helvetica-Bold').text('VIOLATION DETAILS');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Violation Type: ${report.violationTypeDisplay || report.violationType}`);
    doc.text(`Severity: ${report.severity?.toUpperCase()}`);
    doc.text(`Date/Time: ${report.incidentDateTime ? new Date(report.incidentDateTime).toLocaleString() : 'N/A'}`);
    doc.text(`Status: ${report.status}`);
    doc.moveDown();

    // Location Information
    doc.fontSize(14).font('Helvetica-Bold').text('INCIDENT LOCATION');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Address: ${report.location?.address || 'N/A'}`);
    doc.text(`City: ${report.location?.city || 'N/A'}, State: ${report.location?.state || 'N/A'} ${report.location?.zipCode || ''}`);
    doc.text(`GPS Coordinates: ${report.location?.lat}, ${report.location?.lng}`);
    if (report.location?.roadType) doc.text(`Road Type: ${report.location.roadType}`);
    if (report.location?.speedLimit) doc.text(`Speed Limit: ${report.location.speedLimit} mph`);
    doc.moveDown();

    // Offending Vehicle Information
    doc.fontSize(14).font('Helvetica-Bold').text('OFFENDING VEHICLE');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`License Plate: ${report.offendingVehicle?.licensePlate || 'N/A'}`);
    doc.text(`State: ${report.offendingVehicle?.plateState || 'N/A'}`);
    doc.text(`Country: ${report.offendingVehicle?.plateCountry || 'US'}`);
    if (report.offendingVehicle?.make || report.offendingVehicle?.model) {
      doc.text(`Vehicle: ${[report.offendingVehicle.color, report.offendingVehicle.make, report.offendingVehicle.model].filter(Boolean).join(' ')}`);
    }
    if (report.offendingVehicle?.vehicleType) doc.text(`Vehicle Type: ${report.offendingVehicle.vehicleType}`);
    if (report.offendingVehicle?.plateConfidence) doc.text(`Plate Recognition Confidence: ${report.offendingVehicle.plateConfidence}%`);
    doc.moveDown();

    // Evidence Files with Integrity Hashes
    doc.fontSize(14).font('Helvetica-Bold').text('EVIDENCE FILES');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    if (report.evidence && report.evidence.length > 0) {
      report.evidence.forEach((file, index) => {
        doc.font('Helvetica-Bold').text(`File ${index + 1}: ${file.originalFilename || file.filename}`);
        doc.font('Helvetica').text(`  SHA-256: ${file.sha256Hash}`);
        doc.text(`  Type: ${file.mimetype || 'N/A'}`);
        doc.text(`  Size: ${formatFileSize(file.size)}`);
        doc.text(`  Uploaded: ${file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'N/A'}`);
        if (file.metadata) {
          if (file.metadata.duration) doc.text(`  Duration: ${formatDuration(file.metadata.duration)}`);
          if (file.metadata.resolution) doc.text(`  Resolution: ${file.metadata.resolution}`);
        }
        doc.moveDown(0.5);
      });
    } else {
      doc.text('No evidence files attached.');
    }
    doc.moveDown();

    // Chain of Custody
    doc.fontSize(14).font('Helvetica-Bold').text('CHAIN OF CUSTODY');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');

    if (report.chainOfCustody && report.chainOfCustody.length > 0) {
      report.chainOfCustody.forEach(entry => {
        const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A';
        doc.text(`${timestamp} - ${entry.action.toUpperCase()}`);
        if (entry.details) doc.text(`  Details: ${entry.details}`);
        if (entry.entryHash) doc.text(`  Entry Hash: ${entry.entryHash.substring(0, 32)}...`);
        doc.moveDown(0.3);
      });
    } else {
      doc.text('No custody entries recorded.');
    }
    doc.moveDown();

    // Applicable Statutes
    if (report.applicableStatutes && report.applicableStatutes.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('APPLICABLE STATUTES');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      report.applicableStatutes.forEach(statute => {
        doc.font('Helvetica-Bold').text(`${statute.state} ${statute.code}`);
        doc.font('Helvetica').text(`  ${statute.description}`);
        doc.text(`  Fine Range: $${statute.fineRange?.min || 0} - $${statute.fineRange?.max || 0}`);
        doc.text(`  Points: ${statute.points || 0}`);
        if (statute.isMisdemeanor) doc.text(`  Classification: Misdemeanor`);
        doc.moveDown(0.3);
      });
      doc.moveDown();
    }

    // Reporter's Description
    doc.fontSize(14).font('Helvetica-Bold').text('REPORTER\'S ACCOUNT');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(report.description || 'No description provided.', { align: 'left' });
    doc.moveDown();

    // Certification
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text('CERTIFICATION', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    doc.text('I certify that this evidence has been preserved in its original state.', { align: 'center' });
    doc.text('File integrity can be verified using the SHA-256 hashes provided above.', { align: 'center' });
    doc.text('This document constitutes a chain of custody record for all attached evidence.', { align: 'center' });
    doc.moveDown();
    doc.text(`Document Hash: This PDF was generated on ${new Date().toISOString()}`, { align: 'center' });

    // Finalize
    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

/**
 * Create ZIP archive with all evidence files
 * @param {Object} report - ViolationReport document
 * @param {string} manifestPath - Path to the manifest PDF
 * @returns {Promise<string>} Path to the ZIP file
 */
export async function createEvidenceZip(report, manifestPath) {
  await ensureDirectories();

  const zipPath = path.join(EXPORTS_DIR, `evidence_package_${report.reportNumber}.zip`);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);

    archive.pipe(output);

    // Add manifest PDF
    archive.file(manifestPath, { name: `evidence_manifest_${report.reportNumber}.pdf` });

    // Add evidence files
    if (report.evidence && report.evidence.length > 0) {
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      report.evidence.forEach(file => {
        const filePath = path.resolve(process.cwd(), file.path);
        if (!filePath.startsWith(uploadsDir)) {
          console.warn(`[EvidenceZip] Path traversal blocked: ${filePath}`);
          return;
        }
        try {
          archive.file(filePath, { name: `evidence/${file.originalFilename || file.filename}` });
        } catch (err) {
          console.warn(`Could not add file to archive: ${filePath}`);
        }
      });
    }

    // Add key frames if they exist
    const keyFramesDir = path.join(KEY_FRAMES_DIR, report.reportNumber);
    try {
      archive.directory(keyFramesDir, 'keyframes');
    } catch (err) {
      // Key frames directory may not exist, that's okay
    }

    archive.finalize();
  });
}

/**
 * Generate complete court-admissible evidence package
 * @param {Object} violationReport - ViolationReport document
 * @param {Object} options - Options including userId
 * @returns {Promise<Object>} Package paths and hash
 */
export async function generatePackage(violationReport, options = {}) {
  // 1. Generate evidence manifest PDF
  const manifestPath = await generateEvidenceManifest(violationReport);

  // 2. Create ZIP with all evidence
  const zipPath = await createEvidenceZip(violationReport, manifestPath);

  // 3. Calculate package hash
  const packageHash = await calculateFileHash(zipPath);

  // 4. Add custody entry
  violationReport.addCustodyEntry(
    'exported',
    options.userId,
    `Evidence package generated. Package hash: ${packageHash}`,
    options.ipAddress,
    options.userAgent
  );

  await violationReport.save();

  return {
    zipPath,
    manifestPath,
    packageHash,
    reportNumber: violationReport.reportNumber
  };
}

/**
 * Process uploaded evidence file
 * @param {Object} file - Multer file object
 * @param {string} reportNumber - Report number for organization
 * @returns {Promise<Object>} Processed evidence object
 */
export async function processEvidenceFile(file, reportNumber) {
  const filePath = file.path;
  const hash = await calculateFileHash(filePath);

  const evidence = {
    filename: file.filename,
    originalFilename: file.originalname,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    sha256Hash: hash,
    metadata: {},
    keyFrames: [],
    uploadedAt: new Date()
  };

  // Extract metadata based on file type
  if (file.mimetype?.startsWith('video/')) {
    const videoMeta = await extractVideoMetadata(filePath);
    evidence.metadata = {
      duration: videoMeta.duration,
      resolution: videoMeta.resolution,
      frameRate: videoMeta.frameRate,
      codec: videoMeta.codec,
      originalTimestamp: videoMeta.creationTime ? new Date(videoMeta.creationTime) : null
    };

    // Auto-extract key frames
    if (videoMeta.duration > 0) {
      const frames = await autoExtractKeyFrames(filePath, reportNumber, videoMeta.duration);
      evidence.keyFrames = frames;
    }
  } else if (file.mimetype?.startsWith('image/')) {
    const exifData = await extractExifData(filePath);
    evidence.metadata = {
      captureDevice: exifData.captureDevice,
      originalTimestamp: exifData.originalTimestamp ? new Date(exifData.originalTimestamp) : null,
      gpsData: {
        lat: exifData.gpsLat,
        lng: exifData.gpsLng,
        altitude: exifData.gpsAltitude
      },
      resolution: exifData.imageWidth && exifData.imageHeight ? `${exifData.imageWidth}x${exifData.imageHeight}` : null
    };
  }

  return evidence;
}

/**
 * Verify evidence file integrity
 * @param {Object} evidence - Evidence object with sha256Hash
 * @returns {Promise<boolean>} True if file is intact
 */
export async function verifyEvidenceIntegrity(evidence) {
  try {
    const filePath = path.join(process.cwd(), evidence.path);
    const currentHash = await calculateFileHash(filePath);
    return currentHash === evidence.sha256Hash;
  } catch (error) {
    console.error('Error verifying evidence integrity:', error.message);
    return false;
  }
}

/**
 * Verify all evidence in a report
 * @param {Object} report - ViolationReport document
 * @returns {Promise<Object>} Verification results
 */
export async function verifyAllEvidence(report) {
  const results = {
    verified: true,
    files: []
  };

  for (const evidence of report.evidence || []) {
    const isValid = await verifyEvidenceIntegrity(evidence);
    results.files.push({
      filename: evidence.originalFilename || evidence.filename,
      sha256Hash: evidence.sha256Hash,
      isValid
    });
    if (!isValid) results.verified = false;
  }

  return results;
}

// Helper functions
function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default {
  calculateFileHash,
  extractVideoMetadata,
  extractExifData,
  extractKeyFrames,
  autoExtractKeyFrames,
  generateEvidenceManifest,
  createEvidenceZip,
  generatePackage,
  processEvidenceFile,
  verifyEvidenceIntegrity,
  verifyAllEvidence
};
