import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const navItems = [
  { label: "Dashboard", path: "/admin" },
  { label: "Staff", path: "/admin/staff" },
  { label: "Students", path: "/admin/students" },
  { label: "Classes", path: "/admin/classes" },
  { label: "Academic Terms", path: "/admin/terms" },
];

export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} bg-blue-800 text-white flex flex-col transition-all duration-300`}>
        
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-blue-700">
          {sidebarOpen && <span className="font-bold text-lg">School MS</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white focus:outline-none ml-auto">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium transition-colors hover:bg-blue-700 ${
                location.pathname === item.path ? "bg-blue-600" : ""
              }`}
            >
              {sidebarOpen ? item.label : item.label[0]}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-blue-700">
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-300 hover:text-red-100"
          >
            {sidebarOpen ? "Logout" : "✕"}
          </button>
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-700">Admin Panel</h1>
          <span className="text-sm text-gray-500">admin@school.gh</span>
        </div>
        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>

    </div>
  );
}