import express from 'express';
import { auth } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimit.js';
import {
  detectPlatesFromIncident,
  getIncidentPlates,
  getPlateHistory,
  addPlateManually,
  removePlate,
  verifyPlate,
  searchByPlate,
  getFlaggedPlates,
  getPlateStats
} from '../controllers/plateController.js';

const router = express.Router();

// Protected routes require authentication
router.use(auth);

const requireAdminOrPolice = (req, res, next) => {
  if (!['admin', 'police_officer'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Flagged plates and stats restricted to admin/police
router.get('/flagged', requireAdminOrPolice, getFlaggedPlates);
router.get('/stats', requireAdminOrPolice, getPlateStats);

// Detect plates from incident media files
router.post('/detect/:incidentId', detectPlatesFromIncident);

// Get plates for a specific incident
router.get('/incident/:incidentId', getIncidentPlates);

// Search incidents by plate number (rate limited to prevent enumeration)
router.get('/search', generalLimiter, searchByPlate);

// Get history for a specific plate (rate limited, restricted to admin/police)
router.get('/history/:plate', generalLimiter, getPlateHistory);

// Manually add a plate to an incident
router.post('/incident/:incidentId/add', addPlateManually);

// Remove a plate from an incident
router.delete('/incident/:incidentId/:plateId', removePlate);

// Verify a detected plate
router.put('/incident/:incidentId/:plateId/verify', verifyPlate);

export default router;
