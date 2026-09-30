import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { 
    label: "My Children", 
    path: "/parent/children",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
];

export default function ParentLayout({ children }) {
  const { currentUser, userData, staffId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [childName, setChildName] = useState("");

  useEffect(() => {
    // Get child's name from userData
    if (userData?.studentData) {
      const student = userData.studentData;
      setChildName(`${student.firstName || ""} ${student.lastName || ""}`.trim() || "My Child");
    } else if (userData?.firstName && userData?.lastName) {
      // Fallback for staff view (shouldn't happen in parent layout)
      setChildName(`${userData.firstName} ${userData.lastName}`);
    }
  }, [userData]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  // Get child's display name for the header
  const displayName = childName || "Parent";

  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden text-slate-800">

      {/* Sidebar */}
      <aside 
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-slate-200/80 flex flex-col transition-all duration-300 ease-in-out relative z-20 shadow-sm`}
      >
        {/* School Header */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-100 bg-slate-50/50">
          {sidebarOpen && (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-md bg-sky-900 border border-sky-800 flex items-center justify-center text-amber-300 font-serif font-bold text-base shadow-sm flex-shrink-0">
                🏫
              </div>
              <div className="truncate">
                <h2 className="font-serif font-semibold text-sm text-slate-900 leading-tight tracking-wide">
                  School MS
                </h2>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                  Parent Portal
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${!sidebarOpen && "mx-auto"}`}
            aria-label="Toggle Sidebar"
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${!sidebarOpen && "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center gap-3.5 px-3.5 py-3 rounded-md text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-sky-50 text-sky-950 font-semibold border border-sky-100/80 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                } ${!sidebarOpen && "justify-center px-0"}`}
              >
                <span className={`transition-colors ${isActive ? "text-sky-800" : "text-slate-400 group-hover:text-slate-600"}`}>
                  {item.icon}
                </span>

                {sidebarOpen && <span className="truncate">{item.label}</span>}

                {/* Active Accent Line */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-sky-800 rounded-r-full" />
                )}

                {/* Collapsed Tooltip */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs rounded shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Profile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-xs font-serif font-bold text-sky-800 flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {displayName || "Parent"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {"Parent"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-full flex justify-center p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="font-serif text-lg font-semibold text-slate-900 tracking-tight">
              Parent Portal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Welcome, {displayName} • {staffId || "Parent"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {userData?.studentData?.classId ? "Student Active" : "Parent"}
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <span className="text-xs font-medium text-slate-600">
              {staffId || currentUser?.email?.split("@")[0] || "Parent"}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/30 text-slate-800">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}