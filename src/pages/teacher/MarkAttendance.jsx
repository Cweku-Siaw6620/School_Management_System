import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, query, where, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import TeacherLayout from "../../components/TeacherLayout";

const STATUS_CONFIG = {
  present: {
    label: "Present",
    activeClass: "bg-emerald-600 text-white shadow-xs",
    borderClass: "hover:border-emerald-300 hover:text-emerald-700"
  },
  absent: {
    label: "Absent",
    activeClass: "bg-rose-600 text-white shadow-xs",
    borderClass: "hover:border-rose-300 hover:text-rose-700"
  },
  late: {
    label: "Late",
    activeClass: "bg-amber-500 text-white shadow-xs",
    borderClass: "hover:border-amber-300 hover:text-amber-700"
  },
  excused: {
    label: "Excused",
    activeClass: "bg-slate-700 text-white shadow-xs",
    borderClass: "hover:border-slate-400 hover:text-slate-800"
  }
};

export default function MarkAttendance() {
  const { currentUser } = useAuth();
  const [assignedClass, setAssignedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [remarks, setRemarks] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [date] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [activeTerm, setActiveTerm] = useState(null);
  const [termError, setTermError] = useState("");

  useEffect(() => {
    fetchTeacherClass();
  }, []);

  async function fetchTeacherClass() {
    setLoading(true);
    try {
      // 1. FETCH ACTIVE TERM
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      
      if (termsSnapshot.empty) {
        setTermError("No active term found. Please contact the headmaster to activate a term.");
        setLoading(false);
        return;
      }
      
      const term = { id: termsSnapshot.docs[0].id, ...termsSnapshot.docs[0].data() };
      setActiveTerm(term);

      // 2. VALIDATE TODAY'S DATE IS WITHIN TERM DATES
      const today = new Date(date);
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      
      // Set to start of day for accurate comparison
      today.setHours(0, 0, 0, 0);
      termStart.setHours(0, 0, 0, 0);
      termEnd.setHours(0, 0, 0, 0);

      if (today < termStart || today > termEnd) {
        setTermError(`Today (${date}) is outside the active term dates (${term.startDate} - ${term.endDate}). Attendance cannot be marked.`);
        setLoading(false);
        return;
      }

      // 3. FIND TEACHER'S CLASS
      const classSnap = await getDocs(collection(db, "classes"));
      const myClass = classSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((c) => c.teacherId === currentUser.uid);

      if (!myClass) {
        setLoading(false);
        return;
      }
      setAssignedClass(myClass);

      // 4. FETCH STUDENTS
      const studentSnap = await getDocs(collection(db, "students"));
      const myStudents = studentSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.classId === myClass.id && s.status === "active");
      setStudents(myStudents);

      // 5. CHECK EXISTING ATTENDANCE
      const q = query(
        collection(db, "attendance"),
        where("classId", "==", myClass.id),
        where("date", "==", date)
      );
      const attSnap = await getDocs(q);
      const existing = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (existing.length > 0) {
        setAlreadyMarked(true);
        const prefilledRecords = {};
        const prefilledRemarks = {};
        existing.forEach((r) => {
          prefilledRecords[r.studentId] = r.status;
          if (r.remarks) prefilledRemarks[r.studentId] = r.remarks;
        });
        setRecords(prefilledRecords);
        setRemarks(prefilledRemarks);
      } else {
        // Default to present
        const defaults = {};
        myStudents.forEach((s) => {
          defaults[s.id] = "present";
        });
        setRecords(defaults);
      }
    } catch (err) {
      console.error("Error fetching class data:", err);
      setTermError("Failed to load attendance data.");
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(studentId, status) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  }

  function handleRemarkChange(studentId, text) {
    setRemarks((prev) => ({ ...prev, [studentId]: text }));
  }

  function handleMarkAllPresent() {
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = "present";
    });
    setRecords(updated);
  }

  async function handleSubmit() {
    if (!assignedClass || !activeTerm) return;
    setSaving(true);
    setSaved(false);

    try {
      const batch = writeBatch(db);

      students.forEach((student) => {
        const id = `${assignedClass.id}_${student.id}_${date}`;
        const ref = doc(db, "attendance", id);
        batch.set(ref, {
          classId: assignedClass.id,
          studentId: student.id,
          date,
          termId: activeTerm.id,  // ← NEW: Store which term this belongs to
          status: records[student.id] || "present",
          remarks: remarks[student.id] || "",
          markedBy: currentUser.email,
          updatedAt: new Date(),
        });
      });

      await batch.commit();
      setSaved(true);
      setAlreadyMarked(true);
    } catch (error) {
      console.error("Error saving attendance:", error);
    } finally {
      setSaving(false);
    }
  }

  // Summary counts
  const summary = {
    present: Object.values(records).filter((s) => s === "present").length,
    absent: Object.values(records).filter((s) => s === "absent").length,
    late: Object.values(records).filter((s) => s === "late").length,
    excused: Object.values(records).filter((s) => s === "excused").length,
  };

  // Filtered student list
  const filteredStudents = students.filter((student) => {
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  if (loading) {
    return (
      <TeacherLayout>
        <div className="animate-pulse space-y-6 max-w-4xl mx-auto">
          <div className="h-20 bg-slate-100 rounded-xl"></div>
          <div className="h-96 bg-slate-100 rounded-xl"></div>
        </div>
      </TeacherLayout>
    );
  }

  // Show term error if any
  if (termError) {
    return (
      <TeacherLayout>
        <div className="bg-white border border-amber-200 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4 text-xl">
            ⚠️
          </div>
          <h3 className="font-semibold text-slate-800 text-base">Cannot Mark Attendance</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{termError}</p>
          {!activeTerm && (
            <button
              onClick={() => window.location.href = "/headmaster/terms"}
              className="mt-4 px-4 py-2 bg-sky-900 hover:bg-sky-950 text-white text-xs font-medium rounded-md transition-colors"
            >
              Go to Terms
            </button>
          )}
        </div>
      </TeacherLayout>
    );
  }

  if (!assignedClass) {
    return (
      <TeacherLayout>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4 text-xl">
            📋
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No Assigned Class</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            You haven't been assigned as a class teacher yet. Please reach out to your administrator to set up your assigned class.
          </p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 max-w-4xl mx-auto text-slate-800">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Daily Attendance
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                {assignedClass.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {formattedDate}
              {activeTerm && (
                <span className="ml-2 text-emerald-600 font-medium">
                  • {activeTerm.name}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllPresent}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium transition-colors"
            >
              Mark All Present
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="text-xs px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : alreadyMarked ? "Update Record" : "Save Attendance"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <span>✅</span> Attendance record saved for {date}.
          </div>
        )}
        {alreadyMarked && !saved && (
          <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg flex items-center gap-2">
            <span>ℹ️</span> Attendance for today was previously logged. Edits will overwrite the previous submission.
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
            <p className="text-2xl font-bold text-slate-900">{summary.present}</p>
            <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider mt-0.5">Present</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
            <p className="text-2xl font-bold text-slate-900">{summary.absent}</p>
            <p className="text-[11px] font-medium text-rose-600 uppercase tracking-wider mt-0.5">Absent</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
            <p className="text-2xl font-bold text-slate-900">{summary.late}</p>
            <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider mt-0.5">Late</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-center shadow-xs">
            <p className="text-2xl font-bold text-slate-900">{summary.excused}</p>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">Excused</p>
          </div>
        </div>

        {/* Student Roster Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          
          {/* Search Toolbar */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="Filter students by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 border border-slate-300 rounded-md px-3 py-1.5 text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500"
            />
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filteredStudents.length} of {students.length} students
            </span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching students found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredStudents.map((student, idx) => {
                const currentStatus = records[student.id] || "present";
                return (
                  <div
                    key={student.id}
                    className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono w-5">
                        {idx + 1}.
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {student.firstName} {student.lastName}
                        </p>
                        {remarks[student.id] && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5">
                            Note: "{remarks[student.id]}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Pill Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {Object.entries(STATUS_CONFIG).map(([statusKey, config]) => {
                        const isSelected = currentStatus === statusKey;
                        return (
                          <button
                            key={statusKey}
                            type="button"
                            onClick={() => handleStatusChange(student.id, statusKey)}
                            className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                              isSelected
                                ? config.activeClass + " border-transparent"
                                : "border-slate-200 text-slate-500 bg-white " + config.borderClass
                            }`}
                          >
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Click save when finished recording student status.
            </span>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : alreadyMarked ? "Update Attendance" : "Submit Attendance"}
            </button>
          </div>
        </div>

      </div>
    </TeacherLayout>
  );
}