import mongoose from 'mongoose';
import crypto from 'crypto';

const parkingViolationSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportNumber: {
    type: String,
    unique: true,
    sparse: true
  },

  // Parking Violation Type
  violationType: {
    type: String,
    enum: [
      'fire_hydrant',
      'handicap_zone',
      'no_parking_zone',
      'double_parked',
      'blocking_driveway',
      'blocking_crosswalk',
      'blocking_bike_lane',
      'blocking_sidewalk',
      'expired_meter',
      'overnight_parking',
      'street_cleaning',
      'fire_lane',
      'bus_stop',
      'loading_zone',
      'red_curb',
      'yellow_curb',
      'too_close_to_intersection',
      'wrong_direction',
      'abandoned_vehicle',
      'other'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['minor', 'moderate', 'severe', 'critical'],
    required: true
  },

  // Offending Vehicle
  vehicle: {
    licensePlate: {
      type: String,
      uppercase: true,
      trim: true
    },
    plateState: String,
    plateCountry: {
      type: String,
      default: 'US'
    },
    make: String,
    model: String,
    color: String,
    vehicleType: {
      type: String,
      enum: ['sedan', 'suv', 'truck', 'van', 'motorcycle', 'commercial', 'bus', 'other']
    },
    plateConfidence: Number
  },

  // Location (auto-detected via GPS)
  location: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
  },

  // When the violation was observed
  observedAt: {
    type: Date,
    required: true,
    default: Date.now
  },

  // Photo Evidence (required for parking violations)
  photos: [{
    filename: {
      type: String,
      required: true
    },
    originalFilename: String,
    path: {
      type: String,
      required: true
    },
    mimetype: String,
    size: Number,
    sha256Hash: String,
    metadata: {
      captureDevice: String,
      gpsData: {
        lat: Number,
        lng: Number
      },
      originalTimestamp: Date
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Reporter's description
  description: {
    type: String,
    maxlength: 2000
  },

  // Nearest Police Station (auto-assigned)
  assignedStation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PoliceStation'
  },
  distanceToStation: Number, // km

  // Review & Approval by Police
  review: {
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'denied', 'needs_more_info'],
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    officerBadgeNumber: String,
    citationIssued: {
      type: Boolean,
      default: false
    },
    citationNumber: String,
    fineAmount: Number, // in cents
    denialReason: String,
    notes: String
  },

  // Reward Payout (triggered on approval)
  reward: {
    awarded: {
      type: Boolean,
      default: false
    },
    rewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reward'
    },
    amount: Number, // credits awarded
    awardedAt: Date
  },

  // Chain of Custody
  chainOfCustody: [{
    action: {
      type: String,
      enum: ['created', 'photo_added', 'submitted_to_station', 'under_review', 'approved', 'denied', 'citation_issued', 'reward_paid']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    details: String,
    previousHash: String,
    entryHash: String
  }],

  // Consent
  consent: {
    tosAccepted: {
      type: Boolean,
      required: true
    },
    certifyTruthful: {
      type: Boolean,
      required: true
    }
  },

  status: {
    type: String,
    enum: ['submitted', 'assigned', 'under_review', 'approved', 'denied', 'closed'],
    default: 'submitted'
  }
}, {
  timestamps: true
});

// Indexes
parkingViolationSchema.index({ reporter: 1, createdAt: -1 });
parkingViolationSchema.index({ assignedStation: 1, 'review.status': 1 });
parkingViolationSchema.index({ status: 1 });
parkingViolationSchema.index({ 'location.lat': 1, 'location.lng': 1 });
parkingViolationSchema.index({ 'vehicle.licensePlate': 1 });
parkingViolationSchema.index({ violationType: 1 });

// Pre-save: generate report number
parkingViolationSchema.pre('save', async function(next) {
  if (!this.reportNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('ParkingViolation').countDocuments();
    const sequence = String(count + 1).padStart(5, '0');
    this.reportNumber = `PKG-${year}-${sequence}`;
  }
  next();
});

// Add chain of custody entry with hash linking
parkingViolationSchema.methods.addCustodyEntry = function(action, performedBy, details) {
  const previousEntry = this.chainOfCustody[this.chainOfCustody.length - 1];
  const previousHash = previousEntry?.entryHash || '';

  const entryData = {
    action,
    timestamp: new Date(),
    performedBy,
    details,
    previousHash
  };

  const hashContent = JSON.stringify({
    action: entryData.action,
    timestamp: entryData.timestamp.toISOString(),
    performedBy: entryData.performedBy?.toString(),
    details: entryData.details,
    previousHash
  });
  entryData.entryHash = crypto.createHash('sha256').update(hashContent).digest('hex');

  this.chainOfCustody.push(entryData);
  return entryData;
};

// Display names for violation types
parkingViolationSchema.virtual('violationTypeDisplay').get(function() {
  const displayMap = {
    fire_hydrant: 'Parked Near Fire Hydrant',
    handicap_zone: 'Parked in Handicap Zone',
    no_parking_zone: 'No Parking Zone',
    double_parked: 'Double Parked',
    blocking_driveway: 'Blocking Driveway',
    blocking_crosswalk: 'Blocking Crosswalk',
    blocking_bike_lane: 'Blocking Bike Lane',
    blocking_sidewalk: 'Blocking Sidewalk',
    expired_meter: 'Expired Meter',
    overnight_parking: 'Overnight Parking Violation',
    street_cleaning: 'Street Cleaning Violation',
    fire_lane: 'Parked in Fire Lane',
    bus_stop: 'Parked at Bus Stop',
    loading_zone: 'Loading Zone Violation',
    red_curb: 'Parked at Red Curb',
    yellow_curb: 'Parked at Yellow Curb',
    too_close_to_intersection: 'Too Close to Intersection',
    wrong_direction: 'Parked Wrong Direction',
    abandoned_vehicle: 'Abandoned Vehicle',
    other: 'Other Parking Violation'
  };
  return displayMap[this.violationType] || this.violationType;
});

// Severity badge
parkingViolationSchema.virtual('severityBadge').get(function() {
  const badges = {
    minor: { color: '#f59e0b', label: 'Minor' },
    moderate: { color: '#f97316', label: 'Moderate' },
    severe: { color: '#ef4444', label: 'Severe' },
    critical: { color: '#dc2626', label: 'Critical' }
  };
  return badges[this.severity];
});

parkingViolationSchema.set('toJSON', { virtuals: true });
parkingViolationSchema.set('toObject', { virtuals: true });

export default mongoose.model('ParkingViolation', parkingViolationSchema);
