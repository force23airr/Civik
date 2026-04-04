import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Reward type categorization
  type: {
    type: String,
    enum: [
      'incident_upload',        // Base reward for uploading incidents
      'data_contribution',      // When data is included in dataset
      'revenue_share',          // Share from dataset sales
      'referral_bonus',         // Bonus for referring users
      'referral_welcome',       // Welcome bonus for referred user
      'referral_milestone',     // Milestone bonuses (5, 10, 25 referrals)
      'tier_bonus',             // Monthly tier maintenance bonus
      'quality_bonus',          // High-quality/verified data bonus
      'streak_bonus',           // Consecutive daily contribution bonus
      'police_report',          // Bonus for sending to police
      'insurance_claim',        // Bonus for filing claim
      'community_verification', // Upvotes/verifications from community
      'parking_violation_approved', // Bounty for approved parking violation report
      'payout_redemption',      // Negative entry for cash-out
      'adjustment'              // Admin adjustments
    ],
    required: true
  },

  // Amount in credits (100 credits = $1 USD)
  amount: {
    type: Number,
    required: true
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'paid', 'cancelled', 'expired'],
    default: 'pending'
  },

  // Reference to source entity
  source: {
    entityType: {
      type: String,
      enum: ['incident', 'dataset', 'referral', 'payout', 'police_report', 'insurance_claim', 'parking_violation', 'system']
    },
    entityId: mongoose.Schema.Types.ObjectId
  },

  // Multipliers applied
  multipliers: [{
    type: {
      type: String,
      enum: ['tier', 'streak', 'bonus_event', 'quality', 'campaign']
    },
    value: Number,
    description: String
  }],

  // Calculated values
  baseAmount: {
    type: Number,
    default: 0
  },
  bonusAmount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    default: 0
  },

  // Revenue share specific fields
  revenueShare: {
    datasetId: String,
    datasetName: String,
    saleAmount: Number,           // Total sale amount in cents
    platformFee: Number,          // Civik's cut
    contributorPool: Number,      // Total pool for contributors
    userContributionPercent: Number, // User's % of dataset
    userShare: Number             // User's share of pool
  },

  // Description and metadata
  description: String,
  metadata: mongoose.Schema.Types.Mixed,

  // Processing timestamps
  processedAt: Date,
  expiresAt: Date,
  confirmedAt: Date,

  // For payouts
  payout: {
    method: {
      type: String,
      enum: ['paypal', 'bank', 'crypto', 'gift_card']
    },
    transactionId: String,
    processingFee: Number,
    netAmount: Number,
    processedAt: Date,
    failureReason: String,
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      select: false
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
rewardSchema.index({ user: 1, createdAt: -1 });
rewardSchema.index({ user: 1, type: 1 });
rewardSchema.index({ user: 1, status: 1 });
rewardSchema.index({ 'source.entityId': 1 });
rewardSchema.index({ status: 1, expiresAt: 1 });
rewardSchema.index({ type: 1, createdAt: -1 });

// Virtual for display amount in dollars
rewardSchema.virtual('amountUSD').get(function() {
  return (this.amount / 100).toFixed(2);
});

// Static method to get user's total balance
rewardSchema.statics.getUserBalance = async function(userId) {
  const result = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), status: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return result[0]?.total || 0;
};

// Static method to get monthly credits
rewardSchema.statics.getMonthlyCredits = async function(userId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startOfMonth },
        status: 'confirmed',
        amount: { $gt: 0 }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return result[0]?.total || 0;
};

// Instance method to confirm reward
rewardSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  this.confirmedAt = new Date();
  return this.save();
};

// Prevent duplicate rewards for the same entity + type (database-level guard)
rewardSchema.index(
  { 'source.entityId': 1, type: 1 },
  { unique: true, partialFilterExpression: { 'source.entityId': { $exists: true } } }
);

export default mongoose.model('Reward', rewardSchema);
