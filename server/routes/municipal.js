import express from 'express';
import auth from '../middleware/auth.js';
import {
  getDepartmentsNearby,
  getDepartments,
  lookupDepartment,
  getMyMunicipalReports,
  getReportStatus,
  workerGetQueue,
  workerUpdateReport,
  workerGetStats
} from '../controllers/municipalController.js';

const router = express.Router();

// ─── Public ────────────────────────────────────────────────────────────────
// Browse all connected municipalities
router.get('/departments', getDepartments);

// Find departments near a location
router.get('/nearby', getDepartmentsNearby);

// Preview which dept an incident would be routed to
router.get('/lookup', lookupDepartment);

// ─── Authenticated ────────────────────────────────────────────────────────
// User views their own municipal reports
router.get('/my-reports', auth, getMyMunicipalReports);

// View a specific report
router.get('/reports/:id', auth, getReportStatus);

// ─── Municipal Worker Portal ──────────────────────────────────────────────
router.get('/worker/queue', auth, workerGetQueue);
router.put('/worker/reports/:id', auth, workerUpdateReport);
router.get('/worker/stats', auth, workerGetStats);

export default router;
