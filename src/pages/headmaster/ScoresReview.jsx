import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, doc, updateDoc, getDoc,
  query, where, writeBatch
} from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

const SCORE_STATUS = {
  DRAFT: "draft",
  SUBMITTED_TO_CLASS_TEACHER: "submitted_to_class_teacher",
  SUBMITTED_TO_HEADMASTER: "submitted_to_headmaster",
  APPROVED: "approved"
};

const getStatusBadge = (status) => {
  const statusMap = {
    [SCORE_STATUS.DRAFT]: { label: 'Draft', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    [SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER]: { label: 'Submitted by Subject Teachers', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    [SCORE_STATUS.SUBMITTED_TO_HEADMASTER]: { label: 'Submitted by Class Teacher', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    [SCORE_STATUS.APPROVED]: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  };
  return statusMap[status] || statusMap[SCORE_STATUS.DRAFT];
};

const getGradeColor = (grade) => {
  const colors = {
    "A1": "text-emerald-700 bg-emerald-50 border-emerald-200",
    "B2": "text-green-700 bg-green-50 border-green-200",
    "B3": "text-sky-700 bg-sky-50 border-sky-200",
    "C4": "text-blue-700 bg-blue-50 border-blue-200",
    "C5": "text-indigo-700 bg-indigo-50 border-indigo-200",
    "C6": "text-amber-700 bg-amber-50 border-amber-200",
    "D7": "text-orange-700 bg-orange-50 border-orange-200",
    "E8": "text-red-700 bg-red-50 border-red-200",
    "F9": "text-rose-700 bg-rose-50 border-rose-200"
  };
  return colors[grade] || "text-slate-700 bg-slate-50 border-slate-200";
};

export default function ScoresReview() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  
  // Data
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [classStatus, setClassStatus] = useState({});
  
  // UI states
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [showScoreModal, setShowScoreModal] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedTermId) {
      fetchClassStatus();
    }
  }, [selectedTermId]);

  useEffect(() => {
    if (selectedClassId && selectedTermId) {
      fetchClassData();
    }
  }, [selectedClassId, selectedTermId]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Fetch terms
      const termsSnapshot = await getDocs(collection(db, "terms"));
      const termList = termsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTerms(termList);
      
      // Auto-select current term
      const currentTerm = termList.find(t => t.isCurrent);
      if (currentTerm) {
        setSelectedTermId(currentTerm.id);
      } else if (termList.length > 0) {
        setSelectedTermId(termList[0].id);
      }

      // Fetch active classes
      const classesQuery = query(
        collection(db, "classes"),
        where("status", "==", "active")
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classList = classesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setClasses(classList);

    } catch (error) {
      console.error("Error fetching initial data:", error);
      setFormError("Failed to load data");
    }
    setLoading(false);
  }

  async function fetchClassStatus() {
    if (!selectedTermId) return;
    
    try {
      // Get all scores for this term
      const scoresQuery = query(
        collection(db, "scores"),
        where("termId", "==", selectedTermId)
      );
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const classStatusMap = {};
      
      scoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const classId = data.classId;
        
        if (!classStatusMap[classId]) {
          classStatusMap[classId] = {
            total: 0,
            submittedToHeadmaster: 0,
            approved: 0,
            status: SCORE_STATUS.DRAFT,
            subjects: {}
          };
        }
        
        classStatusMap[classId].total++;
        
        // Track subject-level status
        if (!classStatusMap[classId].subjects[data.subjectId]) {
          classStatusMap[classId].subjects[data.subjectId] = {
            total: 0,
            status: SCORE_STATUS.DRAFT
          };
        }
        classStatusMap[classId].subjects[data.subjectId].total++;
        
        if (data.status === SCORE_STATUS.APPROVED) {
          classStatusMap[classId].approved++;
          classStatusMap[classId].subjects[data.subjectId].status = SCORE_STATUS.APPROVED;
        } else if (data.status === SCORE_STATUS.SUBMITTED_TO_HEADMASTER) {
          classStatusMap[classId].submittedToHeadmaster++;
          if (classStatusMap[classId].subjects[data.subjectId].status !== SCORE_STATUS.APPROVED) {
            classStatusMap[classId].subjects[data.subjectId].status = SCORE_STATUS.SUBMITTED_TO_HEADMASTER;
          }
        }
      });
      
      setClassStatus(classStatusMap);
    } catch (error) {
      console.error("Error fetching class status:", error);
    }
  }

  async function fetchClassData() {
    if (!selectedClassId || !selectedTermId) return;
    
    try {
      // Fetch subjects for this class
      const subjectsQuery = query(
        collection(db, "classSubjects"),
        where("classId", "==", selectedClassId)
      );
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectList = subjectsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubjects(subjectList);

      // Fetch students in this class
      const studentsQuery = query(
        collection(db, "students"),
        where("classId", "==", selectedClassId),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentList = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentList);

      // Fetch scores for this class and term
      const scoresQuery = query(
        collection(db, "scores"),
        where("classId", "==", selectedClassId),
        where("termId", "==", selectedTermId)
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
      
      // Auto-select first subject
      if (subjectList.length > 0) {
        setSelectedSubjectId(subjectList[0].id);
      }
    } catch (error) {
      console.error("Error fetching class data:", error);
      setFormError("Failed to load class data");
    }
  }

  function getClassStatusSummary(classId) {
    const status = classStatus[classId];
    if (!status) return { label: 'No scores', color: 'bg-slate-100 text-slate-500' };
    
    if (status.approved === status.total && status.total > 0) {
      return { label: '✅ Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    } else if (status.submittedToHeadmaster > 0) {
      return { label: `📤 ${status.submittedToHeadmaster}/${status.total} submitted to Headmaster`, color: 'bg-purple-50 text-purple-700 border-purple-200' };
    } else if (status.total > 0) {
      return { label: `📝 ${status.total} scores entered`, color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    return { label: 'No scores', color: 'bg-slate-100 text-slate-500' };
  }

  function getSubjectScores(subjectId) {
    return scores[subjectId] || {};
  }

  async function handleApproveClass() {
    if (!selectedClassId || !selectedTermId) return;
    
    setFormError("");
    setSuccessMessage("");
    setApproving(true);

    // Check if all scores are submitted to Headmaster
    const classStatusData = classStatus[selectedClassId];
    if (!classStatusData) {
      setFormError("No scores found for this class");
      setApproving(false);
      return;
    }

    if (classStatusData.submittedToHeadmaster < classStatusData.total) {
      setFormError("Not all scores have been submitted to Headmaster yet");
      setApproving(false);
      return;
    }

    if (!confirm(`Approve all scores for ${classes.find(c => c.id === selectedClassId)?.name}?\n\nThis will finalize all scores for this class.`)) {
      setApproving(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      // Get all scores for this class and term
      const scoresQuery = query(
        collection(db, "scores"),
        where("classId", "==", selectedClassId),
        where("termId", "==", selectedTermId)
      );
      const scoresSnapshot = await getDocs(scoresQuery);
      
      scoresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === SCORE_STATUS.SUBMITTED_TO_HEADMASTER) {
          const scoreRef = doc.ref;
          batch.update(scoreRef, {
            status: SCORE_STATUS.APPROVED,
            approvedAt: new Date(),
            approvedBy: "Headmaster"
          });
          updatedCount++;
        }
      });

      await batch.commit();
      setSuccessMessage(`Successfully approved ${updatedCount} scores for this class!`);
      
      // Refresh data
      await fetchClassStatus();
      await fetchClassData();
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Error approving scores:", error);
      setFormError("Failed to approve scores: " + error.message);
    }
    setApproving(false);
  }

  function getStatusSummary(subjectId) {
    const subjectScores = getSubjectScores(subjectId);
    const total = Object.keys(subjectScores).length;
    let submitted = 0;
    let approved = 0;
    
    Object.values(subjectScores).forEach(score => {
      if (score.status === SCORE_STATUS.SUBMITTED_TO_HEADMASTER) submitted++;
      if (score.status === SCORE_STATUS.APPROVED) approved++;
    });
    
    return { total, submitted, approved };
  }

  // Loading state
  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200/60 rounded w-48"></div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-6">
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 bg-slate-200/60 rounded w-1/3"></div>
                  <div className="h-10 bg-slate-200/60 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-4">
                <div className="h-6 bg-slate-200/60 rounded w-2/3 mb-3"></div>
                <div className="h-4 bg-slate-200/60 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  // No data
  if (terms.length === 0) {
    return (
      <HeadmasterLayout>
        <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 font-serif text-xl">
            📅
          </div>
          <h3 className="font-serif text-base font-semibold text-slate-800">No terms found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Please create at least one academic term first.
          </p>
        </div>
      </HeadmasterLayout>
    );
  }

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStatusData = selectedClassId ? classStatus[selectedClassId] : null;

  return (
    <HeadmasterLayout>
      <div className="space-y-6">

        {/* Page Header */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
              Score Review & Approval
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Review and approve scores submitted by Class Teachers
            </p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-md">
            {successMessage}
          </div>
        )}
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {formError}
          </div>
        )}

        {/* Selection Controls */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Term *
              </label>
              <select
                required
                value={selectedTermId}
                onChange={(e) => {
                  setSelectedTermId(e.target.value);
                  setSelectedClassId("");
                }}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
              >
                <option value="">Select a term</option>
                {terms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.name} {term.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Class *
              </label>
              <select
                required
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
              >
                <option value="">Select a class</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Class Status Cards */}
        {selectedTermId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(cls => {
              const status = getClassStatusSummary(cls.id);
              const statusData = classStatus[cls.id];
              const isSelected = cls.id === selectedClassId;
              
              return (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
                    isSelected ? 'border-sky-800 ring-2 ring-sky-200' : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {cls.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cls.level}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  {statusData && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 rounded p-2">
                        <p className="text-sm font-bold text-slate-800">{statusData.total}</p>
                        <p className="text-[10px] text-slate-500">Total</p>
                      </div>
                      <div className="bg-purple-50 rounded p-2">
                        <p className="text-sm font-bold text-purple-700">{statusData.submittedToHeadmaster}</p>
                        <p className="text-[10px] text-purple-600">Submitted</p>
                      </div>
                      <div className="bg-emerald-50 rounded p-2">
                        <p className="text-sm font-bold text-emerald-700">{statusData.approved}</p>
                        <p className="text-[10px] text-emerald-600">Approved</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Subject Scores Overview */}
        {selectedClassId && selectedTermId && subjects.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-slate-800">
                  {selectedClass?.name} - Subject Scores
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {students.length} students • {subjects.length} subjects
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScoreModal(true)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-md transition-colors"
                >
                  View All Scores
                </button>
                <button
                  onClick={handleApproveClass}
                  disabled={approving || !classStatusData || classStatusData.submittedToHeadmaster < classStatusData.total}
                  className="px-4 py-2 bg-sky-900 hover:bg-sky-950 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  {approving ? "Approving..." : "Approve All Scores"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {subjects.map(subject => {
                const summary = getStatusSummary(subject.id);
                const subjectStatusBadge = getStatusBadge(
                  summary.approved === summary.total && summary.total > 0 ? SCORE_STATUS.APPROVED :
                  summary.submitted > 0 ? SCORE_STATUS.SUBMITTED_TO_HEADMASTER :
                  SCORE_STATUS.DRAFT
                );
                
                return (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-slate-900 text-sm">
                        {subject.name}
                      </span>
                      <span className="ml-3 text-xs text-slate-400">
                        {summary.total} student{summary.total !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${subjectStatusBadge.color}`}>
                        {subjectStatusBadge.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {summary.submitted} submitted • {summary.approved} approved
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View All Scores Modal */}
        {showScoreModal && selectedClassId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl p-6 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    All Scores: {selectedClass?.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {terms.find(t => t.id === selectedTermId)?.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200/80">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Student
                      </th>
                      {subjects.map(subject => (
                        <th key={subject.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {subject.name}
                          <br/>
                          <span className="font-normal text-slate-400">(C/E/T/G)</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(student => {
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                            {student.firstName} {student.lastName}
                          </td>
                          {subjects.map(subject => {
                            const subjectScores = getSubjectScores(subject.id);
                            const score = subjectScores[student.id];
                            const gradeColor = score?.grade ? getGradeColor(score.grade) : '';
                            
                            return (
                              <td key={subject.id} className="px-3 py-2 text-center">
                                {score ? (
                                  <span className="text-xs">
                                    {score.classScore || 0}/{score.examScore || 0}/{score.total || 0}
                                    <br/>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${gradeColor}`}>
                                      {score.grade || '-'}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </HeadmasterLayout>
  );
}