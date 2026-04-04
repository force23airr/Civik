import PoliceStation from '../models/PoliceStation.js';
import Incident from '../models/Incident.js';
import User from '../models/User.js';
import { generatePoliceReport } from '../services/pdf/pdfGenerator.js';
import { sendPoliceReport } from '../services/email/emailService.js';
import { v4 as uuidv4 } from 'uuid';

// @desc    Get all police stations
// @route   GET /api/police/stations
// @access  Public
export const getPoliceStations = async (req, res) => {
  try {
    const { city, state, isActive = 'true', limit = 50, page = 1 } = req.query;

    const query = {};
    if (city) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query['address.city'] = new RegExp(escapedCity, 'i');
    }
    if (state) {
      const escapedState = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query['address.state'] = new RegExp(escapedState, 'i');
    }
    if (isActive !== 'all') query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [stations, total] = await Promise.all([
      PoliceStation.find(query)
        .sort({ 'address.state': 1, 'address.city': 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PoliceStation.countDocuments(query)
    ]);

    res.json({
      stations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get single police station
// @route   GET /api/police/stations/:id
// @access  Public
export const getPoliceStationById = async (req, res) => {
  try {
    const station = await PoliceStation.findById(req.params.id);

    if (!station) {
      return res.status(404).json({ message: 'Police station not found' });
    }

    res.json(station);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Find nearby police stations
// @route   GET /api/police/stations/nearby
// @access  Public
export const getNearbyStations = async (req, res) => {
  try {
    const { lat, lng, radiusKm = 50, limit = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radius = parseFloat(radiusKm);

    // Simple distance calculation (not using geospatial index for simplicity)
    // For production, you'd want to use MongoDB's $geoNear
    const stations = await PoliceStation.find({ isActive: true });

    const stationsWithDistance = stations.map(station => {
      if (!station.location?.lat || !station.location?.lng) {
        return { ...station.toObject(), distance: Infinity };
      }

      const distance = calculateDistance(
        latitude, longitude,
        station.location.lat, station.location.lng
      );

      return { ...station.toObject(), distance };
    })
      .filter(s => s.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));

    res.json(stationsWithDistance);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create police station (Admin only)
// @route   POST /api/police/stations
// @access  Admin
export const createPoliceStation = async (req, res) => {
  try {
    const station = await PoliceStation.create(req.body);
    res.status(201).json(station);
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Update police station (Admin only)
// @route   PUT /api/police/stations/:id
// @access  Admin
export const updatePoliceStation = async (req, res) => {
  try {
    const station = await PoliceStation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!station) {
      return res.status(404).json({ message: 'Police station not found' });
    }

    res.json(station);
  } catch (error) {
    res.status(400).json({ message: 'Invalid request' });
  }
};

// @desc    Delete police station (Admin only)
// @route   DELETE /api/police/stations/:id
// @access  Admin
export const deletePoliceStation = async (req, res) => {
  try {
    const station = await PoliceStation.findByIdAndDelete(req.params.id);

    if (!station) {
      return res.status(404).json({ message: 'Police station not found' });
    }

    res.json({ message: 'Police station deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Generate and send police report for an incident
// @route   POST /api/incidents/:id/police-report
// @access  Private
export const createPoliceReport = async (req, res) => {
  try {
    const { policeStationId, method = 'email', anonymize = false } = req.body;

    const incident = await Incident.findById(req.params.id).populate('user', 'username email');

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check ownership
    if (incident.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to create report for this incident' });
    }

    let policeStation = null;
    if (policeStationId) {
      policeStation = await PoliceStation.findById(policeStationId);
      if (!policeStation) {
        return res.status(404).json({ message: 'Police station not found' });
      }
    }

    // Generate PDF report
    const pdfResult = await generatePoliceReport(incident, policeStation, {
      anonymize,
      baseUrl: process.env.BASE_URL || 'http://localhost:5000'
    });

    const reportId = pdfResult.reportId;

    // Create report record
    const reportRecord = {
      policeStation: policeStationId || null,
      reportId,
      sentAt: new Date(),
      method,
      status: 'pending',
      pdfPath: pdfResult.path
    };

    // Send via email if requested and police station provided
    if (method === 'email' && policeStation) {
      try {
        const emailResult = await sendPoliceReport(
          policeStation,
          incident,
          pdfResult.filepath,
          { reportId }
        );

        reportRecord.status = emailResult.success ? 'sent' : 'failed';
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        reportRecord.status = 'failed';
      }
    } else if (method === 'download') {
      reportRecord.status = 'sent';
    }

    // Save report to incident
    incident.policeReports.push(reportRecord);
    await incident.save();

    res.status(201).json({
      message: method === 'email' && policeStation
        ? 'Report generated and sent to police station'
        : 'Report generated successfully',
      report: {
        reportId,
        pdfPath: pdfResult.path,
        method,
        status: reportRecord.status,
        policeStation: policeStation ? {
          id: policeStation._id,
          name: policeStation.name,
          email: policeStation.email
        } : null
      }
    });
  } catch (error) {
    console.error('Police report error:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get police reports for an incident
// @route   GET /api/incidents/:id/police-reports
// @access  Private
export const getIncidentPoliceReports = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('policeReports.policeStation', 'name jurisdiction email');

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view reports for this incident' });
    }

    res.json(incident.policeReports || []);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Get single police report
// @route   GET /api/incidents/:id/police-report/:reportId
// @access  Private
export const getPoliceReport = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const report = incident.policeReports.find(r => r.reportId === req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Enable police portal for a department (Admin only)
// @route   PUT /api/police/stations/:id/enable-portal
// @access  Admin
export const enableDepartmentPortal = async (req, res) => {
  try {
    const department = await PoliceStation.findById(req.params.id);

    if (!department) {
      return res.status(404).json({ message: 'Police station not found' });
    }

    department.portalEnabled = true;
    await department.save();

    res.json({
      success: true,
      message: 'Police portal enabled successfully',
      department
    });
  } catch (error) {
    res.status(500).json({ message: 'An error occurred' });
  }
};

// @desc    Create police officer account (Admin only)
// @route   POST /api/police/officers
// @access  Admin
export const createPoliceOfficer = async (req, res) => {
  try {
    const { username, email, password, departmentId, badgeNumber, rank, division } = req.body;

    // Validate department exists
    const department = await PoliceStation.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Police station not found' });
    }

    // Create user with police_officer role
    const user = new User({
      username,
      email,
      password, // Will be hashed by User model pre-save hook
      role: 'police_officer',
      policeProfile: {
        department: departmentId,
        badgeNumber,
        rank,
        division,
        isActive: true
      }
    });

    await user.save();

    // Add officer to department's officers array
    department.officers.push({
      user: user._id,
      badgeNumber,
      rank,
      division
    });
    await department.save();

    res.status(201).json({
      success: true,
      message: 'Police officer account created successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        policeProfile: user.policeProfile,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ message: 'Email or username already exists' });
    }
    res.status(500).json({ message: 'An error occurred' });
  }
};

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

export default {
  getPoliceStations,
  getPoliceStationById,
  getNearbyStations,
  createPoliceStation,
  updatePoliceStation,
  deletePoliceStation,
  createPoliceReport,
  getIncidentPoliceReports,
  getPoliceReport,
  enableDepartmentPortal,
  createPoliceOfficer
};
