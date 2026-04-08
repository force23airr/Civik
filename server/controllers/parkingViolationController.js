import ParkingViolation from '../models/ParkingViolation.js';
import PoliceStation from '../models/PoliceStation.js';
import crypto from 'crypto';
import fs from 'fs';

/**
 * Find the nearest active police station to given coordinates
 */
async function findNearestStation(lat, lng) {
  const stations = await PoliceStation.find({ isActive: true, 'location.lat': { $exists: true } });

  if (stations.length === 0) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const station of stations) {
    const dist = haversineDistance(lat, lng, station.location.lat, station.location.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = station;
    }
  }

  return { station: nearest, distanceKm: Math.round(minDistance * 100) / 100 };
}

/**
 * Haversine distance in km
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Submit a parking violation report
 * POST /api/parking-violations
 */
export const submitParkingViolation = async (req, res) => {
  try {
    const {
      violationType, severity, description,
      lat, lng, address, city, state, zipCode,
      licensePlate, plateState, make, model, color, vehicleType,
      observedAt
    } = req.body;

    // Validate violationType against allowed enum
    const allowedViolationTypes = [
      'fire_hydrant', 'handicap_zone', 'no_parking_zone', 'double_parked',
      'blocking_driveway', 'blocking_crosswalk', 'blocking_bike_lane', 'blocking_sidewalk',
      'expired_meter', 'overnight_parking', 'street_cleaning', 'fire_lane',
      'bus_stop', 'loading_zone', 'red_curb', 'yellow_curb',
      'too_close_to_intersection', 'wrong_direction', 'abandoned_vehicle', 'other'
    ];
    if (!violationType || !allowedViolationTypes.includes(violationType)) {
      return res.status(400).json({ error: 'Invalid violation type' });
    }

    // Validate coordinates
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    // Validate license plate format
    if (licensePlate && (typeof licensePlate !== 'string' || licensePlate.length < 2 || licensePlate.length > 10)) {
      return res.status(400).json({ error: 'License plate must be between 2 and 10 characters' });
    }

    // Validate observedAt date
    if (observedAt) {
      const parsedDate = new Date(observedAt);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid observedAt date' });
      }
      if (parsedDate > new Date()) {
        return res.status(400).json({ error: 'observedAt cannot be in the future' });
      }
    }

    // Require at least one photo
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one photo is required' });
    }

    // Process uploaded photos with SHA256 hashing
    const photos = await Promise.all(req.files.map(async (file) => {
      const fileBuffer = fs.readFileSync(file.path);
      const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      return {
        filename: file.filename,
        originalFilename: file.originalname,
        path: `/uploads/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
        sha256Hash
      };
    }));

    // Find nearest police station
    const nearestResult = await findNearestStation(parsedLat, parsedLng);

    const violation = new ParkingViolation({
      reporter: req.user._id,
      violationType,
      severity: severity || 'moderate',
      description,
      location: {
        address,
        city,
        state,
        zipCode,
        lat: parsedLat,
        lng: parsedLng
      },
      vehicle: {
        licensePlate,
        plateState,
        make,
        model,
        color,
        vehicleType
      },
      photos,
      observedAt: observedAt || new Date(),
      assignedStation: nearestResult?.station?._id,
      distanceToStation: nearestResult?.distanceKm,
      consent: {
        tosAccepted: true,
        certifyTruthful: true
      },
      status: nearestResult?.station ? 'assigned' : 'submitted'
    });

    // Add chain of custody entry
    violation.addCustodyEntry('created', req.user._id, 'Parking violation report submitted');

    if (nearestResult?.station) {
      violation.addCustodyEntry(
        'submitted_to_station',
        req.user._id,
        `Auto-assigned to ${nearestResult.station.name} (${nearestResult.distanceKm} km away)`
      );
    }

    await violation.save();

    // Emit real-time notification to police portal
    if (req.io && nearestResult?.station) {
      req.io.to(`station-${nearestResult.station._id}`).emit('new-parking-violation', {
        reportNumber: violation.reportNumber,
        violationType: violation.violationTypeDisplay,
        location: violation.location.address
      });
    }

    res.status(201).json({
      success: true,
      violation,
      reportNumber: violation.reportNumber,
      assignedStation: nearestResult?.station ? {
        name: nearestResult.station.name,
        distance: nearestResult.distanceKm,
        jurisdiction: nearestResult.station.jurisdiction
      } : null,
      message: nearestResult?.station
        ? `Report submitted and assigned to ${nearestResult.station.name}`
        : 'Report submitted. Will be assigned to a station once available.'
    });
  } catch (error) {
    console.error('[ParkingViolation] Submit error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * Get user's parking violation reports
 * GET /api/parking-violations/my-reports
 */
export const getMyReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { reporter: req.user._id };
    if (status && typeof status === 'string') query.status = status;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const reports = await ParkingViolation.find(query)
      .populate('assignedStation', 'name jurisdiction address')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

    const total = await ParkingViolation.countDocuments(query);

    res.json({
      reports,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * Get a single parking violation report
 * GET /api/parking-violations/:id
 */
export const getReport = async (req, res) => {
  try {
    const report = await ParkingViolation.findById(req.params.id)
      .populate('reporter', 'username avatar')
      .populate('assignedStation', 'name jurisdiction address')
      .populate('review.reviewedBy', 'username policeProfile.badgeNumber');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Ownership check — only reporter, police, or admin can view
    const isOwner = report.reporter._id.toString() === req.user._id.toString();
    const isPolice = req.user.role === 'police_officer';
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isPolice && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this report' });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * Get nearest police station for coordinates
 * GET /api/parking-violations/nearest-station?lat=X&lng=Y
 */
export const getNearestStation = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const result = await findNearestStation(parseFloat(lat), parseFloat(lng));

    if (!result) {
      return res.json({ station: null, message: 'No active stations found' });
    }

    res.json({
      station: {
        id: result.station._id,
        name: result.station.name,
        jurisdiction: result.station.jurisdiction,
        address: result.station.address,
        phone: result.station.phone,
        distance: result.distanceKm
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * Get violation type options
 * GET /api/parking-violations/options/types
 */
export const getViolationTypes = (req, res) => {
  const types = [
    { value: 'fire_hydrant', label: 'Parked Near Fire Hydrant', severity: 'severe' },
    { value: 'handicap_zone', label: 'Parked in Handicap Zone', severity: 'critical' },
    { value: 'no_parking_zone', label: 'No Parking Zone', severity: 'moderate' },
    { value: 'double_parked', label: 'Double Parked', severity: 'moderate' },
    { value: 'blocking_driveway', label: 'Blocking Driveway', severity: 'severe' },
    { value: 'blocking_crosswalk', label: 'Blocking Crosswalk', severity: 'severe' },
    { value: 'blocking_bike_lane', label: 'Blocking Bike Lane', severity: 'moderate' },
    { value: 'blocking_sidewalk', label: 'Blocking Sidewalk', severity: 'moderate' },
    { value: 'expired_meter', label: 'Expired Meter', severity: 'minor' },
    { value: 'overnight_parking', label: 'Overnight Parking Violation', severity: 'minor' },
    { value: 'street_cleaning', label: 'Street Cleaning Violation', severity: 'minor' },
    { value: 'fire_lane', label: 'Parked in Fire Lane', severity: 'critical' },
    { value: 'bus_stop', label: 'Parked at Bus Stop', severity: 'moderate' },
    { value: 'loading_zone', label: 'Loading Zone Violation', severity: 'minor' },
    { value: 'red_curb', label: 'Parked at Red Curb', severity: 'moderate' },
    { value: 'yellow_curb', label: 'Parked at Yellow Curb', severity: 'minor' },
    { value: 'too_close_to_intersection', label: 'Too Close to Intersection', severity: 'moderate' },
    { value: 'wrong_direction', label: 'Parked Wrong Direction', severity: 'minor' },
    { value: 'abandoned_vehicle', label: 'Abandoned Vehicle', severity: 'severe' },
    { value: 'other', label: 'Other Parking Violation', severity: 'moderate' }
  ];

  res.json(types);
};
