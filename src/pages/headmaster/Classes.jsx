import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

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

  /* Skeleton Loading State */
  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-slate-200/60 rounded w-36"></div>
            <div className="h-9 bg-slate-200/60 rounded-md w-28"></div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-slate-100 rounded w-1/5"></div>
                <div className="h-4 bg-slate-100 rounded w-1/6"></div>
                <div className="h-4 bg-slate-100 rounded w-1/6"></div>
                <div className="h-6 bg-slate-100 rounded-full w-24"></div>
                <div className="h-6 bg-slate-100 rounded-full w-16"></div>
                <div className="h-8 bg-slate-100 rounded-md w-20 ml-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  return (
    <HeadmasterLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
              Class Roster & Setup
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage class records, grade levels, and assigned teachers.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-900 text-white text-sm font-medium rounded-md hover:bg-sky-950 transition-colors shadow-xs"
          >
            <span className="text-base font-bold leading-none">+</span> Add New Class
          </button>
        </div>

        {/* Classes Table / Empty State */}
        {classes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 font-serif text-xl">
              🏫
            </div>
            <h3 className="font-serif text-base font-semibold text-slate-800">No classes configured</h3>
            <p className="text-xs text-slate-500 mt-1">
              Start by adding your first primary or junior high class section.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Class Name
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Class Teacher
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((cls) => (
                    <tr key={cls.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900 font-serif">{cls.name}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {cls.level}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {cls.capacity ? `${cls.capacity} Students` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                          {getTeacherName(cls.teacherId)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          cls.status === "active"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cls.status === "active" ? "bg-emerald-600" : "bg-amber-600"}`}></span>
                          {cls.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleStatus(cls)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
                            cls.status === "active"
                              ? "border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "border-sky-200 text-sky-800 bg-sky-50 hover:bg-sky-100"
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Add New Class
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Enter details for the new class section.</p>
                </div>
                <button
                  onClick={() => { setShowModal(false); setFormError(""); }}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-md mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Primary 2A"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Level *
                  </label>
                  <select
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
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
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Class Capacity
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 35"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 bg-sky-900 hover:bg-sky-950 text-white py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {formLoading ? "Saving..." : "Create Class"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </HeadmasterLayout>
  );
}