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
    [SCORE_STATUS.DRAFT]: { label: 'DRAFT', color: 'bg-amber-50 text-amber-900 border-amber-300' },
    [SCORE_STATUS.SUBMITTED_TO_CLASS_TEACHER]: { label: 'SUBMITTED (SUBJECT)', color: 'bg-sky-50 text-sky-900 border-sky-300' },
    [SCORE_STATUS.SUBMITTED_TO_HEADMASTER]: { label: 'SUBMITTED (CLASS)', color: 'bg-amber-50 text-amber-950 border-amber-400 font-bold' },
    [SCORE_STATUS.APPROVED]: { label: 'APPROVED', color: 'bg-emerald-50 text-emerald-900 border-emerald-300' }
  };
  return statusMap[status] || statusMap[SCORE_STATUS.DRAFT];
};

const getGradeColor = (grade) => {
  const colors = {
    "A1": "text-emerald-900 bg-emerald-50 border-emerald-300",
    "B2": "text-emerald-800 bg-emerald-50/70 border-emerald-200",
    "B3": "text-sky-900 bg-sky-50 border-sky-300",
    "C4": "text-sky-800 bg-sky-50/70 border-sky-200",
    "C5": "text-slate-800 bg-stone-100 border-stone-300",
    "C6": "text-amber-900 bg-amber-50 border-amber-300",
    "D7": "text-amber-950 bg-amber-100 border-amber-400",
    "E8": "text-rose-800 bg-rose-50 border-rose-200",
    "F9": "text-rose-950 bg-rose-100 border-rose-300 font-bold"
  };
  return colors[grade] || "text-stone-700 bg-stone-50 border-stone-200";
};

export default function ScoresReview() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  
  const [terms, setTerms] = useState([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});
  const [classStatus, setClassStatus] = useState({});
  
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
      const termsSnapshot = await getDocs(collection(db, "terms"));
      const termList = termsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTerms(termList);
      
      const currentTerm = termList.find(t => t.isCurrent);
      if (currentTerm) {
        setSelectedTermId(currentTerm.id);
      } else if (termList.length > 0) {
        setSelectedTermId(termList[0].id);
      }

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
      const subjectsQuery = query(
        collection(db, "classSubjects"),
        where("classId", "==", selectedClassId)
      );
      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjectList = subjectsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubjects(subjectList);

      const studentsQuery = query(
        collection(db, "students"),
        where("classId", "==", selectedClassId),
        where("status", "==", "active")
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentList = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentList);

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
    if (!status) return { label: 'NO SCORES', color: 'bg-stone-100 text-stone-600 border-stone-200' };
    
    if (status.approved === status.total && status.total > 0) {
      return { label: 'APPROVED', color: 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold' };
    } else if (status.submittedToHeadmaster > 0) {
      return { label: `${status.submittedToHeadmaster}/${status.total} SUBMITTED`, color: 'bg-amber-50 text-amber-950 border-amber-400 font-bold' };
    } else if (status.total > 0) {
      return { label: `${status.total} RECORDED`, color: 'bg-sky-50 text-sky-900 border-sky-300' };
    }
    return { label: 'NO SCORES', color: 'bg-stone-100 text-stone-600 border-stone-200' };
  }

  function getSubjectScores(subjectId) {
    return scores[subjectId] || {};
  }

  async function handleApproveClass() {
    if (!selectedClassId || !selectedTermId) return;
    
    setFormError("");
    setSuccessMessage("");
    setApproving(true);

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

  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-16 bg-stone-100 border border-stone-200 rounded-sm"></div>
          <div className="bg-white border border-stone-200 p-6 rounded-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-stone-100 rounded-sm"></div>
              <div className="h-10 bg-stone-100 rounded-sm"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-stone-100 border border-stone-200 rounded-sm"></div>
            ))}
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  if (terms.length === 0) {
    return (
      <HeadmasterLayout>
        <div className="bg-white border border-stone-300/80 rounded-sm p-12 text-center shadow-2xs max-w-7xl mx-auto">
          <div className="w-12 h-12 bg-stone-50 border border-stone-200 text-stone-400 flex items-center justify-center mx-auto mb-3 font-serif text-xl">
            📅
          </div>
          <h3 className="font-serif text-base font-bold text-slate-900">No Academic Terms Established</h3>
          <p className="text-xs font-serif text-stone-500 mt-1">
            Please define at least one active term in system administration prior to score review.
          </p>
        </div>
      </HeadmasterLayout>
    );
  }

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const classStatusData = selectedClassId ? classStatus[selectedClassId] : null;

  return (
    <HeadmasterLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header Banner */}
        <div className="bg-white border border-stone-300/80 rounded-sm p-6 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-slate-900"></div>
          <div className="pl-2">
            <span className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
              Academic Governance
            </span>
            <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Score Review & Executive Approval
            </h1>
            <p className="text-xs font-serif text-stone-500 mt-0.5">
              Audit assessment ledgers submitted by Class Teachers prior to final report generation
            </p>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 font-serif text-xs px-4 py-3 rounded-sm shadow-2xs">
            ✓ {successMessage}
          </div>
        )}
        {formError && (
          <div className="bg-rose-50 border border-rose-300 text-rose-950 font-serif text-xs px-4 py-3 rounded-sm shadow-2xs">
            ⚠ {formError}
          </div>
        )}

        {/* Parameter Selection Controls */}
        <div className="bg-white border border-stone-300/80 rounded-sm p-6 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                Academic Term <span className="text-rose-700">*</span>
              </label>
              <select
                required
                value={selectedTermId}
                onChange={(e) => {
                  setSelectedTermId(e.target.value);
                  setSelectedClassId("");
                }}
                className="w-full bg-stone-50/50 border border-stone-300 rounded-sm px-3 py-2 text-xs font-serif text-slate-900 focus:outline-none focus:border-slate-800"
              >
                <option value="">Select Academic Term</option>
                {terms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.name} {term.isCurrent ? "(Current Academic Period)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                Class Division <span className="text-rose-700">*</span>
              </label>
              <select
                required
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-stone-50/50 border border-stone-300 rounded-sm px-3 py-2 text-xs font-serif text-slate-900 focus:outline-none focus:border-slate-800"
              >
                <option value="">Select Class Division</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Class Overview Cards */}
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
                  className={`bg-white border rounded-sm p-4 shadow-2xs cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-slate-900 ring-1 ring-slate-900/10' 
                      : 'border-stone-300/80 hover:border-stone-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif font-bold text-slate-900 text-sm">
                        {cls.name}
                      </h3>
                      <p className="font-serif text-[11px] text-stone-500 mt-0.5">
                        {cls.level}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-serif font-semibold border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  {statusData && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center font-serif border-t border-stone-100 pt-3">
                      <div className="bg-stone-50/70 border border-stone-200/60 rounded-xs p-1.5">
                        <p className="text-xs font-bold text-slate-900">{statusData.total}</p>
                        <p className="text-[9px] text-stone-500 uppercase font-sans">Total</p>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-200/60 rounded-xs p-1.5">
                        <p className="text-xs font-bold text-amber-950">{statusData.submittedToHeadmaster}</p>
                        <p className="text-[9px] text-amber-800 uppercase font-sans">Submitted</p>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xs p-1.5">
                        <p className="text-xs font-bold text-emerald-950">{statusData.approved}</p>
                        <p className="text-[9px] text-emerald-800 uppercase font-sans">Approved</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Class Subject Ledger */}
        {selectedClassId && selectedTermId && subjects.length > 0 && (
          <div className="bg-white border border-stone-300/80 rounded-sm p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 mb-4">
              <div>
                <h3 className="font-serif text-base font-bold text-slate-900">
                  {selectedClass?.name} — Subject Record Register
                </h3>
                <p className="text-xs font-serif text-stone-500 mt-0.5">
                  Enrolled Students: {students.length} • Registered Subjects: {subjects.length}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScoreModal(true)}
                  className="px-3.5 py-1.5 border border-stone-300 text-stone-800 hover:bg-stone-50 text-xs font-serif font-semibold rounded-sm transition-colors"
                >
                  Full Score Matrix
                </button>
                <button
                  onClick={handleApproveClass}
                  disabled={approving || !classStatusData || classStatusData.submittedToHeadmaster < classStatusData.total}
                  className="px-3.5 py-1.5 bg-slate-900 text-amber-300 hover:bg-slate-800 text-xs font-serif font-semibold rounded-sm transition-colors disabled:opacity-50"
                >
                  {approving ? "Committing Approval..." : "Authorize All Scores"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
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
                    className="flex items-center justify-between px-4 py-3 bg-stone-50/50 rounded-sm border border-stone-200 hover:border-stone-300 transition-colors"
                  >
                    <div>
                      <span className="font-serif font-semibold text-slate-900 text-xs">
                        {subject.name}
                      </span>
                      <span className="ml-3 font-serif text-[11px] text-stone-500">
                        ({summary.total} student record{summary.total !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-serif font-semibold border ${subjectStatusBadge.color}`}>
                        {subjectStatusBadge.label}
                      </span>
                      <span className="text-xs font-serif text-stone-500">
                        {summary.submitted} Submitted • {summary.approved} Approved
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Complete Score Matrix Modal */}
        {showScoreModal && selectedClassId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs w-full max-w-6xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Academic Master Register: {selectedClass?.name}
                  </h3>
                  <p className="text-xs font-serif text-stone-500 mt-0.5">
                    {terms.find(t => t.id === selectedTermId)?.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="text-stone-400 hover:text-slate-900 font-serif text-xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="overflow-x-auto border border-stone-200 rounded-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50/80 border-b border-stone-200">
                      <th className="py-2.5 px-3 font-serif text-[10px] font-bold text-stone-600 uppercase tracking-wider border-r border-stone-200">
                        Student Scholar
                      </th>
                      {subjects.map(subject => (
                        <th key={subject.id} className="py-2.5 px-3 font-serif text-[10px] font-bold text-stone-600 uppercase tracking-wider text-center border-r border-stone-200 last:border-r-0">
                          {subject.name}
                          <br/>
                          <span className="font-sans font-normal text-[9px] text-stone-400">(Class/Exam/Total/Grade)</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-serif">
                    {students.map(student => {
                      return (
                        <tr key={student.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-2.5 px-3 text-xs font-semibold text-slate-900 whitespace-nowrap border-r border-stone-200 bg-stone-50/20">
                            {student.firstName} {student.lastName}
                          </td>
                          {subjects.map(subject => {
                            const subjectScores = getSubjectScores(subject.id);
                            const score = subjectScores[student.id];
                            const gradeColor = score?.grade ? getGradeColor(score.grade) : '';
                            
                            return (
                              <td key={subject.id} className="py-2.5 px-3 text-center border-r border-stone-200 last:border-r-0">
                                {score ? (
                                  <div className="text-xs">
                                    <span className="font-mono text-[11px] text-stone-700">
                                      {score.classScore || 0}/{score.examScore || 0}/<strong className="text-slate-900">{score.total || 0}</strong>
                                    </span>
                                    <div className="mt-0.5">
                                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded-xs text-[9px] font-bold border ${gradeColor}`}>
                                        {score.grade || '-'}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-stone-300 font-mono">—</span>
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

              <div className="mt-4 pt-3 border-t border-stone-200 flex justify-end">
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="px-4 py-1.5 bg-slate-900 text-amber-300 text-xs font-serif font-semibold rounded-sm hover:bg-slate-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </HeadmasterLayout>
  );
}