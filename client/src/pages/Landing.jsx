import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const Landing = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing">
      <section className="hero">
        <div className="container">
          <h1>Community-Powered Road Safety</h1>
          <p>
            Upload dash cam footage, report incidents, and alert your community
            about dangerous driving, crime, and security concerns in real-time.
          </p>
          <div className="hero-buttons">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary btn-large">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-large">
                  Get Started
                </Link>
                <Link to="/incidents" className="btn btn-outline btn-large">
                  View Incidents
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>How Civik Works</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">&#128247;</div>
              <h3>Upload Footage</h3>
              <p>
                Capture incidents with your dash cam and upload videos or photos
                directly to the platform.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128681;</div>
              <h3>Flag Incidents</h3>
              <p>
                Report dangerous driving, suspicious activity, or security
                concerns with detailed location data.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#128276;</div>
              <h3>Alert Community</h3>
              <p>
                Create real-time alerts to warn other drivers about hazards and
                incidents in their area.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#129309;</div>
              <h3>Stay Connected</h3>
              <p>
                Join a community of safety-conscious drivers working together to
                make roads safer.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>Ready to Make Roads Safer?</h2>
          <p>Join thousands of drivers using Civik to protect their community.</p>
          {!isAuthenticated && (
            <Link to="/register" className="btn btn-primary btn-large">
              Create Free Account
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Landing;
