import DataConsent from '../models/DataConsent.js';
import Dataset from '../models/Dataset.js';
import Incident from '../models/Incident.js';
import { v4 as uuidv4 } from 'uuid';

// ==================== USER CONSENT ENDPOINTS ====================

// @desc    Get user's consent status
// @route   GET /api/marketplace/consent
// @access  Private
export const getConsent = async (req, res) => {
  try {
    let consent = await DataConsent.findOne({ user: req.user._id });

    if (!consent) {
      // Return default state if no consent record exists
      return res.json({
        isOptedIn: false,
        preferences: {
          allowVideoUsage: true,
          allowImageUsage: true,
          anonymizeFaces: true,
          anonymizePlates: true,
          removeAudio: true,
          allowLocationData: false,
          allowTimeData: true
        },
        statistics: {
          filesContributed: 0,
          datasetsIncludedIn: 0
        }
      });
    }

    res.json({
      isOptedIn: consent.consent.isOptedIn,
      optedInAt: consent.consent.optedInAt,
      preferences: consent.preferences,
      incidentFilters: consent.incidentFilters,
      compensation: {
        type: consent.compensation.type,
        creditsEarned: consent.compensation.creditsEarned,
        creditsPending: consent.compensation.creditsPending
      },
      statistics: consent.statistics
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Opt in to marketplace
// @route   POST /api/marketplace/consent
// @access  Private
export const optIn = async (req, res) => {
  try {
    const { preferences, incidentFilters, compensation } = req.body;

    let consent = await DataConsent.findOne({ user: req.user._id });

    if (consent) {
      // Update existing consent
      consent.consent.isOptedIn = true;
      consent.consent.optedInAt = new Date();
      consent.consent.optedOutAt = undefined;
      consent.consent.ipAddress = req.ip;
      consent.consent.userAgent = req.get('User-Agent');

      if (preferences) consent.preferences = { ...consent.preferences, ...preferences };
      if (incidentFilters) consent.incidentFilters = incidentFilters;
      if (compensation?.type) consent.compensation.type = compensation.type;

      await consent.save();
    } else {
      // Create new consent
      consent = await DataConsent.create({
        user: req.user._id,
        consent: {
          isOptedIn: true,
          optedInAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        },
        preferences: preferences || {},
        incidentFilters: incidentFilters || {},
        compensation: {
          type: compensation?.type || 'credits'
        }
      });
    }

    res.status(201).json({
      message: 'Successfully opted in to the data marketplace',
      consent: {
        isOptedIn: consent.consent.isOptedIn,
        optedInAt: consent.consent.optedInAt,
        preferences: consent.preferences
      }
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Update consent preferences
// @route   PUT /api/marketplace/consent
// @access  Private
export const updateConsent = async (req, res) => {
  try {
    const { preferences, incidentFilters, compensation, notifications } = req.body;

    const consent = await DataConsent.findOne({ user: req.user._id });

    if (!consent) {
      return res.status(404).json({ message: 'No consent record found. Please opt in first.' });
    }

    if (preferences) {
      consent.preferences = { ...consent.preferences, ...preferences };
    }

    if (incidentFilters) {
      consent.incidentFilters = { ...consent.incidentFilters, ...incidentFilters };
    }

    if (compensation?.type) {
      consent.compensation.type = compensation.type;
    }

    if (notifications) {
      consent.notifications = { ...consent.notifications, ...notifications };
    }

    await consent.save();

    res.json({
      message: 'Consent preferences updated',
      consent: {
        preferences: consent.preferences,
        incidentFilters: consent.incidentFilters,
        notifications: consent.notifications
      }
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Opt out of marketplace
// @route   DELETE /api/marketplace/consent
// @access  Private
export const optOut = async (req, res) => {
  try {
    const consent = await DataConsent.findOne({ user: req.user._id });

    if (!consent) {
      return res.status(404).json({ message: 'No consent record found' });
    }

    await consent.optOut();

    res.json({
      message: 'Successfully opted out of the data marketplace',
      note: 'Your data will not be included in future datasets. Existing datasets are not affected.'
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get user's contribution history
// @route   GET /api/marketplace/my-contributions
// @access  Private
export const getContributions = async (req, res) => {
  try {
    const consent = await DataConsent.findOne({ user: req.user._id });

    if (!consent || !consent.consent.isOptedIn) {
      return res.json({
        isOptedIn: false,
        contributions: [],
        statistics: {
          filesContributed: 0,
          datasetsIncludedIn: 0,
          totalDataSizeMB: 0
        }
      });
    }

    // Find datasets that include this user
    const datasets = await Dataset.find({
      'contributors.user': req.user._id
    }).select('datasetId metadata.name metadata.purpose contributors createdAt');

    const contributions = datasets.map(dataset => {
      const contribution = dataset.contributors.find(
        c => c.user.toString() === req.user._id.toString()
      );
      return {
        datasetId: dataset.datasetId,
        datasetName: dataset.metadata.name,
        purpose: dataset.metadata.purpose,
        filesCount: contribution?.filesCount || 0,
        creditsAwarded: contribution?.creditAwarded || 0,
        contributedAt: contribution?.contributedAt || dataset.createdAt
      };
    });

    res.json({
      isOptedIn: consent.consent.isOptedIn,
      contributions,
      statistics: consent.statistics,
      creditsEarned: consent.compensation.creditsEarned,
      creditsPending: consent.compensation.creditsPending
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get user's earnings/credits
// @route   GET /api/marketplace/my-earnings
// @access  Private
export const getEarnings = async (req, res) => {
  try {
    const consent = await DataConsent.findOne({ user: req.user._id });

    if (!consent) {
      return res.json({
        creditsEarned: 0,
        creditsPending: 0,
        creditsRedeemed: 0,
        compensationType: 'none'
      });
    }

    res.json({
      creditsEarned: consent.compensation.creditsEarned,
      creditsPending: consent.compensation.creditsPending,
      creditsRedeemed: consent.compensation.creditsRedeemed,
      compensationType: consent.compensation.type,
      payoutThreshold: consent.compensation.payoutThreshold,
      totalDataContributed: {
        files: consent.statistics.filesContributed,
        sizeMB: consent.statistics.totalDataSizeMB
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Exclude specific incident from marketplace
// @route   POST /api/marketplace/exclude-incident/:incidentId
// @access  Private
export const excludeIncident = async (req, res) => {
  try {
    const incidentId = req.params.incidentId;

    // Verify incident belongs to user
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let consent = await DataConsent.findOne({ user: req.user._id });

    if (!consent) {
      consent = await DataConsent.create({
        user: req.user._id,
        incidentFilters: {
          excludedIncidents: [incidentId]
        }
      });
    } else {
      if (!consent.incidentFilters.excludedIncidents.includes(incidentId)) {
        consent.incidentFilters.excludedIncidents.push(incidentId);
        await consent.save();
      }
    }

    res.json({
      message: 'Incident excluded from data marketplace',
      excludedIncidents: consent.incidentFilters.excludedIncidents
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// ==================== ADMIN/API DATASET ENDPOINTS ====================

// @desc    Get available datasets
// @route   GET /api/marketplace/datasets
// @access  Admin or API Key
export const getDatasets = async (req, res) => {
  try {
    const { status = 'ready', purpose, limit = 20, page = 1 } = req.query;

    const query = {};
    if (status !== 'all') query.status = status;
    if (purpose) query['metadata.purpose'] = purpose;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [datasets, total] = await Promise.all([
      Dataset.find(query)
        .select('datasetId metadata contents.totalFiles contents.totalSizeBytes licensing status createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Dataset.countDocuments(query)
    ]);

    res.json({
      datasets: datasets.map(d => ({
        datasetId: d.datasetId,
        name: d.metadata.name,
        description: d.metadata.description,
        purpose: d.metadata.purpose,
        tags: d.metadata.tags,
        totalFiles: d.contents.totalFiles,
        totalSizeMB: Math.round(d.contents.totalSizeBytes / (1024 * 1024) * 100) / 100,
        licensing: d.licensing.type,
        price: d.licensing.price,
        status: d.status,
        createdAt: d.createdAt
      })),
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

// @desc    Get single dataset
// @route   GET /api/marketplace/datasets/:id
// @access  Admin or API Key
export const getDatasetById = async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ datasetId: req.params.id })
      .populate('createdBy', 'username');

    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Log access if API key
    if (req.apiKey) {
      await dataset.logAccess(req.apiKey.name, req.apiKey._id, 'view', req.ip);
    }

    res.json(dataset);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create new dataset (Admin only)
// @route   POST /api/marketplace/datasets
// @access  Admin
export const createDataset = async (req, res) => {
  try {
    const {
      name,
      description,
      purpose,
      tags,
      category,
      filters,
      anonymization,
      licensing
    } = req.body;

    const dataset = await Dataset.create({
      metadata: {
        name,
        description,
        purpose,
        tags: tags || [],
        category: category || 'incidents'
      },
      anonymization: anonymization || {},
      licensing: licensing || { type: 'research' },
      createdBy: req.user._id,
      status: 'queued'
    });

    res.status(201).json({
      message: 'Dataset created successfully',
      datasetId: dataset.datasetId,
      status: dataset.status,
      generateUrl: `/api/marketplace/datasets/${dataset.datasetId}/generate`
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Trigger dataset generation (Admin only)
// @route   POST /api/marketplace/datasets/:id/generate
// @access  Admin
export const generateDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findOne({ datasetId: req.params.id });

    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    if (dataset.status === 'generating' || dataset.status === 'processing') {
      return res.status(400).json({ message: 'Dataset generation already in progress' });
    }

    const { filters = {} } = req.body;

    // Start generation process
    dataset.status = 'generating';
    dataset.generationProgress = { current: 0, total: 0, stage: 'collecting' };
    await dataset.save();

    // Process asynchronously
    processDatasetGeneration(dataset._id, filters).catch(console.error);

    res.json({
      message: 'Dataset generation started',
      datasetId: dataset.datasetId,
      status: 'generating'
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update dataset (Admin only)
// @route   PUT /api/marketplace/datasets/:id
// @access  Admin
export const updateDataset = async (req, res) => {
  try {
    const allowedUpdates = ['metadata', 'licensing', 'anonymization'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field]) {
        updates[field] = req.body[field];
      }
    });

    const dataset = await Dataset.findOneAndUpdate(
      { datasetId: req.params.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    res.json(dataset);
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Archive dataset (Admin only)
// @route   DELETE /api/marketplace/datasets/:id
// @access  Admin
export const archiveDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findOneAndUpdate(
      { datasetId: req.params.id },
      { status: 'archived' },
      { new: true }
    );

    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    res.json({ message: 'Dataset archived successfully' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// Background dataset generation processor
async function processDatasetGeneration(datasetId, filters = {}) {
  const dataset = await Dataset.findById(datasetId);
  if (!dataset) return;

  try {
    // Get consented users
    const consentedUsers = await DataConsent.find({
      'consent.isOptedIn': true
    }).select('user preferences incidentFilters');

    const userIds = consentedUsers.map(c => c.user);
    const userPreferences = new Map(
      consentedUsers.map(c => [c.user.toString(), c])
    );

    // Build query for incidents
    const query = {
      user: { $in: userIds },
      'mediaFiles.0': { $exists: true }
    };

    if (filters.types?.length > 0) {
      query.type = { $in: filters.types };
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    // Get eligible incidents
    const incidents = await Incident.find(query)
      .populate('user', 'username')
      .lean();

    await dataset.updateProgress(0, incidents.length, 'collecting');

    // Filter out excluded incidents
    const eligibleIncidents = incidents.filter(incident => {
      const consent = userPreferences.get(incident.user._id.toString());
      if (!consent) return false;

      // Check if incident is excluded
      if (consent.incidentFilters?.excludedIncidents?.includes(incident._id.toString())) {
        return false;
      }

      // Check type filter
      if (consent.incidentFilters?.includedTypes?.length > 0) {
        if (!consent.incidentFilters.includedTypes.includes(incident.type)) {
          return false;
        }
      }

      return true;
    });

    await dataset.updateProgress(0, eligibleIncidents.length, 'anonymizing');

    // Process incidents and collect stats
    let totalFiles = 0;
    let totalSize = 0;
    const typeCount = new Map();
    const severityCount = new Map();
    const contributors = new Map();
    const locationCoverage = new Map();

    for (let i = 0; i < eligibleIncidents.length; i++) {
      const incident = eligibleIncidents[i];

      // Count files
      const fileCount = incident.mediaFiles?.length || 0;
      totalFiles += fileCount;

      // Track contributor
      const userId = incident.user._id.toString();
      if (!contributors.has(userId)) {
        contributors.set(userId, { user: incident.user._id, filesCount: 0, creditAwarded: 0 });
      }
      contributors.get(userId).filesCount += fileCount;

      // Track types and severity
      typeCount.set(incident.type, (typeCount.get(incident.type) || 0) + 1);
      severityCount.set(incident.severity, (severityCount.get(incident.severity) || 0) + 1);

      // Track location
      if (incident.location?.city) {
        const locKey = `${incident.location.city}, ${incident.location.state || ''}`;
        if (!locationCoverage.has(locKey)) {
          locationCoverage.set(locKey, {
            city: incident.location.city,
            state: incident.location.state,
            country: incident.location.country || 'USA',
            count: 0
          });
        }
        locationCoverage.get(locKey).count++;
      }

      await dataset.updateProgress(i + 1, eligibleIncidents.length, 'processing');
    }

    // Award credits to contributors (1 credit per file)
    for (const [userId, contrib] of contributors) {
      contrib.creditAwarded = contrib.filesCount;

      // Update user's consent record
      await DataConsent.findOneAndUpdate(
        { user: userId },
        {
          $inc: {
            'compensation.creditsEarned': contrib.creditAwarded,
            'statistics.filesContributed': contrib.filesCount,
            'statistics.datasetsIncludedIn': 1
          },
          'statistics.lastContributionAt': new Date()
        }
      );
    }

    // Update dataset
    dataset.contents = {
      totalFiles,
      totalSizeBytes: totalSize,
      fileTypes: {
        videos: eligibleIncidents.reduce((sum, i) =>
          sum + (i.mediaFiles?.filter(f => f.mimetype?.startsWith('video'))?.length || 0), 0),
        images: eligibleIncidents.reduce((sum, i) =>
          sum + (i.mediaFiles?.filter(f => f.mimetype?.startsWith('image'))?.length || 0), 0)
      },
      incidentTypes: Object.fromEntries(typeCount),
      severityDistribution: Object.fromEntries(severityCount),
      dateRange: {
        start: eligibleIncidents.length > 0 ? new Date(Math.min(...eligibleIncidents.map(i => new Date(i.createdAt)))) : null,
        end: eligibleIncidents.length > 0 ? new Date(Math.max(...eligibleIncidents.map(i => new Date(i.createdAt)))) : null
      },
      locationCoverage: Array.from(locationCoverage.values()).sort((a, b) => b.count - a.count).slice(0, 20)
    };

    dataset.contributors = Array.from(contributors.values());
    dataset.includedIncidents = eligibleIncidents.map(i => i._id);
    dataset.status = 'ready';
    dataset.generatedAt = new Date();
    dataset.generationProgress = { current: eligibleIncidents.length, total: eligibleIncidents.length, stage: 'complete' };

    await dataset.save();

    console.log(`Dataset ${dataset.datasetId} generated with ${totalFiles} files from ${contributors.size} contributors`);

  } catch (error) {
    console.error('Dataset generation failed:', error);
    dataset.status = 'failed';
    dataset.generationError = error.message;
    await dataset.save();
  }
}

export default {
  getConsent,
  optIn,
  updateConsent,
  optOut,
  getContributions,
  getEarnings,
  excludeIncident,
  getDatasets,
  getDatasetById,
  createDataset,
  generateDataset,
  updateDataset,
  archiveDataset
};
