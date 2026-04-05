import express from 'express';
import { auth, optionalAuth } from '../middleware/auth.js';
import {
  getDashboard,
  getHistory,
  getRewardRates,
  requestPayout,
  updatePaymentMethod,
  getReferralCode,
  getReferrals,
  getLeaderboardData,
  updateProfile
} from '../controllers/rewardController.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get reward rates (public info)
router.get('/rates', getRewardRates);

// Leaderboard (optional auth to show user's rank)
router.get('/leaderboard', optionalAuth, getLeaderboardData);

// ==================== AUTHENTICATED ROUTES ====================

// Dashboard and history
router.get('/dashboard', auth, getDashboard);
router.get('/history', auth, getHistory);

// Payout
router.post('/payout', auth, requestPayout);
router.put('/payment-method', auth, updatePaymentMethod);

// Referrals
router.get('/referral-code', auth, getReferralCode);
router.get('/referrals', auth, getReferrals);

// Profile
router.put('/profile', auth, updateProfile);

export default router;
