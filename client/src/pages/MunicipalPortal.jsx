import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './MunicipalPortal.css';

const STATUS_OPTIONS = ['all', 'submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected'];

const STATUS_COLORS = {
  submitted: { bg: '#f59e0b22', color: '#f59e0b', label: 'Submitted' },
  acknowledged: { bg: '#3b82f622', color: '#3b82f6', label: 'Acknowledged' },
  in_progress: { bg: '#f9731622', color: '#f97316', label: 'In Progress' },
  resolved: { bg: '#22c55e22', color: '#22c55e', label: 'Resolved' },
  rejected: { bg: '#ef444422', color: '#ef4444', label: 'Rejected' },
};

const SEVERITY_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#64748b22', color: '#64748b', label: status };
  return (
    <span
      className="mp-status-badge"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}
    >
      {s.label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MunicipalPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('queue');
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const limit = 15;

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (userRole && userRole !== 'municipal_worker' && userRole !== 'admin') {
      navigate('/');
      return;
    }
  }, [token, userRole, navigate]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await api.get('/municipal/worker/queue', { params });
      setReports(response.data.reports || response.data.data || []);
      setTotalPages(response.data.totalPages || Math.ceil((response.data.total || 0) / limit) || 1);
    } catch (error) {
      console.error('Error fetching queue:', error);
      if (error.response?.status === 403) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/municipal/worker/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchQueue();
    }
  }, [fetchQueue, token]);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [fetchStats, token]);

  const handleStatusUpdate = async (reportId, newStatus) => {
    setUpdating(true);
    try {
      const body = { status: newStatus };
      if (notes.trim()) body.notes = notes.trim();
      if (ticketNumber.trim()) body.ticketNumber = ticketNumber.trim();

      await api.put(`/municipal/worker/reports/${reportId}`, body);

      setSelectedReport((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              statusHistory: [
                ...(prev.statusHistory || []),
                { status: newStatus, timestamp: new Date().toISOString(), notes: notes.trim() || undefined },
              ],
            }
          : null
      );
      setNotes('');
      fetchQueue();
      fetchStats();
    } catch (error) {
      alert('Error updating report: ' + (error.response?.data?.message || error.message));
    } finally {
      setUpdating(false);
    }
  };

  const handleRowClick = (report) => {
    setSelectedReport(report);
    setNotes('');
    setTicketNumber(report.ticketNumber || '');
    setActiveTab('queue');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  const getNextStatuses = (currentStatus) => {
    switch (currentStatus) {
      case 'submitted':
        return ['acknowledged', 'rejected'];
      case 'acknowledged':
        return ['in_progress', 'rejected'];
      case 'in_progress':
        return ['resolved', 'rejected'];
      default:
        return [];
    }
  };

  const renderQueueTable = () => (
    <div className="mp-queue-section">
      <div className="mp-queue-controls">
        <h2>Report Queue</h2>
        <div className="mp-filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : STATUS_COLORS[s]?.label || s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mp-table-wrapper">
        {loading ? (
          <div className="mp-loading">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="mp-empty">No reports found for this filter.</div>
        ) : (
          <table className="mp-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Type</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Reporter</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r._id}
                  className={`mp-row ${selectedReport?._id === r._id ? 'mp-row-active' : ''}`}
                  onClick={() => handleRowClick(r)}
                >
                  <td className="mp-cell-id">{r.reportNumber || r._id?.slice(-8).toUpperCase()}</td>
                  <td>{r.incidentType?.replace(/_/g, ' ') || r.type?.replace(/_/g, ' ') || 'N/A'}</td>
                  <td className="mp-cell-location">
                    <span className="mp-address">{r.location?.address || 'N/A'}</span>
                    {r.location?.city && <span className="mp-city">{r.location.city}</span>}
                  </td>
                  <td>
                    <span
                      className="mp-severity"
                      style={{ color: SEVERITY_COLORS[r.severity] || '#94a3b8' }}
                    >
                      {r.severity || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="mp-cell-date">{formatDate(r.createdAt || r.submittedAt)}</td>
                  <td>{r.reporter?.username || r.reporterName || 'Anonymous'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mp-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderReportDetail = () => {
    if (!selectedReport) {
      return (
        <div className="mp-detail-empty">
          <div className="mp-detail-empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"
                fill="#475569"
              />
            </svg>
          </div>
          <h3>Select a report from the queue</h3>
          <p>Click any row to view details and take action</p>
        </div>
      );
    }

    const r = selectedReport;
    const nextStatuses = getNextStatuses(r.status);

    return (
      <div className="mp-detail">
        <div className="mp-detail-header">
          <div>
            <h2>Report {r.reportNumber || r._id?.slice(-8).toUpperCase()}</h2>
            <StatusBadge status={r.status} />
          </div>
          <button className="mp-btn-close" onClick={() => setSelectedReport(null)}>
            Close
          </button>
        </div>

        <div className="mp-detail-grid">
          <div className="mp-detail-field">
            <label>Incident Type</label>
            <p>{r.incidentType?.replace(/_/g, ' ') || r.type?.replace(/_/g, ' ') || 'N/A'}</p>
          </div>
          <div className="mp-detail-field">
            <label>Severity</label>
            <p style={{ color: SEVERITY_COLORS[r.severity] || '#94a3b8', fontWeight: 600 }}>
              {r.severity?.toUpperCase() || 'N/A'}
            </p>
          </div>
          <div className="mp-detail-field">
            <label>Location</label>
            <p>{r.location?.address || 'N/A'}</p>
            {r.location?.city && <p className="mp-subtext">{r.location.city}, {r.location?.state || ''}</p>}
          </div>
          <div className="mp-detail-field">
            <label>Submitted</label>
            <p>{formatDate(r.createdAt || r.submittedAt)}</p>
          </div>
          <div className="mp-detail-field">
            <label>Reporter</label>
            <p>{r.reporter?.username || r.reporterName || 'Anonymous'}</p>
          </div>
          <div className="mp-detail-field">
            <label>GPS Coordinates</label>
            <p>
              {r.location?.coordinates
                ? `${r.location.coordinates[1]?.toFixed(6)}, ${r.location.coordinates[0]?.toFixed(6)}`
                : r.location?.lat && r.location?.lng
                ? `${r.location.lat.toFixed(6)}, ${r.location.lng.toFixed(6)}`
                : 'N/A'}
            </p>
          </div>
        </div>

        {r.description && (
          <div className="mp-detail-section">
            <h3>Description</h3>
            <p className="mp-description">{r.description}</p>
          </div>
        )}

        {/* Photo thumbnails */}
        {r.photos && r.photos.length > 0 && (
          <div className="mp-detail-section">
            <h3>Photos ({r.photos.length})</h3>
            <div className="mp-photo-grid">
              {r.photos.map((photo, idx) => (
                <div key={idx} className="mp-photo-thumb">
                  <img src={photo.url || photo} alt={`Report photo ${idx + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {(r.evidence && r.evidence.length > 0) && (
          <div className="mp-detail-section">
            <h3>Evidence ({r.evidence.length})</h3>
            <div className="mp-photo-grid">
              {r.evidence.map((ev, idx) => (
                <div key={idx} className="mp-photo-thumb">
                  <img src={ev.url || ev.thumbnailUrl || ev} alt={`Evidence ${idx + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map placeholder */}
        <div className="mp-detail-section">
          <h3>Location Map</h3>
          <div className="mp-map-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"
                fill="#3b82f6"
              />
            </svg>
            <p>
              {r.location?.address || 'Location data'}
              {r.location?.coordinates && (
                <span className="mp-coords">
                  ({r.location.coordinates[1]?.toFixed(4)}, {r.location.coordinates[0]?.toFixed(4)})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Ticket Number */}
        <div className="mp-detail-section">
          <h3>Internal Tracking</h3>
          <div className="mp-input-group">
            <label>Ticket Number</label>
            <input
              type="text"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="e.g. PW-2026-0412"
              className="mp-input"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mp-detail-section">
          <h3>Worker Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this report (visible in status history)..."
            className="mp-textarea"
            rows={3}
          />
        </div>

        {/* Status actions */}
        {nextStatuses.length > 0 && (
          <div className="mp-detail-section">
            <h3>Update Status</h3>
            <div className="mp-action-buttons">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  className={`mp-btn mp-btn-${s}`}
                  disabled={updating}
                  onClick={() => handleStatusUpdate(r._id, s)}
                >
                  {updating ? 'Updating...' : STATUS_COLORS[s]?.label || s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status History */}
        {r.statusHistory && r.statusHistory.length > 0 && (
          <div className="mp-detail-section">
            <h3>Status History</h3>
            <div className="mp-timeline">
              {r.statusHistory.map((entry, idx) => (
                <div key={idx} className="mp-timeline-item">
                  <div
                    className="mp-timeline-dot"
                    style={{ background: STATUS_COLORS[entry.status]?.color || '#64748b' }}
                  />
                  <div className="mp-timeline-content">
                    <div className="mp-timeline-header">
                      <StatusBadge status={entry.status} />
                      <span className="mp-timeline-date">{formatDate(entry.timestamp || entry.date)}</span>
                    </div>
                    {entry.notes && <p className="mp-timeline-notes">{entry.notes}</p>}
                    {entry.updatedBy && (
                      <span className="mp-timeline-user">by {entry.updatedBy.username || entry.updatedBy}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => (
    <div className="mp-stats-panel">
      <h2>Department Statistics</h2>
      {!stats ? (
        <div className="mp-loading">Loading stats...</div>
      ) : (
        <>
          <div className="mp-stats-grid">
            <div className="mp-stat-card">
              <span className="mp-stat-value">{stats.totalReportsThisMonth ?? stats.totalReports ?? 0}</span>
              <span className="mp-stat-label">Reports This Month</span>
            </div>
            <div className="mp-stat-card mp-stat-resolved">
              <span className="mp-stat-value">{stats.resolvedCount ?? stats.resolved ?? 0}</span>
              <span className="mp-stat-label">Resolved</span>
            </div>
            <div className="mp-stat-card mp-stat-time">
              <span className="mp-stat-value">
                {stats.averageResolutionTime
                  ? typeof stats.averageResolutionTime === 'number'
                    ? `${Math.round(stats.averageResolutionTime)}h`
                    : stats.averageResolutionTime
                  : 'N/A'}
              </span>
              <span className="mp-stat-label">Avg Resolution Time</span>
            </div>
            <div className="mp-stat-card">
              <span className="mp-stat-value">
                {stats.pendingCount ?? stats.submitted ?? stats.pending ?? 0}
              </span>
              <span className="mp-stat-label">Pending</span>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="mp-breakdown">
            <h3>Reports by Status</h3>
            <div className="mp-breakdown-list">
              {(stats.byStatus || stats.statusBreakdown || []).map((item) => (
                <div key={item.status || item._id} className="mp-breakdown-row">
                  <StatusBadge status={item.status || item._id} />
                  <span className="mp-breakdown-count">{item.count}</span>
                  <div className="mp-breakdown-bar">
                    <div
                      className="mp-breakdown-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          ((item.count / (stats.totalReportsThisMonth || stats.totalReports || 1)) * 100)
                        )}%`,
                        background: STATUS_COLORS[item.status || item._id]?.color || '#64748b',
                      }}
                    />
                  </div>
                </div>
              ))}
              {!(stats.byStatus || stats.statusBreakdown || []).length && (
                <p className="mp-subtext">No breakdown data available</p>
              )}
            </div>
          </div>

          {/* Recently Resolved */}
          {(stats.recentlyResolved || []).length > 0 && (
            <div className="mp-recent">
              <h3>Recently Resolved</h3>
              {stats.recentlyResolved.map((r) => (
                <div key={r._id} className="mp-recent-item">
                  <div className="mp-recent-info">
                    <span className="mp-recent-id">
                      {r.reportNumber || r._id?.slice(-8).toUpperCase()}
                    </span>
                    <span className="mp-recent-type">
                      {r.incidentType?.replace(/_/g, ' ') || r.type?.replace(/_/g, ' ') || ''}
                    </span>
                  </div>
                  <span className="mp-recent-date">{formatDate(r.resolvedAt || r.updatedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="mp-container">
      {/* Header */}
      <header className="mp-header">
        <div className="mp-header-left">
          <div className="mp-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7V10C2 16.5 6.84 22.47 12 24C17.16 22.47 22 16.5 22 10V7L12 2ZM12 11.99H20C19.47 16.11 16.24 19.81 12 21.23V12H4V8.3L12 4.19V11.99Z"
                fill="#3b82f6"
              />
            </svg>
            <h1>Municipal Worker Portal</h1>
          </div>
          <span className="mp-subtitle">Infrastructure Report Management</span>
        </div>
        <div className="mp-header-right">
          <nav className="mp-tabs">
            <button
              className={`mp-tab ${activeTab === 'queue' ? 'mp-tab-active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue
            </button>
            <button
              className={`mp-tab ${activeTab === 'stats' ? 'mp-tab-active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              Stats
            </button>
          </nav>
          <button className="mp-btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="mp-body">
        {activeTab === 'queue' ? (
          <div className="mp-queue-layout">
            <div className="mp-queue-left">
              {renderQueueTable()}
            </div>
            <div className="mp-queue-right">
              {renderReportDetail()}
            </div>
          </div>
        ) : (
          renderStats()
        )}
      </div>
    </div>
  );
}
