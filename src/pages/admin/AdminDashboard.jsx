import AdminLayout from "../../components/AdminLayout";

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: "Total Students", value: "0" },
          { label: "Total Staff",    value: "0" },
          { label: "New This Term",  value: "0" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl shadow p-6">
            <p className="text-sm text-gray-400">{card.label}</p>
            <p className="text-3xl font-bold text-gray-700 mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}