import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc, getDoc, getDocs, updateDoc, collection, query, where,
  writeBatch, setDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

export default function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();
  
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [previousTerm, setPreviousTerm] = useState(null);
  const [classAssignment, setClassAssignment] = useState(null);
  const [subjectAssignments, setSubjectAssignments] = useState({});
  const [attendanceSummary, setAttendanceSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
    termName: "",
    isWithinTerm: true
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Modals state
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showSubjectTeacherModal, setShowSubjectTeacherModal] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [todayDate, setTodayDate] = useState("");

  useEffect(() => {
    const today = new Date();
    setTodayDate(today.toISOString().split('T')[0]);
    fetchClassData();
  }, [classId]);

  async function fetchClassData() {
    setLoading(true);
    setFormError("");
    
    try {
      // Get class data
      const classDoc = await getDoc(doc(db, "classes", classId));
      if (!classDoc.exists()) {
        setFormError("Class record not found.");
        setLoading(false);
        return;
      }
      setClassData({ id: classDoc.id, ...classDoc.data() });

      // Get all terms
      const termsSnapshot = await getDocs(collection(db, "terms"));
      const termList = termsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTerms(termList);

      // Find current term
      const currentTerm = termList.find(t => t.isCurrent);
      setSelectedTerm(currentTerm || null);

      // Find previous term (for copy option)
      if (currentTerm) {
        const currentIndex = termList.findIndex(t => t.id === currentTerm.id);
        if (currentIndex > 0) {
          setPreviousTerm(termList[currentIndex - 1]);
        }
      }

      // Get staff
      const staffSnapshot = await getDocs(collection(db, "staff"));
      setStaff(
        staffSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.status === "active")
      );

      // Get students in this class
      const studentsQuery = query(
        collection(db, "students"),
        where("classId", "==", classId),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      setStudents(studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      // Get subjects for this class
      const subjectsQuery = query(
        collection(db, "classSubjects"),
        where("classId", "==", classId)
      );
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectList = subjectsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubjects(subjectList);

      // Get term-specific assignments
      if (currentTerm) {
        await fetchTermAssignments(currentTerm.id, subjectList);
      }

      // Fetch attendance summary (with term context)
      await fetchAttendanceSummary(classId, currentTerm);

      // Get available students (not assigned to any class)
      const availableQuery = query(
        collection(db, "students"),
        where("classId", "==", null),
        where("status", "==", "active")
      );
      const availableSnapshot = await getDocs(availableQuery);
      setAvailableStudents(availableSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) {
      console.error("Error fetching class data:", error);
      setFormError("Failed to load class details.");
    }
    setLoading(false);
  }

  async function fetchTermAssignments(termId, subjectList) {
    try {
      // Get class teacher assignment for this term
      const classAssignmentQuery = query(
        collection(db, "classAssignments"),
        where("termId", "==", termId),
        where("classId", "==", classId)
      );
      const classAssignmentsSnap = await getDocs(classAssignmentQuery);
      
      if (!classAssignmentsSnap.empty) {
        setClassAssignment({ id: classAssignmentsSnap.docs[0].id, ...classAssignmentsSnap.docs[0].data() });
      } else {
        setClassAssignment(null);
      }

      // Get subject teacher assignments for this term
      const subjectAssignmentsMap = {};
      for (const subject of subjectList) {
        const subAssignmentQuery = query(
          collection(db, "subjectAssignments"),
          where("termId", "==", termId),
          where("classId", "==", classId),
          where("subjectId", "==", subject.id)
        );
        const subAssignmentsSnap = await getDocs(subAssignmentQuery);
        
        if (!subAssignmentsSnap.empty) {
          subjectAssignmentsMap[subject.id] = { id: subAssignmentsSnap.docs[0].id, ...subAssignmentsSnap.docs[0].data() };
        }
      }
      setSubjectAssignments(subjectAssignmentsMap);

    } catch (error) {
      console.error("Error fetching term assignments:", error);
    }
  }

  async function fetchAttendanceSummary(classId, currentTerm) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if we have a current term
      let termName = "No active term";
      let isWithinTerm = false;
      
      if (currentTerm) {
        termName = currentTerm.name || "Active Term";
        
        // Check if today is within term dates
        const termStart = new Date(currentTerm.startDate);
        const termEnd = new Date(currentTerm.endDate);
        const todayDate = new Date(today);
        
        todayDate.setHours(0, 0, 0, 0);
        termStart.setHours(0, 0, 0, 0);
        termEnd.setHours(0, 0, 0, 0);
        
        isWithinTerm = todayDate >= termStart && todayDate <= termEnd;
      }
      
      // Always fetch attendance regardless of term validation
      // (show what's available, but add context)
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("classId", "==", classId),
        where("date", "==", today)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const records = attendanceSnapshot.docs.map(d => d.data());
      
      setAttendanceSummary({
        present: records.filter(r => r.status === "present").length,
        absent: records.filter(r => r.status === "absent").length,
        late: records.filter(r => r.status === "late").length,
        excused: records.filter(r => r.status === "excused").length,
        total: records.length,
        termName: termName,
        isWithinTerm: isWithinTerm
      });
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      setAttendanceSummary({
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        termName: "Error",
        isWithinTerm: false
      });
    }
  }

  async function handleAssignTeacher(e) {
    e.preventDefault();
    setFormError("");
    setActionLoading(true);

    try {
      if (!selectedTerm) {
        setFormError("No active term found.");
        setActionLoading(false);
        return;
      }

      const assignmentId = `${selectedTerm.id}_${classId}`;
      const assignmentRef = doc(db, "classAssignments", assignmentId);
      
      await setDoc(assignmentRef, {
        termId: selectedTerm.id,
        classId: classId,
        className: classData.name,
        teacherId: selectedTeacherId,
        teacherName: getTeacherName(selectedTeacherId),
        createdAt: new Date()
      }, { merge: true });
      
      // Also update the class convenience field
      await updateDoc(doc(db, "classes", classId), {
        teacherId: selectedTeacherId
      });
      
      setShowTeacherModal(false);
      setSelectedTeacherId("");
      triggerSuccess("Class teacher assigned for this term.");
      await fetchClassData();
    } catch (error) {
      console.error("Error assigning teacher:", error);
      setFormError("Failed to assign class teacher.");
    }
    setActionLoading(false);
  }

  async function handleRemoveTeacher() {
    if (!confirm("Remove the class teacher assignment for this term?")) return;
    setActionLoading(true);
    
    try {
      if (!selectedTerm) {
        setFormError("No active term found.");
        setActionLoading(false);
        return;
      }

      const assignmentId = `${selectedTerm.id}_${classId}`;
      await deleteDoc(doc(db, "classAssignments", assignmentId));
      
      // Clear the class convenience field if it matches this term
      if (classData.teacherId === classAssignment?.teacherId) {
        await updateDoc(doc(db, "classes", classId), { teacherId: null });
      }
      
      triggerSuccess("Class teacher removed for this term.");
      await fetchClassData();
    } catch (error) {
      console.error("Error removing teacher:", error);
      setFormError("Failed to remove teacher.");
    }
    setActionLoading(false);
  }

  async function handleAssignSubjectTeacher(e) {
    e.preventDefault();
    setActionLoading(true);
    
    try {
      if (!selectedTerm) {
        setFormError("No active term found.");
        setActionLoading(false);
        return;
      }

      const assignmentId = `${selectedTerm.id}_${classId}_${selectedSubjectId}`;
      const assignmentRef = doc(db, "subjectAssignments", assignmentId);
      
      const subject = subjects.find(s => s.id === selectedSubjectId);
      
      await setDoc(assignmentRef, {
        termId: selectedTerm.id,
        classId: classId,
        className: classData.name,
        subjectId: selectedSubjectId,
        subjectName: subject?.name || "",
        teacherId: selectedTeacherId,
        teacherName: getTeacherName(selectedTeacherId),
        createdAt: new Date()
      }, { merge: true });
      
      // Also update the subject convenience field
      await updateDoc(doc(db, "classSubjects", selectedSubjectId), {
        teacherId: selectedTeacherId
      });
      
      setShowSubjectTeacherModal(false);
      setSelectedSubjectId(null);
      setSelectedTeacherId("");
      triggerSuccess("Subject teacher assigned for this term.");
      await fetchClassData();
    } catch (error) {
      console.error("Error assigning subject teacher:", error);
      setFormError("Failed to assign subject teacher.");
    }
    setActionLoading(false);
  }

  async function handleRemoveSubjectTeacher(subjectId) {
    if (!confirm("Remove the subject teacher assignment for this term?")) return;
    
    try {
      if (!selectedTerm) {
        setFormError("No active term found.");
        return;
      }

      const assignmentId = `${selectedTerm.id}_${classId}_${subjectId}`;
      await deleteDoc(doc(db, "subjectAssignments", assignmentId));
      
      // Clear the subject convenience field
      await updateDoc(doc(db, "classSubjects", subjectId), { teacherId: null });
      
      triggerSuccess("Subject teacher removed for this term.");
      await fetchClassData();
    } catch (error) {
      console.error("Error removing subject teacher:", error);
      setFormError("Failed to remove subject teacher.");
    }
  }

  async function handleCopyPreviousTerm() {
    if (!previousTerm || !selectedTerm) return;
    setActionLoading(true);
    setFormError("");

    try {
      // Copy class teacher
      const prevClassQuery = query(
        collection(db, "classAssignments"),
        where("termId", "==", previousTerm.id),
        where("classId", "==", classId)
      );
      const prevClassSnap = await getDocs(prevClassQuery);
      
      if (!prevClassSnap.empty) {
        const prevData = prevClassSnap.docs[0].data();
        const newId = `${selectedTerm.id}_${classId}`;
        await setDoc(doc(db, "classAssignments", newId), {
          termId: selectedTerm.id,
          classId: classId,
          className: classData.name,
          teacherId: prevData.teacherId,
          teacherName: prevData.teacherName,
          copiedFrom: previousTerm.id,
          createdAt: new Date()
        });
        
        // Update class convenience field
        await updateDoc(doc(db, "classes", classId), {
          teacherId: prevData.teacherId
        });
      }

      // Copy subject teachers
      for (const subject of subjects) {
        const prevSubQuery = query(
          collection(db, "subjectAssignments"),
          where("termId", "==", previousTerm.id),
          where("classId", "==", classId),
          where("subjectId", "==", subject.id)
        );
        const prevSubSnap = await getDocs(prevSubQuery);
        
        if (!prevSubSnap.empty) {
          const prevData = prevSubSnap.docs[0].data();
          const newId = `${selectedTerm.id}_${classId}_${subject.id}`;
          await setDoc(doc(db, "subjectAssignments", newId), {
            termId: selectedTerm.id,
            classId: classId,
            className: classData.name,
            subjectId: subject.id,
            subjectName: subject.name,
            teacherId: prevData.teacherId,
            teacherName: prevData.teacherName,
            copiedFrom: previousTerm.id,
            createdAt: new Date()
          });
          
          // Update subject convenience field
          await updateDoc(doc(db, "classSubjects", subject.id), {
            teacherId: prevData.teacherId
          });
        }
      }

      setShowCopyConfirm(false);
      triggerSuccess(`Copied all assignments from ${previousTerm.name} successfully!`);
      await fetchClassData();
    } catch (error) {
      console.error("Error copying previous term:", error);
      setFormError("Failed to copy previous term assignments.");
    }
    setActionLoading(false);
  }

  async function handleAddStudents(e) {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      setFormError("Please select at least one student.");
      return;
    }
    setActionLoading(true);

    try {
      const batch = writeBatch(db);
      for (const studentId of selectedStudentIds) {
        batch.update(doc(db, "students", studentId), { classId });
      }
      await batch.commit();
      
      setShowStudentModal(false);
      setSelectedStudentIds([]);
      triggerSuccess(`Added ${selectedStudentIds.length} student(s) to ${classData?.name}.`);
      await fetchClassData();
    } catch (error) {
      setFormError("Failed to assign students.");
    }
    setActionLoading(false);
  }

  async function handleRemoveStudent(studentId, studentName) {
    if (!confirm(`Remove ${studentName} from ${classData?.name}?`)) return;
    try {
      await updateDoc(doc(db, "students", studentId), { classId: null });
      triggerSuccess(`${studentName} removed from class.`);
      await fetchClassData();
    } catch (error) {
      setFormError("Failed to remove student.");
    }
  }

  function triggerSuccess(msg) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 3500);
  }

  const getTeacherName = (id) => {
    if (!id) return "Unassigned";
    const t = staff.find(s => s.id === id);
    return t ? `${t.firstName} ${t.lastName}` : "Unassigned";
  };

  const getClassTeacher = () => {
    if (classAssignment) {
      return getTeacherName(classAssignment.teacherId);
    }
    return getTeacherName(classData?.teacherId) || "Unassigned";
  };

  const getSubjectTeacher = (subjectId) => {
    const assignment = subjectAssignments[subjectId];
    if (assignment) {
      return getTeacherName(assignment.teacherId);
    }
    const subject = subjects.find(s => s.id === subjectId);
    return getTeacherName(subject?.teacherId) || "Unassigned";
  };

  const handleToggleStudent = (id) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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

  if (!classData) {
    return (
      <HeadmasterLayout>
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <h2 className="font-serif text-lg font-bold text-slate-800">Class Record Not Found</h2>
          <button
            onClick={() => navigate("/headmaster/classes")}
            className="mt-4 px-4 py-2 bg-sky-900 text-white text-xs font-medium rounded-md hover:bg-sky-950 transition-colors"
          >
            ← Return to Class Roster
          </button>
        </div>
      </HeadmasterLayout>
    );
  }

  const hasAssignments = classAssignment !== null || Object.keys(subjectAssignments).length > 0;

  return (
    <HeadmasterLayout>
      <div className="space-y-6">

        {/* Top Header & Breadcrumb */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/headmaster/classes")}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors"
            >
              ← Back
            </button>
            <div>
              <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
                {classData.name}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {classData.level} &bull; {selectedTerm?.name || "No active term"} &bull; {students.length} students
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              classData.status === "active"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${classData.status === "active" ? "bg-emerald-600" : "bg-amber-600"}`}></span>
              {classData.status === "active" ? "Active Class" : "Inactive"}
            </span>
            {hasAssignments ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-sky-50 text-sky-700 border-sky-200">
                 Assigned
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                 No Assignments
              </span>
            )}
          </div>
        </div>

        {/* Copy Previous Term Banner */}
        {previousTerm && !hasAssignments && selectedTerm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-sm font-medium text-amber-800">No assignments for {selectedTerm.name}</p>
                <p className="text-xs text-amber-600">Copy from {previousTerm.name} to avoid re-assigning all teachers.</p>
              </div>
            </div>
            <button
              onClick={() => setShowCopyConfirm(true)}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium rounded-md transition-colors"
            >
              Copy from Previous Term
            </button>
          </div>
        )}

        {/* Feedback Messages */}
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

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Overview / Staff Assignment */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Class Overview — {selectedTerm?.name || "No Term"}
                </h3>
                {!hasAssignments && previousTerm && (
                  <button
                    onClick={() => setShowCopyConfirm(true)}
                    className="text-xs text-amber-700 font-semibold hover:underline"
                  >
                    📋 Copy from Previous Term
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Form Teacher</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${classAssignment ? 'text-slate-800' : 'text-amber-600'}`}>
                      {getClassTeacher()}
                    </span>
                    <button
                      onClick={() => setShowTeacherModal(true)}
                      className="text-xs text-sky-800 font-semibold hover:underline"
                    >
                      {classAssignment ? "Reassign" : "Assign"}
                    </button>
                    {classAssignment && (
                      <button
                        onClick={handleRemoveTeacher}
                        className="text-xs text-rose-700 font-semibold hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Academic Level</span>
                  <span className="font-medium text-slate-800">{classData.level}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Enrollment</span>
                  <span className="font-medium text-slate-800">
                    {students.length} Students
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assignment Status</span>
                  <span className={`text-xs font-medium ${hasAssignments ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {hasAssignments ? ' Assigned for this term' : ' No teachers assigned yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subject Roster */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Assigned Subjects ({subjects.length})
                </h3>
                <div className="flex gap-3">
                  <span className="text-xs text-slate-400">
                    {Object.keys(subjectAssignments).length} assigned
                  </span>
                  <button
                    onClick={() => navigate("/headmaster/subjects")}
                    className="text-xs font-semibold text-sky-800 hover:underline"
                  >
                    Manage Curriculum →
                  </button>
                </div>
              </div>

              {subjects.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No subjects currently associated with this class.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {subjects.map((sub) => {
                    const isAssigned = !!subjectAssignments[sub.id];
                    return (
                      <div key={sub.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-serif text-sm font-semibold text-slate-900">{sub.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Taught by: <strong className={`${isAssigned ? 'text-slate-700' : 'text-amber-600'} font-normal`}>
                              {getSubjectTeacher(sub.id)}
                            </strong>
                            {!isAssigned && <span className="text-amber-500 ml-1">(Not assigned)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedSubjectId(sub.id);
                              setShowSubjectTeacherModal(true);
                            }}
                            className="text-xs text-sky-800 font-semibold hover:underline"
                          >
                            {isAssigned ? "Reassign" : "Assign"}
                          </button>
                          {isAssigned && (
                            <button
                              onClick={() => handleRemoveSubjectTeacher(sub.id)}
                              className="text-xs text-rose-700 font-semibold hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            
            {/* Daily Attendance Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Daily Attendance
                </h3>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-mono block">{todayDate}</span>
                  {attendanceSummary.termName && attendanceSummary.termName !== "Error" && (
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {attendanceSummary.termName}
                    </span>
                  )}
                </div>
              </div>

              {/* Info Banner — Shows term status without blocking */}
              {!attendanceSummary.isWithinTerm && attendanceSummary.termName !== "Error" && attendanceSummary.termName !== "No active term" && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 text-center">
                    📅 Today is outside the active term ({attendanceSummary.termName})
                  </p>
                  <p className="text-[10px] text-amber-600 text-center">
                    Attendance may not be available for this date
                  </p>
                </div>
              )}

              {attendanceSummary.termName === "No active term" && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500 text-center">
                     No active term. Please activate a term first.
                  </p>
                </div>
              )}

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
                  {attendanceSummary.total} of {students.length} students logged today
                  {!attendanceSummary.isWithinTerm && attendanceSummary.termName !== "No active term" && (
                    <span className="text-amber-500 block text-[10px]">(Outside active term)</span>
                  )}
                </p>
                <button
                  onClick={() => navigate("/headmaster/attendance")}
                  className="w-full py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md transition-colors"
                >
                  View Attendance Register
                </button>
              </div>
            </div>

            {/* Enrolled Students Roster */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Students ({students.length})
                </h3>
                <button
                  onClick={() => setShowStudentModal(true)}
                  className="text-xs font-semibold text-sky-800 hover:underline disabled:opacity-50"
                  disabled={availableStudents.length === 0}
                >
                  + Add
                </button>
              </div>

              {students.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No students currently enrolled.</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {students.map((student) => (
                    <div key={student.id} className="py-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 font-serif">
                        {student.firstName} {student.lastName}
                      </span>
                      <button
                        onClick={() => handleRemoveStudent(student.id, `${student.firstName} ${student.lastName}`)}
                        className="text-xs text-rose-700 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal: Class Teacher Assignment */}
        {showTeacherModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">Assign Class Teacher</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedTerm?.name} • {classData.name}</p>
                </div>
                <button
                  onClick={() => { setShowTeacherModal(false); setFormError(""); }}
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

              <form onSubmit={handleAssignTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Select Teacher
                  </label>
                  <select
                    required
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-800"
                  >
                    <option value="">Select an active staff member...</option>
                    {staff.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.position || "Teacher"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5">
                  <p className="text-xs text-amber-700">
                     Assignment is for <strong>{selectedTerm?.name}</strong>. It will NOT affect previous terms.
                  </p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowTeacherModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-xs font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-sky-900 text-white py-2 rounded-md text-xs font-medium hover:bg-sky-950 disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Assign for This Term"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Enroll Unassigned Students */}
        {showStudentModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
                <h3 className="font-serif text-lg font-bold text-slate-900">Enroll Unassigned Students</h3>
                <button
                  onClick={() => { setShowStudentModal(false); setFormError(""); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3.5 py-2.5 rounded-md mb-4 shrink-0">
                  {formError}
                </div>
              )}

              {availableStudents.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No unassigned students available.</p>
              ) : (
                <form onSubmit={handleAddStudents} className="space-y-4 flex-1 flex flex-col min-h-0">
                  <p className="text-xs text-slate-500 shrink-0">
                    Select students to assign to <strong>{classData.name}</strong>:
                  </p>
                  
                  <div className="space-y-1 overflow-y-auto border border-slate-200 rounded-md p-2 flex-1">
                    {availableStudents.map((st) => (
                      <label
                        key={st.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors text-xs font-medium text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(st.id)}
                          onChange={() => handleToggleStudent(st.id)}
                          className="w-4 h-4 text-sky-900 rounded border-slate-300 focus:ring-sky-800"
                        />
                        {st.firstName} {st.lastName}
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setShowStudentModal(false); setFormError(""); }}
                      className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-xs font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || selectedStudentIds.length === 0}
                      className="flex-1 bg-sky-900 text-white py-2 rounded-md text-xs font-medium hover:bg-sky-950 disabled:opacity-50"
                    >
                      {actionLoading ? "Enrolling..." : `Enroll ${selectedStudentIds.length} Selected`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal: Subject Teacher Assignment */}
        {showSubjectTeacherModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">Assign Subject Teacher</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {subjects.find(s => s.id === selectedSubjectId)?.name} • {selectedTerm?.name}
                  </p>
                </div>
                <button
                  onClick={() => { setShowSubjectTeacherModal(false); setFormError(""); }}
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

              <form onSubmit={handleAssignSubjectTeacher} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Teacher for {subjects.find(s => s.id === selectedSubjectId)?.name}
                  </label>
                  
                  {(() => {
                    const qualifiedTeachers = staff.filter(t => 
                      t.subjects && t.subjects.includes(
                        subjects.find(s => s.id === selectedSubjectId)?.name
                      )
                    );
                    
                    return (
                      <>
                        <select
                          required
                          value={selectedTeacherId}
                          onChange={(e) => setSelectedTeacherId(e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-sky-800"
                          disabled={qualifiedTeachers.length === 0}
                        >
                          <option value="">Select a teacher...</option>
                          {qualifiedTeachers.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.firstName} {t.lastName} ({t.position || "Teacher"})
                            </option>
                          ))}
                        </select>
                        
                        {qualifiedTeachers.length === 0 && (
                          <p className="text-xs text-amber-600 mt-2">
                             No teachers are qualified to teach this subject.
                            Go to Staff Management to assign subjects to teachers.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5">
                  <p className="text-xs text-amber-700">
                     Assignment is for <strong>{selectedTerm?.name}</strong>. It will NOT affect previous terms.
                  </p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowSubjectTeacherModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-xs font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-sky-900 text-white py-2 rounded-md text-xs font-medium hover:bg-sky-950 disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Assign for This Term"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Copy Previous Term Confirmation */}
        {showCopyConfirm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h3 className="font-serif text-lg font-bold text-slate-900">Copy from Previous Term</h3>
                <button
                  onClick={() => setShowCopyConfirm(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm text-amber-800 font-medium">Copy all teacher assignments from:</p>
                  <p className="text-xs text-amber-700 mt-1">
                    <strong>{previousTerm?.name}</strong> → <strong>{selectedTerm?.name}</strong>
                  </p>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>This will copy:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Class Teacher assignment</li>
                    <li>Subject Teacher assignments for all subjects</li>
                  </ul>
                  <p className="mt-2 text-amber-600"> Previous term assignments will remain unchanged.</p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCopyConfirm(false)}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-xs font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPreviousTerm}
                    disabled={actionLoading}
                    className="flex-1 bg-amber-700 hover:bg-amber-800 text-white py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Copying..." : "Copy Assignments"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </HeadmasterLayout>
  );
}