import mongoose from 'mongoose';

const municipalDepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Unique slug for upsert seeding (e.g. "cutler-bay-fl-public-works")
  code: {
    type: String,
    unique: true,
    sparse: true
  },
  departmentType: {
    type: String,
    enum: [
      'public_works',
      'parks_recreation',
      'traffic_engineering',
      'stormwater',
      'code_enforcement',
      'sanitation',
      'animal_control',
      'fire_marshal',
      'other'
    ],
    required: true
  },
  municipality: {
    name: { type: String, required: true },   // "Town of Cutler Bay"
    city: { type: String, required: true },   // "Cutler Bay"
    state: String,                             // "FL"
    country: { type: String, default: 'US' }, // "US" | "CA" | "UK" ...
    lat: Number,
    lng: Number
  },
  contact: {
    email: String,
    phone: String,
    website: String,
    contactPerson: String
  },
  // How DashGuard submits to this department
  protocol: {
    type: String,
    enum: ['open311', 'email', 'internal'],
    default: 'internal'
  },
  // Only populated when protocol === 'open311'
  open311Config: {
    endpoint: String,         // base URL e.g. https://311api.cityofchicago.org/open311/v2
    jurisdiction_id: String,  // e.g. "chicago.gov"
    apiKey: String,           // stored as env var reference e.g. "OPEN311_CHICAGO_KEY"
    // Mapped service codes per incident type
    serviceCodes: {
      infrastructure_pothole: String,
      infrastructure_road_damage: String,
      infrastructure_construction: String,
      infrastructure_signage: String,
      infrastructure_lighting: String,
      weather_flooding: String,
      weather_debris: String,
      weather_ice: String,
      traffic_signal_issue: String,
      traffic_congestion: String
    }
  },
  // Which areas this department serves
  jurisdiction: {
    cities: [String],    // ["Cutler Bay", "Pinecrest"] — lowercase match
    zipCodes: [String],  // ["33189", "33190"]
    radiusKm: { type: Number, default: 50 }
  },
  isActive: { type: Boolean, default: true },
  // true = officially registered/verified with DashGuard
  // false = community-sourced data, not yet confirmed
  isVerified: { type: Boolean, default: false },
  stats: {
    reportsReceived: { type: Number, default: 0 },
    reportsResolved: { type: Number, default: 0 },
    avgResolutionDays: { type: Number, default: 0 },
    lastActivityAt: Date
  }
}, { timestamps: true });

// Indexes
municipalDepartmentSchema.index({ 'municipality.city': 1, 'municipality.state': 1 });
municipalDepartmentSchema.index({ 'municipality.country': 1, departmentType: 1 });
municipalDepartmentSchema.index({ 'jurisdiction.cities': 1 });
municipalDepartmentSchema.index({ 'jurisdiction.zipCodes': 1 });
municipalDepartmentSchema.index({ 'municipality.lat': 1, 'municipality.lng': 1 });
municipalDepartmentSchema.index({ isActive: 1, departmentType: 1 });

// ─── Core lookup: find best department for an incident ───────────────────────
municipalDepartmentSchema.statics.findForIncident = async function(lat, lng, departmentType, city, state, zipCode) {
  // 1. Exact city+state match
  if (city && state) {
    const cityNorm = city.toLowerCase().trim();
    const exact = await this.findOne({
      departmentType,
      isActive: true,
      $or: [
        { 'jurisdiction.cities': { $regex: new RegExp(`^${cityNorm}$`, 'i') } },
        { 'municipality.city': { $regex: new RegExp(`^${cityNorm}$`, 'i'), } }
      ],
      $or: [
        { 'municipality.state': state.toUpperCase() },
        { 'municipality.state': state }
      ]
    });
    if (exact) return exact;
  }

  // 2. ZIP code match
  if (zipCode) {
    const byZip = await this.findOne({
      departmentType,
      isActive: true,
      'jurisdiction.zipCodes': zipCode
    });
    if (byZip) return byZip;
  }

  // 3. Nearest by GPS (haversine, within 100km)
  if (lat && lng) {
    const candidates = await this.find({
      departmentType,
      isActive: true,
      'municipality.lat': { $exists: true },
      'municipality.lng': { $exists: true }
    });

    let nearest = null;
    let minDist = Infinity;

    for (const dept of candidates) {
      const d = haversine(lat, lng, dept.municipality.lat, dept.municipality.lng);
      if (d < minDist && d <= 100) {
        minDist = d;
        nearest = dept;
      }
    }
    if (nearest) return nearest;
  }

  return null;
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Seeder ──────────────────────────────────────────────────────────────────
municipalDepartmentSchema.statics.seedDefaults = async function() {
  const { MUNICIPALITIES } = await import('../data/municipalSeed.js');

  let seeded = 0;
  for (const dept of MUNICIPALITIES) {
    await this.findOneAndUpdate(
      { code: dept.code },
      dept,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seeded++;
  }
  console.log(`[MunicipalDepartment] Seeded ${seeded} departments across ${new Set(MUNICIPALITIES.map(m => m.municipality.city)).size} cities`);
};

export default mongoose.model('MunicipalDepartment', municipalDepartmentSchema);
