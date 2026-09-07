import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";
import { Link } from "react-router-dom";

// Academic progression order (definitive)
const CLASS_ORDER = {
  "Nursery 1": 1,
  "Nursery 2": 2,
  "KG 1": 3,
  "KG 2": 4,
  "Primary 1": 5,
  "Primary 2": 6,
  "Primary 3": 7,
  "Primary 4": 8,
  "Primary 5": 9,
  "Primary 6": 10,
  "JHS 1": 11,
  "JHS 2": 12,
  "JHS 3": 13,
};

// All valid class levels
const VALID_LEVELS = Object.keys(CLASS_ORDER);

const statusColors = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  inactive: "bg-rose-50 text-rose-800 border-rose-200",
  transferred: "bg-sky-50 text-sky-800 border-sky-200",
  graduated: "bg-amber-50 text-amber-800 border-amber-200",
};

// Extracted outer sub-components to prevent focus loss & input re-mounting
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[status] || statusColors.active}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70"></span>
    {status ? status.toUpperCase() : "ACTIVE"}
  </span>
);

const FormField = ({ label, required = false, children, note = "" }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
      {label} {required && <span className="text-rose-600">*</span>}
    </label>
    {children}
    {note && <p className="text-[11px] text-slate-400 italic mt-0.5">{note}</p>}
  </div>
);

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  
  const [schoolInitials, setSchoolInitials] = useState("");
  const [showInitialsModal, setShowInitialsModal] = useState(false);
  const [initialsInput, setInitialsInput] = useState("");
  const [initialsError, setInitialsError] = useState("");

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("All");

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    admissionDate: "",
    academicYear: "",
    classId: null,
    guardianName: "",
    guardianPhone: "",
    guardianRelationship: "",
    guardianEmail: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    allergies: "",
    medicalNotes: "",
    indexNumber: "",
    status: "active",
    parentAccountCreated: false,
    mustChangePassword: true,
  });

  useEffect(() => {
    fetchAll();
    fetchSchoolInitials();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [studentSnap, classSnap] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "classes")),
      ]);
      
      const studentList = studentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(studentList);
      
      const allClasses = classSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const validClasses = allClasses.filter(
        (c) => c.status === "active" && VALID_LEVELS.includes(c.level)
      );
      setClasses(validClasses);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  }

  async function fetchSchoolInitials() {
    try {
      const configDoc = await getDoc(doc(db, "schoolConfig", "settings"));
      if (configDoc.exists()) {
        const data = configDoc.data();
        setSchoolInitials(data.initials || "");
      } else {
        setShowInitialsModal(true);
      }
    } catch (error) {
      console.error("Error fetching school initials:", error);
      setShowInitialsModal(true);
    }
  }

  async function saveSchoolInitials() {
    if (!initialsInput.trim()) {
      setInitialsError("Please enter school initials (e.g., AJ)");
      return;
    }
    const cleaned = initialsInput.trim().toUpperCase();
    if (cleaned.length < 2 || cleaned.length > 5) {
      setInitialsError("Initials must be 2-5 characters");
      return;
    }
    try {
      await setDoc(doc(db, "schoolConfig", "settings"), {
        initials: cleaned,
        updatedAt: new Date(),
      });
      setSchoolInitials(cleaned);
      setShowInitialsModal(false);
      setInitialsInput("");
      setInitialsError("");
    } catch (error) {
      console.error("Error saving school initials:", error);
      setInitialsError("Failed to save initials. Please try again.");
    }
  }

  function generateIndexNumber() {
    if (!schoolInitials) return "";
    const existingNumbers = students
      .map(s => s.indexNumber)
      .filter(num => num && num.startsWith(schoolInitials));
    const existingNumbersList = existingNumbers
      .map(num => parseInt(num.replace(schoolInitials, ""), 10))
      .filter(num => !isNaN(num));
    let nextNumber = 1;
    if (existingNumbersList.length > 0) {
      const max = Math.max(...existingNumbersList);
      nextNumber = max + 1;
    }
    const padded = String(nextNumber).padStart(5, "0");
    return `${schoolInitials}${padded}`;
  }

  useEffect(() => {
    if (showModal && !formData.indexNumber && schoolInitials) {
      setFormData(prev => ({ ...prev, indexNumber: generateIndexNumber() }));
    }
  }, [showModal, schoolInitials]);

  async function handleAddStudent(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "students", id), {
        firstName: formData.firstName,
        middleName: formData.middleName || "",
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        admissionDate: formData.admissionDate,
        academicYear: formData.academicYear,
        classId: formData.classId || null,
        guardianName: formData.guardianName,
        guardianPhone: formData.guardianPhone,
        guardianRelationship: formData.guardianRelationship,
        guardianEmail: formData.guardianEmail || "",
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: formData.emergencyContactPhone,
        emergencyContactRelationship: formData.emergencyContactRelationship,
        allergies: formData.allergies || "",
        medicalNotes: formData.medicalNotes || "",
        indexNumber: formData.indexNumber,
        status: "active",
        parentAccountCreated: false,
        mustChangePassword: true,
        createdAt: new Date(),
      });
      resetForm();
      setShowModal(false);
      fetchAll();
    } catch (err) {
      setFormError(err.message);
    }
    setFormLoading(false);
  }

  function resetForm() {
    setFormData({
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      admissionDate: "",
      academicYear: "",
      classId: null,
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
      guardianEmail: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      allergies: "",
      medicalNotes: "",
      indexNumber: "",
      status: "active",
      parentAccountCreated: false,
      mustChangePassword: true,
    });
    setFormStep(1);
    setFormError("");
  }

  function getAcademicYearOptions() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -1; i <= 2; i++) {
      const year = currentYear + i;
      years.push(`${year}/${year + 1}`);
    }
    return years;
  }

  function getClassName(classId) {
    if (!classId) return "Unassigned";
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return "Unassigned";
    return cls.name;
  }

  function getFullName(student) {
    const first = student.firstName || "";
    const middle = student.middleName ? ` ${student.middleName}` : "";
    const last = student.lastName || "";
    const full = `${first}${middle} ${last}`.trim();
    return full || "Unknown Student";
  }

  async function toggleStatus(student) {
    const newStatus = student.status === "active" ? "inactive" : "active";
    await updateDoc(doc(db, "students", student.id), { status: newStatus });
    fetchAll();
  }

  function getSortedClasses(classesList) {
    return [...classesList].sort((a, b) => {
      const orderA = CLASS_ORDER[a.level] || 999;
      const orderB = CLASS_ORDER[b.level] || 999;
      return orderA - orderB;
    });
  }

  // Multi-field search & filtering logic
  const filteredStudents = students.filter((student) => {
    const fullName = getFullName(student).toLowerCase();
    const indexNum = (student.indexNumber || "").toLowerCase();
    const className = getClassName(student.classId).toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesQuery =
      fullName.includes(query) ||
      indexNum.includes(query) ||
      className.includes(query);

    const matchesClass =
      selectedClassFilter === "All" ||
      (selectedClassFilter === "Unassigned" && !student.classId) ||
      student.classId === selectedClassFilter;

    return matchesQuery && matchesClass;
  });

  const sortedClasses = getSortedClasses(classes.filter(c => c.status === "active"));

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto font-['Montserrat',sans-serif]">
          <div className="h-20 bg-slate-100 border border-slate-200 rounded-xl"></div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-md w-full"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto font-['Montserrat',sans-serif]">

        {/* Header Section */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-slate-900 tracking-tight">
              Student Register
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage complete student records, index numbers, and class assignments.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-900 text-white text-sm font-medium rounded-md hover:bg-sky-950 transition-colors shadow-xs shrink-0"
          >
            <span className="text-base font-bold leading-none">+</span> Enroll New Student
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search index no., student name, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Class:</span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="w-full sm:w-auto border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
            >
              <option value="All">All Classes</option>
              <option value="Unassigned">Unassigned</option>
              {sortedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Data Table */}
        {filteredStudents.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">No Matching Student Records</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search criteria or enroll a new student.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200">
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Index No.
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Gender
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      DOB
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Guardian Record
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Class Placement
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {student.indexNumber || <span className="text-slate-400 font-normal">—</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link 
                          to={`/admin/students/${student.id}`}
                          className="text-xs font-semibold text-slate-900 hover:text-sky-700 hover:underline transition-colors"
                        >
                          {getFullName(student)}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 capitalize">
                        {student.gender || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {student.dateOfBirth || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-xs font-medium text-slate-900">
                            {student.guardianName || "—"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {student.guardianPhone || ""}
                            {student.guardianRelationship && student.guardianPhone && " · "}
                            {student.guardianRelationship || ""}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {getClassName(student.classId)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={student.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleStatus(student)}
                          className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors ${
                            student.status === "active"
                              ? "border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                              : "border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                          }`}
                        >
                          {student.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Enroll Student */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                    Enroll New Student
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Stage {formStep} of 3 — {
                      formStep === 1 ? "Personal Particulars" :
                      formStep === 2 ? "Academic Placement" :
                      "Guardian & Emergency Information"
                    }
                  </p>
                </div>
                <button
                  onClick={() => { resetForm(); setShowModal(false); }}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Progress Bar */}
              <div className="grid grid-cols-3 gap-1 mb-6">
                <div className={`h-1.5 rounded-full transition-colors ${formStep >= 1 ? 'bg-sky-900' : 'bg-slate-200'}`} />
                <div className={`h-1.5 rounded-full transition-colors ${formStep >= 2 ? 'bg-sky-900' : 'bg-slate-200'}`} />
                <div className={`h-1.5 rounded-full transition-colors ${formStep >= 3 ? 'bg-sky-900' : 'bg-slate-200'}`} />
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-md mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddStudent}>
                {formStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField label="First Name" required>
                        <input
                          type="text"
                          required
                          placeholder="First Name"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                      <FormField label="Middle Name">
                        <input
                          type="text"
                          placeholder="Middle Name"
                          value={formData.middleName}
                          onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                      <FormField label="Last Name" required>
                        <input
                          type="text"
                          required
                          placeholder="Last Name"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Gender" required>
                        <select
                          required
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </FormField>

                      <FormField label="Date of Birth" required>
                        <input
                          type="date"
                          required
                          value={formData.dateOfBirth}
                          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setFormStep(2)}
                        className="px-5 py-2 bg-sky-900 text-white text-xs font-semibold rounded-md hover:bg-sky-950 transition-colors"
                      >
                        Proceed to Academic Info &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {formStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Admission Date" required>
                        <input
                          type="date"
                          required
                          value={formData.admissionDate}
                          onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>

                      <FormField label="Academic Year" required>
                        <select
                          required
                          value={formData.academicYear}
                          onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        >
                          <option value="">Select Academic Year</option>
                          {getAcademicYearOptions().map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </FormField>
                    </div>

                    <FormField label="Assigned Class" note="Class allocation can be deferred to Headmaster administration.">
                      <select
                        value={formData.classId || ""}
                        onChange={(e) => setFormData({ ...formData, classId: e.target.value || null })}
                        className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                      >
                        <option value="">Unassigned</option>
                        {sortedClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} — {cls.level}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setFormStep(1)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
                      >
                        &larr; Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStep(3)}
                        className="flex-1 px-4 py-2 bg-sky-900 text-white text-xs font-semibold rounded-md hover:bg-sky-950 transition-colors"
                      >
                        Proceed to Guardian Details &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {formStep === 3 && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                      <p className="text-xs text-amber-900">
                        <span className="font-bold">Credential Protocol:</span> Parent Portal Credentials will default to:
                        <br />
                        <span className="font-semibold">Index Number:</span> <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{formData.indexNumber || "Pending Generation"}</code>
                        <span className="mx-2">|</span>
                        <span className="font-semibold">Temporary Pin:</span> Guardian Telephone Number
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Guardian Full Name" required>
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={formData.guardianName}
                          onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                      <FormField label="Telephone Number" required note="Serves as Initial Access Password">
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 0244000000"
                          value={formData.guardianPhone}
                          onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Relationship to Student" required>
                        <select
                          required
                          value={formData.guardianRelationship}
                          onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        >
                          <option value="">Select Relationship</option>
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Uncle">Uncle</option>
                          <option value="Aunt">Aunt</option>
                          <option value="Grandparent">Grandparent</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Other">Other</option>
                        </select>
                      </FormField>

                      <FormField label="Guardian Email" note="Official correspondence only">
                        <input
                          type="email"
                          placeholder="guardian@example.com"
                          value={formData.guardianEmail}
                          onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                          className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                        />
                      </FormField>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                        Emergency Contact Particulars
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField label="Contact Name" required>
                          <input
                            type="text"
                            required
                            placeholder="Full Name"
                            value={formData.emergencyContactName}
                            onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                            className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                          />
                        </FormField>
                        <FormField label="Telephone" required>
                          <input
                            type="tel"
                            required
                            placeholder="Telephone Number"
                            value={formData.emergencyContactPhone}
                            onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                            className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                          />
                        </FormField>
                        <FormField label="Relationship" required>
                          <select
                            required
                            value={formData.emergencyContactRelationship}
                            onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                            className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                          >
                            <option value="">Select Relationship</option>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Uncle">Uncle</option>
                            <option value="Aunt">Aunt</option>
                            <option value="Grandparent">Grandparent</option>
                            <option value="Guardian">Guardian</option>
                            <option value="Other">Other</option>
                          </select>
                        </FormField>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                        Medical & Health Particulars
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Allergies / Conditions">
                          <input
                            type="text"
                            placeholder="e.g. Penicillin, Peanut allergy"
                            value={formData.allergies}
                            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                            className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                          />
                        </FormField>
                        <FormField label="Medical Remarks">
                          <input
                            type="text"
                            placeholder="Additional medical notes"
                            value={formData.medicalNotes}
                            onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                            className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                          />
                        </FormField>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setFormStep(2)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
                      >
                        &larr; Back
                      </button>
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="flex-1 px-4 py-2 bg-sky-900 text-white text-xs font-semibold rounded-md hover:bg-sky-950 transition-colors disabled:opacity-50"
                      >
                        {formLoading ? "Enrolling Student..." : "Commit Student Record"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Modal: School Initials Setup */}
        {showInitialsModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Institutional Prefix Setup
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Specify institutional prefix to initialize automated index numbering.
                </p>
              </div>

              {initialsError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-md mb-4">
                  {initialsError}
                </div>
              )}

              <div className="space-y-4">
                <FormField label="School Prefix Initials" required note="Allowed length: 2 to 5 upper-case characters">
                  <input
                    type="text"
                    required
                    placeholder="e.g. AJ"
                    value={initialsInput}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                      setInitialsInput(value);
                      setInitialsError("");
                    }}
                    maxLength={5}
                    className="w-full bg-slate-50/50 border border-slate-300 rounded-md px-3 py-2 text-sm font-mono tracking-wider font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-800 uppercase"
                  />
                </FormField>

                <button
                  onClick={saveSchoolInitials}
                  className="w-full py-2.5 bg-sky-900 text-white text-xs font-semibold rounded-md hover:bg-sky-950 transition-colors"
                >
                  Commit Institutional Identifier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}