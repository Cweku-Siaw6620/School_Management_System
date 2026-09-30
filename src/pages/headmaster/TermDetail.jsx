import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc, getDoc, getDocs, setDoc, collection, query, where,
  updateDoc, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

export default function TermDetail() {
  const { termId } = useParams();
  const navigate = useNavigate();
  
  const [termData, setTermData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (termId) {
      fetchTermData();
    }
  }, [termId]);

  async function fetchTermData() {
    setLoading(true);
    setFormError("");
    
    try {
      const termDoc = await getDoc(doc(db, "terms", termId));
      if (!termDoc.exists()) {
        setFormError("Term record not found.");
        setLoading(false);
        return;
      }
      const termDataFromDb = { id: termDoc.id, ...termDoc.data() };
      setTermData(termDataFromDb);

      const classSnapshot = await getDocs(collection(db, "classes"));
      const classList = classSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.status === "active");
      setClasses(classList);

      const studentsQuery = query(
        collection(db, "students"),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      setStudents(studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      const staffSnapshot = await getDocs(collection(db, "staff"));
      setStaff(
        staffSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.status === "active")
      );

      await fetchTermAttendanceSummary(termDataFromDb);

    } catch (error) {
      console.error("Error fetching term data:", error);
      setFormError("Failed to load academic term data.");
    }
    setLoading(false);
  }

  async function fetchTermAttendanceSummary(term) {
    try {
      const attendanceQuery = query(collection(db, "attendance"));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const allRecords = attendanceSnapshot.docs.map(d => d.data());
      
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      
      const termRecords = allRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= termStart && recordDate <= termEnd;
      });

      setAttendanceSummary({
        total: termRecords.length,
        present: termRecords.filter(r => r.status === "present").length,
        absent: termRecords.filter(r => r.status === "absent").length,
        late: termRecords.filter(r => r.status === "late").length,
        excused: termRecords.filter(r => r.status === "excused").length
      });
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
    }
  }

    async function handlePromoteStudents(e) {
    e.preventDefault();
    setFormError("");
    setActionLoading(true);

    if (!selectedClassId) {
        setFormError("Please select a class to promote");
        setActionLoading(false);
        return;
    }

    try {
        // Get students in the selected class
        const studentsQuery = query(
        collection(db, "students"),
        where("classId", "==", selectedClassId),
        where("status", "==", "active")
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsToPromote = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (studentsToPromote.length === 0) {
        setFormError("No students found in this class to promote");
        setActionLoading(false);
        return;
        }

        const selectedClass = classes.find(c => c.id === selectedClassId);
        const promotionResult = getLevels(selectedClass?.level || "");

        // If students are at JHS 3, mark them as "completed" (graduated)
        if (promotionResult.action === "complete") {
        // Handle graduation - mark students as completed
        const batch = writeBatch(db);
        const graduatedStudents = [];

        for (const student of studentsToPromote) {
            // Save history with graduation record
            const historyEntry = {
            classId: selectedClassId,
            className: selectedClass?.name || "Unknown",
            termId: termId,
            academicYear: termData?.academicYear || "",
            promotedAt: new Date().toISOString(),
            action: "graduated"  // ← Changed from "promoted" to "graduated"
            };

            const currentHistory = student.history || [];
            
            const studentRef = doc(db, "students", student.id);
            batch.update(studentRef, {
            status: "completed",  // ← New status
            classId: null,        // ← Remove from class
            history: [...currentHistory, historyEntry]
            });

            graduatedStudents.push({
            name: `${student.firstName} ${student.lastName}`,
            from: selectedClass?.name || "Unknown",
            action: "graduated"
            });
        }

        await batch.commit();
        
        setSelectedClassId("");
        setTargetLevel("");
        setShowPromoteModal(false);
        
        setSuccessMessage(`${graduatedStudents.length} student(s) have graduated from ${selectedClass?.name}! 🎓`);
        await fetchTermData();
        setTimeout(() => setSuccessMessage(""), 5000);
        setActionLoading(false);
        return;
        }

        // Normal promotion flow (Primary 1-6 → next level, or Primary 6 → JHS 1)
        const targetLevelName = promotionResult.nextLevel;
        
        // Find or create the target class
        let targetClassId = null;
        
        // Check if target class already exists
        const existingClass = classes.find(c => c.name === targetLevelName);
        
        if (existingClass) {
        targetClassId = existingClass.id;
        } else {
        // Create the new class
        const newClassId = crypto.randomUUID();
        await setDoc(doc(db, "classes", newClassId), {
            name: targetLevelName,
            level: targetLevelName,
            capacity: 0,
            teacherId: null,
            status: "active",
            createdAt: new Date()
        });
        targetClassId = newClassId;
        // Refresh classes list
        const classSnapshot = await getDocs(collection(db, "classes"));
        const classList = classSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(c => c.status === "active");
        setClasses(classList);
        }

        // Prepare batch updates for students
        const batch = writeBatch(db);
        const promotedStudents = [];

        for (const student of studentsToPromote) {
        // Save history
        const historyEntry = {
            classId: selectedClassId,
            className: selectedClass?.name || "Unknown",
            termId: termId,
            academicYear: termData?.academicYear || "",
            promotedAt: new Date().toISOString(),
            action: "promoted"
        };

        const currentHistory = student.history || [];
        
        const studentRef = doc(db, "students", student.id);
        batch.update(studentRef, {
            classId: targetClassId,
            history: [...currentHistory, historyEntry]
        });

        promotedStudents.push({
            name: `${student.firstName} ${student.lastName}`,
            from: selectedClass?.name || "Unknown",
            to: targetLevelName
        });
        }

        await batch.commit();

        // Reset form
        setSelectedClassId("");
        setTargetLevel("");
        setShowPromoteModal(false);
        
        setSuccessMessage(`Successfully promoted ${promotedStudents.length} students to ${targetLevelName}!`);
        await fetchTermData();
        setTimeout(() => setSuccessMessage(""), 5000);
        
    } catch (error) {
        console.error("Error promoting students:", error);
        setFormError("Failed to promote students: " + error.message);
    }
    setActionLoading(false);
    }

  function triggerSuccess(msg) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  }

    const getLevels = (currentLevel) => {
    const levels = [
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
    ];
    const currentIndex = levels.indexOf(currentLevel);
    // If level not found or already at JHS 3, return "completed" status
    if (currentIndex === -1 || currentIndex === levels.length - 1) {
        return { nextLevel: null, action: "complete" };
    }
    // Return the next level
    return { nextLevel: levels[currentIndex + 1], action: "promote" };
    };
  const getClassStudents = (classId) => students.filter(s => s.classId === classId);

  const getTeacherName = (teacherId) => {
    const teacher = staff.find(s => s.id === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned";
  };

  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200/60 rounded w-48"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-44 bg-slate-100 rounded-xl border border-slate-200/80"></div>
              <div className="h-60 bg-slate-100 rounded-xl border border-slate-200/80"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-slate-100 rounded-xl border border-slate-200/80"></div>
              <div className="h-60 bg-slate-100 rounded-xl border border-slate-200/80"></div>
            </div>
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  if (!termData) {
    return (
      <HeadmasterLayout>
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <h2 className="font-serif text-lg font-bold text-slate-800">Term Record Not Found</h2>
          <button
            onClick={() => navigate("/headmaster/terms")}
            className="mt-4 px-4 py-2 bg-sky-900 text-white text-xs font-medium rounded-md hover:bg-sky-950 transition-colors"
          >
            ← Return to Term Schedule
          </button>
        </div>
      </HeadmasterLayout>
    );
  }

  return (
    <HeadmasterLayout>
      <div className="space-y-6">

        {/* Top Navigation & Status */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/headmaster/terms")}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
                {termData.name}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {termData.academicYear} &bull; Term {termData.term}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
            termData.isCurrent
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${termData.isCurrent ? "bg-emerald-600" : "bg-slate-400"}`}></span>
            {termData.isCurrent ? "Active Term" : "Inactive"}
          </span>
        </div>

        {/* Dynamic Alerts */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-md">
            {successMessage}
          </div>
        )}
        {formError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-md">
            {formError}
          </div>
        )}

        {/* Grid Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Academic Term Configuration */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
              <h3 className="font-serif text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
                Term Timeline & Parameters
              </h3>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Academic Session</span>
                  <span className="font-medium text-slate-800">{termData.academicYear}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Term Sequence</span>
                  <span className="font-medium text-slate-800">Term {termData.term}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</span>
                  <span className="font-mono text-xs font-medium text-slate-800">{termData.startDate}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</span>
                  <span className="font-mono text-xs font-medium text-slate-800">{termData.endDate}</span>
                </div>
              </div>
            </div>

            {/* Configured Classes Overview */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Active Classes ({classes.length})
                </h3>
                <button
                  onClick={() => navigate("/headmaster/classes")}
                  className="text-xs font-semibold text-sky-800 hover:underline"
                >
                  Manage Classes →
                </button>
              </div>

              {classes.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No active classes registered for this term session.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {classes.map((cls) => {
                    const studentCount = getClassStudents(cls.id).length;
                    return (
                      <Link
                        key={cls.id}
                        to={`/headmaster/classes/${cls.id}`}
                        className="py-3 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-md transition-colors group"
                      >
                        <div>
                          <p className="font-serif text-sm font-semibold text-slate-900 group-hover:text-sky-900 transition-colors">
                            {cls.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Teacher: <span className="font-normal text-slate-700">{getTeacherName(cls.teacherId)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {studentCount} {studentCount === 1 ? "Student" : "Students"}
                          </span>
                          <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Term Attendance Metric Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Term Attendance Aggregates
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-center">
                  <p className="font-serif text-xl font-bold text-emerald-900">{attendanceSummary.present}</p>
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Present</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-center">
                  <p className="font-serif text-xl font-bold text-rose-900">{attendanceSummary.absent}</p>
                  <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Absent</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-center">
                  <p className="font-serif text-xl font-bold text-amber-900">{attendanceSummary.late}</p>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Late</p>
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-lg p-2.5 text-center">
                  <p className="font-serif text-xl font-bold text-sky-900">{attendanceSummary.excused}</p>
                  <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider">Excused</p>
                </div>
              </div>

              <div className="pt-2 text-center border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-3">
                  Total Term Records Evaluated: <strong className="text-slate-800">{attendanceSummary.total}</strong>
                </p>
                <button
                  onClick={() => navigate("/headmaster/attendance")}
                  className="w-full py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md transition-colors"
                >
                  View Full Attendance Ledger
                </button>
              </div>
            </div>

            {/* Action Operations Panel */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-3">
              <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
                Administrative Actions
              </h3>
              
              <button
                onClick={() => setShowPromoteModal(true)}
                className="w-full py-2 px-3 bg-sky-900 text-white text-xs font-medium rounded-md hover:bg-sky-950 transition-colors shadow-xs"
              >
                Promote Class Roster
              </button>
              
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md transition-colors"
              >
                {showHistory ? "Hide Historical Audit Log" : "View Historical Audit Log"}
              </button>
            </div>

          </div>
        </div>

        {/* Promotion & Academic History Table */}
        {showHistory && (
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="font-serif text-base font-bold text-slate-900">
                Student Promotion History Log
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Current Assignment</th>
                    <th className="py-2.5 px-3">Recorded Transition History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {students.slice(0, 10).map((student) => {
                    const history = student.history || [];
                    const currentClass = classes.find(c => c.id === student.classId);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-3 font-serif font-semibold text-slate-800">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-600">
                          {currentClass?.name || "Unassigned"}
                        </td>
                        <td className="py-3 px-3">
                          {history.length === 0 ? (
                            <span className="text-slate-400">No recorded transitions</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {history.map((entry, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px] font-medium"
                                >
                                  {entry.className} {entry.academicYear ? `(${entry.academicYear})` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {students.length > 10 && (
                    <tr>
                      <td colSpan="3" className="py-2.5 text-center text-slate-400 text-xs italic">
                        Displaying 10 of {students.length} active students
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Class Promotion Dialog */}
        {showPromoteModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">Promote Class Roster</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Advance student cohort for {termData.name}</p>
                </div>
                <button
                  onClick={() => { setShowPromoteModal(false); setFormError(""); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3.5 py-2.5 rounded-md mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handlePromoteStudents} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Select Source Class
                  </label>
                  <select
                    required
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      const selectedClass = classes.find(c => c.id === e.target.value);
                      if (selectedClass) {
                        const nextLevels = getLevels(selectedClass.level);
                        setTargetLevel(nextLevels.length > 0 ? nextLevels[0] : "");
                      }
                    }}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-800"
                  >
                    <option value="">Choose a class to promote...</option>
                    {classes.map(cls => {
                      const studentCount = getClassStudents(cls.id).length;
                      return (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({studentCount} students)
                        </option>
                      );
                    })}
                  </select>
                </div>

            {selectedClassId && (
            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Target Level *
                </label>
                <div className={`rounded-md p-3 border ${
                targetLevel === "completed" 
                    ? "bg-amber-50 border-amber-200" 
                    : "bg-slate-50 border-slate-200"
                }`}>
                {targetLevel === "completed" ? (
                    <div>
                    <p className="text-sm font-medium text-amber-700">🎓 Graduation</p>
                    <p className="text-xs text-amber-600 mt-1">
                        These students have completed JHS 3 and will be marked as graduated.
                        They will no longer be assigned to any class.
                    </p>
                    </div>
                ) : targetLevel ? (
                    <div>
                    <p className="text-sm text-slate-700">Next Level: <strong>{targetLevel}</strong></p>
                    <p className="text-xs text-slate-400 mt-1">
                        Students will be moved to: {targetLevel}
                        {classes.find(c => c.name === targetLevel) 
                        ? " (existing class)" 
                        : " (new class will be created)"}
                    </p>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">No promotion available</p>
                )}
                </div>
            </div>
            )}

                {selectedClassId && targetLevel && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold"> Batch Execution Details:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                      <li>Reassigns all active students to target level</li>
                      <li>Appends current placement details into student audit history</li>
                      <li>Generates target class if non-existent</li>
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowPromoteModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-xs font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !targetLevel}
                    className="flex-1 bg-sky-900 hover:bg-sky-950 text-white py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                    >
                    {actionLoading ? "Processing..." : targetLevel === "completed" ? "Graduate Students 🎓" : "Promote Students"}
                </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </HeadmasterLayout>
  );
}