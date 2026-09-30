import { useState, useEffect } from "react";
import { 
  collection, getDocs, doc, setDoc, deleteDoc, 
  updateDoc, query, where, writeBatch 
} from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";

// Default subject sets for Ghanaian schools
const DEFAULT_SETS = [
  {
    name: "KG Set",
    level: "kg",
    subjects: [
      "Language Development",
      "Number Work",
      "Creative Arts",
      "Environmental Studies",
      "Physical Development",
      "Social & Emotional Development"
    ]
  },
  {
    name: "Primary Set",
    level: "primary",
    subjects: [
      "English Language",
      "Mathematics",
      "Science",
      "Social Studies",
      "Religious & Moral Education",
      "Information Technology",
      "Ghanaian Language",
      "Creative Arts",
      "Physical Education"
    ]
  },
  {
    name: "JHS Set",
    level: "jhs",
    subjects: [
      "English Language",
      "Mathematics",
      "Integrated Science",
      "Social Studies",
      "Religious & Moral Education",
      "Information Technology",
      "Ghanaian Language",
      "Basic Design & Technology",
      "French",
      "Physical Education"
    ]
  }
];

export default function Subjects() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [subjectSets, setSubjectSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  
  // Modal states
  const [showSetModal, setShowSetModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showAssignSetModal, setShowAssignSetModal] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    setName: "",
    subjects: "",
    level: "custom"
  });
  const [newSubjectName, setNewSubjectName] = useState("");
  const [selectedSetId, setSelectedSetId] = useState("");
  
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isDefaultSetsLoaded, setIsDefaultSetsLoaded] = useState(false);

  // Fetch all classes and subject sets on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch subjects when a class is selected
  useEffect(() => {
    if (selectedClassId) {
      fetchAssignedSubjects(selectedClassId);
      const cls = classes.find(c => c.id === selectedClassId);
      setSelectedClass(cls || null);
    } else {
      setAssignedSubjects([]);
      setSelectedClass(null);
    }
  }, [selectedClassId, classes]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Fetch classes
      const classSnapshot = await getDocs(collection(db, "classes"));
      const classList = classSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(cls => cls.status === "active");
      setClasses(classList);
      
      // Fetch subject sets
      await fetchSubjectSets();
      
      // Auto-select first class if available
      if (classList.length > 0) {
        setSelectedClassId(classList[0].id);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
    setLoading(false);
  }

  async function fetchSubjectSets() {
    try {
      const snapshot = await getDocs(collection(db, "subjectSets"));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubjectSets(list);
      
      // If no sets exist, create default sets
      if (list.length === 0 && !isDefaultSetsLoaded) {
        await createDefaultSets();
      }
    } catch (error) {
      console.error("Error fetching subject sets:", error);
    }
  }

  async function createDefaultSets() {
    setIsDefaultSetsLoaded(true);
    try {
      const batch = writeBatch(db);
      
      for (const set of DEFAULT_SETS) {
        const id = crypto.randomUUID();
        const docRef = doc(db, "subjectSets", id);
        batch.set(docRef, {
          name: set.name,
          level: set.level,
          subjects: set.subjects,
          isDefault: true,
          createdAt: new Date()
        });
      }
      
      await batch.commit();
      await fetchSubjectSets();
      setSuccessMessage("Default subject sets created!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error creating default sets:", error);
    }
  }

  async function fetchAssignedSubjects(classId) {
    setSubjectsLoading(true);
    try {
      const q = query(
        collection(db, "classSubjects"),
        where("classId", "==", classId)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAssignedSubjects(list);
    } catch (error) {
      console.error("Error fetching assigned subjects:", error);
    }
    setSubjectsLoading(false);
  }

  async function handleCreateSet(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      // Parse subjects from textarea (one per line)
      const subjectsArray = formData.subjects
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (subjectsArray.length === 0) {
        setFormError("Please add at least one subject");
        setFormLoading(false);
        return;
      }

      const setId = crypto.randomUUID();
      await setDoc(doc(db, "subjectSets", setId), {
        name: formData.setName,
        level: formData.level || "custom",
        subjects: subjectsArray,
        isDefault: false,
        createdAt: new Date()
      });

      setFormData({ setName: "", subjects: "", level: "custom" });
      setShowSetModal(false);
      setSuccessMessage(`"${formData.setName}" created successfully!`);
      await fetchSubjectSets();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setFormError(error.message);
    }
    setFormLoading(false);
  }

  async function handleAssignSetToClass() {
    if (!selectedSetId || !selectedClassId) return;
    
    setFormLoading(true);
    setFormError("");

    try {
      const selectedSet = subjectSets.find(s => s.id === selectedSetId);
      if (!selectedSet) {
        setFormError("Selected set not found");
        setFormLoading(false);
        return;
      }

      // Check which subjects already exist for this class
      const existingNames = assignedSubjects.map(s => s.name.toLowerCase());
      const newSubjects = selectedSet.subjects.filter(
        s => !existingNames.includes(s.toLowerCase())
      );

      if (newSubjects.length === 0) {
        setFormError("All subjects from this set are already assigned to this class");
        setFormLoading(false);
        return;
      }

      // Add all new subjects to the class
      const batch = writeBatch(db);
      
      for (const subjectName of newSubjects) {
        const id = crypto.randomUUID();
        const docRef = doc(db, "classSubjects", id);
        batch.set(docRef, {
          classId: selectedClassId,
          name: subjectName,
          teacherId: null, // Will be assigned later
          createdAt: new Date()
        });
      }

      await batch.commit();
      
      setSelectedSetId("");
      setShowAssignSetModal(false);
      setSuccessMessage(`Added ${newSubjects.length} subjects from "${selectedSet.name}"`);
      await fetchAssignedSubjects(selectedClassId);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setFormError(error.message);
    }
    setFormLoading(false);
  }

  async function handleAddIndividualSubject(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      // Check if subject already exists for this class
      const existing = assignedSubjects.find(
        s => s.name.toLowerCase() === newSubjectName.toLowerCase()
      );
      
      if (existing) {
        setFormError(`"${newSubjectName}" is already assigned to this class`);
        setFormLoading(false);
        return;
      }

      const id = crypto.randomUUID();
      await setDoc(doc(db, "classSubjects", id), {
        classId: selectedClassId,
        name: newSubjectName,
        teacherId: null,
        createdAt: new Date()
      });

      setNewSubjectName("");
      setShowAddSubjectModal(false);
      setSuccessMessage(`"${newSubjectName}" added successfully!`);
      await fetchAssignedSubjects(selectedClassId);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setFormError(error.message);
    }
    setFormLoading(false);
  }

  async function handleRemoveSubject(subjectId, subjectName) {
    if (!confirm(`Remove "${subjectName}" from this class?`)) return;
    
    try {
      await deleteDoc(doc(db, "classSubjects", subjectId));
      setSuccessMessage(`"${subjectName}" removed successfully!`);
      await fetchAssignedSubjects(selectedClassId);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting subject:", error);
      setFormError("Failed to remove subject");
    }
  }

  async function handleDeleteSet(setId, setName) {
    if (!confirm(`Delete subject set "${setName}"? This will NOT remove subjects already assigned to classes.`)) return;
    
    try {
      await deleteDoc(doc(db, "subjectSets", setId));
      setSuccessMessage(`"${setName}" deleted successfully!`);
      await fetchSubjectSets();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting set:", error);
      setFormError("Failed to delete subject set");
    }
  }

  const getClassName = (classId) => {
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : "Unknown Class";
  };

  // Loading skeleton
  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 bg-slate-200/60 rounded w-48"></div>
              <div className="h-4 bg-slate-200/60 rounded w-64 mt-2"></div>
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-6">
            <div className="h-10 bg-slate-200/60 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 bg-slate-200/60 rounded w-1/3"></div>
                  <div className="h-8 bg-slate-200/60 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  return (
    <HeadmasterLayout>
      <div className="space-y-6">

        {/* Page Header */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
                Subject Management
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Create subject sets and assign them to classes
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAssignSetModal(true)}
                disabled={!selectedClassId || subjectSets.length === 0}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-md transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign Set
              </button>
              <button
                onClick={() => setShowAddSubjectModal(true)}
                disabled={!selectedClassId}
                className="px-4 py-2.5 bg-sky-900 hover:bg-sky-950 text-white text-sm font-medium rounded-md transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Subject
              </button>
              <button
                onClick={() => setShowSetModal(true)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-md transition-colors shadow-xs"
              >
                + New Set
              </button>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-md">
            {successMessage}
          </div>
        )}
        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
            {formError}
          </div>
        )}

        {/* Subject Sets Overview */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-base font-semibold text-slate-800">
              Subject Sets
            </h3>
            <span className="text-xs text-slate-500">
              {subjectSets.length} set{subjectSets.length !== 1 ? "s" : ""}
            </span>
          </div>
          
          {subjectSets.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No subject sets created yet. Click "New Set" to get started.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectSets.map(set => (
                <div key={set.id} className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{set.name}</h4>
                      {set.level && set.level !== "custom" && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                          {set.level.toUpperCase()}
                        </span>
                      )}
                      {set.isDefault && (
                        <span className="inline-block mt-1 ml-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200">
                          Default
                        </span>
                      )}
                    </div>
                    {!set.isDefault && (
                      <button
                        onClick={() => handleDeleteSet(set.id, set.name)}
                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {set.subjects.slice(0, 5).map((subject, index) => (
                      <span key={index} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded border border-slate-100">
                        {subject}
                      </span>
                    ))}
                    {set.subjects.length > 5 && (
                      <span className="px-2 py-0.5 text-slate-400 text-xs">
                        +{set.subjects.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class Selector & Assigned Subjects */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Select Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full max-w-sm border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
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
            </div>
            {selectedClass && (
              <div className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{selectedClass.name}</span>
                {selectedClass.teacherId && (
                  <span className="ml-2 text-xs text-slate-400">
                    Teacher: {selectedClass.teacherId} {/* We'll resolve this later */}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Assigned Subjects */}
          {!selectedClassId ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">Select a class to view its subjects</p>
            </div>
          ) : subjectsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse flex items-center justify-between">
                  <div className="h-4 bg-slate-200/60 rounded w-1/3"></div>
                  <div className="h-6 bg-slate-200/60 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : assignedSubjects.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
              <div className="text-4xl mb-3 text-slate-300"></div>
              <h3 className="font-serif text-base font-semibold text-slate-700">No subjects assigned</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Assign a subject set or add individual subjects to {selectedClass ? selectedClass.name : "this class"}
              </p>
              <div className="flex gap-3 justify-center mt-4">
                <button
                  onClick={() => setShowAssignSetModal(true)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-md transition-colors"
                >
                  Assign Subject Set
                </button>
                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="px-4 py-2 bg-sky-900 hover:bg-sky-950 text-white text-xs font-medium rounded-md transition-colors"
                >
                  Add Individual Subject
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-700">
                  {assignedSubjects.length} subject{assignedSubjects.length !== 1 ? "s" : ""} assigned
                </span>
                <span className="text-xs text-slate-400">
                  Click "Add Subject" to add more
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {assignedSubjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">📖</span>
                      <span className="font-medium text-slate-900 text-sm">
                        {subject.name}
                      </span>
                      {subject.teacherId && (
                        <span className="text-xs text-slate-400 ml-1">
                          (assigned)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSubject(subject.id, subject.name)}
                      className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Create Subject Set */}
        {showSetModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 border border-slate-200/80 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Create Subject Set
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Group subjects together to quickly assign to classes
                  </p>
                </div>
                <button
                  onClick={() => { setShowSetModal(false); setFormError(""); }}
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

              <form onSubmit={handleCreateSet} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Set Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Primary Set, JHS Set"
                    value={formData.setName}
                    onChange={(e) => setFormData({ ...formData, setName: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Level (optional)
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
                  >
                    <option value="custom">Custom</option>
                    <option value="kg">KG</option>
                    <option value="primary">Primary</option>
                    <option value="jhs">JHS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Subjects (one per line) *
                  </label>
                  <textarea
                    required
                    rows={8}
                    placeholder="English Language&#10;Mathematics&#10;Science&#10;Social Studies"
                    value={formData.subjects}
                    onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Enter one subject per line
                  </p>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowSetModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 bg-sky-900 hover:bg-sky-950 text-white py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {formLoading ? "Creating..." : "Create Set"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Set to Class */}
        {showAssignSetModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Assign Subject Set
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bulk add subjects to {selectedClass ? selectedClass.name : "this class"}
                  </p>
                </div>
                <button
                  onClick={() => { setShowAssignSetModal(false); setFormError(""); }}
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

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Select Subject Set *
                  </label>
                  <select
                    required
                    value={selectedSetId}
                    onChange={(e) => setSelectedSetId(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent bg-white"
                  >
                    <option value="">Select a set</option>
                    {subjectSets.map(set => (
                      <option key={set.id} value={set.id}>
                        {set.name} ({set.subjects.length} subjects)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSetId && (
                  <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                    <p className="text-xs font-medium text-slate-600 mb-2">Subjects in this set:</p>
                    <div className="flex flex-wrap gap-1">
                      {subjectSets.find(s => s.id === selectedSetId)?.subjects.map((subject, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white text-slate-700 text-xs rounded border border-slate-200">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowAssignSetModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignSetToClass}
                    disabled={formLoading || !selectedSetId}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {formLoading ? "Assigning..." : "Assign Set"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Individual Subject */}
        {showAddSubjectModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200/80">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900">
                    Add Subject to {selectedClass ? selectedClass.name : "Class"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add a single subject to this class
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddSubjectModal(false); setFormError(""); }}
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

              <form onSubmit={handleAddIndividualSubject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., French"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-800 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setShowAddSubjectModal(false); setFormError(""); }}
                    className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 bg-sky-900 hover:bg-sky-950 text-white py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {formLoading ? "Adding..." : "Add Subject"}
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