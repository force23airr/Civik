import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Extract token from HttpOnly cookie or Authorization header (fallback for Socket.io)
const extractToken = (req) => {
  // Prefer HttpOnly cookie
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  // Fallback to Authorization header (needed for Socket.io and external API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

export const auth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Optional auth - doesn't require authentication but attaches user if token present
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(); // No token, continue without user
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Token invalid or expired, continue without user
    next();
  }
};

export default auth;
