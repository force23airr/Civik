import InsurancePartner from '../models/InsurancePartner.js';
import DataPartner from '../models/DataPartner.js';
import UserPartnerConnection from '../models/UserPartnerConnection.js';

/**
 * Get all insurance partners
 * GET /api/partners/insurance
 */
export const getInsurancePartners = async (req, res) => {
  try {
    const { search, featured } = req.query;

    const query = { isActive: true };

    if (featured === 'true') {
      query.isFeatured = true;
    }

    let partners;
    if (search && typeof search === 'string' && search.length <= 100) {
      partners = await InsurancePartner.find({
        ...query,
        $text: { $search: search }
      }).sort({ displayOrder: 1 });
    } else {
      partners = await InsurancePartner.find(query).sort({ displayOrder: 1 });
    }

    res.json({ partners });
  } catch (error) {
    console.error('Error fetching insurance partners:', error);
    res.status(500).json({ message: 'Failed to fetch insurance partners' });
  }
};

/**
 * Get all data partners
 * GET /api/partners/data
 */
export const getDataPartners = async (req, res) => {
  try {
    const { category, featured, search } = req.query;

    const query = { isActive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    let partners;
    if (search) {
      partners = await DataPartner.find({
        ...query,
        $text: { $search: search }
      }).sort({ isFeatured: -1, displayOrder: 1 });
    } else {
      partners = await DataPartner.find(query).sort({ isFeatured: -1, displayOrder: 1 });
    }

    // If user is authenticated, add connection status
    if (req.user) {
      const connections = await UserPartnerConnection.find({
        user: req.user._id,
        partnerType: 'data',
        status: { $ne: 'disconnected' }
      });

      const connectionMap = new Map(
        connections.map(c => [c.partner.toString(), c])
      );

      partners = partners.map(partner => {
        const connection = connectionMap.get(partner._id.toString());
        return {
          ...partner.toObject(),
          isConnected: !!connection,
          connectionStatus: connection?.status || null,
          userEarnings: connection?.earnings?.total || 0
        };
      });
    }

    res.json({ partners });
  } catch (error) {
    console.error('Error fetching data partners:', error);
    res.status(500).json({ message: 'Failed to fetch data partners' });
  }
};

/**
 * Get single data partner details
 * GET /api/partners/data/:id
 */
export const getDataPartnerById = async (req, res) => {
  try {
    const partner = await DataPartner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    let connection = null;
    if (req.user) {
      connection = await UserPartnerConnection.findOne({
        user: req.user._id,
        partner: partner._id,
        status: { $ne: 'disconnected' }
      });
    }

    res.json({
      partner,
      isConnected: !!connection,
      connection: connection || null
    });
  } catch (error) {
    console.error('Error fetching partner:', error);
    res.status(500).json({ message: 'Failed to fetch partner' });
  }
};

/**
 * Connect to a data partner
 * POST /api/partners/data/:id/connect
 */
export const connectToDataPartner = async (req, res) => {
  try {
    const { enabledTypes, allowRealTimeStreaming } = req.body;

    const partner = await DataPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Check if already connected
    let connection = await UserPartnerConnection.findOne({
      user: req.user._id,
      partner: partner._id
    });

    if (connection && connection.status !== 'disconnected') {
      return res.status(400).json({ message: 'Already connected to this partner' });
    }

    // Create or update connection
    if (connection) {
      // Reconnecting
      connection.status = 'active';
      connection.connectedAt = new Date();
      connection.disconnectedAt = null;
      connection.dataSharing.enabledTypes = enabledTypes || partner.dataInterests.map(d => d.type);
      connection.dataSharing.allowRealTimeStreaming = allowRealTimeStreaming || false;
    } else {
      connection = new UserPartnerConnection({
        user: req.user._id,
        partner: partner._id,
        partnerModel: 'DataPartner',
        partnerType: 'data',
        status: 'active',
        dataSharing: {
          enabledTypes: enabledTypes || partner.dataInterests.map(d => d.type),
          allowRealTimeStreaming: allowRealTimeStreaming || false
        }
      });
    }

    await connection.save();

    // Update partner stats
    partner.stats.activeDrivers = await UserPartnerConnection.getPartnerActiveCount(partner._id);
    await partner.save();

    res.json({
      message: 'Successfully connected to partner',
      connection
    });
  } catch (error) {
    console.error('Error connecting to partner:', error);
    res.status(500).json({ message: 'Failed to connect to partner' });
  }
};

/**
 * Disconnect from a data partner
 * DELETE /api/partners/data/:id/disconnect
 */
export const disconnectFromDataPartner = async (req, res) => {
  try {
    const connection = await UserPartnerConnection.findOne({
      user: req.user._id,
      partner: req.params.id,
      status: { $ne: 'disconnected' }
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    await connection.disconnect();

    // Update partner stats
    const partner = await DataPartner.findById(req.params.id);
    if (partner) {
      partner.stats.activeDrivers = await UserPartnerConnection.getPartnerActiveCount(partner._id);
      await partner.save();
    }

    res.json({ message: 'Successfully disconnected from partner' });
  } catch (error) {
    console.error('Error disconnecting from partner:', error);
    res.status(500).json({ message: 'Failed to disconnect from partner' });
  }
};

/**
 * Update data sharing preferences for a partner
 * PUT /api/partners/data/:id/preferences
 */
export const updatePartnerPreferences = async (req, res) => {
  try {
    const { enabledTypes, allowRealTimeStreaming } = req.body;

    const connection = await UserPartnerConnection.findOne({
      user: req.user._id,
      partner: req.params.id,
      status: { $ne: 'disconnected' }
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    if (enabledTypes) {
      connection.dataSharing.enabledTypes = enabledTypes;
    }
    if (allowRealTimeStreaming !== undefined) {
      connection.dataSharing.allowRealTimeStreaming = allowRealTimeStreaming;
    }

    await connection.save();

    res.json({ message: 'Preferences updated', connection });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
};

/**
 * Get user's partner connections
 * GET /api/partners/my-connections
 */
export const getMyConnections = async (req, res) => {
  try {
    const { type } = req.query; // 'data', 'insurance', or all

    const query = {
      user: req.user._id,
      status: { $ne: 'disconnected' }
    };

    if (type) {
      query.partnerType = type;
    }

    const connections = await UserPartnerConnection.find(query)
      .populate('partner')
      .sort({ connectedAt: -1 });

    // Get total earnings
    const totals = await UserPartnerConnection.getUserTotalEarnings(req.user._id);

    res.json({
      connections,
      totals
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ message: 'Failed to fetch connections' });
  }
};

/**
 * Get partner categories with counts
 * GET /api/partners/categories
 */
export const getPartnerCategories = async (req, res) => {
  try {
    const categories = await DataPartner.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const categoryNames = {
      ai_autonomous: 'AI & Autonomous Vehicles',
      mapping: 'Mapping & Navigation',
      insurance: 'Insurance',
      government: 'Government & DOT',
      research: 'Research & Academia',
      weather: 'Weather Services',
      infrastructure: 'Infrastructure',
      other: 'Other'
    };

    const result = categories.map(c => ({
      code: c._id,
      name: categoryNames[c._id] || c._id,
      count: c.count
    }));

    res.json({ categories: result });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

/**
 * Seed default partners (admin only or on first run)
 * POST /api/partners/seed
 */
export const seedPartners = async (req, res) => {
  try {
    await InsurancePartner.seedDefaults();
    await DataPartner.seedDefaults();

    res.json({ message: 'Partners seeded successfully' });
  } catch (error) {
    console.error('Error seeding partners:', error);
    res.status(500).json({ message: 'Failed to seed partners' });
  }
};

export default {
  getInsurancePartners,
  getDataPartners,
  getDataPartnerById,
  connectToDataPartner,
  disconnectFromDataPartner,
  updatePartnerPreferences,
  getMyConnections,
  getPartnerCategories,
  seedPartners
};
