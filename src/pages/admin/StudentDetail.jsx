import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function StudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (studentId) {
      fetchStudent();
    }
  }, [studentId]);

  async function fetchStudent() {
    setLoading(true);
    try {
      const docRef = doc(db, "students", studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudent({ id: docSnap.id, ...data });
        setEditForm({ ...data });
      } else {
        setError("Student record not found in register.");
      }
    } catch (err) {
      console.error("Error fetching student:", err);
      setError("Failed to load student ledger entry.");
    }
    setLoading(false);
  }

  async function handleUpdateStudent(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const updateData = {
        firstName: editForm.firstName || "",
        middleName: editForm.middleName || "",
        lastName: editForm.lastName || "",
        dateOfBirth: editForm.dateOfBirth || "",
        gender: editForm.gender || "",
        admissionDate: editForm.admissionDate || "",
        academicYear: editForm.academicYear || "",
        guardianName: editForm.guardianName || "",
        guardianPhone: editForm.guardianPhone || "",
        guardianRelationship: editForm.guardianRelationship || "",
        guardianEmail: editForm.guardianEmail || "",
        emergencyContactName: editForm.emergencyContactName || "",
        emergencyContactPhone: editForm.emergencyContactPhone || "",
        emergencyContactRelationship: editForm.emergencyContactRelationship || "",
        allergies: editForm.allergies || "",
        medicalNotes: editForm.medicalNotes || "",
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, "students", studentId), updateData);
      setStudent({ id: studentId, ...editForm });
      setSuccessMessage("Student details updated successfully.");
      setEditing(false);
      setTimeout(() => setSuccessMessage(""), 3500);
    } catch (err) {
      console.error("Error updating student:", err);
      setError("Failed to update student ledger entry.");
    }
    setSaving(false);
  }

  function handleEditChange(field, value) {
    setEditForm(prev => ({ ...prev, [field]: value }));
  }

  function getFullName(student) {
    const first = student?.firstName || "";
    const middle = student?.middleName ? ` ${student.middleName}` : "";
    const last = student?.lastName || "";
    return `${first}${middle} ${last}`.trim() || "Unknown Record";
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const statusColors = {
    active: "bg-emerald-50 text-emerald-900 border-emerald-300",
    inactive: "bg-rose-50 text-rose-900 border-rose-300",
    transferred: "bg-sky-50 text-sky-900 border-sky-300",
    graduated: "bg-amber-50 text-amber-900 border-amber-300",
  };

  const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-[11px] font-serif font-semibold border ${statusColors[status] || statusColors.active}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70"></span>
      {status ? status.toUpperCase() : "ACTIVE"}
    </span>
  );

  const FieldBox = ({ label, value, editValue, onEditChange, field, editMode, type = "text", fullWidth = false }) => (
    <div className={`flex flex-col gap-1.5 p-3 rounded-sm bg-stone-50/50 border border-stone-200/60 ${fullWidth ? "col-span-full" : ""}`}>
      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
        {label}
      </span>
      {editMode ? (
        type === "select" ? (
          <select
            value={editValue || ""}
            onChange={(e) => onEditChange(field, e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-sm px-2.5 py-1.5 text-xs font-serif text-slate-900 focus:outline-none focus:border-slate-800"
          >
            <option value="">Select Option</option>
            {field === "gender" ? (
              <>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </>
            ) : (
              <>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Uncle">Uncle</option>
                <option value="Aunt">Aunt</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Guardian">Guardian</option>
                <option value="Other">Other</option>
              </>
            )}
          </select>
        ) : type === "date" ? (
          <input
            type="date"
            value={editValue || ""}
            onChange={(e) => onEditChange(field, e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-sm px-2.5 py-1.5 text-xs font-serif text-slate-900 focus:outline-none focus:border-slate-800"
          />
        ) : (
          <input
            type={type}
            value={editValue || ""}
            onChange={(e) => onEditChange(field, e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-sm px-2.5 py-1.5 text-xs font-serif text-slate-900 focus:outline-none focus:border-slate-800"
            placeholder={label}
          />
        )
      ) : (
        <span className="text-xs font-serif font-semibold text-slate-900 truncate">
          {value || "—"}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-20 bg-stone-100 border border-stone-200 rounded-sm"></div>
          <div className="bg-white rounded-sm border border-stone-200 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-stone-100 rounded-sm w-full"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-sm border border-stone-300 p-12 text-center shadow-2xs max-w-2xl mx-auto my-12">
          <div className="w-12 h-12 rounded-sm bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center mx-auto mb-4 font-serif text-xl font-bold">
            !
          </div>
          <h3 className="font-serif text-base font-bold text-slate-900">{error}</h3>
          <button
            onClick={() => navigate("/admin/students")}
            className="mt-5 px-5 py-2 bg-slate-900 text-amber-300 text-xs font-serif font-semibold rounded-sm hover:bg-slate-800 transition-colors"
          >
            ← Return to Student Register
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (!student) return null;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Header Banner */}
        <div className="bg-white border border-stone-300/80 rounded-sm p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-slate-900"></div>
          
          <div className="flex items-center gap-4 pl-2">
            <button
              onClick={() => navigate("/admin/students")}
              className="p-2 border border-stone-200 rounded-sm hover:border-slate-800 hover:bg-slate-900 hover:text-white transition-all text-xs font-serif"
            >
              ← Back
            </button>
            <div>
              <span className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
                Student Folio
              </span>
              <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {getFullName(student)}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-serif text-stone-500">
                  Index Number: <span className="font-mono text-slate-900 font-bold">{student.indexNumber || "—"}</span>
                </span>
                <StatusBadge status={student.status} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-slate-900 text-amber-300 text-xs font-serif font-semibold rounded-sm hover:bg-slate-800 transition-colors shadow-2xs"
              >
                Edit Folio
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditing(false);
                  setEditForm({ ...student });
                  setError("");
                }}
                className="px-4 py-2 border border-stone-300 text-stone-700 text-xs font-serif font-semibold rounded-sm hover:bg-stone-100 transition-colors"
              >
                Cancel Edits
              </button>
            )}
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 font-serif text-xs px-4 py-3 rounded-sm flex items-center gap-2">
            <span className="font-bold">✓</span> {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-300 text-rose-950 font-serif text-xs px-4 py-3 rounded-sm flex items-center gap-2">
            <span className="font-bold">⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleUpdateStudent}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left 2 Columns: Main Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Personal Particulars */}
              <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-stone-200 bg-stone-50/60">
                  <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
                    Personal Particulars
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldBox
                    label="First Name"
                    value={student.firstName}
                    editValue={editForm.firstName}
                    onEditChange={handleEditChange}
                    field="firstName"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Middle Name"
                    value={student.middleName}
                    editValue={editForm.middleName}
                    onEditChange={handleEditChange}
                    field="middleName"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Last Name"
                    value={student.lastName}
                    editValue={editForm.lastName}
                    onEditChange={handleEditChange}
                    field="lastName"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Gender"
                    value={student.gender}
                    editValue={editForm.gender}
                    onEditChange={handleEditChange}
                    field="gender"
                    editMode={editing}
                    type="select"
                  />
                  <FieldBox
                    label="Date of Birth"
                    value={formatDate(student.dateOfBirth)}
                    editValue={editForm.dateOfBirth}
                    onEditChange={handleEditChange}
                    field="dateOfBirth"
                    editMode={editing}
                    type="date"
                  />
                </div>
              </div>

              {/* Academic Placement */}
              <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-stone-200 bg-stone-50/60">
                  <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
                    Academic Placement
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldBox
                    label="Admission Date"
                    value={formatDate(student.admissionDate)}
                    editValue={editForm.admissionDate}
                    onEditChange={handleEditChange}
                    field="admissionDate"
                    editMode={editing}
                    type="date"
                  />
                  <FieldBox
                    label="Academic Year"
                    value={student.academicYear}
                    editValue={editForm.academicYear}
                    onEditChange={handleEditChange}
                    field="academicYear"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Assigned Class"
                    value={student.classId || "Unassigned"}
                    editValue={editForm.classId || ""}
                    onEditChange={handleEditChange}
                    field="classId"
                    editMode={editing}
                    type="select"
                  />
                </div>
              </div>

              {/* Guardian Particulars */}
              <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-stone-200 bg-stone-50/60">
                  <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
                    Guardian Particulars
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldBox
                    label="Guardian Name"
                    value={student.guardianName}
                    editValue={editForm.guardianName}
                    onEditChange={handleEditChange}
                    field="guardianName"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Telephone"
                    value={student.guardianPhone}
                    editValue={editForm.guardianPhone}
                    onEditChange={handleEditChange}
                    field="guardianPhone"
                    editMode={editing}
                    type="tel"
                  />
                  <FieldBox
                    label="Relationship"
                    value={student.guardianRelationship}
                    editValue={editForm.guardianRelationship}
                    onEditChange={handleEditChange}
                    field="guardianRelationship"
                    editMode={editing}
                    type="select"
                  />
                  <FieldBox
                    label="Guardian Email"
                    value={student.guardianEmail}
                    editValue={editForm.guardianEmail}
                    onEditChange={handleEditChange}
                    field="guardianEmail"
                    editMode={editing}
                    type="email"
                    fullWidth={true}
                  />
                </div>
              </div>

            </div>

            {/* Right Column: Status & Side Details */}
            <div className="space-y-6">

              {/* Record Metadata */}
              <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-stone-200 bg-stone-50/60">
                  <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
                    Record Meta
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between py-1 border-b border-stone-100">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Status</span>
                    <StatusBadge status={student.status} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-stone-100">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Parent Access</span>
                    <span className={`text-xs font-serif font-bold ${student.parentAccountCreated ? 'text-emerald-800' : 'text-stone-400'}`}>
                      {student.parentAccountCreated ? '✓ Active' : 'Not Created'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-stone-100">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Entry Date</span>
                    <span className="text-xs font-serif text-slate-900">{student.createdAt?.toDate ? formatDate(student.createdAt.toDate()) : "—"}</span>
                  </div>

                  {editing && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-serif text-xs font-semibold rounded-sm transition-colors disabled:opacity-50"
                    >
                      {saving ? "Updating..." : "Save Folio Changes"}
                    </button>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-stone-200 bg-stone-50/60">
                  <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
                    Emergency Contact
                  </h3>
                </div>
                <div className="p-6 space-y-3">
                  <FieldBox
                    label="Contact Name"
                    value={student.emergencyContactName}
                    editValue={editForm.emergencyContactName}
                    onEditChange={handleEditChange}
                    field="emergencyContactName"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Telephone"
                    value={student.emergencyContactPhone}
                    editValue={editForm.emergencyContactPhone}
                    onEditChange={handleEditChange}
                    field="emergencyContactPhone"
                    editMode={editing}
                    type="tel"
                  />
                  <FieldBox
                    label="Relationship"
                    value={student.emergencyContactRelationship}
                    editValue={editForm.emergencyContactRelationship}
                    onEditChange={handleEditChange}
                    field="emergencyContactRelationship"
                    editMode={editing}
                    type="select"
                  />
                </div>
              </div>

              {/* Medical Dossier */}
              <div className="bg-white border border-stone-300/80 rounded-sm shadow-2xs overflow-hidden">
                <div className="px-6 py-3.5 border-b border-stone-200 bg-stone-50/60">
                  <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
                    Medical & Health
                  </h3>
                </div>
                <div className="p-6 space-y-3">
                  <FieldBox
                    label="Allergies"
                    value={student.allergies}
                    editValue={editForm.allergies}
                    onEditChange={handleEditChange}
                    field="allergies"
                    editMode={editing}
                  />
                  <FieldBox
                    label="Medical Remarks"
                    value={student.medicalNotes}
                    editValue={editForm.medicalNotes}
                    onEditChange={handleEditChange}
                    field="medicalNotes"
                    editMode={editing}
                  />
                </div>
              </div>

            </div>

          </div>
        </form>

        {/* Quick Actions */}
        <div className="bg-white border border-stone-300/80 rounded-sm p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-200">
            <h3 className="font-serif text-xs font-bold text-slate-900 uppercase tracking-widest">
              Administrative Folio Commands
            </h3>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to ${student.status === "active" ? "deactivate" : "activate"} ${getFullName(student)}'s record?`)) {
                  const newStatus = student.status === "active" ? "inactive" : "active";
                  updateDoc(doc(db, "students", studentId), { status: newStatus })
                    .then(() => {
                      setStudent({ ...student, status: newStatus });
                      setEditForm({ ...editForm, status: newStatus });
                      setSuccessMessage(`Folio status set to ${newStatus.toUpperCase()}.`);
                      setTimeout(() => setSuccessMessage(""), 3500);
                    })
                    .catch(() => setError("Failed to alter student status."));
                }
              }}
              className={`px-4 py-2 text-xs font-serif font-semibold rounded-sm transition-colors border ${
                student.status === "active"
                  ? "border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                  : "border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100"
              }`}
            >
              {student.status === "active" ? "Deactivate Student Folio" : "Activate Student Folio"}
            </button>

            <button
              onClick={() => {
               if (confirm(`Issue parent portal credentials for ${getFullName(student)}?\n\nLogin ID: ${student.indexNumber}\nPassword: ${student.guardianPhone} (no spaces/dashes)`)) {
                  setSuccessMessage(`Parent account ready! Login ID: ${student.indexNumber} | Password: Guardian's Phone Number`);
                  setTimeout(() => setSuccessMessage(""), 3500);
                }
              }}
              className="px-4 py-2 border border-stone-300 text-slate-900 text-xs font-serif font-semibold rounded-sm hover:bg-stone-100 transition-colors disabled:opacity-50"
              disabled={student.parentAccountCreated}
            >
              {student.parentAccountCreated ? "Parent Credentials Issued" : "Issue Parent Credentials"}
            </button>

            <button
              onClick={() => {
                if (confirm(`Archive ${getFullName(student)}? Record deletion requires headmaster authorization.`)) {
                  setError("Direct record deletion disabled. Please set status to 'Inactive'.");
                }
              }}
              className="px-4 py-2 border border-rose-200 text-rose-900 bg-rose-50 text-xs font-serif font-semibold rounded-sm hover:bg-rose-100 transition-colors"
            >
              Archive Folio Record
            </button>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}