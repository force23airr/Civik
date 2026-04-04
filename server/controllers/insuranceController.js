import InsuranceClaim from '../models/InsuranceClaim.js';
import Incident from '../models/Incident.js';
import ApiKey from '../models/ApiKey.js';
import User from '../models/User.js';
import { generateInsuranceClaimPDF } from '../services/pdf/pdfGenerator.js';
import { sendClaimNotification } from '../services/email/emailService.js';
import crypto from 'crypto';

// ==================== USER ENDPOINTS ====================

// @desc    Create new insurance claim from incident
// @route   POST /api/insurance/claims
// @access  Private
export const createClaim = async (req, res) => {
  try {
    const { incidentId, claimant, lossDetails, thirdParty, evidence } = req.body;

    // Verify incident exists and user owns it
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized - you can only create claims for your own incidents' });
    }

    // Create claim
    const claim = await InsuranceClaim.create({
      incident: incidentId,
      user: req.user._id,
      claimant: claimant || {},
      lossDetails: {
        dateOfLoss: lossDetails?.dateOfLoss || incident.createdAt,
        locationOfLoss: lossDetails?.locationOfLoss || incident.location,
        descriptionOfLoss: lossDetails?.descriptionOfLoss || incident.description,
        ...lossDetails
      },
      thirdParty: thirdParty || { involved: false },
      evidence: {
        mediaFiles: incident.mediaFiles?.map(f => ({
          originalFile: f.path,
          type: f.mimetype
        })) || [],
        ...evidence
      }
    });

    // Add initial status history
    claim.statusHistory.push({
      status: 'draft',
      changedBy: req.user._id,
      notes: 'Claim created'
    });
    await claim.save();

    res.status(201).json(claim);
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Submit a witness report for an incident
// @route   POST /api/insurance/witness-report
// @access  Private
export const submitWitnessReport = async (req, res) => {
  try {
    const { incidentId, description } = req.body;

    if (!incidentId) {
      return res.status(400).json({ message: 'Incident ID is required' });
    }

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check if user already submitted a witness report
    const existingWitness = incident.witnesses?.find(
      w => w.user?.toString() === req.user._id.toString()
    );

    if (existingWitness) {
      return res.status(400).json({ message: 'You have already submitted a witness report for this incident' });
    }

    // Add witness report
    if (!incident.witnesses) {
      incident.witnesses = [];
    }

    incident.witnesses.push({
      user: req.user._id,
      statement: description || 'Witness report submitted via Civik',
      submittedAt: new Date()
    });

    incident.witnessCount = (incident.witnessCount || 0) + 1;
    await incident.save();

    // Award 15 credits
    const WITNESS_CREDITS = 15;
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { creditsBalance: WITNESS_CREDITS }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('newWitnessReport', {
        incidentId: incident._id,
        witnessCount: incident.witnessCount
      });
    }

    res.status(201).json({
      message: 'Witness report submitted successfully',
      creditsEarned: WITNESS_CREDITS,
      incidentId: incident._id,
      witnessCount: incident.witnessCount
    });
  } catch (error) {
    console.error('Error submitting witness report:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get user's claims
// @route   GET /api/insurance/claims
// @access  Private
export const getUserClaims = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query = { user: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [claims, total] = await Promise.all([
      InsuranceClaim.find(query)
        .populate('incident', 'title type severity createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      InsuranceClaim.countDocuments(query)
    ]);

    res.json({
      claims,
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

// @desc    Get single claim
// @route   GET /api/insurance/claims/:id
// @access  Private
export const getClaimById = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('incident')
      .populate('statusHistory.changedBy', 'username');

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    res.json(claim);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update claim (draft only)
// @route   PUT /api/insurance/claims/:id
// @access  Private
export const updateClaim = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({ message: 'Can only update draft claims' });
    }

    const allowedUpdates = ['claimant', 'lossDetails', 'thirdParty', 'evidence', 'notes'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        claim[field] = req.body[field];
      }
    });

    await claim.save();
    res.json(claim);
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Delete claim (draft only)
// @route   DELETE /api/insurance/claims/:id
// @access  Private
export const deleteClaim = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({ message: 'Can only delete draft claims' });
    }

    await claim.deleteOne();
    res.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Submit claim for processing
// @route   POST /api/insurance/claims/:id/submit
// @access  Private
export const submitClaim = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({ message: 'Claim has already been submitted' });
    }

    // Validate required fields
    if (!claim.claimant?.policyNumber) {
      return res.status(400).json({ message: 'Policy number is required' });
    }

    if (!claim.lossDetails?.dateOfLoss) {
      return res.status(400).json({ message: 'Date of loss is required' });
    }

    // Get consent if provided
    if (req.body.consentToShare) {
      claim.consentToShare = true;
      claim.consentTimestamp = new Date();
    }

    await claim.updateStatus('submitted', req.user._id, 'Claim submitted for processing');

    // Send notification email
    if (claim.claimant?.contactEmail) {
      await sendClaimNotification(claim.claimant.contactEmail, claim, 'submitted');
    }

    res.json({
      message: 'Claim submitted successfully',
      claim
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Download claim as PDF
// @route   GET /api/insurance/claims/:id/pdf
// @access  Private
export const downloadClaimPDF = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('incident');

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    const pdfResult = await generateInsuranceClaimPDF(claim);

    res.download(pdfResult.filepath, pdfResult.filename);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get claim as JSON (ACORD-like format)
// @route   GET /api/insurance/claims/:id/json
// @access  Private
export const getClaimJSON = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('incident', 'title type severity location mediaFiles createdAt');

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    // Generate ACORD-like JSON
    const claimDocument = {
      documentInfo: {
        version: '1.0',
        format: 'Civik-ACORD',
        generatedAt: new Date().toISOString(),
        source: 'Civik Platform'
      },
      claim: {
        claimId: claim.claimId,
        status: claim.status,
        submittedAt: claim.submittedAt,
        createdAt: claim.createdAt
      },
      claimant: claim.claimant,
      lossDetails: claim.lossDetails,
      thirdParty: claim.thirdParty,
      evidence: {
        mediaCount: claim.evidence?.mediaFiles?.length || 0,
        policeReportNumber: claim.evidence?.policeReportNumber,
        witnessCount: claim.evidence?.witnesses?.length || 0
      },
      linkedIncident: claim.incident ? {
        id: claim.incident._id,
        title: claim.incident.title,
        type: claim.incident.type,
        severity: claim.incident.severity,
        date: claim.incident.createdAt
      } : null,
      verification: {
        signatureHash: crypto.createHash('sha256')
          .update(JSON.stringify({ claimId: claim.claimId, createdAt: claim.createdAt }))
          .digest('hex'),
        timestamp: new Date().toISOString()
      }
    };

    res.json(claimDocument);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// ==================== INSURANCE API ENDPOINTS ====================

// @desc    Get claims (API Key access)
// @route   GET /api/v1/insurance/claims
// @access  API Key
export const apiGetClaims = async (req, res) => {
  try {
    const { status, startDate, endDate, limit = 20, page = 1 } = req.query;

    const query = {
      consentToShare: true,
      status: { $in: ['submitted', 'pending_review', 'approved', 'rejected', 'closed'] }
    };

    if (status) query.status = status;

    if (startDate || endDate) {
      query.submittedAt = {};
      if (startDate) query.submittedAt.$gte = new Date(startDate);
      if (endDate) query.submittedAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [claims, total] = await Promise.all([
      InsuranceClaim.find(query)
        .select('-apiAccess -statusHistory')
        .populate('incident', 'title type severity location')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      InsuranceClaim.countDocuments(query)
    ]);

    // Log API access
    for (const claim of claims) {
      claim.logApiAccess(req.apiKey._id, 'list', req.ip).catch(console.error);
    }

    res.json({
      claims,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Get single claim (API Key access)
// @route   GET /api/v1/insurance/claims/:claimId
// @access  API Key
export const apiGetClaimById = async (req, res) => {
  try {
    const claim = await InsuranceClaim.findOne({
      claimId: req.params.claimId,
      consentToShare: true
    }).populate('incident', 'title type severity location mediaFiles createdAt');

    if (!claim) {
      return res.status(404).json({ error: 'Not Found', message: 'Claim not found or not shared' });
    }

    // Log access
    await claim.logApiAccess(req.apiKey._id, 'view', req.ip);

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Update claim status (API Key access)
// @route   POST /api/v1/insurance/claims/:claimId/status
// @access  API Key (writeClaims permission)
export const apiUpdateClaimStatus = async (req, res) => {
  try {
    const { status, notes, approvedAmount, rejectionReason } = req.body;

    const allowedStatuses = ['pending_review', 'under_investigation', 'approved', 'rejected', 'closed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    const claim = await InsuranceClaim.findOne({
      claimId: req.params.claimId,
      consentToShare: true
    });

    if (!claim) {
      return res.status(404).json({ error: 'Not Found', message: 'Claim not found' });
    }

    claim.status = status;
    if (approvedAmount !== undefined) claim.approvedAmount = approvedAmount;
    if (rejectionReason) claim.rejectionReason = rejectionReason;

    claim.statusHistory.push({
      status,
      changedAt: new Date(),
      notes: notes || `Status updated via API by ${req.apiKey.name}`
    });

    if (status === 'approved' || status === 'rejected') {
      claim.processedAt = new Date();
    }

    await claim.save();

    // Log access
    await claim.logApiAccess(req.apiKey._id, 'update_status', req.ip);

    res.json({
      message: 'Status updated successfully',
      claimId: claim.claimId,
      status: claim.status
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// @desc    Verify claim authenticity
// @route   POST /api/v1/insurance/verify
// @access  API Key
export const apiVerifyClaim = async (req, res) => {
  try {
    const { claimId, signatureHash } = req.body;

    if (!claimId) {
      return res.status(400).json({ error: 'Bad Request', message: 'claimId is required' });
    }

    const claim = await InsuranceClaim.findOne({ claimId });

    if (!claim) {
      return res.json({
        verified: false,
        message: 'Claim not found'
      });
    }

    // Generate expected hash
    const expectedHash = crypto.createHash('sha256')
      .update(JSON.stringify({ claimId: claim.claimId, createdAt: claim.createdAt }))
      .digest('hex');

    const isValid = signatureHash ? signatureHash === expectedHash : true;

    res.json({
      verified: true,
      claimExists: true,
      signatureValid: signatureHash ? isValid : 'not_checked',
      claim: {
        claimId: claim.claimId,
        status: claim.status,
        createdAt: claim.createdAt,
        submittedAt: claim.submittedAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// @desc    Create API key
// @route   POST /api/admin/api-keys
// @access  Admin
export const createApiKey = async (req, res) => {
  try {
    const { name, description, permissions, rateLimit, allowedIPs, organization } = req.body;

    const { key, secret, secretHash } = ApiKey.generateKeyPair();

    const apiKey = await ApiKey.create({
      name,
      description,
      key,
      secretHash,
      permissions: permissions || {},
      rateLimit: rateLimit || {},
      allowedIPs: allowedIPs || [],
      organization: organization || {}
    });

    // Return secret only once - it's not stored
    res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        key: apiKey.key,
        secret: secret, // Only returned once!
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt
      },
      warning: 'Save the secret now - it cannot be retrieved later!'
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Get all API keys
// @route   GET /api/admin/api-keys
// @access  Admin
export const getApiKeys = async (req, res) => {
  try {
    const apiKeys = await ApiKey.find()
      .select('-secretHash')
      .sort({ createdAt: -1 });

    res.json(apiKeys);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update API key
// @route   PUT /api/admin/api-keys/:id
// @access  Admin
export const updateApiKey = async (req, res) => {
  try {
    const allowedUpdates = ['name', 'description', 'permissions', 'rateLimit', 'allowedIPs', 'isActive', 'organization'];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const apiKey = await ApiKey.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-secretHash');

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json(apiKey);
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Delete (revoke) API key
// @route   DELETE /api/admin/api-keys/:id
// @access  Admin
export const deleteApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

export default {
  createClaim,
  submitWitnessReport,
  getUserClaims,
  getClaimById,
  updateClaim,
  deleteClaim,
  submitClaim,
  downloadClaimPDF,
  getClaimJSON,
  apiGetClaims,
  apiGetClaimById,
  apiUpdateClaimStatus,
  apiVerifyClaim,
  createApiKey,
  getApiKeys,
  updateApiKey,
  deleteApiKey
};
