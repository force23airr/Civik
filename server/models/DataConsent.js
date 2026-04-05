import mongoose from 'mongoose';

const dataConsentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Consent status
  consent: {
    isOptedIn: {
      type: Boolean,
      default: false
    },
    optedInAt: Date,
    optedOutAt: Date,
    version: {
      type: String,
      default: '1.0'
    },
    ipAddress: String,
    userAgent: String
  },

  // Data usage preferences
  preferences: {
    allowVideoUsage: {
      type: Boolean,
      default: true
    },
    allowImageUsage: {
      type: Boolean,
      default: true
    },
    anonymizeFaces: {
      type: Boolean,
      default: true
    },
    anonymizePlates: {
      type: Boolean,
      default: true
    },
    removeAudio: {
      type: Boolean,
      default: true
    },
    allowLocationData: {
      type: Boolean,
      default: false
    },
    allowTimeData: {
      type: Boolean,
      default: true
    },
    locationPrecisionKm: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    }
  },

  // Incident filters
  incidentFilters: {
    includedTypes: [{
      type: String,
      enum: [
        'dangerous_driving', 'crime', 'security', 'other',
        'infrastructure_pothole', 'infrastructure_road_damage', 'infrastructure_construction',
        'infrastructure_signage', 'infrastructure_lighting',
        'weather_flooding', 'weather_ice', 'weather_debris', 'weather_visibility', 'weather_obstruction',
        'traffic_congestion', 'traffic_accident', 'traffic_closure', 'traffic_signal_issue', 'traffic_unusual_pattern'
      ]
    }],
    excludedIncidents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident'
    }],
    minSeverity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    }
  },

  // Compensation settings
  compensation: {
    type: {
      type: String,
      enum: ['credits', 'revenue_share', 'hybrid', 'donation', 'none'],
      default: 'credits'
    },
    // Credit balances
    creditsEarned: {
      type: Number,
      default: 0
    },
    creditsPending: {
      type: Number,
      default: 0
    },
    creditsRedeemed: {
      type: Number,
      default: 0
    },
    // Revenue share tracking
    revenueShareEarned: {
      type: Number,
      default: 0
    },
    revenueSharePending: {
      type: Number,
      default: 0
    },
    revenueSharePaid: {
      type: Number,
      default: 0
    },
    // Lifetime stats
    lifetimeEarnings: {
      type: Number,
      default: 0
    },
    lifetimePayouts: {
      type: Number,
      default: 0
    },
    // Payout settings
    payoutThreshold: {
      type: Number,
      default: 5000  // 5000 credits = $50
    },
    paymentMethod: {
      type: String,
      enum: ['paypal', 'bank', 'crypto', 'gift_card', 'none'],
      default: 'none'
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      select: false
    },
    // Auto-payout
    autoPayout: {
      type: Boolean,
      default: false
    },
    autoPayoutThreshold: {
      type: Number,
      default: 10000
    }
  },

  // Streak tracking
  streaks: {
    currentDailyStreak: {
      type: Number,
      default: 0
    },
    longestDailyStreak: {
      type: Number,
      default: 0
    },
    lastContributionDate: Date,
    weeklyContributions: {
      type: Number,
      default: 0
    },
    lastStreakBonusAt: Date
  },

  // Usage statistics
  statistics: {
    filesContributed: {
      type: Number,
      default: 0
    },
    datasetsIncludedIn: {
      type: Number,
      default: 0
    },
    lastContributionAt: Date,
    totalDataSizeMB: {
      type: Number,
      default: 0
    }
  },

  // Notification preferences
  notifications: {
    emailOnDatasetInclusion: {
      type: Boolean,
      default: true
    },
    emailOnCreditsEarned: {
      type: Boolean,
      default: true
    },
    emailOnPolicyChange: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
dataConsentSchema.index({ user: 1 });
dataConsentSchema.index({ 'consent.isOptedIn': 1 });
dataConsentSchema.index({ 'compensation.creditsEarned': -1 });

// Method to opt in
dataConsentSchema.methods.optIn = async function(ipAddress, userAgent) {
  this.consent.isOptedIn = true;
  this.consent.optedInAt = new Date();
  this.consent.optedOutAt = undefined;
  this.consent.ipAddress = ipAddress;
  this.consent.userAgent = userAgent;
  await this.save();
};

// Method to opt out
dataConsentSchema.methods.optOut = async function() {
  this.consent.isOptedIn = false;
  this.consent.optedOutAt = new Date();
  await this.save();
};

// Method to award credits
dataConsentSchema.methods.awardCredits = async function(amount, reason) {
  this.compensation.creditsEarned += amount;
  this.statistics.lastContributionAt = new Date();
  await this.save();
  return this.compensation.creditsEarned;
};

// Static method to get all opted-in users
dataConsentSchema.statics.getOptedInUsers = function() {
  return this.find({ 'consent.isOptedIn': true });
};

export default mongoose.model('DataConsent', dataConsentSchema);
