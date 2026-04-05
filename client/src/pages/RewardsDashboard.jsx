import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './RewardsDashboard.css';

const RewardsDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('paypal');

  useEffect(() => {
    fetchDashboard();
    fetchReferrals();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/rewards/dashboard');
      setDashboard(res.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      const res = await api.get('/rewards/referrals');
      setReferrals(res.data);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
  };

  const handlePayout = async (e) => {
    e.preventDefault();
    try {
      await api.post('/rewards/payout', {
        amount: parseInt(payoutAmount),
        paymentMethod: payoutMethod
      });
      alert('Payout request submitted!');
      setShowPayoutModal(false);
      setPayoutAmount('');
      fetchDashboard();
    } catch (error) {
      alert(error.response?.data?.message || 'Payout failed');
    }
  };

  const copyReferralCode = () => {
    if (dashboard?.referrals?.code) {
      navigator.clipboard.writeText(
        `${window.location.origin}/register?ref=${dashboard.referrals.code}`
      );
      alert('Referral link copied!');
    }
  };

  if (loading) {
    return <div className="container text-center mt-3">Loading...</div>;
  }

  return (
    <div className="rewards-dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1>Rewards Dashboard</h1>
          <Link to="/get-rewarded" className="btn btn-outline">
            How to Earn More
          </Link>
        </div>

        {/* Balance Cards */}
        <div className="balance-cards">
          <div className="balance-card available">
            <span className="balance-label">Available</span>
            <span className="balance-value">{dashboard?.balance?.available || 0}</span>
            <span className="balance-usd">${dashboard?.balance?.availableUSD || '0.00'}</span>
          </div>
          <div className="balance-card pending">
            <span className="balance-label">Pending</span>
            <span className="balance-value">{dashboard?.balance?.pending || 0}</span>
            <span className="balance-usd">${((dashboard?.balance?.pending || 0) / 100).toFixed(2)}</span>
          </div>
          <div className="balance-card lifetime">
            <span className="balance-label">Lifetime</span>
            <span className="balance-value">{dashboard?.balance?.lifetime || 0}</span>
            <span className="balance-usd">${((dashboard?.balance?.lifetime || 0) / 100).toFixed(2)}</span>
          </div>
          <div className="balance-card redeemed">
            <span className="balance-label">Redeemed</span>
            <span className="balance-value">{dashboard?.balance?.redeemed || 0}</span>
            <span className="balance-usd">${((dashboard?.balance?.redeemed || 0) / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowPayoutModal(true)}
            disabled={!dashboard?.balance?.available}
          >
            Cash Out
          </button>
          <button className="btn btn-secondary" onClick={copyReferralCode}>
            Share Referral Link
          </button>
          <Link to="/report" className="btn btn-success">
            Report Incident
          </Link>
        </div>

        {/* Tabs */}
        <div className="dashboard-tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab ${activeTab === 'referrals' ? 'active' : ''}`}
            onClick={() => setActiveTab('referrals')}
          >
            Referrals
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              {/* Streaks */}
              <div className="card streak-card">
                <h3>Streaks</h3>
                <div className="streak-stats">
                  <div className="streak-stat">
                    <span className="streak-value">{dashboard?.streaks?.currentDailyStreak || 0}</span>
                    <span className="streak-label">Current Streak</span>
                  </div>
                  <div className="streak-stat">
                    <span className="streak-value">{dashboard?.streaks?.longestDailyStreak || 0}</span>
                    <span className="streak-label">Longest Streak</span>
                  </div>
                </div>
                <p className="streak-info">Report daily to build your streak and earn bonus credits!</p>
              </div>

              {/* Recent Activity */}
              <div className="card activity-card">
                <h3>Recent Activity</h3>
                {dashboard?.recentActivity?.length > 0 ? (
                  <div className="activity-list">
                    {dashboard.recentActivity.map((activity, idx) => (
                      <div key={idx} className="activity-item">
                        <div className="activity-info">
                          <span className="activity-type">{activity.type.replace(/_/g, ' ')}</span>
                          <span className="activity-desc">{activity.description}</span>
                        </div>
                        <div className="activity-amount">
                          <span className={activity.amount > 0 ? 'positive' : 'negative'}>
                            {activity.amount > 0 ? '+' : ''}{activity.amount}
                          </span>
                          <span className="activity-date">
                            {new Date(activity.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-activity">No recent activity. Start reporting to earn credits!</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="referrals-tab">
              <div className="card referral-code-card">
                <h3>Your Referral Code</h3>
                <div className="referral-code-display">
                  <code>{dashboard?.referrals?.code || 'Generate Code'}</code>
                  <button className="btn btn-sm btn-primary" onClick={copyReferralCode}>
                    Copy Link
                  </button>
                </div>
                <p>Share this link and earn $5 for each friend who signs up and qualifies!</p>
              </div>

              <div className="card referral-stats-card">
                <h3>Referral Stats</h3>
                <div className="referral-stats">
                  <div className="ref-stat">
                    <span className="ref-value">{referrals?.stats?.total || 0}</span>
                    <span className="ref-label">Total</span>
                  </div>
                  <div className="ref-stat">
                    <span className="ref-value">{referrals?.stats?.pending || 0}</span>
                    <span className="ref-label">Pending</span>
                  </div>
                  <div className="ref-stat">
                    <span className="ref-value">{referrals?.stats?.qualified || 0}</span>
                    <span className="ref-label">Qualified</span>
                  </div>
                </div>
              </div>

              {referrals?.milestones?.next && (
                <div className="card milestone-card">
                  <h3>Next Milestone</h3>
                  <p>
                    Get <strong>{referrals.milestones.next.remaining}</strong> more qualified referrals
                    to earn <strong>${referrals.milestones.next.bonusUSD}</strong> bonus!
                  </p>
                </div>
              )}

              {referrals?.referrals?.length > 0 && (
                <div className="card referral-list-card">
                  <h3>Your Referrals</h3>
                  <div className="referral-list">
                    {referrals.referrals.map((ref, idx) => (
                      <div key={idx} className="referral-item">
                        <span className="ref-username">{ref.username}</span>
                        <span className={`ref-status status-${ref.status}`}>{ref.status}</span>
                        <span className="ref-progress">
                          {ref.progress.incidents}/{ref.progress.required} incidents
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Payout Modal */}
        {showPayoutModal && (
          <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Request Payout</h3>
              <form onSubmit={handlePayout}>
                <div className="form-group">
                  <label>Amount (credits)</label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="e.g., 1000"
                    min="100"
                    max={dashboard?.balance?.available || 0}
                    required
                  />
                  <small>
                    Available: {dashboard?.balance?.available || 0} credits
                    (${dashboard?.balance?.availableUSD || '0.00'})
                  </small>
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                  >
                    <option value="paypal">PayPal</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowPayoutModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardsDashboard;
