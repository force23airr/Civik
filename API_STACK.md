# Civik — API Integration Stack

Strategic API integrations that transform Civik from a reporting app into a full data pipeline: camera → plate recognition → incident enrichment → government submission.

---

## Tier 1 — Integrate Now (Core Value)

### Plate Recognizer (License Plate Recognition)
- **What it does:** Reads plates from photos/video — 90+ countries, handles glare, blur, night, fast vehicles
- **Why it matters:** Replaces the current mock plate detection with production-grade accuracy
- **Key features:** Returns plate number, vehicle make, model, color. Cloud + on-premise (Jetson compatible)
- **Integration point:** `server/services/plateRecognition/plateDetector.js` — replace mock with real API calls
- **Pricing:** Free tier (2,500 lookups/month), paid plans scale with volume
- **URL:** https://platerecognizer.com

### Open311 / 311 Municipal APIs
- **What it does:** Submits reports directly into city 311 systems
- **Why it matters:** Already partially built in `server/services/municipal/routingService.js` — just needs real API keys
- **Cities live:** Chicago, SF, Boston, DC, Toronto, Bloomington IN
- **Integration point:** Already coded, needs activation with real credentials per city

---

## Tier 2 — Integrate Next (Data Enrichment)

### HERE Traffic API
- **What it does:** Real-time traffic flow + incidents across 70+ countries, updated every 2 minutes
- **Why it matters:** Enriches the heat map with live traffic data. Correlate pothole reports with traffic patterns
- **Key features:** Incident ID, road closure status, incident type, criticality
- **Integration point:** Feed into alerts module + heat map layer overlay
- **URL:** https://developer.here.com/products/traffic

### 511 Municipal Open Data (per city)
- **What it does:** Free traffic events, road closures, work zone data from government sources
- **Why it matters:** Shows users what the city already knows about — Civik adds what they don't
- **Key features:** Partners include Google, Apple, HERE, Transit App
- **Integration point:** Merge with heat map to show government data alongside crowdsourced data
- **URL:** https://511.org (SF Bay model — replicate per city)

---

## Tier 3 — Integrate for Premium Features

### Rekor Incident Detection API
- **What it does:** Data fusion engine — sensors, traffic systems, social media, weather → structured incident data
- **Why it matters:** Auto-enriches reports with severity, affected lanes, estimated clearance time, confidence score
- **Key features:** Structured JSON with incident type, severity, confidence — perfect for police portal prioritization
- **Integration point:** Enrich incoming incidents before routing to police/municipal departments
- **URL:** https://rekor.ai

### Rekor CarCheck / OpenALPR
- **What it does:** Real-time plate + vehicle identification with direction of travel
- **Why it matters:** Built specifically for law enforcement and community safety use cases
- **Key features:** Plate, make, model, color, direction — more enforcement-focused than Plate Recognizer
- **Integration point:** Alternative to Plate Recognizer for police-facing features
- **URL:** https://openalpr.com

### Azure Maps Traffic + Weather API
- **What it does:** Real-time traffic + weather data combined
- **Why it matters:** Weather context makes incident reports dramatically more valuable for insurance underwriting and AV training data. A rainy night incident is worth more than a clear day incident to a model trainer
- **Key features:** Current conditions, historical weather, forecasts attached to GPS coordinates
- **Integration point:** Auto-attach weather context to every submitted incident
- **URL:** https://learn.microsoft.com/en-us/azure/azure-maps/

### TomTom Traffic API
- **What it does:** Real-time + historical traffic analysis using Floating Car Data
- **Why it matters:** Enterprise data marketplace buyers would pay for enriched datasets combining Civik reports + TomTom traffic patterns
- **Integration point:** Data marketplace export enrichment
- **URL:** https://developer.tomtom.com/traffic-api

---

## The Full Pipeline

```
Driver captures footage
    ↓
Plate Recognizer extracts plate + vehicle data
    ↓
Azure Weather API attaches weather context
    ↓
HERE Traffic API adds traffic flow data
    ↓
Rekor enriches with severity + confidence score
    ↓
Civik routes to correct department:
    ├── Open311 API → city 311 system (Chicago, SF, etc.)
    ├── 511 data → cross-reference with known issues
    └── Email → departments without API access
    ↓
Structured, enriched report lands in municipal/police system
    ↓
Data feeds into marketplace for insurance/fleet/AV companies
```

---

## Integration Priority

| Priority | API | Effort | Impact | Cost |
|---|---|---|---|---|
| 1 | Plate Recognizer | 1-2 days | High — replaces mock plate detection | Free tier available |
| 2 | Open311 activation | 1 day | High — already coded, just needs API keys | Free (government APIs) |
| 3 | HERE Traffic | 2-3 days | Medium — enriches heat map | Free tier (250K calls/month) |
| 4 | Azure Weather | 1-2 days | Medium — adds context to every report | Free tier available |
| 5 | 511 Municipal | 1 day per city | Medium — government data overlay | Free |
| 6 | Rekor Incident | 3-5 days | High — auto-enrichment engine | Enterprise pricing |
| 7 | TomTom Traffic | 2-3 days | Low now, high later — marketplace data | Free tier available |

---

## Revenue Impact

Each API layer increases the value of the data:
- **Raw pothole photo:** Worth $0 to a data buyer
- **Photo + plate + GPS + timestamp:** Worth something
- **Photo + plate + GPS + weather + traffic flow + severity score:** Worth significantly more to insurance companies, fleet operators, AV training companies, and municipal planners

The API stack is what turns crowdsourced noise into structured intelligence that enterprises will pay for.
