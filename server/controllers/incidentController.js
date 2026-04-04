import Incident from '../models/Incident.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  detectPlatesFromImage,
  detectPlatesFromVideo
} from '../services/plateRecognition/plateDetector.js';
import { awardIncidentCredits } from '../services/rewards/rewardService.js';
import { routeIncident } from '../services/municipal/routingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Async plate detection helper (runs in background)
const processPlateDetection = async (incident) => {
  try {
    if (!incident.mediaFiles || incident.mediaFiles.length === 0) return;

    const allDetections = [];

    for (const file of incident.mediaFiles) {
      const filePath = path.join(__dirname, '..', file.path.replace(/^\//, ''));
      const uploadsDir = path.resolve(__dirname, '..', 'uploads');
      if (!path.resolve(filePath).startsWith(uploadsDir)) {
        console.warn(`[PlateDetection] Path traversal blocked: ${filePath}`);
        continue;
      }

      if (!fs.existsSync(filePath)) {
        console.warn(`[PlateDetection] File not found: ${filePath}`);
        continue;
      }

      let detections = [];

      if (file.mimetype.startsWith('video')) {
        const result = await detectPlatesFromVideo(filePath);
        detections = result.detections;
      } else if (file.mimetype.startsWith('image')) {
        detections = await detectPlatesFromImage(filePath);
      }

      detections.forEach(detection => {
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

    if (allDetections.length > 0) {
      await Incident.findByIdAndUpdate(incident._id, {
        $push: { detectedPlates: { $each: allDetections } }
      });
      console.log(`[PlateDetection] Found ${allDetections.length} plates for incident ${incident._id}`);
    }
  } catch (error) {
    console.error(`[PlateDetection] Error processing incident ${incident._id}:`, error);
  }
};

// @desc    Get all incidents
// @route   GET /api/incidents
export const getIncidents = async (req, res) => {
  try {
    const { type, severity, status, limit = 20, page = 1 } = req.query;

    const query = {};
    if (type && typeof type === 'string') query.type = type;
    if (severity && typeof severity === 'string') query.severity = severity;
    if (status && typeof status === 'string') query.status = status;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const incidents = await Incident.find(query)
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit);

    const total = await Incident.countDocuments(query);

    res.json({
      incidents,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get single incident
// @route   GET /api/incidents/:id
export const getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('user', 'username avatar');

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json(incident);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create incident
// @route   POST /api/incidents
export const createIncident = async (req, res) => {
  try {
    const { title, description, type, severity, location } = req.body;

    // Process uploaded files
    const mediaFiles = req.files ? req.files.map(file => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      mimetype: file.mimetype
    })) : [];

    let parsedLocation;
    try {
      parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
    } catch {
      return res.status(400).json({ message: 'Invalid location format' });
    }

    const incident = await Incident.create({
      user: req.user._id,
      title,
      description,
      type,
      severity,
      location: parsedLocation,
      mediaFiles
    });

    await incident.populate('user', 'username avatar');

    // Trigger plate detection asynchronously (don't await - runs in background)
    if (mediaFiles.length > 0) {
      processPlateDetection(incident).catch(err =>
        console.error('[PlateDetection] Background processing error:', err)
      );
    }

    // Award credits for incident creation (runs in background)
    awardIncidentCredits(incident, req.user._id).catch(err =>
      console.error('[Rewards] Error awarding incident credits:', err)
    );

    // Auto-route infrastructure/weather/traffic incidents to municipal departments
    routeIncident(incident).catch(err =>
      console.error('[Municipal] Routing error:', err.message)
    );

    res.status(201).json(incident);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update incident
// @route   PUT /api/incidents/:id
export const updateIncident = async (req, res) => {
  try {
    let incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this incident' });
    }

    const { title, description, type, severity, status, location } = req.body;
    const updateFields = {};

    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (type) updateFields.type = type;
    if (severity) updateFields.severity = severity;
    if (status) updateFields.status = status;
    if (location) {
      try {
        updateFields.location = typeof location === 'string' ? JSON.parse(location) : location;
      } catch {
        return res.status(400).json({ message: 'Invalid location format' });
      }
    }

    incident = await Incident.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('user', 'username avatar');

    res.json(incident);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Delete incident
// @route   DELETE /api/incidents/:id
export const deleteIncident = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this incident' });
    }

    // Delete associated files
    incident.mediaFiles.forEach(file => {
      const filePath = path.join(__dirname, '..', 'uploads', file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await incident.deleteOne();

    res.json({ message: 'Incident deleted' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get user's incidents
// @route   GET /api/incidents/user/:userId
export const getUserIncidents = async (req, res) => {
  try {
    // Authorization: users can only view their own incidents
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view these incidents' });
    }

    const incidents = await Incident.find({ user: req.params.userId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};
