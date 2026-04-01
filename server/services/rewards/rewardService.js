import Reward from '../../models/Reward.js';
import RewardTier from '../../models/RewardTier.js';
import DataConsent from '../../models/DataConsent.js';
import User from '../../models/User.js';
import Incident from '../../models/Incident.js';
import mongoose from 'mongoose';

// Credit values for different actions (100 credits = $1 USD)
export const REWARD_VALUES = {
  // Base incident rewards by type
  incident_upload: {
    dangerous_driving: 10,
    crime: 15,
    security: 10,
    other: 5,
    // Infrastructure
    infrastructure_pothole: 5,
    infrastructure_road_damage: 8,
    infrastructure_construction: 5,
    infrastructure_signage: 6,
    infrastructure_lighting: 5,
    // Weather
    weather_flooding: 12,
    weather_ice: 12,
    weather_debris: 8,
    weather_visibility: 10,
    weather_obstruction: 8,
    // Traffic
    traffic_congestion: 3,
    traffic_accident: 10,
    traffic_closure: 7,
    traffic_signal_issue: 6,
    traffic_unusual_pattern: 5
  },

  // Quality bonuses
  quality_bonus: {
    has_video: 5,
    has_gps: 3,
    clear_footage: 5,
    community_verified: 10
  },

  // Action bonuses
  action_bonus: {
    police_report: 25,
    insurance_claim: 30
  },

  // Parking violation bounties (paid when police approve)
  parking_violation_bounty: {
    fire_hydrant: 500,        // $5
    handicap_zone: 750,       // $7.50
    no_parking_zone: 250,     // $2.50
    double_parked: 300,       // $3
    blocking_driveway: 400,   // $4
    blocking_crosswalk: 500,  // $5
    blocking_bike_lane: 300,  // $3
    blocking_sidewalk: 300,   // $3
    expired_meter: 100,       // $1
    overnight_parking: 100,   // $1
    street_cleaning: 150,     // $1.50
    fire_lane: 750,           // $7.50
    bus_stop: 400,            // $4
    loading_zone: 150,        // $1.50
    red_curb: 250,            // $2.50
    yellow_curb: 150,         // $1.50
    too_close_to_intersection: 300, // $3
    wrong_direction: 200,     // $2
    abandoned_vehicle: 500,   // $5
    other: 200                // $2
  },

  // Referral rewards
  referral: {
    referrer_bonus: 500,    // $5 for referrer
    referred_bonus: 250,    // $2.50 welcome bonus
    milestones: {
      5: 1000,              // $10 at 5 referrals
      10: 2500,             // $25 at 10
      25: 7500,             // $75 at 25
      50: 20000,            // $200 at 50
      100: 50000            // $500 at 100
    }
  },

  // Streak bonuses
  streak_bonus: {
    7: 50,                  // 7-day streak
    14: 150,                // 14-day streak
    30: 500,                // 30-day streak
    60: 1500,               // 60-day streak
    90: 3000                // 90-day streak
  }
};

/**
 * Award credits for an incident upload
 */
export async function awardIncidentCredits(incident, userId) {
  try {
    // Get base amount for incident type
    const baseAmount = REWARD_VALUES.incident_upload[incident.type] || 5;

    // Get user's consent record for tier multiplier
    let consent = await DataConsent.findOne({ user: userId });
    if (!consent) {
      // Create consent record if doesn't exist
      consent = await DataConsent.create({ user: userId });
    }

    const tierMultiplier = consent.tier?.multiplier || 1.0;

    // Calculate quality bonuses
    let qualityBonus = 0;
    const qualityFactors = [];

    if (incident.mediaFiles?.some(f => f.mimetype?.startsWith('video'))) {
      qualityBonus += REWARD_VALUES.quality_bonus.has_video;
      qualityFactors.push({ type: 'quality', value: REWARD_VALUES.quality_bonus.has_video, description: 'Video included' });
    }

    if (incident.location?.lat && incident.location?.lng) {
      qualityBonus += REWARD_VALUES.quality_bonus.has_gps;
      qualityFactors.push({ type: 'quality', value: REWARD_VALUES.quality_bonus.has_gps, description: 'GPS location' });
    }

    // Calculate streak bonus
    const streakBonus = await calculateStreakBonus(userId, consent);

    // Calculate final amount
    const multipliedBase = Math.round((baseAmount + qualityBonus) * tierMultiplier);
    const finalAmount = multipliedBase + streakBonus;

    // Create reward record
    const reward = await Reward.create({
      user: userId,
      type: 'incident_upload',
      baseAmount,
      bonusAmount: qualityBonus + streakBonus,
      amount: finalAmount,
      finalAmount,
      status: 'confirmed',
      source: { entityType: 'incident', entityId: incident._id },
      multipliers: [
        { type: 'tier', value: tierMultiplier, description: `${consent.tier?.current || 'bronze'} tier` },
        ...qualityFactors
      ],
      description: `Reward for reporting ${incident.type.replace(/_/g, ' ')} incident`
    });

    // Update incident rewards
    incident.rewards = {
      baseCredits: baseAmount,
      bonusCredits: qualityBonus + streakBonus,
      totalCredits: finalAmount,
      rewardId: reward._id,
      awardedAt: new Date()
    };

    // Update data quality factors
    incident.dataQuality = {
      score: calculateQualityScore(incident),
      factors: {
        hasVideo: incident.mediaFiles?.some(f => f.mimetype?.startsWith('video')) || false,
        hasGPS: !!(incident.location?.lat && incident.location?.lng),
        hasTimestamp: true,
        isClearFootage: false,
        isVerified: false,
        communityScore: 0
      }
    };

    await incident.save();

    // Update user balances
    await updateUserBalance(userId, finalAmount);

    // Update monthly tracking
    consent.tier.monthlyCredits = (consent.tier.monthlyCredits || 0) + finalAmount;
    consent.tier.monthlyIncidents = (consent.tier.monthlyIncidents || 0) + 1;
    await consent.save();

    // Check tier upgrade
    await checkTierUpgrade(userId);

    return reward;
  } catch (error) {
    console.error('[RewardService] Error awarding incident credits:', error);
    throw error;
  }
}

/**
 * Award bonus for police report
 */
export async function awardPoliceReportBonus(incidentId, userId) {
  try {
    const amount = REWARD_VALUES.action_bonus.police_report;
    const consent = await DataConsent.findOne({ user: userId });
    const multiplier = consent?.tier?.multiplier || 1.0;
    const finalAmount = Math.round(amount * multiplier);

    const reward = await Reward.create({
      user: userId,
      type: 'police_report',
      baseAmount: amount,
      amount: finalAmount,
      finalAmount,
      status: 'confirmed',
      source: { entityType: 'police_report', entityId: incidentId },
      multipliers: [{ type: 'tier', value: multiplier }],
      description: 'Bonus for submitting police report'
    });

    await updateUserBalance(userId, finalAmount);
    return reward;
  } catch (error) {
    console.error('[RewardService] Error awarding police report bonus:', error);
    throw error;
  }
}

/**
 * Award bonus for insurance claim
 */
export async function awardInsuranceClaimBonus(claimId, userId) {
  try {
    const amount = REWARD_VALUES.action_bonus.insurance_claim;
    const consent = await DataConsent.findOne({ user: userId });
    const multiplier = consent?.tier?.multiplier || 1.0;
    const finalAmount = Math.round(amount * multiplier);

    const reward = await Reward.create({
      user: userId,
      type: 'insurance_claim',
      baseAmount: amount,
      amount: finalAmount,
      finalAmount,
      status: 'confirmed',
      source: { entityType: 'insurance_claim', entityId: claimId },
      multipliers: [{ type: 'tier', value: multiplier }],
      description: 'Bonus for filing insurance claim'
    });

    await updateUserBalance(userId, finalAmount);
    return reward;
  } catch (error) {
    console.error('[RewardService] Error awarding insurance claim bonus:', error);
    throw error;
  }
}

/**
 * Calculate and apply streak bonus
 */
async function calculateStreakBonus(userId, consent) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastDate = consent.streaks?.lastContributionDate;

  if (!lastDate) {
    // First contribution
    consent.streaks = {
      currentDailyStreak: 1,
      longestDailyStreak: 1,
      lastContributionDate: today,
      weeklyContributions: 1
    };
    return 0;
  }

  const lastContrib = new Date(lastDate);
  lastContrib.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today - lastContrib) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    // Already contributed today
    return 0;
  } else if (daysDiff === 1) {
    // Consecutive day
    consent.streaks.currentDailyStreak += 1;
    consent.streaks.lastContributionDate = today;

    if (consent.streaks.currentDailyStreak > consent.streaks.longestDailyStreak) {
      consent.streaks.longestDailyStreak = consent.streaks.currentDailyStreak;
    }

    // Check streak milestones
    const streak = consent.streaks.currentDailyStreak;
    const bonus = REWARD_VALUES.streak_bonus[streak];

    if (bonus && (!consent.streaks.lastStreakBonusAt ||
        consent.streaks.lastStreakBonusAt < today)) {
      consent.streaks.lastStreakBonusAt = today;
      return bonus;
    }
  } else {
    // Streak broken
    consent.streaks.currentDailyStreak = 1;
    consent.streaks.lastContributionDate = today;
  }

  return 0;
}

/**
 * Calculate quality score for incident
 */
function calculateQualityScore(incident) {
  let score = 50; // Base score

  if (incident.mediaFiles?.some(f => f.mimetype?.startsWith('video'))) score += 15;
  if (incident.mediaFiles?.length > 1) score += 5;
  if (incident.location?.lat && incident.location?.lng) score += 10;
  if (incident.location?.city && incident.location?.state) score += 5;
  if (incident.description?.length > 100) score += 5;
  if (incident.detectedPlates?.length > 0) score += 10;

  return Math.min(score, 100);
}

/**
 * Update user balance across models
 */
export async function updateUserBalance(userId, amount) {
  // Update DataConsent
  await DataConsent.findOneAndUpdate(
    { user: userId },
    {
      $inc: {
        'compensation.creditsEarned': amount,
        'compensation.lifetimeEarnings': amount
      }
    },
    { upsert: true }
  );

  // Update User model for quick access
  await User.findByIdAndUpdate(userId, {
    $inc: {
      'rewards.creditsBalance': amount,
      'rewards.lifetimeCredits': amount
    }
  });
}

/**
 * Check and update user tier
 */
export async function checkTierUpgrade(userId) {
  const consent = await DataConsent.findOne({ user: userId });
  if (!consent) return;

  const monthlyCredits = consent.tier?.monthlyCredits || 0;
  const monthlyIncidents = consent.tier?.monthlyIncidents || 0;

  const newTier = await RewardTier.calculateTier(monthlyCredits, monthlyIncidents);

  if (newTier && newTier.name !== consent.tier?.current) {
    const oldTier = consent.tier?.current || 'bronze';

    consent.tier.current = newTier.name;
    consent.tier.multiplier = newTier.benefits.creditMultiplier;

    // Add to tier history
    if (!consent.tier.tierHistory) consent.tier.tierHistory = [];

    // Mark old tier as lost
    const lastHistory = consent.tier.tierHistory[consent.tier.tierHistory.length - 1];
    if (lastHistory && !lastHistory.lostAt) {
      lastHistory.lostAt = new Date();
    }

    // Add new tier
    consent.tier.tierHistory.push({
      tier: newTier.name,
      achievedAt: new Date()
    });

    await consent.save();

    // Update user model
    await User.findByIdAndUpdate(userId, {
      'rewards.currentTier': newTier.name
    });

    console.log(`[RewardService] User ${userId} tier changed: ${oldTier} -> ${newTier.name}`);
  }
}

/**
 * Award bounty for an approved parking violation report
 */
export async function awardParkingViolationBounty(parkingViolationId, userId, violationType) {
  try {
    const baseAmount = REWARD_VALUES.parking_violation_bounty[violationType] || 200;
    const consent = await DataConsent.findOne({ user: userId });
    const multiplier = consent?.tier?.multiplier || 1.0;
    const finalAmount = Math.round(baseAmount * multiplier);

    const reward = await Reward.create({
      user: userId,
      type: 'parking_violation_approved',
      baseAmount,
      amount: finalAmount,
      finalAmount,
      status: 'confirmed',
      source: { entityType: 'parking_violation', entityId: parkingViolationId },
      multipliers: [{ type: 'tier', value: multiplier, description: `${consent?.tier?.current || 'bronze'} tier` }],
      description: `Bounty for approved parking violation report (${violationType.replace(/_/g, ' ')})`
    });

    await updateUserBalance(userId, finalAmount);

    // Update tier tracking
    if (consent) {
      consent.tier.monthlyCredits = (consent.tier.monthlyCredits || 0) + finalAmount;
      await consent.save();
    }

    await checkTierUpgrade(userId);

    console.log(`[RewardService] Parking bounty awarded: ${finalAmount} credits to user ${userId}`);
    return reward;
  } catch (error) {
    console.error('[RewardService] Error awarding parking violation bounty:', error);
    throw error;
  }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(period = 'monthly', limit = 50) {
  const startDate = getLeaderboardPeriodStart(period);

  const leaderboard = await Reward.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: { $in: ['confirmed', 'paid'] },
        amount: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$user',
        totalCredits: { $sum: '$amount' },
        incidentCount: {
          $sum: { $cond: [{ $eq: ['$type', 'incident_upload'] }, 1, 0] }
        },
        referralCount: {
          $sum: { $cond: [{ $eq: ['$type', 'referral_bonus'] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $match: { 'user.rewards.showOnLeaderboard': { $ne: false } }
    },
    {
      $project: {
        userId: '$_id',
        username: '$user.username',
        avatar: '$user.avatar',
        tier: '$user.rewards.currentTier',
        totalCredits: 1,
        incidentCount: 1,
        referralCount: 1,
        score: {
          $add: [
            '$totalCredits',
            { $multiply: ['$incidentCount', 10] }
          ]
        }
      }
    },
    { $sort: { score: -1 } },
    { $limit: limit }
  ]);

  // Add ranks
  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

function getLeaderboardPeriodStart(period) {
  const now = new Date();
  switch (period) {
    case 'weekly':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'alltime':
      return new Date(0);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

/**
 * Process payout request
 */
export async function processPayout(userId, amount, paymentMethod) {
  const consent = await DataConsent.findOne({ user: userId });
  if (!consent) throw new Error('No consent record found');

  const availableBalance = consent.compensation.creditsEarned -
                          consent.compensation.creditsRedeemed;

  if (amount > availableBalance) {
    throw new Error('Insufficient balance');
  }

  // Get tier for minimum threshold
  const tier = await RewardTier.findOne({ name: consent.tier?.current || 'bronze' });
  const minPayout = tier?.benefits?.reducedPayoutThreshold || 5000;

  if (amount < minPayout) {
    throw new Error(`Minimum payout is ${minPayout} credits ($${minPayout / 100})`);
  }

  // Create payout record (negative amount)
  const reward = await Reward.create({
    user: userId,
    type: 'payout_redemption',
    amount: -amount,
    status: 'processing',
    payout: {
      method: paymentMethod,
      netAmount: amount - Math.round(amount * 0.02) // 2% processing fee
    },
    description: `Payout of ${amount} credits via ${paymentMethod}`
  });

  // Update balances
  consent.compensation.creditsPending += amount;
  await consent.save();

  return reward;
}

export default {
  REWARD_VALUES,
  awardIncidentCredits,
  awardPoliceReportBonus,
  awardInsuranceClaimBonus,
  awardParkingViolationBounty,
  updateUserBalance,
  checkTierUpgrade,
  getLeaderboard,
  processPayout
};
