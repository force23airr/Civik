import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ProtectedImage from '../components/ProtectedImage';
import './MyParkingReports.css';

function MyParkingReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReports();
  }, [filter, page]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit: 15 });
      if (filter) params.append('status', filter);
      const res = await api.get(`/parking-violations/my-reports?${params}`);
      setReports(res.data.reports);
      setTotalPages(res.data.pages);
    } catch (err) {
      console.error('Failed to fetch parking reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    const colors = {
      submitted: '#f59e0b',
      assigned: '#3b82f6',
      under_review: '#8b5cf6',
      approved: '#22c55e',
      denied: '#ef4444',
      closed: '#64748b'
    };
    return colors[status] || '#64748b';
  };

  return (
    <div className="my-parking-reports">
      <div className="container">
        <div className="page-header">
          <h1>My Parking Reports</h1>
          <Link to="/report-parking" className="btn-new-report">
            + New Report
          </Link>
        </div>

        <div className="filter-bar">
          {['', 'submitted', 'assigned', 'under_review', 'approved', 'denied'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f ? f.replace(/_/g, ' ') : 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <p>No parking violation reports yet.</p>
            <Link to="/report-parking" className="btn-primary">Report a Parking Violation</Link>
          </div>
        ) : (
          <div className="reports-list">
            {reports.map(report => (
              <div key={report._id} className="report-card">
                <div className="report-header">
                  <span className="report-number">{report.reportNumber}</span>
                  <span className="report-status" style={{ color: statusColor(report.status) }}>
                    {report.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="report-body">
                  <p className="report-type">{report.violationTypeDisplay}</p>
                  <p className="report-location">{report.location?.address || `${report.location?.city}, ${report.location?.state}`}</p>
                  <p className="report-date">{new Date(report.createdAt).toLocaleDateString()}</p>
                </div>

                {report.assignedStation && (
                  <div className="report-station">
                    Assigned to: {report.assignedStation.name}
                  </div>
                )}

                {report.reward?.awarded && (
                  <div className="report-reward">
                    Earned: {report.reward.amount} credits (${(report.reward.amount / 100).toFixed(2)})
                  </div>
                )}

                {report.review?.status === 'denied' && report.review.denialReason && (
                  <div className="report-denial">
                    Reason: {report.review.denialReason}
                  </div>
                )}

                {report.photos?.length > 0 && (
                  <div className="report-thumbs">
	                    {report.photos.slice(0, 3).map((photo, i) => (
	                      <ProtectedImage
	                        key={i}
	                        src={photo.path || `/uploads/${photo.filename}`}
	                        alt="Evidence"
	                        className="thumb"
	                      />
                    ))}
                    {report.photos.length > 3 && (
                      <span className="more-photos">+{report.photos.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyParkingReports;
