import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection, getDocs, query, where, doc, getDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import ParentLayout from "../../components/ParentLayout";

export default function ParentChildren() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState([]);
  const [classMap, setClassMap] = useState({});

  useEffect(() => {
    if (currentUser) {
      fetchChildren();
    }
  }, [currentUser]);

  async function fetchChildren() {
    setLoading(true);
    try {
      let studentIds = [];

      if (userData?.studentIds && userData.studentIds.length > 0) {
        studentIds = userData.studentIds;
      } else {
        const studentsQuery = query(
          collection(db, "students"),
          where("parentUid", "==", currentUser.uid)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        studentIds = studentsSnapshot.docs.map(d => d.id);
      }

      const childrenList = [];
      const classes = {};

      for (const studentId of studentIds) {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (studentDoc.exists()) {
          const studentData = { id: studentDoc.id, ...studentDoc.data() };
          childrenList.push(studentData);

          if (studentData.classId && !classes[studentData.classId]) {
            const classDoc = await getDoc(doc(db, "classes", studentData.classId));
            if (classDoc.exists()) {
              classes[studentData.classId] = {
                id: classDoc.id,
                ...classDoc.data(),
              };
            }
          }
        }
      }

      setChildren(childrenList);
      setClassMap(classes);
    } catch (error) {
      console.error("Error fetching children:", error);
    }
    setLoading(false);
  }

  function getFullName(student) {
    const first = student.firstName || "";
    const middle = student.middleName ? ` ${student.middleName}` : "";
    const last = student.lastName || "";
    return `${first}${middle} ${last}`.trim() || "Unknown";
  }

  function getClassName(classId) {
    if (!classId) return "Unassigned";
    const cls = classMap[classId];
    return cls?.name || "Unassigned";
  }

  function getClassLevel(classId) {
    if (!classId) return "";
    const cls = classMap[classId];
    return cls?.level || "";
  }

  const statusColors = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-100",
    inactive: "bg-rose-50 text-rose-700 border-rose-100",
    transferred: "bg-sky-50 text-sky-700 border-sky-100",
    graduated: "bg-amber-50 text-amber-700 border-amber-100",
  };

  if (loading) {
    return (
      <ParentLayout>
        <div className="font-['Montserrat',sans-serif] animate-pulse space-y-6 max-w-5xl mx-auto p-2">
          <div className="h-20 bg-gray-100 border border-gray-200/80 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-100 border border-gray-200/80 rounded-xl"></div>
            ))}
          </div>
        </div>
      </ParentLayout>
    );
  }

  if (children.length === 0) {
    return (
      <ParentLayout>
        <div className="font-['Montserrat',sans-serif] bg-white border border-gray-200/80 rounded-xl p-12 text-center shadow-sm max-w-xl mx-auto my-12">
          <h3 className="text-sm font-semibold text-gray-900">
            No Enrolled Children Found
          </h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            We couldn't locate any students associated with your parent account. Please contact the school administration to link your student profiles.
          </p>
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="font-['Montserrat',sans-serif] space-y-6 max-w-5xl mx-auto text-gray-800">

        {/* Page Header */}
        <div className="bg-white border border-gray-200/80 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                Parent Portal
              </span>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">
                My Children
              </h1>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                You have <span className="font-semibold text-gray-800">{children.length}</span> {children.length === 1 ? "student" : "students"} registered under your account.
              </p>
            </div>
            <div>
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold border border-gray-200/60">
                {children.length} {children.length === 1 ? "Child" : "Children"}
              </span>
            </div>
          </div>
        </div>

        {/* Children Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map((child) => (
            <Link
              key={child.id}
              to={`/parent/child/${child.id}`}
              className="bg-white border border-gray-200/80 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-gray-300 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base group-hover:text-gray-700 transition-colors">
                      {getFullName(child)}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {child.gender ? child.gender.charAt(0).toUpperCase() + child.gender.slice(1) : ""}
                      {child.dateOfBirth && ` • DOB: ${child.dateOfBirth}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    statusColors[child.status] || statusColors.active
                  }`}>
                    {child.status ? child.status.toUpperCase() : "ACTIVE"}
                  </span>
                </div>

                <div className="bg-gray-50/70 border border-gray-100 rounded-lg p-3 grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Class</span>
                    <span className="text-xs font-semibold text-gray-800 mt-0.5 block">
                      {getClassName(child.classId)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Index Number</span>
                    <span className="text-xs font-mono font-bold text-gray-800 mt-0.5 block">
                      {child.indexNumber || "—"}
                    </span>
                  </div>
                  {getClassLevel(child.classId) && (
                    <div className="col-span-2 border-t border-gray-100 pt-2 mt-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Academic Level</span>
                      <span className="text-xs font-semibold text-gray-800 mt-0.5 block">
                        {getClassLevel(child.classId)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-400 font-normal">
                  View academic records
                </span>
                <span className="text-gray-900 group-hover:translate-x-0.5 transition-transform">
                  Open Dashboard →
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Tip Notice */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <span className="text-base leading-none"></span>
          <div>
            <p className="text-xs font-bold text-gray-900">Portal Tip</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Select any student card to review attendance history, terminal marks, and downloadable report cards.
            </p>
          </div>
        </div>

      </div>
    </ParentLayout>
  );
}