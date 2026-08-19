import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { 
    label: "Dashboard", 
    path: "/headmaster/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  { 
    label: "Classes", 
    path: "/headmaster/classes",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  { 
    label: "Terms", 
    path: "/headmaster/terms",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    label: "Assignments", 
    path: "/headmaster/assignments",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    label: "Subjects", 
    path: "/headmaster/subjects",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  { 
    label: "Attendance", 
    path: "/headmaster/attendance",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4" />
      </svg>
    )
  },
];

export default function HeadmasterLayout({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased overflow-hidden text-slate-800">

      {/* Classic Sidebar */}
      <aside 
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-slate-200/80 flex flex-col transition-all duration-300 ease-in-out relative z-20 shadow-sm`}
      >
        {/* Academic School Header */}
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
                  Headmaster Portal
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

        {/* Navigation Section */}
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

                {/* Left Active Accent Line */}
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

        {/* Classic Footer Profile Block */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-serif font-bold text-slate-700 flex-shrink-0">
                  {currentUser?.email?.[0]?.toUpperCase() || "H"}
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-slate-800 truncate">{currentUser?.email}</p>
                  <p className="text-[10px] text-slate-500">Administrator</p>
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

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Top Classical Header */}
        <header className="h-20 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="font-serif text-lg font-semibold text-slate-900 tracking-tight">
              Primary School Administration
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Academic Management Overview</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Current Term Active
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <span className="text-xs font-medium text-slate-600">{currentUser?.email}</span>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/30 text-slate-800">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}