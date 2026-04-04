import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">&#128663;</span>
          Civik
        </Link>

        <div className="navbar-links">
          <Link to="/incidents">Incidents</Link>
          <Link to="/map">Heat Map</Link>

          {isAuthenticated ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/rewards" className="rewards-link">Rewards</Link>
              <Link to="/analytics">Analytics</Link>
              <Link to="/plates">Plate Search</Link>
              <Link to="/insurance/claims">Insurance</Link>
              <Link to="/marketplace">Marketplace</Link>
              <Link to="/partners">Data Partners</Link>
              <Link to="/shop" className="shop-link">Dash Cams</Link>
              <Link to="/report">
                Report Incident
              </Link>
              <Link to="/report-parking" className="parking-link">
                Report Parking
              </Link>
              <Link to="/flagged-drivers" className="flagged-link">Flagged Drivers</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="admin-link">Admin</Link>
              )}
              <div className="navbar-user">
                <Link to="/profile" className="user-link">
                  {user?.username}
                </Link>
                <button onClick={handleLogout} className="btn btn-outline">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/get-rewarded" className="rewards-link">Earn Money</Link>
              <Link to="/shop" className="shop-link">Dash Cams</Link>
              <Link to="/partners">Data Partners</Link>
              <Link to="/flagged-drivers" className="flagged-link">Flagged Drivers</Link>
              <Link to="/login">Login</Link>
              <Link to="/register" className="btn btn-primary">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
