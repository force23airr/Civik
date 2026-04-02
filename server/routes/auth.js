import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import auth from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', auth, getMe);

export default router;
