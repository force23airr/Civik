import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMapEvents
} from 'react-leaflet';
import HeatmapLayer from '../components/HeatmapLayer';
import IncidentMapPopup from '../components/IncidentMapPopup';
import api from '../services/api';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './HeatMap.css';

const TYPE_COLORS = {
  infrastructure_pothole: '#f97316',
  infrastructure_road_damage: '#ef4444',
  infrastructure_lighting: '#eab308',
  infrastructure_signage: '#f59e0b',
  infrastructure_construction: '#6b7280',
  weather_flooding: '#3b82f6',
  weather_debris: '#22c55e',
  weather_ice: '#06b6d4',
  traffic_signal_issue: '#8b5cf6',
  traffic_congestion: '#ec4899'
};

const ALL_TYPES = Object.keys(TYPE_COLORS);

const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];

const STATUS_OPTIONS = ['all', 'active', 'resolved'];

const formatType = (type) => {
  if (!type) return 'Unknown';
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Inner component to handle map events
const MapEventHandler = ({ onMoveEnd }) => {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const bounds = map.getBounds();
      onMoveEnd({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
  });
  return null;
};

const HeatMap = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(new Set(ALL_TYPES));
  const [selectedSeverities, setSelectedSeverities] = useState(
    new Set(SEVERITY_LEVELS)
  );
  const [statusFilter, setStatusFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState([25.7617, -80.1918]);
  const [mapZoom, setMapZoom] = useState(11);

  const mapRef = useRef(null);
  const debounceRef = useRef(null);
  const boundsRef = useRef(null);

  // Fetch heatmap data
  const fetchData = useCallback(
    async (bounds) => {
      setLoading(true);
      try {
        const params = {};

        if (bounds) {
          params.north = bounds.north;
          params.south = bounds.south;
          params.east = bounds.east;
          params.west = bounds.west;
        }

        if (selectedTypes.size < ALL_TYPES.length) {
          params.types = Array.from(selectedTypes).join(',');
        }

        if (selectedSeverities.size < SEVERITY_LEVELS.length) {
          params.severities = Array.from(selectedSeverities).join(',');
        }

        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }

        const response = await api.get('/analytics/heatmap', { params });
        setData(response.data?.data || response.data || []);
      } catch (err) {
        console.error('Failed to fetch heatmap data:', err);
      } finally {
        setLoading(false);
      }
    },
    [selectedTypes, selectedSeverities, statusFilter]
  );

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Geolocation on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMapCenter([latitude, longitude]);
          setMapZoom(13);
          if (mapRef.current) {
            mapRef.current.flyTo([latitude, longitude], 13);
          }
        },
        () => {
          // Permission denied or error - keep default center
        },
        { timeout: 5000 }
      );
    }
  }, []);

  // Debounced move handler
  const handleMoveEnd = useCallback(
    (bounds) => {
      boundsRef.current = bounds;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        fetchData(bounds);
      }, 500);
    },
    [fetchData]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Search / geocode
  const handleSearch = async (e) => {
    if (e.key !== 'Enter' || !searchQuery.trim()) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const results = await res.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        if (mapRef.current) {
          mapRef.current.flyTo([latNum, lonNum], 14);
        }
      }
    } catch (err) {
      console.error('Geocode failed:', err);
    }
  };

  // Filter toggles
  const toggleType = (type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleSeverity = (sev) => {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) {
        next.delete(sev);
      } else {
        next.add(sev);
      }
      return next;
    });
  };

  // Click marker to load full incident
  const handleMarkerClick = async (point) => {
    setSelectedIncident(null);
    try {
      // If the point has an incident ID, fetch the full detail
      if (point.incidentId || point._id) {
        const res = await api.get(
          `/incidents/${point.incidentId || point._id}`
        );
        setSelectedIncident(res.data?.data || res.data);
      } else {
        // Build a pseudo-incident from the cluster data
        setSelectedIncident({
          type: point.dominantType || point.type,
          severity: point.dominantSeverity || point.severity,
          description: point.description || `${point.count || 1} report(s) in this area`,
          status: point.status || 'active',
          createdAt: point.createdAt || point.latestReport,
          location: {
            coordinates: [point.lng || point.longitude, point.lat || point.latitude]
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch incident detail:', err);
    }
  };

  // Prepare heat layer points
  const heatPoints = data.map((d) => [
    d.lat || d.latitude || d.location?.coordinates?.[1],
    d.lng || d.longitude || d.location?.coordinates?.[0],
    d.weight || d.count || d.intensity || 1
  ]);

  // Filtered data for circle markers
  const filteredData = data.filter((d) => {
    const type = d.dominantType || d.type;
    const sev = d.dominantSeverity || d.severity;
    if (type && !selectedTypes.has(type)) return false;
    if (sev && !selectedSeverities.has(sev)) return false;
    return true;
  });

  return (
    <div className="heatmap-container">
      {/* Sidebar */}
      <aside className={`heatmap-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h2>Incident Heat Map</h2>

        {/* Search */}
        <input
          type="text"
          className="heatmap-search"
          placeholder="Search location... (press Enter)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
        />

        {/* Issue Type Filters */}
        <div className="heatmap-filter-section">
          <h3>Issue Types</h3>
          <div className="filter-group">
            {ALL_TYPES.map((type) => (
              <label key={type} className="heatmap-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleType(type)}
                />
                <span
                  className="filter-badge"
                  style={{ background: TYPE_COLORS[type] }}
                />
                {formatType(type)}
              </label>
            ))}
          </div>
        </div>

        {/* Severity Filters */}
        <div className="heatmap-filter-section">
          <h3>Severity</h3>
          <div className="filter-group">
            {SEVERITY_LEVELS.map((sev) => (
              <label key={sev} className="heatmap-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedSeverities.has(sev)}
                  onChange={() => toggleSeverity(sev)}
                />
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Status Toggle */}
        <div className="heatmap-filter-section">
          <h3>Status</h3>
          <div className="heatmap-status-toggle">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={statusFilter === opt ? 'active' : ''}
                onClick={() => setStatusFilter(opt)}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Active reports counter */}
        <div className="heatmap-counter">
          <span>Active Reports</span>
          <span className="count">{filteredData.length}</span>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <button
        className="heatmap-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? 'Close Filters' : 'Open Filters'}
      </button>

      {/* Map */}
      <div className="heatmap-map">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <MapEventHandler onMoveEnd={handleMoveEnd} />

          <HeatmapLayer points={heatPoints} />

          {filteredData.map((point, idx) => {
            const lat =
              point.lat || point.latitude || point.location?.coordinates?.[1];
            const lng =
              point.lng || point.longitude || point.location?.coordinates?.[0];
            const type = point.dominantType || point.type;
            const color = TYPE_COLORS[type] || '#94a3b8';

            if (!lat || !lng) return null;

            return (
              <CircleMarker
                key={`${lat}-${lng}-${idx}`}
                center={[lat, lng]}
                radius={6}
                pathOptions={{
                  fillColor: color,
                  color: color,
                  weight: 1,
                  opacity: 0.8,
                  fillOpacity: 0.6
                }}
                eventHandlers={{
                  click: () => handleMarkerClick(point)
                }}
              >
                {selectedIncident && (
                  <Popup>
                    <IncidentMapPopup incident={selectedIncident} />
                  </Popup>
                )}
              </CircleMarker>
            );
          })}
        </MapContainer>

        {loading && <div className="heatmap-loading">Loading data...</div>}

        {data.length >= 1000 && (
          <div className="heatmap-zoom-notice">
            Zoom in for more detail
          </div>
        )}
      </div>

      {/* Report CTA */}
      <Link to="/report" className="heatmap-report-cta">
        + Report an Issue
      </Link>
    </div>
  );
};

export default HeatMap;
