import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 1000
  },
  type: {
    type: String,
    enum: [
      // Original types
      'dangerous_driving',
      'crime',
      'security',
      'other',
      // Infrastructure types
      'infrastructure_pothole',
      'infrastructure_road_damage',
      'infrastructure_construction',
      'infrastructure_signage',
      'infrastructure_lighting',
      // Weather event types
      'weather_flooding',
      'weather_ice',
      'weather_debris',
      'weather_visibility',
      'weather_obstruction',
      // Traffic pattern types
      'traffic_congestion',
      'traffic_accident',
      'traffic_closure',
      'traffic_signal_issue',
      'traffic_unusual_pattern'
    ],
    required: [true, 'Incident type is required']
  },
  location: {
    address: {
      type: String,
      required: [true, 'Location address is required']
    },
    lat: {
      type: Number
    },
    lng: {
      type: Number
    },
    city: {
      type: String
    },
    state: {
      type: String
    },
    country: {
      type: String
    },
    zipCode: {
      type: String
    }
  },
  timeBreakdown: {
    hour: Number,
    dayOfWeek: Number,
    month: Number,
    year: Number,
    isWeekend: Boolean,
    isRushHour: Boolean
  },
  mediaFiles: [{
    filename: String,
    path: String,
    mimetype: String
  }],
  detectedPlates: [{
    plate: {
      type: String,
      uppercase: true,
      trim: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    region: String,
    vehicleType: String,
    detectedAt: {
      type: Date,
      default: Date.now
    },
    sourceFile: String,
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    reportedToAuthorities: {
      type: Boolean,
      default: false
    }
  }],
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'resolved'],
    default: 'pending'
  },
  policeReports: [{
    policeStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PoliceStation'
    },
    reportId: String,
    sentAt: Date,
    method: {
      type: String,
      enum: ['email', 'api', 'download']
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    },
    pdfPath: String,
    acknowledgedAt: Date,
    caseNumber: String
  }],
  // Data quality metrics for rewards
  dataQuality: {
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    factors: {
      hasVideo: { type: Boolean, default: false },
      hasGPS: { type: Boolean, default: false },
      hasTimestamp: { type: Boolean, default: true },
      isClearFootage: { type: Boolean, default: false },
      isVerified: { type: Boolean, default: false },
      communityScore: { type: Number, default: 0 }
    }
  },
  // Rewards tracking
  rewards: {
    baseCredits: { type: Number, default: 0 },
    bonusCredits: { type: Number, default: 0 },
    totalCredits: { type: Number, default: 0 },
    rewardId: mongoose.Schema.Types.ObjectId,
    awardedAt: Date
  },
  // Data marketplace value
  dataValue: {
    estimatedValue: { type: Number, default: 0 },
    category: {
      type: String,
      enum: ['common', 'uncommon', 'rare', 'high_value'],
      default: 'common'
    },
    usageCount: { type: Number, default: 0 }
  },
  // Witness reports
  witnesses: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    statement: {
      type: String,
      maxlength: 2000
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }],
  witnessCount: {
    type: Number,
    default: 0
  },
  // Municipal routing results (auto-populated after creation)
  municipalReports: [{
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'MunicipalDepartment' },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'MunicipalReport' },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'submitted' },
    ticketNumber: String
  }],

  // Traffic conditions at incident time (from HERE Traffic API)
  trafficData: {
    fetchedAt: Date,
    flow: {
      currentSpeed: Number,
      freeFlowSpeed: Number,
      jamFactor: Number,
      confidence: Number
    },
    nearbyIncidents: [{
      type: String,
      description: String,
      distanceMeters: Number,
      severity: String
    }]
  },

  // Weather conditions at incident time (from Azure Maps Weather API)
  weatherData: {
    fetchedAt: Date,
    conditions: {
      description: String,
      temperature: Number,
      humidity: Number,
      windSpeed: Number,
      visibility: Number,
      precipitation: Boolean,
      precipitationType: String,
      uvIndex: Number
    },
    hazards: [{
      type: String,
      severity: String
    }]
  },

  // Enrichment pipeline status tracking
  enrichment: {
    plateDetection: { status: String, completedAt: Date, error: String },
    traffic: { status: String, completedAt: Date, error: String },
    weather: { status: String, completedAt: Date, error: String },
    scoring: { status: String, completedAt: Date, error: String }
  }
}, {
  timestamps: true
});

// Index for filtering
incidentSchema.index({ type: 1, severity: 1, status: 1 });
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ 'location.lat': 1, 'location.lng': 1 });
incidentSchema.index({ 'location.city': 1, 'location.state': 1 });
incidentSchema.index({ 'timeBreakdown.hour': 1, 'timeBreakdown.dayOfWeek': 1 });

// Pre-save hook to compute timeBreakdown
incidentSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('createdAt')) {
    const date = this.createdAt || new Date();
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    this.timeBreakdown = {
      hour: hour,
      dayOfWeek: dayOfWeek,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isRushHour: (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)
    };
  }
  next();
});

export default mongoose.model('Incident', incidentSchema);
