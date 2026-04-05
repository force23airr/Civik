import User from '../models/User.js';
import Incident from '../models/Incident.js';
import ParkingViolation from '../models/ParkingViolation.js';
import MunicipalReport from '../models/MunicipalReport.js';
import Reward from '../models/Reward.js';

// @desc    Get user by ID
// @route   GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
export const updateUser = async (req, res) => {
  try {
    // Check if user is updating their own profile
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    const { username, avatar } = req.body;
    const updateFields = {};

    if (username) {
      // Check if username is taken
      const existingUser = await User.findOne({ username, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateFields.username = username;
    }

    if (avatar !== undefined) {
      updateFields.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    List all users (admin only)
// @route   GET /api/users
export const listUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      filter.$or = [
        { username: searchRegex },
        { email: searchRegex }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('_id username email role avatar createdAt rewards.creditsBalance rewards.lifetimeCredits')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Change user role (admin only)
// @route   PUT /api/users/:id/role
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'admin', 'police_officer', 'municipal_worker', 'moderator'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Prevent admins from demoting themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalIncidents,
      totalParkingViolations,
      totalMunicipalReports,
      rewardsAgg,
      usersByRole,
      incidentsByStatus
    ] = await Promise.all([
      User.countDocuments(),
      Incident.countDocuments(),
      ParkingViolation.countDocuments(),
      MunicipalReport.countDocuments(),
      Reward.aggregate([
        { $match: { status: { $in: ['confirmed', 'paid'] } } },
        { $group: { _id: null, totalAwarded: { $sum: '$amount' } } }
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Incident.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    // Convert aggregation arrays to objects
    const roleBreakdown = {};
    for (const entry of usersByRole) {
      roleBreakdown[entry._id] = entry.count;
    }

    const statusBreakdown = {};
    for (const entry of incidentsByStatus) {
      statusBreakdown[entry._id] = entry.count;
    }

    res.json({
      totalUsers,
      totalIncidents,
      totalParkingViolations,
      totalMunicipalReports,
      totalRewardsAwarded: rewardsAgg[0]?.totalAwarded || 0,
      usersByRole: roleBreakdown,
      incidentsByStatus: statusBreakdown
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};
