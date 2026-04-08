import Incident from '../models/Incident.js';
import {
  detectPlatesFromImage,
  detectPlatesFromVideo,
  checkPlateHistory,
  normalizePlate,
  validatePlateFormat
} from '../services/plateRecognition/plateDetector.js';
import path from 'path';
import fs from 'fs';

/**
 * Detect plates from an incident's media files
 * POST /api/plates/detect/:incidentId
 */
export const detectPlatesFromIncident = async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { fileIndex } = req.body; // Optional: specific file to process

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!incident.mediaFiles || incident.mediaFiles.length === 0) {
      return res.status(400).json({ error: 'No media files to process' });
    }

    const allDetections = [];
    const filesToProcess = fileIndex !== undefined
      ? [incident.mediaFiles[fileIndex]]
      : incident.mediaFiles;

    for (const file of filesToProcess) {
      if (!file || !file.path) continue;

      const filePath = path.resolve(file.path);

      // Validate path is within uploads directory to prevent path traversal
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      if (!filePath.startsWith(uploadsDir)) {
        console.warn(`[PlateDetection] Path traversal blocked: ${filePath}`);
        continue;
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
      }

      let detections = [];

      if (file.mimetype.startsWith('video')) {
        const result = await detectPlatesFromVideo(filePath);
        detections = result.detections;
      } else if (file.mimetype.startsWith('image')) {
        detections = await detectPlatesFromImage(filePath);
      }

      // Add source file info to each detection
      detections.forEach(detection => {
        detection.sourceFile = file.filename;
        allDetections.push({
          plate: detection.plate,
          confidence: detection.confidence,
          region: detection.region,
          vehicleType: detection.vehicleType,
          boundingBox: detection.boundingBox,
          sourceFile: file.filename,
          detectedAt: new Date()
        });
      });
    }

    // Merge with existing plates (avoid duplicates)
    const existingPlates = new Set(
      incident.detectedPlates.map(p => normalizePlate(p.plate))
    );

    const newPlates = allDetections.filter(
      d => !existingPlates.has(normalizePlate(d.plate))
    );

    if (newPlates.length > 0) {
      incident.detectedPlates.push(...newPlates);
      await incident.save();
    }

    res.json({
      success: true,
      totalDetected: allDetections.length,
      newPlatesAdded: newPlates.length,
      plates: incident.detectedPlates
    });
  } catch (error) {
    console.error('Plate detection error:', error);
    res.status(500).json({ error: 'Plate detection failed' });
  }
};

/**
 * Get plates for an incident
 * GET /api/plates/incident/:incidentId
 */
export const getIncidentPlates = async (req, res) => {
  try {
    const { incidentId } = req.params;

    const incident = await Incident.findById(incidentId)
      .select('detectedPlates user');

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Authorization: only the incident owner or admin can view plates
    if (incident.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to view plates for this incident' });
    }

    res.json({
      plates: incident.detectedPlates,
      count: incident.detectedPlates.length
    });
  } catch (error) {
    console.error('Error fetching plates:', error);
    res.status(500).json({ error: 'Failed to fetch plates' });
  }
};

/**
 * Check plate history across all incidents
 * GET /api/plates/history/:plate
 */
export const getPlateHistory = async (req, res) => {
  try {
    const { plate } = req.params;

    if (!validatePlateFormat(plate)) {
      return res.status(400).json({ error: 'Invalid plate format' });
    }

    // Restrict plate history to admin and police officers
    if (!['admin', 'police_officer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Plate history is restricted to authorized personnel' });
    }

    const history = await checkPlateHistory(plate, Incident);

    res.json(history);
  } catch (error) {
    console.error('Error checking plate history:', error);
    res.status(500).json({ error: 'Failed to check plate history' });
  }
};

/**
 * Manually add a plate to an incident
 * POST /api/plates/incident/:incidentId/add
 */
export const addPlateManually = async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { plate, region, vehicleType } = req.body;

    if (!plate) {
      return res.status(400).json({ error: 'Plate number is required' });
    }

    if (!validatePlateFormat(plate)) {
      return res.status(400).json({ error: 'Invalid plate format' });
    }

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const normalizedPlate = normalizePlate(plate);

    // Check if plate already exists
    const existingPlate = incident.detectedPlates.find(
      p => normalizePlate(p.plate) === normalizedPlate
    );

    if (existingPlate) {
      return res.status(400).json({ error: 'Plate already added to this incident' });
    }

    incident.detectedPlates.push({
      plate: normalizedPlate,
      confidence: 100, // Manual entry = 100% confidence
      region: region || null,
      vehicleType: vehicleType || null,
      detectedAt: new Date(),
      isVerified: true // Manual entries are pre-verified
    });

    await incident.save();

    res.json({
      success: true,
      plates: incident.detectedPlates
    });
  } catch (error) {
    console.error('Error adding plate:', error);
    res.status(500).json({ error: 'Failed to add plate' });
  }
};

/**
 * Remove a plate from an incident
 * DELETE /api/plates/incident/:incidentId/:plateId
 */
export const removePlate = async (req, res) => {
  try {
    const { incidentId, plateId } = req.params;

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    incident.detectedPlates = incident.detectedPlates.filter(
      p => p._id.toString() !== plateId
    );

    await incident.save();

    res.json({
      success: true,
      plates: incident.detectedPlates
    });
  } catch (error) {
    console.error('Error removing plate:', error);
    res.status(500).json({ error: 'Failed to remove plate' });
  }
};

/**
 * Verify a detected plate
 * PUT /api/plates/incident/:incidentId/:plateId/verify
 */
export const verifyPlate = async (req, res) => {
  try {
    const { incidentId, plateId } = req.params;

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const plateIndex = incident.detectedPlates.findIndex(
      p => p._id.toString() === plateId
    );

    if (plateIndex === -1) {
      return res.status(404).json({ error: 'Plate not found' });
    }

    incident.detectedPlates[plateIndex].isVerified = true;
    await incident.save();

    res.json({
      success: true,
      plate: incident.detectedPlates[plateIndex]
    });
  } catch (error) {
    console.error('Error verifying plate:', error);
    res.status(500).json({ error: 'Failed to verify plate' });
  }
};

/**
 * Search incidents by plate number
 * GET /api/plates/search?plate=ABC123
 */
export const searchByPlate = async (req, res) => {
  try {
    const { plate } = req.query;

    if (!['admin', 'police_officer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Police or admin access required' });
    }

    if (!plate || plate.length < 3) {
      return res.status(400).json({ error: 'Plate must be at least 3 characters' });
    }

    const normalizedSearch = normalizePlate(plate);
    // Escape regex special characters to prevent ReDoS
    const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query = {
      'detectedPlates.plate': { $regex: escapedSearch, $options: 'i' }
    };

    const incidents = await Incident.find(query)
      .populate('user', 'username')
      .select('title type severity location createdAt detectedPlates')
      .sort({ createdAt: -1 })
      .limit(50);

    // Filter to only show matching plates
    const results = incidents.map(incident => ({
      _id: incident._id,
      title: incident.title,
      type: incident.type,
      severity: incident.severity,
      location: incident.location?.address,
      createdAt: incident.createdAt,
      reporter: incident.user?.username,
      matchingPlates: incident.detectedPlates.filter(
        p => normalizePlate(p.plate).includes(normalizedSearch)
      )
    }));

    res.json({
      count: results.length,
      incidents: results
    });
  } catch (error) {
    console.error('Error searching by plate:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * Get most flagged plates leaderboard
 * GET /api/plates/flagged?limit=20&type=dangerous_driving
 */
export const getFlaggedPlates = async (req, res) => {
  try {
    const { limit = 20, type } = req.query;

    // Build match criteria
    const matchCriteria = {
      'detectedPlates.0': { $exists: true } // Has at least one plate
    };

    // Filter by incident type if specified
    if (type) {
      matchCriteria.type = type;
    } else {
      // Default to dangerous driving related types
      matchCriteria.type = {
        $in: ['dangerous_driving', 'crime', 'traffic_accident', 'security']
      };
    }

    const flaggedPlates = await Incident.aggregate([
      { $match: matchCriteria },
      { $unwind: '$detectedPlates' },
      {
        $group: {
          _id: { $toUpper: '$detectedPlates.plate' },
          reportCount: { $sum: 1 },
          incidents: {
            $push: {
              incidentId: '$_id',
              type: '$type',
              severity: '$severity',
              date: '$createdAt',
              location: '$location.address'
            }
          },
          severityCounts: {
            $push: '$severity'
          },
          types: { $addToSet: '$type' },
          firstSeen: { $min: '$createdAt' },
          lastSeen: { $max: '$createdAt' },
          regions: { $addToSet: '$detectedPlates.region' }
        }
      },
      {
        $match: {
          reportCount: { $gte: 1 } // At least 1 report (change to 2+ for production)
        }
      },
      {
        $addFields: {
          // Calculate danger score based on severity and frequency
          dangerScore: {
            $add: [
              { $multiply: ['$reportCount', 10] },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: '$severityCounts',
                        cond: { $eq: ['$$this', 'critical'] }
                      }
                    }
                  },
                  25
                ]
              },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: '$severityCounts',
                        cond: { $eq: ['$$this', 'high'] }
                      }
                    }
                  },
                  15
                ]
              },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: '$severityCounts',
                        cond: { $eq: ['$$this', 'medium'] }
                      }
                    }
                  },
                  5
                ]
              }
            ]
          }
        }
      },
      { $sort: { dangerScore: -1, reportCount: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          plate: '$_id',
          reportCount: 1,
          dangerScore: 1,
          types: 1,
          firstSeen: 1,
          lastSeen: 1,
          regions: 1,
          recentIncidents: { $slice: ['$incidents', 5] } // Last 5 incidents
        }
      }
    ]);

    // Add rank
    const ranked = flaggedPlates.map((plate, idx) => ({
      rank: idx + 1,
      ...plate
    }));

    res.json({
      count: ranked.length,
      plates: ranked
    });
  } catch (error) {
    console.error('Error fetching flagged plates:', error);
    res.status(500).json({ error: 'Failed to fetch flagged plates' });
  }
};

/**
 * Get stats for the flagged plates system
 * GET /api/plates/stats
 */
export const getPlateStats = async (req, res) => {
  try {
    const stats = await Incident.aggregate([
      { $match: { 'detectedPlates.0': { $exists: true } } },
      { $unwind: '$detectedPlates' },
      {
        $group: {
          _id: null,
          totalPlatesDetected: { $sum: 1 },
          uniquePlates: { $addToSet: { $toUpper: '$detectedPlates.plate' } },
          totalIncidentsWithPlates: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          _id: 0,
          totalPlatesDetected: 1,
          uniquePlatesCount: { $size: '$uniquePlates' },
          incidentsWithPlates: { $size: '$totalIncidentsWithPlates' }
        }
      }
    ]);

    const typeBreakdown = await Incident.aggregate([
      { $match: { 'detectedPlates.0': { $exists: true } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      stats: stats[0] || { totalPlatesDetected: 0, uniquePlatesCount: 0, incidentsWithPlates: 0 },
      typeBreakdown
    });
  } catch (error) {
    console.error('Error fetching plate stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

export default {
  detectPlatesFromIncident,
  getIncidentPlates,
  getPlateHistory,
  addPlateManually,
  removePlate,
  verifyPlate,
  searchByPlate,
  getFlaggedPlates,
  getPlateStats
};
