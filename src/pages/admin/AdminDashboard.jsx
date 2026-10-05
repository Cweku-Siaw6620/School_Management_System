import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    newThisTerm: 0,
    pendingPromotions: 0,
    activeTeachers: 0,
    totalSubjects: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // Get all active students
      const studentsQuery = query(
        collection(db, "students"),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const totalStudents = studentsSnapshot.size;

      // Get all active staff
      const staffQuery = query(
        collection(db, "staff"),
        where("status", "==", "active")
      );
      const staffSnapshot = await getDocs(staffQuery);
      const staff = staffSnapshot.docs.map(d => d.data());
      const totalStaff = staff.length;
      const activeTeachers = staff.filter(s => s.hasLogin === true).length;

      // Get all active classes
      const classesQuery = query(
        collection(db, "classes"),
        where("status", "==", "active")
      );
      const classesSnapshot = await getDocs(classesQuery);
      const totalClasses = classesSnapshot.size;

      // Get current term
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);

      let newThisTerm = 0;
      if (!termsSnapshot.empty) {
        const term = termsSnapshot.docs[0];
        const termStartDate = term.data().startDate;

        if (termStartDate) {
          const startDate = new Date(termStartDate);
          // Count students added after term started
          const studentsAll = await getDocs(collection(db, "students"));
          const recentStudents = studentsAll.docs.filter(d => {
            const createdAt = d.data().createdAt?.toDate?.() || new Date(d.data().createdAt);
            return createdAt >= startDate;
          });
          newThisTerm = recentStudents.length;
        }
      }

      // Count pending promotions (JHS 3 students)
      let pendingPromotions = 0;
      const allStudents = await getDocs(collection(db, "students"));
      for (const studentDoc of allStudents.docs) {
        const student = studentDoc.data();
        if (student.classId && student.status === "active") {
          try {
            const classDoc = await getDoc(doc(db, "classes", student.classId));
            if (classDoc.exists() && classDoc.data().level === "JHS 3") {
              pendingPromotions++;
            }
          } catch (e) {
            // Skip if class not found
          }
        }
      }

      // Get total subjects
      const subjectsSnapshot = await getDocs(collection(db, "classSubjects"));
      const totalSubjects = subjectsSnapshot.size;

      setStats({
        totalStudents,
        totalStaff,
        totalClasses,
        newThisTerm,
        pendingPromotions,
        activeTeachers,
        totalSubjects
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-24 bg-brand-soft border border-line rounded-xl"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-36 bg-brand-soft border border-line rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-brand-soft border border-line rounded-xl"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Executive Banner */}
        <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-brand"></div>
          <div className="pl-2">
            <span className="eyebrow">
              Official Administration Records
            </span>
            <h1 className="text-2xl font-bold text-ink tracking-tight mt-1">
              Executive Dashboard & Control Panel
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Institutional Summary Ledger • {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-soft border border-line text-xs font-medium text-ink-soft">
              <span className="w-2 h-2 rounded-full bg-success"></span>
              Academic Session Active
            </div>
          </div>
        </div>

        {/* Primary Statutory Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* Total Students */}
          <div className="card p-5 hover:border-line-strong transition-colors group">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Enrolled Students</span>
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-ink mt-3 tabular-nums">{stats.totalStudents}</p>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-ink-muted">
              <span>Active student rolls</span>
              <span className="font-semibold text-ink-soft">100%</span>
            </div>
          </div>

          {/* Total Staff */}
          <div className="card p-5 hover:border-line-strong transition-colors group">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Academic Faculty</span>
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-ink mt-3 tabular-nums">{stats.totalStaff}</p>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-ink-muted">
              <span>Active instructors</span>
              <span className="font-semibold text-ink-soft">{stats.activeTeachers}</span>
            </div>
          </div>

          {/* Classes */}
          <div className="card p-5 hover:border-line-strong transition-colors group">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Classroom Streams</span>
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-ink mt-3 tabular-nums">{stats.totalClasses}</p>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-ink-muted">
              <span>Class divisions</span>
              <span className="font-semibold text-ink-soft">Active</span>
            </div>
          </div>

          {/* Term Admissions */}
          <div className="card p-5 hover:border-line-strong transition-colors group">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Term Admissions</span>
              <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-ink mt-3 tabular-nums">{stats.newThisTerm}</p>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-ink-muted">
              <span>New registrations</span>
              <span className="font-semibold text-ink-soft">Current Term</span>
            </div>
          </div>

        </div>

        {/* Secondary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-soft border border-line flex items-center justify-center text-ink shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">Curriculum Subjects</p>
              <p className="text-xl font-bold text-ink mt-0.5 tabular-nums">{stats.totalSubjects}</p>
              <p className="text-[11px] text-ink-faint">Academic course catalog</p>
            </div>
          </div>

          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-soft border border-line flex items-center justify-center text-ink shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">Pending Promotions</p>
              <p className="text-xl font-bold text-ink mt-0.5 tabular-nums">{stats.pendingPromotions}</p>
              <p className="text-[11px] text-ink-faint">JHS 3 graduating candidates</p>
            </div>
          </div>

          <div className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand-soft border border-line flex items-center justify-center text-ink shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">Total Population</p>
              <p className="text-xl font-bold text-ink mt-0.5 tabular-nums">{stats.totalStudents + stats.totalStaff}</p>
              <p className="text-[11px] text-ink-faint">Faculty & students</p>
            </div>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
            <h3 className="text-sm font-bold text-ink">
              Administrative Commands & Quick Actions
            </h3>
            <span className="eyebrow">Control Panel</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <button
              onClick={() => navigate("/admin/staff")}
              className="group flex items-center gap-3.5 p-3.5 rounded-lg border border-line hover:border-brand hover:bg-brand transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-soft text-ink group-hover:bg-white/15 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink group-hover:text-white">Staff Registry</p>
                <p className="text-[10px] text-ink-muted group-hover:text-white/70 mt-0.5">Faculty profiles & access</p>
              </div>
            </button>

            <button
              onClick={() => navigate("/admin/students")}
              className="group flex items-center gap-3.5 p-3.5 rounded-lg border border-line hover:border-brand hover:bg-brand transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-soft text-ink group-hover:bg-white/15 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink group-hover:text-white">Student Ledger</p>
                <p className="text-[10px] text-ink-muted group-hover:text-white/70 mt-0.5">Admissions & records</p>
              </div>
            </button>

            <button
              onClick={() => navigate("/headmaster/classes")}
              className="group flex items-center gap-3.5 p-3.5 rounded-lg border border-line hover:border-brand hover:bg-brand transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-soft text-ink group-hover:bg-white/15 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink group-hover:text-white">Class Roster</p>
                <p className="text-[10px] text-ink-muted group-hover:text-white/70 mt-0.5">Classroom assignments</p>
              </div>
            </button>

            <button
              onClick={() => navigate("/headmaster/terms")}
              className="group flex items-center gap-3.5 p-3.5 rounded-lg border border-line hover:border-brand hover:bg-brand transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-soft text-ink group-hover:bg-white/15 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-ink group-hover:text-white">Academic Terms</p>
                <p className="text-[10px] text-ink-muted group-hover:text-white/70 mt-0.5">Sessions & calendars</p>
              </div>
            </button>

          </div>
        </div>

      </div>
    </AdminLayout>
  );
}