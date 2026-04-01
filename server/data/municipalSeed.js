/**
 * DashGuard Global Municipal Department Seed Data
 *
 * protocol values:
 *   open311  — city has a live Open311 API; DashGuard submits directly
 *   email    — auto-emails the department on incident creation
 *   internal — stored in DashGuard queue; city must claim their portal
 *
 * Departments are seeded per INCIDENT TYPE, not per city, so a city like
 * Miami-Dade will have multiple entries (public_works, parks_recreation, stormwater…)
 */

// ─── Helper to build a dept entry ──────────────────────────────────────────
const dept = (code, name, type, municipality, contact, protocol, jurisdiction, open311Config = null) => ({
  code,
  name,
  departmentType: type,
  municipality,
  contact,
  protocol,
  jurisdiction,
  ...(open311Config ? { open311Config } : {}),
  isVerified: protocol !== 'internal',
  isActive: true
});

const city = (name, city, state, country = 'US', lat, lng) => ({ name, city, state, country, lat, lng });

// ════════════════════════════════════════════════════════════════════════════
// FLORIDA — primary market (Cutler Bay first)
// ════════════════════════════════════════════════════════════════════════════
const FLORIDA = [
  // ── Cutler Bay ─────────────────────────────────────────────────────────
  dept('cutler-bay-fl-public-works', 'Town of Cutler Bay Public Works', 'public_works',
    city('Town of Cutler Bay', 'Cutler Bay', 'FL', 'US', 25.5783, -80.3381),
    { email: 'publicworks@cutlerbay-fl.gov', phone: '305-234-4262', website: 'https://www.cutlerbay-fl.gov/departments/public-works' },
    'email',
    { cities: ['cutler bay'], zipCodes: ['33189', '33190', '33157'], radiusKm: 15 }
  ),
  dept('cutler-bay-fl-parks', 'Town of Cutler Bay Parks & Recreation', 'parks_recreation',
    city('Town of Cutler Bay', 'Cutler Bay', 'FL', 'US', 25.5783, -80.3381),
    { email: 'parks@cutlerbay-fl.gov', phone: '305-234-4262', website: 'https://www.cutlerbay-fl.gov/departments/parks-recreation' },
    'email',
    { cities: ['cutler bay'], zipCodes: ['33189', '33190', '33157'], radiusKm: 15 }
  ),
  dept('cutler-bay-fl-code', 'Town of Cutler Bay Code Enforcement', 'code_enforcement',
    city('Town of Cutler Bay', 'Cutler Bay', 'FL', 'US', 25.5783, -80.3381),
    { email: 'codeenforcement@cutlerbay-fl.gov', phone: '305-234-4262', website: 'https://www.cutlerbay-fl.gov' },
    'email',
    { cities: ['cutler bay'], zipCodes: ['33189', '33190', '33157'], radiusKm: 15 }
  ),

  // ── Miami-Dade County (covers unincorporated areas + county roads) ────
  dept('miami-dade-public-works', 'Miami-Dade County Public Works', 'public_works',
    city('Miami-Dade County', 'Miami', 'FL', 'US', 25.7617, -80.1918),
    { email: 'publicworks@miamidade.gov', phone: '305-375-2000', website: 'https://www.miamidade.gov/publicworks' },
    'email',
    { cities: ['miami', 'miami-dade', 'cutler bay', 'homestead', 'doral', 'hialeah', 'north miami', 'coral gables', 'south miami', 'miami gardens', 'miramar', 'florida city'], zipCodes: [], radiusKm: 60 }
  ),
  dept('miami-dade-parks', 'Miami-Dade County Parks & Recreation', 'parks_recreation',
    city('Miami-Dade County', 'Miami', 'FL', 'US', 25.7617, -80.1918),
    { email: 'parks@miamidade.gov', phone: '305-755-7800', website: 'https://www.miamidade.gov/parks' },
    'email',
    { cities: ['miami', 'miami-dade', 'cutler bay', 'homestead', 'doral', 'hialeah'], zipCodes: [], radiusKm: 60 }
  ),
  dept('miami-dade-stormwater', 'Miami-Dade County Stormwater Management', 'stormwater',
    city('Miami-Dade County', 'Miami', 'FL', 'US', 25.7617, -80.1918),
    { email: 'stormwater@miamidade.gov', phone: '305-372-6600', website: 'https://www.miamidade.gov/environment/stormwater.asp' },
    'email',
    { cities: ['miami', 'miami-dade', 'cutler bay', 'homestead', 'doral', 'hialeah'], zipCodes: [], radiusKm: 60 }
  ),
  dept('miami-dade-traffic', 'Miami-Dade Traffic Engineering', 'traffic_engineering',
    city('Miami-Dade County', 'Miami', 'FL', 'US', 25.7617, -80.1918),
    { email: 'traffic@miamidade.gov', phone: '305-470-5100', website: 'https://www.miamidade.gov/traffic' },
    'email',
    { cities: ['miami', 'miami-dade', 'cutler bay', 'homestead', 'doral', 'hialeah'], zipCodes: [], radiusKm: 60 }
  ),

  // ── City of Miami ──────────────────────────────────────────────────────
  dept('miami-fl-public-works', 'City of Miami Public Works', 'public_works',
    city('City of Miami', 'Miami', 'FL', 'US', 25.7617, -80.1918),
    { email: 'publicworks@miamigov.com', phone: '305-416-1200', website: 'https://www.miamigov.com/publicworks' },
    'email',
    { cities: ['miami'], zipCodes: ['33101', '33125', '33126', '33127', '33128', '33129', '33130', '33131', '33132', '33133', '33134', '33135', '33136', '33137', '33138', '33139', '33142', '33145', '33147', '33150', '33155', '33167'], radiusKm: 25 }
  ),
  dept('miami-fl-parks', 'City of Miami Parks & Recreation', 'parks_recreation',
    city('City of Miami', 'Miami', 'FL', 'US', 25.7617, -80.1918),
    { email: 'parks@miamigov.com', phone: '305-416-1300', website: 'https://www.miamigov.com/parks' },
    'email',
    { cities: ['miami'], zipCodes: [], radiusKm: 25 }
  ),

  // ── Fort Lauderdale ────────────────────────────────────────────────────
  dept('fort-lauderdale-fl-public-works', 'Fort Lauderdale Public Works', 'public_works',
    city('City of Fort Lauderdale', 'Fort Lauderdale', 'FL', 'US', 26.1224, -80.1373),
    { email: 'publicworks@fortlauderdale.gov', phone: '954-828-5785', website: 'https://www.fortlauderdale.gov/departments/public-works' },
    'email',
    { cities: ['fort lauderdale'], zipCodes: ['33301', '33304', '33305', '33308', '33309', '33311', '33312', '33315', '33316', '33317'], radiusKm: 20 }
  ),
  dept('fort-lauderdale-fl-parks', 'Fort Lauderdale Parks & Recreation', 'parks_recreation',
    city('City of Fort Lauderdale', 'Fort Lauderdale', 'FL', 'US', 26.1224, -80.1373),
    { email: 'parks@fortlauderdale.gov', phone: '954-828-5363', website: 'https://www.fortlauderdale.gov/departments/parks' },
    'email',
    { cities: ['fort lauderdale'], zipCodes: [], radiusKm: 20 }
  ),
  dept('fort-lauderdale-fl-stormwater', 'Fort Lauderdale Stormwater', 'stormwater',
    city('City of Fort Lauderdale', 'Fort Lauderdale', 'FL', 'US', 26.1224, -80.1373),
    { email: 'stormwater@fortlauderdale.gov', phone: '954-828-5785', website: 'https://www.fortlauderdale.gov' },
    'email',
    { cities: ['fort lauderdale'], zipCodes: [], radiusKm: 20 }
  ),

  // ── Tampa ──────────────────────────────────────────────────────────────
  dept('tampa-fl-public-works', 'City of Tampa Public Works', 'public_works',
    city('City of Tampa', 'Tampa', 'FL', 'US', 27.9506, -82.4572),
    { email: 'publicworks@tampagov.net', phone: '813-274-3101', website: 'https://www.tampa.gov/public-works' },
    'email',
    { cities: ['tampa'], zipCodes: ['33602', '33603', '33604', '33605', '33606', '33607', '33609', '33610', '33611', '33612', '33613', '33614', '33615', '33616', '33617', '33619', '33629'], radiusKm: 30 }
  ),
  dept('tampa-fl-parks', 'City of Tampa Parks & Recreation', 'parks_recreation',
    city('City of Tampa', 'Tampa', 'FL', 'US', 27.9506, -82.4572),
    { email: 'parks@tampagov.net', phone: '813-274-8615', website: 'https://www.tampa.gov/parks-recreation' },
    'email',
    { cities: ['tampa'], zipCodes: [], radiusKm: 30 }
  ),
  dept('tampa-fl-stormwater', 'City of Tampa Stormwater', 'stormwater',
    city('City of Tampa', 'Tampa', 'FL', 'US', 27.9506, -82.4572),
    { email: 'stormwater@tampagov.net', phone: '813-274-3101', website: 'https://www.tampa.gov/stormwater' },
    'email',
    { cities: ['tampa'], zipCodes: [], radiusKm: 30 }
  ),

  // ── Orlando ────────────────────────────────────────────────────────────
  dept('orlando-fl-public-works', 'City of Orlando Public Works', 'public_works',
    city('City of Orlando', 'Orlando', 'FL', 'US', 28.5383, -81.3792),
    { email: 'publicworks@cityoforlando.net', phone: '407-246-2000', website: 'https://www.orlando.gov/Our-Government/Departments-Offices/Public-Works' },
    'email',
    { cities: ['orlando'], zipCodes: ['32801', '32803', '32804', '32805', '32806', '32808', '32809', '32811', '32812', '32814', '32817', '32819', '32822', '32824', '32825', '32827', '32829', '32835', '32839'], radiusKm: 25 }
  ),
  dept('orlando-fl-parks', 'City of Orlando Parks & Recreation', 'parks_recreation',
    city('City of Orlando', 'Orlando', 'FL', 'US', 28.5383, -81.3792),
    { email: 'parks@cityoforlando.net', phone: '407-246-2283', website: 'https://www.orlando.gov/parks' },
    'email',
    { cities: ['orlando'], zipCodes: [], radiusKm: 25 }
  ),

  // ── Jacksonville ──────────────────────────────────────────────────────
  dept('jacksonville-fl-public-works', 'Jacksonville Public Works', 'public_works',
    city('City of Jacksonville', 'Jacksonville', 'FL', 'US', 30.3322, -81.6557),
    { email: 'publicworks@coj.net', phone: '904-630-2489', website: 'https://www.coj.net/departments/public-works' },
    'email',
    { cities: ['jacksonville'], zipCodes: [], radiusKm: 60 }
  ),
  dept('jacksonville-fl-parks', 'Jacksonville Parks & Recreation', 'parks_recreation',
    city('City of Jacksonville', 'Jacksonville', 'FL', 'US', 30.3322, -81.6557),
    { email: 'parks@coj.net', phone: '904-630-3596', website: 'https://www.coj.net/departments/parks' },
    'email',
    { cities: ['jacksonville'], zipCodes: [], radiusKm: 60 }
  ),

  // ── More Florida cities ────────────────────────────────────────────────
  dept('hialeah-fl-public-works', 'City of Hialeah Public Works', 'public_works',
    city('City of Hialeah', 'Hialeah', 'FL', 'US', 25.8576, -80.2781),
    { email: 'publicworks@hialeahfl.gov', phone: '305-883-5800', website: 'https://www.hialeahfl.gov' },
    'email',
    { cities: ['hialeah'], zipCodes: ['33010', '33012', '33013', '33014', '33015', '33016'], radiusKm: 15 }
  ),
  dept('boca-raton-fl-public-works', 'City of Boca Raton Public Works', 'public_works',
    city('City of Boca Raton', 'Boca Raton', 'FL', 'US', 26.3683, -80.1289),
    { email: 'publicworks@myboca.us', phone: '561-393-7760', website: 'https://www.myboca.us' },
    'email',
    { cities: ['boca raton'], zipCodes: ['33427', '33428', '33431', '33432', '33433', '33434', '33486', '33487', '33496', '33498'], radiusKm: 20 }
  ),
  dept('west-palm-beach-fl-public-works', 'West Palm Beach Public Works', 'public_works',
    city('City of West Palm Beach', 'West Palm Beach', 'FL', 'US', 26.7153, -80.0534),
    { email: 'publicworks@wpb.org', phone: '561-822-1300', website: 'https://www.wpb.org/government/departments/public-works' },
    'email',
    { cities: ['west palm beach'], zipCodes: ['33401', '33405', '33406', '33407', '33409', '33411', '33412', '33413', '33414', '33415', '33417'], radiusKm: 20 }
  ),
  dept('coral-gables-fl-public-works', 'City of Coral Gables Public Works', 'public_works',
    city('City of Coral Gables', 'Coral Gables', 'FL', 'US', 25.7215, -80.2684),
    { email: 'publicworks@coralgables.com', phone: '305-460-5070', website: 'https://www.coralgables.com/publicworks' },
    'email',
    { cities: ['coral gables'], zipCodes: ['33114', '33133', '33134', '33143', '33146', '33156', '33158'], radiusKm: 12 }
  ),
  dept('tallahassee-fl-public-works', 'City of Tallahassee Public Works', 'public_works',
    city('City of Tallahassee', 'Tallahassee', 'FL', 'US', 30.4518, -84.2807),
    { email: 'publicworks@talgov.com', phone: '850-891-4968', website: 'https://www.talgov.com/publicworks' },
    'email',
    { cities: ['tallahassee'], zipCodes: [], radiusKm: 30 }
  ),
  dept('pembroke-pines-fl-public-works', 'Pembroke Pines Public Works', 'public_works',
    city('City of Pembroke Pines', 'Pembroke Pines', 'FL', 'US', 26.0079, -86.1458),
    { email: 'publicworks@ppines.com', phone: '954-431-4000', website: 'https://www.ppines.com' },
    'email',
    { cities: ['pembroke pines'], zipCodes: ['33023', '33024', '33025', '33026', '33027', '33028', '33029'], radiusKm: 15 }
  ),
  dept('miramar-fl-public-works', 'City of Miramar Public Works', 'public_works',
    city('City of Miramar', 'Miramar', 'FL', 'US', 25.9867, -80.2330),
    { email: 'publicworks@miramarfl.gov', phone: '954-602-3000', website: 'https://www.miramarfl.gov' },
    'email',
    { cities: ['miramar'], zipCodes: ['33023', '33025', '33027', '33029'], radiusKm: 15 }
  ),
  dept('homestead-fl-public-works', 'City of Homestead Public Works', 'public_works',
    city('City of Homestead', 'Homestead', 'FL', 'US', 25.4687, -80.4776),
    { email: 'publicworks@cityofhomestead.com', phone: '305-224-4428', website: 'https://www.cityofhomestead.com' },
    'email',
    { cities: ['homestead', 'florida city'], zipCodes: ['33030', '33031', '33032', '33033', '33034', '33035', '33090'], radiusKm: 20 }
  ),
  dept('doral-fl-public-works', 'City of Doral Public Works', 'public_works',
    city('City of Doral', 'Doral', 'FL', 'US', 25.8195, -80.3557),
    { email: 'publicworks@cityofdoral.com', phone: '305-593-6700', website: 'https://www.cityofdoral.com' },
    'email',
    { cities: ['doral'], zipCodes: ['33122', '33126', '33166', '33172', '33178'], radiusKm: 15 }
  )
];

// ════════════════════════════════════════════════════════════════════════════
// OPEN311 CITIES — direct API submission
// ════════════════════════════════════════════════════════════════════════════
const OPEN311 = [
  // ── Chicago, IL ────────────────────────────────────────────────────────
  dept('chicago-il-public-works', 'Chicago Department of Streets & Sanitation', 'public_works',
    city('City of Chicago', 'Chicago', 'IL', 'US', 41.8781, -87.6298),
    { email: 'streetsansan@cityofchicago.org', phone: '312-744-5000', website: 'https://www.chicago.gov/city/en/depts/streets.html' },
    'open311',
    { cities: ['chicago'], zipCodes: [], radiusKm: 30 },
    {
      endpoint: 'https://311api.cityofchicago.org/open311/v2',
      jurisdiction_id: 'chicago.gov',
      serviceCodes: {
        infrastructure_pothole: '4fd3bd3de750840569000019',
        infrastructure_road_damage: '4ffa4c69601827691b000018',
        infrastructure_lighting: '4ffa9cad6018277d400000c8',
        traffic_signal_issue: '4ffa971e6018277d4000007e',
        weather_debris: '4ffa9cad6018277d400000c9'
      }
    }
  ),
  dept('chicago-il-parks', 'Chicago Park District', 'parks_recreation',
    city('City of Chicago', 'Chicago', 'IL', 'US', 41.8781, -87.6298),
    { email: 'info@chicagoparkdistrict.com', phone: '312-742-7529', website: 'https://www.chicagoparkdistrict.com' },
    'open311',
    { cities: ['chicago'], zipCodes: [], radiusKm: 30 },
    { endpoint: 'https://311api.cityofchicago.org/open311/v2', jurisdiction_id: 'chicago.gov', serviceCodes: { weather_debris: '4ffa9cad6018277d400000c9' } }
  ),

  // ── San Francisco, CA ──────────────────────────────────────────────────
  dept('san-francisco-ca-public-works', 'SF Department of Public Works', 'public_works',
    city('City of San Francisco', 'San Francisco', 'CA', 'US', 37.7749, -122.4194),
    { email: 'sfdpw@sfgov.org', phone: '415-554-6920', website: 'https://sfpublicworks.org' },
    'open311',
    { cities: ['san francisco'], zipCodes: [], radiusKm: 20 },
    {
      endpoint: 'https://mobile311.sfgov.org/open311/v2',
      jurisdiction_id: 'sf.gov',
      serviceCodes: {
        infrastructure_pothole: 'pothole_sf',
        infrastructure_road_damage: 'street_defect',
        infrastructure_lighting: 'streetlight',
        weather_flooding: 'flooding',
        traffic_signal_issue: 'traffic_signal'
      }
    }
  ),

  // ── Boston, MA ─────────────────────────────────────────────────────────
  dept('boston-ma-public-works', 'Boston Public Works Department', 'public_works',
    city('City of Boston', 'Boston', 'MA', 'US', 42.3601, -71.0589),
    { email: 'pwd@boston.gov', phone: '617-635-4500', website: 'https://www.boston.gov/departments/public-works' },
    'open311',
    { cities: ['boston'], zipCodes: [], radiusKm: 20 },
    {
      endpoint: 'https://311.boston.gov/open311/v2',
      jurisdiction_id: 'boston.gov',
      serviceCodes: {
        infrastructure_pothole: 'pothole',
        infrastructure_road_damage: 'road_damage',
        infrastructure_lighting: 'street_light_outage',
        weather_debris: 'debris_removal',
        traffic_signal_issue: 'traffic_signal_broken'
      }
    }
  ),

  // ── Washington DC ──────────────────────────────────────────────────────
  dept('washington-dc-public-works', 'DC Department of Public Works', 'public_works',
    city('Washington DC', 'Washington', 'DC', 'US', 38.9072, -77.0369),
    { email: 'dpw@dc.gov', phone: '202-673-6833', website: 'https://dpw.dc.gov' },
    'open311',
    { cities: ['washington', 'washington dc', 'dc'], zipCodes: [], radiusKm: 15 },
    {
      endpoint: 'https://app.311.dc.gov/CWI/api/open311',
      jurisdiction_id: 'dc.gov',
      serviceCodes: {
        infrastructure_pothole: 'pothole',
        infrastructure_road_damage: 'road_surface',
        infrastructure_lighting: 'streetlight',
        weather_flooding: 'flooding',
        traffic_signal_issue: 'traffic_signal'
      }
    }
  ),

  // ── Toronto, Canada ────────────────────────────────────────────────────
  dept('toronto-on-public-works', 'City of Toronto Transportation Services', 'public_works',
    city('City of Toronto', 'Toronto', 'ON', 'CA', 43.6532, -79.3832),
    { email: 'transportationservices@toronto.ca', phone: '416-392-6700', website: 'https://www.toronto.ca/services-payments/streets-parking-transportation' },
    'open311',
    { cities: ['toronto'], zipCodes: [], radiusKm: 30 },
    {
      endpoint: 'https://secure.toronto.ca/311api/servicerequests',
      jurisdiction_id: 'toronto.ca',
      serviceCodes: {
        infrastructure_pothole: 'pothole',
        infrastructure_road_damage: 'road_damage',
        infrastructure_lighting: 'street_light'
      }
    }
  ),

  // ── Bloomington, IN ────────────────────────────────────────────────────
  dept('bloomington-in-public-works', 'City of Bloomington Public Works', 'public_works',
    city('City of Bloomington', 'Bloomington', 'IN', 'US', 39.1653, -86.5264),
    { email: 'publicworks@bloomington.in.gov', phone: '812-349-3448', website: 'https://bloomington.in.gov/publicworks' },
    'open311',
    { cities: ['bloomington'], zipCodes: ['47401', '47403', '47404', '47405', '47406', '47408'], radiusKm: 15 },
    {
      endpoint: 'https://bloomington.in.gov/open311/v2',
      jurisdiction_id: 'bloomington.in.gov',
      serviceCodes: {
        infrastructure_pothole: 'pothole',
        infrastructure_road_damage: 'road_repair',
        infrastructure_lighting: 'streetlight',
        weather_debris: 'debris'
      }
    }
  )
];

// ════════════════════════════════════════════════════════════════════════════
// MAJOR US CITIES — email routing
// ════════════════════════════════════════════════════════════════════════════
const US_CITIES = [
  // New York
  dept('nyc-public-works', 'NYC Department of Transportation', 'public_works',
    city('New York City', 'New York', 'NY', 'US', 40.7128, -74.0060),
    { email: 'dot.feedback@dot.nyc.gov', phone: '212-NEW-YORK', website: 'https://www.nyc.gov/dot' },
    'email', { cities: ['new york', 'nyc', 'brooklyn', 'queens', 'bronx', 'staten island', 'manhattan'], zipCodes: [], radiusKm: 30 }
  ),
  dept('nyc-parks', 'NYC Parks & Recreation', 'parks_recreation',
    city('New York City', 'New York', 'NY', 'US', 40.7128, -74.0060),
    { email: 'greenbook@parks.nyc.gov', phone: '311', website: 'https://www.nycgovparks.org' },
    'email', { cities: ['new york', 'nyc', 'brooklyn', 'queens', 'bronx', 'staten island', 'manhattan'], zipCodes: [], radiusKm: 30 }
  ),
  // Los Angeles
  dept('los-angeles-ca-public-works', 'LA Bureau of Street Services', 'public_works',
    city('City of Los Angeles', 'Los Angeles', 'CA', 'US', 34.0522, -118.2437),
    { email: 'bss@lacity.org', phone: '311', website: 'https://www.lacity.org/government/popular-information/streets' },
    'email', { cities: ['los angeles', 'la'], zipCodes: [], radiusKm: 50 }
  ),
  dept('los-angeles-ca-parks', 'LA Recreation & Parks', 'parks_recreation',
    city('City of Los Angeles', 'Los Angeles', 'CA', 'US', 34.0522, -118.2437),
    { email: 'customer.service@lacity.org', phone: '888-527-7386', website: 'https://www.laparks.org' },
    'email', { cities: ['los angeles', 'la'], zipCodes: [], radiusKm: 50 }
  ),
  // Houston
  dept('houston-tx-public-works', 'Houston Public Works', 'public_works',
    city('City of Houston', 'Houston', 'TX', 'US', 29.7604, -95.3698),
    { email: 'publicworks@houstontx.gov', phone: '311', website: 'https://www.houstontx.gov/publicworks' },
    'email', { cities: ['houston'], zipCodes: [], radiusKm: 60 }
  ),
  dept('houston-tx-parks', 'Houston Parks & Recreation', 'parks_recreation',
    city('City of Houston', 'Houston', 'TX', 'US', 29.7604, -95.3698),
    { email: 'hpard@houstontx.gov', phone: '832-395-7000', website: 'https://www.houstontx.gov/parks' },
    'email', { cities: ['houston'], zipCodes: [], radiusKm: 60 }
  ),
  // Phoenix
  dept('phoenix-az-public-works', 'Phoenix Public Works', 'public_works',
    city('City of Phoenix', 'Phoenix', 'AZ', 'US', 33.4484, -112.0740),
    { email: 'publicworks@phoenix.gov', phone: '602-262-6251', website: 'https://www.phoenix.gov/pwa' },
    'email', { cities: ['phoenix'], zipCodes: [], radiusKm: 50 }
  ),
  // Philadelphia
  dept('philadelphia-pa-public-works', 'Philadelphia Streets Department', 'public_works',
    city('City of Philadelphia', 'Philadelphia', 'PA', 'US', 39.9526, -75.1652),
    { email: 'streets@phila.gov', phone: '215-686-5560', website: 'https://www.phila.gov/departments/streets-department' },
    'email', { cities: ['philadelphia', 'philly'], zipCodes: [], radiusKm: 30 }
  ),
  // San Antonio
  dept('san-antonio-tx-public-works', 'San Antonio Public Works', 'public_works',
    city('City of San Antonio', 'San Antonio', 'TX', 'US', 29.4241, -98.4936),
    { email: 'sa311@sanantonio.gov', phone: '311', website: 'https://www.sanantonio.gov/publicworks' },
    'email', { cities: ['san antonio'], zipCodes: [], radiusKm: 50 }
  ),
  // Dallas
  dept('dallas-tx-public-works', 'Dallas Public Works', 'public_works',
    city('City of Dallas', 'Dallas', 'TX', 'US', 32.7767, -96.7970),
    { email: 'publicworks@dallas.gov', phone: '311', website: 'https://www.dallascityhall.com/departments/public-works' },
    'email', { cities: ['dallas'], zipCodes: [], radiusKm: 40 }
  ),
  // San Diego
  dept('san-diego-ca-public-works', 'San Diego Public Works', 'public_works',
    city('City of San Diego', 'San Diego', 'CA', 'US', 32.7157, -117.1611),
    { email: 'dsd@sandiego.gov', phone: '619-533-4040', website: 'https://www.sandiego.gov/public-works' },
    'email', { cities: ['san diego'], zipCodes: [], radiusKm: 30 }
  ),
  // Austin
  dept('austin-tx-public-works', 'Austin Public Works', 'public_works',
    city('City of Austin', 'Austin', 'TX', 'US', 30.2672, -97.7431),
    { email: 'publicworks@austintexas.gov', phone: '311', website: 'https://www.austintexas.gov/department/public-works' },
    'email', { cities: ['austin'], zipCodes: [], radiusKm: 30 }
  ),
  dept('austin-tx-parks', 'Austin Parks & Recreation', 'parks_recreation',
    city('City of Austin', 'Austin', 'TX', 'US', 30.2672, -97.7431),
    { email: 'pard@austintexas.gov', phone: '512-974-6700', website: 'https://www.austintexas.gov/pard' },
    'email', { cities: ['austin'], zipCodes: [], radiusKm: 30 }
  ),
  // Denver
  dept('denver-co-public-works', 'Denver Public Works', 'public_works',
    city('City of Denver', 'Denver', 'CO', 'US', 39.7392, -104.9903),
    { email: 'public_works@denvergov.org', phone: '720-865-8000', website: 'https://www.denvergov.org/publicworks' },
    'email', { cities: ['denver'], zipCodes: [], radiusKm: 30 }
  ),
  // Seattle
  dept('seattle-wa-public-works', 'Seattle Department of Transportation', 'public_works',
    city('City of Seattle', 'Seattle', 'WA', 'US', 47.6062, -122.3321),
    { email: 'sdot.customerservice@seattle.gov', phone: '206-684-7623', website: 'https://www.seattle.gov/transportation' },
    'email', { cities: ['seattle'], zipCodes: [], radiusKm: 25 }
  ),
  // Atlanta
  dept('atlanta-ga-public-works', 'Atlanta Department of Public Works', 'public_works',
    city('City of Atlanta', 'Atlanta', 'GA', 'US', 33.7490, -84.3880),
    { email: 'dpw@atlantaga.gov', phone: '404-330-6240', website: 'https://www.atlantaga.gov/government/departments/public-works' },
    'email', { cities: ['atlanta'], zipCodes: [], radiusKm: 30 }
  ),
  // Nashville
  dept('nashville-tn-public-works', 'Nashville Public Works', 'public_works',
    city('Nashville', 'Nashville', 'TN', 'US', 36.1627, -86.7816),
    { email: 'pw.web@nashville.gov', phone: '615-862-8750', website: 'https://www.nashville.gov/departments/public-works' },
    'email', { cities: ['nashville'], zipCodes: [], radiusKm: 30 }
  ),
  // Portland
  dept('portland-or-public-works', 'Portland Bureau of Transportation', 'public_works',
    city('City of Portland', 'Portland', 'OR', 'US', 45.5051, -122.6750),
    { email: 'pbot@portlandoregon.gov', phone: '503-823-5185', website: 'https://www.portland.gov/transportation' },
    'email', { cities: ['portland'], zipCodes: [], radiusKm: 25 }
  ),
  // Las Vegas
  dept('las-vegas-nv-public-works', 'Las Vegas Public Works', 'public_works',
    city('City of Las Vegas', 'Las Vegas', 'NV', 'US', 36.1699, -115.1398),
    { email: 'publicworks@lasvegasnevada.gov', phone: '702-229-6251', website: 'https://www.lasvegasnevada.gov/Government/Departments/Public-Works' },
    'email', { cities: ['las vegas'], zipCodes: [], radiusKm: 30 }
  ),
  // Minneapolis
  dept('minneapolis-mn-public-works', 'Minneapolis Public Works', 'public_works',
    city('City of Minneapolis', 'Minneapolis', 'MN', 'US', 44.9778, -93.2650),
    { email: 'public.works@minneapolismn.gov', phone: '612-673-2411', website: 'https://www.minneapolismn.gov/government/departments/public-works' },
    'email', { cities: ['minneapolis'], zipCodes: [], radiusKm: 20 }
  ),
  // New Orleans
  dept('new-orleans-la-public-works', 'New Orleans Department of Public Works', 'public_works',
    city('City of New Orleans', 'New Orleans', 'LA', 'US', 29.9511, -90.0715),
    { email: 'dpw@nola.gov', phone: '504-658-8000', website: 'https://nola.gov/dpw' },
    'email', { cities: ['new orleans'], zipCodes: [], radiusKm: 25 }
  ),
  // San Jose
  dept('san-jose-ca-public-works', 'San José Department of Transportation', 'public_works',
    city('City of San José', 'San Jose', 'CA', 'US', 37.3382, -121.8863),
    { email: 'dot@sanjoseca.gov', phone: '408-535-3850', website: 'https://www.sanjoseca.gov/your-government/departments-offices/transportation' },
    'email', { cities: ['san jose'], zipCodes: [], radiusKm: 30 }
  ),
  // Baltimore
  dept('baltimore-md-public-works', 'Baltimore City Department of Public Works', 'public_works',
    city('Baltimore', 'Baltimore', 'MD', 'US', 39.2904, -76.6122),
    { email: '311@baltimorecity.gov', phone: '311', website: 'https://publicworks.baltimorecity.gov' },
    'email', { cities: ['baltimore'], zipCodes: [], radiusKm: 20 }
  ),
  // Charlotte
  dept('charlotte-nc-public-works', 'Charlotte Department of Transportation', 'public_works',
    city('City of Charlotte', 'Charlotte', 'NC', 'US', 35.2271, -80.8431),
    { email: 'cdot@charlottenc.gov', phone: '311', website: 'https://www.charlottenc.gov/cdot' },
    'email', { cities: ['charlotte'], zipCodes: [], radiusKm: 35 }
  ),
  // Columbus
  dept('columbus-oh-public-works', 'Columbus Public Service Department', 'public_works',
    city('City of Columbus', 'Columbus', 'OH', 'US', 39.9612, -82.9988),
    { email: 'publicservice@columbus.gov', phone: '311', website: 'https://www.columbus.gov/publicservice' },
    'email', { cities: ['columbus'], zipCodes: [], radiusKm: 40 }
  ),
  // Indianapolis
  dept('indianapolis-in-public-works', 'Indianapolis DPW', 'public_works',
    city('Indianapolis', 'Indianapolis', 'IN', 'US', 39.7684, -86.1581),
    { email: 'dpw@indy.gov', phone: '317-327-4622', website: 'https://www.indy.gov/activity/dpw' },
    'email', { cities: ['indianapolis'], zipCodes: [], radiusKm: 50 }
  ),
  // Memphis
  dept('memphis-tn-public-works', 'Memphis Division of Public Works', 'public_works',
    city('Memphis', 'Memphis', 'TN', 'US', 35.1495, -90.0490),
    { email: 'publicworks@memphistn.gov', phone: '311', website: 'https://www.memphistn.gov/government/public-works' },
    'email', { cities: ['memphis'], zipCodes: [], radiusKm: 40 }
  ),
  // Detroit
  dept('detroit-mi-public-works', 'Detroit Department of Public Works', 'public_works',
    city('City of Detroit', 'Detroit', 'MI', 'US', 42.3314, -83.0458),
    { email: 'dpw@detroitmi.gov', phone: '313-224-3620', website: 'https://detroitmi.gov/departments/public-works' },
    'email', { cities: ['detroit'], zipCodes: [], radiusKm: 30 }
  ),
  // Louisville
  dept('louisville-ky-public-works', 'Louisville Metro Public Works', 'public_works',
    city('Louisville', 'Louisville', 'KY', 'US', 38.2527, -85.7585),
    { email: 'publicworks@louisvilleky.gov', phone: '311', website: 'https://louisvilleky.gov/government/public-works' },
    'email', { cities: ['louisville'], zipCodes: [], radiusKm: 40 }
  )
];

// ════════════════════════════════════════════════════════════════════════════
// INTERNATIONAL — internal queue (cities claim their portal)
// ════════════════════════════════════════════════════════════════════════════
const INTERNATIONAL = [
  // UK
  dept('london-uk-transport', 'Transport for London - Road Network', 'public_works',
    city('Transport for London', 'London', 'England', 'UK', 51.5074, -0.1278),
    { email: 'street.information@tfl.gov.uk', phone: '+44 343 222 1234', website: 'https://tfl.gov.uk' },
    'internal', { cities: ['london'], zipCodes: [], radiusKm: 30 }
  ),
  dept('manchester-uk-public-works', 'Manchester City Council Highways', 'public_works',
    city('Manchester City Council', 'Manchester', 'England', 'UK', 53.4808, -2.2426),
    { email: 'highways@manchester.gov.uk', phone: '+44 161 234 5000', website: 'https://www.manchester.gov.uk' },
    'internal', { cities: ['manchester'], zipCodes: [], radiusKm: 20 }
  ),

  // Canada
  dept('vancouver-bc-public-works', 'Vancouver Engineering Services', 'public_works',
    city('City of Vancouver', 'Vancouver', 'BC', 'CA', 49.2827, -123.1207),
    { email: '311@vancouver.ca', phone: '311', website: 'https://vancouver.ca/streets-transportation' },
    'email', { cities: ['vancouver'], zipCodes: [], radiusKm: 25 }
  ),
  dept('calgary-ab-public-works', 'Calgary Roads', 'public_works',
    city('City of Calgary', 'Calgary', 'AB', 'CA', 51.0447, -114.0719),
    { email: '311@calgary.ca', phone: '311', website: 'https://www.calgary.ca/roads.html' },
    'email', { cities: ['calgary'], zipCodes: [], radiusKm: 40 }
  ),
  dept('montreal-qc-public-works', 'Ville de Montréal Travaux Publics', 'public_works',
    city('Ville de Montréal', 'Montreal', 'QC', 'CA', 45.5017, -73.5673),
    { email: '311@montreal.ca', phone: '311', website: 'https://montreal.ca/services/signaler-probleme-sur-le-domaine-public' },
    'email', { cities: ['montreal', 'montréal'], zipCodes: [], radiusKm: 30 }
  ),

  // Australia
  dept('sydney-nsw-public-works', 'City of Sydney Engineering', 'public_works',
    city('City of Sydney', 'Sydney', 'NSW', 'AU', -33.8688, 151.2093),
    { email: 'council@cityofsydney.nsw.gov.au', phone: '+61 2 9265 9333', website: 'https://www.cityofsydney.nsw.gov.au' },
    'internal', { cities: ['sydney'], zipCodes: [], radiusKm: 25 }
  ),
  dept('melbourne-vic-public-works', 'City of Melbourne Infrastructure', 'public_works',
    city('City of Melbourne', 'Melbourne', 'VIC', 'AU', -37.8136, 144.9631),
    { email: 'council@melbourne.vic.gov.au', phone: '+61 3 9658 9658', website: 'https://www.melbourne.vic.gov.au' },
    'internal', { cities: ['melbourne'], zipCodes: [], radiusKm: 20 }
  ),

  // Latin America
  dept('mexico-city-mx-public-works', 'CDMX Obras Públicas', 'public_works',
    city('Ciudad de México', 'Mexico City', 'CDMX', 'MX', 19.4326, -99.1332),
    { email: 'obrasvialescdmx@gmail.com', phone: '+52 55 5658 1111', website: 'https://www.cdmx.gob.mx/tramites/servicio/reporte-baches' },
    'internal', { cities: ['mexico city', 'ciudad de mexico', 'cdmx'], zipCodes: [], radiusKm: 50 }
  ),
  dept('bogota-co-public-works', 'IDU Bogotá', 'public_works',
    city('Bogotá', 'Bogotá', 'Cundinamarca', 'CO', 4.7110, -74.0721),
    { email: 'atencionciudadano@idu.gov.co', phone: '+57 1 385 8000', website: 'https://www.idu.gov.co' },
    'internal', { cities: ['bogotá', 'bogota'], zipCodes: [], radiusKm: 40 }
  ),
  dept('sao-paulo-br-public-works', 'Prefeitura de São Paulo SIURB', 'public_works',
    city('Prefeitura de São Paulo', 'São Paulo', 'SP', 'BR', -23.5505, -46.6333),
    { email: 'siurb@prefeitura.sp.gov.br', phone: '156', website: 'https://www.prefeitura.sp.gov.br/cidade/secretarias/infraestrutura' },
    'internal', { cities: ['são paulo', 'sao paulo'], zipCodes: [], radiusKm: 60 }
  ),

  // Europe
  dept('madrid-es-public-works', 'Ayuntamiento de Madrid Vías y Espacios Públicos', 'public_works',
    city('Ayuntamiento de Madrid', 'Madrid', 'Community of Madrid', 'ES', 40.4168, -3.7038),
    { email: 'avisoaviarios@madrid.es', phone: '+34 010', website: 'https://www.madrid.es/portal/site/munimadrid' },
    'internal', { cities: ['madrid'], zipCodes: [], radiusKm: 30 }
  ),
  dept('berlin-de-public-works', 'Berliner Senatsverwaltung für Verkehr', 'public_works',
    city('Land Berlin', 'Berlin', 'Berlin', 'DE', 52.5200, 13.4050),
    { email: 'info@senuvk.berlin.de', phone: '+49 30 9025 0', website: 'https://www.berlin.de/senuvk/verkehr' },
    'internal', { cities: ['berlin'], zipCodes: [], radiusKm: 35 }
  ),
  dept('paris-fr-public-works', 'Mairie de Paris Voirie', 'public_works',
    city('Mairie de Paris', 'Paris', 'Île-de-France', 'FR', 48.8566, 2.3522),
    { email: 'dpe@paris.fr', phone: '+33 39 75', website: 'https://www.paris.fr/pages/signalement-de-problemes-7785' },
    'internal', { cities: ['paris'], zipCodes: [], radiusKm: 25 }
  ),
  dept('amsterdam-nl-public-works', 'Amsterdam Gemeente Openbare Ruimte', 'public_works',
    city('Gemeente Amsterdam', 'Amsterdam', 'North Holland', 'NL', 52.3676, 4.9041),
    { email: 'meldingen@amsterdam.nl', phone: '+31 14 020', website: 'https://meldingen.amsterdam.nl' },
    'internal', { cities: ['amsterdam'], zipCodes: [], radiusKm: 15 }
  ),
  dept('rome-it-public-works', 'Roma Capitale Lavori Pubblici', 'public_works',
    city('Roma Capitale', 'Rome', 'Lazio', 'IT', 41.9028, 12.4964),
    { email: 'rup@comune.roma.it', phone: '+39 06 0606', website: 'https://www.comune.roma.it' },
    'internal', { cities: ['rome', 'roma'], zipCodes: [], radiusKm: 35 }
  ),

  // Asia
  dept('tokyo-jp-public-works', 'Tokyo Metropolitan Government Roads', 'public_works',
    city('Tokyo Metropolitan Government', 'Tokyo', 'Tokyo', 'JP', 35.6762, 139.6503),
    { email: 'soumu@kensetsu.metro.tokyo.jp', phone: '+81 3 5321 1111', website: 'https://www.kensetsu.metro.tokyo.lg.jp' },
    'internal', { cities: ['tokyo'], zipCodes: [], radiusKm: 50 }
  ),
  dept('singapore-sg-public-works', 'Land Transport Authority Singapore', 'public_works',
    city('Land Transport Authority', 'Singapore', 'Singapore', 'SG', 1.3521, 103.8198),
    { email: 'lta_pco@lta.gov.sg', phone: '+65 1800 2255 582', website: 'https://www.lta.gov.sg' },
    'internal', { cities: ['singapore'], zipCodes: [], radiusKm: 30 }
  ),
  dept('dubai-ae-public-works', 'Dubai Roads and Transport Authority', 'public_works',
    city('Roads and Transport Authority', 'Dubai', 'Dubai', 'AE', 25.2048, 55.2708),
    { email: 'customerservice@rta.ae', phone: '800 9090', website: 'https://www.rta.ae' },
    'internal', { cities: ['dubai'], zipCodes: [], radiusKm: 40 }
  )
];

// ════════════════════════════════════════════════════════════════════════════
export const MUNICIPALITIES = [...FLORIDA, ...OPEN311, ...US_CITIES, ...INTERNATIONAL];

export default MUNICIPALITIES;
