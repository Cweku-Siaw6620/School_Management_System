import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function Terms() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "", academicYear: "", term: "", startDate: "", endDate: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => { fetchTerms(); }, []);

  async function fetchTerms() {
    setLoading(true);
    const snapshot = await getDocs(collection(db, "terms"));
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTerms(list);
    setLoading(false);
  }

  async function handleAddTerm(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, "terms", id), {
        name: `Term ${formData.term} - ${formData.academicYear}`,
        academicYear: formData.academicYear,
        term: formData.term,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isCurrent: false,
        createdAt: new Date(),
      });
      setFormData({ name: "", academicYear: "", term: "", startDate: "", endDate: "" });
      setShowModal(false);
      fetchTerms();
    } catch (err) {
      setFormError(err.message);
    }
    setFormLoading(false);
  }

  async function setAsCurrent(termId) {
    // First remove isCurrent from all terms
    const snapshot = await getDocs(collection(db, "terms"));
    const updates = snapshot.docs.map((d) =>
      updateDoc(doc(db, "terms", d.id), { isCurrent: false })
    );
    await Promise.all(updates);
    // Then set selected term as current
    await updateDoc(doc(db, "terms", termId), { isCurrent: true });
    fetchTerms();
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-700">Academic Terms</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Term
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : terms.length === 0 ? (
        <p className="text-gray-500 text-sm">No academic terms added yet.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Term</th>
                <th className="px-6 py-3 text-left">Academic Year</th>
                <th className="px-6 py-3 text-left">Start Date</th>
                <th className="px-6 py-3 text-left">End Date</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {terms.map((term) => (
                <tr key={term.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{term.name}</td>
                  <td className="px-6 py-4 text-gray-600">{term.academicYear}</td>
                  <td className="px-6 py-4 text-gray-600">{term.startDate || "—"}</td>
                  <td className="px-6 py-4 text-gray-600">{term.endDate || "—"}</td>
                  <td className="px-6 py-4">
                    {term.isCurrent ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        Current
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {!term.isCurrent && (
                      <button
                        onClick={() => setAsCurrent(term.id)}
                        className="text-xs font-medium px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Set as Current
                      </button>
                    )}
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
            <h3 className="text-lg font-bold text-gray-700 mb-4">Add Academic Term</h3>

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddTerm} className="space-y-3">
              <input
                type="text" placeholder="Academic Year (e.g. 2025/2026)" required
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <select
                required
                value={formData.term}
                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >
                <option value="">Select Term</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date" required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date" required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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
                  {formLoading ? "Saving..." : "Add Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}