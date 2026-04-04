import express from 'express';
import { getAdminStats } from '../controllers/userController.js';
import admin from '../middleware/admin.js';

const router = express.Router();

router.get('/stats', admin, getAdminStats);

export default router;
