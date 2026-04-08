import express from 'express';
import { getUserById, updateUser, listUsers, updateUserRole, getAdminStats } from '../controllers/userController.js';
import auth from '../middleware/auth.js';
import admin from '../middleware/admin.js';

const router = express.Router();

// Admin-only routes
router.get('/', admin, listUsers);
router.put('/:id/role', admin, updateUserRole);

// Public / auth routes
router.get('/:id', auth, getUserById);
router.put('/:id', auth, updateUser);

export default router;
