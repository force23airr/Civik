import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Leaderboard from '../components/Leaderboard';
import './LeaderboardPage.css';

const LeaderboardPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="leaderboard-page">
      <div className="container">
        <div className="page-header">
          <div className="header-content">
            <h1>Community Leaderboard</h1>
            <p>Top contributors making roads safer for everyone</p>
          </div>
          <div className="header-actions">
            {isAuthenticated ? (
              <Link to="/rewards" className="btn btn-primary">
                My Dashboard
              </Link>
            ) : (
              <Link to="/register" className="btn btn-primary">
                Join & Earn
              </Link>
            )}
          </div>
        </div>

        <Leaderboard limit={50} showFilters={true} />

        <div className="leaderboard-info">
          <div className="info-card">
            <h3>How Rankings Work</h3>
            <p>
              Rankings are based on total credits earned during the selected time period.
              Contribute more reports, refer friends, and maintain daily streaks to climb the leaderboard!
            </p>
          </div>
          <div className="info-card">
            <h3>Tier Benefits</h3>
            <ul>
              <li><strong>Bronze:</strong> 1.0x multiplier</li>
              <li><strong>Silver:</strong> 1.1x multiplier + 50 monthly bonus</li>
              <li><strong>Gold:</strong> 1.25x multiplier + 200 monthly bonus</li>
              <li><strong>Platinum:</strong> 1.5x multiplier + 500 monthly bonus</li>
              <li><strong>Diamond:</strong> 2.0x multiplier + 1000 monthly bonus</li>
            </ul>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="cta-banner">
            <h2>Want to see your name here?</h2>
            <p>Join Civik and start earning credits for your dash cam footage.</p>
            <Link to="/get-rewarded" className="btn btn-primary btn-lg">
              Learn How to Earn
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
