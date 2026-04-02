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
  workerGetStats,
  getJurisdictions
} from '../controllers/municipalController.js';

const router = express.Router();

// ─── Public ────────────────────────────────────────────────────────────────
// Browse all connected municipalities
router.get('/departments', getDepartments);

// Find departments near a location
router.get('/nearby', getDepartmentsNearby);

// Get counties and cities for a state (for manual location picker)
router.get('/jurisdictions', getJurisdictions);

// Preview which dept an incident would be routed to
router.get('/lookup', lookupDepartment);

// ─── Authenticated ────────────────────────────────────────────────────────
// User views their own municipal reports
router.get('/my-reports', auth, getMyMunicipalReports);

// View a specific report
router.get('/reports/:id', auth, getReportStatus);

// ─── Municipal Worker Portal ──────────────────────────────────────────────
const requireMunicipalWorker = (req, res, next) => {
  if (!['municipal_worker', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Municipal worker access required' });
  }
  next();
};
router.get('/worker/queue', auth, requireMunicipalWorker, workerGetQueue);
router.put('/worker/reports/:id', auth, requireMunicipalWorker, workerUpdateReport);
router.get('/worker/stats', auth, requireMunicipalWorker, workerGetStats);

export default router;
