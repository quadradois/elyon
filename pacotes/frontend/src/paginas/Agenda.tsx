import { useState, useEffect, useRef } from 'react';
import { Calendar, dateFnsLocalizer, Views, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { Card, CardContent, CardHeader, CardTitle } from '../componentes/ui/card';
import { Button } from '../componentes/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../componentes/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter } from '../componentes/ui/drawer';
import { Input } from '../componentes/ui/input';
import { Label } from '../componentes/ui/label';
import { Badge } from '../componentes/ui/badge';
import { Textarea } from '../componentes/ui/textarea';
import { PageHeader } from '../componentes/ui/page-header';
import { EmptyStateInline } from '../componentes/ui/empty-state';
import { toast } from 'sonner';

import { agendaService, EventoAgenda, executarComandoAgenda, type PendenciaAgenda } from '../servicos/apiAgenda';
import { Loader2, Calendar as CalendarIcon, Ban, Check, Clock, Phone, User, Trash2, CalendarX, Settings, XCircle, RefreshCw, MessageSquare } from 'lucide-react';
import {
    acaoAgendaPermitida,
    corEventoPorStatus,
    descricaoEstadoDrawerAgenda,
    obterEstadoDrawerAgenda,
    ordenarPendenciasVencidas,
    pendenciaPermiteAcao,
    rotuloStatusAgenda,
} from './agenda-actions';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface Bloqueio {
    id: string;
    titulo: string;
    agendadoPara: string;
    duracao: number;
    descricao?: string;
}

interface DiaExpediente {
    diaSemana: number;
    ativo: boolean;
    inicio: string;
    fim: string;
}

interface Expediente {
    dias: DiaExpediente[];
    almocoAtivo: boolean;
    almocoInicio: string;
    almocoFim: string;
}

const MOTIVOS_REAGENDAMENTO = [
    { value: 'conflito_agenda', label: 'Conflito de agenda' },
    { value: 'ajuste_operacional', label: 'Ajuste operacional' },
    { value: 'indisponibilidade_consultor', label: 'Indisponibilidade do consultor' },
    { value: 'solicitacao_interna', label: 'Solicitação interna' },
    { value: 'outro', label: 'Outro' },
] as const;

type MotivoReagendamento = typeof MOTIVOS_REAGENDAMENTO[number]['value'];

const TEMPLATE_MENSAGEM_POR_MOTIVO: Record<MotivoReagendamento, string> = {
    conflito_agenda: 'Oi, [nome]! Tivemos um conflito pontual na agenda e precisamos ajustar seu atendimento. Posso te propor [data_hora]? Se não funcionar, te envio outras opções agora.',
    ajuste_operacional: 'Oi, [nome]! Fizemos um ajuste operacional na agenda para manter a qualidade do atendimento. Posso te propor [data_hora]? Se não funcionar, me avisa que ajusto para você.',
    indisponibilidade_consultor: 'Oi, [nome]! Nosso consultor ficou indisponível nesse horário e queremos te atender com toda atenção. Posso te propor [data_hora]? Se não funcionar, te envio outras alternativas.',
    solicitacao_interna: 'Oi, [nome]! Recebemos uma solicitação interna de ajuste de agenda. Posso te propor [data_hora]? Se não funcionar, te envio outras opções sem problema.',
    outro: 'Oi, [nome]! Precisamos fazer um ajuste no seu horário de atendimento. Posso te propor [data_hora]? Se não funcionar, me fala que te envio outras alternativas.',
};

export function Agenda() {
    const usuarioLogado = JSON.parse(localStorage.getItem('elyon_usuario') || '{}') as { papel?: string };
    const somenteLeitura = usuarioLogado.papel === 'VISUALIZADOR';
    const [events, setEvents] = useState<EventoAgenda[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<View>(Views.WEEK);
    const [date, setDate] = useState(new Date());

    const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
    const [loadingBloqueios, setLoadingBloqueios] = useState(false);
    const [pendenciasVencidas, setPendenciasVencidas] = useState<PendenciaAgenda[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
    const [bloqueioMotivo, setBloqueioMotivo] = useState('');
    const [bloquearDiaInteiro, setBloquearDiaInteiro] = useState(false);
    const [saving, setSaving] = useState(false);

    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<EventoAgenda | null>(null);
    const [approving, setApproving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [novoHorario, setNovoHorario] = useState('');
    const [motivoAcao, setMotivoAcao] = useState('');
    const [motivoProposta, setMotivoProposta] = useState<MotivoReagendamento | ''>('');
    const [mensagemProposta, setMensagemProposta] = useState('');
    const [avisarCliente, setAvisarCliente] = useState(true);
    const [absenceTarget, setAbsenceTarget] = useState<{
        id: string;
        version: number;
        leadNome: string;
        source: 'EVENTO' | 'PENDENCIA';
    } | null>(null);
    const commandRequestIds = useRef(new Map<string, string>());
    const requestIdFor = (key: string) => {
        const existing = commandRequestIds.current.get(key);
        if (existing) return existing;
        const created = crypto.randomUUID();
        commandRequestIds.current.set(key, created);
        return created;
    };

    // Estado Modal Configuração de Expediente
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [expediente, setExpediente] = useState<Expediente | null>(null);
    const [loadingExpediente, setLoadingExpediente] = useState(false);
    const [savingExpediente, setSavingExpediente] = useState(false);

    useEffect(() => {
        fetchEvents();
        fetchBloqueios();
        fetchPendenciasVencidas();
    }, [date, view]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
            const end = new Date(date.getFullYear(), date.getMonth() + 2, 0);
            const dados = await agendaService.listarEventos(start, end);
            setEvents(dados);
        } catch (error) {
            console.error('Erro ao carregar agenda:', error);
            toast.error('Não foi possível carregar a agenda.');
        } finally {
            setLoading(false);
        }
    };

    const fetchPendenciasVencidas = async () => {
        try {
            const items = await agendaService.listarPendenciasVencidas();
            setPendenciasVencidas(ordenarPendenciasVencidas(items));
        } catch (error) {
            console.error('Erro ao carregar pendências vencidas:', error);
            toast.error('Não foi possível carregar as pendências de desfecho.');
        }
    };

    const fetchBloqueios = async () => {
        setLoadingBloqueios(true);
        try {
            const dados = await agendaService.listarBloqueios();
            setBloqueios(dados.filter(b => new Date(b.agendadoPara) >= new Date()));
        } catch (error) {
            console.error('Erro ao carregar bloqueios:', error);
        } finally {
            setLoadingBloqueios(false);
        }
    };

    const fetchExpediente = async () => {
        setLoadingExpediente(true);
        try {
            const dados = await agendaService.obterExpediente();
            setExpediente(dados);
        } catch (error) {
            console.error('Erro ao carregar expediente:', error);
            toast.error('Erro ao carregar configuração.');
        } finally {
            setLoadingExpediente(false);
        }
    };

    const handleOpenConfig = () => {
        setShowConfigModal(true);
        fetchExpediente();
    };

    const handleSaveExpediente = async () => {
        if (!expediente) return;
        setSavingExpediente(true);
        try {
            await agendaService.salvarExpediente(expediente);
            toast.success('Expediente salvo com sucesso!');
            setShowConfigModal(false);
        } catch (error) {
            console.error('Erro ao salvar expediente:', error);
            toast.error('Erro ao salvar configuração.');
        } finally {
            setSavingExpediente(false);
        }
    };

    const handleDiaChange = (diaSemana: number, field: keyof DiaExpediente, value: string | boolean) => {
        if (!expediente) return;
        setExpediente({
            ...expediente,
            dias: expediente.dias.map(d =>
                d.diaSemana === diaSemana ? { ...d, [field]: value } : d
            )
        });
    };

    const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
        setSelectedSlot(slotInfo);
        setBloqueioMotivo('');
        setBloquearDiaInteiro(false);
        setShowModal(true);
    };

    const handleSelectEvent = (event: EventoAgenda) => {
        setSelectedEvent(event);
        setNovoHorario('');
        setMotivoAcao('');
        setMotivoProposta('');
        setMensagemProposta('');
        setAvisarCliente(true);
        setShowEventModal(true);
    };

    const formatarDataHoraExtenso = (data: Date) => data.toLocaleString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const aplicarPlaceholdersMensagem = (template: string): string => {
        if (!selectedEvent || !novoHorario) return template;
        const nome = selectedEvent.extendedProps?.leadNome || 'cliente';
        const data = new Date(novoHorario);
        const dataHora = formatarDataHoraExtenso(data);
        const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });

        return template
            .replace(/\[nome\]/gi, nome)
            .replace(/\[(data_hora|data)\]/gi, dataHora)
            .replace(/\[dia_semana\]/gi, diaSemana);
    };

    const mensagemFinalProposta = (() => {
        const textoBase = (mensagemProposta || '').trim()
            || (motivoProposta ? TEMPLATE_MENSAGEM_POR_MOTIVO[motivoProposta] : '');
        if (!textoBase) return '';
        return aplicarPlaceholdersMensagem(textoBase);
    })();

    const estadoDrawer = obterEstadoDrawerAgenda(selectedEvent);
    const permiteCancelar = acaoAgendaPermitida(selectedEvent, 'CANCELAR');
    const permiteReagendar = acaoAgendaPermitida(selectedEvent, 'REAGENDAR');
    const exibeResumoDesfecho = estadoDrawer === 'CONCLUIDO' || estadoDrawer === 'CANCELADO';

    const handleSalvarBloqueio = async () => {
        if (!selectedSlot || !bloqueioMotivo) {
            toast.warning('Informe o motivo do bloqueio.');
            return;
        }
        setSaving(true);
        try {
            let inicio = selectedSlot.start;
            let fim = selectedSlot.end;
            if (bloquearDiaInteiro) {
                inicio = startOfDay(selectedSlot.start);
                fim = endOfDay(selectedSlot.start);
            }
            await agendaService.criarBloqueio(inicio, fim, bloqueioMotivo);
            toast.success('Horário bloqueado!');
            setShowModal(false);
            fetchEvents();
            fetchBloqueios();
        } catch (error) {
            console.error('Erro ao bloquear:', error);
            toast.error('Erro ao criar bloqueio.');
        } finally {
            setSaving(false);
        }
    };

    const handleAprovar = async () => {
        if (!selectedEvent) return;
        setApproving(true);
        try {
            await agendaService.aprovarAgendamento(selectedEvent.id);
            toast.success('Agendamento aprovado!');
            setShowEventModal(false);
            fetchEvents();
        } catch (error) {
            console.error('Erro ao aprovar:', error);
            toast.error('Erro ao aprovar agendamento.');
        } finally {
            setApproving(false);
        }
    };

    const handleExcluirBloqueio = async (id: string) => {
        if (!confirm('Excluir este bloqueio?')) return;
        try {
            await agendaService.excluirBloqueio(id);
            toast.success('Bloqueio excluído!');
            fetchEvents();
            fetchBloqueios();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            toast.error('Erro ao excluir bloqueio.');
        }
    };

    const handleCancelarAgendamento = async () => {
        if (!selectedEvent) return;
        if (!motivoAcao.trim()) {
            toast.warning('Informe o motivo do cancelamento.');
            return;
        }
        const confirmado = window.confirm(
            `Cancelar este compromisso? ${avisarCliente ? 'O lead será notificado pelo WhatsApp.' : 'O lead não será notificado automaticamente.'}`,
        );
        if (!confirmado) return;
        setActionLoading(true);
        try {
            await executarComandoAgenda(selectedEvent.id, {
                command: 'CANCELAR',
                expectedVersion: selectedEvent.extendedProps?.versao ?? 0,
                reasonCode: motivoAcao.trim(),
                notifyLead: avisarCliente,
            }, requestIdFor(`${selectedEvent.id}:${selectedEvent.extendedProps?.versao ?? 0}:cancelar`));
            toast.success(avisarCliente
                ? 'Agendamento cancelado; a notificação do lead foi enfileirada.'
                : 'Agendamento cancelado sem notificar o lead.');
            setShowEventModal(false);
            await Promise.all([fetchEvents(), fetchPendenciasVencidas()]);
        } catch (error) {
            console.error('Erro ao cancelar agendamento:', error);
            toast.error('Erro ao cancelar agendamento.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReagendarAgendamento = async () => {
        if (!selectedEvent) return;
        if (!novoHorario) {
            toast.warning('Informe o novo horário para reagendar.');
            return;
        }
        const confirmado = window.confirm(
            `Reagendar para ${new Date(novoHorario).toLocaleString('pt-BR')}? ${avisarCliente ? 'O lead será notificado pelo WhatsApp.' : 'O lead não será notificado automaticamente.'}`,
        );
        if (!confirmado) return;
        setActionLoading(true);
        try {
            await executarComandoAgenda(selectedEvent.id, {
                command: 'REAGENDAR',
                expectedVersion: selectedEvent.extendedProps?.versao ?? 0,
                reasonCode: motivoAcao.trim() || 'Reagendamento pelo gestor',
                scheduledFor: new Date(novoHorario),
                notifyLead: avisarCliente,
            }, requestIdFor(`${selectedEvent.id}:${selectedEvent.extendedProps?.versao ?? 0}:reagendar:${novoHorario}`));
            toast.success(avisarCliente
                ? 'Agendamento reagendado; a notificação do lead foi enfileirada.'
                : 'Agendamento reagendado sem notificar o lead.');
            setShowEventModal(false);
            await Promise.all([fetchEvents(), fetchPendenciasVencidas()]);
        } catch (error) {
            console.error('Erro ao reagendar:', error);
            toast.error('Erro ao reagendar agendamento.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleProporHorario = async () => {
        if (!selectedEvent) return;
        if (!novoHorario) {
            toast.warning('Informe o horário que deseja propor ao cliente.');
            return;
        }
        if (!motivoProposta) {
            toast.warning('Selecione o motivo do reagendamento para gerar a mensagem padrão.');
            return;
        }
        if (mensagemProposta.trim()) {
            const usaPlaceholderData = /\[(data_hora|data)\]/i.test(mensagemProposta);
            if (!usaPlaceholderData) {
                toast.warning('Na mensagem personalizada, inclua [data_hora] (ou [data]) para posicionar a data/hora no contexto.');
                return;
            }
        }

        if (!mensagemFinalProposta.trim()) {
            toast.warning('Não foi possível montar a mensagem final da proposta.');
            return;
        }

        setActionLoading(true);
        try {
            await agendaService.proporNovoHorario(selectedEvent.id, {
                horarioProposto: new Date(novoHorario),
                mensagem: mensagemFinalProposta,
                expectedVersion: selectedEvent.extendedProps?.versao ?? 0,
            });
            toast.success('Horário proposto ao cliente.');
            setShowEventModal(false);
            fetchEvents();
        } catch (error) {
            console.error('Erro ao propor horário:', error);
            toast.error('Erro ao propor novo horário.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRegistrarResultado = async (
        target: { id: string; version: number; source: 'EVENTO' | 'PENDENCIA' },
        command: 'REALIZAR' | 'NAO_COMPARECEU',
        absentParty?: 'LEAD' | 'ESPECIALISTA',
    ) => {
        setActionLoading(true);
        try {
            await executarComandoAgenda(target.id, {
                command,
                expectedVersion: target.version,
                reasonCode: command === 'REALIZAR'
                    ? 'Atendimento realizado'
                    : absentParty === 'ESPECIALISTA' ? 'Especialista não compareceu' : 'Lead não compareceu',
                absentParty,
                notifyLead: false,
            }, requestIdFor(`${target.id}:${target.version}:${command}:${absentParty || 'NA'}`));
            toast.success(command === 'REALIZAR'
                ? 'Atendimento marcado como realizado.'
                : `Ausência do ${absentParty === 'ESPECIALISTA' ? 'especialista' : 'lead'} registrada.`);
            if (target.source === 'EVENTO') setShowEventModal(false);
            setAbsenceTarget(null);
            await Promise.all([fetchEvents(), fetchPendenciasVencidas()]);
        } catch (error) {
            console.error('Erro ao registrar resultado:', error);
            toast.error('Não foi possível registrar o resultado.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRecusarParticipacao = async () => {
        if (!selectedEvent) return;
        setActionLoading(true);
        try {
            const result = await executarComandoAgenda(selectedEvent.id, {
                command: 'RECUSAR',
                expectedVersion: selectedEvent.extendedProps?.versao ?? 0,
                reasonCode: motivoAcao.trim() || 'Indisponibilidade do especialista',
                notifyLead: false,
            }, requestIdFor(`${selectedEvent.id}:${selectedEvent.extendedProps?.versao ?? 0}:recusar`));
            const remanejado = result?.reassignment?.sucesso;
            toast.success(remanejado
                ? `Participação recusada; ${result.reassignment.especialistaNome || 'o fallback'} recebeu a solicitação.`
                : 'Participação recusada. A operação recebeu a pendência porque não há fallback elegível.');
            setShowEventModal(false);
            await Promise.all([fetchEvents(), fetchPendenciasVencidas()]);
        } catch (error) {
            console.error('Erro ao recusar participação:', error);
            toast.error('Não foi possível registrar a indisponibilidade do especialista.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCorrigirResultado = async () => {
        if (!selectedEvent) return;
        const correctedStatus = window.prompt('Novo desfecho: REALIZADO, NAO_COMPARECEU ou CANCELADO')?.trim().toUpperCase();
        if (!['REALIZADO', 'NAO_COMPARECEU', 'CANCELADO'].includes(correctedStatus || '')) {
            toast.warning('Informe um desfecho válido.');
            return;
        }
        const justification = window.prompt('Justificativa administrativa (mínimo de 10 caracteres)')?.trim();
        if (!justification || justification.length < 10) {
            toast.warning('A justificativa é obrigatória.');
            return;
        }
        let absentParty: 'LEAD' | 'ESPECIALISTA' | undefined;
        if (correctedStatus === 'NAO_COMPARECEU') {
            const selectedParty = window.prompt('Parte ausente: LEAD ou ESPECIALISTA')?.trim().toUpperCase();
            if (!['LEAD', 'ESPECIALISTA'].includes(selectedParty || '')) {
                toast.warning('Informe quem não compareceu: LEAD ou ESPECIALISTA.');
                return;
            }
            absentParty = selectedParty as 'LEAD' | 'ESPECIALISTA';
        }
        setActionLoading(true);
        try {
            await executarComandoAgenda(selectedEvent.id, {
                command: 'CORRIGIR', expectedVersion: selectedEvent.extendedProps?.versao ?? 0,
                reasonCode: 'CORRECAO_ADMINISTRATIVA', justification,
                correctedStatus: correctedStatus as 'REALIZADO' | 'NAO_COMPARECEU' | 'CANCELADO', absentParty,
            });
            toast.success('Correção registrada sem apagar o histórico.');
            setShowEventModal(false);
            fetchEvents();
        } catch (error) {
            console.error('Erro ao corrigir resultado:', error);
            toast.error('Não foi possível registrar a correção.');
        } finally {
            setActionLoading(false);
        }
    };

    const eventStyleGetter = (event: EventoAgenda) => {
        let backgroundColor = corEventoPorStatus(event);
        if (event.extendedProps?.tipo === 'BLOQUEIO' || event.title.includes('BLOQUEIO')) backgroundColor = '#ef4444';
        return { style: { backgroundColor, borderRadius: '4px', opacity: 0.8, color: 'white', border: '0px', display: 'block' } };
    };

    const getStatusBadge = (status: string | undefined) => {
        switch (status) {
            case 'PENDENTE':
            case 'SOLICITADO':
            case 'PROPOSTO': return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="w-3 h-3 mr-1" />{rotuloStatusAgenda(status)}</Badge>;
            case 'CONFIRMADO': return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300"><Check className="w-3 h-3 mr-1" />Confirmado</Badge>;
            case 'REALIZADO': return <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300"><Check className="w-3 h-3 mr-1" />Realizado</Badge>;
            case 'NAO_COMPARECEU': return <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300"><CalendarX className="w-3 h-3 mr-1" />Não compareceu</Badge>;
            case 'CANCELADO': return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300"><Ban className="w-3 h-3 mr-1" />Cancelado</Badge>;
            default: return <Badge variant="outline">{rotuloStatusAgenda(status)}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Agenda"
                description="Gerencie sua disponibilidade e visualize agendamentos."
                icon={<CalendarIcon className="w-5 h-5" />}
                actions={(
                <div className="flex gap-2">
                    {!somenteLeitura && (
                        <Button variant="outline" onClick={handleOpenConfig}>
                            <Settings className="mr-2 h-4 w-4" />
                            Configurar Horários
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => { fetchEvents(); fetchBloqueios(); }} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
                        Atualizar
                    </Button>
                    {!somenteLeitura && (
                        <Button onClick={() => { setSelectedSlot({ start: new Date(), end: new Date() }); setShowModal(true); }}>
                            <Ban className="mr-2 h-4 w-4" />
                            Bloquear Horário
                        </Button>
                    )}
                </div>
                )}
            />

            {pendenciasVencidas.length > 0 && (
                <Card className="border-amber-300 bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Pendências de desfecho ({pendenciasVencidas.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {pendenciasVencidas.map((item) => (
                            <div key={item.id} className="rounded-md border bg-background p-3 text-sm space-y-3">
                                <p className="font-medium">{item.leadNome}</p>
                                <p className="text-muted-foreground">
                                    {item.operationalReason === 'SPECIALIST_PENDING'
                                        ? 'Sem especialista atribuído'
                                        : item.operationalReason === 'FEEDBACK_SPECIALIST_PENDING'
                                            ? 'Especialista não respondeu ao feedback'
                                            : 'Aguardando classificação'}
                                    {' · '}{item.pendingAgeMinutes} min
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(item.scheduledFor).toLocaleString('pt-BR')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {pendenciaPermiteAcao(item, 'REALIZAR') && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleRegistrarResultado({
                                                id: item.id, version: item.version, source: 'PENDENCIA',
                                            }, 'REALIZAR')}
                                            disabled={actionLoading}
                                        >
                                            <Check className="mr-1 h-4 w-4" />Realizado
                                        </Button>
                                    )}
                                    {pendenciaPermiteAcao(item, 'NAO_COMPARECEU') && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setAbsenceTarget({
                                                id: item.id,
                                                version: item.version,
                                                leadNome: item.leadNome,
                                                source: 'PENDENCIA',
                                            })}
                                            disabled={actionLoading}
                                        >
                                            <CalendarX className="mr-1 h-4 w-4" />Registrar ausência
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CalendarX className="h-5 w-5 text-red-500" />
                            Bloqueios
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                        {loadingBloqueios ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : bloqueios.length === 0 ? (
                            <EmptyStateInline mensagem="Nenhum bloqueio ativo" />
                        ) : (
                            bloqueios.map((b) => (
                                <div key={b.id} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">{new Date(b.agendadoPara).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(b.agendadoPara).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        {!somenteLeitura && (
                                            <Button variant="ghost" size="icon" aria-label="Excluir bloqueio de agenda" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleExcluirBloqueio(b.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardContent className="p-6">
                        <div className="h-[700px]">
                            <Calendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%' }}
                                views={['month', 'week', 'day', 'agenda']}
                                view={view}
                                onView={setView}
                                date={date}
                                onNavigate={setDate}
                                culture='pt-BR'
                                selectable={!somenteLeitura}
                                onSelectSlot={somenteLeitura ? undefined : handleSelectSlot}
                                onSelectEvent={handleSelectEvent}
                                eventPropGetter={eventStyleGetter}
                                messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", date: "Data", time: "Hora", event: "Evento", noEventsInRange: "Sem eventos." }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Modal Bloqueio */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bloquear Horário</DialogTitle>
                        <DialogDescription>Impeça agendamentos neste período.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="diaInteiro" checked={bloquearDiaInteiro} onChange={(e) => setBloquearDiaInteiro(e.target.checked)} className="h-4 w-4" />
                            <Label htmlFor="diaInteiro">Bloquear dia inteiro</Label>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="motivo">Motivo</Label>
                            <Input id="motivo" placeholder="Ex: Médico, Férias..." value={bloqueioMotivo} onChange={(e) => setBloqueioMotivo(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button onClick={handleSalvarBloqueio} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                            Bloquear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Drawer Evento */}
            <Drawer open={showEventModal} onOpenChange={setShowEventModal}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />{selectedEvent?.title}</DrawerTitle>
                        <DrawerDescription>
                            {descricaoEstadoDrawerAgenda(estadoDrawer)}
                        </DrawerDescription>
                    </DrawerHeader>
                    <DrawerBody className="space-y-5">
                        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                                {getStatusBadge(selectedEvent?.extendedProps?.status)}
                            </div>
                            <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-muted-foreground" /><span>{selectedEvent?.start instanceof Date ? selectedEvent.start.toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span></div>
                            {selectedEvent?.extendedProps?.leadNome && <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" /><span>{selectedEvent.extendedProps.leadNome}</span></div>}
                            {selectedEvent?.extendedProps?.leadTelefone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedEvent.extendedProps.leadTelefone}</span></div>}
                            {selectedEvent?.extendedProps?.especialistaNome && (
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span>Responsável: <strong>{selectedEvent.extendedProps.especialistaNome}</strong></span>
                                </div>
                            )}
                        </section>

                        {estadoDrawer === 'VENCIDO_SEM_DESFECHO' && (
                            <section role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
                                <p className="font-semibold">Resultado pendente</p>
                                <p>O horário deste atendimento já passou. Informe abaixo se ele foi realizado ou quem não compareceu.</p>
                            </section>
                        )}

                        {exibeResumoDesfecho && selectedEvent && (
                            <section aria-label="Resultado do atendimento" className="rounded-lg border bg-slate-50 p-4 text-sm space-y-3">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resultado registrado</p>
                                    <p className="mt-1 text-base font-semibold text-slate-900">
                                        {rotuloStatusAgenda(selectedEvent.extendedProps?.status)}
                                    </p>
                                </div>
                                {selectedEvent.extendedProps?.parteAusente && (
                                    <p><span className="text-slate-500">Parte ausente:</span>{' '}
                                        <strong>{selectedEvent.extendedProps.parteAusente === 'LEAD' ? 'Lead' : 'Especialista'}</strong>
                                    </p>
                                )}
                                {selectedEvent.extendedProps?.resultadoRegistradoEm && (
                                    <p><span className="text-slate-500">Registrado em:</span>{' '}
                                        {new Date(selectedEvent.extendedProps.resultadoRegistradoEm).toLocaleString('pt-BR')}
                                    </p>
                                )}
                                {selectedEvent.extendedProps?.resultadoRegistradoPor && (
                                    <p><span className="text-slate-500">Registrado por:</span>{' '}
                                        {selectedEvent.extendedProps.resultadoRegistradoPor}
                                    </p>
                                )}
                                {selectedEvent.extendedProps?.resultadoMotivo && (
                                    <p><span className="text-slate-500">Motivo ou observação:</span>{' '}
                                        {selectedEvent.extendedProps.resultadoMotivo}
                                    </p>
                                )}
                            </section>
                        )}

                        {permiteReagendar && (
                        <section className="space-y-2 w-full min-w-0">
                            <Label htmlFor="novoHorario" className="font-medium">Novo horário</Label>
                            <Input
                                id="novoHorario"
                                type="datetime-local"
                                className="w-full max-w-full"
                                value={novoHorario}
                                onChange={(e) => setNovoHorario(e.target.value)}
                            />
                        </section>
                        )}

                        {permiteReagendar && (
                        <section className="space-y-2 w-full min-w-0">
                            <Label htmlFor="motivoProposta" className="font-medium">Motivo do reagendamento</Label>
                            <select
                                id="motivoProposta"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={motivoProposta}
                                onChange={(e) => setMotivoProposta(e.target.value as MotivoReagendamento | '')}
                            >
                                <option value="">Selecione um motivo...</option>
                                {MOTIVOS_REAGENDAMENTO.map((motivo) => (
                                    <option key={motivo.value} value={motivo.value}>
                                        {motivo.label}
                                    </option>
                                ))}
                            </select>
                        </section>
                        )}

                        {permiteCancelar && (
                        <section className="space-y-2 w-full min-w-0">
                            <Label htmlFor="motivoAcao" className="font-medium">Motivo do cancelamento</Label>
                            <Input
                                id="motivoAcao"
                                className="w-full max-w-full"
                                placeholder="Ex.: conflito de agenda"
                                value={motivoAcao}
                                onChange={(e) => setMotivoAcao(e.target.value)}
                            />
                        </section>
                        )}

                        {selectedEvent && (acaoAgendaPermitida(selectedEvent, 'CANCELAR') || acaoAgendaPermitida(selectedEvent, 'REAGENDAR')) && (
                            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                                <input
                                    type="checkbox"
                                    checked={avisarCliente}
                                    onChange={(event) => setAvisarCliente(event.target.checked)}
                                    className="mt-0.5 h-4 w-4"
                                />
                                <span>
                                    <strong>Notificar o lead pelo WhatsApp</strong>
                                    <span className="block text-muted-foreground">
                                        Desmarque somente quando a comunicação será feita manualmente por outro canal.
                                    </span>
                                </span>
                            </label>
                        )}

                        {permiteReagendar && <section className="space-y-2 w-full min-w-0">
                            <Label htmlFor="mensagemProposta" className="font-medium">Mensagem para o cliente (opcional)</Label>
                            <Textarea
                                id="mensagemProposta"
                                className="w-full max-w-full"
                                rows={3}
                                placeholder="Personalize usando [nome], [data_hora], [dia_semana]"
                                value={mensagemProposta}
                                onChange={(e) => setMensagemProposta(e.target.value)}
                            />
                        </section>}

                        {permiteReagendar && <section className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                                <p className="font-medium">Placeholders inteligentes</p>
                                <p><code>[nome]</code> insere o nome do cliente.</p>
                                <p><code>[data_hora]</code> (ou <code>[data]</code>) insere data e hora propostas.</p>
                                <p><code>[dia_semana]</code> insere o dia da semana do novo horário.</p>
                                <p>Em mensagem personalizada, inclua <code>[data_hora]</code> para manter contexto.</p>
                        </section>}

                        {permiteReagendar && mensagemFinalProposta && (
                            <section className="rounded-md border bg-emerald-50 p-3 text-sm">
                                <p className="font-medium mb-1">Preview da mensagem que será enviada</p>
                                <p className="whitespace-pre-wrap leading-relaxed">{mensagemFinalProposta}</p>
                            </section>
                        )}
                    </DrawerBody>
                    <DrawerFooter>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <Button variant="outline" onClick={() => setShowEventModal(false)}>Fechar</Button>
                            {selectedEvent?.extendedProps?.status === 'PENDENTE' && (
                                <Button onClick={handleAprovar} disabled={approving} className="bg-success hover:bg-success-dark text-white">
                                    {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Aprovar
                                </Button>
                            )}
                            {acaoAgendaPermitida(selectedEvent, 'CANCELAR') && (
                                <Button variant="destructive" onClick={handleCancelarAgendamento} disabled={actionLoading}>
                                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                    Cancelar
                                </Button>
                            )}
                            {acaoAgendaPermitida(selectedEvent, 'REAGENDAR') && (
                                <>
                                    <Button variant="outline" onClick={handleReagendarAgendamento} disabled={actionLoading}>
                                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        Reagendar
                                    </Button>
                                    <Button onClick={handleProporHorario} disabled={actionLoading}>
                                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                        Propor Horário
                                    </Button>
                                </>
                            )}
                            {acaoAgendaPermitida(selectedEvent, 'REALIZAR') && (
                                <Button onClick={() => selectedEvent && handleRegistrarResultado({
                                    id: selectedEvent.id,
                                    version: selectedEvent.extendedProps?.versao ?? 0,
                                    source: 'EVENTO',
                                }, 'REALIZAR')} disabled={actionLoading}>
                                    <Check className="mr-2 h-4 w-4" />Realizado
                                </Button>
                            )}
                            {acaoAgendaPermitida(selectedEvent, 'NAO_COMPARECEU') && (
                                <Button variant="outline" onClick={() => selectedEvent && setAbsenceTarget({
                                    id: selectedEvent.id,
                                    version: selectedEvent.extendedProps?.versao ?? 0,
                                    leadNome: selectedEvent.extendedProps?.leadNome || 'Lead',
                                    source: 'EVENTO',
                                })} disabled={actionLoading}>
                                    <CalendarX className="mr-2 h-4 w-4" />Registrar ausência
                                </Button>
                            )}
                            {acaoAgendaPermitida(selectedEvent, 'RECUSAR') && (
                                <Button variant="outline" onClick={handleRecusarParticipacao} disabled={actionLoading}>
                                    <User className="mr-2 h-4 w-4" />
                                    {usuarioLogado.papel === 'CORRETOR' ? 'Não poderei atender' : 'Marcar especialista indisponível'}
                                </Button>
                            )}
                            {acaoAgendaPermitida(selectedEvent, 'CORRIGIR') && (
                                <Button variant="outline" onClick={handleCorrigirResultado} disabled={actionLoading}>
                                    <RefreshCw className="mr-2 h-4 w-4" />Corrigir desfecho
                                </Button>
                            )}
                        </div>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <Dialog open={Boolean(absenceTarget)} onOpenChange={(open) => !open && !actionLoading && setAbsenceTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Quem não compareceu?</DialogTitle>
                        <DialogDescription>
                            Selecione a parte ausente no atendimento de {absenceTarget?.leadNome}. Essa informação ficará registrada no histórico.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                            variant="outline"
                            disabled={!absenceTarget || actionLoading}
                            onClick={() => absenceTarget && handleRegistrarResultado(absenceTarget, 'NAO_COMPARECEU', 'LEAD')}
                        >
                            <User className="mr-2 h-4 w-4" />O lead não compareceu
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!absenceTarget || actionLoading}
                            onClick={() => absenceTarget && handleRegistrarResultado(absenceTarget, 'NAO_COMPARECEU', 'ESPECIALISTA')}
                        >
                            <Phone className="mr-2 h-4 w-4" />O especialista não compareceu
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAbsenceTarget(null)} disabled={actionLoading}>Voltar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Configuração de Expediente */}
            <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Configurar Meu Expediente</DialogTitle>
                        <DialogDescription>Defina os dias e horários que você trabalha. A IA respeitará essa configuração.</DialogDescription>
                    </DialogHeader>

                    {loadingExpediente ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : expediente ? (
                        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                            {expediente.dias.map((dia) => (
                                <div key={dia.diaSemana} className={`flex items-center gap-4 p-3 rounded-lg border ${dia.ativo ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200' : 'bg-slate-50 dark:bg-slate-900 border-slate-200'}`}>
                                    <input
                                        type="checkbox"
                                        checked={dia.ativo}
                                        onChange={(e) => handleDiaChange(dia.diaSemana, 'ativo', e.target.checked)}
                                        className="h-5 w-5"
                                    />
                                    <span className="w-24 font-medium">{DIAS_SEMANA[dia.diaSemana]}</span>
                                    <Input
                                        type="time"
                                        value={dia.inicio}
                                        onChange={(e) => handleDiaChange(dia.diaSemana, 'inicio', e.target.value)}
                                        disabled={!dia.ativo}
                                        className="w-28"
                                    />
                                    <span className="text-muted-foreground">até</span>
                                    <Input
                                        type="time"
                                        value={dia.fim}
                                        onChange={(e) => handleDiaChange(dia.diaSemana, 'fim', e.target.value)}
                                        disabled={!dia.ativo}
                                        className="w-28"
                                    />
                                </div>
                            ))}

                            <div className="border-t pt-4 mt-4">
                                <div className="flex items-center gap-4 p-3 rounded-lg border">
                                    <input
                                        type="checkbox"
                                        checked={expediente.almocoAtivo}
                                        onChange={(e) => setExpediente({ ...expediente, almocoAtivo: e.target.checked })}
                                        className="h-5 w-5"
                                    />
                                    <span className="w-24 font-medium">Almoço</span>
                                    <Input
                                        type="time"
                                        value={expediente.almocoInicio}
                                        onChange={(e) => setExpediente({ ...expediente, almocoInicio: e.target.value })}
                                        disabled={!expediente.almocoAtivo}
                                        className="w-28"
                                    />
                                    <span className="text-muted-foreground">até</span>
                                    <Input
                                        type="time"
                                        value={expediente.almocoFim}
                                        onChange={(e) => setExpediente({ ...expediente, almocoFim: e.target.value })}
                                        disabled={!expediente.almocoAtivo}
                                        className="w-28"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfigModal(false)}>Cancelar</Button>
                        <Button onClick={handleSaveExpediente} disabled={savingExpediente}>
                            {savingExpediente ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Salvar Expediente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
