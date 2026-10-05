import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedLoginId = loginId.trim().toUpperCase();

      if (!trimmedLoginId) {
        setError("Please enter your Student ID or Staff ID.");
        setLoading(false);
        return;
      }

      if (!password.trim()) {
        setError("Please enter your password.");
        setLoading(false);
        return;
      }

      let email = null;
      let role = null;
      let uid = null;
      let guardianPhone = null;
      let studentId = null;
      let parentEmail = null;

      // ========================================
      // 1. STAFF LOGIN — Check Staff Collection
      // ========================================
      const staffQuery = query(
        collection(db, "staff"),
        where("staffId", "==", trimmedLoginId)
      );
      const staffSnapshot = await getDocs(staffQuery);

      if (!staffSnapshot.empty) {
        const staffDoc = staffSnapshot.docs[0];
        const staffData = staffDoc.data();
        const staffUid = staffDoc.id;
        email = staffData.email;

        if (!email) {
          setError("This staff account has no registered email. Please contact support.");
          setLoading(false);
          return;
        }

        const userDoc = await getDoc(doc(db, "users", staffUid));
        if (userDoc.exists()) {
          role = userDoc.data().role;
          uid = staffUid;
        } else {
          setError("User permissions not configured. Contact the administrator.");
          setLoading(false);
          return;
        }

        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (authError) {
          if (authError.code === "auth/wrong-password") {
            setError("Incorrect password. Please try again.");
          } else {
            setError("Authentication failed. Please try again.");
          }
          setLoading(false);
          return;
        }

        if (role === "admin") {
          navigate("/admin/dashboard");
        } else if (role === "headmaster") {
          navigate("/headmaster/dashboard");
        } else if (role === "teacher") {
          navigate("/teacher/dashboard");
        } else {
          navigate("/unauthorized");
        }
        setLoading(false);
        return;
      }

      // ========================================
      // 2. ADMIN FALLBACK
      // ========================================
      if (trimmedLoginId === "ADMIN" || trimmedLoginId === "ADMIN001") {
        const usersQuery = query(
          collection(db, "users"),
          where("role", "==", "admin")
        );
        const usersSnapshot = await getDocs(usersQuery);
        
        if (!usersSnapshot.empty) {
          const userDoc = usersSnapshot.docs[0];
          const userData = userDoc.data();
          email = userData.email;
          role = "admin";
          uid = userDoc.id;

          try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/admin/dashboard");
            setLoading(false);
            return;
          } catch (authError) {
            if (authError.code === "auth/wrong-password") {
              setError("Incorrect password. Please try again.");
            } else {
              setError("Authentication failed. Please try again.");
            }
            setLoading(false);
            return;
          }
        }
      }

      // ========================================
      // 3. PARENT LOGIN — Find student by index
      // ========================================
      const studentsQuery = query(
        collection(db, "students"),
        where("indexNumber", "==", trimmedLoginId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      if (studentsSnapshot.empty) {
        setError("Invalid Student ID or Staff ID. Please check and try again.");
        setLoading(false);
        return;
      }

      const studentDoc = studentsSnapshot.docs[0];
      const studentData = studentDoc.data();
      studentId = studentDoc.id;
      guardianPhone = studentData.guardianPhone || "";

      if (!guardianPhone) {
        setError("No guardian phone number on record. Please contact the school.");
        setLoading(false);
        return;
      }

      // Clean phone number (remove spaces and dashes)
      const cleanPhone = guardianPhone.replace(/\s/g, "").replace(/-/g, "");
      const cleanEnteredPassword = password.trim().replace(/\s/g, "").replace(/-/g, "");

      // ========================================
      // 4. FIND ALL STUDENTS WITH SAME GUARDIAN PHONE
      // ========================================
      const allStudentsQuery = query(
        collection(db, "students"),
        where("guardianPhone", "==", guardianPhone)
      );
      const allStudentsSnapshot = await getDocs(allStudentsQuery);
      const allStudents = allStudentsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      console.log(` Found ${allStudents.length} child(ren) with phone ${guardianPhone}`);
      const parentStudentIds = allStudents.map(s => s.id);

      // ========================================
      // 5. CHECK IF PARENT ACCOUNT EXISTS
      // ========================================
      let existingParentUid = null;
      for (const student of allStudents) {
        if (student.parentUid) {
          existingParentUid = student.parentUid;
          break;
        }
      }

      if (existingParentUid) {
        //  Parent account exists — get email and link any unlinked children
        const parentDoc = await getDoc(doc(db, "users", existingParentUid));
        if (!parentDoc.exists()) {
          setError("Parent profile missing. Please contact administration.");
          setLoading(false);
          return;
        }

        const parentData = parentDoc.data();
        email = parentData.email;
        role = "parent";
        uid = existingParentUid;

        // Link any unlinked students to this parent
        for (const student of allStudents) {
          if (!student.parentUid) {
            await updateDoc(doc(db, "students", student.id), {
              parentUid: existingParentUid,
              parentAccountCreated: true,
            });
            console.log(`🔗 Linked student ${student.indexNumber} to existing parent`);
          }
        }

        // Update parent's studentIds with any missing children
        const currentStudentIds = parentData.studentIds || [];
        const missingIds = parentStudentIds.filter(id => !currentStudentIds.includes(id));
        
        if (missingIds.length > 0) {
          await updateDoc(doc(db, "users", existingParentUid), {
            studentIds: [...currentStudentIds, ...missingIds],
          });
          console.log(`➕ Added ${missingIds.length} new child(ren) to parent account`);
        }

      } else {
        // ❌ No parent account — CREATE ONE
        parentEmail = studentData.guardianEmail || `${cleanPhone}@parent.school.edu`;

        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            parentEmail,
            cleanPhone  // Phone number as password
          );
          const newParentUid = userCredential.user.uid;

          await setDoc(doc(db, "users", newParentUid), {
            role: "parent",
            email: parentEmail,
            studentIds: parentStudentIds,
            loginId: trimmedLoginId,
            guardianPhone: guardianPhone,
            createdAt: new Date(),
          });

          // Link ALL students to this parent
          for (const student of allStudents) {
            await updateDoc(doc(db, "students", student.id), {
              parentUid: newParentUid,
              parentAccountCreated: true,
            });
          }

          email = parentEmail;
          role = "parent";
          uid = newParentUid;
          existingParentUid = newParentUid;

          console.log(` Created parent account linked to ${allStudents.length} child(ren)`);

          // Sign in and redirect
          await signInWithEmailAndPassword(auth, email, cleanPhone);
          
          // Store child count for redirect logic
          sessionStorage.setItem("parentChildCount", allStudents.length.toString());
          
          if (allStudents.length === 1) {
            navigate(`/parent/child/${parentStudentIds[0]}`);
          } else {
            navigate("/parent/children");
          }
          setLoading(false);
          return;

        } catch (authError) {
          console.error("Error creating parent account:", authError);
          
          if (authError.code === "auth/email-already-in-use") {
            // Email exists — find and link
            const userQuery = query(
              collection(db, "users"),
              where("email", "==", parentEmail),
              where("role", "==", "parent")
            );
            const userSnap = await getDocs(userQuery);
            
            if (!userSnap.empty) {
              const foundParentUid = userSnap.docs[0].id;
              const parentData = userSnap.docs[0].data();
              
              // Link all students
              for (const student of allStudents) {
                if (!student.parentUid) {
                  await updateDoc(doc(db, "students", student.id), {
                    parentUid: foundParentUid,
                    parentAccountCreated: true,
                  });
                }
              }
              
              // Update parent's studentIds
              const currentStudentIds = parentData.studentIds || [];
              const missingIds = parentStudentIds.filter(id => !currentStudentIds.includes(id));
              if (missingIds.length > 0) {
                await updateDoc(doc(db, "users", foundParentUid), {
                  studentIds: [...currentStudentIds, ...missingIds],
                });
              }
              
              email = parentEmail;
              role = "parent";
              uid = foundParentUid;
              existingParentUid = foundParentUid;
            } else {
              setError("Unable to create parent account. Please contact the school.");
              setLoading(false);
              return;
            }
          } else {
            setError("Failed to create parent account: " + authError.message);
            setLoading(false);
            return;
          }
        }
      }

      // ========================================
      // 6. PARENT AUTHENTICATION
      // ========================================
      let authSuccess = false;
      let lastError = null;

      // Authenticate with what the parent actually typed
      try {
        await signInWithEmailAndPassword(auth, email, cleanEnteredPassword);
        authSuccess = true;
        console.log(" Parent login success");
      } catch (passwordErr) {
        console.log("Login failed:", passwordErr.code);
        lastError = passwordErr;
      }

      if (!authSuccess) {
        if (lastError?.code === "auth/user-not-found") {
          setError("Account not found. Please contact the school.");
        } else if (lastError?.code === "auth/wrong-password" || lastError?.code === "auth/invalid-credential") {
          setError("Incorrect password. Use your Guardian Phone Number (without spaces or dashes).");
        } else {
          setError("Unable to sign in. Please contact the school for assistance.");
        }
        setLoading(false);
        return;
      }

      // ========================================
      // 7. REDIRECT — Based on number of children
      // ========================================
      sessionStorage.setItem("parentChildCount", allStudents.length.toString());
      sessionStorage.setItem("parentStudentIds", JSON.stringify(parentStudentIds));

      console.log(`🚀 Redirecting — ${allStudents.length} child(ren)`);

      if (allStudents.length === 1) {
        // Single child → straight to their dashboard
        navigate(`/parent/child/${parentStudentIds[0]}`);
      } else {
        // Multiple children → child selector
        navigate("/parent/children");
      }

    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas font-sans antialiased flex flex-col justify-center items-center p-4 text-ink">
      
      <div className="card w-full max-w-md overflow-hidden">
        
        <div className="bg-brand-soft border-b border-line p-8 text-center">
          <div className="w-12 h-12 rounded-lg bg-brand flex items-center justify-center text-2xl mx-auto mb-3">
            🏫
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            School Portal
          </h1>
          <p className="eyebrow mt-1">
            Sign in to access your account
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="alert-error mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label block mb-1.5">
                Student ID / Staff ID
              </label>
              <input
                type="text" 
                required 
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="input"
                placeholder="e.g., T001, ADMIN, or AJ00001"
              />
              <p className="text-[10px] text-ink-faint mt-1.5">
                Staff: Staff ID | Admin: ADMIN | Parents: Any child's Index Number
              </p>
            </div>

            <div>
              <label className="label block mb-1.5">
                Password
              </label>
              <input
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
              <p className="text-[10px] text-ink-faint mt-1.5">
                Parents: Use your Guardian Phone Number (without spaces or dashes)
              </p>
            </div>

            <button
              type="submit" 
              disabled={loading}
              className="btn btn-primary w-full py-3 mt-4"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-[11px] text-ink-faint">
                Parents: Your password is your Guardian Phone Number
              </span>
            </div>
          </form>
        </div>

        <div className="bg-brand-soft border-t border-line p-4 text-center">
          <p className="text-[10px] text-ink-faint">
            Admin: Use "ADMIN" | Staff: Staff ID | Parents: Any child's Index + Phone Number
          </p>
        </div>

      </div>

    </div>
  );
}