import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", level: "", capacity: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchClasses(); }, []);

  async function fetchClasses() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "classes"));
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setClasses(list);
    setLoading(false);
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

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-700">Classes</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Class
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500 text-sm">No classes added yet.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Class Name</th>
                <th className="px-6 py-3 text-left">Level</th>
                <th className="px-6 py-3 text-left">Capacity</th>
                <th className="px-6 py-3 text-left">Class Teacher</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{cls.name}</td>
                  <td className="px-6 py-4 text-gray-600">{cls.level}</td>
                  <td className="px-6 py-4 text-gray-600">{cls.capacity || "—"}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    <span className="px-2 py-1 bg-gray-100 rounded-full">
                      {cls.teacherId ? cls.teacherId : "Unassigned"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      cls.status === "active"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {cls.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(cls)}
                      className="text-xs font-medium px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      {cls.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-700 mb-4">Add New Class</h3>

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddClass} className="space-y-3">
              <input
                type="text" placeholder="Class Name (e.g. JHS 2B)" required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                required
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                <option value="">Select Level</option>
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

              <input
                type="number" placeholder="Capacity (e.g. 40)"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

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
                  {formLoading ? "Saving..." : "Add Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}