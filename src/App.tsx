import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, Outlet } from 'react-router-dom';
import { ClinicAuthProvider } from './context/ClinicAuthContext';
import { useClinicAuth } from './context/ClinicAuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ClinicLayout from './components/layout/ClinicLayout/ClinicLayout';
import PawLoader from './components/common/PawLoader/PawLoader';

// Static imports — always needed immediately
import Login from './pages/Login/Login';

// Lazy page chunks — each becomes its own JS file, loaded only when navigated to
const ClinicDashboard    = lazy(() => import('./pages/Dashboard/ClinicDashboard'));
const AnalyticsDashboard = lazy(() => import('./pages/Analytics/AnalyticsDashboard'));
const ClinicSettings     = lazy(() => import('./pages/Settings/ClinicSettings'));
const BranchesList       = lazy(() => import('./pages/Branches/BranchesList'));
const CreateBranch       = lazy(() => import('./pages/Branches/CreateBranch'));
const EditBranch         = lazy(() => import('./pages/Branches/EditBranch'));
const StaffList          = lazy(() => import('./pages/Staff/StaffList'));
const CreateStaff        = lazy(() => import('./pages/Staff/CreateStaff'));
const EditStaff          = lazy(() => import('./pages/Staff/EditStaff'));
const DoctorList         = lazy(() => import('./pages/Staff/DoctorList'));
const CreateDoctor       = lazy(() => import('./pages/Staff/CreateDoctor'));
const DoctorInfo         = lazy(() => import('./pages/Staff/DoctorInfo'));
const AppointmentsList   = lazy(() => import('./pages/Appointments/AppointmentsList'));
const TodayQueue         = lazy(() => import('./pages/Appointments/TodayQueue'));
const CreateAppointment  = lazy(() => import('./pages/Appointments/CreateAppointment'));
const AppointmentDetail  = lazy(() => import('./pages/Appointments/AppointmentDetail'));
const ServicesList       = lazy(() => import('./pages/Services/ServicesList'));
const PatientsList       = lazy(() => import('./pages/Patients/PatientsList'));
const PatientProfile     = lazy(() => import('./pages/Patients/PatientProfile'));
const ReviewsList        = lazy(() => import('./pages/Reviews/ReviewsList'));
const NotificationsList  = lazy(() => import('./pages/Notifications/NotificationsList'));

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
              {/* Suspense wrapper — shows PawLoader while any lazy page chunk loads */}
              <Route element={<Suspense fallback={<PawLoader size="large" overlay />}><Outlet /></Suspense>}>
                <Route path="/dashboard"           element={<ClinicDashboard />} />
                <Route path="/analytics"           element={<AnalyticsDashboard />} />
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
                <Route path="/services"            element={<ServicesList />} />
                <Route path="/patients"            element={<PatientsList />} />
                <Route path="/patients/:userId"    element={<PatientProfile />} />
                <Route path="/reviews"             element={<ReviewsList />} />
                <Route path="/notifications"       element={<NotificationsList />} />
                <Route path="/settings"            element={<ClinicSettings />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback — catches all unmatched paths */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </ClinicAuthProvider>
    </BrowserRouter>
  );
}
