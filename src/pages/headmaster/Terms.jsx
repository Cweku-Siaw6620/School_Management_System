import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

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
    const snapshot = await getDocs(collection(db, "terms"));
    const updates = snapshot.docs.map((d) =>
      updateDoc(doc(db, "terms", d.id), { isCurrent: false })
    );
    await Promise.all(updates);
    await updateDoc(doc(db, "terms", termId), { isCurrent: true });
    fetchTerms();
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-slate-100 rounded w-1/5"></div>
                <div className="h-4 bg-slate-100 rounded w-1/6"></div>
                <div className="h-4 bg-slate-100 rounded w-1/6"></div>
                <div className="h-4 bg-slate-100 rounded w-1/6"></div>
                <div className="h-6 bg-slate-100 rounded-full w-20"></div>
                <div className="h-8 bg-slate-100 rounded-md w-28 ml-auto"></div>
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
              Academic Calendar & Terms
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure term schedules and set the active school term.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-900 text-white text-sm font-medium rounded-md hover:bg-sky-950 transition-colors shadow-xs"
          >
            <span className="text-base font-bold leading-none">+</span> Add Academic Term
          </button>
        </div>

        {/* Terms Table / Empty State */}
        {terms.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 font-serif text-xl">
              📅
            </div>
            <h3 className="font-serif text-base font-semibold text-slate-800">No academic terms found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Start by scheduling your first academic term for the school year.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Term Name
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Academic Year
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      End Date
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
                  {terms.map((term) => (
                    <tr key={term.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900 font-serif">{term.name}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {term.academicYear}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {term.startDate || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {term.endDate || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          term.isCurrent
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${term.isCurrent ? "bg-emerald-600" : "bg-slate-400"}`}></span>
                          {term.isCurrent ? "Active Term" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!term.isCurrent && (
                          <button
                            onClick={() => setAsCurrent(term.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors"
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
          </div>
        )}

        {/* Add Term Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Add Academic Term
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Specify term dates and academic year.</p>
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

              <form onSubmit={handleAddTerm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2025/2026"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Term *
                  </label>
                  <select
                    required
                    value={formData.term}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
                  >
                    <option value="">Select Term</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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
                    {formLoading ? "Saving..." : "Create Term"}
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