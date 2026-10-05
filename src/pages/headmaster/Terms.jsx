import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Link } from "react-router-dom";
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
    const list = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((firstTerm, secondTerm) => {
        const firstCreatedAt = firstTerm.createdAt?.toDate?.() || firstTerm.createdAt || 0;
        const secondCreatedAt = secondTerm.createdAt?.toDate?.() || secondTerm.createdAt || 0;
        return new Date(secondCreatedAt) - new Date(firstCreatedAt);
      });
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
            <div className="h-8 bg-line rounded w-36"></div>
            <div className="h-9 bg-line rounded-md w-28"></div>
          </div>
          <div className="card p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 bg-brand-soft rounded w-1/5"></div>
                <div className="h-4 bg-brand-soft rounded w-1/6"></div>
                <div className="h-4 bg-brand-soft rounded w-1/6"></div>
                <div className="h-4 bg-brand-soft rounded w-1/6"></div>
                <div className="h-6 bg-brand-soft rounded-full w-20"></div>
                <div className="h-8 bg-brand-soft rounded-md w-28 ml-auto"></div>
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
        <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              Academic Calendar & Terms
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Configure term schedules and set the active school term.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            <span className="text-base font-bold leading-none">+</span> Add Academic Term
          </button>
        </div>

        {/* Terms Table / Empty State */}
        {terms.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-soft text-ink-faint flex items-center justify-center mx-auto mb-3 text-xl">
              📅
            </div>
            <h3 className="text-base font-semibold text-ink">No academic terms found</h3>
            <p className="text-xs text-ink-muted mt-1">
              Start by scheduling your first academic term for the school year.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-brand-soft border-b border-line">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Term Name
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Academic Year
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {terms.map((term) => (
                    <tr key={term.id} className="hover:bg-brand-soft transition-colors">
                      <td className="px-6 py-4">
                        <Link 
                          to={`/headmaster/terms/${term.id}`}
                          className="font-semibold text-ink hover:underline"
                        >
                          {term.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-ink-soft font-medium">
                        {term.academicYear}
                      </td>
                      <td className="px-6 py-4 text-ink-soft">
                        {term.startDate || <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-6 py-4 text-ink-soft">
                        {term.endDate || <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          term.isCurrent
                            ? "bg-success-soft text-success-ink border-success-line"
                            : "bg-brand-soft text-ink-soft border-line"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${term.isCurrent ? "bg-success" : "bg-ink-faint"}`}></span>
                          {term.isCurrent ? "Active Term" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!term.isCurrent && (
                          <button
                            onClick={() => setAsCurrent(term.id)}
                            className="btn btn-secondary px-3 py-1.5"
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
          <div className="fixed inset-0 bg-brand backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="card shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
                <div>
                  <h3 className="text-lg font-bold text-ink">
                    Add Academic Term
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">Specify term dates and academic year.</p>
                </div>
                <button
                  onClick={() => { setShowModal(false); setFormError(""); }}
                  className="p-1 rounded text-ink-faint hover:text-ink-soft hover:bg-brand-soft transition-colors"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="alert-error mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleAddTerm} className="space-y-4">
                <div>
                  <label className="label block mb-1">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2025/2026"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label block mb-1">
                    Term *
                  </label>
                  <select
                    required
                    value={formData.term}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                    className="input"
                  >
                    <option value="">Select Term</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>

                <div>
                  <label className="label block mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label block mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setFormError(""); }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="btn btn-primary flex-1"
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