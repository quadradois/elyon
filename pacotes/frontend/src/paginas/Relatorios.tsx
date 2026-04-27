import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Zap,
  Target,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/componentes/ui/card";
import { Button } from "@/componentes/ui/button";
import { Badge } from "@/componentes/ui/badge";
import { SkeletonDashboard } from "@/componentes/ui/skeleton";
import { EmptyState } from "@/componentes/ui/empty-state";
import { toast } from "sonner";
import { api } from "@/servicos/api";

// ============================================
// TIPOS
// ============================================

interface MetricasDashboard {
  resumo: {
    leads: {
      total: number;
      semana: number;
      mes: number;
      convertidos: number;
      qualificados: number;
      taxaConversao: string;
    };
    campanhas: {
      total: number;
      ativas: number;
    };
    conversas: {
      total: number;
      semana: number;
    };
    assertiva: {
      consultasMes: number;
      doCache: number;
      economiaEstimada: string;
      taxaCache: string;
    };
  };
  topCampanhas: Array<{
    id: string;
    nome: string;
    leads: number;
    contatos: number;
    status: string;
    criadoEm: string;
  }>;
  leadsPorStatus: Array<{
    status: string;
    quantidade: number;
  }>;
  historicoSemanal: Array<{
    dia: string;
    leads: number;
  }>;
  atualizadoEm: string;
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function CardMetrica({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  variacao,
  cor = "blue"
}: {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icone: React.ElementType;
  variacao?: { valor: number; tipo: "up" | "down" };
  cor?: "blue" | "green" | "yellow" | "purple" | "red";
}) {
  const coresFundo = {
    blue:   "bg-indigo-100",
    green:  "bg-emerald-100",
    yellow: "bg-amber-100",
    purple: "bg-violet-100",
    red:    "bg-red-100"
  };
  
  const coresIcone = {
    blue:   "text-indigo-600",
    green:  "text-emerald-600",
    yellow: "text-amber-600",
    purple: "text-violet-600",
    red:    "text-red-600"
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{titulo}</p>
            <p className="text-3xl font-bold text-slate-900">{valor}</p>
            {subtitulo && (
              <p className="text-xs text-slate-500">{subtitulo}</p>
            )}
            {variacao && (
              <div className={`flex items-center gap-1 text-xs ${
                variacao.tipo === "up" ? "text-emerald-600" : "text-red-600"
              }`}>
                {variacao.tipo === "up" ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>{variacao.valor}% vs semana passada</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${coresFundo[cor]}`}>
            <Icone className={`w-6 h-6 ${coresIcone[cor]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarraStatus({ status, quantidade, total }: { status: string; quantidade: number; total: number }) {
  const porcentagem = total > 0 ? (quantidade / total) * 100 : 0;
  
  const cores: Record<string, string> = {
    NOVO:          "bg-indigo-500",
    TENTATIVA_AGENDAMENTO: "bg-amber-500",
    DOCUMENTACAO: "bg-orange-500",
    CAPTADO:    "bg-emerald-500",
    PERDIDO:       "bg-danger",
    ARQUIVADO:       "bg-slate-400"
  };
  
  const labels: Record<string, string> = {
    NOVO: "Novos",
    TENTATIVA_AGENDAMENTO: "Em alinhamento",
    DOCUMENTACAO: "Documentação",
    CAPTADO: "Captados",
    PERDIDO: "Perdidos",
    ARQUIVADO: "Arquivados"
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{labels[status] || status}</span>
        <span className="font-medium">{quantidade}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${cores[status] || "bg-slate-400"} transition-all duration-500`}
          style={{ width: `${porcentagem}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function Relatorios() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<MetricasDashboard | null>(null);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro("");
      
      const response = await api.get("/metricas/dashboard");
      setDados(response.data);
      
    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
      setErro("Não foi possível carregar as métricas. Tente novamente.");
      toast.error("Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ============================================
  // LOADING STATE
  // ============================================
  
  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in-50 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-brand" />
              Painel Gerencial
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Carregando métricas...
            </p>
          </div>
        </div>
        
        <SkeletonDashboard />
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  
  if (erro || !dados) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-slate-600">{erro || "Erro ao carregar dados"}</p>
        <Button onClick={carregarDados} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  const { resumo, topCampanhas, leadsPorStatus } = dados;
  const totalLeadsPorStatus = leadsPorStatus.reduce((acc, l) => acc + l.quantidade, 0);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-brand" />
            Painel Gerencial
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visão geral de leads, campanhas e performance
          </p>
        </div>
        <Button onClick={carregarDados} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardMetrica
          titulo="Total de Leads"
          valor={resumo.leads.total}
          subtitulo={`+${resumo.leads.semana} esta semana`}
          icone={Users}
          cor="blue"
        />
        
        <CardMetrica
          titulo="Conversas WhatsApp"
          valor={resumo.conversas.total}
          subtitulo={`${resumo.conversas.semana} iniciadas esta semana`}
          icone={MessageSquare}
          cor="green"
        />
        
        <CardMetrica
          titulo="Taxa de Conversão"
          valor={resumo.leads.taxaConversao}
          subtitulo={`${resumo.leads.convertidos} leads convertidos`}
          icone={TrendingUp}
          cor="purple"
        />
        
        <CardMetrica
          titulo="Campanhas Ativas"
          valor={resumo.campanhas.ativas}
          subtitulo={`de ${resumo.campanhas.total} campanhas`}
          icone={Target}
          cor="yellow"
        />
      </div>

      {/* Seção: Atividade Recente + Leads por Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card Atividade e Produtividade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-violet-500" />
              Atividade e Produtividade
            </CardTitle>
            <CardDescription>
              Resumo de atividades do mês
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-violet-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-violet-600">
                  {resumo.assertiva.consultasMes}
                </p>
                <p className="text-xs text-slate-500">CPFs enriquecidos</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-brand">
                  {resumo.campanhas.ativas}
                </p>
                <p className="text-xs text-slate-500">Campanhas ativas</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Leads este mês</p>
                    <p className="text-xs text-slate-500">Mineração automática</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  +{resumo.leads.mes}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Target className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Taxa de conversão</p>
                    <p className="text-xs text-slate-500">Lead → Oportunidade</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-brand">
                  {resumo.leads.total > 0 
                    ? Math.round((resumo.leads.convertidos / resumo.leads.total) * 100) 
                    : 0}%
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Média diária</p>
                    <p className="text-xs text-slate-500">Leads minerados/dia</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-amber-600">
                  {Math.round(resumo.leads.mes / 30)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Leads por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-indigo-500" />
              Leads por Status
            </CardTitle>
            <CardDescription>
              Distribuição do funil de vendas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {leadsPorStatus.length > 0 ? (
              leadsPorStatus
                .sort((a, b) => b.quantidade - a.quantidade)
                .map((item) => (
                  <BarraStatus
                    key={item.status}
                    status={item.status}
                    quantidade={item.quantidade}
                    total={totalLeadsPorStatus}
                  />
                ))
            ) : (
              <EmptyState 
                tipo="nenhum-lead"
                titulo="Nenhum lead ainda"
                descricao="Comece minerando propriedades para criar seus primeiros leads."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção: Top Campanhas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5 text-violet-500" />
            Top Campanhas
          </CardTitle>
          <CardDescription>
            Campanhas com mais leads gerados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topCampanhas.length > 0 ? (
            <div className="space-y-3">
              {topCampanhas.map((campanha, index) => (
                <div 
                  key={campanha.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? "bg-warning" :
                      index === 1 ? "bg-slate-400" :
                      index === 2 ? "bg-amber-700" :
                      "bg-slate-300"
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{campanha.nome}</p>
                      <p className="text-xs text-slate-500">
                        Criada em {new Date(campanha.criadoEm).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{campanha.leads}</p>
                      <p className="text-xs text-slate-500">leads</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-700">{campanha.contatos}</p>
                      <p className="text-xs text-slate-500">contatos</p>
                    </div>
                    <Badge variant={campanha.status === "ATIVA" ? "default" : "secondary"}>
                      {campanha.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState 
              tipo="nenhuma-campanha"
              titulo="Nenhuma campanha criada"
              descricao="Crie sua primeira campanha no Wizard de Captação"
            />
          )}
        </CardContent>
      </Card>

      {/* Rodapé com última atualização */}
      <div className="text-center text-xs text-slate-400">
        Última atualização: {new Date(dados.atualizadoEm).toLocaleString('pt-BR')}
      </div>
    </div>
  );
}

export default Relatorios;
