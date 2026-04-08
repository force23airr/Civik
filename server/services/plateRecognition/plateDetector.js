/**
 * License Plate Detection Service
 *
 * Supports multiple backends:
 * 1. Plate Recognizer API (recommended - high accuracy)
 * 2. OpenALPR Cloud API
 * 3. Local processing placeholder for future integration
 *
 * Set PLATE_RECOGNITION_PROVIDER and API key in .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detection result structure
class PlateDetection {
  constructor(data) {
    this.plate = data.plate;                    // License plate text
    this.confidence = data.confidence;          // 0-100 confidence score
    this.region = data.region || null;          // State/region if detected
    this.vehicleType = data.vehicleType || null; // car, truck, motorcycle
    this.boundingBox = data.boundingBox || null; // {x, y, width, height}
    this.timestamp = data.timestamp || null;    // Frame timestamp if from video
    this.imageUrl = data.imageUrl || null;      // Cropped plate image
  }
}

/**
 * Detect license plates from an image file
 */
export async function detectPlatesFromImage(imagePath) {
  const provider = process.env.PLATE_RECOGNITION_PROVIDER || 'mock';

  switch (provider.toLowerCase()) {
    case 'platerecognizer':
      return await detectWithPlateRecognizer(imagePath);
    case 'openalpr':
      return await detectWithOpenALPR(imagePath);
    default:
      return await mockDetection(imagePath);
  }
}

/**
 * Detect license plates from a video file
 * Extracts frames and processes each
 */
export async function detectPlatesFromVideo(videoPath, options = {}) {
  const {
    frameInterval = 1,      // Extract every N seconds
    maxFrames = 30,         // Maximum frames to process
    startTime = 0,          // Start time in seconds
    endTime = null          // End time in seconds
  } = options;

  // For now, return mock data
  // In production, use ffmpeg to extract frames then process each
  console.log(`Processing video: ${videoPath}`);
  console.log(`Options: interval=${frameInterval}s, maxFrames=${maxFrames}`);

  // Mock detection for video
  const mockPlates = await mockDetection(videoPath);

  return {
    videoPath,
    framesProcessed: 10,
    detections: mockPlates,
    uniquePlates: [...new Set(mockPlates.map(p => p.plate))]
  };
}

/**
 * Plate Recognizer API Integration
 * Sign up at: https://platerecognizer.com/
 */
async function detectWithPlateRecognizer(imagePath) {
  const apiKey = process.env.PLATE_RECOGNIZER_API_KEY;

  if (!apiKey) {
    console.warn('PLATE_RECOGNIZER_API_KEY not set, falling back to mock');
    return await mockDetection(imagePath);
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch('https://api.platerecognizer.com/v1/plate-reader/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        upload: base64Image,
        regions: ['us', 'ca', 'mx'], // North America
        config: {
          mode: 'fast'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Plate Recognizer API error: ${response.status}`);
    }

    const data = await response.json();

    return data.results.map(result => new PlateDetection({
      plate: result.plate.toUpperCase(),
      confidence: Math.round(result.score * 100),
      region: result.region?.code,
      vehicleType: result.vehicle?.type,
      boundingBox: result.box ? {
        x: result.box.xmin,
        y: result.box.ymin,
        width: result.box.xmax - result.box.xmin,
        height: result.box.ymax - result.box.ymin
      } : null
    }));
  } catch (error) {
    console.error('Plate Recognizer error:', error.message);
    return [];
  }
}

/**
 * OpenALPR Cloud API Integration
 * Sign up at: https://www.openalpr.com/cloud-api.html
 */
async function detectWithOpenALPR(imagePath) {
  const apiKey = process.env.OPENALPR_API_KEY;

  if (!apiKey) {
    console.warn('OPENALPR_API_KEY not set, falling back to mock');
    return await mockDetection(imagePath);
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // OpenALPR v3 requires secret_key as a query param (vendor limitation).
    // Build URL via URL object so the key never appears in template literals or logs.
    const alprUrl = new URL('https://api.openalpr.com/v3/recognize_bytes');
    alprUrl.searchParams.set('secret_key', apiKey);
    alprUrl.searchParams.set('recognize_vehicle', '1');
    alprUrl.searchParams.set('country', 'us');
    alprUrl.searchParams.set('return_image', '0');

    const response = await fetch(alprUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_bytes: base64Image
      })
    });

    if (!response.ok) {
      throw new Error(`OpenALPR API error: ${response.status}`);
    }

    const data = await response.json();

    return data.results.map(result => new PlateDetection({
      plate: result.plate.toUpperCase(),
      confidence: Math.round(result.confidence),
      region: result.region,
      vehicleType: result.vehicle?.type,
      boundingBox: result.coordinates ? {
        x: Math.min(...result.coordinates.map(c => c.x)),
        y: Math.min(...result.coordinates.map(c => c.y)),
        width: Math.max(...result.coordinates.map(c => c.x)) - Math.min(...result.coordinates.map(c => c.x)),
        height: Math.max(...result.coordinates.map(c => c.y)) - Math.min(...result.coordinates.map(c => c.y))
      } : null
    }));
  } catch (error) {
    // Sanitize error to prevent API key leakage in logs
    console.error('OpenALPR error:', error.message);
    return [];
  }
}

/**
 * Mock detection for testing without API keys
 * In production, replace with actual detection
 */
async function mockDetection(filePath) {
  console.log(`[Mock] Processing: ${filePath}`);

  // Return empty array - no fake data
  // This allows the system to work without API keys
  // but won't return fake plates
  return [];
}

/**
 * Validate a license plate format
 */
export function validatePlateFormat(plate, region = 'US') {
  if (!plate || typeof plate !== 'string') return false;

  const cleaned = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  // US plates are typically 5-8 characters
  if (region === 'US') {
    return cleaned.length >= 5 && cleaned.length <= 8;
  }

  return cleaned.length >= 4 && cleaned.length <= 10;
}

/**
 * Clean and normalize a plate string
 */
export function normalizePlate(plate) {
  if (!plate) return null;
  return plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Check if a plate has been reported before
 */
export async function checkPlateHistory(plate, Incident) {
  const normalizedPlate = normalizePlate(plate);

  if (!normalizedPlate) return { found: false, incidents: [] };

  const incidents = await Incident.find({
    'detectedPlates.plate': normalizedPlate
  })
    .select('_id title type severity createdAt location')
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    found: incidents.length > 0,
    count: incidents.length,
    incidents: incidents,
    isRepeatOffender: incidents.length >= 3
  };
}

export default {
  detectPlatesFromImage,
  detectPlatesFromVideo,
  validatePlateFormat,
  normalizePlate,
  checkPlateHistory,
  PlateDetection
};
