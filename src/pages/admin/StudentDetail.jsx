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
    active: "bg-success-soft text-success-ink border-success-line",
    inactive: "bg-danger-soft text-danger-ink border-danger-line",
    transferred: "bg-brand-soft text-ink-soft border-line",
    graduated: "bg-surface text-ink border-line-strong",
  };

  const StatusBadge = ({ status }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusColors[status] || statusColors.active}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70"></span>
      {status ? status.toUpperCase() : "ACTIVE"}
    </span>
  );

  const FieldBox = ({ label, value, editValue, onEditChange, field, editMode, type = "text", fullWidth = false }) => (
    <div className={`flex flex-col gap-1.5 p-3 rounded-lg bg-brand-soft border border-line ${fullWidth ? "col-span-full" : ""}`}>
      <span className="eyebrow">
        {label}
      </span>
      {editMode ? (
        type === "select" ? (
          <select
            value={editValue || ""}
            onChange={(e) => onEditChange(field, e.target.value)}
            className="input py-1.5 px-2.5"
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
            className="input py-1.5 px-2.5"
          />
        ) : (
          <input
            type={type}
            value={editValue || ""}
            onChange={(e) => onEditChange(field, e.target.value)}
            className="input py-1.5 px-2.5"
            placeholder={label}
          />
        )
      ) : (
        <span className="text-xs font-semibold text-ink truncate">
          {value || "—"}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-20 bg-brand-soft border border-line rounded-xl"></div>
          <div className="card p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-brand-soft rounded-lg w-full"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="card p-12 text-center max-w-2xl mx-auto my-12">
          <div className="w-12 h-12 rounded-lg bg-danger-soft border border-danger-line text-danger-ink flex items-center justify-center mx-auto mb-4 text-xl font-bold">
            !
          </div>
          <h3 className="text-base font-bold text-ink">{error}</h3>
          <button
            onClick={() => navigate("/admin/students")}
            className="btn btn-primary mt-5"
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
        <div className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-brand"></div>
          
          <div className="flex items-center gap-4 pl-2">
            <button
              onClick={() => navigate("/admin/students")}
              className="btn btn-secondary px-3 py-2"
            >
              ← Back
            </button>
            <div>
              <span className="eyebrow">
                Student Folio
              </span>
              <h1 className="text-2xl font-bold text-ink tracking-tight mt-0.5">
                {getFullName(student)}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-ink-muted">
                  Index Number: <span className="font-mono text-ink font-bold">{student.indexNumber || "—"}</span>
                </span>
                <StatusBadge status={student.status} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="btn btn-primary"
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
                className="btn btn-secondary"
              >
                Cancel Edits
              </button>
            )}
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="bg-success-soft border border-success-line text-success-ink text-xs px-4 py-3 rounded-lg flex items-center gap-2">
            <span className="font-bold">✓</span> {successMessage}
          </div>
        )}
        {error && (
          <div className="alert-error flex items-center gap-2">
            <span className="font-bold">⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleUpdateStudent}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left 2 Columns: Main Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Personal Particulars */}
              <div className="card overflow-hidden">
                <div className="px-6 py-3.5 border-b border-line bg-brand-soft">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
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
              <div className="card overflow-hidden">
                <div className="px-6 py-3.5 border-b border-line bg-brand-soft">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
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
              <div className="card overflow-hidden">
                <div className="px-6 py-3.5 border-b border-line bg-brand-soft">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
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
              <div className="card overflow-hidden">
                <div className="px-6 py-3.5 border-b border-line bg-brand-soft">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
                    Record Meta
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between py-1 border-b border-line">
                    <span className="eyebrow">Status</span>
                    <StatusBadge status={student.status} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line">
                    <span className="eyebrow">Parent Access</span>
                    <span className={`text-xs font-bold ${student.parentAccountCreated ? 'text-success-ink' : 'text-ink-faint'}`}>
                      {student.parentAccountCreated ? '✓ Active' : 'Not Created'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-line">
                    <span className="eyebrow">Entry Date</span>
                    <span className="text-xs text-ink">{student.createdAt?.toDate ? formatDate(student.createdAt.toDate()) : "—"}</span>
                  </div>

                  {editing && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary w-full mt-2"
                    >
                      {saving ? "Updating..." : "Save Folio Changes"}
                    </button>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="card overflow-hidden">
                <div className="px-6 py-3.5 border-b border-line bg-brand-soft">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
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
              <div className="card overflow-hidden">
                <div className="px-6 py-3.5 border-b border-line bg-brand-soft">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
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
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-line">
            <h3 className="text-xs font-bold text-ink uppercase tracking-widest">
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
              className={`btn border ${
                student.status === "active"
                  ? "border-danger-line text-danger-ink bg-danger-soft hover:bg-danger-line"
                  : "border-success-line text-success-ink bg-success-soft hover:bg-success-line"
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
              className="btn btn-secondary"
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
              className="btn border border-danger-line text-danger-ink bg-danger-soft hover:bg-danger-line"
            >
              Archive Folio Record
            </button>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}