import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, updateDoc, setDoc
} from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import { db, auth } from "../../firebase";
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
        const userCredential = await createUserWithEmailAndPassword(
          staffAuth, formData.email, formData.password
        );
        uid = userCredential.user.uid;

        const role = formData.position === "Headteacher" ? "headteacher" : "teacher";

        await setDoc(doc(db, "users", uid), {
          role,
          email: formData.email,
        });

        await signOut(staffAuth);
      } else {
        uid = crypto.randomUUID();
      }

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

  // Loading skeleton
  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 bg-gray-200 rounded w-32"></div>
            <div className="h-10 bg-gray-200 rounded-lg w-28"></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/5"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                  <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Staff Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your institution's staff members
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            + Add Staff
          </button>
        </div>
      </div>

      {/* Staff Table */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4 text-gray-300">👥</div>
          <h3 className="text-sm font-medium text-gray-700">No staff members</h3>
          <p className="text-xs text-gray-400 mt-1">
            Get started by adding your first staff member
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {member.position}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {member.email || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {member.phone || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.hasLogin
                          ? "bg-gray-100 text-gray-700"
                          : "bg-gray-50 text-gray-400"
                      }`}>
                        {member.hasLogin ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleStatus(member)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          member.status === "active"
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
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

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Add New Staff
              </h3>
              <button
                onClick={() => { setShowModal(false); setFormError(""); }}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Position *
                </label>
                <select
                  required
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-gray-700"
                >
                  <option value="">Select position</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {isAcademic && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@school.edu"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Create a password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                    />
                  </div>
                </>
              )}

              {!isAcademic && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Email Address (optional)
                  </label>
                  <input
                    type="email"
                    placeholder="email@school.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Phone Number (optional)
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                />
              </div>

              {formData.position && (
                <div className={`text-xs px-3 py-2 rounded-lg ${
                  isAcademic
                    ? "bg-gray-50 text-gray-600"
                    : "bg-gray-50 text-gray-500"
                }`}>
                  {isAcademic
                    ? "✓ This staff member will have login credentials"
                    : "ℹ This staff member will not have login access"}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(""); }}
                  className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formLoading ? "Adding..." : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}