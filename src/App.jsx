import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import Staff from './pages/admin/Staff';
import Students from './pages/admin/Students';
import Classes from './pages/admin/Classes';
import Terms from './pages/admin/Terms';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
              path="/admin/students"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Students />
                </ProtectedRoute>
            }
          />
          <Route
            path="/admin/classes"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Classes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/terms"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Terms />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;