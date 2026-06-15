import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Unauthorized from "./pages/Unauthorized";
import Staff from "./pages/admin/Staff";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={["admin"]}><Dashboard /></ProtectedRoute>
          }/>
          <Route path="/admin/staff" element={
            <ProtectedRoute allowedRoles={["admin"]}><Staff /></ProtectedRoute>
          }/>
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}