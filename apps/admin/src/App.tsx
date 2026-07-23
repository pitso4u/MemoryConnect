import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandProvider } from './context/BrandContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MemorialsPage from './pages/MemorialsPage';
import CreateMemorialPage from './pages/CreateMemorialPage';
import MemorialDetailPage from './pages/MemorialDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import ProfilePage from './pages/ProfilePage';
import FamilyInvitePage from './pages/FamilyInvitePage';
import {
  PlatformAnalyticsPage, PlatformAuditLogsPage, PlatformDashboardPage, PlatformFuneralHomeDetailPage,
  PlatformFuneralHomesPage, PlatformPaymentsPage, PlatformSupportPage, PlatformUsersPage,
} from './pages/PlatformPages';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'SUPER_ADMIN' ? '/admin-owner' : isFamilyRole(user?.role) ? '/family' : '/dashboard'} replace />;
}

function FuneralHomeOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'SUPER_ADMIN') return <Navigate to="/admin-owner" replace />;
  if (isFamilyRole(user?.role)) return <Navigate to="/family" replace />;
  return <>{children}</>;
}

function FamilyOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!isFamilyRole(user?.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to={isFamilyRole(user?.role) ? '/family' : '/dashboard'} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/family/invite/:token" element={<FamilyInvitePage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleRedirect />} />
        <Route path="dashboard" element={<MemorialsPage />} />
        <Route path="memorials" element={<MemorialsPage />} />
        <Route path="create" element={<FuneralHomeOnly><CreateMemorialPage /></FuneralHomeOnly>} />
        <Route path="memorial/:id" element={<FuneralHomeOnly><MemorialDetailPage /></FuneralHomeOnly>} />
        <Route path="payments" element={<FuneralHomeOnly><PaymentsPage /></FuneralHomeOnly>} />
        <Route path="billing" element={<FuneralHomeOnly><PaymentsPage /></FuneralHomeOnly>} />
        <Route path="profile" element={<FuneralHomeOnly><ProfilePage /></FuneralHomeOnly>} />
        <Route path="settings" element={<FuneralHomeOnly><ProfilePage /></FuneralHomeOnly>} />
        <Route path="staff" element={<FuneralHomeOnly><ProfilePage /></FuneralHomeOnly>} />
        <Route path="analytics" element={<FuneralHomeOnly><MemorialsPage /></FuneralHomeOnly>} />
        <Route path="family" element={<FamilyOnly><MemorialsPage /></FamilyOnly>} />
        <Route path="family/memorials" element={<FamilyOnly><MemorialsPage /></FamilyOnly>} />
        <Route path="family/memorials/:id" element={<FamilyOnly><MemorialDetailPage /></FamilyOnly>} />
        <Route path="family/memorials/:id/programme" element={<FamilyOnly><MemorialDetailPage initialTab="programme" /></FamilyOnly>} />
        <Route path="family/memorials/:id/obituary" element={<FamilyOnly><MemorialDetailPage initialTab="obituary" /></FamilyOnly>} />
        <Route path="family/memorials/:id/photos" element={<FamilyOnly><MemorialDetailPage initialTab="photos" /></FamilyOnly>} />
        <Route path="family/memorials/:id/locations" element={<FamilyOnly><MemorialDetailPage initialTab="locations" /></FamilyOnly>} />
        <Route path="family/memorials/:id/tributes" element={<FamilyOnly><MemorialDetailPage initialTab="tributes" /></FamilyOnly>} />
        <Route path="family/memorials/:id/feedback" element={<FamilyOnly><MemorialDetailPage initialTab="feedback" /></FamilyOnly>} />
        <Route path="family/memorials/:id/biography" element={<FamilyOnly><MemorialDetailPage initialTab="obituary" /></FamilyOnly>} />
        <Route path="family/memorials/:id/programme-suggestions" element={<FamilyOnly><MemorialDetailPage initialTab="programme" /></FamilyOnly>} />
        <Route path="family/memorials/:id/preview" element={<FamilyOnly><MemorialDetailPage /></FamilyOnly>} />
        <Route path="admin-owner" element={<SuperAdminOnly><PlatformDashboardPage /></SuperAdminOnly>} />
        <Route path="admin-owner/funeral-homes" element={<SuperAdminOnly><PlatformFuneralHomesPage /></SuperAdminOnly>} />
        <Route path="admin-owner/funeral-homes/:id" element={<SuperAdminOnly><PlatformFuneralHomeDetailPage /></SuperAdminOnly>} />
        <Route path="admin-owner/payments" element={<SuperAdminOnly><PlatformPaymentsPage /></SuperAdminOnly>} />
        <Route path="admin-owner/users" element={<SuperAdminOnly><PlatformUsersPage /></SuperAdminOnly>} />
        <Route path="admin-owner/support" element={<SuperAdminOnly><PlatformSupportPage /></SuperAdminOnly>} />
        <Route path="admin-owner/analytics" element={<SuperAdminOnly><PlatformAnalyticsPage /></SuperAdminOnly>} />
        <Route path="admin-owner/audit-logs" element={<SuperAdminOnly><PlatformAuditLogsPage /></SuperAdminOnly>} />
        <Route path="platform" element={<Navigate to="/admin-owner" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrandProvider>
          <AppRoutes />
        </BrandProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
