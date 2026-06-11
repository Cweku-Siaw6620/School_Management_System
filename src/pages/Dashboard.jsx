import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-md text-center">
        <h1 className="text-2xl font-bold text-blue-700 mb-2">Welcome 👋</h1>
        <p className="text-gray-600 mb-1">Email: {currentUser?.email}</p>
        <p className="text-gray-600 mb-6">Role: <span className="font-semibold capitalize">{userRole}</span></p>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>
    </div>
  );
}