import ParkingViolation from '../models/ParkingViolation.js';
import crypto from 'crypto';
import fs from 'fs';

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
      consent: {
        tosAccepted: true,
        certifyTruthful: true
      },
      status: 'submitted'
    });

    // Add chain of custody entry
    violation.addCustodyEntry('created', req.user._id, 'Parking violation report submitted');

    await violation.save();

    res.status(201).json({
      success: true,
      violation,
      reportNumber: violation.reportNumber,
      message: 'Report submitted successfully'
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
