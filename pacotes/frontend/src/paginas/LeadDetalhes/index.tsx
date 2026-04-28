/**
 * Página de Detalhes do Lead - V3 (Refatorada)
 * 
 * Estrutura modular com componentes separados para melhor manutenção.
 * Alinhada ao Playbook de Captação MVP (4 Etapas).
 */

import { Suspense, lazy, useEffect, useState } from "react";
import {
    ArrowLeft,
    Loader2,
    AlertCircle,
    Calendar,
    Plus,
    Check,
    MessageSquare,
    MessageCircle,
    Phone,
    Home,
    RefreshCw,
    CheckCircle2,
    Target,
    AlertTriangle,
    Trophy,
    XOctagon,
    Save,
    Building2,
    Bot,
    Link2,
    ExternalLink,
    Edit,
    Shield,
} from "lucide-react";
import { Button } from "../../componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../componentes/ui/card";
import { Badge } from "../../componentes/ui/badge";
import { Progress } from "../../componentes/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../componentes/ui/tabs";
import { Input } from "../../componentes/ui/input";
import { Textarea } from "../../componentes/ui/textarea";
import { PageHeader } from "../../componentes/ui/page-header";
import { api } from "../../servicos/api";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../componentes/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../componentes/ui/select";

// Hooks e utilidades
import { useLeadDetalhes } from "./hooks/useLeadDetalhes";
import { formatarData, formatarDataHora, tempoRelativo, formatarCNPJ } from "./utils";
import {
    statusAgendamentoConfig,
    motivosPerdaOptions,
    tipoAutorizacaoOptions,
    situacaoFinanceiraOptions,
    estadoConservacaoOptions,
    prazoTrabalhoOptions
} from "./constantes";

// Componentes
import {
    LeadHeader,
    BannersStatus,
    CardImovel,
    CardNegociacao,
    CardContrato,
    CardProprietario,
} from "./componentes";

const ChatModal = lazy(() => import("../../componentes/ChatModal").then((m) => ({ default: m.ChatModal })));

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function LeadDetalhes() {
    const {
        lead,
        carregando,
        erro,
        salvando,
        formEditar,
        setFormEditar,
        formPerdido,
        setFormPerdido,
        formCaptado,
        setFormCaptado,
        formAtividade,
        setFormAtividade,
        carregarLead,
        salvarEdicao,
        marcarPerdido,
        marcarCaptado,
        arquivar,
        excluirComConfirmacao,
        reativar,
        criarAtividade,
        acaoAtividade,
        voltar,
        copiarTelefone,
        isPerdidoOuArquivado,
        isCaptado,
    } = useLeadDetalhes();

    // Modais
    const [modalEditar, setModalEditar] = useState(false);
    const [modalPerdido, setModalPerdido] = useState(false);
    const [modalCaptado, setModalCaptado] = useState(false);
    const [modalArquivar, setModalArquivar] = useState(false);
    const [modalAtividade, setModalAtividade] = useState(false);
    const [abaPrincipal, setAbaPrincipal] = useState("atendimento");
    const [chatOpen, setChatOpen] = useState(false);

    const celebrarConversao = () => {
        const host = document.createElement("div");
        host.style.position = "fixed";
        host.style.inset = "0";
        host.style.pointerEvents = "none";
        host.style.zIndex = "9999";
        document.body.appendChild(host);

        const cores = ["#2563EB", "#7C3AED", "#10B981", "#F59E0B"];
        const total = 80;
        for (let i = 0; i < total; i += 1) {
            const p = document.createElement("div");
            const tamanho = 6 + Math.random() * 6;
            p.style.position = "absolute";
            p.style.width = `${tamanho}px`;
            p.style.height = `${tamanho}px`;
            p.style.left = "50%";
            p.style.top = "55%";
            p.style.background = cores[Math.floor(Math.random() * cores.length)];
            p.style.borderRadius = "2px";
            p.style.opacity = "0.95";
            p.style.transform = "translate(-50%, -50%)";
            p.style.transition = "transform 900ms cubic-bezier(.2,.9,.2,1), opacity 900ms ease-out";
            host.appendChild(p);

            const ang = (Math.PI * 2 * i) / total;
            const dist = 80 + Math.random() * 140;
            const x = Math.cos(ang) * dist;
            const y = Math.sin(ang) * dist - 60;

            requestAnimationFrame(() => {
                p.style.transform = `translate(${x}px, ${y}px) rotate(${Math.random() * 360}deg)`;
                p.style.opacity = "0";
            });
        }

        window.setTimeout(() => {
            host.remove();
        }, 1000);
    };

    const [cockpitAdmin, setCockpitAdmin] = useState<{
        agenteAdmin: {
            id: string;
            nome: string;
            tipoAgente: string;
            status: string;
            estaAtivo: boolean;
            sessaoWhatsapp?: {
                id: string;
                nome: string;
                numeroWhatsapp: string | null;
                status: string;
            } | null;
        } | null;
        integracaoCRM: {
            id: string;
            ativo: boolean;
            apiUrl: string;
            temApiKey: boolean;
            tenantIdDestino: number | null;
            ultimoTesteEm: string | null;
            ultimoTesteOk: boolean | null;
            ultimoErro: string | null;
            totalEnvios: number;
            totalSucessos: number;
            totalFalhas: number;
            ultimoEnvioEm: string | null;
        } | null;
        crmLead: {
            statusLead: string;
            proprietarioId: number | null;
            propertyId: number | null;
            propertyCode: string | null;
            syncStatus: string | null;
            syncError: string | null;
            enviadoEm: string | null;
        };
    } | null>(null);
    const [carregandoCockpitAdmin, setCarregandoCockpitAdmin] = useState(false);
    const [processandoCrm, setProcessandoCrm] = useState<null | "enviar" | "reenviar" | "status">(null);
    const [eventosCockpit, setEventosCockpit] = useState<Array<{
        id: string;
        acao: string;
        detalhes?: any;
        criadoEm: string;
        usuario?: { id: string; nome?: string | null; email?: string | null } | null;
    }>>([]);
    const [carregandoEventosCockpit, setCarregandoEventosCockpit] = useState(false);
    const [filtroPeriodoTelemetria, setFiltroPeriodoTelemetria] = useState<"7d" | "30d" | "90d" | "all">("30d");
    const [filtroTipoTelemetria, setFiltroTipoTelemetria] = useState<"todos" | "decisao" | "crm">("todos");
    const [filtroSucessoTelemetria, setFiltroSucessoTelemetria] = useState<"todos" | "sucesso" | "falha">("todos");
    const [metricasExecutivas, setMetricasExecutivas] = useState<{
        periodoDias: number;
        taxaSucesso: number;
        funil: {
            cliquesDecisao: number;
            acoesCrm: number;
            resultadosDecisao: number;
            resultadosCrm: number;
            sucessosDecisao: number;
            sucessosCrm: number;
        };
        rankingUsuarios: Array<{
            usuarioId: string;
            nome: string;
            email: string;
            totalAcoes: number;
            totalResultados: number;
            totalSucessos: number;
            taxaSucesso: number;
        }>;
        rankingAcoes: Array<{
            acao: string;
            totalAcoes: number;
            totalResultados: number;
            totalSucessos: number;
            taxaSucesso: number;
        }>;
    } | null>(null);
    const [carregandoMetricasExecutivas, setCarregandoMetricasExecutivas] = useState(false);

    // Estado para modal de exclusão com confirmação
    const [dadosVinculados, setDadosVinculados] = useState<{
        conversas: number;
        mensagens: number;
        atividades: number;
        imoveis: number;
        contratos: number;
    } | null>(null);
    const [textoConfirmacao, setTextoConfirmacao] = useState('');
    const [mensagemExclusao, setMensagemExclusao] = useState('');
    const [processandoRetencao, setProcessandoRetencao] = useState(false);
    const [preservarRagRetencao, setPreservarRagRetencao] = useState(false);

    // Handler para o botão de excluir
    const handleExcluir = async () => {
        const resultado = await arquivar();

        // Se retornou objeto com requiresConfirmation, mostra dados vinculados
        if (resultado && typeof resultado === 'object' && resultado.requiresConfirmation) {
            setDadosVinculados(resultado.dadosVinculados);
            setMensagemExclusao(resultado.mensagem);
        }
        // Se retornou true, fechou o modal e navegou
    };

    // Handler para confirmar exclusão
    const handleConfirmarExclusao = async () => {
        if (textoConfirmacao.toLowerCase() === 'excluir') {
            await excluirComConfirmacao();
            // O hook já navega de volta
        }
    };

    // Reset do modal ao fechar
    const handleFecharModalExcluir = (open: boolean) => {
        if (!open) {
            setDadosVinculados(null);
            setTextoConfirmacao('');
            setMensagemExclusao('');
            setPreservarRagRetencao(false);
        }
        setModalArquivar(open);
    };

    const handleRetencaoSegura = async () => {
        if (!lead?.id) return;
        try {
            setProcessandoRetencao(true);
            const response = await api.post(`/leads/${lead.id}/retencao-segura`, {
                confirmacao: "anonimizar",
                preservarRag: preservarRagRetencao,
            });
            const resultado = response.data?.resultado;
            toast.success(
                `Retenção segura aplicada. ${resultado?.mensagensAnonimizadas || 0} mensagens anonimizadas.`
            );
            await carregarLead();
            handleFecharModalExcluir(false);
        } catch (error: any) {
            toast.error(error?.response?.data?.erro || "Erro ao aplicar retenção segura");
        } finally {
            setProcessandoRetencao(false);
        }
    };

    const carregarCockpitAdmin = async (leadId: string) => {
        try {
            setCarregandoCockpitAdmin(true);
            const response = await api.get(`/leads/${leadId}/cockpit-admin`);
            setCockpitAdmin(response.data);
        } catch (error) {
            console.error('Erro ao carregar cockpit admin:', error);
        } finally {
            setCarregandoCockpitAdmin(false);
        }
    };

    const executarAcaoCrm = async (acao: "enviar" | "reenviar" | "status") => {
        if (!lead?.id) return;

        try {
            setProcessandoCrm(acao);
            await registrarEventoCockpit("CRM_ACAO", {
                tipo: acao,
                etapa: "inicio",
            });

            if (acao === "status") {
                const response = await api.get(`/leads/${lead.id}/crm/status`);
                if (response.data?.sucesso) {
                    toast.success("Status do CRM atualizado.");
                    await registrarEventoCockpit("CRM_RESULTADO", {
                        tipo: acao,
                        sucesso: true,
                        resposta: "Status atualizado",
                    });
                } else {
                    toast.warning(response.data?.resultado?.error || "CRM retornou sem confirmação.");
                    await registrarEventoCockpit("CRM_RESULTADO", {
                        tipo: acao,
                        sucesso: false,
                        resposta: response.data?.resultado?.error || "Sem confirmação",
                    });
                }
            } else {
                const endpoint = acao === "enviar" ? "enviar" : "reenviar";
                const response = await api.post(`/leads/${lead.id}/crm/${endpoint}`);
                if (response.data?.sucesso) {
                    toast.success(response.data?.mensagem || "Operação no CRM concluída.");
                    await registrarEventoCockpit("CRM_RESULTADO", {
                        tipo: acao,
                        sucesso: true,
                        resposta: response.data?.mensagem || "Concluído",
                    });
                } else {
                    toast.error(response.data?.erro || "Falha ao operar CRM.");
                    await registrarEventoCockpit("CRM_RESULTADO", {
                        tipo: acao,
                        sucesso: false,
                        resposta: response.data?.erro || "Falha",
                    });
                }
            }

            await Promise.all([carregarLead(), carregarCockpitAdmin(lead.id), carregarEventosCockpit(lead.id)]);
        } catch (error: any) {
            toast.error(error.response?.data?.erro || "Erro ao executar ação CRM");
            await registrarEventoCockpit("CRM_RESULTADO", {
                tipo: acao,
                sucesso: false,
                resposta: error.response?.data?.erro || "Erro interno",
            });
        } finally {
            setProcessandoCrm(null);
        }
    };

    const carregarEventosCockpit = async (leadId: string) => {
        try {
            setCarregandoEventosCockpit(true);
            const response = await api.get(`/leads/${leadId}/cockpit-eventos?limite=120`);
            setEventosCockpit(response.data?.eventos || []);
        } catch (error) {
            console.error("Erro ao carregar eventos do cockpit:", error);
        } finally {
            setCarregandoEventosCockpit(false);
        }
    };

    const carregarMetricasExecutivas = async (periodoDias: number) => {
        try {
            setCarregandoMetricasExecutivas(true);
            const response = await api.get(`/leads/cockpit-metricas?periodoDias=${periodoDias}`);
            if (response.data?.sucesso) {
                setMetricasExecutivas(response.data);
            }
        } catch (error) {
            console.error("Erro ao carregar métricas executivas do cockpit:", error);
        } finally {
            setCarregandoMetricasExecutivas(false);
        }
    };

    const registrarEventoCockpit = async (acao: string, detalhes?: Record<string, any>) => {
        if (!lead?.id) return;
        try {
            await api.post(`/leads/${lead.id}/cockpit-evento`, { acao, detalhes });
        } catch (error) {
            console.error("Erro ao registrar evento do cockpit:", error);
        }
    };

    useEffect(() => {
        if (!lead?.id) return;
        const periodoDias = filtroPeriodoTelemetria === "7d" ? 7 : filtroPeriodoTelemetria === "30d" ? 30 : filtroPeriodoTelemetria === "90d" ? 90 : 365;
        Promise.all([
            carregarCockpitAdmin(lead.id),
            carregarEventosCockpit(lead.id),
            carregarMetricasExecutivas(periodoDias),
        ]);
    }, [lead?.id, filtroPeriodoTelemetria]);

    // Loading State
    if (carregando) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                    <p className="text-slate-500">Carregando lead...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (erro || !lead) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <h3 className="text-lg font-medium text-slate-900">Erro ao carregar</h3>
                    <p className="text-slate-500">{erro || 'Lead não encontrado'}</p>
                    <Button variant="outline" onClick={voltar}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Leads
                    </Button>
                </div>
            </div>
        );
    }

    const diasNoPipeline = (() => {
        const base = lead.primeiroContato || lead.criadoEm;
        const inicio = new Date(base);
        const agora = new Date();
        const diffMs = Math.max(0, agora.getTime() - inicio.getTime());
        return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    })();

    const mensagensWhatsapp = (() => {
        const conversaWhatsapp = lead.conversas.find((c) => c.canal?.toUpperCase() === "WHATSAPP") || lead.conversas[0];
        if (!conversaWhatsapp?.mensagens?.length) return [];
        const ordenadas = [...conversaWhatsapp.mensagens].sort(
            (a: any, b: any) => new Date(a.enviadaEm).getTime() - new Date(b.enviadaEm).getTime()
        );
        return ordenadas.slice(-6);
    })();

    // Score Composto vindo do backend (mesmo cálculo do Mission Control)
    // Fallback para cálculo local enquanto API antiga não retorna o campo
    const scoreQualificacaoLocal = (() => {
        let pontos = 0;
        const statusPesos: Record<string, number> = {
            NOVO: 5,
            TENTATIVA_AGENDAMENTO: 12, VISITA_AGENDADA: 14,
            AVALIACAO_EM_ANDAMENTO: 16, DOCUMENTACAO: 18,
            ONBOARDING: 20,
        };
        pontos += statusPesos[lead.status] || 0;
        if (lead.imovel?.interesseEm) pontos += 8;
        if (lead.imovel?.valorPretendido) pontos += 10;
        if (lead.imovel?.tipo) pontos += 4;
        if (lead.imovel?.endereco) pontos += 4;
        const dores = lead.spin?.problema?.doresIdentificadas || [];
        if (dores.length > 0) pontos += 6;
        if (dores.length >= 2) pontos += 4;
        if (lead.spin?.problema?.motivacaoVenda) pontos += 10;
        if (lead.spin?.implicacao?.prazoDesejado) pontos += 8;
        if (lead.spin?.situacao?.situacaoAtual) pontos += 4;
        if (lead.ultimaInteracao) pontos += 5;
        if (lead.tipoAutorizacao === "exclusiva") pontos += 6;
        if (lead.autorizouAnuncio) pontos += 4;
        if (lead.comissaoAcordada) pontos += 4;
        return Math.max(0, Math.min(100, pontos));
    })();

    const scoreLead = lead.scoreComposto ?? lead.scoreQualificacao ?? scoreQualificacaoLocal;

    const intencaoPercentual = (() => {
        let pontos = 0;
        if (lead.imovel?.interesseEm) pontos += 30;
        if (lead.imovel?.tipo || lead.imovel?.quartos) pontos += 20;
        if (lead.imovel?.area || lead.imovel?.ocupacao) pontos += 20;
        if (lead.imovel?.valorPretendido) pontos += 30;
        return pontos;
    })();

    const totalInteracoes = lead.conversas.reduce((acc, conversa) => acc + (conversa.mensagens?.length || 0), 0);

    const engajamentoPercentual = (() => {
        if (totalInteracoes >= 8) return 90;
        if (totalInteracoes >= 5) return 70;
        if (totalInteracoes >= 3) return 55;
        if (totalInteracoes >= 1) return 35;
        return 15;
    })();

    const resumoExecutivo = (() => {
        if (lead.briefingCloser) {
            const linhas = lead.briefingCloser
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !/^[#🏠🔥💢🎯📋⚡💰🚨🤝👤]/.test(l));
            return linhas.slice(0, 3).join(" ") || "Lead com briefing de IA disponível para handoff.";
        }

        return "Lead em acompanhamento. Complete o checklist e registre a próxima ação para avançar o playbook.";
    })();

    const insightsRapidos = (() => {
        const itens: { texto: string; tipo: "ok" | "alerta" }[] = [];

        if (lead.imovel?.ocupacao?.toLowerCase() === "vazio") {
            itens.push({ texto: "Imóvel desocupado, potencial de visita imediata.", tipo: "ok" });
        }
        if (lead.imovel?.valorPretendido) {
            itens.push({ texto: "Valor pretendido informado, negociação mais objetiva.", tipo: "ok" });
        } else {
            itens.push({ texto: "Valor pretendido ainda não confirmado com o lead.", tipo: "alerta" });
        }
        if ((lead.spin?.necessidade?.objecoes?.length || 0) > 0) {
            itens.push({ texto: "Existem objeções registradas, preparar argumentação antes da abordagem.", tipo: "alerta" });
        }
        if ((lead.spin?.problema?.doresIdentificadas?.length || 0) > 0) {
            itens.push({ texto: "Dores de negócio identificadas pela IA, usar no pitch de valor.", tipo: "ok" });
        }

        return itens.slice(0, 4);
    })();

    const acoesRecomendadas = (() => {
        const acoes: { titulo: string; detalhe: string; prioridade: "alta" | "media"; acao: "confirmar_agendamento" | "propor_exclusividade" | "confirmar_valor" | "nova_atividade" }[] = [];

        if (lead.proximaAtividade?.agendadoPara) {
            acoes.push({
                titulo: "Confirmar presença no agendamento",
                detalhe: "Alta prioridade · validar comparecimento do lead",
                prioridade: "alta",
                acao: "confirmar_agendamento",
            });
        }

        if (!lead.tipoAutorizacao) {
            acoes.push({
                titulo: "Apresentar proposta de exclusividade",
                detalhe: "Alta prioridade · fase de negociação",
                prioridade: "alta",
                acao: "propor_exclusividade",
            });
        }

        if (!lead.imovel?.valorPretendido) {
            acoes.push({
                titulo: "Confirmar valor pretendido",
                detalhe: "Média prioridade · concluir qualificação",
                prioridade: "media",
                acao: "confirmar_valor",
            });
        }

        acoes.push({
            titulo: "Registrar próxima atividade",
            detalhe: "Média prioridade · manter cadência operacional",
            prioridade: "media",
            acao: "nova_atividade",
        });

        return acoes.slice(0, 3);
    })();

    const executarAcaoRecomendada = (acao: "confirmar_agendamento" | "propor_exclusividade" | "confirmar_valor" | "nova_atividade") => {
        void registrarEventoCockpit("DECISAO_CLICK", { acao });

        if (acao === "confirmar_agendamento") {
            setAbaPrincipal("atendimento");
            setChatOpen(true);
            toast.info("Use o chat para confirmar presença com o lead.");
            void registrarEventoCockpit("DECISAO_RESULTADO", { acao, sucesso: true, destino: "chat_whatsapp" });
            return;
        }

        if (acao === "confirmar_valor") {
            setAbaPrincipal("atendimento");
            setChatOpen(true);
            toast.info("Pergunte o valor pretendido diretamente no WhatsApp.");
            void registrarEventoCockpit("DECISAO_RESULTADO", { acao, sucesso: true, destino: "chat_whatsapp" });
            return;
        }

        if (acao === "propor_exclusividade") {
            setFormAtividade({
                tipo: "REUNIAO",
                titulo: "Apresentar proposta de exclusividade",
                descricao: "Ação sugerida pelo Cockpit de Decisão.",
                agendadoPara: "",
            });
            setModalAtividade(true);
            void registrarEventoCockpit("DECISAO_RESULTADO", { acao, sucesso: true, destino: "atividade_pre_preenchida" });
            return;
        }

        setFormAtividade({
            tipo: "TAREFA",
            titulo: "Definir próxima ação do lead",
            descricao: "Ação criada a partir das recomendações do cockpit.",
            agendadoPara: "",
        });
        setModalAtividade(true);
        void registrarEventoCockpit("DECISAO_RESULTADO", { acao, sucesso: true, destino: "atividade_pre_preenchida" });
    };

    const eventosCockpitFiltrados = (() => {
        const agora = Date.now();
        const diasFiltro = filtroPeriodoTelemetria === "7d"
            ? 7
            : filtroPeriodoTelemetria === "30d"
                ? 30
                : filtroPeriodoTelemetria === "90d"
                    ? 90
                    : null;

        return eventosCockpit.filter((evento) => {
            if (diasFiltro !== null) {
                const diffDias = (agora - new Date(evento.criadoEm).getTime()) / (1000 * 60 * 60 * 24);
                if (diffDias > diasFiltro) return false;
            }

            if (filtroTipoTelemetria === "decisao" && !evento.acao.includes("DECISAO")) return false;
            if (filtroTipoTelemetria === "crm" && !evento.acao.includes("CRM")) return false;
            if (filtroSucessoTelemetria === "sucesso") {
                return evento.detalhes?.sucesso === true;
            }
            if (filtroSucessoTelemetria === "falha") {
                return evento.detalhes?.sucesso === false;
            }
            return true;
        });
    })();

    const metricasTelemetria = (() => {
        const totalAcoesDisparadas = eventosCockpitFiltrados.filter(
            (e) => e.acao === "COCKPIT_DECISAO_CLICK" || e.acao === "COCKPIT_CRM_ACAO"
        ).length;
        const totalResultados = eventosCockpitFiltrados.filter((e) =>
            e.acao === "COCKPIT_DECISAO_RESULTADO" || e.acao === "COCKPIT_CRM_RESULTADO"
        );
        const totalSucessos = totalResultados.filter((e) => e.detalhes?.sucesso === true).length;
        const taxaSucesso = totalResultados.length > 0
            ? Math.round((totalSucessos / totalResultados.length) * 100)
            : 0;

        const porAcao = new Map<string, { disparos: number; resultados: number; sucessos: number }>();

        for (const evento of eventosCockpitFiltrados) {
            const chave = evento.detalhes?.acao || evento.detalhes?.tipo || "geral";
            const atual = porAcao.get(chave) || { disparos: 0, resultados: 0, sucessos: 0 };

            if (evento.acao === "COCKPIT_DECISAO_CLICK" || evento.acao === "COCKPIT_CRM_ACAO") {
                atual.disparos += 1;
            }
            if (evento.acao === "COCKPIT_DECISAO_RESULTADO" || evento.acao === "COCKPIT_CRM_RESULTADO") {
                atual.resultados += 1;
                if (evento.detalhes?.sucesso === true) atual.sucessos += 1;
            }

            porAcao.set(chave, atual);
        }

        const rankingAcoes = Array.from(porAcao.entries())
            .map(([acao, dados]) => ({
                acao,
                ...dados,
                taxa: dados.resultados > 0 ? Math.round((dados.sucessos / dados.resultados) * 100) : 0,
            }))
            .sort((a, b) => b.resultados - a.resultados || b.disparos - a.disparos)
            .slice(0, 6);

        return { totalAcoesDisparadas, totalResultados: totalResultados.length, totalSucessos, taxaSucesso, rankingAcoes };
    })();

    const alertasOperacionais = (() => {
        const agora = Date.now();
        const janela24hInicio = agora - (24 * 60 * 60 * 1000);
        const janela48hInicio = agora - (48 * 60 * 60 * 1000);

        const resultados24h = eventosCockpit.filter((e) =>
            (e.acao === "COCKPIT_DECISAO_RESULTADO" || e.acao === "COCKPIT_CRM_RESULTADO") &&
            new Date(e.criadoEm).getTime() >= janela24hInicio
        );
        const resultados24hAnterior = eventosCockpit.filter((e) => {
            if (e.acao !== "COCKPIT_DECISAO_RESULTADO" && e.acao !== "COCKPIT_CRM_RESULTADO") return false;
            const timestamp = new Date(e.criadoEm).getTime();
            return timestamp >= janela48hInicio && timestamp < janela24hInicio;
        });

        const taxa24h = resultados24h.length > 0
            ? Math.round((resultados24h.filter((e) => e.detalhes?.sucesso === true).length / resultados24h.length) * 100)
            : null;
        const taxa24hAnterior = resultados24hAnterior.length > 0
            ? Math.round((resultados24hAnterior.filter((e) => e.detalhes?.sucesso === true).length / resultados24hAnterior.length) * 100)
            : null;

        const falhasCrm24h = eventosCockpit.filter((e) =>
            e.acao === "COCKPIT_CRM_RESULTADO" &&
            e.detalhes?.sucesso === false &&
            new Date(e.criadoEm).getTime() >= janela24hInicio
        ).length;

        const ultimaAcaoOperacional = eventosCockpit
            .filter((e) => e.acao === "COCKPIT_DECISAO_CLICK" || e.acao === "COCKPIT_CRM_ACAO")
            .map((e) => new Date(e.criadoEm).getTime())
            .sort((a, b) => b - a)[0];

        const semAcao24h = !ultimaAcaoOperacional || ultimaAcaoOperacional < janela24hInicio;

        const alertas: Array<{
            tipo: "critico" | "atencao";
            titulo: string;
            detalhe: string;
            recomendacao: string;
            acaoRapida?: "verificar_crm" | "abrir_chat" | "criar_atividade";
            labelAcao?: string;
        }> = [];

        if (
            taxa24h !== null &&
            taxa24hAnterior !== null &&
            resultados24h.length >= 3 &&
            (taxa24hAnterior - taxa24h) >= 20
        ) {
            alertas.push({
                tipo: "critico",
                titulo: "Queda de conversão nas últimas 24h",
                detalhe: `Taxa caiu de ${taxa24hAnterior}% para ${taxa24h}%`,
                recomendacao: "Revisar abordagem no WhatsApp e priorizar ações de alta intenção.",
                acaoRapida: "abrir_chat",
                labelAcao: "Abrir chat",
            });
        }

        if (falhasCrm24h >= 2) {
            alertas.push({
                tipo: "critico",
                titulo: "Falhas recorrentes de CRM",
                detalhe: `${falhasCrm24h} falhas de integração registradas em 24h`,
                recomendacao: "Executar verificação de status no CRM e validar configuração em Integrações.",
                acaoRapida: "verificar_crm",
                labelAcao: "Verificar CRM",
            });
        }

        if (semAcao24h && !isPerdidoOuArquivado && !isCaptado) {
            alertas.push({
                tipo: "atencao",
                titulo: "Lead sem ação operacional recente",
                detalhe: "Nenhuma ação de decisão/CRM registrada nas últimas 24h",
                recomendacao: "Dispare uma ação recomendada para manter o lead em movimento.",
                acaoRapida: "criar_atividade",
                labelAcao: "Criar atividade",
            });
        }

        if (metricasTelemetria.totalResultados >= 5 && metricasTelemetria.taxaSucesso < 60) {
            alertas.push({
                tipo: "atencao",
                titulo: "Eficiência abaixo da meta",
                detalhe: `Taxa de sucesso atual em ${metricasTelemetria.taxaSucesso}%`,
                recomendacao: "Focar em ações com maior conversão no ranking e reduzir tentativas de baixa resposta.",
            });
        }

        return alertas.slice(0, 3);
    })();

    const executarAcaoAlerta = async (acao?: "verificar_crm" | "abrir_chat" | "criar_atividade") => {
        if (!acao) return;
        if (acao === "verificar_crm") {
            await executarAcaoCrm("status");
            return;
        }
        if (acao === "abrir_chat") {
            setChatOpen(true);
            return;
        }
        setFormAtividade({
            tipo: "TAREFA",
            titulo: "Mitigar alerta operacional do cockpit",
            descricao: "Ação criada a partir de alerta automático.",
            agendadoPara: "",
        });
        setModalAtividade(true);
    };

    const telefoneLimpo = (lead.telefone || "").replace(/\D/g, "");
    const numeroWhatsapp = telefoneLimpo.startsWith("55") ? telefoneLimpo : `55${telefoneLimpo}`;

    const handleLigarMobile = () => {
        if (!telefoneLimpo) {
            toast.error("Telefone indisponível para ligação.");
            return;
        }
        window.open(`tel:${telefoneLimpo}`, "_self");
    };

    const handleWhatsAppMobile = () => {
        if (!telefoneLimpo) {
            toast.error("Telefone indisponível para WhatsApp.");
            return;
        }
        window.open(`https://wa.me/${numeroWhatsapp}`, "_blank");
    };

    const handleAgendarMobile = () => {
        setFormAtividade({
            tipo: "REUNIAO",
            titulo: "Agendar visita com o proprietário",
            descricao: "",
            agendadoPara: "",
        });
        setModalAtividade(true);
    };

    const metricasSLA = (() => {
        const agora = Date.now();
        const ultimoEvento = eventosCockpit
            .map((e) => new Date(e.criadoEm).getTime())
            .sort((a, b) => b - a)[0];
        const horasSemAcao = ultimoEvento ? Math.round((agora - ultimoEvento) / (1000 * 60 * 60)) : null;

        const ultimaMensagem = mensagensWhatsapp.length > 0
            ? mensagensWhatsapp[mensagensWhatsapp.length - 1]
            : null;
        const horasSemMensagem = ultimaMensagem
            ? Math.round((agora - new Date(ultimaMensagem.enviadaEm).getTime()) / (1000 * 60 * 60))
            : null;

        const horasParaProximaAtividade = lead.proximaAtividade?.agendadoPara
            ? Math.round((new Date(lead.proximaAtividade.agendadoPara).getTime() - agora) / (1000 * 60 * 60))
            : null;

        return { horasSemAcao, horasSemMensagem, horasParaProximaAtividade };
    })();

    const playbookInteligente = (() => {
        const status = lead.status;
        if (status === "NOVO") {
            return {
                fase: "Qualificação Inicial",
                foco: "Confirmar intenção, tipologia e valor para acelerar handoff.",
                acoes: ["confirmar_valor", "nova_atividade"] as const,
            };
        }
        if (status === "TENTATIVA_AGENDAMENTO" || status === "VISITA_AGENDADA") {
            return {
                fase: "Agendamento",
                foco: "Garantir presença e reduzir no-show com contato ativo.",
                acoes: ["confirmar_agendamento", "nova_atividade"] as const,
            };
        }
        if (status === "DOCUMENTACAO") {
            return {
                fase: "Documentação",
                foco: "Validar pendências e manter sincronismo com CRM.",
                acoes: ["nova_atividade"] as const,
            };
        }
        return {
            fase: "Operação",
            foco: "Manter ritmo de follow-up e registrar evolução no cockpit.",
            acoes: ["nova_atividade"] as const,
        };
    })();

    const timelineUnificada = (() => {
        const itens: Array<{ id: string; tipo: string; titulo: string; descricao?: string; quando: string }> = [];

        lead.atividades.slice(0, 8).forEach((atividade) => {
            itens.push({
                id: `atividade-${atividade.id}`,
                tipo: "atividade",
                titulo: atividade.titulo,
                descricao: atividade.statusAgendamento || atividade.tipo,
                quando: atividade.agendadoPara || atividade.criadoEm,
            });
        });

        mensagensWhatsapp.slice(-8).forEach((msg: any) => {
            itens.push({
                id: `mensagem-${msg.id}`,
                tipo: "whatsapp",
                titulo: "Mensagem WhatsApp",
                descricao: String(msg.conteudo || "").slice(0, 80),
                quando: msg.enviadaEm,
            });
        });

        eventosCockpit.slice(0, 10).forEach((evento) => {
            itens.push({
                id: `cockpit-${evento.id}`,
                tipo: "cockpit",
                titulo: evento.acao.replace("COCKPIT_", ""),
                descricao: evento.detalhes?.acao || evento.detalhes?.tipo || "",
                quando: evento.criadoEm,
            });
        });

        if (lead.crm?.enviadoEm) {
            itens.push({
                id: "crm-sync",
                tipo: "crm",
                titulo: "Sincronização CRM",
                descricao: lead.crm?.syncStatus || "enviado",
                quando: lead.crm.enviadoEm,
            });
        }

        return itens
            .sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())
            .slice(0, 16);
    })();

    const quadroAtividades = (() => {
        const atividades = lead.atividades || [];
        const pendentes = atividades.filter((a) => !a.completadoEm && a.statusAgendamento !== "NAO_COMPARECEU").slice(0, 4);
        const concluidas = atividades.filter((a) => Boolean(a.completadoEm) && a.statusAgendamento !== "NAO_COMPARECEU").slice(0, 4);
        const naoCompareceu = atividades.filter((a) => a.statusAgendamento === "NAO_COMPARECEU").slice(0, 4);
        return { pendentes, concluidas, naoCompareceu };
    })();

    const exportarTelemetriaCSV = () => {
        const linhas = [
            ["data_hora", "acao", "acao_detalhe", "tipo", "sucesso", "usuario"].join(","),
            ...eventosCockpitFiltrados.map((evento) => {
                const data = formatarDataHora(evento.criadoEm).replace(",", "");
                const acao = evento.acao.replace("COCKPIT_", "");
                const acaoDetalhe = String(evento.detalhes?.acao || "").replace(/,/g, " ");
                const tipo = String(evento.detalhes?.tipo || "").replace(/,/g, " ");
                const sucesso = typeof evento.detalhes?.sucesso === "boolean" ? (evento.detalhes.sucesso ? "sim" : "nao") : "";
                const usuario = (evento.usuario?.nome || evento.usuario?.email || "").replace(/,/g, " ");
                return [data, acao, acaoDetalhe, tipo, sucesso, usuario].join(",");
            })
        ];

        const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `cockpit_lead_${lead.id}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Exportação CSV concluída.");
    };

    return (
        <div className="space-y-6 pb-24 lg:pb-0">
            <PageHeader
                title={lead.nome}
                description="Detalhes completos do lead"
                breadcrumb={[
                    { label: "Leads", href: "/dashboard/leads" },
                    { label: lead.nome },
                ]}
            />
            {/* HEADER */}
            <LeadHeader
                lead={lead}
                salvando={salvando}
                isPerdidoOuArquivado={isPerdidoOuArquivado}
                isCaptado={isCaptado}
                onVoltar={voltar}
                onEditar={() => setModalEditar(true)}
                onNovaAtividade={() => setModalAtividade(true)}
                onCaptar={() => setModalCaptado(true)}
                onMarcarPerdido={() => setModalPerdido(true)}
                onArquivar={() => setModalArquivar(true)}
                onReativar={reativar}
                onAtualizar={carregarLead}
                onCopiarTelefone={copiarTelefone}
                carregando={carregando}
            />

            {/* BANNERS DE STATUS */}
            <BannersStatus
                status={lead.status}
                isPerdidoOuArquivado={isPerdidoOuArquivado}
                isCaptado={isCaptado}
            />

            {/* PAINEL DE DECISÃO RÁPIDA */}
            {!isPerdidoOuArquivado && !isCaptado && abaPrincipal === "atendimento" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Card className="card-premium">
                            <CardContent className="pt-5">
                                <p className="text-xs uppercase tracking-wider text-slate-500" title="Qualificação×40% + Urgência×60% — mesmo critério do Mission Control">Score Composto ⓘ</p>
                                <p className="text-3xl font-bold text-slate-900 mt-1">{scoreLead}<span className="text-base font-normal text-slate-500">/100</span></p>
                                <p className="text-sm text-emerald-600 mt-1">{scoreLead >= 60 ? "Alto potencial" : scoreLead >= 35 ? "Potencial em evolução" : "Em qualificação"}</p>
                                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] text-slate-400">
                                        🎯 Qualif: <strong className="text-slate-600">{lead.scoreQualificacao ?? scoreQualificacaoLocal}</strong>
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        ⚡ Urgência: <strong className="text-slate-600">{lead.scoreUrgencia ?? '—'}</strong>
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="card-premium">
                            <CardContent className="pt-5">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Dias no Pipeline</p>
                                <p className="text-3xl font-bold text-slate-900 mt-1">{diasNoPipeline}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                    Desde {formatarData(lead.primeiroContato || lead.criadoEm)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="card-premium">
                            <CardContent className="pt-5">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Intenção Detectada</p>
                                <p className="text-lg font-semibold text-slate-900 mt-1">{lead.imovel?.interesseEm || "Em qualificação"}</p>
                                <Progress value={intencaoPercentual} className="h-2 mt-3" />
                                <p className="text-xs text-slate-500 mt-2">{intencaoPercentual}% de confirmação da qualificação</p>
                            </CardContent>
                        </Card>
                        <Card className="card-premium">
                            <CardContent className="pt-5">
                                <p className="text-xs uppercase tracking-wider text-slate-500">Engajamento</p>
                                <p className="text-lg font-semibold text-slate-900 mt-1">{totalInteracoes} interações</p>
                                <Progress value={engajamentoPercentual} className="h-2 mt-3" />
                                <p className="text-xs text-slate-500 mt-2">{engajamentoPercentual}% de atividade recente</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 card-premium">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-brand" />
                                        Resumo do Agente Elyon
                                    </span>
                                    <Badge className="bg-indigo-100 text-indigo-700">IA Gerado</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm text-slate-700 leading-relaxed">{resumoExecutivo}</p>
                                </div>
                                <div className="space-y-2">
                                    {insightsRapidos.length > 0 ? (
                                        insightsRapidos.map((insight, idx) => (
                                            <div
                                                key={`${insight.texto}-${idx}`}
                                                className={`rounded-lg border px-3 py-2 text-sm ${
                                                    insight.tipo === "ok"
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                        : "border-amber-200 bg-amber-50 text-amber-800"
                                                }`}
                                            >
                                                {insight.texto}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-500">Sem insights adicionais no momento.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="card-premium">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Ações recomendadas</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {acoesRecomendadas.map((acao, idx) => (
                                    <button
                                        key={`${acao.titulo}-${idx}`}
                                        type="button"
                                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                            acao.prioridade === "alta"
                                                ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                                                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                                        }`}
                                        onClick={() => executarAcaoRecomendada(acao.acao)}
                                    >
                                        <p className={`font-medium ${acao.prioridade === "alta" ? "text-emerald-800" : "text-slate-800"}`}>
                                            {acao.titulo}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">{acao.detalhe}</p>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            <Tabs value={abaPrincipal} onValueChange={setAbaPrincipal} className="w-full">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 max-w-3xl h-auto gap-1">
                    <TabsTrigger value="atendimento">Dados do Atendimento</TabsTrigger>
                    <TabsTrigger value="cliente">Dados do Cliente</TabsTrigger>
                    <TabsTrigger value="imovel">Dados do Imóvel</TabsTrigger>
                </TabsList>

                <TabsContent value="atendimento" className="mt-6 space-y-6">
                    {lead.proximaAtividade && !isPerdidoOuArquivado && !isCaptado && (
                        <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-100 rounded-lg">
                                            <Calendar className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{lead.proximaAtividade.titulo}</p>
                                            <p className="text-sm text-slate-600">
                                                {lead.proximaAtividade.agendadoPara
                                                    ? formatarDataHora(lead.proximaAtividade.agendadoPara)
                                                    : 'Sem data definida'}
                                                {lead.proximaAtividade.statusAgendamento && (
                                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${statusAgendamentoConfig[lead.proximaAtividade.statusAgendamento]?.color || ''}`}>
                                                        {statusAgendamentoConfig[lead.proximaAtividade.statusAgendamento]?.label}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => acaoAtividade(lead.proximaAtividade!.id, 'nao_compareceu')}
                                        >
                                            Não compareceu
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => acaoAtividade(lead.proximaAtividade!.id, 'completar')}
                                        >
                                            <Check className="w-4 h-4 mr-1" />
                                            Realizada
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">Conversa WhatsApp no CRM</CardTitle>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
                                                <MessageSquare className="w-4 h-4 mr-1" />
                                                Abrir chat
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => setModalAtividade(true)}>
                                                <Plus className="w-4 h-4 mr-1" />
                                                Nova atividade
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {mensagensWhatsapp.length > 0 ? (
                                        <div className="space-y-3">
                                            {mensagensWhatsapp.map((mensagem: any) => {
                                                const enviadaPeloAgente = ["assistente", "sistema", "ASSISTENTE", "SISTEMA"].includes(String(mensagem.remetente));
                                                return (
                                                    <div key={mensagem.id} className={`flex ${enviadaPeloAgente ? "justify-end" : "justify-start"}`}>
                                                        <div
                                                            className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                                                                enviadaPeloAgente
                                                                    ? "bg-indigo-600 text-white"
                                                                    : "bg-slate-100 text-slate-800"
                                                            }`}
                                                        >
                                                            <p className="text-sm leading-relaxed">{mensagem.conteudo}</p>
                                                            <p className={`text-[11px] mt-1 ${enviadaPeloAgente ? "text-indigo-100" : "text-slate-500"}`}>
                                                                {formatarDataHora(mensagem.enviadaEm)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-500">
                                            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-sm">Sem mensagens para pré-visualização</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">Quadro de Atividades</CardTitle>
                                        {!isPerdidoOuArquivado && !isCaptado && (
                                            <Button size="sm" variant="ghost" onClick={() => setModalAtividade(true)}>
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {lead.atividades.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold text-slate-700">Pendentes</p>
                                                    <Badge variant="outline">{quadroAtividades.pendentes.length}</Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {quadroAtividades.pendentes.length > 0 ? quadroAtividades.pendentes.map((atividade) => (
                                                        <div key={atividade.id} className="rounded-md border border-slate-200 bg-white p-2">
                                                            <p className="text-xs font-medium text-slate-800 line-clamp-2">{atividade.titulo}</p>
                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                {atividade.agendadoPara ? formatarDataHora(atividade.agendadoPara) : formatarDataHora(atividade.criadoEm)}
                                                            </p>
                                                        </div>
                                                    )) : (
                                                        <p className="text-xs text-slate-500">Sem pendências.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold text-emerald-800">Concluídas</p>
                                                    <Badge className="bg-emerald-100 text-emerald-700">{quadroAtividades.concluidas.length}</Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {quadroAtividades.concluidas.length > 0 ? quadroAtividades.concluidas.map((atividade) => (
                                                        <div key={atividade.id} className="rounded-md border border-emerald-200 bg-white p-2">
                                                            <p className="text-xs font-medium text-slate-800 line-clamp-2">{atividade.titulo}</p>
                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                {atividade.completadoEm ? formatarDataHora(atividade.completadoEm) : formatarDataHora(atividade.criadoEm)}
                                                            </p>
                                                        </div>
                                                    )) : (
                                                        <p className="text-xs text-emerald-700">Sem concluídas ainda.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold text-amber-800">Não compareceu</p>
                                                    <Badge className="bg-amber-100 text-amber-700">{quadroAtividades.naoCompareceu.length}</Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {quadroAtividades.naoCompareceu.length > 0 ? quadroAtividades.naoCompareceu.map((atividade) => (
                                                        <div key={atividade.id} className="rounded-md border border-amber-200 bg-white p-2">
                                                            <p className="text-xs font-medium text-slate-800 line-clamp-2">{atividade.titulo}</p>
                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                {atividade.completadoEm ? formatarDataHora(atividade.completadoEm) : formatarDataHora(atividade.criadoEm)}
                                                            </p>
                                                        </div>
                                                    )) : (
                                                        <p className="text-xs text-amber-700">Nenhum registro.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-500">
                                            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-sm">Nenhuma atividade registrada</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="card-premium border-indigo-200/80">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Bot className="w-5 h-5 text-brand" />
                                        Cockpit Admin & CRM
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {carregandoCockpitAdmin ? (
                                        <div className="text-sm text-slate-500">Carregando status operacional...</div>
                                    ) : (
                                        <>
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                                <p className="text-xs uppercase tracking-wider text-slate-500">Agente Admin</p>
                                                <p className="font-medium text-slate-800">
                                                    {cockpitAdmin?.agenteAdmin?.nome || "Não configurado"}
                                                </p>
                                                <p className="text-xs text-slate-600">
                                                    Status: {cockpitAdmin?.agenteAdmin?.status || "Sem agente ativo"}
                                                </p>
                                                <p className="text-xs text-slate-600">
                                                    Sessão WhatsApp: {cockpitAdmin?.agenteAdmin?.sessaoWhatsapp?.nome || "Não vinculada"}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                                <p className="text-xs uppercase tracking-wider text-slate-500">Integração CRM Quadra Dois</p>
                                                <p className="font-medium text-slate-800">
                                                    {cockpitAdmin?.integracaoCRM?.ativo ? "Ativa" : "Não configurada"}
                                                </p>
                                                <p className="text-xs text-slate-600">
                                                    Último teste: {cockpitAdmin?.integracaoCRM?.ultimoTesteEm ? formatarDataHora(cockpitAdmin.integracaoCRM.ultimoTesteEm) : "Não testado"}
                                                </p>
                                                {cockpitAdmin?.integracaoCRM?.ultimoErro && (
                                                    <p className="text-xs text-red-600">{cockpitAdmin.integracaoCRM.ultimoErro}</p>
                                                )}
                                            </div>

                                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                                <p className="text-xs uppercase tracking-wider text-slate-500">Status do Lead no CRM</p>
                                                <p className="text-sm font-medium text-slate-800">
                                                    Sync: {lead.crm?.syncStatus || cockpitAdmin?.crmLead?.syncStatus || "não enviado"}
                                                </p>
                                                {lead.crm?.propertyCode && (
                                                    <p className="text-xs text-slate-600">Property Code: {lead.crm.propertyCode}</p>
                                                )}
                                                {(lead.crm?.syncError || cockpitAdmin?.crmLead?.syncError) && (
                                                    <p className="text-xs text-red-600">{lead.crm?.syncError || cockpitAdmin?.crmLead?.syncError}</p>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                <Button variant="outline" className="justify-start" onClick={() => setChatOpen(true)}>
                                                    <MessageSquare className="w-4 h-4 mr-2" />
                                                    Falar com cliente no CRM
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="justify-start"
                                                    disabled={processandoCrm !== null}
                                                    onClick={() => executarAcaoCrm("status")}
                                                >
                                                    {processandoCrm === "status" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                                                    Verificar status no CRM
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="justify-start"
                                                    disabled={processandoCrm !== null}
                                                    onClick={() => executarAcaoCrm("enviar")}
                                                >
                                                    {processandoCrm === "enviar" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                    Enviar lead para CRM
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="justify-start"
                                                    disabled={processandoCrm !== null}
                                                    onClick={() => executarAcaoCrm("reenviar")}
                                                >
                                                    {processandoCrm === "reenviar" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                                    Reenviar lead para CRM
                                                </Button>
                                                <Button variant="outline" className="justify-start" onClick={() => window.location.href = "/dashboard/integracoes"}>
                                                    <ExternalLink className="w-4 h-4 mr-2" />
                                                    Abrir Integrações
                                                </Button>
                                                <Button variant="outline" className="justify-start" onClick={() => window.location.href = "/dashboard/agentes"}>
                                                    <Bot className="w-4 h-4 mr-2" />
                                                    Abrir Agente Admin
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Informações</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Origem</p>
                                        <p className="font-medium">{lead.origem || 'Não informado'}</p>
                                    </div>
                                    {lead.campanhaOrigem && (
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Campanha</p>
                                            <p className="font-medium">{lead.campanhaOrigem.nome}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Primeiro Contato</p>
                                        <p className="font-medium">{lead.primeiroContato ? formatarData(lead.primeiroContato) : 'Não registrado'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Última Interação</p>
                                        <p className="font-medium">{lead.ultimaInteracao ? tempoRelativo(lead.ultimaInteracao) : 'Nenhuma'}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Telemetria do Cockpit</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <p className="text-[11px] text-slate-500">Ações</p>
                                            <p className="font-semibold text-slate-800">{metricasTelemetria.totalAcoesDisparadas}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <p className="text-[11px] text-slate-500">Resultados</p>
                                            <p className="font-semibold text-slate-800">{metricasTelemetria.totalResultados}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <p className="text-[11px] text-slate-500">Taxa de Sucesso</p>
                                            <p className="font-semibold text-emerald-700">{metricasTelemetria.taxaSucesso}%</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-700">Alertas automáticos</p>
                                        {alertasOperacionais.length > 0 ? (
                                            alertasOperacionais.map((alerta, idx) => (
                                                <div
                                                    key={`${alerta.titulo}-${idx}`}
                                                    className={`rounded-lg border p-3 ${
                                                        alerta.tipo === "critico"
                                                            ? "border-red-200 bg-red-50"
                                                            : "border-amber-200 bg-amber-50"
                                                    }`}
                                                >
                                                    <p className={`text-xs font-semibold ${
                                                        alerta.tipo === "critico" ? "text-red-700" : "text-amber-700"
                                                    }`}>
                                                        {alerta.titulo}
                                                    </p>
                                                    <p className="text-xs text-slate-700 mt-1">{alerta.detalhe}</p>
                                                    <p className="text-xs text-slate-600 mt-1">{alerta.recomendacao}</p>
                                                    {alerta.acaoRapida && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="mt-2 h-7 text-xs"
                                                            onClick={() => executarAcaoAlerta(alerta.acaoRapida)}
                                                        >
                                                            {alerta.labelAcao || "Executar ação"}
                                                        </Button>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                                <p className="text-xs font-semibold text-emerald-700">Operação estável</p>
                                                <p className="text-xs text-emerald-800 mt-1">Sem alertas críticos para este lead no momento.</p>
                                            </div>
                                        )}
                                    </div>

                                    <Tabs defaultValue="resumo" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="resumo">Resumo</TabsTrigger>
                                            <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="resumo" className="mt-3 space-y-3">
                                            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                                                <p className="text-xs font-semibold text-slate-700">Playbook inteligente</p>
                                                <p className="text-xs text-slate-600">Fase: <span className="font-medium text-slate-800">{playbookInteligente.fase}</span></p>
                                                <p className="text-xs text-slate-600">{playbookInteligente.foco}</p>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {playbookInteligente.acoes.map((acao) => (
                                                        <Button key={acao} size="sm" variant="outline" className="h-7 text-xs" onClick={() => executarAcaoRecomendada(acao)}>
                                                            {acao}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-slate-200 p-3">
                                                <p className="text-xs font-semibold text-slate-700 mb-2">SLA operacional</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-[10px] text-slate-500">Sem ação</p>
                                                        <p className="text-xs font-semibold text-slate-800">
                                                            {metricasSLA.horasSemAcao !== null ? `${metricasSLA.horasSemAcao}h` : "—"}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-[10px] text-slate-500">Sem msg</p>
                                                        <p className="text-xs font-semibold text-slate-800">
                                                            {metricasSLA.horasSemMensagem !== null ? `${metricasSLA.horasSemMensagem}h` : "—"}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-[10px] text-slate-500">Próx. atividade</p>
                                                        <p className="text-xs font-semibold text-slate-800">
                                                            {metricasSLA.horasParaProximaAtividade !== null ? `${metricasSLA.horasParaProximaAtividade}h` : "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                                                <p className="text-xs font-semibold text-slate-700">Funil de execução</p>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-slate-500">Cliques decisão</p>
                                                        <p className="font-semibold text-slate-800">{metricasExecutivas?.funil.cliquesDecisao ?? 0}</p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-slate-500">Ações CRM</p>
                                                        <p className="font-semibold text-slate-800">{metricasExecutivas?.funil.acoesCrm ?? 0}</p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-slate-500">Resultados decisão</p>
                                                        <p className="font-semibold text-slate-800">{metricasExecutivas?.funil.resultadosDecisao ?? 0}</p>
                                                    </div>
                                                    <div className="rounded-md bg-slate-50 p-2">
                                                        <p className="text-slate-500">Resultados CRM</p>
                                                        <p className="font-semibold text-slate-800">{metricasExecutivas?.funil.resultadosCrm ?? 0}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="detalhado" className="mt-3 space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Select value={filtroPeriodoTelemetria} onValueChange={(v) => setFiltroPeriodoTelemetria(v as "7d" | "30d" | "90d" | "all")}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Período" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="7d">Últimos 7 dias</SelectItem>
                                                        <SelectItem value="30d">Últimos 30 dias</SelectItem>
                                                        <SelectItem value="90d">Últimos 90 dias</SelectItem>
                                                        <SelectItem value="all">Período completo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Select value={filtroTipoTelemetria} onValueChange={(v) => setFiltroTipoTelemetria(v as "todos" | "decisao" | "crm")}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Tipo" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="todos">Todos</SelectItem>
                                                        <SelectItem value="decisao">Decisão</SelectItem>
                                                        <SelectItem value="crm">CRM</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Select value={filtroSucessoTelemetria} onValueChange={(v) => setFiltroSucessoTelemetria(v as "todos" | "sucesso" | "falha")}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Resultado" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="todos">Todos os resultados</SelectItem>
                                                        <SelectItem value="sucesso">Somente sucesso</SelectItem>
                                                        <SelectItem value="falha">Somente falha</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="outline" size="sm" className="h-10" onClick={exportarTelemetriaCSV}>
                                                    Exportar CSV
                                                </Button>
                                            </div>

                                            {metricasTelemetria.rankingAcoes.length > 0 && (
                                                <div className="rounded-lg border border-slate-200 p-3">
                                                    <p className="text-xs font-semibold text-slate-700 mb-2">Conversão por ação</p>
                                                    <div className="space-y-2">
                                                        {metricasTelemetria.rankingAcoes.map((item) => (
                                                            <div key={item.acao} className="flex items-center justify-between text-xs">
                                                                <span className="text-slate-700">{item.acao}</span>
                                                                <span className="text-slate-500">
                                                                    {item.sucessos}/{item.resultados} ({item.taxa}%)
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                                                <p className="text-xs font-semibold text-slate-700">Ranking por especialista (tenant)</p>
                                                {carregandoMetricasExecutivas ? (
                                                    <p className="text-xs text-slate-500">Carregando ranking...</p>
                                                ) : (metricasExecutivas?.rankingUsuarios?.length || 0) > 0 ? (
                                                    metricasExecutivas!.rankingUsuarios.slice(0, 5).map((u) => (
                                                        <div key={u.usuarioId} className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-700">{u.nome}</span>
                                                            <span className="text-slate-500">{u.totalSucessos}/{u.totalResultados} ({u.taxaSucesso}%)</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-slate-500">Sem dados suficientes.</p>
                                                )}
                                            </div>

                                            {carregandoEventosCockpit ? (
                                                <p className="text-sm text-slate-500">Carregando eventos...</p>
                                            ) : eventosCockpitFiltrados.length > 0 ? (
                                                <div className="space-y-3 max-h-[260px] overflow-y-auto">
                                                    {eventosCockpitFiltrados.map((evento) => (
                                                        <div key={evento.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                            <p className="text-xs font-semibold text-slate-700">{evento.acao.replace("COCKPIT_", "")}</p>
                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                {formatarDataHora(evento.criadoEm)}
                                                                {evento.usuario?.nome ? ` · ${evento.usuario.nome}` : ""}
                                                            </p>
                                                            {evento.detalhes?.acao && (
                                                                <p className="text-xs text-slate-600 mt-1">Ação: {evento.detalhes.acao}</p>
                                                            )}
                                                            {evento.detalhes?.tipo && (
                                                                <p className="text-xs text-slate-600 mt-1">Tipo: {evento.detalhes.tipo}</p>
                                                            )}
                                                            {typeof evento.detalhes?.sucesso === "boolean" && (
                                                                <p className={`text-xs mt-1 ${evento.detalhes.sucesso ? "text-emerald-700" : "text-red-600"}`}>
                                                                    Resultado: {evento.detalhes.sucesso ? "Sucesso" : "Falha"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">Sem eventos registrados até o momento.</p>
                                            )}

                                            <div className="rounded-lg border border-slate-200 p-3">
                                                <p className="text-xs font-semibold text-slate-700 mb-2">Timeline unificada</p>
                                                {timelineUnificada.length > 0 ? (
                                                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                                                        {timelineUnificada.map((item) => (
                                                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                                <p className="text-xs font-semibold text-slate-700">
                                                                    {item.tipo.toUpperCase()} · {item.titulo}
                                                                </p>
                                                                {item.descricao && <p className="text-xs text-slate-600 mt-1">{item.descricao}</p>}
                                                                <p className="text-[11px] text-slate-500 mt-1">{formatarDataHora(item.quando)}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500">Sem eventos na timeline.</p>
                                                )}
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="cliente" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <CardProprietario lead={lead} />

                            {lead.cnpjEmpresa && (
                                <Card className="card-premium">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-slate-500" />
                                            Dados da Empresa
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="col-span-full">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Razão Social / Nome Fantasia</p>
                                                <p className="font-medium text-lg">{lead.empresaAtual || lead.nome}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">CNPJ</p>
                                                <p className="font-medium font-mono bg-slate-100 px-2 py-1 rounded inline-block text-sm">
                                                    {formatarCNPJ(lead.cnpjEmpresa)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Porte</p>
                                                <Badge variant="outline">{lead.setor || 'Não informado'}</Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="space-y-6">
                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Dados Cadastrais</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <p className="text-xs text-slate-500">Nome</p>
                                        <p className="font-medium text-slate-800">{lead.nome}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">CPF</p>
                                        <p className="font-medium text-slate-800">{lead.cpf || "Não informado"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Telefone</p>
                                        <p className="font-medium text-slate-800">{lead.telefone || "Não informado"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Email</p>
                                        <p className="font-medium text-slate-800">{lead.email || "Não informado"}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="imovel" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <CardImovel
                                lead={lead}
                                isPerdidoOuArquivado={isPerdidoOuArquivado}
                                isCaptado={isCaptado}
                                onEditar={() => setModalEditar(true)}
                            />
                            <CardNegociacao lead={lead} />
                            <CardContrato lead={lead} />

                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Dados técnicos coletados pelo Admin Agent</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                            <p className="text-xs text-slate-500">Suítes</p>
                                            <p className="font-semibold">{lead.imovelDetalhes?.suites ?? "—"}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                            <p className="text-xs text-slate-500">Banheiros</p>
                                            <p className="font-semibold">{lead.imovelDetalhes?.banheiros ?? "—"}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                            <p className="text-xs text-slate-500">Área Total</p>
                                            <p className="font-semibold">{lead.imovelDetalhes?.areaTotal ? `${lead.imovelDetalhes.areaTotal} m²` : "—"}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                            <p className="text-xs text-slate-500">Andar</p>
                                            <p className="font-semibold">{lead.imovelDetalhes?.andar ?? "—"}</p>
                                        </div>
                                    </div>
                                    {(lead.imovelDetalhes?.caracteristicas?.length || 0) > 0 && (
                                        <div className="mt-4">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Características</p>
                                            <div className="flex flex-wrap gap-2">
                                                {lead.imovelDetalhes?.caracteristicas?.map((car, idx) => (
                                                    <Badge key={`${car}-${idx}`} variant="secondary">{car}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Fotos e documentos</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm text-slate-600">
                                        Fotos coletadas: <span className="font-semibold text-slate-800">{lead.imovelDetalhes?.fotos?.length || 0}</span>
                                    </p>
                                    <p className="text-sm text-slate-600">
                                        Contrato: <span className="font-semibold text-slate-800">{lead.contratoUrl ? "Disponível" : "Pendente"}</span>
                                    </p>
                                    {lead.contratoUrl && (
                                        <Button variant="outline" className="w-full justify-start" onClick={() => window.open(lead.contratoUrl!, "_blank")}>
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Visualizar contrato
                                        </Button>
                                    )}
                                    <Button variant="outline" className="w-full justify-start" onClick={() => setModalEditar(true)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Atualizar dados do imóvel
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="card-premium">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg">Mineração vinculada</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {(lead.imoveisMineracao?.length || 0) > 0 ? (
                                        <div className="space-y-2">
                                            {lead.imoveisMineracao?.slice(0, 4).map((imovel) => (
                                                <div key={imovel.id} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                                    <p className="font-medium text-slate-800 text-sm">{imovel.edificio || "Imóvel minerado"}</p>
                                                    <p className="text-xs text-slate-600 mt-1">{imovel.endereco}</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {imovel.tipo || "Tipo não informado"} · {imovel.area ? `${imovel.area}m²` : "Área n/i"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">Sem imóveis de mineração associados.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <Suspense fallback={null}>
                <ChatModal
                    lead={{
                        id: lead.id,
                        nome: lead.nome,
                        telefone: lead.telefone
                    }}
                    open={chatOpen}
                    onOpenChange={setChatOpen}
                />
            </Suspense>

            {/* ============================================ */}
            {/* MODAIS */}
            {/* ============================================ */}

            {/* Modal Editar */}
            <Dialog open={modalEditar} onOpenChange={setModalEditar}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Lead</DialogTitle>
                        <DialogDescription>Atualize as informações do lead e do imóvel</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Dados básicos */}
                        <div>
                            <label htmlFor="editar-nome" className="text-sm font-medium">Nome</label>
                            <Input id="editar-nome" value={formEditar.nome || ''} onChange={(e) => setFormEditar({ ...formEditar, nome: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editar-telefone" className="text-sm font-medium">Telefone</label>
                                <Input id="editar-telefone" value={formEditar.telefone || ''} onChange={(e) => setFormEditar({ ...formEditar, telefone: e.target.value })} />
                            </div>
                            <div>
                                <label htmlFor="editar-email" className="text-sm font-medium">Email</label>
                                <Input id="editar-email" value={formEditar.email || ''} onChange={(e) => setFormEditar({ ...formEditar, email: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editar-cpf" className="text-sm font-medium">CPF</label>
                                <Input id="editar-cpf" value={formEditar.cpf || ''} onChange={(e) => setFormEditar({ ...formEditar, cpf: e.target.value })} />
                            </div>
                            <div>
                                <label htmlFor="editar-endereco-principal" className="text-sm font-medium">Endereço do Proprietário</label>
                                <Input id="editar-endereco-principal" value={formEditar.enderecoPrincipal || ''} onChange={(e) => setFormEditar({ ...formEditar, enderecoPrincipal: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="editar-complemento-principal" className="text-sm font-medium">Complemento do Endereço (Proprietário)</label>
                            <Input id="editar-complemento-principal" value={formEditar.complementoPrincipal || ''} onChange={(e) => setFormEditar({ ...formEditar, complementoPrincipal: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="editar-temperatura" className="text-sm font-medium">Temperatura</label>
                            <Select value={formEditar.temperatura} onValueChange={(v) => setFormEditar({ ...formEditar, temperatura: v })}>
                                <SelectTrigger id="editar-temperatura"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="QUENTE">🔥 Quente</SelectItem>
                                    <SelectItem value="MORNO">🌤️ Morno</SelectItem>
                                    <SelectItem value="FRIO">❄️ Frio</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Dados do imóvel */}
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Home className="w-4 h-4" /> Dados do Imóvel
                            </p>
                        </div>
                        <div>
                            <label htmlFor="editar-endereco-imovel" className="text-sm font-medium">Endereço do Imóvel</label>
                            <Input id="editar-endereco-imovel" value={formEditar.enderecoImovel || ''} onChange={(e) => setFormEditar({ ...formEditar, enderecoImovel: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editar-tipo-imovel" className="text-sm font-medium">Tipo de Imóvel</label>
                                <Input id="editar-tipo-imovel" value={formEditar.tipoImovel || ''} onChange={(e) => setFormEditar({ ...formEditar, tipoImovel: e.target.value })} placeholder="Apartamento, Casa..." />
                            </div>
                            <div>
                                <label htmlFor="editar-valor-pretendido" className="text-sm font-medium">Valor Pretendido</label>
                                <Input id="editar-valor-pretendido" type="number" value={formEditar.valorPretendido || ''} onChange={(e) => setFormEditar({ ...formEditar, valorPretendido: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="editar-inscricao-iptu" className="text-sm font-medium">Inscrição IPTU</label>
                            <Input id="editar-inscricao-iptu" value={formEditar.inscricaoIptu || ''} onChange={(e) => setFormEditar({ ...formEditar, inscricaoIptu: e.target.value })} />
                        </div>

                        {/* Dados de qualificação (novos campos) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editar-situacao-financeira" className="text-sm font-medium">Situação Financeira</label>
                                <Select value={formEditar.situacaoFinanceira || ''} onValueChange={(v) => setFormEditar({ ...formEditar, situacaoFinanceira: v })}>
                                    <SelectTrigger id="editar-situacao-financeira"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {situacaoFinanceiraOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label htmlFor="editar-estado-conservacao" className="text-sm font-medium">Estado de Conservação</label>
                                <Select value={formEditar.estadoConservacao || ''} onValueChange={(v) => setFormEditar({ ...formEditar, estadoConservacao: v })}>
                                    <SelectTrigger id="editar-estado-conservacao"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {estadoConservacaoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Dados de negociação (novos campos) */}
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4" /> Negociação Comercial
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editar-comissao" className="text-sm font-medium">Comissão Acordada</label>
                                <Input id="editar-comissao" value={formEditar.comissaoAcordada || ''} onChange={(e) => setFormEditar({ ...formEditar, comissaoAcordada: e.target.value })} placeholder="Ex: 6%" />
                            </div>
                            <div>
                                <label htmlFor="editar-tipo-autorizacao" className="text-sm font-medium">Tipo de Autorização</label>
                                <Select value={formEditar.tipoAutorizacao || ''} onValueChange={(v) => setFormEditar({ ...formEditar, tipoAutorizacao: v })}>
                                    <SelectTrigger id="editar-tipo-autorizacao"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {tipoAutorizacaoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editar-prazo-trabalho" className="text-sm font-medium">Prazo de Trabalho</label>
                                <Select value={formEditar.prazoTrabalho?.toString() || ''} onValueChange={(v) => setFormEditar({ ...formEditar, prazoTrabalho: Number(v) })}>
                                    <SelectTrigger id="editar-prazo-trabalho"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {prazoTrabalhoOptions.map(o => <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input
                                    type="checkbox"
                                    id="autorizouAnuncio"
                                    checked={formEditar.autorizouAnuncio || false}
                                    onChange={(e) => setFormEditar({ ...formEditar, autorizouAnuncio: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300"
                                />
                                <label htmlFor="autorizouAnuncio" className="text-sm font-medium">Autorizou Anúncio</label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
                        <Button onClick={async () => { if (await salvarEdicao()) setModalEditar(false); }} disabled={salvando}>
                            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Perdido */}
            <Dialog open={modalPerdido} onOpenChange={setModalPerdido}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XOctagon className="w-5 h-5" />
                            Marcar como Perdido
                        </DialogTitle>
                        <DialogDescription>Registre o motivo para análise futura</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label htmlFor="perdido-motivo" className="text-sm font-medium">Motivo</label>
                            <Select value={formPerdido.motivo} onValueChange={(v) => setFormPerdido({ ...formPerdido, motivo: v })}>
                                <SelectTrigger id="perdido-motivo"><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                                <SelectContent>
                                    {motivosPerdaOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label htmlFor="perdido-observacoes" className="text-sm font-medium">Observações (opcional)</label>
                            <Textarea id="perdido-observacoes" value={formPerdido.observacoes} onChange={(e) => setFormPerdido({ ...formPerdido, observacoes: e.target.value })} placeholder="Detalhes adicionais..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalPerdido(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={async () => { if (await marcarPerdido()) setModalPerdido(false); }} disabled={salvando || !formPerdido.motivo}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Confirmar Perda
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Captado */}
            <Dialog open={modalCaptado} onOpenChange={setModalCaptado}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600">
                            <Trophy className="w-5 h-5" />
                            Registrar Captação
                        </DialogTitle>
                        <DialogDescription>Parabéns! Registre os detalhes da captação</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label htmlFor="captado-tipo-contrato" className="text-sm font-medium">Tipo de Contrato</label>
                            <Select value={formCaptado.tipoContrato} onValueChange={(v) => setFormCaptado({ ...formCaptado, tipoContrato: v })}>
                                <SelectTrigger id="captado-tipo-contrato"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="VENDA_EXCLUSIVA">Venda Exclusiva</SelectItem>
                                    <SelectItem value="VENDA_COMPARTILHADA">Venda Compartilhada</SelectItem>
                                    <SelectItem value="LOCACAO_EXCLUSIVA">Locação Exclusiva</SelectItem>
                                    <SelectItem value="LOCACAO_COMPARTILHADA">Locação Compartilhada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label htmlFor="captado-valor-contrato" className="text-sm font-medium">Valor do Contrato (R$)</label>
                            <Input id="captado-valor-contrato" type="number" value={formCaptado.valorContrato} onChange={(e) => setFormCaptado({ ...formCaptado, valorContrato: e.target.value })} placeholder="500000" />
                        </div>
                        <div>
                            <label htmlFor="captado-observacoes" className="text-sm font-medium">Observações (opcional)</label>
                            <Textarea id="captado-observacoes" value={formCaptado.observacoes} onChange={(e) => setFormCaptado({ ...formCaptado, observacoes: e.target.value })} placeholder="Detalhes do fechamento..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalCaptado(false)}>Cancelar</Button>
                        <Button className="bg-success hover:bg-success-dark" onClick={async () => { if (await marcarCaptado()) { celebrarConversao(); setModalCaptado(false); } }} disabled={salvando}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            🎉 Confirmar Captação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Excluir - Com confirmação segura */}
            <Dialog open={modalArquivar} onOpenChange={handleFecharModalExcluir}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Excluir Lead Permanentemente
                        </DialogTitle>
                    </DialogHeader>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Opção recomendada: Retenção Segura
                        </p>
                        <p className="text-xs text-emerald-700 mt-2">
                            Anonimiza dados sensíveis e preserva aprendizado/métricas do agente.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <input
                                type="checkbox"
                                id="preservarRagRetencao"
                                checked={preservarRagRetencao}
                                onChange={(e) => setPreservarRagRetencao(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300"
                            />
                            <label htmlFor="preservarRagRetencao" className="text-xs text-emerald-800">
                                Preservar chunks de RAG (pode manter traços de contexto antigo)
                            </label>
                        </div>
                        <Button
                            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleRetencaoSegura}
                            disabled={processandoRetencao || salvando}
                        >
                            {processandoRetencao && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            🛡️ Aplicar Retenção Segura
                        </Button>
                    </div>

                    {/* Se tem dados vinculados, mostra os detalhes */}
                    {dadosVinculados ? (
                        <div className="space-y-4 py-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-800 font-medium mb-3">
                                    {mensagemExclusao}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {dadosVinculados.conversas > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Conversas:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.conversas}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.mensagens > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Mensagens:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.mensagens}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.atividades > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Atividades:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.atividades}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.contratos > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Contratos:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.contratos}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.imoveis > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Imóveis:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.imoveis}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-slate-600">
                                    Para confirmar a exclusão permanente, digite <strong className="text-red-600">excluir</strong> abaixo:
                                </p>
                                <Input
                                    placeholder="Digite 'excluir' para confirmar"
                                    value={textoConfirmacao}
                                    onChange={(e) => setTextoConfirmacao(e.target.value)}
                                    className="border-red-200 focus:border-red-400 focus:ring-red-400"
                                />
                            </div>
                        </div>
                    ) : (
                        <DialogDescription className="py-4">
                            <span className="text-red-600 font-semibold">ATENÇÃO: Esta ação é irreversível!</span>
                            <br /><br />
                            O lead será excluído permanentemente do sistema.
                        </DialogDescription>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleFecharModalExcluir(false)}>
                            Cancelar
                        </Button>
                        {dadosVinculados ? (
                            <Button
                                variant="destructive"
                                onClick={handleConfirmarExclusao}
                                disabled={salvando || textoConfirmacao.toLowerCase() !== 'excluir'}
                            >
                                {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                🗑️ Confirmar Exclusão
                            </Button>
                        ) : (
                            <Button variant="destructive" onClick={handleExcluir} disabled={salvando}>
                                {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                🗑️ Excluir Permanentemente
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Nova Atividade */}
            <Dialog open={modalAtividade} onOpenChange={setModalAtividade}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Atividade</DialogTitle>
                        <DialogDescription>Crie uma atividade ou agendamento</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label htmlFor="atividade-tipo" className="text-sm font-medium">Tipo</label>
                            <Select value={formAtividade.tipo} onValueChange={(v) => setFormAtividade({ ...formAtividade, tipo: v })}>
                                <SelectTrigger id="atividade-tipo"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LIGACAO">📞 Ligação</SelectItem>
                                    <SelectItem value="AVALIACAO">🏠 Avaliação</SelectItem>
                                    <SelectItem value="REUNIAO">👥 Reunião</SelectItem>
                                    <SelectItem value="FOLLOW_UP">🔄 Follow-up</SelectItem>
                                    <SelectItem value="TAREFA">✅ Tarefa</SelectItem>
                                    <SelectItem value="NOTA">📝 Nota</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label htmlFor="atividade-titulo" className="text-sm font-medium">Título</label>
                            <Input id="atividade-titulo" value={formAtividade.titulo} onChange={(e) => setFormAtividade({ ...formAtividade, titulo: e.target.value })} placeholder="Ex: Ligar para confirmar interesse" />
                        </div>
                        <div>
                            <label htmlFor="atividade-descricao" className="text-sm font-medium">Descrição (opcional)</label>
                            <Textarea id="atividade-descricao" value={formAtividade.descricao} onChange={(e) => setFormAtividade({ ...formAtividade, descricao: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="atividade-datahora" className="text-sm font-medium">Data/Hora (opcional)</label>
                            <Input id="atividade-datahora" type="datetime-local" value={formAtividade.agendadoPara} onChange={(e) => setFormAtividade({ ...formAtividade, agendadoPara: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalAtividade(false)}>Cancelar</Button>
                        <Button onClick={async () => { if (await criarAtividade()) setModalAtividade(false); }} disabled={salvando || !formAtividade.titulo}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Barra de ações mobile — one-handed */}
            {!isPerdidoOuArquivado && (
                <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-3 lg:hidden">
                    <div className="flex gap-2">
                        <Button className="flex-1 h-12 min-w-12" onClick={handleLigarMobile}>
                            <Phone className="w-4 h-4 mr-2" />
                            Ligar
                        </Button>
                        <Button className="flex-1 h-12 min-w-12" variant="outline" onClick={handleWhatsAppMobile}>
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                        </Button>
                        <Button className="h-12 min-w-12" variant="outline" onClick={handleAgendarMobile} aria-label="Agendar atividade">
                            <Calendar className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
