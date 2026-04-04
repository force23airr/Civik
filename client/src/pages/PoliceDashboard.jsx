import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import StatusBadge from '../components/StatusBadge';
import './PoliceDashboard.css';

const API_BASE_URL = '/api/police-portal';

export default function PoliceDashboard() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const axiosConfig = { withCredentials: true };

  useEffect(() => {
    fetchCases();
    fetchStats();
  }, [filter, navigate]);

  const fetchCases = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cases?status=${filter}`, axiosConfig);
      setCases(response.data.cases || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching cases:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/police/login');
      }
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/stats`, axiosConfig);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const loadCaseDetails = async (caseId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cases/${caseId}`, axiosConfig);
      setSelectedCase(response.data);
    } catch (error) {
      console.error('Error loading case:', error);
      alert('Error loading case details');
    }
  };

  const updateStatus = async (status, additionalData = {}) => {
    try {
      await axios.put(
        `${API_BASE_URL}/cases/${selectedCase._id}/status`,
        { status, ...additionalData },
        axiosConfig
      );

      alert(`Case ${status === 'citation_issued' ? 'citation issued' : 'updated'} successfully`);
      setSelectedCase(null);
      fetchCases();
      fetchStats();
    } catch (error) {
      alert('Error updating case: ' + (error.response?.data?.message || error.message));
    }
  };

  const issueCitation = () => {
    const caseNumber = prompt('Enter case number:');
    if (!caseNumber) return;

    const citationNumber = prompt('Enter citation number:');
    if (caseNumber && citationNumber) {
      updateStatus('citation_issued', { caseNumber, citationNumber });
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, axiosConfig);
    } catch (error) {
      // Proceed with local logout
    }
    localStorage.removeItem('userRole');
    navigate('/police/login');
  };

  return (
    <div className="police-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Traffic Violation Review Portal</h1>
          {stats && (
            <div className="quick-stats">
              <span>Pending: {cases.length}</span>
              <span>Citations Issued Today: {stats.department?.citationsIssued || 0}</span>
            </div>
          )}
        </div>
        <div className="header-right">
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Sidebar: Case Queue */}
        <aside className="case-queue">
          <div className="queue-header">
            <h2>Case Queue</h2>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="under_review">Under Review</option>
              <option value="citation_issued">Citations Issued</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div className="case-list">
            {loading ? (
              <p className="empty-message">Loading cases...</p>
            ) : cases.length === 0 ? (
              <p className="empty-message">No cases in this category</p>
            ) : (
              cases.map(c => (
                <div
                  key={c._id}
                  className={`case-card ${selectedCase?._id === c._id ? 'active' : ''}`}
                  onClick={() => loadCaseDetails(c._id)}
                >
                  <div className="case-header">
                    <span className="case-id">{c.reportNumber || c._id.slice(-6)}</span>
                    <StatusBadge status={c.lawEnforcementSubmissions?.[0]?.status || 'pending'} />
                  </div>
                  <div className="case-info">
                    <strong className="case-type">{c.violationType?.replace(/_/g, ' ') || 'Unknown'}</strong>
                    <p className="case-location">{c.location?.address}</p>
                    <p className="case-timestamp">
                      {c.incidentDateTime ? new Date(c.incidentDateTime).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="case-meta">
                    <span>Plate: {c.offendingVehicle?.licensePlate || 'N/A'}</span>
                    <span>{c.evidence?.length || 0} evidence files</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main: Case Detail */}
        <main className="case-detail">
          {!selectedCase ? (
            <div className="empty-state">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 7H4C2.9 7 2 7.9 2 9V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V9C22 7.9 21.1 7 20 7ZM20 20H4V9H20V20ZM9 4H7V2H9V4ZM13 2H11V4H13V2ZM17 4H15V2H17V4Z"
                      fill="#cbd5e1"/>
              </svg>
              <h3>Select a case from the queue to review</h3>
              <p>Click on any case in the left panel to view details and take action</p>
            </div>
          ) : (
            <>
              {/* Case Info */}
              <section className="case-info-section">
                <h2>Case {selectedCase.reportNumber || selectedCase._id}</h2>
                <div className="info-grid">
                  <div>
                    <label>Violation Type</label>
                    <p>{selectedCase.violationType?.replace(/_/g, ' ') || 'Unknown'}</p>
                  </div>
                  <div>
                    <label>Severity</label>
                    <p className={`severity-${selectedCase.severity}`}>
                      {selectedCase.severity || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label>Location</label>
                    <p>{selectedCase.location?.address}</p>
                  </div>
                  <div>
                    <label>Date/Time</label>
                    <p>{selectedCase.incidentDateTime ? new Date(selectedCase.incidentDateTime).toLocaleString() : 'N/A'}</p>
                  </div>
                  <div>
                    <label>License Plate</label>
                    <p><strong>{selectedCase.offendingVehicle?.licensePlate}</strong> ({selectedCase.offendingVehicle?.plateState})</p>
                  </div>
                  <div>
                    <label>Vehicle</label>
                    <p>
                      {selectedCase.offendingVehicle?.color} {selectedCase.offendingVehicle?.make} {selectedCase.offendingVehicle?.model}
                    </p>
                  </div>
                </div>
              </section>

              {/* Description */}
              <section className="description-section">
                <h3>Reporter's Account</h3>
                <p>{selectedCase.description || 'No description provided'}</p>
              </section>

              {/* Video Evidence */}
              {selectedCase.evidence && selectedCase.evidence.length > 0 && (
                <section className="evidence-section">
                  <h3>Video Evidence</h3>
                  {selectedCase.evidence.map((ev, idx) => (
                    <div key={ev._id} className="evidence-item">
                      <h4>Evidence File {idx + 1}</h4>
                      <VideoPlayer
                        src={`${API_BASE_URL}/cases/${selectedCase._id}/evidence/${ev._id}/stream`}
                        token={token}
                      />
                      <div className="evidence-meta">
                        <span>Duration: {ev.metadata?.duration ? `${ev.metadata.duration}s` : 'N/A'}</span>
                        <span>Resolution: {ev.metadata?.resolution || 'N/A'}</span>
                        <span>Uploaded: {ev.uploadedAt ? new Date(ev.uploadedAt).toLocaleString() : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* Applicable Statutes */}
              {selectedCase.applicableStatutes && selectedCase.applicableStatutes.length > 0 && (
                <section className="statutes-section">
                  <h3>Applicable Statutes</h3>
                  {selectedCase.applicableStatutes.map((statute, idx) => (
                    <div key={idx} className="statute-card">
                      <strong>{statute.code}</strong>
                      <p>{statute.description}</p>
                      <p>Fine: ${statute.fineRange?.min} - ${statute.fineRange?.max} | Points: {statute.points}</p>
                    </div>
                  ))}
                </section>
              )}

              {/* Actions */}
              <section className="actions-section">
                <h3>Take Action</h3>
                <div className="action-buttons">
                  <button
                    className="btn-primary btn-citation"
                    onClick={issueCitation}
                  >
                    Issue Citation
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => updateStatus('under_review')}
                  >
                    Mark Under Review
                  </button>
                  <button
                    className="btn-warning"
                    onClick={() => {
                      const notes = prompt('Reason for dismissal:');
                      if (notes) updateStatus('dismissed', { notes });
                    }}
                  >
                    Dismiss Case
                  </button>
                </div>
              </section>
            </>
          )}
        </main>

        {/* Right Sidebar: Stats */}
        <aside className="stats-sidebar">
          <h3>Department Stats</h3>
          {stats ? (
            <>
              <div className="stat-box">
                <span className="stat-value">{stats.department?.totalReviewsCompleted || 0}</span>
                <span className="stat-label">Total Reviews</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{stats.department?.citationsIssued || 0}</span>
                <span className="stat-label">Citations Issued</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{stats.department?.casesDismissed || 0}</span>
                <span className="stat-label">Cases Dismissed</span>
              </div>

              <h4>Officer Leaderboard</h4>
              <div className="leaderboard">
                {stats.officers && stats.officers.length > 0 ? (
                  stats.officers.slice(0, 5).map((officer, idx) => (
                    <div key={officer._id} className="officer-row">
                      <span className="rank">#{idx + 1}</span>
                      <span className="name">{officer.username}</span>
                      <span className="reviews">{officer.policeProfile?.stats?.casesReviewed || 0}</span>
                    </div>
                  ))
                ) : (
                  <p className="empty-message">No officers yet</p>
                )}
              </div>
            </>
          ) : (
            <p className="empty-message">Loading stats...</p>
          )}
        </aside>
      </div>
    </div>
  );
}
