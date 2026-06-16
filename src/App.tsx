import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ClinicAuthProvider } from './context/ClinicAuthContext';
import { useClinicAuth } from './context/ClinicAuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ClinicLayout from './components/layout/ClinicLayout/ClinicLayout';
import PawLoader from './components/common/PawLoader/PawLoader';
import Login from './pages/Login/Login';
import ClinicDashboard from './pages/Dashboard/ClinicDashboard';
import ClinicSettings from './pages/Settings/ClinicSettings';
import BranchesList from './pages/Branches/BranchesList';
import CreateBranch from './pages/Branches/CreateBranch';
import EditBranch from './pages/Branches/EditBranch';
import StaffList from './pages/Staff/StaffList';
import CreateStaff from './pages/Staff/CreateStaff';
import EditStaff from './pages/Staff/EditStaff';
import DoctorList from './pages/Staff/DoctorList';
import CreateDoctor from './pages/Staff/CreateDoctor';
import DoctorInfo from './pages/Staff/DoctorInfo';
import AppointmentsList from './pages/Appointments/AppointmentsList';
import TodayQueue from './pages/Appointments/TodayQueue';
import CreateAppointment from './pages/Appointments/CreateAppointment';
import AppointmentDetail from './pages/Appointments/AppointmentDetail';

// ─── Root redirect ─────────────────────────────────────────────────────────
// Reads auth state and sends the user to the right place.
// Shows the loader while localStorage is being hydrated (isLoading: true).

function RootRedirect() {
  const { isAuthenticated, isLoading } = useClinicAuth();

  if (isLoading) {
    return <PawLoader size="large" overlay />;
  }

  return (
    <Navigate
      to={isAuthenticated ? '/dashboard' : '/login'}
      replace
    />
  );
}

// ─── Not found ──────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <i className="bi bi-exclamation-circle" style={{ fontSize: '4rem', color: '#e74c3c' }} />
      <h2 style={{ color: '#2c3e50', margin: 0 }}>404 — Page Not Found</h2>
      <p style={{ color: '#7f8c8d', margin: 0 }}>
        The page you are looking for does not exist.
      </p>
      <Link
        to="/dashboard"
        style={{
          color: '#0d9aff',
          textDecoration: 'none',
          fontWeight: 600,
          marginTop: '0.5rem',
        }}
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <ClinicAuthProvider>
        <Routes>

          {/* Root redirect — smart: checks auth before deciding destination */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes — guarded by ProtectedRoute, wrapped by ClinicLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<ClinicLayout />}>
              <Route path="/dashboard"           element={<ClinicDashboard />} />
              <Route path="/branches"            element={<BranchesList />} />
              <Route path="/branches/create"     element={<CreateBranch />} />
              <Route path="/branches/:branchId"  element={<EditBranch />} />
              <Route path="/staff"               element={<StaffList />} />
              <Route path="/staff/create"        element={<CreateStaff />} />
              <Route path="/staff/doctors"          element={<DoctorList />} />
              <Route path="/staff/doctors/create"   element={<CreateDoctor />} />
              <Route path="/staff/doctors/:staffId" element={<DoctorInfo />} />
              <Route path="/staff/:staffId"      element={<EditStaff />} />
              <Route path="/appointments"          element={<AppointmentsList />} />
              <Route path="/appointments/today"  element={<TodayQueue />} />
              <Route path="/appointments/create" element={<CreateAppointment />} />
              <Route path="/appointments/:id"    element={<AppointmentDetail />} />
              <Route path="/settings"            element={<ClinicSettings />} />
            </Route>
          </Route>

          {/* Fallback — catches all unmatched paths */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </ClinicAuthProvider>
    </BrowserRouter>
  );
}
