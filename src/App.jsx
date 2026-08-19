import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Auth pages
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import Staff from './pages/admin/Staff';
import Students from './pages/admin/Students';

// Headmaster pages
import HeadmasterDashboard from './pages/headmaster/HeadmasterDashboard';
import Classes from './pages/headmaster/Classes';
import Terms from './pages/headmaster/Terms';
import Assignments from './pages/headmaster/Assignments';
import Attendance from './pages/headmaster/Attendance';
import Subjects from './pages/headmaster/Subjects';

// Teacher pages
import MarkAttendance from './pages/teacher/MarkAttendance';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }/>
          <Route path="/admin/staff" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Staff />
            </ProtectedRoute>
          }/>
          <Route path="/admin/students" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Students />
            </ProtectedRoute>
          }/>

          {/* Headmaster */}
          <Route path="/headmaster/dashboard" element={
            <ProtectedRoute allowedRoles={['headmaster']}>
              <HeadmasterDashboard />
            </ProtectedRoute>
          }/>
          <Route path="/headmaster/classes" element={
            <ProtectedRoute allowedRoles={['headmaster']}>
              <Classes />
            </ProtectedRoute>
          }/>
          <Route path="/headmaster/terms" element={
            <ProtectedRoute allowedRoles={['headmaster']}>
              <Terms />
            </ProtectedRoute>
          }/>
          <Route path="/headmaster/assignments" element={
            <ProtectedRoute allowedRoles={['headmaster']}>
              <Assignments />
            </ProtectedRoute>
          }/>
          <Route path="/headmaster/attendance" element={
            <ProtectedRoute allowedRoles={['headmaster']}>
              <Attendance />
            </ProtectedRoute>
          }/>
          <Route path="/headmaster/subjects" element={
            <ProtectedRoute allowedRoles={['headmaster']}>
              <Subjects />
            </ProtectedRoute>
          }/>

          {/* Teacher */}
          <Route path="/teacher/attendance" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <MarkAttendance />
            </ProtectedRoute>
          }/>

          {/* Redirects */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/headmaster" element={<Navigate to="/headmaster/dashboard" replace />} />
          <Route path="/teacher" element={<Navigate to="/teacher/attendance" replace />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;