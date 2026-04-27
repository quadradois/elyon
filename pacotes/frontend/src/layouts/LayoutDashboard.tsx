import {
  Bot,
  Users,
  LogOut,
  Building2,
  Menu,
  Sparkles,
  BarChart3,
  Zap,
  Receipt,
  UserPlus,
  Package,
  Coins,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Phone,
  Store,
  Circle,
  Crown,
  Briefcase,
  Calendar,
  UserCog,
  ShieldCheck,
} from "lucide-react";

// ... (código intermediário omitido, vou usar replace separado para o ícone e menu se for longe)
// Na verdade, vou fazer em dois chunks se for muito distantes.
// Linha 26 é imports.
// Linha 158 é onde entra o menu.
// Vou fazer um multi_replace.

import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { cn } from "../lib/utils";
import { WhatsAppStatusBadge } from "../componentes/WhatsAppStatusBadge";
import { NotificacoesDropdown } from "../componentes/NotificacoesDropdown";
import { CreditosIndicador } from "../componentes/CreditosIndicador";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../componentes/ui/tooltip";
import { ModalUpgrade } from "../componentes/ModalUpgrade";

interface LayoutDashboardProps {
  children: React.ReactNode;
}

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  destaque?: boolean;
  badge?: number;
}

interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
  defaultExpanded?: boolean;
}

export function LayoutDashboard({ children }: LayoutDashboardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estado de seções colapsadas (salva no localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("elyon_sidebar_collapsed");
    return saved ? JSON.parse(saved) : {};
  });

  const usuario = JSON.parse(localStorage.getItem("elyon_usuario") || "{}");
  const tenant = JSON.parse(localStorage.getItem("elyon_tenant") || "{}");

  // Salvar estado das seções colapsadas
  useEffect(() => {
    localStorage.setItem("elyon_sidebar_collapsed", JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (collapsedSections["userMenu"]) {
          setCollapsedSections(prev => ({ ...prev, userMenu: false }));
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [collapsedSections]);

  // Accordion exclusivo: ao abrir uma seção, fecha as outras
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const isCurrentlyCollapsed = prev[sectionId] ?? true;

      // Se está fechada (collapsed) e vai abrir, fecha todas as outras
      if (isCurrentlyCollapsed) {
        // Cria novo estado com todas as seções fechadas, exceto a clicada
        const newState: Record<string, boolean> = {};
        menuSections.forEach(section => {
          newState[section.id] = section.id !== sectionId; // true = collapsed
        });
        // Também fechar seção admin se existir
        newState['admin'] = sectionId !== 'admin';
        // Preservar userMenu
        newState['userMenu'] = prev['userMenu'] || false;
        return newState;
      } else {
        // Se está expandida e vai fechar, apenas fecha ela
        return {
          ...prev,
          [sectionId]: true // collapsed = true
        };
      }
    });
  };

  // === DEFINIÇÃO DAS SEÇÕES DO MENU ===
  const menuSections: MenuSection[] = [
    // === CAPTAÇÃO ===
    {
      id: "captacao",
      label: "Captação",
      defaultExpanded: true,
      items: [
        {
          icon: Sparkles,
          label: "Mineração",
          path: "/dashboard/mineracao",
        },
        {
          icon: Building2,
          label: "Campanhas",
          path: "/dashboard/campanhas",
        }
      ],
    },
    // === FUNIL ===
    {
      id: "funil",
      label: "Funil",
      defaultExpanded: true,
      items: [
        {
          icon: Users,
          label: "Proprietários",
          path: "/dashboard/proprietarios",
          destaque: true,
        },
        {
          icon: Calendar,
          label: "Agenda",
          path: "/dashboard/agenda",
        },
      ],
    },
    // === GESTÃO ===
    {
      id: "gestao",
      label: "Gestão",
      defaultExpanded: true,
      items: [
        {
          icon: Briefcase,
          label: "Carteira Clientes",
          path: "/dashboard/clientes",
        },
        {
          icon: BarChart3,
          label: "Relatórios",
          path: "/dashboard/relatorios",
        },
        {
          icon: Bot,
          label: "Cockpit IA",
          path: "/dashboard/cockpit-ia",
        },
        {
          icon: Bot,
          label: "Agentes",
          path: "/dashboard/agentes",
        },
        {
          icon: Coins,
          label: "Créditos",
          path: "/dashboard/creditos",
        },
        {
          icon: Crown,
          label: "Meu Plano",
          path: "/dashboard/upgrade",
          destaque: true,
        },
        ...((["ADMIN", "SUPER_ADMIN"].includes(usuario.papel)) ? [{
          icon: UserCog,
          label: "Equipe",
          path: "/dashboard/equipe",
        }] : []),
      ],
    },
    // === CONFIG ===
    {
      id: "config",
      label: "Config",
      defaultExpanded: true,
      items: [
        {
          icon: Phone,
          label: "WhatsApp",
          path: "/dashboard/sessoes-whatsapp",
        },
        {
          icon: Settings,
          label: "Configurações",
          path: "/dashboard/configuracoes",
        }
      ],
    },
  ];

  // Menu Admin (só aparece para SUPER_ADMIN)
  const menuAdmin: MenuItem[] = [
    {
      icon: Users,
      label: "Clientes",
      path: "/admin/clientes",
    },
    {
      icon: Receipt,
      label: "Transações",
      path: "/admin/transacoes",
    },
    {
      icon: UserPlus,
      label: "Contatos Site",
      path: "/admin/leads-vip",
    },
    {
      icon: Package,
      label: "Pacotes",
      path: "/admin/pacotes",
    },
    {
      icon: ShieldCheck,
      label: "Auditoria",
      path: "/admin/auditoria",
    },
    {
      icon: Coins,
      label: "Planos",
      path: "/admin/planos",
    },
  ];

  const isSuperAdmin = usuario.papel === "SUPER_ADMIN";

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // Verifica se algum item da seção está ativo
  const isSectionActive = (section: MenuSection) => {
    return section.items.some(item =>
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    );
  };

  // Componente wrapper para tooltip condicional
  const ConditionalTooltip = ({
    children,
    content,
    enabled
  }: {
    children: React.ReactNode;
    content: string;
    enabled: boolean;
  }) => {
    if (!enabled) return <>{children}</>;

    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {content}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Renderiza um item de menu
  const renderMenuItem = (item: MenuItem, isActive: boolean) => {
    const Icon = item.icon;
    const isDestaque = item.destaque;

    const menuItem = (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative group border border-transparent",
          isActive
            ? isDestaque
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md border-amber-400/30"
              : "bg-slate-800 text-white shadow-inner"
            : isDestaque
              ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        )}
      >
        {/* Indicador lateral de item ativo */}
        {isActive && !isDestaque && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />
        )}

        <Icon
          className={cn(
            "w-4 h-4 shrink-0 transition-colors",
            isActive
              ? isDestaque
                ? "text-white"
                : "text-indigo-400"
              : isDestaque
                ? "text-amber-500"
                : "text-slate-500 group-hover:text-slate-300"
          )}
        />
        {sidebarOpen && (
          <span className="truncate flex-1">{item.label}</span>
        )}

        {/* Badge de contagem */}
        {item.badge && item.badge > 0 && sidebarOpen && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
    );

    // Adiciona tooltip quando sidebar está fechada
    if (!sidebarOpen) {
      return (
        <ConditionalTooltip key={item.path} content={item.label} enabled={true}>
          {menuItem}
        </ConditionalTooltip>
      );
    }

    return menuItem;
  };

  // Renderiza uma seção do menu
  const renderSection = (section: MenuSection) => {
    const isCollapsed = collapsedSections[section.id] ?? !section.defaultExpanded;
    const hasActiveItem = isSectionActive(section);

    return (
      <div key={section.id} className="space-y-1">
        {/* Header da Seção (clicável para colapsar) */}
        {sidebarOpen ? (
          <button
            onClick={() => toggleSection(section.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200",
              "hover:bg-slate-800 group",
              hasActiveItem && !isCollapsed && "bg-slate-800/50"
            )}
          >
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider transition-colors",
              hasActiveItem ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
            )}>
              {section.label}
            </span>
            <span className={cn(
              "transition-transform duration-200",
              hasActiveItem ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300",
              !isCollapsed && "rotate-0"
            )}>
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>
        ) : (
          <div className="flex justify-center py-2">
            <div className="w-8 border-t border-slate-800" />
          </div>
        )}

        {/* Itens da Seção com animação */}
        {(!isCollapsed || !sidebarOpen) && (
          <div className={cn(
            "space-y-0.5 transition-all duration-200",
            sidebarOpen && "pl-2"
          )}>
            {section.items.map((item) => {
              const isActive =
                location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return renderMenuItem(item, isActive);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      {/* Modal de Upgrade (aparece após login para não-PRO) */}
      <ModalUpgrade />

      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside
          style={{ backgroundColor: '#0f172a', borderRightColor: '#1e293b' }}
          className={cn(
            "border-r fixed inset-y-0 left-0 z-50 transition-all duration-300 flex flex-col shadow-xl",
            sidebarOpen ? "w-64" : "w-[72px]"
          )}
        >
          {/* Logo */}
          <div className="h-16 flex items-center px-5 border-b border-slate-800">
            <Link to="/dashboard/prospeccao" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shrink-0 shadow-glow-primary">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <span className="font-bold text-xl text-white tracking-tight">
                  ELYON
                </span>
              )}
            </Link>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {/* Dashboard Principal */}
            <ConditionalTooltip content="Dashboard" enabled={!sidebarOpen}>
              <Link
                to="/dashboard/prospeccao"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium relative",
                  location.pathname === "/dashboard/prospeccao"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow-primary"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Zap
                  className={cn(
                    "w-5 h-5 shrink-0",
                    location.pathname === "/dashboard/prospeccao"
                      ? "text-white"
                      : "text-indigo-400 group-hover:text-indigo-300"
                  )}
                />
                {sidebarOpen && "Dashboard"}
              </Link>
            </ConditionalTooltip>

            {/* Separador visual */}
            <div className="py-2">
              <div className={cn(
                "border-t border-slate-800",
                !sidebarOpen && "mx-2"
              )} />
            </div>

            {/* Seções colapsáveis */}
            {menuSections.map(renderSection)}

            {/* Grupo: Admin (apenas SUPER_ADMIN) */}
            {isSuperAdmin && (
              <div className="space-y-1 pt-2">
                {sidebarOpen ? (
                  <button
                    onClick={() => toggleSection("admin")}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-slate-800 group"
                  >
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      Admin
                    </span>
                    <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
                      {collapsedSections["admin"] ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>
                ) : (
                  <div className="flex justify-center py-2">
                    <div className="w-8 border-t border-slate-800" />
                  </div>
                )}

                {(!collapsedSections["admin"] || !sidebarOpen) && (
                  <div className={cn("space-y-0.5", sidebarOpen && "pl-2")}>
                    {menuAdmin.map((item) => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;

                      const adminItem = (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative group border border-transparent",
                            isActive
                              ? "bg-slate-800 text-white shadow-inner"
                              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                          )}
                          <Icon
                            className={cn(
                              "w-4 h-4 shrink-0 transition-colors",
                              isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"
                            )}
                          />
                          {sidebarOpen && item.label}
                        </Link>
                      );

                      if (!sidebarOpen) {
                        return (
                          <ConditionalTooltip key={item.path} content={item.label} enabled={true}>
                            {adminItem}
                          </ConditionalTooltip>
                        );
                      }

                      return adminItem;
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* WhatsApp Status - Sempre visível */}
          <div className="px-3 pb-2">
            {sidebarOpen ? (
              <WhatsAppStatusBadge />
            ) : (
              <ConditionalTooltip content="Status WhatsApp" enabled={true}>
                <Link
                  to="/dashboard/sessoes-whatsapp"
                  className="flex justify-center p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="relative">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <Circle className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 fill-green-500 text-emerald-500" />
                  </div>
                </Link>
              </ConditionalTooltip>
            )}
          </div>

          {/* User Footer com Dropdown */}
          <div ref={dropdownRef} className="p-3 border-t border-slate-800 relative bg-slate-900">
            {/* Dropdown Menu (aparece acima do footer quando aberto) */}
            {sidebarOpen && collapsedSections["userMenu"] && (
              <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                <div className="p-2">
                  <Link
                    to="/dashboard/perfil"
                    onClick={() => toggleSection("userMenu")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition-colors text-sm text-slate-200"
                  >
                    <Store className="w-4 h-4 text-indigo-400" />
                    Perfil da Imobiliária
                  </Link>
                  <Link
                    to="/dashboard/configuracoes"
                    onClick={() => toggleSection("userMenu")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition-colors text-sm text-slate-200"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Configurações
                  </Link>
                </div>
                <div className="border-t border-slate-700 p-2">
                  <button
                    onClick={() => {
                      toggleSection("userMenu");
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-900/30 transition-colors text-sm text-red-400 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da conta
                  </button>
                </div>
              </div>
            )}

            {/* Footer clicável */}
            <ConditionalTooltip content={usuario.nome || "Menu do usuário"} enabled={!sidebarOpen}>
              <button
                onClick={() => sidebarOpen && toggleSection("userMenu")}
                className={cn(
                  "flex items-center gap-3 w-full rounded-xl transition-all duration-200",
                  sidebarOpen
                    ? "p-2 hover:bg-slate-800 cursor-pointer"
                    : "justify-center p-2",
                  collapsedSections["userMenu"] && "bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md",
                  !sidebarOpen && "w-9 h-9"
                )}>
                  <span className="font-semibold text-sm text-white">
                    {usuario.nome?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>

                {sidebarOpen && (
                  <>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-white truncate">
                        {usuario.nome}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{tenant.nome}</p>
                    </div>
                    <span className={cn(
                      "text-slate-400 transition-transform duration-200",
                      collapsedSections["userMenu"] && "rotate-180"
                    )}>
                      <ChevronUp className="w-4 h-4" />
                    </span>
                  </>
                )}
              </button>
            </ConditionalTooltip>

            {/* Logout direto quando sidebar fechada */}
            {!sidebarOpen && (
              <ConditionalTooltip content="Sair" enabled={true}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 mt-2 mx-auto"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </ConditionalTooltip>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            "flex-1 transition-all duration-300 min-h-screen flex flex-col",
            sidebarOpen ? "ml-64" : "ml-[72px]"
          )}
        >
          {/* Header Mobile / Toggle */}
          <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-40">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-4">
              {/* Indicador de Créditos */}
              <CreditosIndicador />

              {/* Notificações em tempo real */}
              <NotificacoesDropdown />
            </div>
          </header>

          {/* Page Content */}
          <div className="p-8 flex-1">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
