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
          <div className="h-8 bg-line rounded w-48"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-44 bg-brand-soft rounded-xl border border-line"></div>
              <div className="h-60 bg-brand-soft rounded-xl border border-line"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-brand-soft rounded-xl border border-line"></div>
              <div className="h-60 bg-brand-soft rounded-xl border border-line"></div>
            </div>
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  if (!termData) {
    return (
      <HeadmasterLayout>
        <div className="card p-12 text-center">
          <h2 className="text-lg font-bold text-ink">Term Record Not Found</h2>
          <button
            onClick={() => navigate("/headmaster/terms")}
            className="btn btn-primary mt-4"
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
        <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/headmaster/terms")}
              className="btn btn-secondary px-3 py-1.5"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-ink tracking-tight">
                {termData.name}
              </h1>
              <p className="text-xs text-ink-muted font-medium mt-0.5">
                {termData.academicYear} &bull; Term {termData.term}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
            termData.isCurrent
              ? "bg-success-soft text-success-ink border-success-line"
              : "bg-brand-soft text-ink-soft border-line"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${termData.isCurrent ? "bg-success" : "bg-ink-faint"}`}></span>
            {termData.isCurrent ? "Active Term" : "Inactive"}
          </span>
        </div>

        {/* Dynamic Alerts */}
        {successMessage && (
          <div className="bg-success-soft border border-success-line text-success-ink text-xs px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}
        {formError && (
          <div className="alert-error">
            {formError}
          </div>
        )}

        {/* Grid Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Academic Term Configuration */}
            <div className="card p-6">
              <h3 className="text-base font-bold text-ink pb-3 border-b border-line">
                Term Timeline & Parameters
              </h3>
              <div className="divide-y divide-line text-sm">
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Academic Session</span>
                  <span className="font-medium text-ink">{termData.academicYear}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Term Sequence</span>
                  <span className="font-medium text-ink">Term {termData.term}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Start Date</span>
                  <span className="font-mono text-xs font-medium text-ink">{termData.startDate}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">End Date</span>
                  <span className="font-mono text-xs font-medium text-ink">{termData.endDate}</span>
                </div>
              </div>
            </div>

            {/* Configured Classes Overview */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-base font-bold text-ink">
                  Active Classes ({classes.length})
                </h3>
                <button
                  onClick={() => navigate("/headmaster/classes")}
                  className="text-xs font-semibold text-ink hover:underline"
                >
                  Manage Classes →
                </button>
              </div>

              {classes.length === 0 ? (
                <p className="text-xs text-ink-faint py-4 text-center">No active classes registered for this term session.</p>
              ) : (
                <div className="divide-y divide-line">
                  {classes.map((cls) => {
                    const studentCount = getClassStudents(cls.id).length;
                    return (
                      <Link
                        key={cls.id}
                        to={`/headmaster/classes/${cls.id}`}
                        className="py-3 flex items-center justify-between hover:bg-brand-soft px-2 rounded-md transition-colors group"
                      >
                        <div>
                          <p className="text-sm font-semibold text-ink group-hover:text-ink transition-colors">
                            {cls.name}
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            Teacher: <span className="font-normal text-ink-soft">{getTeacherName(cls.teacherId)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium px-2 py-0.5 bg-brand-soft text-ink-soft rounded">
                            {studentCount} {studentCount === 1 ? "Student" : "Students"}
                          </span>
                          <span className="text-ink-faint group-hover:text-ink-soft transition-colors">→</span>
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
            <div className="card p-6 space-y-4">
              <div className="pb-2 border-b border-line">
                <h3 className="text-base font-bold text-ink">
                  Term Attendance Aggregates
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-success-soft border border-success-line rounded-lg p-2.5 text-center">
                  <p className="text-xl font-bold text-success-ink">{attendanceSummary.present}</p>
                  <p className="text-xs font-semibold text-success-ink uppercase tracking-wider">Present</p>
                </div>
                <div className="bg-danger-soft border border-danger-line rounded-lg p-2.5 text-center">
                  <p className="text-xl font-bold text-danger-ink">{attendanceSummary.absent}</p>
                  <p className="text-xs font-semibold text-danger-ink uppercase tracking-wider">Absent</p>
                </div>
                <div className="bg-brand-soft border border-line rounded-lg p-2.5 text-center">
                  <p className="text-xl font-bold text-ink">{attendanceSummary.late}</p>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Late</p>
                </div>
                <div className="bg-surface border border-line-strong rounded-lg p-2.5 text-center">
                  <p className="text-xl font-bold text-ink">{attendanceSummary.excused}</p>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Excused</p>
                </div>
              </div>

              <div className="pt-2 text-center border-t border-line">
                <p className="text-xs text-ink-muted mb-3">
                  Total Term Records Evaluated: <strong className="text-ink">{attendanceSummary.total}</strong>
                </p>
                <button
                  onClick={() => navigate("/headmaster/attendance")}
                  className="btn btn-secondary w-full"
                >
                  View Full Attendance Ledger
                </button>
              </div>
            </div>

            {/* Action Operations Panel */}
            <div className="card p-6 space-y-3">
              <h3 className="text-base font-bold text-ink pb-2 border-b border-line">
                Administrative Actions
              </h3>
              
              <button
                onClick={() => setShowPromoteModal(true)}
                className="btn btn-primary w-full"
              >
                Promote Class Roster
              </button>
              
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="btn btn-secondary w-full"
              >
                {showHistory ? "Hide Historical Audit Log" : "View Historical Audit Log"}
              </button>
            </div>

          </div>
        </div>

        {/* Promotion & Academic History Table */}
        {showHistory && (
          <div className="card p-6 space-y-4">
            <div className="pb-3 border-b border-line">
              <h3 className="text-base font-bold text-ink">
                Student Promotion History Log
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-ink-muted uppercase tracking-wider bg-brand-soft">
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Current Assignment</th>
                    <th className="py-2.5 px-3">Recorded Transition History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {students.slice(0, 10).map((student) => {
                    const history = student.history || [];
                    const currentClass = classes.find(c => c.id === student.classId);
                    return (
                      <tr key={student.id} className="hover:bg-brand-soft transition-colors">
                        <td className="py-3 px-3 font-semibold text-ink">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="py-3 px-3 font-medium text-ink-soft">
                          {currentClass?.name || "Unassigned"}
                        </td>
                        <td className="py-3 px-3">
                          {history.length === 0 ? (
                            <span className="text-ink-faint">No recorded transitions</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {history.map((entry, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-brand-soft border border-line text-ink-soft rounded text-[11px] font-medium"
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
                      <td colSpan="3" className="py-2.5 text-center text-ink-faint text-xs italic">
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
          <div className="fixed inset-0 bg-brand backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="card shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
                <div>
                  <h3 className="text-lg font-bold text-ink">Promote Class Roster</h3>
                  <p className="text-xs text-ink-muted mt-0.5">Advance student cohort for {termData.name}</p>
                </div>
                <button
                  onClick={() => { setShowPromoteModal(false); setFormError(""); }}
                  className="text-ink-faint hover:text-ink-soft"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="alert-error mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handlePromoteStudents} className="space-y-4">
                <div>
                  <label className="label block mb-1">
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
                    className="input"
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
                <label className="label block mb-1">
                Target Level *
                </label>
                <div className={`rounded-md p-3 border ${
                targetLevel === "completed" 
                    ? "bg-brand-soft border-line-strong" 
                    : "bg-brand-soft border-line"
                }`}>
                {targetLevel === "completed" ? (
                    <div>
                    <p className="text-sm font-medium text-ink-soft">🎓 Graduation</p>
                    <p className="text-xs text-ink-muted mt-1">
                        These students have completed JHS 3 and will be marked as graduated.
                        They will no longer be assigned to any class.
                    </p>
                    </div>
                ) : targetLevel ? (
                    <div>
                    <p className="text-sm text-ink-soft">Next Level: <strong>{targetLevel}</strong></p>
                    <p className="text-xs text-ink-faint mt-1">
                        Students will be moved to: {targetLevel}
                        {classes.find(c => c.name === targetLevel) 
                        ? " (existing class)" 
                        : " (new class will be created)"}
                    </p>
                    </div>
                ) : (
                    <p className="text-sm text-ink-muted">No promotion available</p>
                )}
                </div>
            </div>
            )}

                {selectedClassId && targetLevel && (
                  <div className="notice space-y-1">
                    <p className="font-semibold"> Batch Execution Details:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-ink-soft">
                      <li>Reassigns all active students to target level</li>
                      <li>Appends current placement details into student audit history</li>
                      <li>Generates target class if non-existent</li>
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-line">
                  <button
                    type="button"
                    onClick={() => { setShowPromoteModal(false); setFormError(""); }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !targetLevel}
                    className="btn btn-primary flex-1"
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