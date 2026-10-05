import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

export default function HeadmasterDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClasses: 0,
    activeClasses: 0,
    totalStudents: 0,
    totalStaff: 0,
    activeTerm: null,
    attendanceToday: { present: 0, absent: 0, total: 0, percentage: 0 },
    pendingPromotions: 0,
    subjectAssignments: 0,
    classAssignments: 0,
    teachersWithLogin: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // Get all classes
      const classesSnapshot = await getDocs(collection(db, "classes"));
      const allClasses = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeClasses = allClasses.filter(c => c.status === "active");

      // Get all active students
      const studentsQuery = query(
        collection(db, "students"),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const students = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Get all active staff
      const staffQuery = query(
        collection(db, "staff"),
        where("status", "==", "active")
      );
      const staffSnapshot = await getDocs(staffQuery);
      const staff = staffSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Count teachers with login (academic staff)
      const teachersWithLogin = staff.filter(s => s.hasLogin === true).length;

      // Get current term
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      let activeTerm = null;
      let termId = null;
      if (!termsSnapshot.empty) {
        activeTerm = termsSnapshot.docs[0].data();
        termId = termsSnapshot.docs[0].id;
      }

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("date", "==", today)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceRecords = attendanceSnapshot.docs.map(d => d.data());
      
      const present = attendanceRecords.filter(r => r.status === "present").length;
      const absent = attendanceRecords.filter(r => r.status === "absent").length;
      const totalAttendance = attendanceRecords.length;

      // Get assignments for current term
      let classAssignments = 0;
      let subjectAssignments = 0;
      if (termId) {
        const classAssignQuery = query(
          collection(db, "classAssignments"),
          where("termId", "==", termId)
        );
        const classAssignSnap = await getDocs(classAssignQuery);
        classAssignments = classAssignSnap.size;

        const subjectAssignQuery = query(
          collection(db, "subjectAssignments"),
          where("termId", "==", termId)
        );
        const subjectAssignSnap = await getDocs(subjectAssignQuery);
        subjectAssignments = subjectAssignSnap.size;
      }

      // Count pending promotions (students in JHS 3)
      // Get all students with classId, then check their class level
      let pendingPromotions = 0;
      for (const student of students) {
        if (student.classId) {
          try {
            const classDoc = await getDoc(doc(db, "classes", student.classId));
            if (classDoc.exists() && classDoc.data().level === "JHS 3") {
              pendingPromotions++;
            }
          } catch (err) {
            // Skip if class not found
            console.warn("Class not found for student:", student.id);
          }
        }
      }

      setStats({
        totalClasses: allClasses.length,
        activeClasses: activeClasses.length,
        totalStudents: students.length,
        totalStaff: staff.length,
        activeTerm,
        attendanceToday: {
          present,
          absent,
          total: totalAttendance,
          percentage: totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0
        },
        pendingPromotions,
        classAssignments,
        subjectAssignments,
        teachersWithLogin
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-28 bg-brand-soft rounded-xl border border-line"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-36 bg-brand-soft rounded-xl border border-line"></div>
            ))}
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  return (
    <HeadmasterLayout>
      <div className="space-y-8 max-w-7xl mx-auto text-ink">
        
        {/* Header Bar */}
        <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="eyebrow">
              Academic Administration
            </span>
            <h1 className="text-2xl font-bold text-ink tracking-tight mt-1">
              Headmaster Overview
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {stats.activeTerm ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-soft border border-line text-xs font-medium text-ink-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
                {stats.activeTerm.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-soft border border-line text-xs font-medium text-ink-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-line-strong"></span>
                No Active Term
              </span>
            )}
            <span className="text-xs text-ink-faint border-l border-line pl-3 py-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div>
          <div className="mb-3">
            <h2 className="eyebrow">
              Institutional Metrics
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Classes */}
            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Classes</span>
                <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">
                  {stats.totalClasses}
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  <span className="text-ink-soft font-medium">{stats.activeClasses} active</span> · {stats.totalClasses - stats.activeClasses} inactive
                </p>
              </div>
            </div>

            {/* Metric 2: Students */}
            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Students</span>
                <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">
                  {stats.totalStudents}
                </p>
                <p className="text-xs text-ink-faint mt-1">Total active enrollments</p>
              </div>
            </div>

            {/* Metric 3: Staff */}
            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Faculty & Staff</span>
                <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">
                  {stats.totalStaff}
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  <span className="text-ink-soft font-medium">{stats.teachersWithLogin} academic</span> · {stats.totalStaff - stats.teachersWithLogin} support
                </p>
              </div>
            </div>

            {/* Metric 4: Attendance */}
            <div className="card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Daily Attendance</span>
                <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">
                  {stats.attendanceToday.percentage}%
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  <span className="text-ink-soft font-medium">{stats.attendanceToday.present} present</span> · {stats.attendanceToday.absent} absent
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Secondary Term Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5">
            <p className="eyebrow">Class Teachers Assigned</p>
            <p className="text-2xl font-bold text-ink mt-2 tabular-nums">{stats.classAssignments}</p>
            <p className="text-xs text-ink-faint mt-0.5">Active term allocations</p>
          </div>

          <div className="card p-5">
            <p className="eyebrow">Subject Teachers Assigned</p>
            <p className="text-2xl font-bold text-ink mt-2 tabular-nums">{stats.subjectAssignments}</p>
            <p className="text-xs text-ink-faint mt-0.5">Active term allocations</p>
          </div>

          <div className="card p-5">
            <p className="eyebrow">Promotion Readiness</p>
            <p className="text-2xl font-bold text-ink mt-2 tabular-nums">{stats.pendingPromotions}</p>
            <p className="text-xs text-ink-faint mt-0.5">JHS 3 candidate records</p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="card p-6">
          <div className="mb-4">
            <h2 className="eyebrow">
              Quick Administrative Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            <button
              onClick={() => window.location.href = "/headmaster/classes"}
              className="flex items-center gap-3 p-3.5 border border-line rounded-lg hover:border-line-strong hover:bg-brand-soft transition-colors text-left group"
            >
              <div className="p-2 border border-line rounded-md bg-brand-soft group-hover:bg-surface text-ink-soft">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Manage Classes</p>
                <p className="text-xs text-ink-faint">View & structure classes</p>
              </div>
            </button>

            <button
              onClick={() => window.location.href = "/headmaster/terms"}
              className="flex items-center gap-3 p-3.5 border border-line rounded-lg hover:border-line-strong hover:bg-brand-soft transition-colors text-left group"
            >
              <div className="p-2 border border-line rounded-md bg-brand-soft group-hover:bg-surface text-ink-soft">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Manage Terms</p>
                <p className="text-xs text-ink-faint">Configure academic calendar</p>
              </div>
            </button>

            <button
              onClick={() => window.location.href = "/headmaster/assign-class-teachers"}
              className="flex items-center gap-3 p-3.5 border border-line rounded-lg hover:border-line-strong hover:bg-brand-soft transition-colors text-left group"
            >
              <div className="p-2 border border-line rounded-md bg-brand-soft group-hover:bg-surface text-ink-soft">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Assign Teachers</p>
                <p className="text-xs text-ink-faint">Classes & subject allocation</p>
              </div>
            </button>

            <button
              onClick={() => window.location.href = "/headmaster/scores-review"}
              className="flex items-center gap-3 p-3.5 border border-line rounded-lg hover:border-line-strong hover:bg-brand-soft transition-colors text-left group"
            >
              <div className="p-2 border border-line rounded-md bg-brand-soft group-hover:bg-surface text-ink-soft">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Review Scores</p>
                <p className="text-xs text-ink-faint">Approve academic entries</p>
              </div>
            </button>

          </div>
        </div>

      </div>
    </HeadmasterLayout>
  );
}