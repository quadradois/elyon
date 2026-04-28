import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../componentes/ui/card";
import {
  Store,
  Ban,
  Phone,
  BarChart3,
  Coins,
  Shield,
  ChevronRight,
  Building2,
  FileText,
  Bell,
  Palette,
  Lock,
  Brain,
} from "lucide-react";
import { cn } from "../lib/utils";
import { PageHeader } from "../componentes/ui/page-header";

interface ConfigCard {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  path: string;
  badge?: string;
  badgeColor?: string;
}

export function Configuracao() {
  const navigate = useNavigate();

  // Cards de configuração do sistema
  const configCards: ConfigCard[] = [
    {
      id: "perfil-imobiliaria",
      titulo: "Perfil da Imobiliária",
      descricao: "Configure dados, diferenciais e políticas da sua imobiliária para o SDR IA",
      icon: Store,
      iconColor: "text-brand",
      iconBg: "bg-indigo-50",
      path: "/dashboard/perfil",
    },
    {
      id: "sessoes-whatsapp",
      titulo: "Sessões WhatsApp",
      descricao: "Gerencie conexões do WhatsApp e vincule a agentes",
      icon: Phone,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      path: "/dashboard/sessoes-whatsapp",
    },
    {
      id: "blacklist",
      titulo: "Blacklist",
      descricao: "Gerencie números bloqueados para prospecção",
      icon: Ban,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      path: "/dashboard/blacklist",
    },
    {
      id: "creditos",
      titulo: "Créditos e Faturamento",
      descricao: "Veja saldo, histórico de uso e compre mais créditos",
      icon: Coins,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      path: "/dashboard/creditos",
    },
    {
      id: "relatorios",
      titulo: "Relatórios e Métricas",
      descricao: "Análise de desempenho e indicadores do sistema",
      icon: BarChart3,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      path: "/dashboard/relatorios",
    },
    {
      id: "integracoes",
      titulo: "Integrações",
      descricao: "Conecte com CRMs, portais e APIs externas",
      icon: FileText,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      path: "/dashboard/integracoes",
      badge: "Novo",
      badgeColor: "bg-emerald-100 text-emerald-700",
    },
    {
      id: "byok-llm",
      titulo: "Provedor de IA (BYOK)",
      descricao: "Use sua própria API Key de OpenAI ou OpenRouter",
      icon: Brain,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      path: "/dashboard/configuracao-llm",
    },
  ];

  // Cards em breve (futuras funcionalidades)
  const emBreveCards: ConfigCard[] = [
    {
      id: "notificacoes",
      titulo: "Notificações",
      descricao: "Configure alertas e preferências de notificação",
      icon: Bell,
      iconColor: "text-slate-400",
      iconBg: "bg-slate-100",
      path: "#",
      badge: "Em breve",
      badgeColor: "bg-slate-200 text-slate-600",
    },
    {
      id: "aparencia",
      titulo: "Aparência",
      descricao: "Personalize cores e tema da interface",
      icon: Palette,
      iconColor: "text-slate-400",
      iconBg: "bg-slate-100",
      path: "#",
      badge: "Em breve",
      badgeColor: "bg-slate-200 text-slate-600",
    },
    {
      id: "seguranca",
      titulo: "Segurança",
      descricao: "Altere senha, autenticação e permissões",
      icon: Lock,
      iconColor: "text-slate-400",
      iconBg: "bg-slate-100",
      path: "#",
      badge: "Em breve",
      badgeColor: "bg-slate-200 text-slate-600",
    },
  ];

  const renderCard = (card: ConfigCard, disabled: boolean = false) => {
    const Icon = card.icon;

    return (
      <Card
        key={card.id}
        className={cn(
          "group relative overflow-hidden transition-all duration-300",
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300 hover:-translate-y-1"
        )}
        onClick={() => !disabled && navigate(card.path)}
      >
        {/* Gradiente decorativo */}
        <div className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-300",
          !disabled && "group-hover:opacity-100"
        )}>
          <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full bg-gradient-to-br from-blue-50 to-transparent" />
        </div>

        <CardHeader className="relative pb-2">
          <div className="flex items-start justify-between">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300",
              card.iconBg,
              !disabled && "group-hover:scale-110"
            )}>
              <Icon className={cn("w-6 h-6", card.iconColor)} />
            </div>

            {card.badge ? (
              <span className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                card.badgeColor || "bg-indigo-100 text-indigo-700"
              )}>
                {card.badge}
              </span>
            ) : (
              <ChevronRight className={cn(
                "w-5 h-5 text-slate-300 transition-all duration-300",
                !disabled && "group-hover:text-slate-500 group-hover:translate-x-1"
              )} />
            )}
          </div>
        </CardHeader>

        <CardContent className="relative pt-2">
          <CardTitle className="text-base font-semibold text-slate-900 mb-1">
            {card.titulo}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 line-clamp-2">
            {card.descricao}
          </CardDescription>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações do sistema e integrações"
        icon={<Building2 className="w-5 h-5" />}
      />

      {/* Cards Ativos */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          Configurações do Sistema
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configCards.map((card) => renderCard(card))}
        </div>
      </div>

      {/* Cards Em Breve */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Em Desenvolvimento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {emBreveCards.map((card) => renderCard(card, true))}
        </div>
      </div>

      {/* Ajuda */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-indigo-100">
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Precisa de ajuda?</h3>
              <p className="text-sm text-slate-600">
                Acesse nossa documentação ou entre em contato com o suporte
              </p>
            </div>
          </div>
          <button
            onClick={() => window.open("https://elyon.ia.br", "_blank")}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            Ver Documentação
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
