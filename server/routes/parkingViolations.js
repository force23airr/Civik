import express from 'express';
import {
  submitParkingViolation,
  getMyReports,
  getReport,
  getViolationTypes
} from '../controllers/parkingViolationController.js';
import auth from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Public
router.get('/options/types', getViolationTypes);

// Authenticated
router.get('/my-reports', auth, getMyReports);
router.get('/:id', auth, getReport);
router.post('/', auth, uploadLimiter, upload.array('photos', 5), submitParkingViolation);

export default router;
