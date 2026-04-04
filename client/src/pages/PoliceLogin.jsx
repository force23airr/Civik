import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PoliceLogin.css';

export default function PoliceLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      }, { withCredentials: true });

      // Check if user is a police officer
      if (response.data.user.role !== 'police_officer') {
        setError('Police officer access required');
        setLoading(false);
        return;
      }

      // Token is now set as HttpOnly cookie by the server
      localStorage.setItem('userRole', 'police_officer');
      navigate('/police/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="police-login-page">
      <div className="police-login-container">
        <div className="police-badge-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1Z"
                  fill="#1e40af" stroke="#1e40af" strokeWidth="2"/>
            <circle cx="12" cy="11" r="3" fill="#fff"/>
          </svg>
        </div>

        <h1>Law Enforcement Portal</h1>
        <p className="subtitle">Civik Traffic Violation Review System</p>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Department Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@policedept.gov"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Logging in...' : 'Access Portal'}
          </button>
        </form>

        <div className="help-text">
          <p>Portal access restricted to authorized law enforcement personnel.</p>
          <p>Contact your department administrator for account setup.</p>
        </div>
      </div>
    </div>
  );
}
