import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

// Models for seeding
import InsurancePartner from './models/InsurancePartner.js';
import DataPartner from './models/DataPartner.js';

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

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io accessible to routes
app.set('io', io);

// Middleware to attach io to all requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Serve reports and exports directories
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

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

// External API routes (v1)
app.use('/api/v1/insurance', insuranceApiRouter);
app.use('/api/v1/marketplace', marketplaceApiRouter);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join violation report room for real-time updates
  socket.on('join-violation', (violationId) => {
    socket.join(`violation-${violationId}`);
    console.log(`Socket ${socket.id} joined room: violation-${violationId}`);
  });

  // Leave violation report room
  socket.on('leave-violation', (violationId) => {
    socket.leave(`violation-${violationId}`);
    console.log(`Socket ${socket.id} left room: violation-${violationId}`);
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
  } catch (error) {
    console.error('Error seeding partners:', error.message);
  }
});

export { io };
