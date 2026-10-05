import { useState, useEffect } from "react";
import {
  collection, getDocs, doc,
  query, where, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import TeacherLayout from "../../components/TeacherLayout";

// Standard Grading Calculation
const getGrade = (score) => {
  if (score >= 80) return "A1";
  if (score >= 70) return "B2";
  if (score >= 60) return "B3";
  if (score >= 50) return "C4";
  if (score >= 45) return "C5";
  if (score >= 40) return "C6";
  if (score >= 35) return "D7";
  if (score >= 30) return "E8";
  return "F9";
};

const SCORE_STATUS = {
  DRAFT: "draft",
  SUBMITTED_TO_CLASS_TEACHER: "submitted_to_class_teacher",
  SUBMITTED_TO_HEADMASTER: "submitted_to_headmaster",
  APPROVED: "approved"
};

export default function Scores() {
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [scores, setScores] = useState({});
  const [teacherId, setTeacherId] = useState("");
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState({});
  const [currentTermName, setCurrentTermName] = useState("");

  useEffect(() => {
    fetchTeacherData();
  }, [currentUser]);

  useEffect(() => {
    if (selectedSubjectId && selectedTermId) {
      fetchScores();
      checkSubmissionStatus();
    }
  }, [selectedSubjectId, selectedTermId]);

  async function fetchTeacherData() {
    if (!currentUser) return;
    try {
      const staffQuery = query(
        collection(db, "staff"),
        where("email", "==", currentUser.email)
      );
      const staffSnapshot = await getDocs(staffQuery);
      
      if (!staffSnapshot.empty) {
        const teacherIdFromDb = staffSnapshot.docs[0].id;
        setTeacherId(teacherIdFromDb);
        await fetchTeacherAssignments(teacherIdFromDb);
      }
      await fetchTerms();
    } catch (error) {
      console.error("Error fetching teacher data:", error);
      setFormError("Could not load your teaching assignment data.");
      setLoading(false);
    }
  }

  async function fetchTeacherAssignments(teacherId) {
    try {
      const currentTerm = await getCurrentTerm();
      if (!currentTerm) {
        setFormError("No active term found. Please contact the headmaster.");
        setLoading(false);
        return;
      }

      const uniqueAssignments = new Map();
      const subjectAssignmentQuery = query(
        collection(db, "subjectAssignments"),
        where("termId", "==", currentTerm.id),
        where("teacherId", "==", teacherId)
      );
      const subjectAssignments = await getDocs(subjectAssignmentQuery);
      
      subjectAssignments.forEach(doc => {
        const data = doc.data();
        const key = `${data.classId}_${data.subjectId}`;
        if (!uniqueAssignments.has(key)) {
          uniqueAssignments.set(key, {
            classId: data.classId,
            subjectId: data.subjectId,
            subjectName: data.subjectName || "Unknown Subject",
            className: data.className || "Unknown Class"
          });
        }
      });

      const allAssignments = Array.from(uniqueAssignments.values());
      setTeacherAssignments(allAssignments);

      if (allAssignments.length > 0) {
        const first = allAssignments[0];
        setSelectedSubjectId(first.subjectId);
        await fetchStudents(first.classId);
      } else {
        setFormError("You have not been assigned to teach any subjects this term.");
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setFormError("Could not load assigned subjects.");
      setLoading(false);
    }
  }

  async function getCurrentTerm() {
    try {
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      if (!termsSnapshot.empty) {
        const term = { id: termsSnapshot.docs[0].id, ...termsSnapshot.docs[0].data() };
        setCurrentTermName(term.name || "Current Term");
        return term;
      }
      return null;
    } catch (error) {
      console.error("Error fetching term:", error);
      return null;
    }
  }

  async function fetchTerms() {
    try {
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      const termList = termsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTerms(termList);
      
      if (termList.length > 0) {
        setSelectedTermId(termList[0].id);
      }
    } catch (error) {
      console.error("Error fetching terms:", error);
    }
  }

  async function fetchStudents(classId) {
    try {
      const studentsQuery = query(
        collection(db, "students"),
        where("classId", "==", classId),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentList = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentList);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  }

  async function fetchScores() {
    if (!selectedSubjectId || !selectedTermId) return;
    try {
      const scoresQuery = query(
        collection(db, "scores"),
        where("subjectId", "==", selectedSubjectId),
        where("termId", "==", selectedTermId)
      );
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const scoresMap = {};
      scoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        scoresMap[data.studentId] = {
          id: doc.id,
          classScore: data.classScore || 0,
          examScore: data.examScore || 0,
          total: data.total || 0,
          grade: data.grade || "",
          status: data.status || SCORE_STATUS.DRAFT
        };
      });
      setScores(scoresMap);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  }

  async function checkSubmissionStatus() {
    if (!selectedSubjectId || !selectedTermId) return;
    try {
      const scoresQuery = query(
        collection(db, "scores"),
        where("subjectId", "==", selectedSubjectId),
        where("termId", "==", selectedTermId)
      );
      const scoresSnapshot = await getDocs(scoresQuery);
      
      let status = SCORE_STATUS.DRAFT;
      scoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status !== SCORE_STATUS.DRAFT) {
          status = data.status;
        }
      });
      
      setSubmissionStatus({
        status,
        isLocked: status !== SCORE_STATUS.DRAFT
      });
    } catch (error) {
      console.error("Error checking status:", error);
    }
  }

  function handleScoreChange(studentId, field, value) {
    if (submissionStatus.isLocked) return;
    const numValue = parseFloat(value) || 0;
    
    setScores(prev => {
      const existing = prev[studentId] || { classScore: 0, examScore: 0 };
      const updated = {
        ...existing,
        [field]: Math.min(Math.max(numValue, 0), 50)
      };
      
      const total = (updated.classScore || 0) + (updated.examScore || 0);
      updated.total = total;
      updated.grade = getGrade(total);
      
      return { ...prev, [studentId]: updated };
    });
  }

  async function handleSaveScores(e) {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    try {
      const batch = writeBatch(db);
      const assignment = teacherAssignments.find(a => a.subjectId === selectedSubjectId);

      for (const student of students) {
        const score = scores[student.id];
        if (!score) continue;
        
        const scoreId = `${student.id}_${selectedSubjectId}_${selectedTermId}`;
        const scoreRef = doc(db, "scores", scoreId);
        
        const scoreData = {
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          subjectId: selectedSubjectId,
          subjectName: assignment?.subjectName || "",
          classId: assignment?.classId || "",
          className: assignment?.className || "",
          termId: selectedTermId,
          termName: currentTermName,
          classScore: score.classScore || 0,
          examScore: score.examScore || 0,
          total: score.total || 0,
          grade: score.grade || "",
          markedBy: currentUser?.email || "",
          markedByTeacherId: teacherId,
          status: SCORE_STATUS.DRAFT,
          updatedAt: new Date()
        };
        
        batch.set(scoreRef, scoreData, { merge: true });
      }

      await batch.commit();
      setSuccessMessage("Draft scores saved successfully.");
      await fetchScores();
      await checkSubmissionStatus();
    } catch (error) {
      console.error("Error saving scores:", error);
      setFormError("Could not save scores. Please try again.");
    }
    setSaving(false);
  }

  async function handleSubmitToClassTeacher() {
    setFormError("");
    setSubmitting(true);

    // Check if all students have scores
    const hasAllScores = students.every(student => {
      const score = scores[student.id];
      return score && (score.classScore > 0 || score.examScore > 0);
    });

    if (!hasAllScores) {
      setFormError("Please enter scores for all students before submitting.");
      setSubmitting(false);
      return;
    }

    if (!confirm("Submit these scores? You will not be able to edit them after submitting.")) {
      setSubmitting(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const student of students) {
        const scoreId = `${student.id}_${selectedSubjectId}_${selectedTermId}`;
        const scoreRef = doc(db, "scores", scoreId);
        batch.update(scoreRef, {
          status: SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER,
          submittedAt: new Date()
        });
      }

      await batch.commit();
      setSuccessMessage("Scores submitted successfully.");
      await fetchScores();
      await checkSubmissionStatus();
    } catch (error) {
      console.error("Error submitting scores:", error);
      setFormError("Could not submit scores. Save as Draft first.");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <TeacherLayout>
        <div className="animate-pulse space-y-6 max-w-5xl mx-auto">
          <div className="h-16 bg-brand-soft rounded-xl"></div>
          <div className="h-64 bg-brand-soft rounded-xl"></div>
        </div>
      </TeacherLayout>
    );
  }

  // No assignments or no active term
  if (teacherAssignments.length === 0 || !selectedTermId) {
    return (
      <TeacherLayout>
        <div className="card p-12 text-center max-w-lg mx-auto my-12">
          <div className="w-12 h-12 rounded-full bg-brand-soft text-ink-muted flex items-center justify-center mx-auto mb-4 text-xl">
            📝
          </div>
          <h3 className="font-semibold text-ink text-base">
            {!selectedTermId ? "No Active Term" : "No Assigned Subjects"}
          </h3>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            {!selectedTermId 
              ? "Please contact the headmaster to activate a term." 
              : "You haven't been assigned to teach any subjects this term."}
          </p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 max-w-5xl mx-auto text-ink">

        {/* Page Header */}
        <div className="border-b border-line pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              Student Grade Entry
            </h1>
            <p className="text-xs text-ink-muted mt-1 flex items-center gap-2">
              Record assessment and exam scores for your assigned classes.
              {currentTermName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success-soft text-success-ink text-[10px] font-medium border border-success-line">
                  {currentTermName}
                </span>
              )}
            </p>
          </div>

          {/* Status Indicator */}
          {submissionStatus.isLocked && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-soft border border-line text-xs font-medium text-ink-soft">
              <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Scores Submitted (Locked)
            </div>
          )}
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-3 bg-success-soft border border-success-line text-success-ink text-xs rounded-lg">
            {successMessage}
          </div>
        )}
        {formError && (
          <div className="alert-error">
            {formError}
          </div>
        )}

        {/* Control Panel */}
        <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1">
              Select Class & Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                const subjectId = e.target.value;
                setSelectedSubjectId(subjectId);
                const assignment = teacherAssignments.find(a => a.subjectId === subjectId);
                if (assignment) fetchStudents(assignment.classId);
              }}
              className="input"
            >
              {teacherAssignments.map((assignment) => (
                <option key={`${assignment.classId}_${assignment.subjectId}`} value={assignment.subjectId}>
                  {assignment.className} — {assignment.subjectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label block mb-1">
              Academic Term
            </label>
            <div className="input bg-brand-soft">
              {currentTermName || "No active term"}
            </div>
          </div>
        </div>

        {/* Main Table */}
        {students.length > 0 ? (
          <form onSubmit={handleSaveScores} className="space-y-4">
            <div className="card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-soft border-b border-line text-ink-muted text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center w-36">Class Score (50)</th>
                    <th className="py-3 px-4 text-center w-36">Exam Score (50)</th>
                    <th className="py-3 px-4 text-center w-28">Total (100)</th>
                    <th className="py-3 px-4 text-center w-24">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map((student, index) => {
                    const score = scores[student.id] || { classScore: "", examScore: "", total: 0, grade: "" };
                    return (
                      <tr key={student.id} className="hover:bg-brand-soft">
                        <td className="py-3 px-4 text-center text-ink-faint text-xs">{index + 1}</td>
                        <td className="py-3 px-4 font-medium text-ink">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            placeholder="0"
                            value={score.classScore}
                            onChange={(e) => handleScoreChange(student.id, 'classScore', e.target.value)}
                            disabled={submissionStatus.isLocked}
                            className="input w-20 px-2 py-1 text-center disabled:bg-brand-soft disabled:text-ink-faint"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            placeholder="0"
                            value={score.examScore}
                            onChange={(e) => handleScoreChange(student.id, 'examScore', e.target.value)}
                            disabled={submissionStatus.isLocked}
                            className="input w-20 px-2 py-1 text-center disabled:bg-brand-soft disabled:text-ink-faint"
                          />
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-ink">
                          {score.total || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 border border-line bg-brand-soft rounded text-xs font-medium text-ink-soft min-w-[32px]">
                            {score.grade || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            {!submissionStatus.isLocked && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-ink-faint">
                  Scores are automatically totaled and graded upon entry.
                </span>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-secondary"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitToClassTeacher}
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    {submitting ? "Submitting..." : "Final Submit"}
                  </button>
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="card p-12 text-center text-ink-muted text-xs">
            No students found for the selected class.
          </div>
        )}

      </div>
    </TeacherLayout>
  );
}