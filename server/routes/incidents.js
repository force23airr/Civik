import express from 'express';
import {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  deleteIncident,
  getUserIncidents
} from '../controllers/incidentController.js';
import auth from '../middleware/auth.js';
import { optionalAuth } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.get('/', optionalAuth, getIncidents);
router.get('/user/:userId', auth, getUserIncidents);
router.get('/:id', optionalAuth, getIncidentById);
router.post('/', auth, upload.array('media', 5), createIncident);
router.put('/:id', auth, updateIncident);
router.delete('/:id', auth, deleteIncident);

export default router;
