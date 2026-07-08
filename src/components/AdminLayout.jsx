// src/components/AdminLayout.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const navItems = [
    { label: "Dashboard", path: "/admin" },
    { label: "Staff", path: "/admin/staff" },
    { label: "Students", path: "/admin/students" },
    { label: "Classes", path: "/admin/classes" },
    { label: "Academic Terms", path: "/admin/terms" },
    { label: "Assignments", path: "/admin/assignments" },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-blue-800 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between">
          <h1 className={`font-bold text-lg ${!sidebarOpen && 'hidden'}`}>
            SMS Admin
          </h1>
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-blue-700 rounded"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 mt-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 hover:bg-blue-700 transition-colors ${
                isActive(item.path) ? 'bg-blue-900' : ''
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`ml-3 ${!sidebarOpen && 'hidden'}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-700">
          <div className={`flex items-center ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className={`ml-2 ${!sidebarOpen && 'hidden'}`}>
              <p className="text-sm font-medium truncate">
                {currentUser?.email || 'Admin'}
              </p>
              <button
                onClick={handleLogout}
                className="text-xs text-blue-300 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;