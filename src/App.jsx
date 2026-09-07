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
import StudentDetail from './pages/admin/StudentDetail';

// Headmaster pages
import HeadmasterDashboard from './pages/headmaster/HeadmasterDashboard';
import Classes from './pages/headmaster/Classes';
import Terms from './pages/headmaster/Terms';
import Attendance from './pages/headmaster/Attendance';
import Subjects from './pages/headmaster/Subjects';
import ClassDetail from './pages/headmaster/ClassDetail';
import TermDetail from './pages/headmaster/TermDetail';
import ScoresReview from './pages/headmaster/ScoresReview';

// Teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import MarkAttendance from './pages/teacher/MarkAttendance';
import MyClass from './pages/teacher/MyClass';
import Scores from './pages/teacher/Scores';

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
          <Route
            path="/admin/students/:studentId"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StudentDetail />
              </ProtectedRoute>
            }
          />

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
          <Route
            path="/headmaster/classes/:classId"
            element={
              <ProtectedRoute allowedRoles={['headmaster']}>
                <ClassDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/terms/:termId"
            element={
              <ProtectedRoute allowedRoles={['headmaster']}>
                <TermDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/scores-review"
            element={
              <ProtectedRoute allowedRoles={['headmaster']}>
                <ScoresReview />
              </ProtectedRoute>
            }
          />

          {/* Teacher */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/teacher/attendance" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <MarkAttendance />
            </ProtectedRoute>
          }/>
          <Route
            path="/teacher/my-class"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <MyClass />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/scores"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <Scores />
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/headmaster" element={<Navigate to="/headmaster/dashboard" replace />} />
          <Route path="/teacher" element={<Navigate to="/teacher/dashboard" replace />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;