import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
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
import adminRoutes from './routes/admin.js';

// Models for seeding
import InsurancePartner from './models/InsurancePartner.js';
import DataPartner from './models/DataPartner.js';
import MunicipalDepartment from './models/MunicipalDepartment.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigins = Array.from(new Set([
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : []),
  process.env.APP_URL,
  'http://localhost:5173',
  'https://civik.onrender.com'
].filter(Boolean)));

const extractSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  const cookieHeader = socket.handshake.headers?.cookie;
  if (!cookieHeader) return null;

  const tokenCookie = cookieHeader
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('token='));

  return tokenCookie ? decodeURIComponent(tokenCookie.slice('token='.length)) : null;
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// Uploads served through authenticated route — no public static access
// This prevents unauthenticated users from accessing evidence files by URL
app.use('/uploads', async (req, res, next) => {
  try {
    const cookieToken = req.cookies?.token;
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    const token = cookieToken || headerToken || req.query.token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const jwt = await import('jsonwebtoken');
    jwt.default.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Authentication required' });
  }
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'private, no-cache');
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
app.use('/api/admin', adminRoutes);

// External API routes (v1)
app.use('/api/v1/insurance', insuranceApiRouter);
app.use('/api/v1/marketplace', marketplaceApiRouter);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = extractSocketToken(socket);
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

  // Join violation report room for real-time updates (validate input)
  socket.on('join-violation', (violationId) => {
    if (typeof violationId === 'string' && /^[a-f\d]{24}$/i.test(violationId)) {
      socket.join(`violation-${violationId}`);
    }
  });

  // Leave violation report room (validate input)
  socket.on('leave-violation', (violationId) => {
    if (typeof violationId === 'string' && /^[a-f\d]{24}$/i.test(violationId)) {
      socket.leave(`violation-${violationId}`);
    }
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
