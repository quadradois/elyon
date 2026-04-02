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
  Zap
} from "lucide-react";
import { Button } from "../componentes/ui/button";

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

export function DashboardAgentes() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'24h' | '7d' | '30d'>('7d');
  const [resumo, setResumo] = useState<ResumoMetricas | null>(null);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<DadosGrafico[]>([]);

  useEffect(() => {
    carregarDados();
  }, [periodo]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const [resumoRes, workersRes, atividadeRes, graficoRes] = await Promise.all([
        api.get(`/metricas-agentes/resumo?periodo=${periodo}`),
        api.get('/metricas-agentes/workers'),
        api.get('/metricas-agentes/atividade-recente'),
        api.get(`/metricas-agentes/conversas-por-dia?dias=${periodo === '30d' ? 30 : periodo === '24h' ? 1 : 7}`)
      ]);
      
      setResumo(resumoRes.data);
      setWorkers(workersRes.data.workers);
      setAtividades(atividadeRes.data.atividades);
      setDadosGrafico(graficoRes.data.dados);
      
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Carregando métricas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-blue-600" />
            Performance dos Agentes
          </h1>
          <p className="text-slate-500">
            Monitore como seus agentes IA estão performando em tempo real
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Seletor de Período */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  periodo === p 
                    ? 'bg-white text-blue-600 shadow-sm' 
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
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Conversas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total de Conversas</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {resumo?.resumo.totalConversas || 0}
              </p>
              <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {resumo?.tendencia.conversas}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Leads Qualificados */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Leads Qualificados</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {resumo?.resumo.leadsQualificados || 0}
              </p>
              <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {resumo?.tendencia.qualificados}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Taxa de Conversão */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Taxa de Conversão</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {resumo?.resumo.taxaConversao || '0%'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Qualificados → Quentes
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Conversas Ativas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Conversas Ativas</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
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
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Snowflake className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Frios</span>
                  <span className="text-sm font-bold text-blue-600">
                    {resumo?.distribuicaoTemperatura.frios || 0}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div 
                    className="h-2 bg-blue-500 rounded-full transition-all"
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
                      worker.status === 'ativo' ? 'bg-green-500' : 'bg-slate-400'
                    }`} />
                    <span className="font-medium text-slate-900">{worker.nome}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    worker.status === 'ativo' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {worker.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Conversas hoje</p>
                    <p className="font-semibold text-slate-900">{worker.conversasHoje}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tempo médio</p>
                    <p className="font-semibold text-slate-900">{worker.tempoMedioResposta}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Taxa sucesso</p>
                    <p className="font-semibold text-green-600">{worker.taxaSucesso}</p>
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
                    className="w-full bg-blue-500 rounded-t-md transition-all hover:bg-blue-600"
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
              Total: {dadosGrafico.reduce((acc, d) => acc + d.conversas, 0)} conversas
            </span>
            <span className="text-slate-500">
              Média: {Math.round(dadosGrafico.reduce((acc, d) => acc + d.conversas, 0) / Math.max(dadosGrafico.length, 1))} /dia
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
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {atividade.descricao}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {atividade.preview}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatarTempo(atividade.tempo)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Estatísticas Adicionais */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">
              {resumo?.resumo.totalMensagens || 0} mensagens processadas
            </h3>
            <p className="text-blue-100 mt-1">
              Média de {resumo?.resumo.mediaMensagensPorConversa || 0} mensagens por conversa
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {workers.length}
            </p>
            <p className="text-blue-100">workers ativos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
