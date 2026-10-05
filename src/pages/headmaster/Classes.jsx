import { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import HeadmasterLayout from "../../components/HeadmasterLayout";
import { Link } from "react-router-dom";

// DEFAULT CLASSES — Hardcoded from Nursery to JHS 3
const DEFAULT_CLASSES = [
  // Early Childhood
  { name: "Nursery 1A", level: "Nursery 1" },
  { name: "Nursery 1B", level: "Nursery 1" },
  { name: "Nursery 2A", level: "Nursery 2" },
  { name: "Nursery 2B", level: "Nursery 2" },
  { name: "KG 1A", level: "KG 1" },
  { name: "KG 1B", level: "KG 1" },
  { name: "KG 2A", level: "KG 2" },
  { name: "KG 2B", level: "KG 2" },
  
  // Primary
  { name: "Primary 1A", level: "Primary 1" },
  { name: "Primary 1B", level: "Primary 1" },
  { name: "Primary 2A", level: "Primary 2" },
  { name: "Primary 2B", level: "Primary 2" },
  { name: "Primary 3A", level: "Primary 3" },
  { name: "Primary 3B", level: "Primary 3" },
  { name: "Primary 4A", level: "Primary 4" },
  { name: "Primary 4B", level: "Primary 4" },
  { name: "Primary 5A", level: "Primary 5" },
  { name: "Primary 5B", level: "Primary 5" },
  { name: "Primary 6A", level: "Primary 6" },
  { name: "Primary 6B", level: "Primary 6" },
  
  // JHS
  { name: "JHS 1A", level: "JHS 1" },
  { name: "JHS 1B", level: "JHS 1" },
  { name: "JHS 2A", level: "JHS 2" },
  { name: "JHS 2B", level: "JHS 2" },
  { name: "JHS 3A", level: "JHS 3" },
  { name: "JHS 3B", level: "JHS 3" },
];

// Academic progression order (for sorting)
const CLASS_ORDER = {
  "Nursery 1": 1,
  "Nursery 2": 2,
  "KG 1": 3,
  "KG 2": 4,
  "Primary 1": 5,
  "Primary 2": 6,
  "Primary 3": 7,
  "Primary 4": 8,
  "Primary 5": 9,
  "Primary 6": 10,
  "JHS 1": 11,
  "JHS 2": 12,
  "JHS 3": 13,
};

// Group levels for display
const LEVEL_GROUPS = [
  { label: "Early Childhood", levels: ["Nursery 1", "Nursery 2", "KG 1", "KG 2"] },
  { label: "Primary", levels: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"] },
  { label: "Junior High School", levels: ["JHS 1", "JHS 2", "JHS 3"] },
];

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", level: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [studentCounts, setStudentCounts] = useState({});
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");

  // Flag to prevent duplicate creation
  const hasCreatedDefaults = useRef(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    setLoading(true);
    try {
      const [classSnap, staffSnap, studentSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "staff")),
        getDocs(collection(db, "students")),
      ]);

      let classList = classSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const staffList = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Count students per class
      const counts = {};
      studentSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.classId && data.status === "active") {
          counts[data.classId] = (counts[data.classId] || 0) + 1;
        }
      });
      setStudentCounts(counts);

      // ONLY create default classes if NOT already created AND classes list is empty or missing
      if (!hasCreatedDefaults.current) {
        const existingNames = new Set(classList.map(c => c.name));
        const missingClasses = DEFAULT_CLASSES.filter(c => !existingNames.has(c.name));
        
        if (missingClasses.length > 0) {
          for (const cls of missingClasses) {
            const id = crypto.randomUUID();
            await setDoc(doc(db, "classes", id), {
              name: cls.name,
              level: cls.level,
              teacherId: null,
              status: "active",
              isDefault: true,
              createdAt: new Date(),
            });
          }
          hasCreatedDefaults.current = true;
          
          const updatedClassSnap = await getDocs(collection(db, "classes"));
          classList = updatedClassSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } else {
          hasCreatedDefaults.current = true;
        }
      }

      setClasses(classList);
      setStaff(staffList);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
    setLoading(false);
  }

  function getTeacherName(teacherId) {
    const teacher = staff.find((member) => member.id === teacherId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned";
  }

  function getStudentCount(classId) {
    return studentCounts[classId] || 0;
  }

  async function handleAddClass(e) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const exists = classes.some(c => c.name === formData.name);
      if (exists) {
        setFormError(`Class "${formData.name}" already exists.`);
        setFormLoading(false);
        return;
      }

      const id = crypto.randomUUID();
      await setDoc(doc(db, "classes", id), {
        name: formData.name,
        level: formData.level,
        teacherId: null,
        status: "active",
        isDefault: false,
        createdAt: new Date(),
      });
      setFormData({ name: "", level: "" });
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

  async function handleDeleteClass(cls) {
    if (!cls.isDefault) {
      if (!confirm(`Delete "${cls.name}"? This will remove the class from the system.`)) return;
      try {
        await deleteDoc(doc(db, "classes", cls.id));
        fetchClasses();
      } catch (error) {
        console.error("Error deleting class:", error);
        setFormError("Failed to delete class.");
      }
    } else {
      setFormError("Default classes cannot be deleted.");
      setTimeout(() => setFormError(""), 3000);
    }
  }

  // Filtered classes logic
  const filteredClasses = classes.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.level.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getTeacherName(c.teacherId).toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedGroup === "All") return matchesSearch;
    const group = LEVEL_GROUPS.find((g) => g.label === selectedGroup);
    return matchesSearch && group?.levels.includes(c.level);
  });

  // Group filtered classes by level for display
  function getGroupedClasses() {
    const grouped = {};
    LEVEL_GROUPS.forEach(group => {
      if (selectedGroup === "All" || selectedGroup === group.label) {
        group.levels.forEach(level => {
          grouped[level] = filteredClasses.filter(c => c.level === level && c.status === "active");
        });
      }
    });
    return grouped;
  }

  if (loading) {
    return (
      <HeadmasterLayout>
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-20 bg-brand-soft rounded-xl border border-line"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-brand-soft rounded-xl border border-line"></div>
            ))}
          </div>
        </div>
      </HeadmasterLayout>
    );
  }

  const groupedClasses = getGroupedClasses();
  const inactiveClasses = filteredClasses.filter(c => c.status === "inactive");

  return (
    <HeadmasterLayout>
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-ink tracking-tight">
              Class Roster
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Complete class list from Nursery to JHS 3 with real-time enrollment counts.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            <span className="text-base font-bold leading-none">+</span> Add Custom Class
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="card p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by class name or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="eyebrow whitespace-nowrap">Filter Level:</span>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="input sm:w-auto"
            >
              <option value="All">All Categories</option>
              {LEVEL_GROUPS.map((group) => (
                <option key={group.label} value={group.label}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Classes Grid by Level Group */}
        <div className="space-y-8">
          {LEVEL_GROUPS.map((group) => {
            if (selectedGroup !== "All" && selectedGroup !== group.label) return null;

            const hasClasses = group.levels.some(level => groupedClasses[level]?.length > 0);
            if (!hasClasses) return null;

            return (
              <div key={group.label}>
                <h2 className="text-lg font-semibold text-ink border-b border-line pb-2 mb-4">
                  {group.label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.levels.map((level) => {
                    const levelClasses = groupedClasses[level] || [];
                    return levelClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="card p-5 hover:shadow-md hover:border-line-strong transition-all group"
                      >
                        <Link to={`/headmaster/classes/${cls.id}`} className="block">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-ink text-sm">
                                {cls.name}
                              </h3>
                              <p className="text-xs text-ink-muted mt-0.5">{cls.level}</p>
                            </div>
                            {cls.isDefault && (
                              <span className="text-[10px] font-medium text-ink-faint bg-brand-soft px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                              </svg>
                              <span className="text-xl font-bold text-ink">
                                {getStudentCount(cls.id)}
                              </span>
                              <span className="text-xs text-ink-faint">students</span>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-ink-muted">
                            Teacher: {getTeacherName(cls.teacherId)}
                          </div>
                        </Link>

                        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                            cls.status === "active"
                              ? "bg-success-soft text-success-ink border-success-line"
                              : "bg-danger-soft text-danger-ink border-danger-line"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1 ${cls.status === "active" ? "bg-success" : "bg-danger"}`}></span>
                            {cls.status === "active" ? "Active" : "Inactive"}
                          </span>
                          <div className="flex items-center gap-2">
                            {!cls.isDefault && (
                              <button
                                onClick={() => handleDeleteClass(cls)}
                                className="text-[10px] text-danger hover:text-danger-ink transition-colors"
                              >
                                Delete
                              </button>
                            )}
                            <Link
                              to={`/headmaster/classes/${cls.id}`}
                              className="text-xs text-ink-faint hover:text-ink transition-colors"
                            >
                              View &rarr;
                            </Link>
                          </div>
                        </div>
                      </div>
                    ));
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Inactive Classes Section */}
        {inactiveClasses.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-ink-faint border-b border-line pb-2 mb-4">
              Inactive Classes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {inactiveClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-brand-soft border border-line rounded-xl p-5 opacity-60"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-soft text-sm">
                        {cls.name}
                      </h3>
                      <p className="text-xs text-ink-faint mt-0.5">{cls.level}</p>
                    </div>
                    <button
                      onClick={() => toggleStatus(cls)}
                      className="text-[10px] font-medium text-success hover:text-success-ink"
                    >
                      Activate
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-ink-faint">
                    <span className="line-through">{getStudentCount(cls.id)} students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Class Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-brand backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="card shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
                <div>
                  <h3 className="text-lg font-bold text-ink">
                    Add Custom Class
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">Create a new class section.</p>
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

              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="label block mb-1">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Primary 2C"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label block mb-1">
                    Level *
                  </label>
                  <select
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="input"
                  >
                    <option value="">Select Level</option>
                    <option value="Nursery 1">Nursery 1</option>
                    <option value="Nursery 2">Nursery 2</option>
                    <option value="KG 1">KG 1</option>
                    <option value="KG 2">KG 2</option>
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

                <div className="notice">
                  <p className="text-xs text-ink-soft">
                    Note: Custom classes can be deleted. Default classes (Nursery to JHS 3) cannot be deleted.
                  </p>
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
                    {formLoading ? "Creating..." : "Create Class"}
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