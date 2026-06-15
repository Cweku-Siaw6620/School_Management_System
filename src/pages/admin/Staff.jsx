import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, updateDoc, setDoc
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

const POSITIONS = [
  "Headteacher",
  "Assistant Headteacher",
  "Class Teacher",
  "Subject Teacher",
  "Accountant",
  "Cook",
  "Cleaner",
  "Security",
  "Other",
];

const ACADEMIC_POSITIONS = [
  "Headteacher",
  "Assistant Headteacher",
  "Class Teacher",
  "Subject Teacher",
];

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "",
    password: "", phone: "", position: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const isAcademic = ACADEMIC_POSITIONS.includes(formData.position);

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "staff"));
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setStaff(list);
    setLoading(false);
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      let uid;

      if (isAcademic) {
        // Create Firebase Auth account for academic staff
        const userCredential = await createUserWithEmailAndPassword(
          auth, formData.email, formData.password
        );
        uid = userCredential.user.uid;

        // Determine system role
        const role = formData.position === "Headteacher" ? "headteacher" : "teacher";

        // Save to users collection
        await setDoc(doc(db, "users", uid), {
          role,
          email: formData.email,
        });
      } else {
        // Non-academic staff — just generate a random ID
        uid = crypto.randomUUID();
      }

      // Save to staff collection
      await setDoc(doc(db, "staff", uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || "",
        phone: formData.phone || "",
        position: formData.position,
        hasLogin: isAcademic,
        status: "active",
        createdAt: new Date(),
      });

      setFormData({
        firstName: "", lastName: "", email: "",
        password: "", phone: "", position: "",
      });
      setShowModal(false);
      fetchStaff();
    } catch (err) {
      setFormError(err.message);
    }

    setFormLoading(false);
  }

  async function toggleStatus(member) {
    const newStatus = member.status === "active" ? "inactive" : "active";
    await updateDoc(doc(db, "staff", member.id), { status: newStatus });
    fetchStaff();
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-700">Staff</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Staff
        </button>
      </div>

      {/* Staff Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : staff.length === 0 ? (
        <p className="text-gray-500">No staff added yet.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Position</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Login</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{member.position}</td>
                  <td className="px-6 py-4 text-gray-600">{member.email || "—"}</td>
                  <td className="px-6 py-4 text-gray-600">{member.phone || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      member.hasLogin
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {member.hasLogin ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      member.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(member)}
                      className={`text-xs font-medium px-3 py-1 rounded-lg ${
                        member.status === "active"
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
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
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Add New Staff</h3>

            {formError && (
              <div className="bg-red-100 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text" placeholder="First Name" required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text" placeholder="Last Name" required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Position Dropdown */}
              <select
                required
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                <option value="">Select Position</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Show login fields only for academic staff */}
              {isAcademic && (
                <>
                  <input
                    type="email" placeholder="Email Address" required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password" placeholder="Password" required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}

              {/* Email optional for non-academic */}
              {!isAcademic && (
                <input
                  type="email" placeholder="Email Address (optional)"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              <input
                type="tel" placeholder="Phone Number (optional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Helper text */}
              {formData.position && (
                <p className="text-xs text-gray-500">
                  {isAcademic
                    ? "✅ This staff member will have a login account."
                    : "ℹ️ This staff member will be recorded but won't have login access."}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(""); }}
                  className="w-1/2 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={formLoading}
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}