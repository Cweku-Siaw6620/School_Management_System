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
        <div className="font-['Montserrat',sans-serif] animate-pulse p-2">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <div className="h-7 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-100 rounded w-64"></div>
            </div>
            <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/5"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/5"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-8 bg-gray-200 rounded-lg w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all";

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">First Name <span className="text-red-500">*</span></label>
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
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Middle Name</label>
          <input
            type="text"
            placeholder="Middle name"
            value={formData.middleName}
            onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Last Name <span className="text-red-500">*</span></label>
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
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Gender <span className="text-red-500">*</span></label>
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
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Date of Birth</label>
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
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Phone Number</label>
          <input
            type="tel"
            placeholder="0244-XXX-XXX"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Email Address</label>
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
        <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Residential Address</label>
        <input
          type="text"
          placeholder="Full residential address"
          value={formData.residentialAddress}
          onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="border-t border-gray-100 pt-4 mt-2">
        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
          Emergency Contact Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Contact Name</label>
            <input
              type="text"
              placeholder="Full name"
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Phone Number</label>
            <input
              type="tel"
              placeholder="0244-XXX-XXX"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Relationship</label>
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

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setFormStep(2)}
          className="px-5 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
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
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Assigned Staff ID</span>
            <span className="text-sm font-mono font-bold text-gray-900">{staffIdPreview}</span>
          </div>
          <span className="text-[10px] font-semibold text-gray-500 bg-white px-2.5 py-1 rounded border border-gray-200">Auto-Generated</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Position <span className="text-red-500">*</span></label>
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
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Employment Type <span className="text-red-500">*</span></label>
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
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Date Employed</label>
            <input
              type="date"
              value={formData.dateEmployed}
              onChange={(e) => setFormData({ ...formData, dateEmployed: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Department/Area</label>
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
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              Subjects Qualified to Teach {!isHeadmaster && <span className="text-red-500">*</span>}
            </label>
            <div className="border border-gray-200 rounded-lg p-3 max-h-36 overflow-y-auto bg-gray-50/50">
              {subjects.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-3">
                  No subjects available.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {subjects.map((subject) => (
                    <label key={subject.name} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
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
                        className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900 accent-gray-900"
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
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Highest Qualification</label>
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
            <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Previous Experience</label>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Account Email <span className="text-red-500">*</span></label>
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
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">System Password <span className="text-red-500">*</span></label>
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

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setFormStep(1)}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={formLoading}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
          >
            {formLoading ? "Creating Staff..." : "Save Staff Member"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="font-['Montserrat',sans-serif] text-gray-800">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Staff Directory
              </h1>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Manage academic and non-academic staff credentials & roles
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors shadow-sm gap-2"
            >
              <span className="text-base leading-none">+</span>
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        {staff.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/80 p-12 text-center shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800">No Staff Members Found</h3>
            <p className="text-xs text-gray-400 mt-1">
              Click the button above to register a new staff member.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-200/80">
                  <tr>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Staff ID
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Assigned Subjects
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Login
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-gray-900">
                        {member.staffId || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {getFullName(member)}
                          </p>
                          {member.department && (
                            <p className="text-[11px] text-gray-400 font-normal">{member.department}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-700">
                        {member.position}
                      </td>
                      <td className="px-5 py-4">
                        {member.subjects && member.subjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {member.subjects.slice(0, 2).map((subject, index) => (
                              <span key={index} className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-700 font-medium text-[11px] rounded">
                                {subject}
                              </span>
                            ))}
                            {member.subjects.length > 2 && (
                              <span className="text-[11px] text-gray-400 self-center">+{member.subjects.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600 space-y-0.5">
                        <p>{member.email || "—"}</p>
                        <p className="text-[11px] text-gray-400">{member.phone || ""}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          member.hasLogin
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-gray-50 text-gray-400 border border-gray-100"
                        }`}>
                          {member.hasLogin ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${member.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                          {member.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => toggleStatus(member)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                            member.status === "active"
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-emerald-600 hover:bg-emerald-50"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto border border-gray-100">
              
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Add New Staff Member
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Step {formStep} of 2 — {formStep === 1 ? "Personal Details" : "Employment & System Role"}
                  </p>
                </div>
                <button
                  onClick={() => { resetForm(); setShowModal(false); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none p-1 rounded-lg hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              {/* Progress Bar */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`h-1 flex-1 rounded-full transition-all ${formStep >= 1 ? 'bg-gray-900' : 'bg-gray-200'}`} />
                <div className={`h-1 flex-1 rounded-full transition-all ${formStep >= 2 ? 'bg-gray-900' : 'bg-gray-200'}`} />
              </div>

              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg mb-5">
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