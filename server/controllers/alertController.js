import Alert from '../models/Alert.js';

// @desc    Get all active alerts
// @route   GET /api/alerts
export const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({
      isActive: true,
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'username avatar')
      .populate({
        path: 'incident',
        select: 'title type severity location',
        populate: { path: 'user', select: 'username' }
      })
      .sort({ createdAt: -1 });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create alert
// @route   POST /api/alerts
export const createAlert = async (req, res) => {
  try {
    const { incidentId, message, radius, expiresIn } = req.body;

    if (!incidentId) {
      return res.status(400).json({ message: 'Incident ID is required' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Alert message is required' });
    }
    if (message.length > 500) {
      return res.status(400).json({ message: 'Alert message must be 500 characters or less' });
    }
    if (radius !== undefined) {
      const parsedRadius = Number(radius);
      if (isNaN(parsedRadius) || parsedRadius < 1 || parsedRadius > 100) {
        return res.status(400).json({ message: 'Radius must be between 1 and 100 kilometers' });
      }
    }
    if (expiresIn !== undefined) {
      const parsedExpires = Number(expiresIn);
      if (isNaN(parsedExpires) || parsedExpires < 1 || parsedExpires > 168) {
        return res.status(400).json({ message: 'Expiration must be between 1 and 168 hours' });
      }
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) // hours to ms
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // default 24 hours

    const alert = await Alert.create({
      incident: incidentId,
      user: req.user._id,
      message,
      radius: radius || 10,
      expiresAt
    });

    await alert.populate('user', 'username avatar');
    await alert.populate({
      path: 'incident',
      select: 'title type severity location',
      populate: { path: 'user', select: 'username' }
    });

    // Emit real-time alert to all connected clients
    const io = req.app.get('io');
    io.emit('new-alert', alert);

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
export const deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Check ownership
    if (alert.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this alert' });
    }

    await alert.deleteOne();

    // Emit alert deletion to all connected clients
    const io = req.app.get('io');
    io.emit('delete-alert', req.params.id);

    res.json({ message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Deactivate expired alerts (could be run as a cron job)
export const deactivateExpiredAlerts = async () => {
  try {
    await Alert.updateMany(
      { isActive: true, expiresAt: { $lte: new Date() } },
      { isActive: false }
    );
  } catch (error) {
    console.error('Error deactivating expired alerts:', error);
  }
};
