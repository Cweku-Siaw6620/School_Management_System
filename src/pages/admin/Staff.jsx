import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, updateDoc, setDoc
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

const secondaryApp = getApps().some((app) => app.name === "staffCreation")
  ? getApp("staffCreation")
  : initializeApp({
      apiKey: "AIzaSyDgxoH7IFqup0_YFK67FGC2Rv_320WTWb4",
      authDomain: "school-ms-aab5a.firebaseapp.com",
      projectId: "school-ms-aab5a",
      storageBucket: "school-ms-aab5a.firebasestorage.app",
      messagingSenderId: "237378644146",
      appId: "1:237378644146:web:84e940f8ec094360a341ab",
      measurementId: "G-801Y3QTRPF"
    }, "staffCreation");

const staffAuth = getAuth(secondaryApp);

const POSITIONS = [
  "Headmaster",
  "Assistant Headmaster",
  "Teacher",
  "Accountant",
  "Cook",
  "Cleaner",
  "Security",
  "Other",
];

const ACADEMIC_POSITIONS = [
  "Headmaster",
  "Assistant Headmaster",
  "Teacher",
];

const POSITION_PREFIXES = {
  "Headmaster": "HM",
  "Assistant Headmaster": "AH",
  "Teacher": "T",
  "Accountant": "ACC",
  "Cook": "CK",
  "Cleaner": "CL",
  "Security": "SEC",
  "Other": "OTH",
};

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    residentialAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    position: "",
    employmentType: "full-time",
    dateEmployed: "",
    department: "",
    subjects: [],
    highestQualification: "",
    previousExperience: "",
    staffId: "",
    password: "",
  });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formStep, setFormStep] = useState(1);

  const isAcademic = ACADEMIC_POSITIONS.includes(formData.position);
  const isHeadmaster = formData.position === "Headmaster";

  useEffect(() => {
    fetchStaff();
    fetchSubjects();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "staff"));
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setStaff(list);
    setLoading(false);
  }

  async function fetchSubjects() {
    try {
      const snapshot = await getDocs(collection(db, "classSubjects"));
      const subjectMap = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!subjectMap[data.name]) {
          subjectMap[data.name] = data.name;
        }
      });
      const subjectList = Object.keys(subjectMap).map(name => ({ name }));
      setSubjects(subjectList);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  }

  function generateStaffId(position) {
    const prefix = POSITION_PREFIXES[position] || "STAFF";
    const existingIds = staff
      .filter(s => s.staffId && s.staffId.startsWith(prefix))
      .map(s => {
        const num = parseInt(s.staffId.replace(prefix, ""), 10);
        return isNaN(num) ? 0 : num;
      });
    
    let nextNumber = 1;
    if (existingIds.length > 0) {
      const max = Math.max(...existingIds);
      const usedNumbers = new Set(existingIds);
      for (let i = 1; i <= max + 1; i++) {
        if (!usedNumbers.has(i)) {
          nextNumber = i;
          break;
        }
      }
    }
    
    let randomNum;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      randomNum = Math.floor(Math.random() * 900) + 100;
      attempts++;
    } while (
      staff.some(s => s.staffId === `${prefix}${randomNum}`) && 
      attempts < maxAttempts
    );
    
    if (attempts >= maxAttempts) {
      randomNum = nextNumber;
    }
    
    return `${prefix}${String(randomNum).padStart(3, '0')}`;
  }

  useEffect(() => {
    if (formData.position && !formData.staffId) {
      setFormData(prev => ({
        ...prev,
        staffId: generateStaffId(formData.position)
      }));
    }
  }, [formData.position]);

  async function handleAddStaff(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      let uid;

      if (isAcademic) {
        if (!isHeadmaster && selectedSubjects.length === 0) {
          setFormError("Please select at least one subject this teacher teaches");
          setFormLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          staffAuth, formData.email, formData.password
        );
        uid = userCredential.user.uid;

        const role = formData.position === "Headmaster" ? "headmaster" : "teacher";

        await setDoc(doc(db, "users", uid), {
          role,
          email: formData.email,
          staffId: formData.staffId,
        });

        await signOut(staffAuth);
      } else {
        uid = crypto.randomUUID();
      }

      await setDoc(doc(db, "staff", uid), {
        firstName: formData.firstName,
        middleName: formData.middleName || "",
        lastName: formData.lastName,
        gender: formData.gender || "",
        dateOfBirth: formData.dateOfBirth || "",
        phone: formData.phone || "",
        email: formData.email || "",
        residentialAddress: formData.residentialAddress || "",
        emergencyContact: {
          name: formData.emergencyContactName || "",
          phone: formData.emergencyContactPhone || "",
          relationship: formData.emergencyContactRelationship || "",
        },
        staffId: formData.staffId,
        position: formData.position,
        employmentType: formData.employmentType || "full-time",
        dateEmployed: formData.dateEmployed || "",
        department: formData.department || "",
        subjects: isAcademic ? selectedSubjects : [],
        highestQualification: formData.highestQualification || "",
        previousExperience: formData.previousExperience || "",
        hasLogin: isAcademic,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      resetForm();
      setShowModal(false);
      fetchStaff();
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
      gender: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      residentialAddress: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      position: "",
      employmentType: "full-time",
      dateEmployed: "",
      department: "",
      subjects: [],
      highestQualification: "",
      previousExperience: "",
      staffId: "",
      password: "",
    });
    setSelectedSubjects([]);
    setFormStep(1);
    setFormError("");
  }

  function getFullName(member) {
    const first = member.firstName || "";
    const middle = member.middleName ? ` ${member.middleName}` : "";
    const last = member.lastName || "";
    return `${first}${middle} ${last}`.trim() || "Unknown";
  }

  async function toggleStatus(member) {
    const newStatus = member.status === "active" ? "inactive" : "active";
    await updateDoc(doc(db, "staff", member.id), { status: newStatus });
    fetchStaff();
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse p-2">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <div className="h-7 bg-line rounded w-48"></div>
              <div className="h-4 bg-brand-soft rounded w-64"></div>
            </div>
            <div className="h-10 bg-line rounded-lg w-32"></div>
          </div>
          <div className="card overflow-hidden">
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-line rounded w-1/6"></div>
                  <div className="h-4 bg-line rounded w-1/5"></div>
                  <div className="h-4 bg-line rounded w-1/6"></div>
                  <div className="h-4 bg-line rounded w-1/5"></div>
                  <div className="h-6 bg-line rounded-full w-16"></div>
                  <div className="h-8 bg-line rounded-lg w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const inputClass = "input";

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="label">First Name <span className="text-danger">*</span></label>
          <input
            type="text"
            required
            placeholder="First name"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label">Middle Name</label>
          <input
            type="text"
            placeholder="Middle name"
            value={formData.middleName}
            onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label">Last Name <span className="text-danger">*</span></label>
          <input
            type="text"
            required
            placeholder="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="label">Gender <span className="text-danger">*</span></label>
          <select
            required
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className={inputClass}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label">Date of Birth</label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="label">Phone Number</label>
          <input
            type="tel"
            placeholder="0244-XXX-XXX"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="label">Email Address</label>
          <input
            type="email"
            placeholder="email@school.edu"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label">Residential Address</label>
        <input
          type="text"
          placeholder="Full residential address"
          value={formData.residentialAddress}
          onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="border-t border-line pt-4 mt-2">
        <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-4">
          Emergency Contact Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="label">Contact Name</label>
            <input
              type="text"
              placeholder="Full name"
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Phone Number</label>
            <input
              type="tel"
              placeholder="0244-XXX-XXX"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Relationship</label>
            <select
              value={formData.emergencyContactRelationship}
              onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
              className={inputClass}
            >
              <option value="">Select relationship</option>
              <option value="Spouse">Spouse</option>
              <option value="Parent">Parent</option>
              <option value="Sibling">Sibling</option>
              <option value="Child">Child</option>
              <option value="Friend">Friend</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-line">
        <button
          type="button"
          onClick={() => setFormStep(2)}
          className="btn btn-primary"
        >
          <span>Employment Info</span>
          <span className="text-sm">→</span>
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const staffIdPreview = formData.staffId || "Generated on position selection";

    return (
      <div className="space-y-5">
        <div className="notice flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Assigned Staff ID</span>
            <span className="text-sm font-mono font-bold text-ink">{staffIdPreview}</span>
          </div>
          <span className="text-[10px] font-semibold text-ink-muted bg-surface px-2.5 py-1 rounded border border-line">Auto-Generated</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="label">Position <span className="text-danger">*</span></label>
            <select
              required
              value={formData.position}
              onChange={(e) => {
                const position = e.target.value;
                setFormData({ 
                  ...formData, 
                  position,
                  staffId: position ? generateStaffId(position) : ""
                });
                setFormError("");
              }}
              className={inputClass}
            >
              <option value="">Select position</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Employment Type <span className="text-danger">*</span></label>
            <select
              required
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              className={inputClass}
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="label">Date Employed</label>
            <input
              type="date"
              value={formData.dateEmployed}
              onChange={(e) => setFormData({ ...formData, dateEmployed: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Department/Area</label>
            <input
              type="text"
              placeholder="e.g., Primary Department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {isAcademic && (
          <div className="flex flex-col gap-1.5">
            <label className="label">
              Subjects Qualified to Teach {!isHeadmaster && <span className="text-danger">*</span>}
            </label>
            <div className="border border-line rounded-lg p-3 max-h-36 overflow-y-auto bg-brand-soft">
              {subjects.length === 0 ? (
                <p className="text-xs text-ink-muted text-center py-3">
                  No subjects available.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {subjects.map((subject) => (
                    <label key={subject.name} className="flex items-center gap-2 text-xs font-medium text-ink-soft cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(subject.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubjects([...selectedSubjects, subject.name]);
                          } else {
                            setSelectedSubjects(selectedSubjects.filter(s => s !== subject.name));
                          }
                        }}
                        className="w-4 h-4 rounded accent-brand"
                      />
                      {subject.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="label">Highest Qualification</label>
            <select
              value={formData.highestQualification}
              onChange={(e) => setFormData({ ...formData, highestQualification: e.target.value })}
              className={inputClass}
            >
              <option value="">Select qualification</option>
              <option value="PhD">PhD</option>
              <option value="Master's">Master's Degree</option>
              <option value="Bachelor's">Bachelor's Degree</option>
              <option value="Diploma">Diploma</option>
              <option value="Certificate">Certificate</option>
              <option value="SHS">SHS / Secondary</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label">Previous Experience</label>
            <input
              type="text"
              placeholder="e.g., 5 years experience"
              value={formData.previousExperience}
              onChange={(e) => setFormData({ ...formData, previousExperience: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {isAcademic && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-line">
            <div className="flex flex-col gap-1.5">
              <label className="label">Account Email <span className="text-danger">*</span></label>
              <input
                type="email"
                required
                placeholder="email@school.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">System Password <span className="text-danger">*</span></label>
              <input
                type="password"
                required
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-line">
          <button
            type="button"
            onClick={() => setFormStep(1)}
            className="btn btn-secondary flex-1"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={formLoading}
            className="btn btn-primary flex-1"
          >
            {formLoading ? "Creating Staff..." : "Save Staff Member"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="text-ink">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink tracking-tight">
                Staff Directory
              </h1>
              <p className="text-xs text-ink-muted mt-1 font-medium">
                Manage academic and non-academic staff credentials & roles
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary"
            >
              <span className="text-base leading-none">+</span>
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        {staff.length === 0 ? (
          <div className="card p-12 text-center">
            <h3 className="text-sm font-semibold text-ink">No Staff Members Found</h3>
            <p className="text-xs text-ink-faint mt-1">
              Click the button above to register a new staff member.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-soft border-b border-line">
                  <tr>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Staff ID
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Assigned Subjects
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Login
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3.5 font-bold text-ink-muted uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-brand-soft transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-ink">
                        {member.staffId || <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-ink">
                            {getFullName(member)}
                          </p>
                          {member.department && (
                            <p className="text-[11px] text-ink-faint font-normal">{member.department}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-ink-soft">
                        {member.position}
                      </td>
                      <td className="px-5 py-4">
                        {member.subjects && member.subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {member.subjects.slice(0, 2).map((subject, index) => (
                              <span key={index} className="inline-flex px-2 py-0.5 bg-brand-soft text-ink-soft font-medium text-[11px] rounded">
                                {subject}
                              </span>
                            ))}
                            {member.subjects.length > 2 && (
                              <span className="text-[11px] text-ink-faint self-center">+{member.subjects.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-ink-soft space-y-0.5">
                        <p>{member.email || "—"}</p>
                        <p className="text-[11px] text-ink-faint">{member.phone || ""}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          member.hasLogin
                            ? "bg-brand-soft text-ink border border-line"
                            : "bg-surface text-ink-faint border border-line"
                        }`}>
                          {member.hasLogin ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          member.status === "active"
                            ? "bg-success-soft text-success-ink border border-success-line"
                            : "bg-danger-soft text-danger-ink border border-danger-line"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${member.status === "active" ? "bg-success" : "bg-danger"}`}></span>
                          {member.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => toggleStatus(member)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                            member.status === "active"
                              ? "text-danger hover:bg-danger-soft"
                              : "text-success hover:bg-success-soft"
                          }`}
                        >
                          {member.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-brand backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-ink">
                    Add New Staff Member
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Step {formStep} of 2 — {formStep === 1 ? "Personal Details" : "Employment & System Role"}
                  </p>
                </div>
                <button
                  onClick={() => { resetForm(); setShowModal(false); }}
                  className="text-ink-faint hover:text-ink-soft transition-colors text-xl leading-none p-1 rounded-lg hover:bg-brand-soft"
                >
                  ✕
                </button>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`h-1 flex-1 rounded-full transition-all ${formStep >= 1 ? 'bg-brand' : 'bg-line'}`} />
                <div className={`h-1 flex-1 rounded-full transition-all ${formStep >= 2 ? 'bg-brand' : 'bg-line'}`} />
              </div>

              {formError && (
                <div className="alert-error mb-5">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddStaff}>
                {formStep === 1 && renderStep1()}
                {formStep === 2 && renderStep2()}
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}