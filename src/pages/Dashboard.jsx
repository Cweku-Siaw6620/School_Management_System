import AdminLayout from "../components/AdminLayout";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    students: { count: 0, trend: null, previous: 0 },
    teachers: { count: 0, trend: null, previous: 0 },
    classes: { count: 0, trend: null, previous: 0 },
    term: { name: "", weeks: 0, status: "inactive" },
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setIsLoading(true);
    try {
      // Fetch active students
      const studentsQuery = query(
        collection(db, "students"),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const activeStudents = studentsSnapshot.size;

      // Fetch active staff (teachers + headteachers)
      const staffQuery = query(
        collection(db, "staff"),
        where("status", "==", "active")
      );
      const staffSnapshot = await getDocs(staffQuery);
      const activeStaff = staffSnapshot.size;

      // Fetch active classes
      const classesQuery = query(
        collection(db, "classes"),
        where("status", "==", "active")
      );
      const classesSnapshot = await getDocs(classesQuery);
      const activeClasses = classesSnapshot.size;

      // Fetch current term
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      let currentTerm = { name: "", weeks: 0, status: "inactive" };
      
      if (!termsSnapshot.empty) {
        const termData = termsSnapshot.docs[0].data();
        // Calculate weeks remaining (rough estimate)
        const endDate = new Date(termData.endDate);
        const today = new Date();
        const diffTime = endDate - today;
        const diffWeeks = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)));
        
        currentTerm = {
          name: termData.name || `${termData.term} - ${termData.academicYear}`,
          weeks: diffWeeks,
          status: "active",
        };
      }

      setStats({
        students: { 
          count: activeStudents, 
          trend: null, 
          previous: 0 
        },
        teachers: { 
          count: activeStaff, 
          trend: null, 
          previous: 0 
        },
        classes: { 
          count: activeClasses, 
          trend: null, 
          previous: 0 
        },
        term: currentTerm,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
    setIsLoading(false);
  }

  const cards = [
    {
      id: "students",
      label: "Total Students",
      value: stats.students.count,
      icon: "👨‍🎓",
      trend: stats.students.trend,
      previous: stats.students.previous,
    },
    {
      id: "teachers",
      label: "Total Teachers",
      value: stats.teachers.count,
      icon: "👨‍🏫",
      trend: stats.teachers.trend,
      previous: stats.teachers.previous,
    },
    {
      id: "classes",
      label: "Total Classes",
      value: stats.classes.count,
      icon: "📚",
      trend: stats.classes.trend,
      previous: stats.classes.previous,
    },
    {
      id: "term",
      label: "Active Term",
      value: stats.term.name || "—",
      icon: "📅",
      trend: null,
      previous: null,
      subtitle:
        stats.term.status === "active"
          ? `${stats.term.weeks} weeks remaining`
          : "No active term",
    },
  ];

  const getTrendDisplay = (trend) => {
    if (trend === null || trend === undefined) return null;
    if (trend > 0) return `↑ +${trend}`;
    if (trend < 0) return `↓ ${trend}`;
    return `− 0`;
  };

  const getTrendColor = (trend) => {
    if (trend === null || trend === undefined) return "text-gray-400";
    if (trend > 0) return "text-green-700 bg-green-50";
    if (trend < 0) return "text-red-700 bg-red-50";
    return "text-gray-500 bg-gray-50";
  };

  // Navigate to pages
  const handleQuickAction = (path) => {
    navigate(path);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back. Here's an overview of your institution.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => {
          const showTrend = card.trend !== null && card.trend !== undefined;
          const trendColor = getTrendColor(card.trend);
          const trendDisplay = getTrendDisplay(card.trend);

          return (
            <div
              key={card.id}
              className="group bg-white rounded-xl border border-gray-100 p-6 hover:border-gray-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {card.label}
                  </p>

                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-semibold text-gray-900 tracking-tight">
                      {card.value}
                    </p>

                    {showTrend && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${trendColor}`}
                      >
                        {trendDisplay}
                      </span>
                    )}
                  </div>

                  {card.subtitle && (
                    <p className="text-xs text-gray-400">{card.subtitle}</p>
                  )}

                  {showTrend && card.previous !== null && (
                    <p className="text-xs text-gray-400">
                      Previous: {card.previous}
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0 w-11 h-11 bg-gray-50 rounded-xl flex items-center justify-center text-xl group-hover:bg-gray-100 transition-colors">
                  {card.icon}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {stats.students.count === 0 &&
        stats.teachers.count === 0 &&
        stats.classes.count === 0 && (
          <div className="mt-12 text-center py-12 px-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 border border-gray-200 text-3xl">
              📋
            </div>
            <h3 className="text-sm font-medium text-gray-700">No data available</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Start by adding students, teachers, and classes to see your dashboard populate.
            </p>
            <button 
              onClick={() => handleQuickAction("/admin/students")}
              className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Add Your First Student
            </button>
          </div>
        )}

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        <button 
          onClick={() => handleQuickAction("/admin/students")}
          className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
        >
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-gray-100 transition-colors">
            👨‍🎓
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Register Student</p>
            <p className="text-xs text-gray-400">Add a new student</p>
          </div>
        </button>

        <button 
          onClick={() => handleQuickAction("/admin/staff")}
          className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
        >
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-gray-100 transition-colors">
            👨‍🏫
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Add Teacher</p>
            <p className="text-xs text-gray-400">Onboard a new teacher</p>
          </div>
        </button>

        <button 
          onClick={() => handleQuickAction("/admin/terms")}
          className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 hover:bg-gray-50 transition-all text-left group"
        >
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl group-hover:bg-gray-100 transition-colors">
            📅
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Manage Term</p>
            <p className="text-xs text-gray-400">Set up academic calendar</p>
          </div>
        </button>
      </div>
    </AdminLayout>
  );
}