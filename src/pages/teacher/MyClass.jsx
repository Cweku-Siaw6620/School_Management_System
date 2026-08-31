import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, doc, getDoc,
  query, where, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import TeacherLayout from "../../components/TeacherLayout";

// GES Grading Scale
const getGradeColor = (grade) => {
  const colors = {
    "A1": "text-emerald-700 bg-emerald-50 border-emerald-200",
    "B2": "text-emerald-600 bg-emerald-50/80 border-emerald-200",
    "B3": "text-sky-700 bg-sky-50 border-sky-200",
    "C4": "text-blue-700 bg-blue-50 border-blue-200",
    "C5": "text-indigo-700 bg-indigo-50 border-indigo-200",
    "C6": "text-amber-700 bg-amber-50 border-amber-200",
    "D7": "text-orange-700 bg-orange-50 border-orange-200",
    "E8": "text-rose-600 bg-rose-50 border-rose-200",
    "F9": "text-rose-700 bg-rose-100 border-rose-300"
  };
  return colors[grade] || "text-slate-700 bg-slate-50 border-slate-200";
};

const SCORE_STATUS = {
  DRAFT: "draft",
  SUBMITTED_TO_CLASS_TEACHER: "submitted_to_class_teacher",
  SUBMITTED_TO_HEADMASTER: "submitted_to_headmaster",
  APPROVED: "approved"
};

const getStatusBadge = (status) => {
  const statusMap = {
    [SCORE_STATUS.DRAFT]: { label: 'Draft', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    [SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER]: { label: 'Final Submission', color: 'bg-green-50 text-green-700 border-green-200' },
    [SCORE_STATUS.SUBMITTED_TO_HEADMASTER]: { label: 'Submitted to Headmaster', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    [SCORE_STATUS.APPROVED]: { label: 'Approved by Headmaster', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  };
  return statusMap[status] || statusMap[SCORE_STATUS.DRAFT];
};

export default function MyClass() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [classData, setClassData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [term, setTerm] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState({});
  const [selectedSubjectForScores, setSelectedSubjectForScores] = useState(null);
  
  // UI states
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchMyClassData();
  }, [currentUser]);

  async function fetchMyClassData() {
    if (!currentUser) return;
    
    setLoading(true);
    setFormError("");
    
    try {
      // Find teacher in staff collection
      const staffQuery = query(
        collection(db, "staff"),
        where("email", "==", currentUser.email)
      );
      const staffSnapshot = await getDocs(staffQuery);
      
      if (staffSnapshot.empty) {
        setFormError("Teacher record not found.");
        setLoading(false);
        return;
      }
      
      const teacherId = staffSnapshot.docs[0].id;

      // Get current term
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      
      if (termsSnapshot.empty) {
        setFormError("No active term found.");
        setLoading(false);
        return;
      }
      
      const currentTerm = { id: termsSnapshot.docs[0].id, ...termsSnapshot.docs[0].data() };
      setTerm(currentTerm);

      // Check if teacher is a class teacher
      const classAssignmentQuery = query(
        collection(db, "classAssignments"),
        where("termId", "==", currentTerm.id),
        where("teacherId", "==", teacherId)
      );
      const classAssignments = await getDocs(classAssignmentQuery);
      
      if (classAssignments.empty) {
        setFormError("You are not assigned as a class teacher for this term.");
        setLoading(false);
        return;
      }

      // Get class data
      const assignment = classAssignments.docs[0].data();
      const classId = assignment.classId;
      
      const classDoc = await getDoc(doc(db, "classes", classId));
      if (!classDoc.exists()) {
        setFormError("Assigned class could not be found.");
        setLoading(false);
        return;
      }
      
      setClassData({ id: classDoc.id, ...classDoc.data() });

      // Fetch active students in class
      const studentsQuery = query(
        collection(db, "students"),
        where("classId", "==", classId),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentList = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentList);

      // Fetch subjects for class
      const subjectsQuery = query(
        collection(db, "classSubjects"),
        where("classId", "==", classId)
      );
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectList = subjectsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubjects(subjectList);

      // Fetch scores and status for all subjects
      await fetchAllScores(classId, currentTerm.id);
      await checkAllSubmissionStatus(classId, currentTerm.id, subjectList);

    } catch (error) {
      console.error("Error fetching class data:", error);
      setFormError("Failed to load class data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllScores(classId, termId) {
    try {
      const scoresQuery = query(
        collection(db, "scores"),
        where("classId", "==", classId),
        where("termId", "==", termId)
      );
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const scoresMap = {};
      scoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!scoresMap[data.subjectId]) {
          scoresMap[data.subjectId] = {};
        }
        scoresMap[data.subjectId][data.studentId] = {
          id: doc.id,
          classScore: data.classScore || 0,
          examScore: data.examScore || 0,
          total: data.total || 0,
          grade: data.grade || "",
          status: data.status || SCORE_STATUS.DRAFT,
          ...data
        };
      });
      
      setScores(scoresMap);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  }

  async function checkAllSubmissionStatus(classId, termId, subjectList = subjects) {
    try {
      const scoresQuery = query(
        collection(db, "scores"),
        where("classId", "==", classId),
        where("termId", "==", termId)
      );
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const subjectScoreStatus = {};
      
      scoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!subjectScoreStatus[data.subjectId]) {
          subjectScoreStatus[data.subjectId] = {
            total: 0,
            submitted: 0,
            status: SCORE_STATUS.DRAFT
          };
        }
        
        subjectScoreStatus[data.subjectId].total++;
        if (data.status === SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER || 
            data.status === SCORE_STATUS.SUBMITTED_TO_HEADMASTER || 
            data.status === SCORE_STATUS.APPROVED) {
          subjectScoreStatus[data.subjectId].submitted++;
        }
        
        const currentStatus = subjectScoreStatus[data.subjectId].status;
        if (data.status === SCORE_STATUS.APPROVED) {
          subjectScoreStatus[data.subjectId].status = SCORE_STATUS.APPROVED;
        } else if (data.status === SCORE_STATUS.SUBMITTED_TO_HEADMASTER && currentStatus !== SCORE_STATUS.APPROVED) {
          subjectScoreStatus[data.subjectId].status = SCORE_STATUS.SUBMITTED_TO_HEADMASTER;
        } else if (data.status === SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER && 
                   currentStatus !== SCORE_STATUS.APPROVED && 
                   currentStatus !== SCORE_STATUS.SUBMITTED_TO_HEADMASTER) {
          subjectScoreStatus[data.subjectId].status = SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER;
        }
      });
      
      const statusMap = {};
      subjectList.forEach(subject => {
        const status = subjectScoreStatus[subject.id];
        if (status) {
          statusMap[subject.id] = {
            ...status,
            allSubmitted: status.total === status.submitted && status.total > 0
          };
        } else {
          statusMap[subject.id] = {
            total: 0,
            submitted: 0,
            allSubmitted: false,
            status: SCORE_STATUS.DRAFT
          };
        }
      });
      
      setSubmissionStatus(statusMap);
    } catch (error) {
      console.error("Error checking submission status:", error);
    }
  }

  function getScoresForSubject(subjectId) {
    return scores[subjectId] || {};
  }

  function getStudentScore(studentId, subjectId) {
    const subjectScores = getScoresForSubject(subjectId);
    return subjectScores[studentId] || null;
  }

  async function handleSubmitToHeadmaster() {
    setFormError("");
    setSuccessMessage("");
    setSubmitting(true);

    const allSubmitted = subjects.every(subject => {
      const status = submissionStatus[subject.id];
      return status && status.allSubmitted;
    });

    if (!allSubmitted) {
      const notSubmitted = subjects.filter(subject => {
        const status = submissionStatus[subject.id];
        return !status || !status.allSubmitted;
      });
      
      setFormError(`Cannot submit to Headmaster. ${notSubmitted.length} subject(s) have unsubmitted scores.`);
      setSubmitting(false);
      return;
    }

    if (!confirm(`Submit all scores for ${classData?.name} to the Headmaster?\n\nThis action will finalize scores for this class.`)) {
      setSubmitting(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      for (const subject of subjects) {
        const subjectScores = getScoresForSubject(subject.id);
        
        for (const studentId in subjectScores) {
          const score = subjectScores[studentId];
          if (score.status === SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER) {
            const scoreId = `${studentId}_${subject.id}_${term.id}`;
            const scoreRef = doc(db, "scores", scoreId);
            batch.update(scoreRef, {
              status: SCORE_STATUS.SUBMITTED_TO_HEADMASTER,
              submittedToHeadmasterAt: new Date()
            });
            updatedCount++;
          }
        }
      }

      await batch.commit();
      setSuccessMessage(`Successfully submitted scores to Headmaster! (${updatedCount} records updated)`);
      
      await fetchAllScores(classData.id, term.id);
      await checkAllSubmissionStatus(classData.id, term.id);
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error submitting to headmaster:", error);
      setFormError("Failed to submit scores: " + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const readySubjectsCount = subjects.filter(s => submissionStatus[s.id]?.allSubmitted).length;
  const isAllReady = subjects.length > 0 && readySubjectsCount === subjects.length;

  if (loading) {
    return (
      <TeacherLayout>
        <div className="animate-pulse space-y-6 max-w-6xl mx-auto">
          <div className="h-24 bg-slate-100 rounded-xl"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-slate-100 rounded-xl"></div>
            <div className="h-96 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  if (formError && !classData) {
    return (
      <TeacherLayout>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto my-12 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 text-xl">
            ⚠️
          </div>
          <h3 className="font-semibold text-slate-900 text-base">Class Data Unavailable</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{formError}</p>
          <button
            onClick={() => navigate("/teacher/dashboard")}
            className="mt-6 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 max-w-6xl mx-auto text-slate-800">

        {/* Page Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {classData?.name}
              </h1>
              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                 Class Teacher
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Level: {classData?.level} • Term: {term?.name}
            </p>
          </div>

          {/* Key Metrics */}
          <div className="flex items-center gap-4 text-center border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-6">
            <div>
              <p className="text-xl font-bold text-slate-900">{students.length}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Students</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div>
              <p className="text-xl font-bold text-slate-900">{subjects.length}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Subjects</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div>
              <p className="text-xl font-bold text-emerald-600">{readySubjectsCount}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">Ready</p>
            </div>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
            <span>✅</span> {successMessage}
          </div>
        )}
        {formError && classData && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <span>⚠️</span> {formError}
          </div>
        )}

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Student Roster */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Class Roster ({students.length})
                </h2>
                <span className="text-xs text-slate-400">Active Enrollment</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">#</th>
                      <th className="px-4 py-3 text-left">Student Name</th>
                      <th className="px-4 py-3 text-center">Gender</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {student.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Subject Submission Status & Actions */}
          <div className="space-y-6">

            {/* Subject Readiness */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Subject Overview</h2>
                <span className="text-[11px] text-slate-400">Click to view scores</span>
              </div>

              {subjects.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No subjects registered for this class.</p>
              ) : (
                <div className="space-y-2.5">
                  {subjects.map((subject) => {
                    const status = submissionStatus[subject.id];
                    const statusBadge = getStatusBadge(status?.status);
                    const subjectScores = getScoresForSubject(subject.id);
                    const scoreCount = Object.keys(subjectScores).length;
                    const percent = students.length > 0 ? (scoreCount / students.length) * 100 : 0;

                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => setSelectedSubjectForScores(subject.id)}
                        className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:bg-slate-50/50 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium text-slate-900 text-xs group-hover:text-blue-600 transition-colors">
                              {subject.name}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {scoreCount} of {students.length} entries recorded
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        {/* Progress Indicator */}
                        <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              status?.allSubmitted ? 'bg-emerald-500' : 
                              scoreCount > 0 ? 'bg-blue-500' : 'bg-slate-300'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Final Submission Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">
                Headmaster Approval
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {readySubjectsCount} of {subjects.length} subjects ready to submit.
              </p>

              <button
                onClick={handleSubmitToHeadmaster}
                disabled={submitting || !isAllReady}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit All Scores to Headmaster"}
              </button>

              {!isAllReady && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5 mt-3 text-center">
                  ⚠️ All subject teachers must complete submission before final dispatch.
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Subject Score Breakdown Modal */}
        {selectedSubjectForScores && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 border border-slate-200 max-h-[85vh] flex flex-col">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {subjects.find(s => s.id === selectedSubjectForScores)?.name} — Score Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {classData?.name} • {term?.name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubjectForScores(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto my-4 flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-500 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-2.5 text-left">#</th>
                      <th className="px-4 py-2.5 text-left">Student</th>
                      <th className="px-4 py-2.5 text-center">Class Score</th>
                      <th className="px-4 py-2.5 text-center">Exam Score</th>
                      <th className="px-4 py-2.5 text-center">Total</th>
                      <th className="px-4 py-2.5 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student, idx) => {
                      const score = getStudentScore(student.id, selectedSubjectForScores);
                      const gradeColor = score?.grade ? getGradeColor(score.grade) : '';
                      
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {student.firstName} {student.lastName}
                          </td>
                          <td className="px-4 py-2.5 text-center text-slate-600">
                            {score?.classScore ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-slate-600">
                            {score?.examScore ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                            {score?.total ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {score?.grade ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${gradeColor}`}>
                                {score.grade}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setSelectedSubjectForScores(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </TeacherLayout>
  );
}