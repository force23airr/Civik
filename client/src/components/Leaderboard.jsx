import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Leaderboard.css';

const Leaderboard = ({ limit = 20, showFilters = true, compact = false }) => {
  const { isAuthenticated } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    fetchLeaderboard();
  }, [period, limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/rewards/leaderboard?period=${period}&limit=${limit}`);
      setLeaderboard(res.data.leaderboard || []);
      setUserRank(res.data.userRank || null);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className={`leaderboard ${compact ? 'compact' : ''}`}>
        <div className="leaderboard-loading">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className={`leaderboard ${compact ? 'compact' : ''}`}>
      {showFilters && (
        <div className="leaderboard-header">
          <h2>Top Contributors</h2>
          <div className="period-filters">
            <button
              className={`filter-btn ${period === 'weekly' ? 'active' : ''}`}
              onClick={() => setPeriod('weekly')}
            >
              Weekly
            </button>
            <button
              className={`filter-btn ${period === 'monthly' ? 'active' : ''}`}
              onClick={() => setPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`filter-btn ${period === 'allTime' ? 'active' : ''}`}
              onClick={() => setPeriod('allTime')}
            >
              All Time
            </button>
          </div>
        </div>
      )}

      <div className="leaderboard-list">
        {leaderboard.length === 0 ? (
          <div className="no-data">No leaderboard data available yet.</div>
        ) : (
          leaderboard.map((entry, idx) => (
            <div
              key={entry.rank}
              className={`leaderboard-entry ${entry.rank <= 3 ? 'top-three' : ''} ${
                userRank && entry.userId === userRank.rank ? 'current-user' : ''
              }`}
            >
              <div className="entry-rank">
                {entry.rank <= 3 ? (
                  <span className="rank-medal">{getRankDisplay(entry.rank)}</span>
                ) : (
                  <span className="rank-number">{entry.rank}</span>
                )}
              </div>
              <div className="entry-user">
                <span className="username">{entry.username}</span>
              </div>
              <div className="entry-stats">
                <div className="stat-item">
                  <span className="stat-value">{entry.totalCredits.toLocaleString()}</span>
                  <span className="stat-label">credits</span>
                </div>
                {!compact && (
                  <div className="stat-item">
                    <span className="stat-value">{entry.incidentCount}</span>
                    <span className="stat-label">reports</span>
                  </div>
                )}
              </div>
              <div className="entry-earnings">
                <span className="earnings-value">${entry.totalCreditsUSD}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {isAuthenticated && userRank && userRank.rank > limit && (
        <div className="user-rank-card">
          <div className="your-rank-label">Your Rank</div>
          <div className="leaderboard-entry current-user">
            <div className="entry-rank">
              <span className="rank-number">{userRank.rank}</span>
            </div>
            <div className="entry-user">
              <span className="username">You</span>
            </div>
            <div className="entry-stats">
              <div className="stat-item">
                <span className="stat-value">{userRank.totalCredits?.toLocaleString() || 0}</span>
                <span className="stat-label">credits</span>
              </div>
            </div>
            <div className="entry-earnings">
              <span className="earnings-value">${userRank.totalCreditsUSD || '0.00'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
