import express from 'express';
import {
  createViolationReport,
  getViolationReports,
  getMyViolationReports,
  getViolationReportById,
  updateViolationReport,
  deleteViolationReport,
  addEvidence,
  downloadEvidencePackage,
  voteOnReport,
  submitRating,
  submitToPoliceEndpoint,
  getPoliceSubmissionStatus,
  submitToInsurance,
  createWitnessReportEndpoint,
  getModerationQueue,
  reviewReport,
  getTrafficCodes,
  getSpecificCode,
  getViolationTypes,
  getSeverityLevels,
  getStates,
  getInsurers
} from '../controllers/violationController.js';
import {
  getComments,
  createComment,
  toggleCommentLike,
  deleteComment,
  flagComment
} from '../controllers/commentController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { moderator } from '../middleware/admin.js';
import upload from '../middleware/upload.js';
import { uploadLimiter, generalLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Static options routes (must be before dynamic :id routes)
router.get('/options/types', getViolationTypes);
router.get('/options/severities', getSeverityLevels);
router.get('/options/states', getStates);
router.get('/options/insurers', getInsurers);

// Traffic codes lookup
router.get('/codes/:state', getTrafficCodes);
router.get('/codes/:state/:violationType', getSpecificCode);

// Moderation routes (must be before :id routes)
router.get('/moderation/queue', moderator, getModerationQueue);

// Witness report endpoint (completes InsuranceClaim.jsx backend)
router.post('/witness-report', auth, createWitnessReportEndpoint);

// My reports (authenticated user's reports)
router.get('/my-reports', auth, getMyViolationReports);

// Core CRUD operations
router.post('/', auth, uploadLimiter, upload.array('evidence', 5), createViolationReport);
router.get('/', optionalAuth, getViolationReports);
router.get('/:id', optionalAuth, getViolationReportById);
router.put('/:id', auth, updateViolationReport);
router.delete('/:id', auth, deleteViolationReport);

// Evidence management
router.post('/:id/evidence', auth, uploadLimiter, upload.array('files', 5), addEvidence);
router.get('/:id/evidence-package', auth, downloadEvidencePackage);

// Verification & voting
router.post('/:id/vote', auth, voteOnReport);
router.post('/:id/rating', auth, submitRating);

// Comments
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', auth, createComment);
router.post('/comments/:commentId/like', auth, toggleCommentLike);
router.delete('/comments/:commentId', auth, deleteComment);
router.post('/comments/:commentId/flag', auth, flagComment);

// Moderator review
router.post('/:id/review', moderator, reviewReport);

// Law enforcement submission
router.post('/:id/submit-to-police', auth, submitToPoliceEndpoint);
router.get('/:id/police-status', auth, getPoliceSubmissionStatus);

// Insurance submission
router.post('/:id/submit-to-insurance', auth, submitToInsurance);

export default router;
