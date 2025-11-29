import { Users, MessageSquare, TrendingUp, DollarSign } from "lucide-react";

export function DashboardHome() {
  const stats = [
    {
      label: "Total de Leads",
      value: "1,234",
      change: "+12%",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Conversas Ativas",
      value: "45",
      change: "+5%",
      icon: MessageSquare,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Taxa de Conversão",
      value: "15.3%",
      change: "+2.1%",
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Economia (Cache)",
      value: "R$ 450",
      change: "+R$ 120",
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
        <p className="text-slate-500">Bem-vindo de volta ao ELYON.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                {stat.value}
              </h3>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Placeholder Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96 flex items-center justify-center text-slate-400">
          Gráfico de Leads (Em breve)
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-96 flex items-center justify-center text-slate-400">
          Últimas Conversas (Em breve)
        </div>
      </div>
    </div>
  );
}
