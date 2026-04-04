import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import ReportIncident from './pages/ReportIncident';
import Profile from './pages/Profile';
import PoliceReport from './pages/PoliceReport';
import InsuranceClaim from './pages/InsuranceClaim';
import Analytics from './pages/Analytics';
import Marketplace from './pages/Marketplace';
import PlateSearch from './pages/PlateSearch';
import GetRewarded from './pages/GetRewarded';
import RewardsDashboard from './pages/RewardsDashboard';
import LeaderboardPage from './pages/LeaderboardPage';
import FlaggedPlates from './pages/FlaggedPlates';
import DataPartners from './pages/DataPartners';
import ReportViolation from './pages/ReportViolation';
import ViolationDetail from './pages/ViolationDetail';
import MyViolationReports from './pages/MyViolationReports';
import PoliceLogin from './pages/PoliceLogin';
import PoliceDashboard from './pages/PoliceDashboard';
import ReportParkingViolation from './pages/ReportParkingViolation';
import MyParkingReports from './pages/MyParkingReports';
import AdminDashboard from './pages/AdminDashboard';
import MunicipalPortal from './pages/MunicipalPortal';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="container text-center mt-3">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Guest Route wrapper (redirect if logged in)
const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="container text-center mt-3">Loading...</div>;
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function App() {
  const location = useLocation();
  const isPoliceRoute = location.pathname.startsWith('/police');

  return (
    <div className="app">
      {!isPoliceRoute && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportIncident />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/incidents/:incidentId/police-report"
            element={
              <ProtectedRoute>
                <PoliceReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/insurance/claims"
            element={
              <ProtectedRoute>
                <InsuranceClaim />
              </ProtectedRoute>
            }
          />
          <Route
            path="/insurance/claims/:claimId"
            element={
              <ProtectedRoute>
                <InsuranceClaim />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute>
                <Marketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plates"
            element={
              <ProtectedRoute>
                <PlateSearch />
              </ProtectedRoute>
            }
          />
          <Route path="/get-rewarded" element={<GetRewarded />} />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute>
                <RewardsDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/rewards/leaderboard" element={<LeaderboardPage />} />
          <Route path="/flagged-drivers" element={<FlaggedPlates />} />
          <Route path="/partners" element={<DataPartners />} />
          <Route
            path="/report-violation"
            element={
              <ProtectedRoute>
                <ReportViolation />
              </ProtectedRoute>
            }
          />
          <Route path="/violations/:id" element={<ViolationDetail />} />
          <Route
            path="/my-violations"
            element={
              <ProtectedRoute>
                <MyViolationReports />
              </ProtectedRoute>
            }
          />

          {/* Parking Violation Routes */}
          <Route
            path="/report-parking"
            element={
              <ProtectedRoute>
                <ReportParkingViolation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-parking-reports"
            element={
              <ProtectedRoute>
                <MyParkingReports />
              </ProtectedRoute>
            }
          />

          {/* Admin Dashboard */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Municipal Worker Portal */}
          <Route
            path="/municipal"
            element={
              <ProtectedRoute>
                <MunicipalPortal />
              </ProtectedRoute>
            }
          />

          {/* Police Portal Routes */}
          <Route path="/police/login" element={<PoliceLogin />} />
          <Route path="/police/dashboard" element={<PoliceDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
