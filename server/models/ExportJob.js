import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const exportJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    unique: true,
    required: true,
    default: () => uuidv4()
  },

  // Who requested the export
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  apiKey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey'
  },

  // Export type
  type: {
    type: String,
    enum: ['heatmap', 'timeseries', 'raw', 'aggregate', 'incidents', 'analytics'],
    required: true
  },

  // Filters applied
  filters: {
    dateRange: {
      start: Date,
      end: Date
    },
    types: [{
      type: String,
      enum: ['dangerous_driving', 'crime', 'security', 'other']
    }],
    severities: [{
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    }],
    statuses: [{
      type: String,
      enum: ['pending', 'verified', 'resolved']
    }],
    location: {
      bounds: {
        north: Number,
        south: Number,
        east: Number,
        west: Number
      },
      city: String,
      state: String,
      country: String
    },
    granularity: {
      type: String,
      enum: ['hour', 'day', 'week', 'month', 'year'],
      default: 'day'
    }
  },

  // Output format
  format: {
    type: String,
    enum: ['json', 'csv', 'geojson', 'xlsx'],
    default: 'json'
  },

  // Include options
  options: {
    includeMedia: {
      type: Boolean,
      default: false
    },
    anonymize: {
      type: Boolean,
      default: true
    },
    limit: {
      type: Number,
      default: 10000,
      max: 100000
    }
  },

  // Job status
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'expired'],
    default: 'queued'
  },

  // Processing info
  progress: {
    current: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  startedAt: Date,
  completedAt: Date,

  // Result
  result: {
    fileUrl: String,
    filePath: String,
    fileSize: Number,
    recordCount: Number,
    expiresAt: Date,
    checksum: String
  },

  // Error info
  error: {
    message: String,
    stack: String,
    code: String
  },

  // Request context
  requestContext: {
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes
exportJobSchema.index({ jobId: 1 });
exportJobSchema.index({ user: 1, status: 1 });
exportJobSchema.index({ apiKey: 1, status: 1 });
exportJobSchema.index({ status: 1, createdAt: -1 });
exportJobSchema.index({ 'result.expiresAt': 1 });

// Method to start processing
exportJobSchema.methods.startProcessing = async function() {
  this.status = 'processing';
  this.startedAt = new Date();
  await this.save();
};

// Method to update progress
exportJobSchema.methods.updateProgress = async function(current, total) {
  this.progress = {
    current,
    total,
    percentage: Math.round((current / total) * 100)
  };
  await this.save();
};

// Method to complete
exportJobSchema.methods.complete = async function(result) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.result = {
    ...result,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
  this.progress.percentage = 100;
  await this.save();
};

// Method to fail
exportJobSchema.methods.fail = async function(error) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.error = {
    message: error.message,
    code: error.code
  };
  await this.save();
};

// Static to clean up expired jobs
exportJobSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'completed',
      'result.expiresAt': { $lt: new Date() }
    },
    {
      $set: { status: 'expired' }
    }
  );
  return result.modifiedCount;
};

export default mongoose.model('ExportJob', exportJobSchema);
