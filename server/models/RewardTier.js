import mongoose from 'mongoose';

const rewardTierSchema = new mongoose.Schema({
  // Tier identification
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond']
  },

  displayName: {
    type: String,
    required: true
  },

  description: String,

  icon: {
    type: String,
    default: ''
  },

  color: {
    type: String,
    default: '#808080'
  },

  // Requirements to reach/maintain tier
  requirements: {
    minMonthlyCredits: {
      type: Number,
      default: 0
    },
    minMonthlyIncidents: {
      type: Number,
      default: 0
    },
    minMonthlyDataPoints: {
      type: Number,
      default: 0
    },
    minAccountAgeDays: {
      type: Number,
      default: 0
    },
    minQualityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    minVerifiedIncidents: {
      type: Number,
      default: 0
    }
  },

  // Benefits of the tier
  benefits: {
    creditMultiplier: {
      type: Number,
      default: 1.0
    },
    revenueShareBonus: {
      type: Number,
      default: 0      // Additional percentage points on revenue share
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    earlyAccess: {
      type: Boolean,
      default: false
    },
    reducedPayoutThreshold: {
      type: Number,
      default: 5000   // Credits needed for payout
    },
    monthlyBonus: {
      type: Number,
      default: 0      // Bonus credits for maintaining tier
    },
    badgeDisplay: {
      type: Boolean,
      default: true
    },
    leaderboardBoost: {
      type: Number,
      default: 0
    }
  },

  // Tier order for progression
  order: {
    type: Number,
    required: true,
    unique: true
  },

  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Static method to get all active tiers
rewardTierSchema.statics.getActiveTiers = function() {
  return this.find({ isActive: true }).sort({ order: 1 });
};

// Static method to determine tier based on metrics
rewardTierSchema.statics.calculateTier = async function(monthlyCredits, monthlyIncidents) {
  const tiers = await this.find({ isActive: true }).sort({ order: -1 });

  for (const tier of tiers) {
    if (monthlyCredits >= tier.requirements.minMonthlyCredits &&
        monthlyIncidents >= tier.requirements.minMonthlyIncidents) {
      return tier;
    }
  }

  // Return lowest tier (bronze) if no match
  return tiers[tiers.length - 1];
};

// Static method to seed default tiers
rewardTierSchema.statics.seedDefaultTiers = async function() {
  const defaultTiers = [
    {
      name: 'bronze',
      displayName: 'Bronze Contributor',
      description: 'Getting started with Civik',
      icon: '🥉',
      color: '#CD7F32',
      order: 1,
      requirements: {
        minMonthlyCredits: 0,
        minMonthlyIncidents: 0
      },
      benefits: {
        creditMultiplier: 1.0,
        revenueShareBonus: 0,
        reducedPayoutThreshold: 5000,
        monthlyBonus: 0
      }
    },
    {
      name: 'silver',
      displayName: 'Silver Contributor',
      description: 'Active community member',
      icon: '🥈',
      color: '#C0C0C0',
      order: 2,
      requirements: {
        minMonthlyCredits: 500,
        minMonthlyIncidents: 10
      },
      benefits: {
        creditMultiplier: 1.1,
        revenueShareBonus: 0,
        reducedPayoutThreshold: 4000,
        monthlyBonus: 50
      }
    },
    {
      name: 'gold',
      displayName: 'Gold Contributor',
      description: 'Dedicated safety advocate',
      icon: '🥇',
      color: '#FFD700',
      order: 3,
      requirements: {
        minMonthlyCredits: 2000,
        minMonthlyIncidents: 50
      },
      benefits: {
        creditMultiplier: 1.25,
        revenueShareBonus: 5,
        reducedPayoutThreshold: 2500,
        monthlyBonus: 200
      }
    },
    {
      name: 'platinum',
      displayName: 'Platinum Contributor',
      description: 'Elite road safety champion',
      icon: '💎',
      color: '#E5E4E2',
      order: 4,
      requirements: {
        minMonthlyCredits: 5000,
        minMonthlyIncidents: 100
      },
      benefits: {
        creditMultiplier: 1.5,
        revenueShareBonus: 10,
        reducedPayoutThreshold: 1000,
        monthlyBonus: 500,
        prioritySupport: true
      }
    },
    {
      name: 'diamond',
      displayName: 'Diamond Contributor',
      description: 'Top-tier data contributor',
      icon: '💠',
      color: '#B9F2FF',
      order: 5,
      requirements: {
        minMonthlyCredits: 10000,
        minMonthlyIncidents: 200
      },
      benefits: {
        creditMultiplier: 2.0,
        revenueShareBonus: 15,
        reducedPayoutThreshold: 500,
        monthlyBonus: 1000,
        prioritySupport: true,
        earlyAccess: true
      }
    }
  ];

  for (const tier of defaultTiers) {
    await this.findOneAndUpdate(
      { name: tier.name },
      tier,
      { upsert: true, new: true }
    );
  }

  console.log('Default reward tiers seeded');
};

export default mongoose.model('RewardTier', rewardTierSchema);
