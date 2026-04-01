import express from 'express';
import {
  getCaseQueue,
  getCaseDetails,
  streamVideo,
  updateCaseStatus,
  getDepartmentStats,
  exportEvidence
} from '../controllers/policePortalController.js';
import {
  getParkingQueue,
  getParkingCaseDetail,
  reviewParkingViolation
} from '../controllers/parkingPortalController.js';
import { requirePoliceOfficer, requirePortalAdmin } from '../middleware/policeAuth.js';

const router = express.Router();

// All routes require police officer authentication
router.use(requirePoliceOfficer);

// Case management
router.get('/cases', getCaseQueue);
router.get('/cases/:caseId', getCaseDetails);
router.put('/cases/:caseId/status', updateCaseStatus);

// Evidence
router.get('/cases/:caseId/evidence/:evidenceId/stream', streamVideo);
router.get('/cases/:caseId/evidence/export', exportEvidence);

// Department stats
router.get('/stats', getDepartmentStats);

// Parking violation management
router.get('/parking', getParkingQueue);
router.get('/parking/:id', getParkingCaseDetail);
router.put('/parking/:id/review', reviewParkingViolation);

// Portal admin routes (e.g., manage officers)
// router.post('/officers', requirePortalAdmin, addOfficer);
// router.delete('/officers/:officerId', requirePortalAdmin, removeOfficer);

export default router;
