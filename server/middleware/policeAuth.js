import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PoliceStation from '../models/PoliceStation.js';

// Verify user is a police officer
export const requirePoliceOfficer = async (req, res, next) => {
  try {
    // First check standard auth
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.role !== 'police_officer') {
      return res.status(403).json({ error: 'Police officer access required' });
    }

    // Check if officer's department has portal enabled
    const department = await PoliceStation.findById(user.policeProfile?.department);
    if (!department || !department.portalEnabled) {
      return res.status(403).json({ error: 'Department portal access not enabled' });
    }

    // Check if officer is active
    if (!user.policeProfile?.isActive) {
      return res.status(403).json({ error: 'Officer account is inactive' });
    }

    req.user = user;
    req.department = department;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Verify officer is portal admin — properly chains after requirePoliceOfficer
export const requirePortalAdmin = [
  requirePoliceOfficer,
  (req, res, next) => {
    const isAdmin = req.department.portalAdmins.some(
      adminId => adminId.toString() === req.user._id.toString()
    );

    if (!isAdmin) {
      return res.status(403).json({ error: 'Portal admin access required' });
    }

    next();
  }
];
