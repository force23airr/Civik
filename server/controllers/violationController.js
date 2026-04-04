import ViolationReport from '../models/ViolationReport.js';
import PoliceStation from '../models/PoliceStation.js';
import { processEvidenceFile, generatePackage, verifyAllEvidence } from '../services/evidence/evidencePackager.js';
import { submitToPolice, checkSubmissionStatus, getRecommendedStation } from '../services/enforcement/lawEnforcementService.js';
import { reportViolation, createWitnessReport, getCommonInsurers } from '../services/insurance/insuranceViolationService.js';
import { getApplicableStatutes, getStateTrafficCodes, violationTypes, severityLevels, usStates } from '../config/trafficCodes.js';
import path from 'path';
import fs from 'fs';

// @desc    Create a new violation report
// @route   POST /api/violations
// @access  Private
export const createViolationReport = async (req, res) => {
  try {
    const {
      violationType,
      severity,
      offendingVehicle,
      location,
      incidentDateTime,
      description,
      reporterVehicle,
      consent
    } = req.body;

    // Parse nested objects if sent as strings (from FormData)
    const parsedOffendingVehicle = typeof offendingVehicle === 'string'
      ? JSON.parse(offendingVehicle)
      : offendingVehicle;
    const parsedLocation = typeof location === 'string'
      ? JSON.parse(location)
      : location;
    const parsedConsent = typeof consent === 'string'
      ? JSON.parse(consent)
      : consent;
    const parsedReporterVehicle = typeof reporterVehicle === 'string'
      ? JSON.parse(reporterVehicle)
      : reporterVehicle;

    // Get applicable statutes based on violation type and state
    const statutes = getApplicableStatutes(violationType, parsedLocation?.state || parsedOffendingVehicle?.plateState);

    // Create the violation report
    const violationReport = new ViolationReport({
      reporter: req.user._id,
      violationType,
      severity,
      offendingVehicle: parsedOffendingVehicle,
      location: parsedLocation,
      incidentDateTime: new Date(incidentDateTime),
      description,
      reporterVehicle: parsedReporterVehicle,
      applicableStatutes: statutes,
      consent: {
        ...parsedConsent,
        tosAcceptedAt: new Date()
      },
      status: 'submitted'
    });

    // Add initial custody entry
    violationReport.addCustodyEntry(
      'created',
      req.user._id,
      'Violation report created',
      req.ip,
      req.headers['user-agent']
    );

    // Process uploaded evidence files
    if (req.files && req.files.length > 0) {
      await violationReport.save(); // Save first to get reportNumber

      for (const file of req.files) {
        const evidence = await processEvidenceFile(file, violationReport.reportNumber);
        violationReport.evidence.push(evidence);
      }

      violationReport.addCustodyEntry(
        'evidence_added',
        req.user._id,
        `${req.files.length} evidence file(s) uploaded and processed`,
        req.ip,
        req.headers['user-agent']
      );
    }

    await violationReport.save();

    res.status(201).json({
      success: true,
      violationReport,
      message: 'Violation report created successfully'
    });
  } catch (error) {
    console.error('Error creating violation report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get all violation reports (with filters)
// @route   GET /api/violations
// @access  Public
export const getViolationReports = async (req, res) => {
  try {
    const {
      violationType,
      severity,
      status,
      plateState,
      licensePlate,
      startDate,
      endDate,
      limit = 20,
      page = 1,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    if (violationType) query.violationType = violationType;
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (plateState) query['offendingVehicle.plateState'] = plateState;
    if (licensePlate) {
      const escapedPlate = licensePlate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query['offendingVehicle.licensePlate'] = new RegExp(escapedPlate, 'i');
    }

    if (startDate || endDate) {
      query.incidentDateTime = {};
      if (startDate) {
        const parsedStart = new Date(startDate);
        if (isNaN(parsedStart.getTime())) return res.status(400).json({ message: 'Invalid start date' });
        query.incidentDateTime.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (isNaN(parsedEnd.getTime())) return res.status(400).json({ message: 'Invalid end date' });
        query.incidentDateTime.$lte = parsedEnd;
      }
    }

    const total = await ViolationReport.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    // Validate and sanitize sort parameter to prevent NoSQL injection
    const allowedSortFields = ['createdAt', 'incidentDateTime', 'severity', 'violationType', 'status'];
    let sanitizedSort = '-createdAt';
    if (typeof sort === 'string') {
      const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
      if (allowedSortFields.includes(sortField)) {
        sanitizedSort = sort;
      }
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const violations = await ViolationReport.find(query)
      .populate('reporter', 'username avatar')
      .select('-chainOfCustody')
      .sort(sanitizedSort)
      .limit(safeLimit)
      .skip((safePage - 1) * safeLimit);

    res.json({
      violations,
      pagination: {
        current: parseInt(page),
        pages,
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching violation reports:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get current user's violation reports
// @route   GET /api/violations/my-reports
// @access  Private
export const getMyViolationReports = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query = { reporter: req.user._id };
    if (status) query.status = status;

    const total = await ViolationReport.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    const violations = await ViolationReport.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Calculate stats
    const stats = {
      total: await ViolationReport.countDocuments({ reporter: req.user._id }),
      submitted: await ViolationReport.countDocuments({ reporter: req.user._id, status: 'submitted' }),
      verified: await ViolationReport.countDocuments({ reporter: req.user._id, status: 'verified' }),
      submittedToAuthorities: await ViolationReport.countDocuments({ reporter: req.user._id, status: 'submitted_to_authorities' }),
      citationsIssued: await ViolationReport.countDocuments({
        reporter: req.user._id,
        'lawEnforcementSubmissions.status': 'citation_issued'
      })
    };

    res.json({
      violations,
      stats,
      pagination: {
        current: parseInt(page),
        pages,
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user violation reports:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get violation report by ID
// @route   GET /api/violations/:id
// @access  Public
export const getViolationReportById = async (req, res) => {
  try {
    const violation = await ViolationReport.findById(req.params.id)
      .populate('reporter', 'username avatar')
      .populate('chainOfCustody.performedBy', 'username')
      .populate('verification.moderatorReview.reviewedBy', 'username')
      .populate('lawEnforcementSubmissions.policeStation', 'name email');

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Log access in chain of custody (only for authenticated users)
    if (req.user) {
      violation.addCustodyEntry(
        'accessed',
        req.user._id,
        'Report accessed',
        req.ip,
        req.headers['user-agent']
      );
      await violation.save();
    }

    // Hide chain of custody from non-privileged users (contains IPs and user agents)
    const violationObj = violation.toObject();
    if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
      delete violationObj.chainOfCustody;
    }

    res.json(violationObj);
  } catch (error) {
    console.error('Error fetching violation report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update violation report
// @route   PUT /api/violations/:id
// @access  Private (owner only)
export const updateViolationReport = async (req, res) => {
  try {
    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Check ownership
    if (violation.reporter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this report' });
    }

    // Only allow updates on draft or submitted reports
    if (!['draft', 'submitted'].includes(violation.status)) {
      return res.status(400).json({ message: 'Cannot update report in current status' });
    }

    const allowedUpdates = [
      'violationType', 'severity', 'offendingVehicle', 'location',
      'incidentDateTime', 'description', 'reporterVehicle'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        violation[field] = req.body[field];
      }
    });

    // Update statutes if violation type or location changed
    if (req.body.violationType || req.body.location || req.body.offendingVehicle) {
      const state = violation.location?.state || violation.offendingVehicle?.plateState;
      violation.applicableStatutes = getApplicableStatutes(violation.violationType, state);
    }

    violation.addCustodyEntry(
      'status_changed',
      req.user._id,
      'Report updated',
      req.ip,
      req.headers['user-agent']
    );

    await violation.save();

    res.json({
      success: true,
      violation,
      message: 'Violation report updated successfully'
    });
  } catch (error) {
    console.error('Error updating violation report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Delete violation report
// @route   DELETE /api/violations/:id
// @access  Private (owner only)
export const deleteViolationReport = async (req, res) => {
  try {
    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Check ownership (or admin)
    if (violation.reporter.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this report' });
    }

    // Don't allow deletion if submitted to authorities
    if (violation.status === 'submitted_to_authorities') {
      return res.status(400).json({ message: 'Cannot delete report that has been submitted to authorities' });
    }

    await violation.deleteOne();

    res.json({ success: true, message: 'Violation report deleted' });
  } catch (error) {
    console.error('Error deleting violation report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Add evidence to violation report
// @route   POST /api/violations/:id/evidence
// @access  Private (owner only)
export const addEvidence = async (req, res) => {
  try {
    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    if (violation.reporter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add evidence to this report' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    for (const file of req.files) {
      const evidence = await processEvidenceFile(file, violation.reportNumber);
      violation.evidence.push(evidence);
    }

    violation.addCustodyEntry(
      'evidence_added',
      req.user._id,
      `${req.files.length} additional evidence file(s) uploaded`,
      req.ip,
      req.headers['user-agent']
    );

    await violation.save();

    res.json({
      success: true,
      evidence: violation.evidence,
      message: `${req.files.length} file(s) added successfully`
    });
  } catch (error) {
    console.error('Error adding evidence:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Download evidence package
// @route   GET /api/violations/:id/evidence-package
// @access  Private
export const downloadEvidencePackage = async (req, res) => {
  try {
    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Authorization: only the reporter or admin/moderator can download evidence
    if (violation.reporter.toString() !== req.user._id.toString()
        && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to download this evidence package' });
    }

    const { zipPath, manifestPath, packageHash } = await generatePackage(violation, {
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.download(zipPath, `evidence_package_${violation.reportNumber}.zip`);
  } catch (error) {
    console.error('Error generating evidence package:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Vote on violation report (enhanced multi-select voting)
// @route   POST /api/violations/:id/vote
// @access  Private
export const voteOnReport = async (req, res) => {
  try {
    const { voteTypes } = req.body; // Array of vote types

    const validVoteTypes = ['confirmViolation', 'notViolation', 'veryDangerous', 'sendToPolice', 'needContext'];

    if (!Array.isArray(voteTypes) || voteTypes.length === 0) {
      return res.status(400).json({ message: 'voteTypes must be a non-empty array' });
    }

    // Validate all vote types
    for (const voteType of voteTypes) {
      if (!validVoteTypes.includes(voteType)) {
        return res.status(400).json({ message: `Invalid vote type: ${voteType}` });
      }
    }

    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Prevent owner from voting on their own report
    if (violation.reporter.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot vote on your own report' });
    }

    // Check if user already voted
    const existingVoter = violation.verification.communityVotes.voters.find(
      v => v.user.toString() === req.user._id.toString()
    );

    if (existingVoter) {
      // Decrement old vote counts
      if (existingVoter.voteTypes && existingVoter.voteTypes.length > 0) {
        for (const oldType of existingVoter.voteTypes) {
          if (violation.verification.communityVotes.voteTypes[oldType] > 0) {
            violation.verification.communityVotes.voteTypes[oldType]--;
          }
        }
      }
      // Legacy: also decrement old vote if exists
      if (existingVoter.vote === 'confirm' && violation.verification.communityVotes.confirms > 0) {
        violation.verification.communityVotes.confirms--;
      } else if (existingVoter.vote === 'dispute' && violation.verification.communityVotes.disputes > 0) {
        violation.verification.communityVotes.disputes--;
      }

      // Update vote types
      existingVoter.voteTypes = voteTypes;
      existingVoter.timestamp = new Date();

      // Legacy: set primary vote for backward compatibility
      if (voteTypes.includes('confirmViolation')) {
        existingVoter.vote = 'confirm';
      } else if (voteTypes.includes('notViolation')) {
        existingVoter.vote = 'dispute';
      }
    } else {
      // Add new vote
      violation.verification.communityVotes.voters.push({
        user: req.user._id,
        vote: voteTypes.includes('confirmViolation') ? 'confirm' : 'dispute', // Legacy
        voteTypes,
        timestamp: new Date()
      });
    }

    // Increment new vote counts
    for (const voteType of voteTypes) {
      violation.verification.communityVotes.voteTypes[voteType] =
        (violation.verification.communityVotes.voteTypes[voteType] || 0) + 1;
    }

    // Sync legacy counts for backward compatibility
    violation.verification.communityVotes.confirms =
      violation.verification.communityVotes.voteTypes.confirmViolation || 0;
    violation.verification.communityVotes.disputes =
      violation.verification.communityVotes.voteTypes.notViolation || 0;

    // Auto-verify if enough confirms
    const { confirms, disputes } = violation.verification.communityVotes;
    if (confirms >= 5 && confirms > disputes * 2) {
      violation.verification.status = 'verified';
      if (violation.status === 'submitted') {
        violation.status = 'verified';
      }
    } else if (disputes >= 5 && disputes > confirms * 2) {
      violation.verification.status = 'disputed';
    }

    await violation.save();

    res.json({
      success: true,
      communityVotes: violation.verification.communityVotes,
      verificationStatus: violation.verification.status
    });
  } catch (error) {
    console.error('Error voting on report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Submit recklessness rating (1-10 scale)
// @route   POST /api/violations/:id/rating
// @access  Private
export const submitRating = async (req, res) => {
  try {
    const { rating } = req.body;

    // Validate rating
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
      return res.status(400).json({ message: 'Rating must be between 1 and 10' });
    }

    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    // Prevent owner from rating their own report
    if (violation.reporter.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot rate your own report' });
    }

    // Check if user already rated
    const existingRating = violation.recklessnessRating.ratings.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingRating) {
      // Update existing rating
      existingRating.rating = ratingNum;
      existingRating.timestamp = new Date();
    } else {
      // Add new rating
      violation.recklessnessRating.ratings.push({
        user: req.user._id,
        rating: ratingNum,
        timestamp: new Date()
      });
      violation.recklessnessRating.count++;
    }

    // Recalculate average
    const totalRating = violation.recklessnessRating.ratings.reduce((sum, r) => sum + r.rating, 0);
    violation.recklessnessRating.average = Math.round((totalRating / violation.recklessnessRating.ratings.length) * 10) / 10;

    await violation.save();

    res.json({
      success: true,
      recklessnessRating: {
        average: violation.recklessnessRating.average,
        count: violation.recklessnessRating.count,
        userRating: ratingNum
      }
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Submit violation report to police
// @route   POST /api/violations/:id/submit-to-police
// @access  Private (owner only)
export const submitToPoliceEndpoint = async (req, res) => {
  try {
    const { policeStationId, method } = req.body;

    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    if (violation.reporter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to submit this report' });
    }

    // Get police station
    let policeStation;
    if (policeStationId) {
      policeStation = await PoliceStation.findById(policeStationId);
    } else {
      policeStation = await getRecommendedStation(violation);
    }

    if (!policeStation) {
      return res.status(404).json({ message: 'No suitable police station found' });
    }

    const submission = await submitToPolice(violation, policeStation, {
      method: method || 'email',
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      submission,
      message: `Report submitted to ${policeStation.name}`
    });
  } catch (error) {
    console.error('Error submitting to police:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get police submission status
// @route   GET /api/violations/:id/police-status
// @access  Private
export const getPoliceSubmissionStatus = async (req, res) => {
  try {
    const violation = await ViolationReport.findById(req.params.id)
      .populate('lawEnforcementSubmissions.policeStation', 'name email');

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    res.json({
      submissions: violation.lawEnforcementSubmissions
    });
  } catch (error) {
    console.error('Error getting police status:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Submit violation report to insurance
// @route   POST /api/violations/:id/submit-to-insurance
// @access  Private (owner only)
export const submitToInsurance = async (req, res) => {
  try {
    const { database, insurerName, insurerEmail } = req.body;

    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    if (violation.reporter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to submit this report' });
    }

    const submission = await reportViolation(violation, {
      database: database || 'direct_insurer',
      insurerName,
      insurerEmail,
      userId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      submission,
      message: `Report submitted to ${insurerName || database}`
    });
  } catch (error) {
    console.error('Error submitting to insurance:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create witness report (completes InsuranceClaim.jsx backend)
// @route   POST /api/violations/witness-report
// @access  Private
export const createWitnessReportEndpoint = async (req, res) => {
  try {
    const violationReport = await createWitnessReport(
      {
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      req.user
    );

    res.status(201).json({
      success: true,
      violationReport,
      message: 'Witness report created successfully'
    });
  } catch (error) {
    console.error('Error creating witness report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get moderation queue
// @route   GET /api/violations/moderation/queue
// @access  Private (moderator/admin)
export const getModerationQueue = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    const query = {
      $or: [
        { 'verification.status': 'pending' },
        { 'verification.status': 'disputed' }
      ],
      status: { $in: ['submitted', 'under_review'] }
    };

    const total = await ViolationReport.countDocuments(query);
    const pages = Math.ceil(total / parseInt(limit));

    const violations = await ViolationReport.find(query)
      .populate('reporter', 'username avatar')
      .sort({ createdAt: 1 }) // Oldest first
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({
      violations,
      pagination: {
        current: parseInt(page),
        pages,
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching moderation queue:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Review violation report (moderator action)
// @route   POST /api/violations/:id/review
// @access  Private (moderator/admin)
export const reviewReport = async (req, res) => {
  try {
    const { decision, notes } = req.body; // 'approved', 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision' });
    }

    const violation = await ViolationReport.findById(req.params.id);

    if (!violation) {
      return res.status(404).json({ message: 'Violation report not found' });
    }

    violation.verification.moderatorReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      decision,
      notes
    };

    if (decision === 'approved') {
      violation.verification.status = 'verified';
      violation.status = 'verified';
    } else {
      violation.verification.status = 'rejected';
      violation.status = 'closed';
    }

    violation.addCustodyEntry(
      'reviewed',
      req.user._id,
      `Moderator review: ${decision}${notes ? ` - ${notes}` : ''}`,
      req.ip,
      req.headers['user-agent']
    );

    await violation.save();

    res.json({
      success: true,
      violation,
      message: `Report ${decision}`
    });
  } catch (error) {
    console.error('Error reviewing report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get traffic codes for a state
// @route   GET /api/violations/codes/:state
// @access  Public
export const getTrafficCodes = async (req, res) => {
  try {
    const { state } = req.params;
    const codes = getStateTrafficCodes(state.toUpperCase());

    res.json({
      state: state.toUpperCase(),
      codes,
      available: Object.keys(codes).length > 0
    });
  } catch (error) {
    console.error('Error fetching traffic codes:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get specific traffic code
// @route   GET /api/violations/codes/:state/:violationType
// @access  Public
export const getSpecificCode = async (req, res) => {
  try {
    const { state, violationType } = req.params;
    const statutes = getApplicableStatutes(violationType, state.toUpperCase());

    res.json({
      state: state.toUpperCase(),
      violationType,
      statutes
    });
  } catch (error) {
    console.error('Error fetching specific code:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get violation type options
// @route   GET /api/violations/options/types
// @access  Public
export const getViolationTypes = async (req, res) => {
  res.json({ violationTypes });
};

// @desc    Get severity level options
// @route   GET /api/violations/options/severities
// @access  Public
export const getSeverityLevels = async (req, res) => {
  res.json({ severityLevels });
};

// @desc    Get US states list
// @route   GET /api/violations/options/states
// @access  Public
export const getStates = async (req, res) => {
  res.json({ states: usStates });
};

// @desc    Get insurers list
// @route   GET /api/violations/options/insurers
// @access  Public
export const getInsurers = async (req, res) => {
  const { state } = req.query;
  const insurers = getCommonInsurers(state);
  res.json({ insurers });
};

export default {
  createViolationReport,
  getViolationReports,
  getMyViolationReports,
  getViolationReportById,
  updateViolationReport,
  deleteViolationReport,
  addEvidence,
  downloadEvidencePackage,
  voteOnReport,
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
};
