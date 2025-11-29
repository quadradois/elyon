import {
  LayoutDashboard as LayoutDashboardIcon,
  Bot,
  Users,
  MessageSquare,
  Settings,
  LogOut,
  Building2,
  Menu,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { cn } from "../lib/utils";
import { WhatsAppStatusBadge } from "../componentes/WhatsAppStatusBadge";

interface LayoutDashboardProps {
  children: React.ReactNode;
}

export function LayoutDashboard({ children }: LayoutDashboardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const usuario = JSON.parse(localStorage.getItem("elyon_usuario") || "{}");
  const tenant = JSON.parse(localStorage.getItem("elyon_tenant") || "{}");

  const menuItems = [
    { icon: LayoutDashboardIcon, label: "Visão Geral", path: "/dashboard" },
    { icon: Bot, label: "Meu Agente", path: "/dashboard/agente" },
    { icon: Target, label: "Campanhas", path: "/dashboard/campanhas" },
    { icon: Building2, label: "Mineração", path: "/dashboard/mineracao" },
    { icon: Users, label: "Leads", path: "/dashboard/leads" },
    { icon: MessageSquare, label: "Conversas", path: "/dashboard/conversas" },
    {
      icon: Settings,
      label: "Configurações",
      path: "/dashboard/configuracoes",
    },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-50 transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                ELYON
              </span>
            )}
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-blue-600" : "text-slate-400"
                  )}
                />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* WhatsApp Status */}
        <div className="px-4 pb-2">
          {sidebarOpen ? (
            <WhatsAppStatusBadge />
          ) : (
            <div className="flex justify-center">
              {/* Versão compacta ou apenas ícone se necessário, mas o badge já trata responsividade interna se quisermos, 
                   aqui vamos ocultar ou mostrar simplificado. O badge atual tem texto, então melhor mostrar só se aberto 
                   ou criar uma versão 'icon-only' no badge. Por simplicidade, mostramos só quando aberto por enquanto 
                   ou deixamos o badge se virar com css. Vamos simplificar: só mostra se sidebarOpen. */}
              {/* Se quiser mostrar icone fechado, precisaria ajustar o componente badge. 
                   Vamos assumir que o usuário quer ver o texto. */}
            </div>
          )}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100">
          <div
            className={cn(
              "flex items-center gap-3",
              !sidebarOpen && "justify-center"
            )}
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <span className="font-medium text-sm text-slate-600">
                {usuario.nome?.charAt(0) || "U"}
              </span>
            </div>

            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {usuario.nome}
                </p>
                <p className="text-xs text-slate-500 truncate">{tenant.nome}</p>
              </div>
            )}

            {sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 min-h-screen flex flex-col",
          sidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        {/* Header Mobile / Toggle */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-4">
            {/* Breadcrumbs ou Ações aqui */}
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}
