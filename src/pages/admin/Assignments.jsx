import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, updateDoc, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function Assignments() {
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeTab, setActiveTab] = useState("teacher");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [classSnap, staffSnap, studentSnap] = await Promise.all([
      getDocs(collection(db, "classes")),
      getDocs(collection(db, "staff")),
      getDocs(collection(db, "students")),
    ]);
    setClasses(classSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setStaff(staffSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setStudents(studentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  function handleSelectClass(cls) {
    setSelectedClass(cls);
    setSelectedTeacher(cls.teacherId || "");
    setActiveTab("teacher");
    setSuccessMsg("");

    // Pre-select students already assigned to this class
    const assigned = students
      .filter((s) => s.classId === cls.id)
      .map((s) => s.id);
    setSelectedStudents(assigned);
  }

  async function handleAssignTeacher() {
    if (!selectedClass || !selectedTeacher) return;
    setSaving(true);
    await updateDoc(doc(db, "classes", selectedClass.id), {
      teacherId: selectedTeacher,
    });
    setSuccessMsg("Class teacher assigned successfully.");
    fetchAll();
    setSaving(false);
  }

  async function handleAssignStudents() {
    if (!selectedClass) return;
    setSaving(true);

    const batch = writeBatch(db);

    // Remove class from students no longer selected
    students
      .filter((s) => s.classId === selectedClass.id && !selectedStudents.includes(s.id))
      .forEach((s) => {
        batch.update(doc(db, "students", s.id), { classId: null });
      });

    // Assign selected students to this class
    selectedStudents.forEach((sid) => {
      batch.update(doc(db, "students", sid), { classId: selectedClass.id });
    });

    await batch.commit();
    setSuccessMsg("Students assigned successfully.");
    fetchAll();
    setSaving(false);
  }

  function toggleStudent(id) {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // Academic staff only for teacher assignment
  const academicStaff = staff.filter((s) =>
    ["Headteacher", "Assistant Headteacher", "Class Teacher", "Subject Teacher"].includes(s.position)
    && s.status === "active"
  );

  // Students not assigned to any class OR already in this class
  const availableStudents = students.filter(
    (s) => s.status === "active" && (s.classId === null || s.classId === selectedClass?.id)
  );

  const getTeacherName = (teacherId) => {
    const t = staff.find((s) => s.id === teacherId);
    return t ? `${t.firstName} ${t.lastName}` : "Unassigned";
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-700">Assignments</h2>
        <p className="text-sm text-gray-400 mt-1">
          Assign class teachers and students to classes
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <div className="flex gap-6">

          {/* Left — Class List */}
          <div className="w-64 shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-1">
              Select a Class
            </p>
            <div className="bg-white rounded-2xl shadow divide-y divide-gray-100 overflow-hidden">
              {classes.length === 0 ? (
                <p className="text-sm text-gray-400 p-4">No classes found.</p>
              ) : (
                classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
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

          {/* Right — Assignment Panel */}
          <div className="flex-1">
            {!selectedClass ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-400 text-sm">
                Select a class on the left to manage assignments
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow overflow-hidden">

                {/* Class Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-700 text-lg">{selectedClass.name}</h3>
                  <p className="text-sm text-gray-400">{selectedClass.level}</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                  {["teacher", "students"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setActiveTab(tab); setSuccessMsg(""); }}
                      className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? "border-b-2 border-blue-600 text-blue-600"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {tab === "teacher" ? "Class Teacher" : "Students"}
                    </button>
                  ))}
                </div>

                <div className="p-6">

                  {/* Success message */}
                  {successMsg && (
                    <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg mb-4">
                      {successMsg}
                    </div>
                  )}

                  {/* Teacher Tab */}
                  {activeTab === "teacher" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Current Teacher
                        </label>
                        <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                          {getTeacherName(selectedClass.teacherId)}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Assign New Teacher
                        </label>
                        <select
                          value={selectedTeacher}
                          onChange={(e) => setSelectedTeacher(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                        >
                          <option value="">Select a teacher</option>
                          {academicStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName} — {s.position}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handleAssignTeacher}
                        disabled={saving || !selectedTeacher}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Assign Teacher"}
                      </button>
                    </div>
                  )}

                  {/* Students Tab */}
                  {activeTab === "students" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          {selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""} selected
                        </p>
                        <button
                          onClick={() =>
                            setSelectedStudents(
                              selectedStudents.length === availableStudents.length
                                ? []
                                : availableStudents.map((s) => s.id)
                            )
                          }
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {selectedStudents.length === availableStudents.length
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                      </div>

                      {availableStudents.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          No available students. All active students are already assigned to other classes.
                        </p>
                      ) : (
                        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-72 overflow-y-auto">
                          {availableStudents.map((student) => (
                            <label
                              key={student.id}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedStudents.includes(student.id)}
                                onChange={() => toggleStudent(student.id)}
                                className="accent-blue-600"
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-700">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="text-xs text-gray-400 capitalize">
                                  {student.gender} · {student.dateOfBirth || "—"}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={handleAssignStudents}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Assignments"}
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </AdminLayout>
  );
}