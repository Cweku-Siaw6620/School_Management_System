import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", level: "", capacity: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchClasses(); }, []);

  async function fetchClasses() {
    setLoading(true);
    const [classSnap, staffSnap] = await Promise.all([
      getDocs(collection(db, "classes")),
      getDocs(collection(db, "staff")),
    ]);

    const classList = classSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const staffList = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    setClasses(classList);
    setStaff(staffList);
    setLoading(false);
  }

  function getTeacherName(teacherId) {
    const teacher = staff.find((member) => member.id === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned";
  }

  async function handleAddClass(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "classes", id), {
        name: formData.name,
        level: formData.level,
        capacity: parseInt(formData.capacity) || 0,
        teacherId: null,
        status: "active",
        createdAt: new Date(),
      });
      setFormData({ name: "", level: "", capacity: "" });
      setShowModal(false);
      fetchClasses();
    } catch (err) {
      setFormError(err.message);
    }
    setFormLoading(false);
  }

  async function toggleStatus(cls) {
    const newStatus = cls.status === "active" ? "inactive" : "active";
    await updateDoc(doc(db, "classes", cls.id), { status: newStatus });
    fetchClasses();
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
                  <div className="h-4 bg-gray-200 rounded w-1/5"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-24"></div>
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
              Classes
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage all classes and their assignments
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            + Add Class
          </button>
        </div>
      </div>

      {/* Classes Table */}
      {classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4 text-gray-300">📚</div>
          <h3 className="text-sm font-medium text-gray-700">No classes created</h3>
          <p className="text-xs text-gray-400 mt-1">
            Get started by creating your first class
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Teacher
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
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{cls.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {cls.level}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {cls.capacity || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {getTeacherName(cls.teacherId)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cls.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {cls.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleStatus(cls)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          cls.status === "active"
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {cls.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Class Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Add New Class
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

            <form onSubmit={handleAddClass} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., JHS 2B"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Level *
                </label>
                <select
                  required
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-gray-700"
                >
                  <option value="">Select level</option>
                  <option value="Primary 1">Primary 1</option>
                  <option value="Primary 2">Primary 2</option>
                  <option value="Primary 3">Primary 3</option>
                  <option value="Primary 4">Primary 4</option>
                  <option value="Primary 5">Primary 5</option>
                  <option value="Primary 6">Primary 6</option>
                  <option value="JHS 1">JHS 1</option>
                  <option value="JHS 2">JHS 2</option>
                  <option value="JHS 3">JHS 3</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Capacity
                </label>
                <input
                  type="number"
                  placeholder="e.g., 40"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                />
              </div>

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
                  {formLoading ? "Adding..." : "Add Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}