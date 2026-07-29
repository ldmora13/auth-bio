import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import { canAccessCompanies } from './lib/roles';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage'));
const CompanyManagementPage = lazy(() => import('./pages/Companies/CompanyManagementPage'));
const CreateUserPage = lazy(() => import('./pages/Users/CreateUserPage'));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#313e52' }}>
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#313e52' }}>
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function CompanyUserCreateRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#313e52' }}>
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canAccessCompanies(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function CompanyManagementRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#313e52' }}>
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canAccessCompanies(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile/*" element={<ProfilePage />} />
        </Route>

        <Route element={<CompanyManagementRoute />}>
          <Route path="/companies" element={<CompanyManagementPage />} />
          <Route path="/companies/:id" element={<CompanyManagementPage />} />
        </Route>

        <Route element={<CompanyUserCreateRoute />}>
          <Route path="/companies/:id/users/create" element={<CreateUserPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}