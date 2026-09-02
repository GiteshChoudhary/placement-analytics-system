import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import TPODashboard from './pages/TPODashboard';
import RecruiterSetup from './pages/RecruiterSetup';
import HRDashboard from './pages/HRDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';

// Root redirect handler based on auth status & role
const RootRedirect = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '3rem' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'tpo') {
    return <Navigate to="/tpo-dashboard" replace />;
  }
  if (role === 'recruiter' || role === 'company_hr') {
    return <Navigate to="/recruiter-dashboard" replace />;
  }
  return <Navigate to="/student-dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <Navbar />
          <Routes>
            {/* Root Route */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/recruiter-setup" element={<RecruiterSetup />} />

            {/* Protected Student Route */}
            <Route
              path="/student-dashboard"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Protected TPO Admin Route */}
            <Route
              path="/tpo-dashboard"
              element={
                <ProtectedRoute allowedRoles={['tpo']}>
                  <TPODashboard />
                </ProtectedRoute>
              }
            />

            {/* Protected Recruiter Route */}
            <Route
              path="/recruiter-dashboard"
              element={
                <ProtectedRoute allowedRoles={['recruiter', 'company_hr']}>
                  <RecruiterDashboard />
                </ProtectedRoute>
              }
            />

            {/* Backwards-compatibility alias for legacy HR route */}
            <Route
              path="/hr-dashboard"
              element={<Navigate to="/recruiter-dashboard" replace />}
            />

            {/* Fallback for undefined routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
