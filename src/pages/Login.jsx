import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Fetch role and redirect accordingly
      const docSnap = await getDoc(doc(db, "users", uid));
      if (docSnap.exists()) {
        const role = docSnap.data().role;
        if (role === "admin")       navigate("/admin/dashboard");
        else if (role === "headmaster") navigate("/headmaster/dashboard");
        else if (role === "teacher")    navigate("/teacher/attendance");
        else if (role === "parent")     navigate("/parent/dashboard");
        else navigate("/unauthorized");
      } else {
        setError("Account record not found. Please contact the school administrator.");
      }
    } catch (err) {
      setError("Invalid email address or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased flex flex-col justify-center items-center p-4 text-slate-800">
      
      {/* Container Card */}
      <div className="w-full max-w-md bg-white rounded-lg border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-slate-50/50 border-b border-slate-100 p-8 text-center">
          <div className="w-12 h-12 rounded-md bg-sky-900 border border-sky-800 flex items-center justify-center text-amber-300 font-serif font-bold text-2xl shadow-xs mx-auto mb-3">
            🏫
          </div>
          <h1 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
            School Management System
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-medium">
            Primary School Portal
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3.5 rounded-md bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <input
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-800/20 focus:border-sky-800 bg-slate-50/30 transition-colors"
                placeholder="you@school.edu.gh"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <input
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-800/20 focus:border-sky-800 bg-slate-50/30 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" 
              disabled={loading}
              className="w-full bg-sky-900 hover:bg-sky-950 text-white font-semibold text-xs py-3 px-4 rounded-md transition-colors shadow-2xs disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
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
                "Sign In to Portal"
              )}
            </button>
          </form>
        </div>

        {/* Footer Note */}
        <div className="bg-slate-50/50 border-t border-slate-100 p-4 text-center">
          <p className="text-[11px] text-slate-400">
            Academic Year Management & Record Portal
          </p>
        </div>

      </div>

    </div>
  );
}