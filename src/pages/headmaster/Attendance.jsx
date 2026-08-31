import { useState, useEffect } from "react";
import {
  collection, getDocs, query, where
} from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

const STATUS_BADGES = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  absent: "bg-rose-50 text-rose-700 border-rose-200/80",
  late: "bg-amber-50 text-amber-700 border-amber-200/80",
  excused: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function Attendance() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBase(); }, []);

  useEffect(() => {
    if (selectedClass && selectedDate) fetchAttendance();
  }, [selectedClass, selectedDate]);

  async function fetchBase() {
    setLoading(true);
    try {
      const [classSnap, studentSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "students")),
      ]);
      setClasses(classSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching initial attendance data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAttendance() {
    try {
      const q = query(
        collection(db, "attendance"),
        where("classId", "==", selectedClass.id),
        where("date", "==", selectedDate)
      );
      const snap = await getDocs(q);
      setAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching attendance logs:", err);
    }
  }

  const classStudents = students.filter(
    (s) => s.classId === selectedClass?.id && s.status === "active"
  );

  const getRecord = (studentId) =>
    attendance.find((a) => a.studentId === studentId);

  const summary = {
    present: attendance.filter((a) => a.status === "present").length,
    absent: attendance.filter((a) => a.status === "absent").length,
    late: attendance.filter((a) => a.status === "late").length,
    excused: attendance.filter((a) => a.status === "excused").length,
  };

  return (
    <HeadmasterLayout>
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-slate-200/80 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
            Classroom Attendance
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Monitor and review daily student attendance across primary school levels
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-3">
          <svg className="w-5 h-5 animate-spin text-sky-800" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Fetching class registers...
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* Left Sidebar — Class Picker */}
          <div className="w-full md:w-64 shrink-0 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Primary Classes
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {classes.length} Total
              </span>
            </div>

            <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {classes.length === 0 ? (
                <p className="p-4 text-xs text-slate-400 text-center">No classes registered.</p>
              ) : (
                classes.map((cls) => {
                  const isSelected = selectedClass?.id === cls.id;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => { setSelectedClass(cls); setAttendance([]); }}
                      className={`w-full text-left px-4 py-3.5 transition-all flex items-center justify-between group ${
                        isSelected
                          ? "bg-sky-50/80 text-sky-950 font-medium border-l-4 border-sky-800"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className={`text-sm ${isSelected ? "font-semibold text-sky-950" : "font-medium text-slate-800"}`}>
                          {cls.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{cls.level || "Primary Level"}</p>
                      </div>
                      <svg 
                        className={`w-4 h-4 transition-transform ${isSelected ? "text-sky-800 translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Area — Attendance Detail */}
          <div className="flex-1 w-full space-y-6">
            {!selectedClass ? (
              <div className="bg-white rounded-lg border border-dashed border-slate-300 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 text-xl mb-3">
                  📋
                </div>
                <h3 className="font-serif text-base font-semibold text-slate-800">No Class Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Please select a class from the left menu to inspect student roll calls and daily logs.
                </p>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Date Picker Bar */}
                <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Attendance Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-800/20 focus:border-sky-800 bg-slate-50/50"
                    />
                  </div>

                  {attendance.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded border border-slate-200/60">
                      <span className="font-medium text-slate-700">Record Sign-off:</span>
                      <span>{attendance[0]?.markedBy || "Staff Member"}</span>
                    </div>
                  )}
                </div>

                {/* Summary Metrics */}
                {attendance.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Object.entries(summary).map(([key, val]) => (
                      <div key={key} className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                          {key}
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-serif text-2xl font-bold text-slate-900">{val}</span>
                          <span className="text-xs text-slate-400">students</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Student Attendance Table */}
                <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-serif font-semibold text-sm text-slate-900">
                      Roll Call — {selectedClass.name}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {classStudents.length} Enrolled Students
                    </span>
                  </div>

                  {classStudents.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No active students assigned to {selectedClass.name}.
                    </div>
                  ) : attendance.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No attendance record found for {selectedDate}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                            <th className="py-3 px-6">Student Name</th>
                            <th className="py-3 px-6">Attendance Status</th>
                            <th className="py-3 px-6">Teacher Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {classStudents.map((student) => {
                            const record = getRecord(student.id);
                            return (
                              <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-6 font-medium text-slate-900">
                                  {student.firstName} {student.lastName}
                                </td>
                                <td className="py-3.5 px-6">
                                  {record ? (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${STATUS_BADGES[record.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                      {record.status}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Unrecorded</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-6 text-slate-500">
                                  {record?.remarks || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}
    </HeadmasterLayout>
  );
}