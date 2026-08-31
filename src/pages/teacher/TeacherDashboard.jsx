import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import TeacherLayout from "../../components/TeacherLayout";
import { Link } from "react-router-dom";

export default function TeacherDashboard() {
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [teacherData, setTeacherData] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [hasAssignments, setHasAssignments] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchTeacherDashboard();
    }
  }, [currentUser]);

  async function fetchTeacherDashboard() {
    setLoading(true);
    try {
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

      const staffQuery = query(
        collection(db, "staff"),
        where("email", "==", currentUser.email)
      );
      const staffSnapshot = await getDocs(staffQuery);

      if (!staffSnapshot.empty) {
        const teacher = staffSnapshot.docs[0].data();
        const teacherId = staffSnapshot.docs[0].id;
        setTeacherData({ id: teacherId, ...teacher });

        if (term) {
          await fetchMyClasses(teacherId, term);
        }
      }
    } catch (error) {
      console.error("Error fetching teacher dashboard:", error);
    }
    setLoading(false);
  }

async function fetchMyClasses(teacherId, term) {
  try {
    const classMap = new Map();

    // Get ONLY subject assignments for this teacher this term
    // This covers both class teachers and subject teachers
    const subjectAssignmentQuery = query(
      collection(db, "subjectAssignments"),
      where("termId", "==", term.id),
      where("teacherId", "==", teacherId)
    );
    const subjectAssignmentsSnap = await getDocs(subjectAssignmentQuery);

    for (const assignment of subjectAssignmentsSnap.docs) {
      const data = assignment.data();

      if (classMap.has(data.classId)) {
        // Class already in map — just add this subject
        const existing = classMap.get(data.classId);
        existing.subjects.push(data.subjectName);
      } else {
        // New class — fetch class details
        const classSnap = await getDoc(doc(db, "classes", data.classId));
        if (classSnap.exists()) {
          const classData = classSnap.data();

          const studentsQuery = query(
            collection(db, "students"),
            where("classId", "==", data.classId),
            where("status", "==", "active")
          );
          const studentsSnap = await getDocs(studentsQuery);

          classMap.set(data.classId, {
            classId: data.classId,
            className: classData.name,
            level: classData.level,
            studentCount: studentsSnap.size,
            subjects: [data.subjectName],
          });
        }
      }
    }

    // Now check which of these classes the teacher is also a class teacher of
    const classAssignmentQuery = query(
      collection(db, "classAssignments"),
      where("termId", "==", term.id),
      where("teacherId", "==", teacherId)
    );
    const classAssignmentsSnap = await getDocs(classAssignmentQuery);
    const classTeacherClassIds = new Set(
      classAssignmentsSnap.docs.map(d => d.data().classId)
    );

    // Add role label based on whether they are class teacher of that class
    const classes = Array.from(classMap.values()).map(cls => ({
      ...cls,
      isClassTeacher: classTeacherClassIds.has(cls.classId),
      role: classTeacherClassIds.has(cls.classId)
        ? "Class Teacher"
        : "Subject Teacher",
    }));

    setMyClasses(classes);
    setHasAssignments(classes.length > 0);

  } catch (error) {
    console.error("Error fetching my classes:", error);
  }
}

  if (loading) {
    return (
      <TeacherLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-24 bg-slate-100 rounded-lg border border-slate-200/60"></div>
          <div className="h-44 bg-slate-100 rounded-lg border border-slate-200/60"></div>
          <div className="h-64 bg-slate-100 rounded-lg border border-slate-200/60"></div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6 max-w-7xl mx-auto text-slate-800">

        {/* Page Header */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Faculty Portal
            </span>
            <h1 className="font-serif text-2xl font-normal text-slate-900 tracking-tight mt-0.5">
              Teacher Dashboard
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>
              {currentTerm?.name || 'No Active Term'}
            </span>
            <span className="text-xs text-slate-400 border-l border-slate-200 pl-3 py-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Teacher Profile Summary */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-lg font-serif font-medium shrink-0">
              {teacherData?.firstName?.[0]}{teacherData?.lastName?.[0]}
            </div>
            
            {/* Profile Info */}
            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-xl font-normal text-slate-900">
                    {teacherData?.firstName} {teacherData?.lastName}
                  </h2>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {teacherData?.position || 'Faculty Member'}
                  </span>
                </div>
                
                <span className="text-xs font-medium text-slate-500">
                  {myClasses.some(c => c.isClassTeacher) 
                    ? 'Class Teacher' 
                    : myClasses.length > 0 
                    ? 'Subject Instructor' 
                    : 'Unassigned'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Email</p>
                  <p className="text-xs font-medium text-slate-800 mt-0.5 truncate">{teacherData?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Phone</p>
                  <p className="text-xs font-medium text-slate-800 mt-0.5">{teacherData?.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Primary Subjects</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {teacherData?.subjects && teacherData.subjects.length > 0 ? (
                      teacherData.subjects.map((subject, index) => (
                        <span key={index} className="inline-flex px-1.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 text-[10px] rounded">
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">None Specified</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Assigned Classes */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Assigned Classes & Subjects
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasAssignments ? `${myClasses.length} active allocation${myClasses.length !== 1 ? 's' : ''}` : 'No active course assignments for this term'}
              </p>
            </div>
            {hasAssignments && (
              <Link
                to="/teacher/scores"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-800 hover:text-slate-600 transition-colors border-b border-slate-300 pb-0.5"
              >
                Enter Student Scores
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            )}
          </div>

          {!hasAssignments ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
              <svg className="w-8 h-8 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-xs font-medium text-slate-600">No class allocations recorded</p>
              <p className="text-xs text-slate-400 mt-1">Contact administrative staff to set up current term assignments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myClasses.map((cls) => (
                <div
                  key={cls.classId}
                  className="border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-all bg-white shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-serif text-base font-medium text-slate-900">
                          {cls.className}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{cls.level}</p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-700">
                        {cls.role}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {cls.studentCount} Students
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        {cls.subjects.length} Subjects
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {cls.subjects.map((subject, index) => (
                        <span key={index} className="inline-flex px-2 py-0.5 bg-slate-50 text-slate-600 text-[11px] rounded border border-slate-200">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <Link
                      to="/teacher/scores"
                      className="text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1"
                    >
                      Manage Grades
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </TeacherLayout>
  );
}