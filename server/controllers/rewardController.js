import Reward from '../models/Reward.js';
import RewardTier from '../models/RewardTier.js';
import Referral from '../models/Referral.js';
import DataConsent from '../models/DataConsent.js';
import User from '../models/User.js';
import {
  REWARD_VALUES,
  getLeaderboard,
  processPayout,
  checkTierUpgrade
} from '../services/rewards/rewardService.js';
import crypto from 'crypto';

// ==================== USER DASHBOARD ENDPOINTS ====================

// @desc    Get user's rewards dashboard summary
// @route   GET /api/rewards/dashboard
// @access  Private
export const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [consent, recentRewards, referralStats] = await Promise.all([
      DataConsent.findOne({ user: userId }),
      Reward.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10),
      Referral.aggregate([
        { $match: { referrer: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    // Get tier info
    const tierInfo = await RewardTier.findOne({
      name: consent?.tier?.current || 'bronze'
    });

    // Calculate available balance
    const available = (consent?.compensation?.creditsEarned || 0) -
                     (consent?.compensation?.creditsRedeemed || 0);

    // Process referral stats
    const refStats = {
      total: 0,
      pending: 0,
      qualified: 0,
      rewarded: 0
    };
    referralStats.forEach(s => {
      refStats[s._id] = s.count;
      if (s._id !== 'cancelled') refStats.total += s.count;
    });

    res.json({
      balance: {
        available,
        pending: consent?.compensation?.creditsPending || 0,
        lifetime: consent?.compensation?.lifetimeEarnings || 0,
        redeemed: consent?.compensation?.creditsRedeemed || 0,
        availableUSD: (available / 100).toFixed(2)
      },
      tier: {
        current: consent?.tier?.current || 'bronze',
        multiplier: consent?.tier?.multiplier || 1.0,
        info: tierInfo,
        monthlyProgress: {
          credits: consent?.tier?.monthlyCredits || 0,
          incidents: consent?.tier?.monthlyIncidents || 0
        }
      },
      referrals: {
        code: req.user.rewards?.referralCode,
        ...refStats
      },
      streaks: consent?.streaks || {
        currentDailyStreak: 0,
        longestDailyStreak: 0
      },
      recentActivity: recentRewards.map(r => ({
        id: r._id,
        type: r.type,
        amount: r.amount,
        amountUSD: (r.amount / 100).toFixed(2),
        description: r.description,
        status: r.status,
        date: r.createdAt
      }))
    });
  } catch (error) {
    console.error('[RewardController] Dashboard error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get rewards history with pagination
// @route   GET /api/rewards/history
// @access  Private
export const getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const query = { user: req.user._id };

    if (type) query.type = type;
    if (status) query.status = status;

    const [rewards, total] = await Promise.all([
      Reward.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Reward.countDocuments(query)
    ]);

    res.json({
      rewards: rewards.map(r => ({
        id: r._id,
        type: r.type,
        amount: r.amount,
        amountUSD: (r.amount / 100).toFixed(2),
        description: r.description,
        status: r.status,
        source: r.source,
        multipliers: r.multipliers,
        date: r.createdAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get tier information and progress
// @route   GET /api/rewards/tiers
// @access  Private
export const getTiers = async (req, res) => {
  try {
    const tiers = await RewardTier.find({ isActive: true }).sort({ order: 1 });
    const consent = await DataConsent.findOne({ user: req.user._id });

    res.json({
      currentTier: consent?.tier?.current || 'bronze',
      tiers: tiers.map(tier => ({
        name: tier.name,
        displayName: tier.displayName,
        description: tier.description,
        icon: tier.icon,
        color: tier.color,
        requirements: tier.requirements,
        benefits: tier.benefits,
        isCurrent: tier.name === (consent?.tier?.current || 'bronze')
      })),
      progress: {
        monthlyCredits: consent?.tier?.monthlyCredits || 0,
        monthlyIncidents: consent?.tier?.monthlyIncidents || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get reward values/rates
// @route   GET /api/rewards/rates
// @access  Public
export const getRewardRates = async (req, res) => {
  res.json({
    creditValue: {
      credits: 100,
      usd: 1,
      description: '100 credits = $1 USD'
    },
    incidentRewards: REWARD_VALUES.incident_upload,
    qualityBonuses: REWARD_VALUES.quality_bonus,
    actionBonuses: REWARD_VALUES.action_bonus,
    streakBonuses: REWARD_VALUES.streak_bonus,
    referralRewards: {
      referrer: REWARD_VALUES.referral.referrer_bonus,
      referred: REWARD_VALUES.referral.referred_bonus,
      milestones: REWARD_VALUES.referral.milestones
    }
  });
};

// @desc    Request payout
// @route   POST /api/rewards/payout
// @access  Private
export const requestPayout = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ message: 'Minimum payout is 100 credits ($1)' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method required' });
    }

    const payout = await processPayout(req.user._id, amount, paymentMethod);

    res.status(201).json({
      message: 'Payout request submitted',
      payout: {
        id: payout._id,
        amount: Math.abs(payout.amount),
        amountUSD: (Math.abs(payout.amount) / 100).toFixed(2),
        method: paymentMethod,
        status: payout.status,
        estimatedProcessing: '3-5 business days'
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update payment method
// @route   PUT /api/rewards/payment-method
// @access  Private
export const updatePaymentMethod = async (req, res) => {
  try {
    const { method, details } = req.body;

    if (!['paypal', 'bank', 'crypto', 'gift_card'].includes(method)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    await DataConsent.findOneAndUpdate(
      { user: req.user._id },
      {
        'compensation.paymentMethod': method,
        'compensation.paymentDetails': details
      },
      { upsert: true }
    );

    res.json({ message: 'Payment method updated' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==================== REFERRAL ENDPOINTS ====================

// @desc    Get referral code (generate if needed)
// @route   GET /api/rewards/referral-code
// @access  Private
export const getReferralCode = async (req, res) => {
  try {
    let code = req.user.rewards?.referralCode;

    if (!code) {
      // Generate new code
      const prefix = req.user.username.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
      const random = crypto.randomBytes(3).toString('hex').toUpperCase();
      code = `${prefix}-${random}`;

      await User.findByIdAndUpdate(req.user._id, {
        'rewards.referralCode': code
      });
    }

    const referralLink = `${process.env.APP_URL || 'http://localhost:5173'}/register?ref=${code}`;

    res.json({
      code,
      link: referralLink,
      rewards: {
        referrer: REWARD_VALUES.referral.referrer_bonus,
        referrerUSD: (REWARD_VALUES.referral.referrer_bonus / 100).toFixed(2),
        referred: REWARD_VALUES.referral.referred_bonus,
        referredUSD: (REWARD_VALUES.referral.referred_bonus / 100).toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get referral statistics
// @route   GET /api/rewards/referrals
// @access  Private
export const getReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id })
      .populate('referred', 'username createdAt')
      .sort({ createdAt: -1 });

    const qualifiedCount = referrals.filter(r => r.status === 'rewarded').length;

    // Find next milestone
    const milestones = REWARD_VALUES.referral.milestones;
    const nextMilestone = Object.keys(milestones)
      .map(Number)
      .find(m => m > qualifiedCount);

    res.json({
      referrals: referrals.map(r => ({
        username: r.referred?.username || 'Unknown',
        status: r.status,
        signedUpAt: r.createdAt,
        qualifiedAt: r.qualification?.qualifiedAt,
        progress: {
          incidents: r.qualification?.currentIncidents || 0,
          required: r.qualification?.requiredIncidents || 3
        }
      })),
      stats: {
        total: referrals.length,
        pending: referrals.filter(r => r.status === 'pending').length,
        qualified: qualifiedCount
      },
      milestones: {
        earned: Object.keys(milestones)
          .map(Number)
          .filter(m => m <= qualifiedCount)
          .map(m => ({ count: m, bonus: milestones[m], bonusUSD: (milestones[m] / 100).toFixed(2) })),
        next: nextMilestone ? {
          count: nextMilestone,
          bonus: milestones[nextMilestone],
          bonusUSD: (milestones[nextMilestone] / 100).toFixed(2),
          remaining: nextMilestone - qualifiedCount
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// ==================== LEADERBOARD ENDPOINTS ====================

// @desc    Get leaderboard
// @route   GET /api/rewards/leaderboard
// @access  Public
export const getLeaderboardData = async (req, res) => {
  try {
    const { period = 'monthly', limit = 50 } = req.query;

    const leaderboard = await getLeaderboard(period, parseInt(limit));

    // Get requesting user's rank if authenticated
    let userRank = null;
    if (req.user) {
      userRank = leaderboard.find(e => e.userId.equals(req.user._id));

      // If user not in top, get their rank
      if (!userRank) {
        const userEntry = await Reward.aggregate([
          {
            $match: {
              user: req.user._id,
              status: { $in: ['confirmed', 'paid'] },
              amount: { $gt: 0 }
            }
          },
          {
            $group: {
              _id: '$user',
              totalCredits: { $sum: '$amount' },
              incidentCount: { $sum: { $cond: [{ $eq: ['$type', 'incident_upload'] }, 1, 0] } }
            }
          },
          {
            $project: {
              score: { $add: ['$totalCredits', { $multiply: ['$incidentCount', 10] }] }
            }
          }
        ]);

        if (userEntry.length > 0) {
          // Estimate rank based on score
          const userScore = userEntry[0].score;
          const higherCount = await Reward.aggregate([
            {
              $match: { status: { $in: ['confirmed', 'paid'] }, amount: { $gt: 0 } }
            },
            {
              $group: { _id: '$user', score: { $sum: '$amount' } }
            },
            {
              $match: { score: { $gt: userScore } }
            },
            { $count: 'count' }
          ]);

          userRank = {
            rank: (higherCount[0]?.count || 0) + 1,
            totalCredits: userEntry[0].totalCredits,
            score: userScore
          };
        }
      }
    }

    res.json({
      period,
      lastUpdated: new Date(),
      leaderboard: leaderboard.map(entry => ({
        rank: entry.rank,
        username: entry.username,
        avatar: entry.avatar,
        tier: entry.tier || 'bronze',
        totalCredits: entry.totalCredits,
        totalCreditsUSD: (entry.totalCredits / 100).toFixed(2),
        incidentCount: entry.incidentCount,
        score: entry.score
      })),
      userRank: userRank ? {
        rank: userRank.rank,
        totalCredits: userRank.totalCredits,
        score: userRank.score
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update profile settings
// @route   PUT /api/rewards/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const {
      isGigDriver,
      gigPlatforms,
      averageHoursPerWeek,
      primaryCity,
      primaryState,
      dashCamModel,
      vehicleType,
      showOnLeaderboard,
      publicStats
    } = req.body;

    const updates = {};

    // Validate input types
    if (isGigDriver !== undefined) {
      if (typeof isGigDriver !== 'boolean') return res.status(400).json({ message: 'isGigDriver must be a boolean' });
      updates['profile.isGigDriver'] = isGigDriver;
    }
    if (gigPlatforms) {
      const validPlatforms = ['uber', 'lyft', 'doordash', 'grubhub', 'instacart', 'amazon_flex', 'shipt', 'spark', 'other'];
      if (!Array.isArray(gigPlatforms) || !gigPlatforms.every(p => validPlatforms.includes(p))) {
        return res.status(400).json({ message: 'Invalid gig platform' });
      }
      updates['profile.gigPlatforms'] = gigPlatforms;
    }
    if (averageHoursPerWeek !== undefined) {
      const hours = Number(averageHoursPerWeek);
      if (isNaN(hours) || hours < 0 || hours > 168) return res.status(400).json({ message: 'Invalid hours per week' });
      updates['profile.averageHoursPerWeek'] = hours;
    }
    if (primaryCity) {
      if (typeof primaryCity !== 'string' || primaryCity.length > 100) return res.status(400).json({ message: 'Invalid city' });
      updates['profile.primaryCity'] = primaryCity;
    }
    if (primaryState) {
      if (typeof primaryState !== 'string' || primaryState.length > 50) return res.status(400).json({ message: 'Invalid state' });
      updates['profile.primaryState'] = primaryState;
    }
    if (dashCamModel) {
      if (typeof dashCamModel !== 'string' || dashCamModel.length > 100) return res.status(400).json({ message: 'Invalid dash cam model' });
      updates['profile.dashCamModel'] = dashCamModel;
    }
    if (vehicleType) {
      const validTypes = ['car', 'suv', 'truck', 'van', 'motorcycle', 'bicycle', 'other'];
      if (!validTypes.includes(vehicleType)) return res.status(400).json({ message: 'Invalid vehicle type' });
      updates['profile.vehicleType'] = vehicleType;
    }
    if (showOnLeaderboard !== undefined) updates['rewards.showOnLeaderboard'] = showOnLeaderboard;
    if (publicStats !== undefined) updates['rewards.publicStats'] = publicStats;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );

    res.json({
      profile: user.profile,
      rewards: {
        showOnLeaderboard: user.rewards?.showOnLeaderboard,
        publicStats: user.rewards?.publicStats
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export default {
  getDashboard,
  getHistory,
  getTiers,
  getRewardRates,
  requestPayout,
  updatePaymentMethod,
  getReferralCode,
  getReferrals,
  getLeaderboardData,
  updateProfile
};
