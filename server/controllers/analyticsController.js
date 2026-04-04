import * as analyticsService from '../services/analytics/aggregationService.js';
import ExportJob from '../models/ExportJob.js';
import Incident from '../models/Incident.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure exports directory exists
const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Helper to parse filters from query
function parseFilters(query) {
  const filters = {};

  if (query.startDate) filters.startDate = query.startDate;
  if (query.endDate) filters.endDate = query.endDate;

  if (query.types) {
    filters.types = Array.isArray(query.types) ? query.types : query.types.split(',');
  }

  if (query.severities) {
    filters.severities = Array.isArray(query.severities) ? query.severities : query.severities.split(',');
  }

  if (query.statuses) {
    filters.statuses = Array.isArray(query.statuses) ? query.statuses : query.statuses.split(',');
  }

  if (query.city) filters.city = query.city;
  if (query.state) filters.state = query.state;

  if (query.north && query.south && query.east && query.west) {
    filters.bounds = {
      north: parseFloat(query.north),
      south: parseFloat(query.south),
      east: parseFloat(query.east),
      west: parseFloat(query.west)
    };
  }

  return filters;
}

// @desc    Get heatmap data
// @route   GET /api/analytics/heatmap
// @access  Private
export const getHeatmap = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await analyticsService.getHeatmapData(filters);

    res.json({
      type: 'heatmap',
      filters,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get incident trends over time
// @route   GET /api/analytics/trends
// @access  Private
export const getTrends = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const granularity = req.query.granularity || 'day';

    const data = await analyticsService.getTrends(filters, granularity);

    res.json({
      type: 'trends',
      granularity,
      filters,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get peak hours analysis
// @route   GET /api/analytics/peak-hours
// @access  Private
export const getPeakHours = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await analyticsService.getPeakHours(filters);

    res.json({
      type: 'peak-hours',
      filters,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get breakdown by incident type
// @route   GET /api/analytics/by-type
// @access  Private
export const getByType = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await analyticsService.getByType(filters);

    res.json({
      type: 'by-type',
      filters,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get breakdown by severity
// @route   GET /api/analytics/by-severity
// @access  Private
export const getBySeverity = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await analyticsService.getBySeverity(filters);

    res.json({
      type: 'by-severity',
      filters,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get breakdown by location
// @route   GET /api/analytics/by-location
// @access  Private
export const getByLocation = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await analyticsService.getByLocation(filters);

    res.json({
      type: 'by-location',
      filters,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get summary statistics for dashboard
// @route   GET /api/analytics/summary
// @access  Private
export const getSummary = async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const data = await analyticsService.getSummary(filters);

    res.json({
      type: 'summary',
      filters,
      data
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create async export job
// @route   POST /api/analytics/export
// @access  Private
export const createExportJob = async (req, res) => {
  try {
    const {
      type = 'incidents',
      format = 'json',
      filters = {},
      options = {}
    } = req.body;

    const job = await ExportJob.create({
      user: req.user._id,
      type,
      format,
      filters: {
        dateRange: filters.dateRange,
        types: filters.types,
        severities: filters.severities,
        statuses: filters.statuses,
        location: filters.location,
        granularity: filters.granularity || 'day'
      },
      options: {
        includeMedia: options.includeMedia || false,
        anonymize: options.anonymize !== false,
        limit: Math.min(options.limit || 10000, 100000)
      },
      requestContext: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Process job asynchronously
    processExportJob(job._id).catch(console.error);

    res.status(202).json({
      message: 'Export job created',
      jobId: job.jobId,
      status: job.status,
      checkUrl: `/api/analytics/export/${job.jobId}`
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get export job status
// @route   GET /api/analytics/export/:jobId
// @access  Private
export const getExportJobStatus = async (req, res) => {
  try {
    const job = await ExportJob.findOne({
      jobId: req.params.jobId,
      user: req.user._id
    });

    if (!job) {
      return res.status(404).json({ message: 'Export job not found' });
    }

    res.json({
      jobId: job.jobId,
      type: job.type,
      format: job.format,
      status: job.status,
      progress: job.progress,
      result: job.status === 'completed' ? {
        downloadUrl: `/api/analytics/export/${job.jobId}/download`,
        fileSize: job.result.fileSize,
        recordCount: job.result.recordCount,
        expiresAt: job.result.expiresAt
      } : null,
      error: job.status === 'failed' ? job.error.message : null,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Download export file
// @route   GET /api/analytics/export/:jobId/download
// @access  Private
export const downloadExport = async (req, res) => {
  try {
    const job = await ExportJob.findOne({
      jobId: req.params.jobId,
      user: req.user._id
    });

    if (!job) {
      return res.status(404).json({ message: 'Export job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ message: 'Export not ready for download' });
    }

    if (job.result.expiresAt < new Date()) {
      return res.status(410).json({ message: 'Export has expired' });
    }

    const filePath = job.result.filePath;

    // Path traversal guard — ensure file is within exports directory
    const safePath = path.resolve(filePath);
    if (!safePath.startsWith(path.resolve(exportsDir))) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ message: 'Export file not found' });
    }

    const filename = `civik-export-${job.jobId}.${job.format}`;
    res.download(safePath, filename);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get user's export jobs
// @route   GET /api/analytics/exports
// @access  Private
export const getUserExportJobs = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query = { user: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [jobs, total] = await Promise.all([
      ExportJob.find(query)
        .select('jobId type format status progress result.recordCount result.expiresAt createdAt completedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ExportJob.countDocuments(query)
    ]);

    res.json({
      jobs,
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

// Background job processor
async function processExportJob(jobId) {
  const job = await ExportJob.findById(jobId);
  if (!job) return;

  try {
    await job.startProcessing();

    // Build query from filters
    const query = {};

    if (job.filters.dateRange?.start || job.filters.dateRange?.end) {
      query.createdAt = {};
      if (job.filters.dateRange.start) query.createdAt.$gte = new Date(job.filters.dateRange.start);
      if (job.filters.dateRange.end) query.createdAt.$lte = new Date(job.filters.dateRange.end);
    }

    if (job.filters.types?.length > 0) {
      query.type = { $in: job.filters.types };
    }

    if (job.filters.severities?.length > 0) {
      query.severity = { $in: job.filters.severities };
    }

    if (job.filters.statuses?.length > 0) {
      query.status = { $in: job.filters.statuses };
    }

    // Restrict non-admin exports to user's own incidents
    if (job.options.anonymize === false) {
      // Non-anonymized exports must be user-scoped unless admin
      const jobUser = await import('../models/User.js').then(m => m.default.findById(job.user));
      if (!jobUser || jobUser.role !== 'admin') {
        query.user = job.user;
      }
    }

    // Get incidents
    const incidents = await Incident.find(query)
      .populate('user', 'username')
      .limit(job.options.limit)
      .lean();

    await job.updateProgress(0, incidents.length);

    // Process data based on type
    let exportData;

    switch (job.type) {
      case 'heatmap':
        exportData = incidents
          .filter(i => i.location?.lat && i.location?.lng)
          .map(i => ({
            lat: job.options.anonymize ? Math.round(i.location.lat * 100) / 100 : i.location.lat,
            lng: job.options.anonymize ? Math.round(i.location.lng * 100) / 100 : i.location.lng,
            type: i.type,
            severity: i.severity,
            date: i.createdAt
          }));
        break;

      case 'aggregate':
        const summary = await analyticsService.getSummary(job.filters);
        exportData = summary;
        break;

      default:
        exportData = incidents.map((incident, index) => {
          job.updateProgress(index + 1, incidents.length).catch(() => { });

          const data = {
            id: incident._id,
            title: incident.title,
            type: incident.type,
            severity: incident.severity,
            status: incident.status,
            createdAt: incident.createdAt
          };

          if (!job.options.anonymize) {
            data.description = incident.description;
            data.location = incident.location;
            data.reporter = incident.user?.username;
          } else {
            data.location = {
              city: incident.location?.city,
              state: incident.location?.state
            };
          }

          return data;
        });
    }

    // Write to file
    const filename = `export-${job.jobId}.${job.format}`;
    const filePath = path.join(exportsDir, filename);

    let content;
    if (job.format === 'json') {
      content = JSON.stringify(exportData, null, 2);
    } else if (job.format === 'csv') {
      content = convertToCSV(exportData);
    } else if (job.format === 'geojson') {
      content = JSON.stringify(convertToGeoJSON(exportData), null, 2);
    } else {
      content = JSON.stringify(exportData, null, 2);
    }

    fs.writeFileSync(filePath, content);

    const stats = fs.statSync(filePath);

    await job.complete({
      filePath,
      fileUrl: `/exports/${filename}`,
      fileSize: stats.size,
      recordCount: Array.isArray(exportData) ? exportData.length : 1
    });

  } catch (error) {
    console.error('Export job failed:', error);
    await job.fail(error);
  }
}

// Helper: Convert array to CSV
function convertToCSV(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""');
      return String(val).replace(/"/g, '""');
    });
    csvRows.push(values.map(v => `"${v}"`).join(','));
  }

  return csvRows.join('\n');
}

// Helper: Convert to GeoJSON
function convertToGeoJSON(data) {
  return {
    type: 'FeatureCollection',
    features: data
      .filter(d => d.lat && d.lng)
      .map(d => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [d.lng, d.lat]
        },
        properties: {
          type: d.type,
          severity: d.severity,
          date: d.date || d.createdAt
        }
      }))
  };
}

export default {
  getHeatmap,
  getTrends,
  getPeakHours,
  getByType,
  getBySeverity,
  getByLocation,
  getSummary,
  createExportJob,
  getExportJobStatus,
  downloadExport,
  getUserExportJobs
};
