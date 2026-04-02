import express from 'express';
import { auth, optionalAuth } from '../middleware/auth.js';
import {
  getInsurancePartners,
  getDataPartners,
  getDataPartnerById,
  connectToDataPartner,
  disconnectFromDataPartner,
  updatePartnerPreferences,
  getMyConnections,
  getPartnerCategories,
  seedPartners
} from '../controllers/partnerController.js';

const router = express.Router();

// Public routes (with optional auth for connection status)
router.get('/insurance', getInsurancePartners);
router.get('/data', optionalAuth, getDataPartners);
router.get('/data/:id', optionalAuth, getDataPartnerById);
router.get('/categories', getPartnerCategories);

// Protected routes - require authentication
router.get('/my-connections', auth, getMyConnections);
router.post('/data/:id/connect', auth, connectToDataPartner);
router.delete('/data/:id/disconnect', auth, disconnectFromDataPartner);
router.put('/data/:id/preferences', auth, updatePartnerPreferences);

// Admin/Setup route - requires admin role
router.post('/seed', auth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}, seedPartners);

export default router;
