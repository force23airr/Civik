import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import incidentRoutes from './routes/incidents.js';
import alertRoutes from './routes/alerts.js';
import policeRoutes from './routes/police.js';
import policePortalRouter from './routes/policePortal.js';
import insuranceRoutes, { insuranceApiRouter } from './routes/insurance.js';
import analyticsRoutes from './routes/analytics.js';
import marketplaceRoutes, { marketplaceApiRouter } from './routes/marketplace.js';
import plateRoutes from './routes/plates.js';
import rewardRoutes from './routes/rewards.js';
import partnerRoutes from './routes/partners.js';
import violationRoutes from './routes/violations.js';
import parkingViolationRoutes from './routes/parkingViolations.js';
import municipalRoutes from './routes/municipal.js';

// Models for seeding
import InsurancePartner from './models/InsurancePartner.js';
import DataPartner from './models/DataPartner.js';
import MunicipalDepartment from './models/MunicipalDepartment.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());

// Static files — uploads only (reports/exports served through auth routes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
  }
}));

// Make io accessible to routes
app.set('io', io);

// Middleware to attach io to all requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Reports and exports served through authenticated routes only (not public static)

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/police', policeRoutes);
app.use('/api/police-portal', policePortalRouter);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/plates', plateRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/violations', violationRoutes);
app.use('/api/parking-violations', parkingViolationRoutes);
app.use('/api/municipal', municipalRoutes);

// External API routes (v1)
app.use('/api/v1/insurance', insuranceApiRouter);
app.use('/api/v1/marketplace', marketplaceApiRouter);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'userId:', socket.userId);

  // Join violation report room for real-time updates
  socket.on('join-violation', (violationId) => {
    socket.join(`violation-${violationId}`);
  });

  // Leave violation report room
  socket.on('leave-violation', (violationId) => {
    socket.leave(`violation-${violationId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Seed default partners on startup
  try {
    await InsurancePartner.seedDefaults();
    await DataPartner.seedDefaults();
    await MunicipalDepartment.seedDefaults();
  } catch (error) {
    console.error('Error seeding partners:', error.message);
  }
});

export { io };
