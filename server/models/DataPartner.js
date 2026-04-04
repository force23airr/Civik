import mongoose from 'mongoose';

const dataPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  logo: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['ai_autonomous', 'mapping', 'insurance', 'government', 'research', 'weather', 'infrastructure', 'other'],
    required: true
  },

  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    maxLength: 100
  },
  website: String,

  // What data they want and what they pay
  dataInterests: [{
    type: {
      type: String,
      enum: [
        'real_time_video',
        'incident_reports',
        'road_conditions',
        'traffic_data',
        'weather_hazards',
        'infrastructure_issues',
        'lane_data',
        'sign_detection',
        'pedestrian_data',
        'parking_data',
        'construction_zones',
        'visibility_data'
      ],
      required: true
    },
    payRate: { type: Number, required: true }, // In credits
    payUnit: {
      type: String,
      enum: ['per_minute', 'per_report', 'per_mb', 'per_hour', 'per_file'],
      default: 'per_report'
    },
    description: String,
    isActive: { type: Boolean, default: true }
  }],

  // Real-time streaming configuration
  streaming: {
    enabled: { type: Boolean, default: false },
    webhookUrl: String,
    streamTypes: [String],
    qualityRequirements: {
      minResolution: { type: String, default: '720p' },
      minFps: { type: Number, default: 15 },
      gpsRequired: { type: Boolean, default: true }
    }
  },

  // API Access (if they have Civik API access)
  apiKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey',
    default: null
  },

  // Stats shown to users
  stats: {
    activeDrivers: { type: Number, default: 0 },
    totalPaidOut: { type: Number, default: 0 }, // In credits
    totalPaidOutUSD: { type: Number, default: 0 },
    averageEarningsPerDriver: { type: Number, default: 0 }, // Monthly in credits
    totalDataReceived: { type: Number, default: 0 }, // In MB
    lastDataReceivedAt: Date
  },

  // Display settings
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 100 },

  // Terms
  termsUrl: String,
  privacyUrl: String,
  dataUsageDescription: String
}, {
  timestamps: true
});

// Indexes
dataPartnerSchema.index({ category: 1, isActive: 1 });
dataPartnerSchema.index({ isFeatured: 1, displayOrder: 1 });
dataPartnerSchema.index({ name: 'text', description: 'text' });

// Virtual for category display name
dataPartnerSchema.virtual('categoryDisplay').get(function() {
  const categoryNames = {
    ai_autonomous: 'AI & Autonomous Vehicles',
    mapping: 'Mapping & Navigation',
    insurance: 'Insurance',
    government: 'Government & DOT',
    research: 'Research & Academia',
    weather: 'Weather Services',
    infrastructure: 'Infrastructure',
    other: 'Other'
  };
  return categoryNames[this.category] || this.category;
});

// Static method to seed default data partners
dataPartnerSchema.statics.seedDefaults = async function() {
  const defaults = [
    {
      name: 'Waymo',
      code: 'waymo',
      category: 'ai_autonomous',
      description: 'Waymo is developing autonomous driving technology. Your driving data helps train AI systems to make self-driving cars safer for everyone.',
      shortDescription: 'Autonomous vehicle development',
      website: 'https://waymo.com',
      dataInterests: [
        { type: 'real_time_video', payRate: 2, payUnit: 'per_minute', description: 'Live driving footage for AI training' },
        { type: 'incident_reports', payRate: 50, payUnit: 'per_report', description: 'Dangerous driving and accident footage' },
        { type: 'lane_data', payRate: 5, payUnit: 'per_report', description: 'Lane markings and road geometry' }
      ],
      streaming: { enabled: true, qualityRequirements: { minResolution: '1080p', minFps: 30, gpsRequired: true } },
      stats: { activeDrivers: 1250, averageEarningsPerDriver: 4500 },
      isFeatured: true,
      displayOrder: 1
    },
    {
      name: 'Comma.ai',
      code: 'comma_ai',
      category: 'ai_autonomous',
      description: 'Comma.ai builds open source self-driving technology. Your data contributes to making advanced driver assistance available to everyone.',
      shortDescription: 'Open source self-driving tech',
      website: 'https://comma.ai',
      dataInterests: [
        { type: 'real_time_video', payRate: 1, payUnit: 'per_minute', description: 'Driving video for openpilot training' },
        { type: 'lane_data', payRate: 5, payUnit: 'per_report', description: 'Lane detection data' },
        { type: 'sign_detection', payRate: 3, payUnit: 'per_report', description: 'Traffic sign recognition' }
      ],
      streaming: { enabled: true, qualityRequirements: { minResolution: '720p', minFps: 20, gpsRequired: true } },
      stats: { activeDrivers: 890, averageEarningsPerDriver: 2800 },
      isFeatured: true,
      displayOrder: 2
    },
    {
      name: 'TomTom',
      code: 'tomtom',
      category: 'mapping',
      description: 'TomTom provides navigation and mapping services worldwide. Your road reports help keep maps accurate and drivers informed.',
      shortDescription: 'Navigation & mapping services',
      website: 'https://tomtom.com',
      dataInterests: [
        { type: 'road_conditions', payRate: 10, payUnit: 'per_report', description: 'Road surface quality reports' },
        { type: 'traffic_data', payRate: 5, payUnit: 'per_report', description: 'Traffic congestion data' },
        { type: 'construction_zones', payRate: 15, payUnit: 'per_report', description: 'Active construction areas' }
      ],
      stats: { activeDrivers: 2100, averageEarningsPerDriver: 3400 },
      isFeatured: true,
      displayOrder: 3
    },
    {
      name: 'The Weather Company',
      code: 'weather_company',
      category: 'weather',
      description: 'The Weather Company (IBM) provides weather forecasting. Your hazard reports help create hyper-local weather alerts for drivers.',
      shortDescription: 'Weather data & forecasting',
      website: 'https://weather.com',
      dataInterests: [
        { type: 'weather_hazards', payRate: 25, payUnit: 'per_report', description: 'Severe weather conditions' },
        { type: 'visibility_data', payRate: 10, payUnit: 'per_report', description: 'Fog, rain, snow visibility' },
        { type: 'road_conditions', payRate: 15, payUnit: 'per_report', description: 'Ice, flooding, debris' }
      ],
      stats: { activeDrivers: 1560, averageEarningsPerDriver: 2200 },
      displayOrder: 4
    },
    {
      name: 'Texas DOT',
      code: 'txdot',
      category: 'government',
      description: 'Texas Department of Transportation uses community reports to prioritize road repairs and improve infrastructure across the state.',
      shortDescription: 'Texas road infrastructure',
      website: 'https://txdot.gov',
      dataInterests: [
        { type: 'infrastructure_issues', payRate: 25, payUnit: 'per_report', description: 'Potholes, road damage' },
        { type: 'construction_zones', payRate: 15, payUnit: 'per_report', description: 'Construction zone updates' },
        { type: 'traffic_data', payRate: 8, payUnit: 'per_report', description: 'Traffic pattern data' }
      ],
      coverage: { states: ['TX'] },
      stats: { activeDrivers: 450, averageEarningsPerDriver: 1800 },
      displayOrder: 5
    },
    {
      name: 'California DOT',
      code: 'caltrans',
      category: 'government',
      description: 'Caltrans maintains California\'s highway system. Your reports help identify issues and improve road safety statewide.',
      shortDescription: 'California road infrastructure',
      website: 'https://dot.ca.gov',
      dataInterests: [
        { type: 'infrastructure_issues', payRate: 25, payUnit: 'per_report', description: 'Road damage reports' },
        { type: 'traffic_data', payRate: 10, payUnit: 'per_report', description: 'Highway traffic data' },
        { type: 'construction_zones', payRate: 15, payUnit: 'per_report', description: 'Work zone information' }
      ],
      coverage: { states: ['CA'] },
      stats: { activeDrivers: 620, averageEarningsPerDriver: 2100 },
      displayOrder: 6
    },
    {
      name: 'Aurora',
      code: 'aurora',
      category: 'ai_autonomous',
      description: 'Aurora is building the Aurora Driver for self-driving trucks and cars. Your highway data is especially valuable for long-haul training.',
      shortDescription: 'Self-driving trucks & cars',
      website: 'https://aurora.tech',
      dataInterests: [
        { type: 'real_time_video', payRate: 3, payUnit: 'per_minute', description: 'Highway driving footage' },
        { type: 'incident_reports', payRate: 75, payUnit: 'per_report', description: 'Highway incidents' },
        { type: 'traffic_data', payRate: 8, payUnit: 'per_report', description: 'Interstate traffic patterns' }
      ],
      streaming: { enabled: true, qualityRequirements: { minResolution: '1080p', minFps: 30, gpsRequired: true } },
      stats: { activeDrivers: 340, averageEarningsPerDriver: 5200 },
      displayOrder: 7
    },
    {
      name: 'MIT Autonomous Lab',
      code: 'mit_auto',
      category: 'research',
      description: 'MIT\'s autonomous vehicle research lab uses real-world driving data for academic research on safer transportation systems.',
      shortDescription: 'Academic research',
      website: 'https://mit.edu',
      dataInterests: [
        { type: 'incident_reports', payRate: 30, payUnit: 'per_report', description: 'Accident and near-miss data' },
        { type: 'pedestrian_data', payRate: 20, payUnit: 'per_report', description: 'Pedestrian interaction data' },
        { type: 'traffic_data', payRate: 5, payUnit: 'per_report', description: 'Urban traffic patterns' }
      ],
      stats: { activeDrivers: 180, averageEarningsPerDriver: 1500 },
      displayOrder: 8
    }
  ];

  for (const partner of defaults) {
    await this.findOneAndUpdate(
      { code: partner.code },
      partner,
      { upsert: true, new: true }
    );
  }

  console.log('[DataPartner] Seeded default data partners');
};

// Ensure virtuals are included in JSON
dataPartnerSchema.set('toJSON', { virtuals: true });
dataPartnerSchema.set('toObject', { virtuals: true });

const DataPartner = mongoose.model('DataPartner', dataPartnerSchema);

export default DataPartner;
