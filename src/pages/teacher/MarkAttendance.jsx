import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, setDoc, query, where, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../components/AdminLayout";

const STATUSES = ["present", "absent", "late", "excused"];

const STATUS_STYLES = {
  present: "bg-slate-600 text-white",
  absent: "bg-red-400 text-white",
  late: "bg-amber-400 text-white",
  excused: "bg-gray-300 text-gray-700",
};

const STATUS_IDLE = "border border-gray-200 text-gray-400 hover:bg-gray-50";

export default function MarkAttendance() {
  const { currentUser } = useAuth();
  const [assignedClass, setAssignedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [existingAttendance, setExistingAttendance] = useState([]);
  const [date] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  useEffect(() => { fetchTeacherClass(); }, []);

  async function fetchTeacherClass() {
    setLoading(true);

    // Find class assigned to this teacher
    const classSnap = await getDocs(collection(db, "classes"));
    const myClass = classSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((c) => c.teacherId === currentUser.uid);

    if (!myClass) { setLoading(false); return; }
    setAssignedClass(myClass);

    // Get students in that class
    const studentSnap = await getDocs(collection(db, "students"));
    const myStudents = studentSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => s.classId === myClass.id && s.status === "active");
    setStudents(myStudents);

    // Check if attendance already marked today
    const q = query(
      collection(db, "attendance"),
      where("classId", "==", myClass.id),
      where("date", "==", date)
    );
    const attSnap = await getDocs(q);
    const existing = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setExistingAttendance(existing);

    if (existing.length > 0) {
      setAlreadyMarked(true);
      // Pre-fill records from existing
      const prefilled = {};
      existing.forEach((r) => { prefilled[r.studentId] = r.status; });
      setRecords(prefilled);
    } else {
      // Default all to present
      const defaults = {};
      myStudents.forEach((s) => { defaults[s.id] = "present"; });
      setRecords(defaults);
    }

    setLoading(false);
  }

  function setStatus(studentId, status) {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSubmit() {
    if (!assignedClass) return;
    setSaving(true);

    const batch = writeBatch(db);

    students.forEach((student) => {
      const id = `${assignedClass.id}_${student.id}_${date}`;
      const ref = doc(db, "attendance", id);
      batch.set(ref, {
        classId: assignedClass.id,
        studentId: student.id,
        date,
        status: records[student.id] || "present",
        markedBy: currentUser.email,
        remarks: "",
        createdAt: new Date(),
      });
    });

    await batch.commit();
    setSaving(false);
    setSaved(true);
    setAlreadyMarked(true);
  }

  const summary = {
    present: Object.values(records).filter((s) => s === "present").length,
    absent: Object.values(records).filter((s) => s === "absent").length,
    late: Object.values(records).filter((s) => s === "late").length,
    excused: Object.values(records).filter((s) => s === "excused").length,
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-700">Mark Attendance</h2>
        <p className="text-sm text-gray-400 mt-1">{date}</p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : !assignedClass ? (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-400 text-sm">
          You have not been assigned to any class yet.
          <br />Contact your administrator.
        </div>
      ) : (
        <div className="space-y-4">

          {/* Class Info */}
          <div className="bg-white rounded-2xl shadow px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-700">{assignedClass.name}</p>
              <p className="text-xs text-gray-400">{assignedClass.level}</p>
            </div>
            <div className="flex gap-4 text-center">
              {Object.entries(summary).map(([key, val]) => (
                <div key={key}>
                  <p className="text-lg font-bold text-gray-700">{val}</p>
                  <p className="text-xs text-gray-400 capitalize">{key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Already marked notice */}
          {alreadyMarked && !saved && (
            <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm px-4 py-3 rounded-xl">
              Attendance has already been marked for today. You can update it below.
            </div>
          )}

          {saved && (
            <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm px-4 py-3 rounded-xl">
              Attendance saved successfully.
            </div>
          )}

          {/* Student List */}
          {students.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-400">
              No students assigned to your class.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3 text-left">Student</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {STATUSES.map((status) => (
                            <button
                              key={status}
                              onClick={() => setStatus(student.id, status)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                                records[student.id] === status
                                  ? STATUS_STYLES[status]
                                  : STATUS_IDLE
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : alreadyMarked ? "Update Attendance" : "Submit Attendance"}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </AdminLayout>
  );
}