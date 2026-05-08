import { Navigate, Outlet } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import PawLoader from '../common/PawLoader/PawLoader';

/**
 * Wraps protected routes using the React Router v6 nested-route pattern.
 *
 * Usage in App.tsx:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useClinicAuth();

  if (isLoading) {
    return <PawLoader size="large" overlay />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
