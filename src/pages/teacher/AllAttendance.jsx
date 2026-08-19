import { useState, useEffect } from "react";
import {
  collection, getDocs, query, where
} from "firebase/firestore";
import { db } from "../../firebase";
import TeacherLayout from "../../components/TeacherLayout";

const STATUS_STYLES = {
  present: "bg-slate-100 text-slate-600",
  absent:  "bg-red-50 text-red-500",
  late:    "bg-amber-50 text-amber-600",
  excused: "bg-gray-100 text-gray-500",
};

export default function AllAttendance() {
  const [classes, setClasses]       = useState([]);
  const [students, setStudents]     = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate]   = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBase(); }, []);

  useEffect(() => {
    if (selectedClass && selectedDate) fetchAttendance();
  }, [selectedClass, selectedDate]);

  async function fetchBase() {
    setLoading(true);
    const [classSnap, studentSnap] = await Promise.all([
      getDocs(collection(db, "classes")),
      getDocs(collection(db, "students")),
    ]);
    setClasses(classSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  async function fetchAttendance() {
    const q = query(
      collection(db, "attendance"),
      where("classId", "==", selectedClass.id),
      where("date",    "==", selectedDate)
    );
    const snap = await getDocs(q);
    setAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  const classStudents = students.filter(
    (s) => s.classId === selectedClass?.id && s.status === "active"
  );

  const getRecord = (studentId) =>
    attendance.find((a) => a.studentId === studentId);

  const summary = {
    present: attendance.filter((a) => a.status === "present").length,
    absent:  attendance.filter((a) => a.status === "absent").length,
    late:    attendance.filter((a) => a.status === "late").length,
    excused: attendance.filter((a) => a.status === "excused").length,
  };

  return (
    <TeacherLayout>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-700">All Classes Attendance</h2>
        <p className="text-sm text-gray-400 mt-1">
          View attendance across all classes
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <div className="flex gap-6">

          {/* Left — Class List */}
          <div className="w-56 shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-1">
              Classes
            </p>
            <div className="bg-white rounded-2xl shadow divide-y divide-gray-100 overflow-hidden">
              {classes.length === 0 ? (
                <p className="text-sm text-gray-400 p-4">No classes found.</p>
              ) : (
                classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => { setSelectedClass(cls); setAttendance([]); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      selectedClass?.id === cls.id
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <p className="font-medium">{cls.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{cls.level}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right — Attendance View */}
          <div className="flex-1">
            {!selectedClass ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-400 text-sm">
                Select a class to view attendance
              </div>
            ) : (
              <div className="space-y-4">

                {/* Date Picker */}
                <div className="bg-white rounded-2xl shadow px-6 py-4 flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-600">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {attendance.length > 0 && (
                    <span className="text-xs text-gray-400">
                      Marked by: {attendance[0]?.markedBy || "—"}
                    </span>
                  )}
                </div>

                {/* Summary Cards */}
                {attendance.length > 0 && (
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(summary).map(([key, val]) => (
                      <div key={key} className="bg-white rounded-xl shadow px-4 py-3">
                        <p className="text-xs text-gray-400 capitalize">{key}</p>
                        <p className="text-2xl font-bold text-gray-700 mt-1">{val}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attendance Table */}
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  {classStudents.length === 0 ? (
                    <p className="text-sm text-gray-400 p-6">
                      No students assigned to this class.
                    </p>
                  ) : attendance.length === 0 ? (
                    <p className="text-sm text-gray-400 p-6">
                      No attendance record found for this date.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-3 text-left">Student</th>
                          <th className="px-6 py-3 text-left">Status</th>
                          <th className="px-6 py-3 text-left">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {classStudents.map((student) => {
                          const record = getRecord(student.id);
                          return (
                            <tr key={student.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-800">
                                {student.firstName} {student.lastName}
                              </td>
                              <td className="px-6 py-4">
                                {record ? (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[record.status]}`}>
                                    {record.status}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-gray-400 text-xs">
                                {record?.remarks || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}
    </TeacherLayout>
  );
}