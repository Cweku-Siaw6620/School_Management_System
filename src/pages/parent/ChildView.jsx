import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  collection, getDocs, query, where, doc, getDoc, orderBy
} from "firebase/firestore";
import { db } from "../../firebase";
import ParentLayout from "../../components/ParentLayout";

// GES Grading Scale
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

const getGradeColor = (grade) => {
  const colors = {
    "A1": "text-success-ink bg-success-soft border-success-line",
    "B2": "text-success-ink bg-success-soft border-success-line",
    "B3": "text-ink-soft bg-brand-soft border-line",
    "C4": "text-ink-soft bg-brand-soft border-line",
    "C5": "text-ink-soft bg-brand-soft border-line",
    "C6": "text-ink-soft bg-brand-soft border-line-strong",
    "D7": "text-ink-soft bg-brand-soft border-line-strong",
    "E8": "text-danger-ink bg-danger-soft border-danger-line",
    "F9": "text-danger-ink bg-danger-soft border-danger-line"
  };
  return colors[grade] || "text-ink-soft bg-brand-soft border-line";
};

const STATUS_BADGES = {
  present: "bg-success-soft text-success-ink border-success-line",
  absent: "bg-danger-soft text-danger-ink border-danger-line",
  late: "bg-brand-soft text-ink-soft border-line-strong",
  excused: "bg-surface text-ink-muted border-line-strong",
};

export default function ChildView() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [classData, setClassData] = useState(null);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [scores, setScores] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({
    present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    if (studentId) {
      fetchAll();
    }
  }, [studentId]);

  async function fetchAll() {
    setLoading(true);
    try {
      // 1. Fetch student data
      const studentDoc = await getDoc(doc(db, "students", studentId));
      if (!studentDoc.exists()) {
        setError("Student record not found.");
        setLoading(false);
        return;
      }
      const studentData = { id: studentDoc.id, ...studentDoc.data() };
      setStudent(studentData);

      // 2. Fetch class data
      if (studentData.classId) {
        const classDoc = await getDoc(doc(db, "classes", studentData.classId));
        if (classDoc.exists()) {
          setClassData({ id: classDoc.id, ...classDoc.data() });
        }
      }

      // 3. Fetch current term
      const termsQuery = query(
        collection(db, "terms"),
        where("isCurrent", "==", true)
      );
      const termsSnapshot = await getDocs(termsQuery);
      let term = null;
      if (!termsSnapshot.empty) {
        term = { id: termsSnapshot.docs[0].id, ...termsSnapshot.docs[0].data() };
        setCurrentTerm(term);
      }

      // 4. Fetch scores for current term
      if (term) {
        const scoresQuery = query(
          collection(db, "scores"),
          where("studentId", "==", studentId),
          where("termId", "==", term.id)
        );
        const scoresSnapshot = await getDocs(scoresQuery);
        const scoresList = scoresSnapshot.docs.map(d => d.data());
        scoresList.sort((a, b) => (a.subjectName || "").localeCompare(b.subjectName || ""));
        setScores(scoresList);
      }

      // 5. Fetch attendance for current term
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("studentId", "==", studentId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      let allRecords = attendanceSnapshot.docs.map(d => d.data());

      if (term) {
        const withTermId = allRecords.filter(r => r.termId === term.id);
        if (withTermId.length > 0) {
          allRecords = withTermId;
        } else {
          const termStart = new Date(term.startDate);
          const termEnd = new Date(term.endDate);
          allRecords = allRecords.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= termStart && recordDate <= termEnd;
          });
        }
      }
      
      allRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setAttendanceRecords(allRecords);

      const present = allRecords.filter(r => r.status === "present").length;
      const absent = allRecords.filter(r => r.status === "absent").length;
      const late = allRecords.filter(r => r.status === "late").length;
      const excused = allRecords.filter(r => r.status === "excused").length;
      const total = allRecords.length;
      
      setAttendanceSummary({
        present, absent, late, excused, total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0
      });

    } catch (err) {
      console.error("Error fetching child data:", err);
      setError("Failed to load student data.");
    }
    setLoading(false);
  }

  function getFullName(student) {
    const first = student?.firstName || "";
    const middle = student?.middleName ? ` ${student.middleName}` : "";
    const last = student?.lastName || "";
    return `${first}${middle} ${last}`.trim() || "Unknown";
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getPerformance = () => {
    if (scores.length === 0) return { average: 0, grade: "—" };
    const total = scores.reduce((sum, s) => sum + (s.total || 0), 0);
    const average = Math.round(total / scores.length);
    return { average, grade: getGrade(average) };
  };

  const performance = getPerformance();

  const statusColors = {
    active: "bg-success-soft text-success-ink border-success-line",
    inactive: "bg-danger-soft text-danger-ink border-danger-line",
    transferred: "bg-brand-soft text-ink-soft border-line",
    graduated: "bg-brand-soft text-ink-soft border-line-strong",
  };

  if (loading) {
    return (
      <ParentLayout>
        <div className="animate-pulse space-y-6 max-w-6xl mx-auto p-2">
          <div className="h-28 bg-brand-soft border border-line rounded-xl"></div>
          <div className="h-12 bg-brand-soft border border-line rounded-xl"></div>
          <div className="h-96 bg-brand-soft border border-line rounded-xl"></div>
        </div>
      </ParentLayout>
    );
  }

  if (error || !student) {
    return (
      <ParentLayout>
        <div className="card p-12 text-center max-w-lg mx-auto my-12">
          <h3 className="text-sm font-semibold text-ink">
            {error || "Student Record Not Found"}
          </h3>
          <button
            onClick={() => navigate("/parent/children")}
            className="btn btn-primary mt-4"
          >
            Return to Children Overview
          </button>
        </div>
      </ParentLayout>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "attendance", label: "Attendance" },
    { id: "scores", label: "Scores" },
    { id: "report", label: "Report Card" },
    { id: "profile", label: "Profile Details" },
  ];

  return (
    <ParentLayout>
      <div className="space-y-6 max-w-6xl mx-auto text-ink">

        {/* Back Navigation */}
        <button
          onClick={() => navigate("/parent/children")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          ← Back to My Children
        </button>

        {/* Child Header Card */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-ink tracking-tight">
                  {getFullName(student)}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                  statusColors[student.status] || statusColors.active
                }`}>
                  {student.status ? student.status.toUpperCase() : "ACTIVE"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2 text-xs font-medium text-ink-muted">
                <span>
                  Index: <span className="font-mono font-bold text-ink">{student.indexNumber || "—"}</span>
                </span>
                <span>
                  Class: <span className="font-semibold text-ink">{classData?.name || "Unassigned"}</span>
                </span>
                {classData?.level && (
                  <span>
                    Level: <span className="font-semibold text-ink">{classData.level}</span>
                  </span>
                )}
                {currentTerm && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-soft text-ink text-[10px] font-semibold border border-line">
                    {currentTerm.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="card overflow-hidden">
          <div className="flex overflow-x-auto border-b border-line bg-brand-soft">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-brand text-ink bg-surface"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-brand-soft border border-line rounded-xl p-4">
                    <p className="text-2xl font-bold text-ink">{scores.length}</p>
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mt-1">Subjects</p>
                  </div>
                  <div className="bg-brand-soft border border-line rounded-xl p-4">
                    <p className="text-2xl font-bold text-ink">
                      {performance.average > 0 ? `${performance.average}%` : "—"}
                    </p>
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mt-1">Average Score</p>
                  </div>
                  <div className="bg-brand-soft border border-line rounded-xl p-4">
                    <p className="text-2xl font-bold text-ink">{attendanceSummary.percentage}%</p>
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mt-1">Attendance Rate</p>
                  </div>
                  <div className="bg-brand-soft border border-line rounded-xl p-4">
                    <p className="text-2xl font-bold text-ink">{performance.grade}</p>
                    <p className="text-xs font-semibold text-ink-faint uppercase tracking-wider mt-1">Overall Grade</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
                    Recent Subject Performance
                  </h3>
                  {scores.length === 0 ? (
                    <p className="text-xs text-ink-faint text-center py-6 bg-brand-soft rounded-xl border border-line">
                      No scores available for the active term.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {scores.slice(0, 5).map((score, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-brand-soft rounded-xl border border-line">
                          <span className="text-xs font-semibold text-ink">{score.subjectName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-ink-muted">{score.total}/100</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeColor(score.grade)}`}>
                              {score.grade || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
                    Attendance Breakout
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-success-soft border border-success-line rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-success-ink">{attendanceSummary.present}</p>
                      <p className="text-[10px] font-semibold text-success-ink uppercase tracking-wider mt-0.5">Present</p>
                    </div>
                    <div className="bg-danger-soft border border-danger-line rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-danger-ink">{attendanceSummary.absent}</p>
                      <p className="text-[10px] font-semibold text-danger uppercase tracking-wider mt-0.5">Absent</p>
                    </div>
                    <div className="bg-brand-soft border border-line-strong rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-ink-soft">{attendanceSummary.late}</p>
                      <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mt-0.5">Late</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-ink">{attendanceSummary.excused}</p>
                      <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mt-0.5">Excused</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ATTENDANCE TAB */}
            {activeTab === "attendance" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-brand-soft rounded-xl p-3 text-center border border-line">
                    <p className="text-lg font-bold text-ink">{attendanceSummary.total}</p>
                    <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider">Total Days</p>
                  </div>
                  <div className="bg-success-soft rounded-xl p-3 text-center border border-success-line">
                    <p className="text-lg font-bold text-success-ink">{attendanceSummary.present}</p>
                    <p className="text-[10px] font-semibold text-success-ink uppercase tracking-wider">Present</p>
                  </div>
                  <div className="bg-danger-soft rounded-xl p-3 text-center border border-danger-line">
                    <p className="text-lg font-bold text-danger-ink">{attendanceSummary.absent}</p>
                    <p className="text-[10px] font-semibold text-danger uppercase tracking-wider">Absent</p>
                  </div>
                  <div className="bg-brand-soft rounded-xl p-3 text-center border border-line-strong">
                    <p className="text-lg font-bold text-ink-soft">{attendanceSummary.late}</p>
                    <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Late</p>
                  </div>
                  <div className="bg-surface rounded-xl p-3 text-center border border-line-strong">
                    <p className="text-lg font-bold text-ink">{attendanceSummary.percentage}%</p>
                    <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Attendance Rate</p>
                  </div>
                </div>

                {attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-faint bg-brand-soft rounded-xl border border-line">
                    No attendance records logged for this term.
                  </div>
                ) : (
                  <div className="border border-line rounded-xl overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-brand-soft sticky top-0 border-b border-line">
                          <tr>
                            <th className="py-2.5 px-4 font-bold text-ink-muted uppercase tracking-wider text-[10px]">Date</th>
                            <th className="py-2.5 px-4 font-bold text-ink-muted uppercase tracking-wider text-[10px]">Status</th>
                            <th className="py-2.5 px-4 font-bold text-ink-muted uppercase tracking-wider text-[10px]">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {attendanceRecords.map((record, i) => (
                            <tr key={i} className="hover:bg-brand-soft">
                              <td className="py-2.5 px-4 font-medium text-ink">{record.date}</td>
                              <td className="py-2.5 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${STATUS_BADGES[record.status] || STATUS_BADGES.excused}`}>
                                  {record.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-ink-muted">{record.remarks || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SCORES TAB */}
            {activeTab === "scores" && (
              <div className="space-y-4">
                {scores.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-faint bg-brand-soft rounded-xl border border-line">
                    No score records found for the current academic period.
                  </div>
                ) : (
                  <div className="border border-line rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-soft border-b border-line">
                        <tr>
                          <th className="py-3 px-4 font-bold text-ink-muted uppercase tracking-wider text-[10px]">Subject</th>
                          <th className="py-3 px-4 text-center font-bold text-ink-muted uppercase tracking-wider text-[10px]">Class Score (50)</th>
                          <th className="py-3 px-4 text-center font-bold text-ink-muted uppercase tracking-wider text-[10px]">Exam Score (50)</th>
                          <th className="py-3 px-4 text-center font-bold text-ink-muted uppercase tracking-wider text-[10px]">Total Score (100)</th>
                          <th className="py-3 px-4 text-center font-bold text-ink-muted uppercase tracking-wider text-[10px]">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {scores.map((score, i) => (
                          <tr key={i} className="hover:bg-brand-soft">
                            <td className="py-2.5 px-4 font-semibold text-ink">{score.subjectName}</td>
                            <td className="py-2.5 px-4 text-center text-ink-soft">{score.classScore}</td>
                            <td className="py-2.5 px-4 text-center text-ink-soft">{score.examScore}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-ink">{score.total}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeColor(score.grade)}`}>
                                {score.grade || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* REPORT CARD TAB */}
            {activeTab === "report" && (
              <div className="space-y-4">
                <div className="bg-brand-soft border border-line rounded-xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Student</span>
                      <span className="font-semibold text-ink mt-0.5 block">{getFullName(student)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Class</span>
                      <span className="font-semibold text-ink mt-0.5 block">{classData?.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Term</span>
                      <span className="font-semibold text-ink mt-0.5 block">{currentTerm?.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider block">Index Number</span>
                      <span className="font-mono font-bold text-ink mt-0.5 block">{student.indexNumber || "—"}</span>
                    </div>
                  </div>
                </div>

                {scores.length === 0 ? (
                  <div className="text-center py-8 text-xs text-ink-faint bg-brand-soft rounded-xl border border-line">
                    Terminal report card will publish once scores are finalized.
                  </div>
                ) : (
                  <>
                    <div className="border border-line rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-brand text-white">
                          <tr>
                            <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Subject</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Class</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Exam</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Total</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Grade</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {scores.map((score, i) => (
                            <tr key={i} className="hover:bg-brand-soft">
                              <td className="py-2.5 px-4 font-semibold text-ink">{score.subjectName}</td>
                              <td className="py-2.5 px-4 text-center text-ink-soft">{score.classScore}</td>
                              <td className="py-2.5 px-4 text-center text-ink-soft">{score.examScore}</td>
                              <td className="py-2.5 px-4 text-center font-bold text-ink">{score.total}</td>
                              <td className="py-2.5 px-4 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeColor(score.grade)}`}>
                                  {score.grade}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center text-ink-muted font-medium">
                                {score.total >= 80 ? "Excellent" :
                                 score.total >= 70 ? "Very Good" :
                                 score.total >= 60 ? "Good" :
                                 score.total >= 50 ? "Credit" :
                                 score.total >= 40 ? "Pass" : "Needs Improvement"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-brand-soft border border-line rounded-xl p-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-ink uppercase tracking-wider">Overall Academic Average</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-ink">{performance.average}%</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${getGradeColor(performance.grade)}`}>
                          {performance.grade}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 pb-2 border-b border-line">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Full Name</p>
                      <p className="text-xs font-semibold text-ink mt-1">{getFullName(student)}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Gender</p>
                      <p className="text-xs font-semibold text-ink mt-1 capitalize">{student.gender || "—"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Date of Birth</p>
                      <p className="text-xs font-semibold text-ink mt-1">{formatDate(student.dateOfBirth)}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Index Number</p>
                      <p className="text-xs font-mono font-bold text-ink mt-1">{student.indexNumber || "—"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 pb-2 border-b border-line">
                    Academic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Admission Date</p>
                      <p className="text-xs font-semibold text-ink mt-1">{formatDate(student.admissionDate)}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Academic Year</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.academicYear || "—"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Class Assigned</p>
                      <p className="text-xs font-semibold text-ink mt-1">{classData?.name || "Unassigned"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Level</p>
                      <p className="text-xs font-semibold text-ink mt-1">{classData?.level || "—"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 pb-2 border-b border-line">
                    Guardian Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Guardian Name</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.guardianName || "—"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Telephone</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.guardianPhone || "—"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Relationship</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.guardianRelationship || "—"}</p>
                    </div>
                    {student.guardianEmail && (
                      <div className="bg-brand-soft border border-line rounded-xl p-3">
                        <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Email Address</p>
                        <p className="text-xs font-semibold text-ink mt-1">{student.guardianEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 pb-2 border-b border-line">
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Contact Name</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.emergencyContactName || "—"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Telephone</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.emergencyContactPhone || "—"}</p>
                    </div>
                    <div className="bg-brand-soft border border-line rounded-xl p-3">
                      <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Relationship</p>
                      <p className="text-xs font-semibold text-ink mt-1">{student.emergencyContactRelationship || "—"}</p>
                    </div>
                  </div>
                </div>

                {(student.allergies || student.medicalNotes) && (
                  <div>
                    <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3 pb-2 border-b border-line">
                      Medical Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {student.allergies && (
                        <div className="bg-brand-soft border border-line rounded-xl p-3">
                          <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Allergies</p>
                          <p className="text-xs font-semibold text-ink mt-1">{student.allergies}</p>
                        </div>
                      )}
                      {student.medicalNotes && (
                        <div className="bg-brand-soft border border-line rounded-xl p-3">
                          <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Notes</p>
                          <p className="text-xs font-semibold text-ink mt-1">{student.medicalNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </ParentLayout>
  );
}