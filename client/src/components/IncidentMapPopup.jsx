import React from 'react';
import { API_URL } from '../services/api';

const typeColors = {
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

const severityColors = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444'
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const formatType = (type) => {
  if (!type) return 'Unknown';
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Derive the API origin from API_URL (strip /api suffix)
const apiOrigin = API_URL.replace(/\/api\/?$/, '');

const IncidentMapPopup = ({ incident }) => {
  if (!incident) return null;

  const {
    type,
    severity,
    description,
    mediaFiles,
    status,
    municipalReports,
    createdAt,
    reporter
  } = incident;

  const typeColor = typeColors[type] || '#94a3b8';
  const sevColor = severityColors[severity] || '#94a3b8';
  const truncDesc =
    description && description.length > 150
      ? description.slice(0, 150) + '...'
      : description;
  const firstPhoto =
    mediaFiles && mediaFiles.length > 0 ? mediaFiles[0] : null;
  const photoUrl = firstPhoto
    ? firstPhoto.url
      ? firstPhoto.url.startsWith('http')
        ? firstPhoto.url
        : `${apiOrigin}${firstPhoto.url}`
      : firstPhoto.path
        ? `${apiOrigin}${firstPhoto.path}`
        : null
    : null;
  const department =
    municipalReports && municipalReports.length > 0
      ? municipalReports[0].department || municipalReports[0].departmentName
      : null;

  const popupStyle = {
    background: '#1e293b',
    color: '#f1f5f9',
    padding: '10px',
    borderRadius: '8px',
    minWidth: '220px',
    maxWidth: '280px',
    fontSize: '13px',
    lineHeight: '1.4'
  };

  const badgeStyle = (color) => ({
    display: 'inline-block',
    background: color + '22',
    color: color,
    border: `1px solid ${color}55`,
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    marginRight: '6px'
  });

  return (
    <div style={popupStyle}>
      <div style={{ marginBottom: '8px' }}>
        <span style={badgeStyle(typeColor)}>{formatType(type)}</span>
        {severity && (
          <span style={badgeStyle(sevColor)}>
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </span>
        )}
      </div>

      {truncDesc && (
        <p style={{ margin: '0 0 8px', color: '#cbd5e1', fontSize: '12px' }}>
          {truncDesc}
        </p>
      )}

      {photoUrl && (
        <img
          src={photoUrl}
          alt="Incident"
          style={{
            width: '100%',
            height: '100px',
            objectFit: 'cover',
            borderRadius: '6px',
            marginBottom: '8px'
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#94a3b8'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background:
                status === 'resolved'
                  ? '#22c55e'
                  : status === 'in_progress'
                    ? '#eab308'
                    : '#3b82f6',
              display: 'inline-block'
            }}
          />
          <span>
            {status
              ? status.charAt(0).toUpperCase() +
                status.slice(1).replace('_', ' ')
              : 'Active'}
          </span>
        </div>
        <span>{formatRelativeTime(createdAt)}</span>
      </div>

      {(department || reporter) && (
        <div
          style={{
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid #334155',
            fontSize: '11px',
            color: '#94a3b8',
            display: 'flex',
            justifyContent: 'space-between'
          }}
        >
          {department && <span>Dept: {department}</span>}
          {reporter && (
            <span>
              @{reporter.username || reporter.name || 'anonymous'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default IncidentMapPopup;
