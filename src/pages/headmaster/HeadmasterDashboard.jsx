import HeadmasterLayout from "../../components/HeadmasterLayout";

export default function HeadmasterDashboard() {
  const stats = [
    { 
      label: "Total Classes", 
      value: "0", 
      subtext: "Configured across grades",
      badge: "Classes",
      icon: (
        <svg className="w-5 h-5 text-sky-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    { 
      label: "Active Term", 
      value: "None", 
      subtext: "Academic calendar status",
      badge: "Term Status",
      icon: (
        <svg className="w-5 h-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      label: "Attendance Today", 
      value: "0%", 
      subtext: "Recorded student ratio",
      badge: "Daily Metric",
      icon: (
        <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-6 9l2 2 4-4" />
        </svg>
      )
    },
  ];

  return (
    <HeadmasterLayout>
      <div className="space-y-8">
        
        {/* Welcome Section */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-slate-900 tracking-tight">
              Headmaster Overview
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Welcome back. Here is a summary of your primary school management metrics today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              System Ready
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {stats.map((card) => (
            <div 
              key={card.label} 
              className="bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {card.badge}
                  </span>
                  <div className="p-2 rounded-md bg-slate-50 border border-slate-100">
                    {card.icon}
                  </div>
                </div>

                <p className="font-serif text-3xl font-bold text-slate-900 mt-4 tracking-tight">
                  {card.value}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700">{card.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{card.subtext}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </HeadmasterLayout>
  );
}