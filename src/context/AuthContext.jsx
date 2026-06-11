import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed:", user);
  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    console.log("Firestore doc exists:", docSnap.exists());
    console.log("Firestore data:", docSnap.data());
    if (docSnap.exists()) {
      setUserRole(docSnap.data().role);
    }
    setCurrentUser(user);
  } else {
    setCurrentUser(null);
    setUserRole(null);
  }
  setLoading(false);
});

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}