// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [staffId, setStaffId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      
      if (user) {
        setCurrentUser(user);
        
        try {
          // Fetch user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userDataFromDb = userDoc.data();
            setUserRole(userDataFromDb.role);
            setUserData(userDataFromDb);
            
            // If user is staff, fetch staff data including Staff ID
            if (userDataFromDb.role !== 'parent') {
              const staffQuery = query(
                collection(db, "staff"),
                where("email", "==", user.email)
              );
              const staffSnapshot = await getDocs(staffQuery);
              
              if (!staffSnapshot.empty) {
                const staffData = staffSnapshot.docs[0].data();
                setStaffId(staffData.staffId || null);
                setUserData(prev => ({ ...prev, ...staffData }));
              }
            } else {
              // For parents, fetch student data
              const studentsQuery = query(
                collection(db, "students"),
                where("parentUid", "==", user.uid)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              
              if (!studentsSnapshot.empty) {
                const studentData = studentsSnapshot.docs[0].data();
                setStaffId(studentData.indexNumber || null);
                setUserData(prev => ({ ...prev, studentData }));
              }
            }
          } else {
            setUserRole(null);
            setUserData(null);
            setStaffId(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUserRole(null);
          setUserData(null);
          setStaffId(null);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserData(null);
        setStaffId(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userData,
    staffId,
    loading,
    // Helper to check if user is staff
    isStaff: userRole && userRole !== 'parent',
    // Helper to check if user is parent
    isParent: userRole === 'parent',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};