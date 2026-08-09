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

    students
      .filter((s) => s.classId === selectedClass.id && !selectedStudents.includes(s.id))
      .forEach((s) => {
        batch.update(doc(db, "students", s.id), { classId: null });
      });

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

  const academicStaff = staff.filter((s) =>
    ["Headteacher", "Assistant Headteacher", "Class Teacher", "Subject Teacher"].includes(s.position)
    && s.status === "active"
  );

  const availableStudents = students.filter(
    (s) => s.status === "active" && (s.classId === null || s.classId === selectedClass?.id)
  );

  const getTeacherName = (teacherId) => {
    const t = staff.find((s) => s.id === teacherId);
    return t ? `${t.firstName} ${t.lastName}` : "Unassigned";
  };

  // Loading skeleton
  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse">
          <div className="mb-6">
            <div className="h-8 bg-gray-200 rounded w-40"></div>
            <div className="h-4 bg-gray-200 rounded w-64 mt-2"></div>
          </div>
          <div className="flex gap-6">
            <div className="w-64 shrink-0">
              <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="bg-white rounded-xl border border-gray-100 p-8">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-10 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Assignments
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign class teachers and students to classes
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — Class List */}
        <div className="lg:w-64 w-full shrink-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
            Classes
          </p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center">No classes found.</p>
            ) : (
              classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => handleSelectClass(cls)}
                  className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-50 last:border-0 ${
                    selectedClass?.id === cls.id
                      ? "bg-gray-50 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-medium">{cls.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{cls.level}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right — Assignment Panel */}
        <div className="flex-1">
          {!selectedClass ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm shadow-sm">
              <div className="text-4xl mb-4 text-gray-300">📋</div>
              <p>Select a class on the left to manage assignments</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              {/* Class Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">{selectedClass.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedClass.level}</p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {["teacher", "students"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSuccessMsg(""); }}
                    className={`px-6 py-3 text-sm font-medium capitalize transition-colors relative ${
                      activeTab === tab
                        ? "text-gray-900"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab === "teacher" ? "Class Teacher" : "Students"}
                    {activeTab === tab && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* Success message */}
                {successMsg && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg mb-4">
                    {successMsg}
                  </div>
                )}

                {/* Teacher Tab */}
                {activeTab === "teacher" && (
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        Current Teacher
                      </label>
                      <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                        {getTeacherName(selectedClass.teacherId)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                        Assign New Teacher
                      </label>
                      <select
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-gray-700"
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
                      className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Assigning..." : "Assign Teacher"}
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
                      {availableStudents.length > 0 && (
                        <button
                          onClick={() =>
                            setSelectedStudents(
                              selectedStudents.length === availableStudents.length
                                ? []
                                : availableStudents.map((s) => s.id)
                            )
                          }
                          className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {selectedStudents.length === availableStudents.length
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                      )}
                    </div>

                    {availableStudents.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-6 text-center">
                        <p className="text-sm text-gray-400">
                          No available students. All active students are already assigned to other classes.
                        </p>
                      </div>
                    ) : (
                      <div className="border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-50 max-h-64 overflow-y-auto">
                        {availableStudents.map((student) => (
                          <label
                            key={student.id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                              className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-700">
                                {student.firstName} {student.lastName}
                              </p>
                              <p className="text-xs text-gray-400 capitalize">
                                {student.gender || "—"} · {student.dateOfBirth || "—"}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={handleAssignStudents}
                      disabled={saving || availableStudents.length === 0}
                      className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </AdminLayout>
  );
}