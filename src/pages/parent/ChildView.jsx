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
    "A1": "text-emerald-700 bg-emerald-50 border-emerald-100",
    "B2": "text-emerald-700 bg-emerald-50 border-emerald-100",
    "B3": "text-sky-700 bg-sky-50 border-sky-100",
    "C4": "text-blue-700 bg-blue-50 border-blue-100",
    "C5": "text-indigo-700 bg-indigo-50 border-indigo-100",
    "C6": "text-amber-700 bg-amber-50 border-amber-100",
    "D7": "text-orange-700 bg-orange-50 border-orange-100",
    "E8": "text-rose-700 bg-rose-50 border-rose-100",
    "F9": "text-rose-700 bg-rose-50 border-rose-100"
  };
  return colors[grade] || "text-gray-700 bg-gray-50 border-gray-200";
};

const STATUS_BADGES = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-100",
  absent: "bg-rose-50 text-rose-700 border-rose-100",
  late: "bg-amber-50 text-amber-700 border-amber-100",
  excused: "bg-gray-100 text-gray-600 border-gray-200",
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
    active: "bg-emerald-50 text-emerald-700 border-emerald-100",
    inactive: "bg-rose-50 text-rose-700 border-rose-100",
    transferred: "bg-sky-50 text-sky-700 border-sky-100",
    graduated: "bg-amber-50 text-amber-700 border-amber-100",
  };

  if (loading) {
    return (
      <ParentLayout>
        <div className="font-['Montserrat',sans-serif] animate-pulse space-y-6 max-w-6xl mx-auto p-2">
          <div className="h-28 bg-gray-100 border border-gray-200/80 rounded-xl"></div>
          <div className="h-12 bg-gray-100 border border-gray-200/80 rounded-xl"></div>
          <div className="h-96 bg-gray-100 border border-gray-200/80 rounded-xl"></div>
        </div>
      </ParentLayout>
    );
  }

  if (error || !student) {
    return (
      <ParentLayout>
        <div className="font-['Montserrat',sans-serif] bg-white border border-gray-200/80 rounded-xl p-12 text-center shadow-sm max-w-lg mx-auto my-12">
          <h3 className="text-sm font-semibold text-gray-900">
            {error || "Student Record Not Found"}
          </h3>
          <button
            onClick={() => navigate("/parent/children")}
            className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors"
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
      <div className="font-['Montserrat',sans-serif] space-y-6 max-w-6xl mx-auto text-gray-800">

        {/* Back Navigation */}
        <button
          onClick={() => navigate("/parent/children")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back to My Children
        </button>

        {/* Child Header Card */}
        <div className="bg-white border border-gray-200/80 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {getFullName(student)}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                  statusColors[student.status] || statusColors.active
                }`}>
                  {student.status ? student.status.toUpperCase() : "ACTIVE"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2 text-xs font-medium text-gray-500">
                <span>
                  Index: <span className="font-mono font-bold text-gray-800">{student.indexNumber || "—"}</span>
                </span>
                <span>
                  Class: <span className="font-semibold text-gray-800">{classData?.name || "Unassigned"}</span>
                </span>
                {classData?.level && (
                  <span>
                    Level: <span className="font-semibold text-gray-800">{classData.level}</span>
                  </span>
                )}
                {currentTerm && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-[10px] font-semibold border border-gray-200">
                    {currentTerm.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border border-gray-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-gray-900 text-gray-900 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-800"
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
                  <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">{scores.length}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Subjects</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">
                      {performance.average > 0 ? `${performance.average}%` : "—"}
                    </p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Average Score</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">{attendanceSummary.percentage}%</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Attendance Rate</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">{performance.grade}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Overall Grade</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                    Recent Subject Performance
                  </h3>
                  {scores.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                      No scores available for the active term.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {scores.slice(0, 5).map((score, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50/70 rounded-xl border border-gray-100">
                          <span className="text-xs font-semibold text-gray-800">{score.subjectName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-500">{score.total}/100</span>
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
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                    Attendance Breakout
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-emerald-800">{attendanceSummary.present}</p>
                      <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Present</p>
                    </div>
                    <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-rose-800">{attendanceSummary.absent}</p>
                      <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider mt-0.5">Absent</p>
                    </div>
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-amber-800">{attendanceSummary.late}</p>
                      <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">Late</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{attendanceSummary.excused}</p>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Excused</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ATTENDANCE TAB */}
            {activeTab === "attendance" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200/80">
                    <p className="text-lg font-bold text-gray-900">{attendanceSummary.total}</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Days</p>
                  </div>
                  <div className="bg-emerald-50/60 rounded-xl p-3 text-center border border-emerald-100">
                    <p className="text-lg font-bold text-emerald-800">{attendanceSummary.present}</p>
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Present</p>
                  </div>
                  <div className="bg-rose-50/60 rounded-xl p-3 text-center border border-rose-100">
                    <p className="text-lg font-bold text-rose-800">{attendanceSummary.absent}</p>
                    <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">Absent</p>
                  </div>
                  <div className="bg-amber-50/60 rounded-xl p-3 text-center border border-amber-100">
                    <p className="text-lg font-bold text-amber-800">{attendanceSummary.late}</p>
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Late</p>
                  </div>
                  <div className="bg-sky-50/60 rounded-xl p-3 text-center border border-sky-100">
                    <p className="text-lg font-bold text-sky-800">{attendanceSummary.percentage}%</p>
                    <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider">Attendance Rate</p>
                  </div>
                </div>

                {attendanceRecords.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    No attendance records logged for this term.
                  </div>
                ) : (
                  <div className="border border-gray-200/80 rounded-xl overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200/80">
                          <tr>
                            <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Date</th>
                            <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Status</th>
                            <th className="py-2.5 px-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {attendanceRecords.map((record, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-4 font-medium text-gray-800">{record.date}</td>
                              <td className="py-2.5 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${STATUS_BADGES[record.status] || STATUS_BADGES.excused}`}>
                                  {record.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-gray-500">{record.remarks || "—"}</td>
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
                  <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    No score records found for the current academic period.
                  </div>
                ) : (
                  <div className="border border-gray-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200/80">
                        <tr>
                          <th className="py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Subject</th>
                          <th className="py-3 px-4 text-center font-bold text-gray-500 uppercase tracking-wider text-[10px]">Class Score (50)</th>
                          <th className="py-3 px-4 text-center font-bold text-gray-500 uppercase tracking-wider text-[10px]">Exam Score (50)</th>
                          <th className="py-3 px-4 text-center font-bold text-gray-500 uppercase tracking-wider text-[10px]">Total Score (100)</th>
                          <th className="py-3 px-4 text-center font-bold text-gray-500 uppercase tracking-wider text-[10px]">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {scores.map((score, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-4 font-semibold text-gray-900">{score.subjectName}</td>
                            <td className="py-2.5 px-4 text-center text-gray-600">{score.classScore}</td>
                            <td className="py-2.5 px-4 text-center text-gray-600">{score.examScore}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-gray-900">{score.total}</td>
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
                <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Student</span>
                      <span className="font-semibold text-gray-900 mt-0.5 block">{getFullName(student)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Class</span>
                      <span className="font-semibold text-gray-900 mt-0.5 block">{classData?.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Term</span>
                      <span className="font-semibold text-gray-900 mt-0.5 block">{currentTerm?.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Index Number</span>
                      <span className="font-mono font-bold text-gray-900 mt-0.5 block">{student.indexNumber || "—"}</span>
                    </div>
                  </div>
                </div>

                {scores.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                    Terminal report card will publish once scores are finalized.
                  </div>
                ) : (
                  <>
                    <div className="border border-gray-200/80 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-900 text-white">
                          <tr>
                            <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Subject</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Class</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Exam</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Total</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Grade</th>
                            <th className="py-3 px-4 text-center font-bold uppercase tracking-wider text-[10px]">Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {scores.map((score, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-4 font-semibold text-gray-900">{score.subjectName}</td>
                              <td className="py-2.5 px-4 text-center text-gray-600">{score.classScore}</td>
                              <td className="py-2.5 px-4 text-center text-gray-600">{score.examScore}</td>
                              <td className="py-2.5 px-4 text-center font-bold text-gray-900">{score.total}</td>
                              <td className="py-2.5 px-4 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeColor(score.grade)}`}>
                                  {score.grade}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center text-gray-500 font-medium">
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

                    <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Overall Academic Average</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900">{performance.average}%</span>
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
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{getFullName(student)}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gender</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1 capitalize">{student.gender || "—"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date of Birth</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{formatDate(student.dateOfBirth)}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Index Number</p>
                      <p className="text-xs font-mono font-bold text-gray-900 mt-1">{student.indexNumber || "—"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                    Academic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Admission Date</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{formatDate(student.admissionDate)}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Academic Year</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.academicYear || "—"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class Assigned</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{classData?.name || "Unassigned"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Level</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{classData?.level || "—"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                    Guardian Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Guardian Name</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.guardianName || "—"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Telephone</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.guardianPhone || "—"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Relationship</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.guardianRelationship || "—"}</p>
                    </div>
                    {student.guardianEmail && (
                      <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Address</p>
                        <p className="text-xs font-semibold text-gray-900 mt-1">{student.guardianEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                    Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact Name</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.emergencyContactName || "—"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Telephone</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.emergencyContactPhone || "—"}</p>
                    </div>
                    <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Relationship</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{student.emergencyContactRelationship || "—"}</p>
                    </div>
                  </div>
                </div>

                {(student.allergies || student.medicalNotes) && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                      Medical Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {student.allergies && (
                        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Allergies</p>
                          <p className="text-xs font-semibold text-gray-900 mt-1">{student.allergies}</p>
                        </div>
                      )}
                      {student.medicalNotes && (
                        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</p>
                          <p className="text-xs font-semibold text-gray-900 mt-1">{student.medicalNotes}</p>
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