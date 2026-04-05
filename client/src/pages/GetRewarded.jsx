import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GetRewarded.css';

const GetRewarded = () => {
  const { isAuthenticated } = useAuth();
  const [rates, setRates] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchRates();
    fetchLeaderboard();
  }, []);

  const fetchRates = async () => {
    try {
      const res = await api.get('/rewards/rates');
      setRates(res.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/rewards/leaderboard?limit=5');
      setLeaderboard(res.data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  return (
    <div className="get-rewarded">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1>Turn Your Dash Cam Into Income</h1>
            <p className="hero-subtitle">
              Gig drivers earn <strong>$50-200+/month</strong> just by driving with Civik.
              Report incidents, share data, and get paid.
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-value">70%</span>
                <span className="stat-label">Revenue Share</span>
              </div>
              <div className="stat">
                <span className="stat-value">$1</span>
                <span className="stat-label">= 100 Credits</span>
              </div>
              <div className="stat">
                <span className="stat-value">$7.50</span>
                <span className="stat-label">Top Bounty</span>
              </div>
            </div>
            <div className="hero-cta">
              {isAuthenticated ? (
                <Link to="/rewards" className="btn btn-primary btn-lg">
                  View My Earnings
                </Link>
              ) : (
                <Link to="/register" className="btn btn-primary btn-lg">
                  Start Earning Today
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Install & Drive</h3>
              <p>Sign up for free and connect your dash cam. Drive like you normally do.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Report Incidents</h3>
              <p>Spot something? Report it. Potholes, accidents, weather hazards - everything counts.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Earn Credits</h3>
              <p>Get credits instantly for every report. Quality bonuses for video and GPS.</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Cash Out</h3>
              <p>Withdraw via PayPal, bank transfer, or crypto. 100 credits = $1.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Earning Opportunities */}
      <section className="earning-section">
        <div className="container">
          <h2>Ways to Earn</h2>
          <div className="earning-grid">
            <div className="earning-card">
              <div className="earning-icon">&#128663;</div>
              <h3>Report Incidents</h3>
              <p>Earn 3-15 credits per report depending on type</p>
              <ul className="earning-list">
                <li>Dangerous driving: 10 credits</li>
                <li>Crime reports: 15 credits</li>
                <li>Weather hazards: 12 credits</li>
                <li>Potholes: 5 credits</li>
                <li>Traffic patterns: 3 credits</li>
              </ul>
            </div>
            <div className="earning-card featured">
              <div className="earning-icon">&#128176;</div>
              <h3>Revenue Share</h3>
              <p>70% of all data sales go to contributors</p>
              <ul className="earning-list">
                <li>AI companies buy datasets</li>
                <li>Your data, your earnings</li>
                <li>Passive income potential</li>
                <li>Quality bonuses for clear footage</li>
              </ul>
            </div>
            <div className="earning-card">
              <div className="earning-icon">&#128101;</div>
              <h3>Refer Friends</h3>
              <p>$5 for each qualified referral</p>
              <ul className="earning-list">
                <li>$5 per referral</li>
                <li>$2.50 welcome bonus</li>
                <li>$10 at 5 referrals</li>
                <li>$75 at 25 referrals</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      {leaderboard.length > 0 && (
        <section className="leaderboard-section">
          <div className="container">
            <h2>Top Contributors</h2>
            <div className="leaderboard-preview">
              {leaderboard.map((entry, idx) => (
                <div key={idx} className="leaderboard-entry">
                  <span className="rank">#{entry.rank}</span>
                  <span className="username">{entry.username}</span>
                  <span className="credits">${entry.totalCreditsUSD}</span>
                </div>
              ))}
            </div>
            <Link to="/rewards/leaderboard" className="btn btn-outline">
              View Full Leaderboard
            </Link>
          </div>
        </section>
      )}

      {/* For Gig Drivers */}
      <section className="gig-driver-section">
        <div className="container">
          <div className="gig-content">
            <h2>Built for Gig Drivers</h2>
            <p>
              Whether you drive for Uber, Lyft, DoorDash, or any delivery service -
              your dash cam is already capturing valuable data. Turn those miles into money.
            </p>
            <div className="gig-platforms">
              <span>Uber</span>
              <span>Lyft</span>
              <span>DoorDash</span>
              <span>Grubhub</span>
              <span>Instacart</span>
              <span>Amazon Flex</span>
            </div>
            <div className="earnings-example">
              <h4>Example Daily Earnings</h4>
              <table>
                <tbody>
                  <tr>
                    <td>2x Traffic reports</td>
                    <td>6 credits</td>
                  </tr>
                  <tr>
                    <td>1x Pothole (with video)</td>
                    <td>10 credits</td>
                  </tr>
                  <tr>
                    <td>1x Dangerous driver</td>
                    <td>20 credits</td>
                  </tr>
                  <tr>
                    <td>1x Construction zone</td>
                    <td>5 credits</td>
                  </tr>
                  <tr className="total">
                    <td>Day Total</td>
                    <td>~41 credits</td>
                  </tr>
                </tbody>
              </table>
              <p className="projection">Monthly projection: ~$20-50+ just from reporting</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="container">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>How do I get paid?</h4>
              <p>Cash out anytime you have at least 100 credits ($1). We support PayPal, bank transfer, and crypto.</p>
            </div>
            <div className="faq-item">
              <h4>What data do you sell?</h4>
              <p>Anonymized traffic patterns, road conditions, and incident data to AI companies, cities, and researchers. Never personal info.</p>
            </div>
            <div className="faq-item">
              <h4>What's the revenue share?</h4>
              <p>70% of all dataset sales go directly to contributors based on their contribution percentage.</p>
            </div>
            <div className="faq-item">
              <h4>How do streaks work?</h4>
              <p>Report daily to build your streak. Hit 7, 14, 30, 60, or 90 day milestones to earn bonus credits.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Start Earning?</h2>
          <p>Join thousands of drivers turning their commute into income</p>
          {isAuthenticated ? (
            <Link to="/rewards" className="btn btn-primary btn-lg">
              Go to Rewards Dashboard
            </Link>
          ) : (
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary btn-lg">
                Create Free Account
              </Link>
              <Link to="/login" className="btn btn-outline btn-lg">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default GetRewarded;
