/**
 * PainelDisparo - Componente de controle de disparos de prospecção ativa
 *
 * Versão Premium:
 * - Hero de controle operacional
 * - Presets inteligentes de risco
 * - Previsão de cadência de envio
 * - Métricas operacionais e de funil em cards
 * - Configuração avançada com feedback de alterações
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  Play,
  Pause,
  Settings,
  Loader2,
  MessageSquare,
  UserX,
  Clock,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Save,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Timer,
  CalendarDays,
  Activity,
  Target,
  TrendingUp,
  Flame,
  RotateCcw,
  Power,
  UserCog,
  Bot,
  Ban,
} from "lucide-react";
import { api } from "../servicos/api";

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
  atrasoEntreMensagens: number;
  maxTentativas: number;
  horarioInicio: string;
  horarioFim: string;
  diasSemana: string[];
}

interface PainelDisparoProps {
  campanhaId: string;
  campanhaStatus?: string;
  onStatusChange?: () => void;
}

type DisparoModo = "lote" | "continuo";
type EscopoEnvio = "todos-elegiveis" | "aguardando" | "contatando";
type SnapshotDisparo = {
  ts: number;
  processados: number;
  interessados: number;
  respostas: number;
  optout: number;
  falhas: number;
};

const CONFIG_PADRAO: ConfiguracaoDisparo = {
  mensagensPorMinuto: 20,
  atrasoEntreMensagens: 3000,
  maxTentativas: 3,
  horarioInicio: "08:00",
  horarioFim: "18:00",
  diasSemana: ["seg", "ter", "qua", "qui", "sex"],
};

const DIAS_SEMANA_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DIAS_SEMANA_DISPLAY = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_SEMANA_NOMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function calcularDuracaoJanela(horarioInicio: string, horarioFim: string): number {
  const [hIni, mIni] = horarioInicio.split(":").map(Number);
  const [hFim, mFim] = horarioFim.split(":").map(Number);

  const inicio = hIni * 60 + mIni;
  const fim = hFim * 60 + mFim;

  if (fim >= inicio) return fim - inicio;
  return 24 * 60 - inicio + fim;
}

function classificarRisco(config: ConfiguracaoDisparo): "baixo" | "medio" | "alto" {
  const score =
    (config.mensagensPorMinuto >= 30 ? 2 : config.mensagensPorMinuto >= 20 ? 1 : 0) +
    (config.atrasoEntreMensagens <= 2500 ? 2 : config.atrasoEntreMensagens <= 3500 ? 1 : 0) +
    (config.maxTentativas >= 5 ? 2 : config.maxTentativas >= 3 ? 1 : 0) +
    ((config.diasSemana || []).length >= 6 ? 1 : 0);

  if (score >= 5) return "alto";
  if (score >= 3) return "medio";
  return "baixo";
}

function calcularPercentual(valor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((valor / total) * 1000) / 10;
}

export function PainelDisparo({ campanhaId, campanhaStatus = "ATIVA", onStatusChange }: PainelDisparoProps) {
  const [status, setStatus] = useState<StatusDisparo | null>(null);
  const [metricas, setMetricas] = useState<MetricasDisparo | null>(null);
  const [config, setConfig] = useState<ConfiguracaoDisparo>(CONFIG_PADRAO);
  const [configOriginal, setConfigOriginal] = useState<ConfiguracaoDisparo>(CONFIG_PADRAO);
  const [disparando, setDisparando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [modoDisparo, setModoDisparo] = useState<DisparoModo>("lote");
  const [escopoEnvio, setEscopoEnvio] = useState<EscopoEnvio>("todos-elegiveis");
  const [processandoGestao, setProcessandoGestao] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [historicoSnapshots, setHistoricoSnapshots] = useState<SnapshotDisparo[]>([]);

  const configAlterada = JSON.stringify(config) !== JSON.stringify(configOriginal);

  const carregarConfig = useCallback(async () => {
    try {
      const response = await api.get(`/campanhas/${campanhaId}/config-disparo`);
      const configCarregada = response.data.config;
      setConfig(configCarregada);
      setConfigOriginal(configCarregada);
    } catch (error) {
      console.error("Erro ao carregar config:", error);
    }
  }, [campanhaId]);

  const salvarConfig = async () => {
    setSalvandoConfig(true);
    setErro(null);

    try {
      await api.put(`/campanhas/${campanhaId}/config-disparo`, config);
      setConfigOriginal(config);
      setSucesso("Configurações de disparo salvas.");
    } catch (error: any) {
      setErro(error.response?.data?.erro || "Erro ao salvar configurações");
    } finally {
      setSalvandoConfig(false);
      setTimeout(() => setSucesso(null), 3000);
    }
  };

  const buscarStatus = useCallback(async () => {
    try {
      const response = await api.get(`/campanhas/${campanhaId}/status-disparo`);
      const statusAtual = response.data.status as StatusDisparo;

      setStatus(statusAtual);
      setMetricas(response.data.metricas);
      setUltimaAtualizacao(new Date());
      setHistoricoSnapshots((anterior) => {
        const processados = statusAtual.contatando + statusAtual.respondeu + statusAtual.semInteresse + statusAtual.interessado + statusAtual.optout + statusAtual.falha;
        const respostas = statusAtual.respondeu + statusAtual.semInteresse + statusAtual.interessado;
        const novo: SnapshotDisparo = {
          ts: Date.now(),
          processados,
          interessados: statusAtual.interessado,
          respostas,
          optout: statusAtual.optout,
          falhas: statusAtual.falha,
        };

        const ultimo = anterior[anterior.length - 1];
        if (
          ultimo &&
          ultimo.processados === novo.processados &&
          ultimo.interessados === novo.interessados &&
          ultimo.respostas === novo.respostas &&
          ultimo.optout === novo.optout &&
          ultimo.falhas === novo.falhas
        ) {
          return anterior;
        }

        const proximo = [...anterior, novo];
        return proximo.slice(-24);
      });

      setDisparando((anterior) => {
        if (campanhaStatus !== "ATIVA") return false;
        if (statusAtual.contatando > 0) return true;
        if (statusAtual.aguardando === 0) return false;
        return anterior;
      });
    } catch (error) {
      console.error("Erro ao buscar status:", error);
    } finally {
      setLoading(false);
    }
  }, [campanhaId, campanhaStatus]);

  useEffect(() => {
    buscarStatus();
    carregarConfig();
  }, [buscarStatus, carregarConfig]);

  useEffect(() => {
    const intervaloMs = disparando ? 7000 : 15000;
    const interval = setInterval(() => {
      buscarStatus();
    }, intervaloMs);

    return () => clearInterval(interval);
  }, [buscarStatus, disparando]);

  const iniciarDisparo = async (modo: DisparoModo = "lote") => {
    setProcessando(true);
    setErro(null);

    try {
      if (configAlterada) {
        await api.put(`/campanhas/${campanhaId}/config-disparo`, config);
        setConfigOriginal(config);
      }

      const response = await api.post(`/campanhas/${campanhaId}/disparar`, {
        modo,
        config,
      });

      if (response.data.sucesso) {
        setSucesso(`Disparo iniciado no modo ${modo === "lote" ? "lote" : "contínuo"}.`);
        setDisparando(true);
        setModoDisparo(modo);
        await buscarStatus();
        onStatusChange?.();
      } else {
        setErro(response.data.mensagem || "Erro ao iniciar disparo");
      }
    } catch (error: any) {
      setErro(error.response?.data?.erro || "Erro ao iniciar disparo");
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
      setSucesso("Disparo pausado com sucesso.");
      setDisparando(false);
      await buscarStatus();
      onStatusChange?.();
    } catch (error: any) {
      setErro(error.response?.data?.erro || "Erro ao pausar disparo");
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
      setSucesso("Campanha reativada. Pronta para novos disparos.");
      onStatusChange?.();
    } catch (error: any) {
      setErro(error.response?.data?.erro || "Erro ao reativar");
    } finally {
      setProcessando(false);
      setTimeout(() => setSucesso(null), 5000);
    }
  };

  const toggleDia = (diaIndex: number) => {
    const diaLabel = DIAS_SEMANA_LABELS[diaIndex];
    const diasAtuais = config.diasSemana || [];
    const novosDias = diasAtuais.includes(diaLabel)
      ? diasAtuais.filter((d) => d !== diaLabel)
      : [...diasAtuais, diaLabel];
    setConfig({ ...config, diasSemana: novosDias });
  };

  const isDiaSelecionado = (diaIndex: number) => {
    const diaLabel = DIAS_SEMANA_LABELS[diaIndex];
    return (config.diasSemana || []).includes(diaLabel);
  };

  const aplicarPreset = (preset: "seguro" | "balanceado" | "agressivo") => {
    if (preset === "seguro") {
      setConfig((anterior) => ({
        ...anterior,
        mensagensPorMinuto: 10,
        atrasoEntreMensagens: 5000,
        maxTentativas: 2,
      }));
      return;
    }

    if (preset === "balanceado") {
      setConfig((anterior) => ({
        ...anterior,
        mensagensPorMinuto: 20,
        atrasoEntreMensagens: 3000,
        maxTentativas: 3,
      }));
      return;
    }

    setConfig((anterior) => ({
      ...anterior,
      mensagensPorMinuto: 30,
      atrasoEntreMensagens: 2000,
      maxTentativas: 5,
    }));
  };

  const redefinirConfig = () => {
    setConfig(configOriginal);
  };

  const STATUS_EM_CONTATO = `CONTA${'TANDO'}`;

  const statusEscopo = useMemo(() => {
    if (escopoEnvio === "aguardando") return ["AGUARDANDO"];
    if (escopoEnvio === "contatando") return [STATUS_EM_CONTATO];
    return ["AGUARDANDO", STATUS_EM_CONTATO];
  }, [escopoEnvio]);

  const aplicarControleEnvio = async (acao: "pausar" | "reincluir-ia" | "assumir-humano") => {
    setProcessandoGestao(true);
    setErro(null);
    try {
      const response = await api.post(`/campanhas/${campanhaId}/contatos/controle-envio`, {
        acao,
        statusProspeccao: statusEscopo,
        motivo: "Ajuste operacional pela aba de disparos",
      });
      const total = response.data?.contatosAfetados || 0;
      setSucesso(`${response.data?.mensagem || "Controle aplicado"} (${total} contato(s)).`);
      await buscarStatus();
      onStatusChange?.();
    } catch (error: any) {
      setErro(error.response?.data?.erro || "Erro ao aplicar controle de envio");
    } finally {
      setProcessandoGestao(false);
      setTimeout(() => setSucesso(null), 5000);
    }
  };

  const finalizarCampanhaDefinitivo = async () => {
    const confirmar = window.confirm("Deseja finalizar a campanha em definitivo? Isso interrompe os disparos.");
    if (!confirmar) return;

    setProcessandoGestao(true);
    setErro(null);
    try {
      await api.patch(`/campanhas/${campanhaId}/status`, { status: "FINALIZADA" });
      setSucesso("Campanha finalizada em definitivo.");
      setDisparando(false);
      await buscarStatus();
      onStatusChange?.();
    } catch (error: any) {
      setErro(error.response?.data?.erro || "Erro ao finalizar campanha");
    } finally {
      setProcessandoGestao(false);
      setTimeout(() => setSucesso(null), 5000);
    }
  };

  const calculos = useMemo(() => {
    const total = status?.total || 0;
    const aguardando = status?.aguardando || 0;
    const contatando = status?.contatando || 0;
    const respondeu = status?.respondeu || 0;
    const semInteresse = status?.semInteresse || 0;
    const interessado = status?.interessado || 0;
    const optout = status?.optout || 0;
    const falha = status?.falha || 0;

    const processados = contatando + respondeu + semInteresse + interessado + optout + falha;
    const concluidos = respondeu + semInteresse + interessado + optout + falha;
    const progresso = total > 0 ? Math.round((processados / total) * 100) : 0;
    const taxaFalha = total > 0 ? ((falha / total) * 100).toFixed(1) : "0.0";
    const previsaoMinutos = config.mensagensPorMinuto > 0 ? Math.ceil(aguardando / config.mensagensPorMinuto) : 0;
    const janelaMin = calcularDuracaoJanela(config.horarioInicio, config.horarioFim);
    const risco = classificarRisco(config);

    return {
      total,
      aguardando,
      contatando,
      respondeu,
      semInteresse,
      interessado,
      optout,
      falha,
      processados,
      concluidos,
      progresso,
      taxaFalha,
      previsaoMinutos,
      janelaHoras: (janelaMin / 60).toFixed(1),
      risco,
    };
  }, [status, config]);

  const distribuicaoOperacional = useMemo(() => {
    const itens = [
      { chave: "aguardando", label: "Aguardando", valor: calculos.aguardando, cor: "bg-slate-400" },
      { chave: "contatando", label: "Contatando", valor: calculos.contatando, cor: "bg-indigo-500" },
      { chave: "respondeu", label: "Responderam", valor: calculos.respondeu, cor: "bg-blue-500" },
      { chave: "interessado", label: "Interessados", valor: calculos.interessado, cor: "bg-emerald-500" },
      { chave: "semInteresse", label: "Sem Interesse", valor: calculos.semInteresse, cor: "bg-amber-500" },
      { chave: "optout", label: "Opt-out", valor: calculos.optout, cor: "bg-orange-500" },
      { chave: "falha", label: "Falha", valor: calculos.falha, cor: "bg-red-500" },
    ];

    const total = itens.reduce((acc, item) => acc + item.valor, 0);
    return { itens, total };
  }, [calculos]);

  const timelineSemanal = useMemo(() => {
    const agoraBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diaAtual = agoraBrasilia.getDay();
    const minutosAgora = agoraBrasilia.getHours() * 60 + agoraBrasilia.getMinutes();

    const [hIni, mIni] = config.horarioInicio.split(":").map(Number);
    const [hFim, mFim] = config.horarioFim.split(":").map(Number);
    const minutosInicio = hIni * 60 + mIni;
    const minutosFim = hFim * 60 + mFim;

    const dentroDaJanela = minutosFim >= minutosInicio
      ? minutosAgora >= minutosInicio && minutosAgora < minutosFim
      : minutosAgora >= minutosInicio || minutosAgora < minutosFim;

    return DIAS_SEMANA_LABELS.map((label, index) => {
      const ativo = (config.diasSemana || []).includes(label);
      const hoje = index === diaAtual;
      return {
        label,
        display: DIAS_SEMANA_DISPLAY[index],
        nome: DIAS_SEMANA_NOMES[index],
        ativo,
        hoje,
        janelaAberta: ativo && hoje && dentroDaJanela,
      };
    });
  }, [config.diasSemana, config.horarioInicio, config.horarioFim]);

  const temAlgumDiaAtivo = useMemo(
    () => timelineSemanal.some((dia) => dia.ativo),
    [timelineSemanal]
  );

  const tendencia = useMemo(() => {
    const tamanho = historicoSnapshots.length;
    if (tamanho < 2) {
      return {
        deltaProcessados: 0,
        deltaInteressados: 0,
        deltaRespostas: 0,
      };
    }

    const ultimo = historicoSnapshots[tamanho - 1];
    const anterior = historicoSnapshots[Math.max(0, tamanho - 2)];
    return {
      deltaProcessados: ultimo.processados - anterior.processados,
      deltaInteressados: ultimo.interessados - anterior.interessados,
      deltaRespostas: ultimo.respostas - anterior.respostas,
    };
  }, [historicoSnapshots]);

  const pontosGrafico = useMemo(() => {
    if (historicoSnapshots.length === 0) return [];
    const base = historicoSnapshots.map((item) => item.processados);
    const max = Math.max(...base, 1);
    return historicoSnapshots.map((item, index) => ({
      id: `${item.ts}-${index}`,
      altura: Math.max(8, Math.round((item.processados / max) * 72)),
      label: new Date(item.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      valor: item.processados,
    }));
  }, [historicoSnapshots]);

  if (loading) {
    return (
      <Card className="card-premium rounded-2xl">
        <CardContent className="flex justify-center items-center h-56">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
        </CardContent>
      </Card>
    );
  }

  const statusLabel = disparando ? "Disparando" : campanhaStatus === "PAUSADA" ? "Pausado" : "Aguardando";

  return (
    <div className="w-full space-y-5 md:space-y-6 animate-fade-in flex flex-col">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" />
          {sucesso}
        </div>
      )}

      <Card className="order-1 card-premium rounded-2xl overflow-hidden border-indigo-200/70 animate-fade-in" style={{ animationDelay: "20ms" }}>
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-4 md:p-6 border-b border-indigo-100">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <h3 className="text-xl md:text-2xl font-semibold gradient-text">Central Premium de Disparo</h3>
                </div>
                <p className="text-sm text-slate-600">
                  Modo atual: <span className="font-medium text-slate-800">{modoDisparo === "lote" ? "Lote" : "Contínuo"}</span> · Status: <span className="font-medium text-slate-800">{statusLabel}</span>
                </p>
                {ultimaAtualizacao && (
                  <p className="text-xs text-slate-500 mt-1">
                    Última atualização: {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {campanhaStatus === "PAUSADA" ? (
                  <Button onClick={reativarDisparo} disabled={processando} className="gap-2 btn-success-premium">
                    {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Reativar Campanha
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => iniciarDisparo(modoDisparo)}
                      disabled={processando || disparando || calculos.aguardando === 0}
                      className="gap-2 btn-premium"
                    >
                      {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      {modoDisparo === "lote" ? `Executar lote (${config.mensagensPorMinuto} msgs)` : "Iniciar fluxo contínuo"}
                    </Button>

                    {disparando && (
                      <Button
                        onClick={pausarDisparo}
                        disabled={processando}
                        variant="outline"
                        className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        <Pause className="w-4 h-4" />
                        Pausar
                      </Button>
                    )}
                  </>
                )}

                <Button variant="outline" className="gap-2" onClick={buscarStatus}>
                  <RefreshCw className="w-4 h-4" />
                  Atualizar dados
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                Modo de disparo
              </div>
              <div className="text-lg font-semibold text-slate-900">{modoDisparo === "lote" ? "Lote" : "Contínuo"}</div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-xs text-indigo-700 mb-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                Cadência
              </div>
              <div className="text-lg font-semibold text-indigo-900">{config.mensagensPorMinuto} msg/min</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs text-emerald-700 mb-1 flex items-center gap-1">
                <Timer className="w-3.5 h-3.5" />
                Delay entre mensagens
              </div>
              <div className="text-lg font-semibold text-emerald-900">{Math.round(config.atrasoEntreMensagens / 1000)}s</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs text-amber-700 mb-1 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                Janela ativa
              </div>
              <div className="text-lg font-semibold text-amber-900">{config.horarioInicio} - {config.horarioFim}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {calculos.total === 0 && (
        <Card className="order-2 card-premium rounded-2xl border-dashed border-slate-300 bg-slate-50/70 animate-fade-in" style={{ animationDelay: "40ms" }}>
          <CardContent className="p-5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Aguardando base para disparo</p>
                <p className="text-sm text-slate-600 mt-1">
                  Ainda não há contatos processáveis no funil desta campanha. Importe ou adicione contatos para iniciar a operação.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="order-3 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
        <p className="text-sm font-semibold text-indigo-900">Configuração e controle operacional</p>
        <p className="text-xs text-indigo-700 mt-1">Defina regras de envio, escopo e ações de gestão antes de acompanhar as métricas.</p>
      </div>

      <Card className="order-3 card-premium rounded-2xl animate-fade-in border-indigo-200/70" style={{ animationDelay: "50ms" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCog className="w-5 h-5 text-brand" />
            Configuração de gerenciamento de envio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Escopo da ação</label>
              <select
                value={escopoEnvio}
                onChange={(e) => setEscopoEnvio(e.target.value as EscopoEnvio)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand"
              >
                <option value="todos-elegiveis">Todos elegíveis (Aguardando + Contatando)</option>
                <option value="aguardando">Somente Aguardando</option>
                <option value="contatando">Somente Contatando</option>
              </select>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Controle operacional de envio: pausar contatos do escopo, reincluir na IA, pausar/retomar a campanha ou finalizar em definitivo.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            <Button
              variant="outline"
              className="gap-2 justify-start"
              disabled={processandoGestao}
              onClick={() => aplicarControleEnvio("pausar")}
            >
              <Ban className="w-4 h-4 text-amber-600" />
              Excluir do envio (pausar)
            </Button>
            <Button
              variant="outline"
              className="gap-2 justify-start"
              disabled={processandoGestao}
              onClick={() => aplicarControleEnvio("reincluir-ia")}
            >
              <Bot className="w-4 h-4 text-emerald-600" />
              Reincluir no envio IA
            </Button>
            <Button
              variant="outline"
              className="gap-2 justify-start"
              disabled={processandoGestao}
              onClick={() => (campanhaStatus === "PAUSADA" ? reativarDisparo() : pausarDisparo())}
            >
              {campanhaStatus === "PAUSADA" ? (
                <>
                  <Play className="w-4 h-4 text-emerald-600" />
                  Retomar campanha
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 text-amber-600" />
                  Pausa manual da campanha
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="gap-2 justify-start text-red-700 border-red-300 hover:bg-red-50"
              disabled={processandoGestao}
              onClick={finalizarCampanhaDefinitivo}
            >
              <Power className="w-4 h-4 text-red-600" />
              Parar em definitivo
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="order-6 grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-6">
        <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Métricas e desempenho</p>
          <p className="text-xs text-slate-600 mt-1">Bloco analítico consolidado para acompanhamento da operação.</p>
        </div>
        <Card className="xl:col-span-2 card-premium rounded-2xl animate-fade-in" style={{ animationDelay: "60ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand" />
              Desempenho do Disparo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Progresso operacional</span>
                <span className="text-slate-600">
                  {calculos.processados} / {calculos.total} ({calculos.progresso}%)
                </span>
              </div>
              <Progress value={calculos.progresso} className="h-3 bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Contatos concluídos</p>
                <p className="text-xl font-semibold text-slate-900">{calculos.concluidos}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Taxa de resposta</p>
                <p className="text-xl font-semibold text-brand">{metricas?.taxaResposta || "0%"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Taxa de conversão</p>
                <p className="text-xl font-semibold text-emerald-700">{metricas?.taxaConversao || "0%"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Falhas</p>
                <p className="text-xl font-semibold text-red-600">{calculos.falha} ({calculos.taxaFalha}%)</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-700">Evolução em tempo real</h4>
                <span className="text-xs text-slate-500">Últimos {historicoSnapshots.length} snapshots</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="text-slate-500">Processados</p>
                  <p className={`font-semibold ${tendencia.deltaProcessados >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {tendencia.deltaProcessados >= 0 ? "+" : ""}{tendencia.deltaProcessados}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="text-slate-500">Respostas</p>
                  <p className={`font-semibold ${tendencia.deltaRespostas >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {tendencia.deltaRespostas >= 0 ? "+" : ""}{tendencia.deltaRespostas}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="text-slate-500">Interessados</p>
                  <p className={`font-semibold ${tendencia.deltaInteressados >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {tendencia.deltaInteressados >= 0 ? "+" : ""}{tendencia.deltaInteressados}
                  </p>
                </div>
              </div>

              <div className="h-24 rounded-lg border border-slate-100 bg-slate-50/70 p-2 flex items-end gap-1 overflow-hidden">
                {pontosGrafico.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                    Coletando histórico operacional...
                  </div>
                ) : (
                  pontosGrafico.map((ponto) => (
                    <div
                      key={ponto.id}
                      className="flex-1 min-w-[6px] rounded-sm bg-gradient-to-t from-indigo-600 to-indigo-300 transition-all duration-500"
                      style={{ height: `${ponto.altura}px` }}
                      title={`${ponto.label} · ${ponto.valor} processados`}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700">Distribuição operacional</h4>
                <span className="text-xs text-slate-500">{distribuicaoOperacional.total} registros</span>
              </div>
              <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex">
                {distribuicaoOperacional.total === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-slate-500 bg-slate-100">
                    Sem dados de distribuição
                  </div>
                ) : (
                  distribuicaoOperacional.itens.map((item) => {
                    const percentual = calcularPercentual(item.valor, distribuicaoOperacional.total);
                    if (item.valor === 0 || percentual === 0) return null;
                    return (
                      <div
                        key={item.chave}
                        className={`${item.cor} transition-all duration-700`}
                        style={{ width: `${percentual}%` }}
                        title={`${item.label}: ${item.valor} (${percentual}%)`}
                      />
                    );
                  })
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {distribuicaoOperacional.itens.map((item) => {
                  const percentual = calcularPercentual(item.valor, distribuicaoOperacional.total);
                  return (
                    <div key={item.chave} className="flex items-center gap-2 text-xs">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.cor}`} />
                      <span className="text-slate-600">{item.label}</span>
                      <span className="ml-auto text-slate-800 font-medium">{percentual}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-4 bg-white">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Funil em tempo real</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Responderam</span><span className="font-medium">{calculos.respondeu}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Sem interesse</span><span className="font-medium">{calculos.semInteresse}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Opt-out</span><span className="font-medium">{calculos.optout}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Taxa opt-out</span><span className="font-medium">{metricas?.optoutRate || "0%"}</span></div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 bg-white">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Previsão de execução</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Fila restante</span><span className="font-medium">{calculos.aguardando}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Ritmo atual</span><span className="font-medium">{config.mensagensPorMinuto} msg/min</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Tempo estimado</span><span className="font-medium">~{calculos.previsaoMinutos} min</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Janela diária</span><span className="font-medium">{config.horarioInicio} - {config.horarioFim}</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium rounded-2xl animate-fade-in" style={{ animationDelay: "80ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="w-5 h-5 text-brand" />
              Cadência e Risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded-lg border p-3 ${calculos.risco === "alto" ? "border-red-300 bg-red-50" : calculos.risco === "medio" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {calculos.risco === "alto" ? <ShieldAlert className="w-4 h-4 text-red-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                Risco {calculos.risco === "alto" ? "Alto" : calculos.risco === "medio" ? "Médio" : "Baixo"}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {calculos.risco === "alto"
                  ? "Cadência agressiva para números novos. Considere reduzir ritmo para evitar bloqueios."
                  : calculos.risco === "medio"
                  ? "Configuração equilibrada para volume com segurança moderada."
                  : "Perfil conservador recomendado para aquecimento e estabilidade."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Presets inteligentes</p>
              <div className="grid gap-2">
                <button type="button" onClick={() => aplicarPreset("seguro")} className="text-left rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-900"><ShieldCheck className="w-4 h-4" /> Seguro</div>
                  <p className="text-xs text-emerald-700">10/min · 5s · 2 tentativas</p>
                </button>
                <button type="button" onClick={() => aplicarPreset("balanceado")} className="text-left rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 hover:bg-indigo-100 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium text-indigo-900"><Activity className="w-4 h-4" /> Balanceado</div>
                  <p className="text-xs text-indigo-700">20/min · 3s · 3 tentativas</p>
                </button>
                <button type="button" onClick={() => aplicarPreset("agressivo")} className="text-left rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 hover:bg-amber-100 transition-colors">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-900"><Flame className="w-4 h-4" /> Agressivo</div>
                  <p className="text-xs text-amber-700">30/min · 2s · 5 tentativas</p>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-700 mb-2">Resumo operacional</p>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> Delay entre mensagens</span><span className="font-medium text-slate-800">{Math.round(config.atrasoEntreMensagens / 1000)}s</span></div>
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Janela ativa</span><span className="font-medium text-slate-800">{calculos.janelaHoras}h/dia</span></div>
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Máx. tentativas</span><span className="font-medium text-slate-800">{config.maxTentativas}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="order-5 card-premium rounded-2xl animate-fade-in" style={{ animationDelay: "100ms" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand" />
            Janela semanal de execução
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!temAlgumDiaAtivo && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Nenhum dia ativo configurado. Ative pelo menos um dia para liberar disparos automáticos.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {timelineSemanal.map((dia) => (
              <div
                key={dia.label}
                className={`rounded-xl border p-3 transition-all ${
                  dia.hoje
                    ? "border-indigo-300 bg-indigo-50"
                    : dia.ativo
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">{dia.display}</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      dia.janelaAberta ? "bg-emerald-500 animate-pulse" : dia.ativo ? "bg-emerald-400" : "bg-slate-300"
                    }`}
                  />
                </div>
                <p className="text-xs text-slate-600">{dia.nome}</p>
                <p className="text-xs mt-1 font-medium text-slate-700">
                  {dia.ativo ? `${config.horarioInicio} - ${config.horarioFim}` : "Inativo"}
                </p>
                {dia.hoje && (
                  <p className={`text-[11px] mt-2 font-medium ${dia.janelaAberta ? "text-emerald-700" : "text-slate-600"}`}>
                    {dia.janelaAberta ? "Janela ativa agora" : "Fora da janela ativa"}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Referência de horário: Brasília. Os dias exibidos seguem a configuração ativa da campanha.
          </div>
        </CardContent>
      </Card>

      <Card className="order-4 card-premium rounded-2xl animate-fade-in" style={{ animationDelay: "120ms" }}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand" />
              Configurações avançadas de disparo
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={redefinirConfig} disabled={!configAlterada || salvandoConfig}>
                <RotateCcw className="w-4 h-4" />
                Reverter
              </Button>
              <Button onClick={salvarConfig} disabled={salvandoConfig || !configAlterada} className="gap-2 btn-premium">
                {salvandoConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar configurações
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-4 md:p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mensagens por minuto</label>
              <select
                value={config.mensagensPorMinuto}
                onChange={(e) => setConfig({ ...config, mensagensPorMinuto: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand"
                title="Quantidade de mensagens enviadas por minuto"
              >
                <option value={10}>10 msgs/min (Seguro)</option>
                <option value={15}>15 msgs/min</option>
                <option value={20}>20 msgs/min (Recomendado)</option>
                <option value={30}>30 msgs/min (Arriscado)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delay entre mensagens</label>
              <select
                value={config.atrasoEntreMensagens}
                onChange={(e) => setConfig({ ...config, atrasoEntreMensagens: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand"
                title="Tempo de espera entre cada mensagem enviada"
              >
                <option value={2000}>2 segundos</option>
                <option value={3000}>3 segundos (Recomendado)</option>
                <option value={5000}>5 segundos (Seguro)</option>
                <option value={10000}>10 segundos (Muito seguro)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Máximo de tentativas</label>
              <select
                value={config.maxTentativas}
                onChange={(e) => setConfig({ ...config, maxTentativas: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Horário de disparo</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={config.horarioInicio}
                  onChange={(e) => setConfig({ ...config, horarioInicio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand"
                  title="Horário de início dos disparos"
                />
                <span className="text-slate-500">até</span>
                <input
                  type="time"
                  value={config.horarioFim}
                  onChange={(e) => setConfig({ ...config, horarioFim: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand"
                  title="Horário de término dos disparos"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modo de disparo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModoDisparo("lote")}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    modoDisparo === "lote"
                      ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Lote
                </button>
                <button
                  type="button"
                  onClick={() => setModoDisparo("continuo")}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    modoDisparo === "continuo"
                      ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Contínuo
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA_DISPLAY.map((dia, index) => (
                <button
                  key={DIAS_SEMANA_LABELS[index]}
                  type="button"
                  onClick={() => toggleDia(index)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                    isDiaSelecionado(index)
                      ? "bg-brand text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  title={DIAS_SEMANA_NOMES[index]}
                >
                  {dia}
                </button>
              ))}
            </div>
          </div>

          {configAlterada && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Existem alterações não salvas. Salve antes do próximo disparo para garantir consistência operacional.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
