/**
 * PainelDisparo - Componente de controle de disparos de prospecção ativa
 * 
 * Funcionalidades:
 * - Iniciar/Pausar/Parar disparos
 * - Configurar rate limiting (msgs/minuto)
 * - Visualizar progresso e métricas
 * - Configurar horário de disparo
 * - Persistência das configurações no banco
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { 
  Play, 
  Pause, 
  Settings, 
  Loader2,
  MessageSquare,
  UserCheck,
  UserX,
  Clock,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Save
} from "lucide-react";
import { api } from "../servicos/api";

// ============================================
// TIPOS
// ============================================

interface StatusDisparo {
  total: number;
  aguardando: number;
  contatando: number;
  respondeu: number;
  semInteresse: number;
  interessado: number;
  optout: number;
  falha: number;
}

interface MetricasDisparo {
  taxaResposta: string;
  taxaConversao: string;
  optoutRate: string;
}

interface ConfiguracaoDisparo {
  mensagensPorMinuto: number;
  atrasoEntreMensagens: number; // milissegundos
  maxTentativas: number;
  horarioInicio: string; // "08:00"
  horarioFim: string; // "18:00"
  diasSemana: string[]; // ['seg', 'ter', 'qua', 'qui', 'sex']
}

interface PainelDisparoProps {
  campanhaId: string;
  campanhaStatus?: string;
  onStatusChange?: () => void;
}

// ============================================
// CONFIGURAÇÃO PADRÃO
// ============================================

const CONFIG_PADRAO: ConfiguracaoDisparo = {
  mensagensPorMinuto: 20,
  atrasoEntreMensagens: 3000,
  maxTentativas: 3,
  horarioInicio: "08:00",
  horarioFim: "18:00",
  diasSemana: ['seg', 'ter', 'qua', 'qui', 'sex'] // Segunda a Sexta
};

// Mapeamento para display dos dias
const DIAS_SEMANA_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const DIAS_SEMANA_DISPLAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function PainelDisparo({ campanhaId, campanhaStatus = 'ATIVA', onStatusChange }: PainelDisparoProps) {
  // Estados
  const [status, setStatus] = useState<StatusDisparo | null>(null);
  const [metricas, setMetricas] = useState<MetricasDisparo | null>(null);
  const [config, setConfig] = useState<ConfiguracaoDisparo>(CONFIG_PADRAO);
  const [configOriginal, setConfigOriginal] = useState<ConfiguracaoDisparo>(CONFIG_PADRAO);
  const [disparando, setDisparando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  
  // Verificar se configuração foi alterada
  const configAlterada = JSON.stringify(config) !== JSON.stringify(configOriginal);
  
  // ============================================
  // CARREGAR CONFIGURAÇÕES
  // ============================================
  
  const carregarConfig = useCallback(async () => {
    try {
      const response = await api.get(`/campanhas/${campanhaId}/config-disparo`);
      const configCarregada = response.data.config;
      setConfig(configCarregada);
      setConfigOriginal(configCarregada);
    } catch (error) {
      console.error('Erro ao carregar config:', error);
      // Usar config padrão se falhar
    }
  }, [campanhaId]);
  
  // ============================================
  // SALVAR CONFIGURAÇÕES
  // ============================================
  
  const salvarConfig = async () => {
    setSalvandoConfig(true);
    setErro(null);
    
    try {
      await api.put(`/campanhas/${campanhaId}/config-disparo`, config);
      setConfigOriginal(config);
      setSucesso('Configurações salvas com sucesso!');
    } catch (error: any) {
      setErro(error.response?.data?.erro || 'Erro ao salvar configurações');
    } finally {
      setSalvandoConfig(false);
      setTimeout(() => setSucesso(null), 3000);
    }
  };
  
  // ============================================
  // BUSCAR STATUS
  // ============================================
  
  const buscarStatus = useCallback(async () => {
    try {
      const response = await api.get(`/campanhas/${campanhaId}/status-disparo`);
      setStatus(response.data.status);
      setMetricas(response.data.metricas);
      
      // Verificar se está disparando (tem contatos em CONTATANDO e campanha ATIVA)
      setDisparando(
        campanhaStatus === 'ATIVA' && 
        response.data.status.contatando > 0
      );
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    } finally {
      setLoading(false);
    }
  }, [campanhaId, campanhaStatus]);
  
  // Buscar status inicial, carregar config e atualizar periodicamente
  useEffect(() => {
    buscarStatus();
    carregarConfig();
    
    // Atualizar a cada 10 segundos se estiver disparando
    const interval = setInterval(() => {
      if (disparando) {
        buscarStatus();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [buscarStatus, carregarConfig, disparando]);
  
  // ============================================
  // AÇÕES
  // ============================================
  
  const iniciarDisparo = async (modo: 'lote' | 'continuo' = 'lote') => {
    setProcessando(true);
    setErro(null);
    
    try {
      // Salvar config antes de disparar se foi alterada
      if (configAlterada) {
        await api.put(`/campanhas/${campanhaId}/config-disparo`, config);
        setConfigOriginal(config);
      }
      
      const response = await api.post(`/campanhas/${campanhaId}/disparar`, { 
        modo,
        config // Enviar config junto com o disparo
      });
      
      if (response.data.sucesso) {
        setSucesso(`Disparo iniciado! ${response.data.contatosEnviados || 0} mensagens enviadas.`);
        setDisparando(true);
        buscarStatus();
        onStatusChange?.();
      } else {
        setErro(response.data.mensagem || 'Erro ao iniciar disparo');
      }
    } catch (error: any) {
      setErro(error.response?.data?.erro || 'Erro ao iniciar disparo');
    } finally {
      setProcessando(false);
      setTimeout(() => setSucesso(null), 5000);
    }
  };
  
  const pausarDisparo = async () => {
    setProcessando(true);
    setErro(null);
    
    try {
      await api.post(`/campanhas/${campanhaId}/pausar`);
      setSucesso('Disparo pausado com sucesso!');
      setDisparando(false);
      buscarStatus();
      onStatusChange?.();
    } catch (error: any) {
      setErro(error.response?.data?.erro || 'Erro ao pausar disparo');
    } finally {
      setProcessando(false);
      setTimeout(() => setSucesso(null), 5000);
    }
  };
  
  const reativarDisparo = async () => {
    setProcessando(true);
    setErro(null);
    
    try {
      await api.post(`/campanhas/${campanhaId}/reativar`);
      setSucesso('Campanha reativada!');
      onStatusChange?.();
    } catch (error: any) {
      setErro(error.response?.data?.erro || 'Erro ao reativar');
    } finally {
      setProcessando(false);
      setTimeout(() => setSucesso(null), 5000);
    }
  };
  
  // ============================================
  // HELPERS PARA DIAS DA SEMANA
  // ============================================
  
  const toggleDia = (diaIndex: number) => {
    const diaLabel = DIAS_SEMANA_LABELS[diaIndex];
    const diasAtuais = config.diasSemana || [];
    const novosDias = diasAtuais.includes(diaLabel)
      ? diasAtuais.filter(d => d !== diaLabel)
      : [...diasAtuais, diaLabel];
    setConfig({...config, diasSemana: novosDias});
  };
  
  const isDiaSelecionado = (diaIndex: number) => {
    const diaLabel = DIAS_SEMANA_LABELS[diaIndex];
    return (config.diasSemana || []).includes(diaLabel);
  };
  
  // ============================================
  // RENDERIZAÇÃO
  // ============================================
  
  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }
  
  const progresso = status ? 
    Math.round(((status.contatando + status.respondeu + status.semInteresse + status.interessado + status.optout) / status.total) * 100) : 0;
  
  return (
    <div className="space-y-6">
      {/* Alertas */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {erro}
        </div>
      )}
      
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {sucesso}
        </div>
      )}
      
      {/* Painel Principal */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Controle de Disparo
            </CardTitle>
            
            {/* Status Badge */}
            <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
              disparando 
                ? 'bg-green-100 text-green-700' 
                : campanhaStatus === 'PAUSADA'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-slate-100 text-slate-600'
            }`}>
              {disparando ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Disparando
                </>
              ) : campanhaStatus === 'PAUSADA' ? (
                <>
                  <Pause className="w-3 h-3" />
                  Pausado
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  Aguardando
                </>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Botões de Ação */}
          <div className="flex flex-wrap gap-3">
            {campanhaStatus === 'PAUSADA' ? (
              <Button
                onClick={reativarDisparo}
                disabled={processando}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {processando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Reativar Campanha
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => iniciarDisparo('lote')}
                  disabled={processando || disparando || !status?.aguardando}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {processando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Disparar Lote ({config.mensagensPorMinuto} msgs)
                </Button>
                
                <Button
                  onClick={() => iniciarDisparo('continuo')}
                  disabled={processando || disparando || !status?.aguardando}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Disparo Contínuo
                </Button>
                
                {disparando && (
                  <Button
                    onClick={pausarDisparo}
                    disabled={processando}
                    variant="outline"
                    className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    <Pause className="w-4 h-4" />
                    Pausar
                  </Button>
                )}
              </>
            )}
            
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => setMostrarConfig(!mostrarConfig)}
            >
              <Settings className="w-4 h-4" />
              Configurações
              {configAlterada && (
                <span className="w-2 h-2 bg-orange-500 rounded-full" title="Alterações não salvas" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={buscarStatus}
              title="Atualizar status"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Configurações (colapsável) */}
          {mostrarConfig && (
            <div className="bg-slate-50 p-4 rounded-lg space-y-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configurações de Disparo
                </h4>
                
                {configAlterada && (
                  <Button
                    size="sm"
                    onClick={salvarConfig}
                    disabled={salvandoConfig}
                    className="gap-2"
                  >
                    {salvandoConfig ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Mensagens por minuto
                  </label>
                  <select
                    value={config.mensagensPorMinuto}
                    onChange={(e) => setConfig({...config, mensagensPorMinuto: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    title="Quantidade de mensagens enviadas por minuto"
                  >
                    <option value={10}>10 msgs/min (Seguro)</option>
                    <option value={15}>15 msgs/min</option>
                    <option value={20}>20 msgs/min (Recomendado)</option>
                    <option value={30}>30 msgs/min (Arriscado)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Delay entre mensagens
                  </label>
                  <select
                    value={config.atrasoEntreMensagens}
                    onChange={(e) => setConfig({...config, atrasoEntreMensagens: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    title="Tempo de espera entre cada mensagem enviada"
                  >
                    <option value={2000}>2 segundos</option>
                    <option value={3000}>3 segundos (Recomendado)</option>
                    <option value={5000}>5 segundos (Seguro)</option>
                    <option value={10000}>10 segundos (Muito seguro)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Máximo de tentativas
                  </label>
                  <select
                    value={config.maxTentativas}
                    onChange={(e) => setConfig({...config, maxTentativas: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    title="Número máximo de tentativas de contato por lead"
                  >
                    <option value={1}>1 tentativa</option>
                    <option value={2}>2 tentativas</option>
                    <option value={3}>3 tentativas (Recomendado)</option>
                    <option value={5}>5 tentativas</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Horário de disparo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={config.horarioInicio}
                      onChange={(e) => setConfig({...config, horarioInicio: e.target.value})}
                      className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      title="Horário de início dos disparos"
                    />
                    <span className="text-slate-500">até</span>
                    <input
                      type="time"
                      value={config.horarioFim}
                      onChange={(e) => setConfig({...config, horarioFim: e.target.value})}
                      className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      title="Horário de término dos disparos"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dias da semana
                  </label>
                  <div className="flex gap-1">
                    {DIAS_SEMANA_DISPLAY.map((dia, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleDia(index)}
                        className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                          isDiaSelecionado(index)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][index]}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500">
                ⚠️ Configurações mais agressivas aumentam o risco de bloqueio pelo WhatsApp. 
                Recomendamos usar as configurações padrão para números novos.
              </p>
            </div>
          )}
          
          {/* Barra de Progresso */}
          {status && status.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Progresso</span>
                <span className="text-slate-600">
                  {status.contatando + status.respondeu + status.semInteresse + status.interessado + status.optout} / {status.total} ({progresso}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Aguardando</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{status?.aguardando || 0}</span>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">Contatando</span>
              </div>
              <span className="text-2xl font-bold text-blue-900">{status?.contatando || 0}</span>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <UserCheck className="w-4 h-4" />
                <span className="text-sm">Interessados</span>
              </div>
              <span className="text-2xl font-bold text-green-900">{status?.interessado || 0}</span>
              {metricas && (
                <span className="text-xs text-green-600 ml-1">({metricas.taxaConversao})</span>
              )}
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <UserX className="w-4 h-4" />
                <span className="text-sm">Opt-out</span>
              </div>
              <span className="text-2xl font-bold text-amber-900">{status?.optout || 0}</span>
              {metricas && (
                <span className="text-xs text-amber-600 ml-1">({metricas.optoutRate})</span>
              )}
            </div>
          </div>
          
          {/* Detalhes adicionais */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200">
            <div className="text-center">
              <span className="text-sm text-slate-500">Responderam</span>
              <div className="text-lg font-semibold text-slate-900">
                {status?.respondeu || 0}
              </div>
            </div>
            <div className="text-center">
              <span className="text-sm text-slate-500">Sem Interesse</span>
              <div className="text-lg font-semibold text-slate-900">
                {status?.semInteresse || 0}
              </div>
            </div>
            <div className="text-center">
              <span className="text-sm text-slate-500">Taxa de Resposta</span>
              <div className="text-lg font-semibold text-blue-600">
                {metricas?.taxaResposta || '0%'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
