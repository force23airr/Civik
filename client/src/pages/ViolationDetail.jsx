import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import EnhancedVoteButtons from '../components/EnhancedVoteButtons';
import RecklessnessRating from '../components/RecklessnessRating';
import CommentSection from '../components/CommentSection';
import ChainOfCustodyTimeline from '../components/ChainOfCustodyTimeline';
import ProtectedImage from '../components/ProtectedImage';
import VideoPlayer from '../components/VideoPlayer';
import './ViolationDetail.css';

const VIOLATION_TYPE_LABELS = {
  running_red_light: 'Running Red Light',
  running_stop_sign: 'Running Stop Sign',
  speeding: 'Speeding',
  illegal_lane_change: 'Illegal Lane Change',
  unsafe_lane_change: 'Unsafe Lane Change',
  failure_to_signal: 'Failure to Signal',
  tailgating: 'Tailgating',
  following_too_close: 'Following Too Close',
  reckless_driving: 'Reckless Driving',
  aggressive_driving: 'Aggressive Driving',
  road_rage: 'Road Rage',
  hit_and_run: 'Hit and Run',
  dui_suspected: 'Suspected DUI',
  distracted_driving: 'Distracted Driving',
  texting_while_driving: 'Texting While Driving',
  illegal_turn: 'Illegal Turn',
  illegal_u_turn: 'Illegal U-Turn',
  failure_to_yield: 'Failure to Yield',
  wrong_way_driving: 'Wrong Way Driving',
  street_racing: 'Street Racing',
  exhibition_of_speed: 'Exhibition of Speed',
  failure_to_stop_for_school_bus: 'Failure to Stop for School Bus',
  passing_on_right: 'Passing on Right',
  crossing_double_yellow: 'Crossing Double Yellow',
  other: 'Other Violation'
};

function ViolationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [violation, setViolation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [userVote, setUserVote] = useState(null);
  const [userVoteTypes, setUserVoteTypes] = useState([]);
  const [userRating, setUserRating] = useState(null);

  useEffect(() => {
    fetchViolation();
  }, [id]);

  const fetchViolation = async () => {
    try {
      const response = await api.get(`/violations/${id}`);
      setViolation(response.data);

      // Check if user has voted
      if (user && response.data.verification?.communityVotes?.voters) {
        const vote = response.data.verification.communityVotes.voters.find(
          v => v.user === user._id
        );
        if (vote) {
          setUserVote(vote.vote); // Legacy
          setUserVoteTypes(vote.voteTypes || []); // Enhanced
        }
      }

      // Check if user has rated
      if (user && response.data.recklessnessRating?.ratings) {
        const rating = response.data.recklessnessRating.ratings.find(
          r => r.user === user._id
        );
        if (rating) setUserRating(rating.rating);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load violation report');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteTypes) => {
    if (!user) {
      navigate('/login');
      return;
    }

    setActionLoading('vote');
    try {
      const response = await api.post(`/violations/${id}/vote`, { voteTypes });
      setViolation(prev => ({
        ...prev,
        verification: {
          ...prev.verification,
          communityVotes: response.data.communityVotes,
          status: response.data.verificationStatus
        }
      }));
      setUserVoteTypes(voteTypes);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to vote');
    } finally {
      setActionLoading('');
    }
  };

  const handleRating = async (rating) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const response = await api.post(`/violations/${id}/rating`, { rating });
      setViolation(prev => ({
        ...prev,
        recklessnessRating: response.data.recklessnessRating
      }));
      setUserRating(rating);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit rating');
    }
  };

  const handleDownloadPackage = async () => {
    setActionLoading('download');
    try {
      const response = await api.get(`/violations/${id}/evidence-package`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `evidence_package_${violation.reportNumber}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download package');
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmitToPolice = async () => {
    setActionLoading('police');
    try {
      const response = await api.post(`/violations/${id}/submit-to-police`, {});
      await fetchViolation(); // Refresh
      alert(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit to police');
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmitToInsurance = async () => {
    setActionLoading('insurance');
    try {
      const response = await api.post(`/violations/${id}/submit-to-insurance`, {
        database: 'direct_insurer'
      });
      await fetchViolation();
      alert(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit to insurance');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="violation-detail">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !violation) {
    return (
      <div className="violation-detail">
        <div className="container">
          <div className="error-container">
            <h2>Error</h2>
            <p>{error || 'Violation report not found'}</p>
            <button onClick={() => navigate('/violations')}>Back to Reports</button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = user && violation.reporter?._id === user._id;

  return (
    <div className="violation-detail">
      <div className="container">
        {/* Header */}
        <div className="detail-header">
          <div className="header-main">
            <span className="report-number">{violation.reportNumber}</span>
            <h1>{VIOLATION_TYPE_LABELS[violation.violationType] || violation.violationType}</h1>
            <div className="header-badges">
              <span className={`status-badge status-${violation.status}`}>
                {violation.status.replace(/_/g, ' ')}
              </span>
              <span className={`severity-badge severity-${violation.severity}`}>
                {violation.severity}
              </span>
              <span className={`verification-badge verification-${violation.verification?.status}`}>
                {violation.verification?.status}
              </span>
            </div>
          </div>
          {isOwner && (
            <div className="header-actions">
              <Link to={`/violations/${id}/edit`} className="btn btn-edit">Edit</Link>
            </div>
          )}
        </div>

        <div className="detail-grid">
          {/* Main Content */}
          <div className="detail-main">
            {/* Incident Info */}
            <section className="detail-section">
              <h2>Incident Details</h2>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Date & Time</span>
                  <span className="info-value">
                    {new Date(violation.incidentDateTime).toLocaleString()}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Location</span>
                  <span className="info-value">
                    {violation.location?.address}
                    {violation.location?.city && `, ${violation.location.city}`}
                    {violation.location?.state && `, ${violation.location.state}`}
                  </span>
                </div>
                {violation.location?.roadType && (
                  <div className="info-item">
                    <span className="info-label">Road Type</span>
                    <span className="info-value">{violation.location.roadType}</span>
                  </div>
                )}
                {violation.location?.speedLimit && (
                  <div className="info-item">
                    <span className="info-label">Speed Limit</span>
                    <span className="info-value">{violation.location.speedLimit} mph</span>
                  </div>
                )}
              </div>
            </section>

            {/* Offending Vehicle */}
            <section className="detail-section">
              <h2>Offending Vehicle</h2>
              <div className="vehicle-card">
                <div className="license-plate">
                  {violation.offendingVehicle?.licensePlate}
                </div>
                <div className="plate-state">
                  {violation.offendingVehicle?.plateState}
                </div>
                {violation.offendingVehicle?.make && (
                  <div className="vehicle-description">
                    {[
                      violation.offendingVehicle.color,
                      violation.offendingVehicle.make,
                      violation.offendingVehicle.model
                    ].filter(Boolean).join(' ')}
                  </div>
                )}
                {violation.offendingVehicle?.vehicleType && (
                  <div className="vehicle-type">
                    Type: {violation.offendingVehicle.vehicleType}
                  </div>
                )}
              </div>
            </section>

            {/* Description */}
            <section className="detail-section">
              <h2>Description</h2>
              <p className="description-text">{violation.description}</p>
            </section>

            {/* Evidence */}
            <section className="detail-section">
              <h2>Evidence</h2>
              {violation.evidence?.length > 0 ? (
                <div className="evidence-gallery">
	                  {violation.evidence.map((file, index) => (
	                    <div key={index} className="evidence-item">
	                      {file.mimetype?.startsWith('video/') ? (
	                        <VideoPlayer
	                          src={file.path || `/uploads/${file.filename}`}
	                          className="evidence-media"
	                        />
	                      ) : (
	                        <ProtectedImage
	                          src={file.path || `/uploads/${file.filename}`}
	                          alt={file.originalFilename}
	                          className="evidence-media"
	                        />
	                      )}
                      <div className="evidence-info">
                        <span className="filename">{file.originalFilename}</span>
                        <span className="hash">SHA-256: {file.sha256Hash?.substring(0, 16)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-evidence">No evidence files attached</p>
              )}
            </section>

            {/* Applicable Statutes */}
            {violation.applicableStatutes?.length > 0 && (
              <section className="detail-section">
                <h2>Applicable Traffic Codes</h2>
                <div className="statutes-list">
                  {violation.applicableStatutes.map((statute, index) => (
                    <div key={index} className="statute-card">
                      <div className="statute-code">
                        {statute.state} {statute.code}
                      </div>
                      <div className="statute-description">{statute.description}</div>
                      <div className="statute-details">
                        <span>Fine: ${statute.fineRange?.min} - ${statute.fineRange?.max}</span>
                        <span>Points: {statute.points}</span>
                        {statute.isMisdemeanor && (
                          <span className="misdemeanor">Misdemeanor</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Chain of Custody */}
            <ChainOfCustodyTimeline chainOfCustody={violation.chainOfCustody} />

            {/* Comments Section */}
            <CommentSection violationId={id} />
          </div>

          {/* Sidebar */}
          <div className="detail-sidebar">
            {/* Enhanced Community Voting */}
            {user && !isOwner ? (
              <section className="sidebar-card">
                <EnhancedVoteButtons
                  voteData={violation.verification?.communityVotes}
                  userVotes={userVoteTypes}
                  onVote={handleVote}
                  loading={actionLoading === 'vote'}
                  disabled={false}
                />
              </section>
            ) : !user ? (
              <section className="sidebar-card">
                <h3>Community Voting</h3>
                <p className="login-prompt">
                  <Link to="/login">Login</Link> to vote on this report
                </p>
              </section>
            ) : null}

            {/* Recklessness Rating */}
            {user && !isOwner ? (
              <section className="sidebar-card">
                <RecklessnessRating
                  average={violation.recklessnessRating?.average || 0}
                  count={violation.recklessnessRating?.count || 0}
                  userRating={userRating}
                  onRate={handleRating}
                  loading={false}
                  disabled={false}
                />
              </section>
            ) : !user ? (
              <section className="sidebar-card">
                <h3>Recklessness Rating</h3>
                <p className="login-prompt">
                  <Link to="/login">Login</Link> to rate this behavior
                </p>
              </section>
            ) : null}

            {/* Actions */}
            {isOwner && (
              <section className="sidebar-card">
                <h3>Actions</h3>
                <div className="action-buttons">
                  <button
                    className="btn-action"
                    onClick={handleDownloadPackage}
                    disabled={actionLoading === 'download'}
                  >
                    {actionLoading === 'download' ? 'Generating...' : 'Download Evidence Package'}
                  </button>
                  <button
                    className="btn-action btn-police"
                    onClick={handleSubmitToPolice}
                    disabled={actionLoading === 'police' || violation.lawEnforcementSubmissions?.length > 0}
                  >
                    {actionLoading === 'police' ? 'Submitting...' : 'Submit to Police'}
                  </button>
                  <button
                    className="btn-action btn-insurance"
                    onClick={handleSubmitToInsurance}
                    disabled={actionLoading === 'insurance'}
                  >
                    {actionLoading === 'insurance' ? 'Submitting...' : 'Report to Insurance'}
                  </button>
                </div>
              </section>
            )}

            {/* Submission Status */}
            {violation.lawEnforcementSubmissions?.length > 0 && (
              <section className="sidebar-card">
                <h3>Law Enforcement Submissions</h3>
                {violation.lawEnforcementSubmissions.map((sub, index) => (
                  <div key={index} className="submission-item">
                    <div className="submission-header">
                      <span className="submission-id">{sub.submissionId}</span>
                      <span className={`submission-status status-${sub.status}`}>
                        {sub.status}
                      </span>
                    </div>
                    <div className="submission-details">
                      <span>Method: {sub.method}</span>
                      <span>Date: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                      {sub.caseNumber && <span>Case: {sub.caseNumber}</span>}
                      {sub.citationNumber && <span>Citation: {sub.citationNumber}</span>}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Insurance Submissions */}
            {violation.insuranceSubmissions?.length > 0 && (
              <section className="sidebar-card">
                <h3>Insurance Submissions</h3>
                {violation.insuranceSubmissions.map((sub, index) => (
                  <div key={index} className="submission-item">
                    <div className="submission-header">
                      <span className="submission-id">{sub.submissionId}</span>
                      <span className={`submission-status status-${sub.status}`}>
                        {sub.status}
                      </span>
                    </div>
                    <div className="submission-details">
                      <span>Database: {sub.targetDatabase}</span>
                      {sub.insurerName && <span>Insurer: {sub.insurerName}</span>}
                      <span>Date: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Reporter Info */}
            <section className="sidebar-card">
              <h3>Reported By</h3>
              <div className="reporter-info">
                <span className="reporter-name">
                  {violation.reporter?.username || 'Anonymous'}
                </span>
                <span className="report-date">
                  {new Date(violation.createdAt).toLocaleDateString()}
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViolationDetail;
