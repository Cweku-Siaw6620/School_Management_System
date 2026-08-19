import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Attendance", path: "/teacher/attendance" },
  { label: "Scores",     path: "/teacher/scores" },
];

export default function TeacherLayout({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      <aside className={`${sidebarOpen ? "w-64" : "w-16"} bg-slate-800 text-white flex flex-col transition-all duration-300`}>

        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          {sidebarOpen && (
            <div>
              <p className="font-bold text-sm">School MS</p>
              <p className="text-xs text-slate-400 mt-0.5">Teacher Panel</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-white focus:outline-none ml-auto"
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-700 ${
                location.pathname === item.path
                  ? "bg-slate-700 text-white"
                  : "text-slate-300"
              }`}
            >
              {sidebarOpen ? item.label : item.label[0]}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-2">
          {sidebarOpen && (
            <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? "Logout" : "✕"}
          </button>
        </div>

      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-700">Teacher Panel</h1>
          <span className="text-sm text-gray-400">{currentUser?.email}</span>
        </div>
        <div className="p-6">{children}</div>
      </main>

    </div>
  );
}