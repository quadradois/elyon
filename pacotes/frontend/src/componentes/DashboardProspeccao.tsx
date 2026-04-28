/**
 * Dashboard de Métricas de Prospecção Ativa
 * 
 * Visualização em tempo real das métricas de campanhas de prospecção
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { PageHeader } from "./ui/page-header";
import { SkeletonKPI } from "./ui/skeletons/SkeletonKPI";
import { SkeletonLead } from "./ui/skeletons/SkeletonLead";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  UserCheck,
  UserX,
  Clock,
  Zap,
  RefreshCw,
  Phone,
  Calendar,
  Target,
  Flame,
  MapPin,
  ChevronRight
} from "lucide-react";
import { api, isRequestCanceled } from "../servicos/api";

// ============================================
// TIPOS
// ============================================

interface MetricasCampanha {
  campanhaId: string;
  nomeCampanha: string;
  status: string;
  total: number;
  aguardando: number;
  contatando: number;
  respondeu: number;
  semInteresse: number;
  interessado: number;
  optout: number;
  falha: number;
}

interface MetricasGlobais {
  totalCampanhas: number;
  campanhasAtivas: number;
  totalContatos: number;
  totalDisparados: number;
  totalRespostas: number;
  totalInteressados: number;
  totalOptout: number;
  taxaResposta: number;
  taxaConversao: number;
  taxaOptout: number;
}

interface MetricasBlacklist {
  total: number;
  porMotivo: Record<string, number>;
}

interface FunilProspeccao {
  aguardando: number;
  contatando: number;
  respondeu: number;
  interessado: number;
  mornoFuturo: number;
  lead: number;
  optout: number;
  semInteresse: number;
}

interface LeadQuente {
  id: string;
  nome: string;
  telefone: string;
  temperatura: string;
  status: string;
  campanha: {
    id: string;
    nome: string;
    empreendimento: string;
  } | null;
  imovel: {
    endereco: string;
    bairro: string;
  } | null;
  reuniaoAgendada: {
    id: string;
    titulo: string;
    agendadoPara: string;
  } | null;
  criadoEm: string;
}

interface AvaliacaoAgendada {
  id: string;
  titulo: string;
  descricao: string;
  agendadoPara: string;
  lead: {
    id: string;
    nome: string;
    telefone: string;
    temperatura: string;
  };
  campanha: {
    nome: string;
    empreendimento: string;
  } | null;
  imovel: {
    endereco: string;
    bairro: string;
  } | null;
  criadoEm: string;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function DashboardProspeccao() {
  const navigate = useNavigate();
  const [metricas, setMetricas] = useState<MetricasGlobais | null>(null);
  const [campanhas, setCampanhas] = useState<MetricasCampanha[]>([]);
  const [blacklist, setBlacklist] = useState<MetricasBlacklist | null>(null);
  const [funil, setFunil] = useState<FunilProspeccao | null>(null);
  const [leadsQuentes, setLeadsQuentes] = useState<LeadQuente[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAgendada[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  // ============================================
  // BUSCAR DADOS
  // ============================================

  const buscarDados = useCallback(async (silencioso = false, signal?: AbortSignal) => {
    if (!silencioso) setLoading(true);
    setAtualizando(true);

    try {
      // Buscar campanhas com métricas
      const resCampanhas = await api.get('/campanhas', { signal });
      const campanhasData = resCampanhas.data.campanhas || [];
      
      // Buscar status de cada campanha ativa
      const campanhasComMetricas: MetricasCampanha[] = [];
      let totalContatos = 0;
      let totalDisparados = 0;
      let totalRespostas = 0;
      let totalInteressados = 0;
      let totalOptout = 0;
      
      for (const campanha of campanhasData) {
        try {
          const resStatus = await api.get(`/campanhas/${campanha.id}/status-disparo`, { signal });
          const status = resStatus.data.status;
          
          campanhasComMetricas.push({
            campanhaId: campanha.id,
            nomeCampanha: campanha.nome,
            status: campanha.status,
            ...status
          });
          
          totalContatos += status.total || 0;
          totalDisparados += (status.contatando || 0) + (status.respondeu || 0) + 
                           (status.semInteresse || 0) + (status.interessado || 0) + 
                           (status.optout || 0);
          totalRespostas += (status.respondeu || 0) + (status.semInteresse || 0) + 
                          (status.interessado || 0);
          totalInteressados += status.interessado || 0;
          totalOptout += status.optout || 0;
        } catch (e) {
          // Ignora erro de campanha individual
        }
      }
      
      setCampanhas(campanhasComMetricas);
      
      // Calcular métricas globais
      const campanhasAtivas = campanhasData.filter((c: any) => c.status === 'ATIVA').length;
      
      setMetricas({
        totalCampanhas: campanhasData.length,
        campanhasAtivas,
        totalContatos,
        totalDisparados,
        totalRespostas,
        totalInteressados,
        totalOptout,
        taxaResposta: totalDisparados > 0 ? (totalRespostas / totalDisparados) * 100 : 0,
        taxaConversao: totalRespostas > 0 ? (totalInteressados / totalRespostas) * 100 : 0,
        taxaOptout: totalDisparados > 0 ? (totalOptout / totalDisparados) * 100 : 0
      });
      
      // Buscar dados do funil
      try {
        const resFunil = await api.get('/campanhas/funil-prospeccao', { signal });
        setFunil(resFunil.data.funil);
      } catch (e) {
        if (isRequestCanceled(e)) return;
        // Ignora erro do funil
      }
      
      // Buscar leads quentes
      try {
        const resLeads = await api.get('/campanhas/leads-quentes', { signal });
        setLeadsQuentes(resLeads.data.leads || []);
      } catch (e) {
        if (isRequestCanceled(e)) return;
        // Ignora erro de leads quentes
      }
      
      // Buscar avaliações agendadas
      try {
        const resAvaliacoes = await api.get('/campanhas/avaliacoes-agendadas', { signal });
        setAvaliacoes(resAvaliacoes.data.avaliacoes || []);
      } catch (e) {
        if (isRequestCanceled(e)) return;
        // Ignora erro de avaliações
      }
      
      // Buscar estatísticas da blacklist
      try {
        const resBlacklist = await api.get('/blacklist/estatisticas', { signal });
        setBlacklist(resBlacklist.data);
      } catch (e) {
        if (isRequestCanceled(e)) return;
        // Ignora erro de blacklist
      }
      
    } catch (error) {
      if (isRequestCanceled(error)) return;
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }, []);

  // Buscar dados inicial e atualizar periodicamente
  useEffect(() => {
    const controller = new AbortController();
    buscarDados(false, controller.signal);
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      buscarDados(true);
    }, 30000);
    
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [buscarDados]);

  // ============================================
  // RENDERIZAÇÃO
  // ============================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonKPI />
          <SkeletonKPI />
          <SkeletonKPI />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonKPI />
          <SkeletonKPI />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Leads Quentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <SkeletonLead />
            <SkeletonLead />
            <SkeletonLead />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard de Prospecção"
        description="Métricas em tempo real das campanhas ativas"
        icon={<BarChart3 className="w-5 h-5" />}
        actions={(
          <Button
            variant="outline"
            onClick={() => buscarDados(true)}
            disabled={atualizando}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        )}
      />

      {/* ZONA 1 — O que importa hoje */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Zona 1: O que importa hoje</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Agendamentos do dia</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {avaliacoes.length}
              </p>
              <p className="text-sm text-slate-500 mt-1">Visitas com horário definido hoje</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversas abertas</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {metricas?.totalRespostas || 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">Leads que já interagiram com campanhas</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Alertas</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {(blacklist?.total || 0) + (metricas?.totalOptout || 0)}
              </p>
              <p className="text-sm text-slate-500 mt-1">Opt-outs e contatos bloqueados</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ZONA 2 — Performance */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Zona 2: Performance</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-600" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Contatos</p>
                <p className="text-3xl font-extrabold tabular-nums text-slate-900 tracking-tight mt-1">
                  {metricas?.totalContatos.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100/50">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Disparados</p>
                <p className="text-3xl font-extrabold tabular-nums text-slate-900 tracking-tight mt-1">
                  {metricas?.totalDisparados.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-3 bg-violet-50 rounded-xl border border-violet-100/50">
                <MessageSquare className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Respostas</p>
                <p className="text-3xl font-extrabold tabular-nums text-slate-900 tracking-tight mt-1">
                  {metricas?.totalRespostas.toLocaleString() || 0}
                </p>
                <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {metricas?.taxaResposta.toFixed(1)}% taxa
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-glow-success">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Interessados</p>
                <p className="text-3xl font-extrabold tabular-nums text-emerald-600 tracking-tight mt-1">
                  {metricas?.totalInteressados.toLocaleString() || 0}
                </p>
                <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-1.5">
                  <Target className="w-3.5 h-3.5" />
                  {metricas?.taxaConversao.toFixed(1)}% conversão
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100/50">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Campanhas Ativas</p>
                <p className="text-2xl font-extrabold tabular-nums text-slate-900 tracking-tight mt-1">
                  {metricas?.campanhasAtivas || 0} / {metricas?.totalCampanhas || 0}
                </p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100/50">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Aguardando</p>
                <p className="text-2xl font-extrabold tabular-nums text-slate-900 tracking-tight mt-1">
                  {campanhas.reduce((acc, c) => acc + (c.aguardando || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Opt-out</p>
                <p className="text-2xl font-extrabold tabular-nums text-amber-600 tracking-tight mt-1">
                  {metricas?.totalOptout || 0}
                </p>
                <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mt-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {metricas?.taxaOptout.toFixed(1)}% taxa
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50">
                <UserX className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium relative overflow-hidden bg-white/70 backdrop-blur-md border-0 ring-1 ring-slate-200/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Blacklist</p>
                <p className="text-2xl font-extrabold tabular-nums text-red-600 tracking-tight mt-1">
                  {blacklist?.total || 0}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-xl border border-red-100/50">
                <Phone className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Funil de Prospecção Visual */}
      {funil && (
        <Card className="card-premium border-0 ring-1 ring-slate-200/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              Funil de Prospecção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2">
              {/* Etapa 1: Aguardando */}
              <div className="flex-1 text-center group">
                <div className="bg-slate-50 rounded-xl p-4 mb-3 border border-slate-200/50 transition-all duration-300 group-hover:shadow-md">
                  <p className="text-2xl font-bold tabular-nums text-slate-700">{funil.aguardando}</p>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Aguardando</p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                  <div className="h-full bg-slate-300 rounded-full transition-all" style={{ width: '100%' }} />
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              
              {/* Etapa 2: Contatando */}
              <div className="flex-1 text-center group">
                <div className="bg-indigo-50 rounded-xl p-4 mb-3 border border-indigo-100/50 transition-all duration-300 group-hover:shadow-md group-hover:border-indigo-200">
                  <p className="text-2xl font-bold tabular-nums text-indigo-700">{funil.contatando}</p>
                  <p className="text-xs font-medium text-indigo-600 uppercase tracking-widest mt-1">Contatando</p>
                </div>
                <div className="h-2 bg-indigo-100 rounded-full w-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all" 
                    style={{ width: funil.aguardando > 0 ? `${Math.min(100, (funil.contatando / (funil.aguardando + funil.contatando)) * 100)}%` : '0%' }} 
                  />
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              
              {/* Etapa 3: Respondeu */}
              <div className="flex-1 text-center group">
                <div className="bg-violet-50 rounded-xl p-4 mb-3 border border-violet-100/50 transition-all duration-300 group-hover:shadow-md group-hover:border-violet-200">
                  <p className="text-2xl font-bold tabular-nums text-violet-700">{funil.respondeu}</p>
                  <p className="text-xs font-medium text-violet-600 uppercase tracking-widest mt-1">Respondeu</p>
                </div>
                <div className="h-2 bg-violet-100 rounded-full w-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all" 
                    style={{ width: funil.contatando > 0 ? `${Math.min(100, (funil.respondeu / funil.contatando) * 100)}%` : '0%' }} 
                  />
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              
              {/* Etapa 4: Interessado */}
              <div className="flex-1 text-center group">
                <div className="bg-amber-50 rounded-xl p-4 mb-3 border border-amber-100/50 transition-all duration-300 group-hover:shadow-md group-hover:border-amber-200">
                  <p className="text-2xl font-bold tabular-nums text-amber-700">{funil.interessado + funil.mornoFuturo}</p>
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-widest mt-1">Interessados</p>
                </div>
                <div className="h-2 bg-amber-100 rounded-full w-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all" 
                    style={{ width: funil.respondeu > 0 ? `${Math.min(100, ((funil.interessado + funil.mornoFuturo) / funil.respondeu) * 100)}%` : '0%' }} 
                  />
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              
              {/* Etapa 5: Lead Convertido */}
              <div className="flex-1 text-center group">
                <div className="bg-emerald-50 rounded-xl p-4 mb-3 border border-emerald-100/50 transition-all duration-300 group-hover:shadow-md group-hover:border-emerald-200">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{funil.lead}</p>
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-widest mt-1">Leads</p>
                </div>
                <div className="h-2 bg-emerald-100 rounded-full w-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all shadow-glow-success" 
                    style={{ width: (funil.interessado + funil.mornoFuturo) > 0 ? `${Math.min(100, (funil.lead / (funil.interessado + funil.mornoFuturo)) * 100)}%` : '0%' }} 
                  />
                </div>
              </div>
            </div>
            
            {/* Saídas do funil */}
            <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <span className="text-sm text-amber-600 font-medium">{funil.optout} opt-out</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-slate-500 font-medium">{funil.semInteresse} sem interesse</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid Leads Quentes e Avaliações */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Leads Quentes */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Flame className="w-5 h-5" />
              Leads Quentes ({leadsQuentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadsQuentes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Nenhum lead quente aguardando ação
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {leadsQuentes.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="bg-orange-50 rounded-lg p-3 hover:bg-orange-100 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{lead.nome}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {lead.telefone}
                        </p>
                        {lead.imovel?.endereco && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {lead.imovel?.endereco}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {lead.campanha && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                            {lead.campanha.empreendimento}
                          </span>
                        )}
                        {lead.reuniaoAgendada && (
                          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(lead.reuniaoAgendada.agendadoPara).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {leadsQuentes.length > 5 && (
                  <p className="text-center text-sm text-brand pt-2">
                    +{leadsQuentes.length - 5} leads quentes
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Avaliações Agendadas */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <Calendar className="w-5 h-5" />
              Avaliações Agendadas ({avaliacoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avaliacoes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                Nenhuma avaliação agendada
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {avaliacoes.slice(0, 5).map((av) => (
                  <div key={av.id} className="bg-emerald-50 rounded-lg p-3 hover:bg-emerald-100 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{av.lead.nome}</p>
                        <p className="text-sm text-slate-500">{av.titulo}</p>
                        {av.imovel?.endereco && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {av.imovel?.endereco}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {av.agendadoPara 
                            ? new Date(av.agendadoPara).toLocaleDateString('pt-BR', { 
                                weekday: 'short', 
                                day: '2-digit', 
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'A definir'}
                        </p>
                        {av.campanha && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded mt-1 inline-block">
                            {av.campanha.empreendimento}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {avaliacoes.length > 5 && (
                  <p className="text-center text-sm text-brand pt-2">
                    +{avaliacoes.length - 5} avaliações
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ZONA 3 — Ações rápidas */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Zona 3: Ações rápidas</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card interactive onClick={() => navigate("/dashboard/mineracao")}>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-900">Nova mineração</p>
              <p className="text-sm text-slate-500 mt-1">Inicie uma nova captação de imóveis e contatos.</p>
            </CardContent>
          </Card>
          <Card interactive onClick={() => navigate("/dashboard/campanhas")}>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-900">Nova campanha</p>
              <p className="text-sm text-slate-500 mt-1">Crie e dispare uma campanha para listas prontas.</p>
            </CardContent>
          </Card>
          <Card interactive onClick={() => navigate("/dashboard/leads")}>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-900">Ver leads quentes</p>
              <p className="text-sm text-slate-500 mt-1">Acesse os leads mais urgentes para ação comercial.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabela de Campanhas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Campanhas por Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Campanha</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Status</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Total</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Aguard.</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Contatan.</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Respond.</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Interes.</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Opt-out</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-slate-600">Taxa Resp.</th>
                </tr>
              </thead>
              <tbody>
                {campanhas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-500">
                      Nenhuma campanha encontrada
                    </td>
                  </tr>
                ) : (
                  campanhas.map((campanha) => {
                    const disparados = (campanha.contatando || 0) + (campanha.respondeu || 0) + 
                                      (campanha.semInteresse || 0) + (campanha.interessado || 0) + 
                                      (campanha.optout || 0);
                    const respostas = (campanha.respondeu || 0) + (campanha.semInteresse || 0) + 
                                     (campanha.interessado || 0);
                    const taxaResposta = disparados > 0 ? (respostas / disparados) * 100 : 0;
                    
                    return (
                      <tr key={campanha.campanhaId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900">{campanha.nomeCampanha}</span>
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            campanha.status === 'ATIVA' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : campanha.status === 'PAUSADA'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {campanha.status}
                          </span>
                        </td>
                        <td className="text-center py-3 px-2 font-medium">{campanha.total}</td>
                        <td className="text-center py-3 px-2 text-slate-600">{campanha.aguardando}</td>
                        <td className="text-center py-3 px-2 text-brand">{campanha.contatando}</td>
                        <td className="text-center py-3 px-2 text-violet-600">{respostas}</td>
                        <td className="text-center py-3 px-2 text-emerald-600 font-medium">{campanha.interessado}</td>
                        <td className="text-center py-3 px-2 text-amber-600">{campanha.optout}</td>
                        <td className="text-center py-3 px-2">
                          <span className={`font-medium ${taxaResposta >= 10 ? 'text-emerald-600' : taxaResposta >= 5 ? 'text-brand' : 'text-slate-600'}`}>
                            {taxaResposta.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas da Blacklist */}
      {blacklist && blacklist.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Phone className="w-5 h-5" />
              Blacklist por Motivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(blacklist.porMotivo).map(([motivo, count]) => (
                <div key={motivo} className="bg-slate-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold tabular-nums text-slate-900">{count}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {motivo === 'OPTOUT' ? 'Opt-out' :
                     motivo === 'INVALIDO' ? 'Inválido' :
                     motivo === 'RECLAMACAO' ? 'Reclamação' :
                     motivo === 'BLOQUEADO_WHATSAPP' ? 'Bloq. WhatsApp' :
                     motivo === 'MANUAL' ? 'Manual' : motivo}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
