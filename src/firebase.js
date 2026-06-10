// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDgxoH7IFqup0_YFK67FGC2Rv_320WTWb4",
  authDomain: "school-ms-aab5a.firebaseapp.com",
  projectId: "school-ms-aab5a",
  storageBucket: "school-ms-aab5a.firebasestorage.app",
  messagingSenderId: "237378644146",
  appId: "1:237378644146:web:84e940f8ec094360a341ab",
  measurementId: "G-801Y3QTRPF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);