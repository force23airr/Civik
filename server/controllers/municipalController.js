import MunicipalDepartment from '../models/MunicipalDepartment.js';
import MunicipalReport from '../models/MunicipalReport.js';
import { INCIDENT_TO_DEPT } from '../services/municipal/routingService.js';

/**
 * GET /api/municipal/nearby?lat=&lng=&type=
 * Find the closest municipal departments for a given location.
 * Public — used by mobile app to show user where their report will go.
 */
export const getDepartmentsNearby = async (req, res) => {
  try {
    const { lat, lng, type, city, state } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const query = { isActive: true };
    if (type) query.departmentType = type;

    const departments = await MunicipalDepartment.find(query);

    // Haversine sort
    const withDistance = departments
      .filter(d => d.municipality.lat && d.municipality.lng)
      .map(d => {
        const dist = haversine(parseFloat(lat), parseFloat(lng), d.municipality.lat, d.municipality.lng);
        return { ...d.toObject(), distanceKm: Math.round(dist * 10) / 10 };
      })
      .filter(d => d.distanceKm <= 150)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 10);

    res.json({ departments: withDistance, total: withDistance.length });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * GET /api/municipal/lookup?lat=&lng=&incidentType=
 * Look up exactly which dept would receive a given incident type at a location.
 * Used in UI to show "Your pothole report will go to Miami-Dade Public Works"
 */
export const lookupDepartment = async (req, res) => {
  try {
    const { lat, lng, incidentType, city, state, zipCode } = req.query;
    if (!lat || !lng || !incidentType) {
      return res.status(400).json({ error: 'lat, lng, and incidentType are required' });
    }

    const departmentType = INCIDENT_TO_DEPT[incidentType];
    if (!departmentType) {
      return res.json({ department: null, message: 'This incident type is handled by police, not municipal services' });
    }

    const dept = await MunicipalDepartment.findForIncident(
      parseFloat(lat), parseFloat(lng), departmentType, city, state, zipCode
    );

    res.json({
      departmentType,
      department: dept ? {
        id: dept._id,
        name: dept.name,
        municipality: dept.municipality,
        contact: { phone: dept.contact.phone, website: dept.contact.website },
        protocol: dept.protocol,
        isVerified: dept.isVerified
      } : null,
      message: dept
        ? `Your report will be routed to ${dept.name} via ${dept.protocol}`
        : 'No registered department found. Your report will be queued for manual routing.'
    });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * GET /api/municipal/my-reports
 * Authenticated user's municipal reports with status.
 */
export const getMyMunicipalReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { reporter: req.user._id };
    if (status) query.status = status;

    const reports = await MunicipalReport.find(query)
      .populate('department', 'name departmentType municipality contact protocol')
      .populate('incident', 'type title location severity createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await MunicipalReport.countDocuments(query);

    res.json({ reports, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * GET /api/municipal/reports/:id
 * Get status of a specific municipal report.
 */
export const getReportStatus = async (req, res) => {
  try {
    const report = await MunicipalReport.findById(req.params.id)
      .populate('department', 'name departmentType municipality contact')
      .populate('incident', 'type title location severity');

    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Only the reporter (or admin/worker) can view
    if (report.reporter.toString() !== req.user._id.toString() &&
        !['admin', 'moderator', 'municipal_worker'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * GET /api/municipal/departments
 * Public list of all municipalities — used for "Coverage" page showing
 * users which cities Civik is connected to.
 */
export const getDepartments = async (req, res) => {
  try {
    const { country, state, type, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    if (country) query['municipality.country'] = country.toUpperCase();
    if (state) query['municipality.state'] = state.toUpperCase();
    if (type) query.departmentType = type;

    const [departments, total] = await Promise.all([
      MunicipalDepartment.find(query)
        .select('name departmentType municipality protocol isVerified stats')
        .sort({ 'municipality.country': 1, 'municipality.state': 1, 'municipality.city': 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      MunicipalDepartment.countDocuments(query)
    ]);

    // Coverage stats
    const stats = await MunicipalDepartment.aggregate([
      { $match: { isActive: true } },
      { $group: {
        _id: null,
        totalDepts: { $sum: 1 },
        open311Count: { $sum: { $cond: [{ $eq: ['$protocol', 'open311'] }, 1, 0] } },
        emailCount: { $sum: { $cond: [{ $eq: ['$protocol', 'email'] }, 1, 0] } },
        internalCount: { $sum: { $cond: [{ $eq: ['$protocol', 'internal'] }, 1, 0] } },
        countries: { $addToSet: '$municipality.country' },
        cities: { $addToSet: '$municipality.city' }
      }}
    ]);

    res.json({
      departments,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      coverage: stats[0] ? {
        totalDepts: stats[0].totalDepts,
        open311: stats[0].open311Count,
        email: stats[0].emailCount,
        internal: stats[0].internalCount,
        countries: stats[0].countries.length,
        cities: stats[0].cities.length
      } : {}
    });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// ─── Municipal Worker Portal ──────────────────────────────────────────────────

function requireWorker(req, res, next) {
  if (!['municipal_worker', 'admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Municipal worker access required' });
  }
  next();
}

/**
 * GET /api/municipal/worker/queue
 * Worker sees all reports assigned to their department.
 */
export const workerGetQueue = async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;

    const deptId = req.user.municipalProfile?.department;
    if (!deptId) return res.status(400).json({ error: 'No department assigned to your account' });

    const query = { department: deptId };
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['submitted', 'acknowledged', 'in_progress'] };
    }

    const [reports, total, statusCounts] = await Promise.all([
      MunicipalReport.find(query)
        .populate('incident', 'type title location severity mediaFiles createdAt')
        .populate('reporter', 'username email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      MunicipalReport.countDocuments(query),
      MunicipalReport.aggregate([
        { $match: { department: deptId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const dept = await MunicipalDepartment.findById(deptId);

    res.json({
      reports,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      statusCounts: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      department: dept?.name
    });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * PUT /api/municipal/worker/reports/:id
 * Worker updates a report status (in_progress, resolved, rejected).
 */
export const workerUpdateReport = async (req, res) => {
  try {
    const { status, workerNotes, ticketNumber } = req.body;

    const validStatuses = ['acknowledged', 'in_progress', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const report = await MunicipalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Verify worker belongs to this department
    const workerDept = req.user.municipalProfile?.department?.toString();
    if (workerDept && report.department?.toString() !== workerDept) {
      return res.status(403).json({ error: 'This report is not assigned to your department' });
    }

    report.status = status;
    if (workerNotes) report.workerNotes = workerNotes;
    if (ticketNumber) report.ticketNumber = ticketNumber;
    if (status === 'resolved') report.resolvedAt = new Date();
    report.workerAssigned = req.user.username;

    report.statusHistory.push({
      status,
      changedBy: req.user._id,
      note: workerNotes || `Status updated to ${status}`
    });

    await report.save();

    // Update incident status too if resolved
    if (status === 'resolved') {
      await import('../models/Incident.js').then(({ default: Incident }) =>
        Incident.findOneAndUpdate(
          { _id: report.incident, 'municipalReports.reportId': report._id },
          { $set: { 'municipalReports.$.status': 'resolved', status: 'resolved' } }
        )
      );

      // Update dept stats
      await MunicipalDepartment.findByIdAndUpdate(report.department, {
        $inc: { 'stats.reportsResolved': 1 },
        'stats.lastActivityAt': new Date()
      });
    }

    res.json({ success: true, report, message: `Report marked as ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * GET /api/municipal/worker/stats
 * Stats for the worker's department dashboard.
 */
export const workerGetStats = async (req, res) => {
  try {
    const deptId = req.user.municipalProfile?.department;
    if (!deptId) return res.status(400).json({ error: 'No department assigned' });

    const [dept, statusCounts, recentResolved] = await Promise.all([
      MunicipalDepartment.findById(deptId),
      MunicipalReport.aggregate([
        { $match: { department: deptId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      MunicipalReport.find({ department: deptId, status: 'resolved' })
        .sort({ resolvedAt: -1 })
        .limit(5)
        .populate('incident', 'type title location')
    ]);

    res.json({
      department: dept,
      statusCounts: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      recentResolved
    });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * GET /api/municipal/jurisdictions?state=FL&country=US
 * Returns a structured list of counties and cities for the picker UI.
 * Derives from seeded MunicipalDepartment data + static county map.
 */
export const getJurisdictions = async (req, res) => {
  try {
    const { state, country = 'US' } = req.query;

    // Pull distinct cities we have departments for
    const query = { isActive: true, 'municipality.country': country };
    if (state) query['municipality.state'] = state.toUpperCase();

    const depts = await MunicipalDepartment.find(query)
      .select('municipality.city municipality.state jurisdiction.cities')
      .lean();

    // Build city set from both municipality.city and jurisdiction.cities
    const citySet = new Set();
    for (const d of depts) {
      if (d.municipality?.city) citySet.add(d.municipality.city);
      for (const c of d.jurisdiction?.cities || []) {
        if (c) citySet.add(c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
          .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    }

    // For Florida, return the full county → cities hierarchy
    if (!state || state.toUpperCase() === 'FL') {
      return res.json({
        state: 'FL',
        country: 'US',
        counties: FLORIDA_COUNTIES,
        connectedCities: Array.from(citySet).sort()
      });
    }

    // For other states, return a flat city list grouped by state
    res.json({
      state: state?.toUpperCase(),
      country,
      counties: [],
      connectedCities: Array.from(citySet).sort()
    });
  } catch (err) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// Florida counties with incorporated cities/towns
const FLORIDA_COUNTIES = [
  {
    name: 'Miami-Dade County',
    code: 'miami-dade',
    cities: [
      'Aventura', 'Bal Harbour', 'Bay Harbor Islands', 'Biscayne Park',
      'Coral Gables', 'Cutler Bay', 'Doral', 'El Portal', 'Florida City',
      'Golden Beach', 'Hialeah', 'Hialeah Gardens', 'Homestead',
      'Indian Creek Village', 'Key Biscayne', 'Medley', 'Miami',
      'Miami Beach', 'Miami Gardens', 'Miami Lakes', 'Miami Shores',
      'Miami Springs', 'North Bay Village', 'North Miami', 'North Miami Beach',
      'Opa-locka', 'Palmetto Bay', 'Pinecrest', 'South Miami',
      'Sunny Isles Beach', 'Surfside', 'Sweetwater', 'Virginia Gardens',
      'West Miami', 'Unincorporated Miami-Dade'
    ]
  },
  {
    name: 'Broward County',
    code: 'broward',
    cities: [
      'Coconut Creek', 'Cooper City', 'Coral Springs', 'Dania Beach',
      'Davie', 'Deerfield Beach', 'Fort Lauderdale', 'Hallandale Beach',
      'Hillsboro Beach', 'Hollywood', 'Lauderdale Lakes', 'Lauderdale-by-the-Sea',
      'Lauderhill', 'Lazy Lake', 'Lighthouse Point', 'Margate', 'Miramar',
      'North Lauderdale', 'Oakland Park', 'Parkland', 'Pembroke Park',
      'Pembroke Pines', 'Plantation', 'Pompano Beach', 'Sea Ranch Lakes',
      'Southwest Ranches', 'Sunrise', 'Tamarac', 'Weston', 'Wilton Manors',
      'Unincorporated Broward'
    ]
  },
  {
    name: 'Palm Beach County',
    code: 'palm-beach',
    cities: [
      'Atlantis', 'Belle Glade', 'Boca Raton', 'Boynton Beach', 'Briny Breezes',
      'Cloud Lake', 'Delray Beach', 'Glen Ridge', 'Golf', 'Greenacres',
      'Gulf Stream', 'Haverhill', 'Highland Beach', 'Hypoluxo', 'Juno Beach',
      'Jupiter', 'Jupiter Inlet Colony', 'Lake Clarke Shores', 'Lake Park',
      'Lake Worth Beach', 'Lantana', 'Loxahatchee Groves', 'Manalapan',
      'Mangonia Park', 'North Palm Beach', 'Ocean Ridge', 'Pahokee',
      'Palm Beach', 'Palm Beach Gardens', 'Palm Beach Shores', 'Palm Springs',
      'Riviera Beach', 'Royal Palm Beach', 'South Bay', 'South Palm Beach',
      'Tequesta', 'Wellington', 'West Palm Beach', 'Westlake',
      'Unincorporated Palm Beach'
    ]
  },
  {
    name: 'Orange County',
    code: 'orange',
    cities: [
      'Apopka', 'Bay Lake', 'Belle Isle', 'Eatonville', 'Edgewood',
      'Lake Buena Vista', 'Maitland', 'Oakland', 'Ocoee', 'Orlando',
      'Winter Garden', 'Winter Park', 'Windermere',
      'Unincorporated Orange County'
    ]
  },
  {
    name: 'Hillsborough County',
    code: 'hillsborough',
    cities: [
      'Plant City', 'Tampa', 'Temple Terrace',
      'Unincorporated Hillsborough'
    ]
  },
  {
    name: 'Pinellas County',
    code: 'pinellas',
    cities: [
      'Belleair', 'Belleair Beach', 'Belleair Bluffs', 'Belleair Shore',
      'Clearwater', 'Dunedin', 'Gulfport', 'Indian Rocks Beach',
      'Indian Shores', 'Kenneth City', 'Largo', 'Madeira Beach',
      'North Redington Beach', 'Oldsmar', 'Pinellas Park', 'Redington Beach',
      'Redington Shores', 'Safety Harbor', 'St. Pete Beach', 'St. Petersburg',
      'Seminole', 'South Pasadena', 'Tarpon Springs', 'Treasure Island',
      'Unincorporated Pinellas'
    ]
  },
  {
    name: 'Duval County',
    code: 'duval',
    cities: [
      'Atlantic Beach', 'Baldwin', 'Jacksonville', 'Jacksonville Beach',
      'Neptune Beach', 'Unincorporated Duval'
    ]
  },
  {
    name: 'Seminole County',
    code: 'seminole',
    cities: [
      'Altamonte Springs', 'Casselberry', 'Lake Mary', 'Longwood',
      'Oviedo', 'Sanford', 'Winter Springs', 'Unincorporated Seminole'
    ]
  },
  {
    name: 'Osceola County',
    code: 'osceola',
    cities: [
      'Kissimmee', 'St. Cloud', 'Unincorporated Osceola'
    ]
  },
  {
    name: 'Volusia County',
    code: 'volusia',
    cities: [
      'Daytona Beach', 'Daytona Beach Shores', 'DeBary', 'DeLand',
      'Deltona', 'Edgewater', 'Holly Hill', 'Lake Helen', 'New Smyrna Beach',
      'Oak Hill', 'Orange City', 'Ormond Beach', 'Pierson', 'Port Orange',
      'South Daytona', 'Unincorporated Volusia'
    ]
  },
  {
    name: 'Lee County',
    code: 'lee',
    cities: [
      'Bonita Springs', 'Cape Coral', 'Fort Myers', 'Fort Myers Beach',
      'Sanibel', 'Unincorporated Lee'
    ]
  },
  {
    name: 'Collier County',
    code: 'collier',
    cities: [
      'Everglades City', 'Marco Island', 'Naples', 'Unincorporated Collier'
    ]
  },
  {
    name: 'Manatee County',
    code: 'manatee',
    cities: [
      'Anna Maria', 'Bradenton', 'Bradenton Beach', 'Holmes Beach',
      'Palmetto', 'Unincorporated Manatee'
    ]
  },
  {
    name: 'Sarasota County',
    code: 'sarasota',
    cities: [
      'Longboat Key', 'North Port', 'Sarasota', 'Venice',
      'Unincorporated Sarasota'
    ]
  },
  {
    name: 'Polk County',
    code: 'polk',
    cities: [
      'Auburndale', 'Bartow', 'Davenport', 'Dundee', 'Eagle Lake',
      'Fort Meade', 'Frostproof', 'Haines City', 'Lake Alfred', 'Lake Hamilton',
      'Lake Wales', 'Lakeland', 'Mulberry', 'Polk City', 'Winter Haven',
      'Unincorporated Polk'
    ]
  },
  {
    name: 'Brevard County',
    code: 'brevard',
    cities: [
      'Cape Canaveral', 'Cocoa', 'Cocoa Beach', 'Indialantic', 'Indian Harbour Beach',
      'Melbourne', 'Melbourne Beach', 'Palm Bay', 'Rockledge', 'Satellite Beach',
      'Titusville', 'West Melbourne', 'Unincorporated Brevard'
    ]
  },
  {
    name: 'Pasco County',
    code: 'pasco',
    cities: [
      'Dade City', 'New Port Richey', 'Port Richey', 'San Antonio',
      'St. Leo', 'Zephyrhills', 'Unincorporated Pasco'
    ]
  },
  {
    name: 'Escambia County',
    code: 'escambia',
    cities: [
      'Century', 'Pensacola', 'Unincorporated Escambia'
    ]
  },
  {
    name: 'Leon County',
    code: 'leon',
    cities: [
      'Tallahassee', 'Unincorporated Leon'
    ]
  }
];

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
