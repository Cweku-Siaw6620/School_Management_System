import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc, query, where } from "firebase/firestore";
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
  active: "bg-success-soft text-success-ink border-success-line",
  inactive: "bg-danger-soft text-danger-ink border-danger-line",
  transferred: "bg-brand-soft text-ink-soft border-line",
  graduated: "bg-surface text-ink border-line-strong",
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
    <label className="label">
      {label} {required && <span className="text-danger">*</span>}
    </label>
    {children}
    {note && <p className="text-[11px] text-ink-faint mt-0.5">{note}</p>}
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

  // Sibling detection
  const [existingSiblings, setExistingSiblings] = useState([]);
  const [checkingPhone, setCheckingPhone] = useState(false);

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

  // Check for existing siblings when guardian phone changes
  async function checkForSiblings(phone) {
    if (!phone || phone.trim().length < 6) {
      setExistingSiblings([]);
      return;
    }

    setCheckingPhone(true);
    try {
      const cleanPhone = phone.trim();
      const siblingsQuery = query(
        collection(db, "students"),
        where("guardianPhone", "==", cleanPhone)
      );
      const siblingsSnapshot = await getDocs(siblingsQuery);
      const siblings = siblingsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setExistingSiblings(siblings);
    } catch (error) {
      console.error("Error checking siblings:", error);
      setExistingSiblings([]);
    }
    setCheckingPhone(false);
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const id = crypto.randomUUID();
      const cleanPhone = formData.guardianPhone.trim();

      // 1. Save the new student
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
        guardianPhone: cleanPhone,
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
        createdAt: new Date(),
      });

      // 2. Check if any existing student with the same phone has a parentUid
      let existingParentUid = null;
      if (existingSiblings.length > 0) {
        for (const sibling of existingSiblings) {
          if (sibling.parentUid) {
            existingParentUid = sibling.parentUid;
            break;
          }
        }
      }

      // 3. If a parent account exists, link the new student to it
      if (existingParentUid) {
        try {
          // Link the new student to the parent
          await updateDoc(doc(db, "students", id), {
            parentUid: existingParentUid,
            parentAccountCreated: true,
          });

          // Add new student to parent's studentIds array
          const parentRef = doc(db, "users", existingParentUid);
          const parentDoc = await getDoc(parentRef);
          if (parentDoc.exists()) {
            const parentData = parentDoc.data();
            const currentStudentIds = parentData.studentIds || [];
            if (!currentStudentIds.includes(id)) {
              await updateDoc(parentRef, {
                studentIds: [...currentStudentIds, id],
              });
            }
          }

          console.log(` New student linked to existing parent account (${existingSiblings.length} sibling(s) found)`);
        } catch (linkError) {
          console.error("Error linking new student to existing parent:", linkError);
          // Don't block the student enrollment — parent login will auto-link later
        }
      }

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
    });
    setExistingSiblings([]);
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
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-20 bg-brand-soft border border-line rounded-xl"></div>
          <div className="card p-6 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-brand-soft rounded-md w-full"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header Section */}
        <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-ink tracking-tight">
              Student Register
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Manage complete student records, index numbers, and class assignments.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary shrink-0"
          >
            <span className="text-base font-bold leading-none">+</span> Enroll New Student
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="card p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search index no., student name, or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">Class:</span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="input sm:w-auto"
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
          <div className="card p-12 text-center">
            <h3 className="text-sm font-bold text-ink">No Matching Student Records</h3>
            <p className="text-xs text-ink-muted mt-1">
              Try adjusting your search criteria or enroll a new student.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-soft border-b border-line">
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      Index No.
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      Gender
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      DOB
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      Guardian Record
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      Class Placement
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-ink-soft uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-brand-soft transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-ink">
                          {student.indexNumber || <span className="text-ink-faint font-normal">—</span>}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link 
                          to={`/admin/students/${student.id}`}
                          className="text-xs font-semibold text-ink hover:underline"
                        >
                          {getFullName(student)}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-soft capitalize">
                        {student.gender || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-soft">
                        {student.dateOfBirth || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-xs font-medium text-ink">
                            {student.guardianName || "—"}
                          </p>
                          <p className="text-[10px] text-ink-muted">
                            {student.guardianPhone || ""}
                            {student.guardianRelationship && student.guardianPhone && " · "}
                            {student.guardianRelationship || ""}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-brand-soft text-ink-soft border border-line">
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
                              ? "border-danger-line text-danger-ink bg-danger-soft hover:bg-danger-line"
                              : "border-success-line text-success-ink bg-success-soft hover:bg-success-line"
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
          <div className="fixed inset-0 bg-brand backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="card shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                <div>
                  <h3 className="text-base font-bold text-ink uppercase tracking-wider">
                    Enroll New Student
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Stage {formStep} of 3 — {
                      formStep === 1 ? "Personal Particulars" :
                      formStep === 2 ? "Academic Placement" :
                      "Guardian & Emergency Information"
                    }
                  </p>
                </div>
                <button
                  onClick={() => { resetForm(); setShowModal(false); }}
                  className="p-1 rounded text-ink-faint hover:text-ink-soft hover:bg-brand-soft transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Progress Bar */}
              <div className="grid grid-cols-3 gap-1 mb-6">
                <div className={`h-1.5 rounded-full transition-colors ${formStep >= 1 ? 'bg-brand' : 'bg-line'}`} />
                <div className={`h-1.5 rounded-full transition-colors ${formStep >= 2 ? 'bg-brand' : 'bg-line'}`} />
                <div className={`h-1.5 rounded-full transition-colors ${formStep >= 3 ? 'bg-brand' : 'bg-line'}`} />
              </div>

              {formError && (
                <div className="alert-error mb-4">
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
                          className="input"
                        />
                      </FormField>
                      <FormField label="Middle Name">
                        <input
                          type="text"
                          placeholder="Middle Name"
                          value={formData.middleName}
                          onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                          className="input"
                        />
                      </FormField>
                      <FormField label="Last Name" required>
                        <input
                          type="text"
                          required
                          placeholder="Last Name"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="input"
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Gender" required>
                        <select
                          required
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="input"
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
                          className="input"
                        />
                      </FormField>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-line">
                      <button
                        type="button"
                        onClick={() => setFormStep(2)}
                        className="btn btn-primary"
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
                          className="input"
                        />
                      </FormField>

                      <FormField label="Academic Year" required>
                        <select
                          required
                          value={formData.academicYear}
                          onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                          className="input"
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
                        className="input"
                      >
                        <option value="">Unassigned</option>
                        {sortedClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} — {cls.level}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="flex gap-3 pt-4 border-t border-line">
                      <button
                        type="button"
                        onClick={() => setFormStep(1)}
                        className="btn btn-secondary flex-1"
                      >
                        &larr; Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStep(3)}
                        className="btn btn-primary flex-1"
                      >
                        Proceed to Guardian Details &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {formStep === 3 && (
                  <div className="space-y-4">
                    <div className="notice">
                      <p className="text-xs text-ink">
                        <span className="font-bold">Parent Portal Credentials:</span>
                        <br />
                        <span className="font-semibold">Login ID:</span> <code className="font-mono bg-surface border border-line px-1 py-0.5 rounded">{formData.indexNumber || "Pending Generation"}</code>
                        <br />
                        <span className="font-semibold">Password:</span> Guardian's Phone Number <span className="text-ink-muted">(no spaces or dashes)</span>
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
                          className="input"
                        />
                      </FormField>
                      <FormField label="Telephone Number" required note="Serves as Parent Portal Password (remove spaces and dashes)">
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 0244000000"
                          value={formData.guardianPhone}
                          onChange={(e) => {
                            setFormData({ ...formData, guardianPhone: e.target.value });
                            // Debounced sibling check
                            clearTimeout(window._siblingCheckTimeout);
                            window._siblingCheckTimeout = setTimeout(() => {
                              checkForSiblings(e.target.value);
                            }, 500);
                          }}
                          className="input"
                        />
                      </FormField>
                    </div>

                    {/* Sibling Detection Banner */}
                    {checkingPhone && (
                      <div className="notice flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin text-ink-muted" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-xs text-ink-muted">Checking for existing siblings...</span>
                      </div>
                    )}

                    {!checkingPhone && existingSiblings.length > 0 && (
                      <div className="notice">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">👨‍👩‍👧</span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-ink">
                              {existingSiblings.length} existing sibling{existingSiblings.length !== 1 ? "s" : ""} found
                            </p>
                            <p className="text-[11px] text-ink-soft mt-1">
                              This guardian phone is already linked to:
                            </p>
                            <div className="mt-2 space-y-1">
                              {existingSiblings.map((sibling) => (
                                <div key={sibling.id} className="flex items-center gap-2 text-[11px] text-ink">
                                  <span className="font-mono bg-surface border border-line px-1.5 py-0.5 rounded">
                                    {sibling.indexNumber}
                                  </span>
                                  <span className="font-medium">
                                    {sibling.firstName} {sibling.lastName}
                                  </span>
                                  <span className="text-ink-muted">
                                    ({getClassName(sibling.classId)})
                                  </span>
                                  {sibling.parentAccountCreated && (
                                    <span className="text-[9px] text-success-ink font-semibold">
                                      ✓ Parent Portal Active
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {existingSiblings.some(s => s.parentUid) && (
                              <p className="text-[10px] text-success-ink mt-2 font-medium">
                                 This student will be automatically linked to the existing parent account.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Relationship to Student" required>
                        <select
                          required
                          value={formData.guardianRelationship}
                          onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                          className="input"
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
                          className="input"
                        />
                      </FormField>
                    </div>

                    <div className="border-t border-line pt-3">
                      <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
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
                            className="input"
                          />
                        </FormField>
                        <FormField label="Telephone" required>
                          <input
                            type="tel"
                            required
                            placeholder="Telephone Number"
                            value={formData.emergencyContactPhone}
                            onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                            className="input"
                          />
                        </FormField>
                        <FormField label="Relationship" required>
                          <select
                            required
                            value={formData.emergencyContactRelationship}
                            onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                            className="input"
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

                    <div className="border-t border-line pt-3">
                      <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
                        Medical & Health Particulars
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Allergies / Conditions">
                          <input
                            type="text"
                            placeholder="e.g. Penicillin, Peanut allergy"
                            value={formData.allergies}
                            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                            className="input"
                          />
                        </FormField>
                        <FormField label="Medical Remarks">
                          <input
                            type="text"
                            placeholder="Additional medical notes"
                            value={formData.medicalNotes}
                            onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                            className="input"
                          />
                        </FormField>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-line">
                      <button
                        type="button"
                        onClick={() => setFormStep(2)}
                        className="btn btn-secondary flex-1"
                      >
                        &larr; Back
                      </button>
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="btn btn-primary flex-1"
                      >
                        {formLoading ? "Enrolling Student..." : "Save Student Record"}
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
          <div className="fixed inset-0 bg-brand backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="card shadow-xl w-full max-w-md p-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-ink tracking-tight">
                  Institutional Prefix Setup
                </h3>
                <p className="text-xs text-ink-muted mt-1">
                  Specify institutional prefix to initialize automated index numbering.
                </p>
              </div>

              {initialsError && (
                <div className="alert-error mb-4">
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
                    className="input text-sm font-mono tracking-wider font-bold uppercase"
                  />
                </FormField>

                <button
                  onClick={saveSchoolInitials}
                  className="btn btn-primary w-full"
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