import { useState, useEffect } from "react";
import { api } from "../servicos/api";
import { 
  Bot, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Flame, 
  ThermometerSun,
  Snowflake,
  Activity,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  Zap,
  AlertTriangle,
  Gauge,
  ShieldAlert,
  Lightbulb
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { PageHeader } from "../componentes/ui/page-header";

interface ResumoMetricas {
  periodo: string;
  resumo: {
    totalConversas: number;
    conversasAtivas: number;
    leadsQualificados: number;
    totalMensagens: number;
    mediaMensagensPorConversa: number;
    taxaConversao: string;
  };
  distribuicaoTemperatura: {
    quentes: number;
    mornos: number;
    frios: number;
  };
  tendencia: {
    conversas: string;
    qualificados: string;
  };
}

interface WorkerStatus {
  nome: string;
  status: string;
  conversasHoje: number;
  tempoMedioResposta: string;
  taxaSucesso: string;
  ultimaExecucao: string;
}

interface AtividadeRecente {
  tipo: string;
  descricao: string;
  preview: string;
  tempo: string;
  leadId: string;
}

interface DadosGrafico {
  data: string;
  conversas: number;
  mensagens: number;
}

interface CockpitPayload {
  periodo: string;
  qualidade: {
    taxaRepeticaoPerguntas: number;
    aderenciaFluxo: number;
    contextoValido: number;
  };
  gargalos: {
    latenciaMs: {
      media: number;
      p50: number;
      p95: number;
    };
    mediaToolCalls: number;
    mediaHandoffs: number;
    topFallbacks: Array<{ fallback: string; total: number }>;
    etapaMaiorAbandono: { fase: string; total: number } | null;
  };
  erros: {
    totalTurnos: number;
    exceptions: number;
    providerFallback: number;
    antiRepeatGuard: number;
    optOuts: number;
    perdas: number;
    errosOutcome: number;
    tools: {
      totalExecucoes: number;
      falhas: number;
      taxaFalha: number;
    };
  };
  sugestoes: Array<{
    id: string;
    titulo: string;
    descricao: string;
    severidade: "BAIXA" | "MEDIA" | "ALTA";
  }>;
}

interface BaselinePayload {
  periodo: string;
  amostra: {
    turnos: number;
    outcomes: number;
  };
}

interface ExperimentoGrupo {
  totalTurnos: number;
  totalOutcomes: number;
  taxaSucesso: number;
  taxaOptout: number;
  latenciaMediaMs: number;
  latenciaP95Ms: number;
  custoMedioUsd?: number;
  repeticaoPerguntas: number;
}

interface AAPayload {
  validacaoInstrumentacao: "OK" | "ATENCAO";
  grupos: {
    A: ExperimentoGrupo;
    B: ExperimentoGrupo;
  };
  drift: {
    taxaSucesso: number;
    latenciaMediaMs: number;
  };
}

interface ABPayload {
  recomendacao: string;
  grupos: {
    CONTROL: ExperimentoGrupo;
    VARIANT: ExperimentoGrupo;
  };
  delta: {
    taxaSucesso: number;
    taxaOptout: number;
    latenciaMediaMs: number;
    custoMedioUsd?: number;
  };
  paol?: {
    turnosVariantAplicados: number;
    divergenciasSombra: number;
  };
}

interface ABPromocaoPayload {
  recomendacao: string;
  podePromover: boolean;
  gates: {
    amostraMinima: boolean;
    conversaoNaoInferior: boolean;
    optoutNaoPiora: boolean;
    latenciaDentroLimite: boolean;
    custoDentroTeto: boolean;
  };
  delta: {
    taxaSucesso: number;
    taxaOptout: number;
    latenciaMediaMs: number;
    custoMedioUsd: number;
  };
}

interface PaolPoliticaPayload {
  periodo: string;
  total: number;
  politicas: Array<{
    contextoHash: string;
    acao: string;
    emaRecompensa: number;
    emaSucesso: number;
    amostra: number;
    atualizadoEm: string;
  }>;
}

export function DashboardAgentes() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'24h' | '7d' | '30d'>('7d');
  const [resumo, setResumo] = useState<ResumoMetricas | null>(null);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<DadosGrafico[]>([]);
  const [cockpit, setCockpit] = useState<CockpitPayload | null>(null);
  const [baseline, setBaseline] = useState<BaselinePayload | null>(null);
  const [aa, setAa] = useState<AAPayload | null>(null);
  const [ab, setAb] = useState<ABPayload | null>(null);
  const [abPromocao, setAbPromocao] = useState<ABPromocaoPayload | null>(null);
  const [paolPolitica, setPaolPolitica] = useState<PaolPoliticaPayload | null>(null);

  useEffect(() => {
    carregarDados();
  }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const [
        resumoRes,
        workersRes,
        atividadeRes,
        graficoRes,
        cockpitRes,
        baselineRes,
        aaRes,
        abRes,
        abPromocaoRes,
        paolPoliticaRes,
      ] = await Promise.all([
        api.get(`/metricas-agentes/resumo?periodo=${periodo}`),
        api.get('/metricas-agentes/workers'),
        api.get('/metricas-agentes/atividade-recente'),
        api.get(`/metricas-agentes/conversas-por-dia?dias=${periodo === '30d' ? 30 : periodo === '24h' ? 1 : 7}`),
        api.get(`/metricas-ia/cockpit?dias=${periodo === '30d' ? 30 : periodo === '24h' ? 1 : 7}`),
        api.get('/metricas-ia/cockpit/baseline?dias=14'),
        api.get('/metricas-ia/cockpit/experimentos/aa?dias=7'),
        api.get(`/metricas-ia/cockpit/experimentos/ab?dias=${periodo === '30d' ? 30 : 7}`),
        api.get(`/metricas-ia/cockpit/experimentos/ab/promocao?dias=${periodo === '30d' ? 30 : 7}`),
        api.get('/metricas-ia/learning-bank/paol/politica?limite=5'),
      ]);
      
      setResumo(resumoRes.data);
      setWorkers(workersRes.data.workers || []);
      setAtividades(atividadeRes.data.atividades || []);
      setDadosGrafico(graficoRes.data.dados || []);
      setCockpit(cockpitRes.data ?? null);
      setBaseline(baselineRes.data ?? null);
      setAa(aaRes.data ?? null);
      setAb(abRes.data ?? null);
      setAbPromocao(abPromocaoRes.data ?? null);
      setPaolPolitica(paolPoliticaRes.data ?? null);
      
    } catch (error) {
      console.error('[Dashboard] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarTempo = (isoString: string) => {
    const data = new Date(isoString);
    const agora = new Date();
    const diffMs = agora.getTime() - data.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h atrás`;
    return data.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
        <span className="ml-3 text-slate-600">Carregando métricas...</span>
      </div>
    );
  }

  const totalTurnosCockpit = cockpit?.erros.totalTurnos ?? 0;
  const hasCockpitSample = totalTurnosCockpit > 0;
  const baselineTurnos = baseline?.amostra.turnos ?? 0;
  const baselineOutcomes = baseline?.amostra.outcomes ?? 0;
  const hasBaselineSample = baselineTurnos > 0 || baselineOutcomes > 0;
  const aaTotalTurnos = (aa?.grupos.A.totalTurnos ?? 0) + (aa?.grupos.B.totalTurnos ?? 0);
  const hasAaSample = aaTotalTurnos > 0;
  const abTotalTurnos = (ab?.grupos.CONTROL.totalTurnos ?? 0) + (ab?.grupos.VARIANT.totalTurnos ?? 0);
  const hasAbSample = abTotalTurnos > 0;
  const paolPoliticaCount = paolPolitica?.total ?? 0;
  const hasPaolPoliticaSample = paolPoliticaCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cockpit IA"
        description="Qualidade, gargalos, erros e sugestões para evolução dos agentes em tempo real"
        icon={<Bot className="w-5 h-5" />}
        actions={(
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-1">
              {(['24h', '7d', '30d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    periodo === p
                      ? 'bg-white text-brand shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === '24h' ? '24 horas' : p === '7d' ? '7 dias' : '30 dias'}
                </button>
              ))}
            </div>

            <Button variant="outline" onClick={carregarDados}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        )}
      />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Conversas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 card-premium">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total de Conversas</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {resumo?.resumo.totalConversas || 0}
              </p>
              <p className="text-sm text-emerald-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {resumo?.tendencia.conversas}
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* Leads Qualificados */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 card-premium">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Leads Qualificados</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {resumo?.resumo.leadsQualificados || 0}
              </p>
              <p className="text-sm text-emerald-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {resumo?.tendencia.qualificados}
              </p>
            </div>
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-violet-600" />
            </div>
          </div>
        </div>

        {/* Taxa de Conversão */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 card-premium">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Taxa de Conversão</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {resumo?.resumo.taxaConversao || '0%'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Qualificados → Quentes
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Conversas Ativas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 card-premium">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversas Ativas</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 mt-1">
                {resumo?.resumo.conversasAtivas || 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Em andamento agora
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Distribuição de Temperatura + Workers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição de Temperatura */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">
            Distribuição de Leads
          </h3>
          
          <div className="space-y-4">
            {/* Quentes */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Flame className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Quentes</span>
                  <span className="text-sm font-bold text-red-600">
                    {resumo?.distribuicaoTemperatura.quentes || 0}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div 
                    className="h-2 bg-red-500 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((resumo?.distribuicaoTemperatura.quentes || 0) / Math.max(1, (resumo?.resumo.leadsQualificados || 1))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Mornos */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <ThermometerSun className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Mornos</span>
                  <span className="text-sm font-bold text-amber-600">
                    {resumo?.distribuicaoTemperatura.mornos || 0}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div 
                    className="h-2 bg-amber-500 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((resumo?.distribuicaoTemperatura.mornos || 0) / Math.max(1, (resumo?.resumo.leadsQualificados || 1))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Frios */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Snowflake className="w-5 h-5 text-brand" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Frios</span>
                  <span className="text-sm font-bold text-brand">
                    {resumo?.distribuicaoTemperatura.frios || 0}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div 
                    className="h-2 bg-brand rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((resumo?.distribuicaoTemperatura.frios || 0) / Math.max(1, (resumo?.resumo.leadsQualificados || 1))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status dos Workers */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Status dos Workers
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workers.map((worker, index) => (
              <div 
                key={index}
                className="p-4 bg-slate-50 rounded-lg border border-slate-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      worker.status === 'ativo' ? 'bg-success' : 'bg-slate-400'
                    }`} />
                    <span className="font-medium text-slate-900">{worker.nome}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    worker.status === 'ativo' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {worker.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Conversas hoje</p>
                    <p className="font-semibold tabular-nums text-slate-900">{worker.conversasHoje}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tempo médio</p>
                    <p className="font-semibold text-slate-900">{worker.tempoMedioResposta}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Taxa sucesso</p>
                    <p className="font-semibold text-emerald-600">{worker.taxaSucesso}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Última ação</p>
                    <p className="font-semibold text-slate-900">
                      {formatarTempo(worker.ultimaExecucao)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico de Atividade + Atividades Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Simples de Barras */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">
            Volume de Conversas
          </h3>
          
          <div className="flex items-end gap-2 h-40">
            {dadosGrafico.map((dia, index) => {
              const maxConversas = Math.max(...dadosGrafico.map(d => d.conversas), 1);
              const altura = (dia.conversas / maxConversas) * 100;
              
              return (
                <div 
                  key={index}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div 
                    className="w-full bg-brand rounded-t-md transition-all hover:bg-brand-dark"
                    style={{ height: `${Math.max(altura, 5)}%` }}
                    title={`${dia.conversas} conversas`}
                  />
                  <span className="text-xs text-slate-500">
                    {new Date(dia.data).toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Total: <span className="tabular-nums">{dadosGrafico.reduce((acc, d) => acc + d.conversas, 0)}</span> conversas
            </span>
            <span className="text-slate-500">
              Média: <span className="tabular-nums">{Math.round(dadosGrafico.reduce((acc, d) => acc + d.conversas, 0) / Math.max(dadosGrafico.length, 1))}</span> /dia
            </span>
          </div>
        </div>

        {/* Atividades Recentes */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Atividade Recente
          </h3>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {atividades.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                Nenhuma atividade recente
              </p>
            ) : (
              atividades.map((atividade, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {atividade.descricao}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {atividade.preview}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatarTempo(atividade.tempo)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Estatísticas Adicionais */}
      <div className="rounded-xl p-6 text-white" style={{ background: 'var(--gradient-primary)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">
              <span className="tabular-nums">{resumo?.resumo.totalMensagens || 0}</span> mensagens processadas
            </h3>
            <p className="text-indigo-100 mt-1">
              Média de {resumo?.resumo.mediaMensagensPorConversa || 0} mensagens por conversa
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">
              {workers.length}
            </p>
            <p className="text-indigo-100">workers ativos</p>
          </div>
        </div>
      </div>

      {/* Cockpit v1 */}
      {!hasCockpitSample && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Ainda não há amostra suficiente de telemetria do Cockpit neste período. Os indicadores abaixo aparecerão como "Sem amostra" até acumular turnos instrumentados.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-600" />
            Qualidade
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Aderência ao fluxo</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? `${cockpit?.qualidade.aderenciaFluxo ?? 0}%` : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contexto válido</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? `${cockpit?.qualidade.contextoValido ?? 0}%` : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Repetição de perguntas</span>
              <span className="font-semibold tabular-nums text-amber-600">{hasCockpitSample ? `${cockpit?.qualidade.taxaRepeticaoPerguntas ?? 0}%` : 'Sem amostra'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Gargalos
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Latência média</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? `${cockpit?.gargalos.latenciaMs.media ?? 0}ms` : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Latência p95</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? `${cockpit?.gargalos.latenciaMs.p95 ?? 0}ms` : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tool calls/turno</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? (cockpit?.gargalos.mediaToolCalls ?? 0) : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Handoffs/turno</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? (cockpit?.gargalos.mediaHandoffs ?? 0) : 'Sem amostra'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Erros
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Exceptions</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? (cockpit?.erros.exceptions ?? 0) : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fallback provedor</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? (cockpit?.erros.providerFallback ?? 0) : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Falha de tools</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? `${cockpit?.erros.tools.taxaFalha ?? 0}%` : 'Sem amostra'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Opt-outs</span>
              <span className="font-semibold tabular-nums text-slate-900">{hasCockpitSample ? (cockpit?.erros.optOuts ?? 0) : 'Sem amostra'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sugestões + Experimentos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Sugestões Automáticas
          </h3>
          <div className="space-y-3">
            {(cockpit?.sugestoes || []).map((sugestao) => (
              <div key={sugestao.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{sugestao.titulo}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    sugestao.severidade === 'ALTA'
                      ? 'bg-red-100 text-red-700'
                      : sugestao.severidade === 'MEDIA'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {sugestao.severidade}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{sugestao.descricao}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">
            Baseline e Experimentos
          </h3>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <p className="font-medium text-slate-900">Baseline (14 dias)</p>
              <p className="text-slate-500 mt-1">
                {baselineTurnos} turnos e {baselineOutcomes} outcomes coletados.
                {!hasBaselineSample && ' Sem amostra suficiente ainda.'}
              </p>
            </div>
            <div className={`rounded-lg p-3 border ${
              aa?.validacaoInstrumentacao === 'OK'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <p className="font-medium text-slate-900">A/A Instrumentação (7 dias)</p>
              {hasAaSample ? (
                <>
                  <p className="text-slate-600 mt-1">
                    Drift sucesso: {aa?.drift.taxaSucesso ?? 0}pp | Drift latência: {aa?.drift.latenciaMediaMs ?? 0}ms
                  </p>
                  <p className="text-slate-600 mt-1">Status: {aa?.validacaoInstrumentacao || 'N/A'}</p>
                </>
              ) : (
                <p className="text-slate-600 mt-1">Sem amostra suficiente para validar A/A.</p>
              )}
            </div>
            <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-200">
              <p className="font-medium text-slate-900">Controle vs Variante</p>
              {hasAbSample ? (
                <>
                  <p className="text-slate-600 mt-1">
                    Δ Sucesso: {ab?.delta.taxaSucesso ?? 0}pp | Δ Opt-out: {ab?.delta.taxaOptout ?? 0}pp
                  </p>
                  <p className="text-slate-600 mt-1">
                    Δ Latência: {ab?.delta.latenciaMediaMs ?? 0}ms | Δ Custo: ${(ab?.delta.custoMedioUsd ?? 0).toFixed(6)}
                  </p>
                  <p className="text-slate-600 mt-1">
                    PAOL aplicado: {ab?.paol?.turnosVariantAplicados ?? 0} turnos | Recomendação: {ab?.recomendacao || 'N/A'}
                  </p>
                </>
              ) : (
                <p className="text-slate-600 mt-1">Sem amostra suficiente para comparar controle vs variante.</p>
              )}
            </div>
            <div className={`rounded-lg p-3 border ${
              abPromocao?.podePromover
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <p className="font-medium text-slate-900">Promoção da Variante (Gates)</p>
              <p className="text-slate-600 mt-1">
                {abPromocao?.recomendacao || 'MANTER_CONTROLE'}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <span className={abPromocao?.gates.amostraMinima ? 'text-emerald-700' : 'text-amber-700'}>
                  Amostra mínima: {abPromocao?.gates.amostraMinima ? 'OK' : 'Pendente'}
                </span>
                <span className={abPromocao?.gates.conversaoNaoInferior ? 'text-emerald-700' : 'text-amber-700'}>
                  Conversão: {abPromocao?.gates.conversaoNaoInferior ? 'OK' : 'Risco'}
                </span>
                <span className={abPromocao?.gates.optoutNaoPiora ? 'text-emerald-700' : 'text-amber-700'}>
                  Opt-out: {abPromocao?.gates.optoutNaoPiora ? 'OK' : 'Risco'}
                </span>
                <span className={abPromocao?.gates.latenciaDentroLimite ? 'text-emerald-700' : 'text-amber-700'}>
                  Latência: {abPromocao?.gates.latenciaDentroLimite ? 'OK' : 'Risco'}
                </span>
                <span className={abPromocao?.gates.custoDentroTeto ? 'text-emerald-700' : 'text-amber-700'}>
                  Custo: {abPromocao?.gates.custoDentroTeto ? 'OK' : 'Risco'}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-violet-50 p-3 border border-violet-200">
              <p className="font-medium text-slate-900">Política PAOL</p>
              {hasPaolPoliticaSample ? (
                <div className="mt-2 space-y-2">
                  {paolPolitica?.politicas.slice(0, 3).map((p) => (
                    <div key={`${p.contextoHash}-${p.acao}`} className="text-xs text-slate-700">
                      <p className="font-medium truncate">{p.acao}</p>
                      <p>EMA recompensa: {p.emaRecompensa.toFixed(3)} | EMA sucesso: {p.emaSucesso.toFixed(3)} | amostra: {p.amostra}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 mt-1">Sem amostra da política PAOL ainda.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
