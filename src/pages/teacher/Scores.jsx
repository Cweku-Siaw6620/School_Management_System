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
        return { id: termsSnapshot.docs[0].id, ...termsSnapshot.docs[0].data() };
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
      
      setSelectedTermId(termList[0]?.id || "");
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
      setFormError("Could not submit scores. Please try again.");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <TeacherLayout>
        <div className="animate-pulse space-y-6 max-w-5xl mx-auto">
          <div className="h-16 bg-slate-100 rounded-lg"></div>
          <div className="h-64 bg-slate-100 rounded-lg"></div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 max-w-5xl mx-auto text-slate-800">

        {/* Page Header */}
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-normal text-slate-900">
              Student Grade Entry
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Record assessment and exam scores for your assigned classes.
            </p>
          </div>

          {/* Status Indicator */}
          {submissionStatus.isLocked && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Scores Submitted (Locked)
            </div>
          )}
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md">
            {successMessage}
          </div>
        )}
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
            {formError}
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
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
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 bg-white focus:border-slate-500 focus:outline-none"
            >
              {teacherAssignments.map((assignment) => (
                <option key={`${assignment.classId}_${assignment.subjectId}`} value={assignment.subjectId}>
                  {assignment.className} — {assignment.subjectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Academic Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-800 bg-white focus:border-slate-500 focus:outline-none"
            >
              {terms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.name} {term.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Table */}
        {students.length > 0 ? (
          <form onSubmit={handleSaveScores} className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-medium uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center w-36">Class Score (50)</th>
                    <th className="py-3 px-4 text-center w-36">Exam Score (50)</th>
                    <th className="py-3 px-4 text-center w-28">Total (100)</th>
                    <th className="py-3 px-4 text-center w-24">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.map((student, index) => {
                    const score = scores[student.id] || { classScore: "", examScore: "", total: 0, grade: "" };
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 text-center text-slate-400 text-xs">{index + 1}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">
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
                            className="w-20 border border-slate-300 rounded px-2 py-1 text-center text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
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
                            className="w-20 border border-slate-300 rounded px-2 py-1 text-center text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-800">
                          {score.total || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 border border-slate-200 bg-slate-50 rounded text-xs font-medium text-slate-700 min-w-[32px]">
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
                <span className="text-xs text-slate-400">
                  Scores are automatically totaled and graded upon entry.
                </span>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitToClassTeacher}
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Final Submit"}
                  </button>
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 text-xs">
            No students found for the selected class.
          </div>
        )}

      </div>
    </TeacherLayout>
  );
}