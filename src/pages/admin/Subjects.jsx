import { useState, useEffect } from "react";
import {
  collection, getDocs, doc, setDoc, deleteDoc, query, where
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

// Common school subjects in Ghana
const COMMON_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Science",
  "Social Studies",
  "Religious & Moral Education",
  "Information Technology",
  "French",
  "Ghanaian Language (Twi)",
  "Ghanaian Language (Ga)",
  "Ghanaian Language (Ewe)",
  "Creative Arts",
  "Physical Education",
  "Home Economics",
  "Technical Skills",
  "Integrated Science",
  "Basic Design & Technology",
];

export default function Subjects() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch all classes on mount
  useEffect(() => {
    fetchClasses();
  }, []);

  // Fetch subjects when a class is selected
  useEffect(() => {
    if (selectedClassId) {
      fetchSubjects(selectedClassId);
    } else {
      setSubjects([]);
    }
  }, [selectedClassId]);

  async function fetchClasses() {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "classes"));
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((cls) => cls.status === "active");
      setClasses(list);
      
      // Auto-select first class if available
      if (list.length > 0) {
        setSelectedClassId(list[0].id);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
    setLoading(false);
  }

  async function fetchSubjects(classId) {
    setSubjectsLoading(true);
    try {
      const q = query(
        collection(db, "classSubjects"),
        where("classId", "==", classId)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSubjects(list);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
    setSubjectsLoading(false);
  }

  async function handleAddSubject(e) {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");
    setFormLoading(true);

    try {
      // Check if subject already exists for this class
      const existing = subjects.find(
        (s) => s.name.toLowerCase() === formData.name.toLowerCase()
      );
      if (existing) {
        setFormError(`"${formData.name}" is already assigned to this class`);
        setFormLoading(false);
        return;
      }

      const subjectId = crypto.randomUUID();
      await setDoc(doc(db, "classSubjects", subjectId), {
        classId: selectedClassId,
        name: formData.name,
        createdAt: new Date(),
      });

      setFormData({ name: "" });
      setShowModal(false);
      setSuccessMessage(`"${formData.name}" added successfully!`);
      
      // Refresh subjects list
      fetchSubjects(selectedClassId);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setFormError(error.message);
    }
    setFormLoading(false);
  }

  async function handleDeleteSubject(subjectId, subjectName) {
    if (!confirm(`Remove "${subjectName}" from this class?`)) return;
    
    try {
      await deleteDoc(doc(db, "classSubjects", subjectId));
      setSuccessMessage(`"${subjectName}" removed successfully!`);
      fetchSubjects(selectedClassId);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting subject:", error);
      setFormError("Failed to remove subject");
    }
  }

  // Get class name from ID
  const getClassName = (classId) => {
    const cls = classes.find((c) => c.id === classId);
    return cls ? cls.name : "Unknown Class";
  };

  // Loading skeleton
  if (loading) {
    return (
      <AdminLayout>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-8 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-64 mt-2"></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
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
              Subjects Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Assign subjects to each class
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {formError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {formError}
        </div>
      )}

      {/* Class Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Class
        </label>
        <div className="flex gap-4 items-center">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex-1 max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow text-gray-700"
          >
            {classes.length === 0 ? (
              <option value="">No active classes found</option>
            ) : (
              classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))
            )}
          </select>
          
          <button
            onClick={() => setShowModal(true)}
            disabled={!selectedClassId || classes.length === 0}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Subject
          </button>
        </div>
      </div>

      {/* Subjects Table */}
      {!selectedClassId ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4 text-gray-300">📚</div>
          <h3 className="text-sm font-medium text-gray-700">No class selected</h3>
          <p className="text-xs text-gray-400 mt-1">
            Select a class to view its subjects
          </p>
        </div>
      ) : subjectsLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4 text-gray-300">📝</div>
          <h3 className="text-sm font-medium text-gray-700">No subjects assigned</h3>
          <p className="text-xs text-gray-400 mt-1">
            Click "Add Subject" to assign subjects to {getClassName(selectedClassId)}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Subjects for {getClassName(selectedClassId)}
              </span>
              <span className="text-xs text-gray-500">
                {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-lg">📖</span>
                  <span className="font-medium text-gray-900">
                    {subject.name}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteSubject(subject.id, subject.name)}
                  className="text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Subject to {getClassName(selectedClassId)}
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

            <form onSubmit={handleAddSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., English Language"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
                  list="common-subjects"
                />
                <datalist id="common-subjects">
                  {COMMON_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-400 mt-1.5">
                  Start typing to see suggestions from common subjects
                </p>
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
                  {formLoading ? "Adding..." : "Add Subject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}