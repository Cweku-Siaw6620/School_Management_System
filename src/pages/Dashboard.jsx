import AdminLayout from "../components/AdminLayout";

export default function Dashboard() {
  return (
    <AdminLayout>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Students", value: "0", color: "bg-blue-500" },
          { label: "Total Teachers", value: "0", color: "bg-green-500" },
          { label: "Total Classes", value: "0", color: "bg-yellow-500" },
          { label: "Active Term", value: "None", color: "bg-purple-500" },
        ].map((card) => (
          <div key={card.label} className={`${card.color} text-white rounded-2xl p-6 shadow`}>
            <p className="text-sm font-medium opacity-80">{card.label}</p>
            <p className="text-3xl font-bold mt-2">{card.value}</p>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}