import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';

import { agendaService, EventoAgenda } from '../servicos/apiAgenda';
import { Loader2, Calendar as CalendarIcon, Ban, Check, Clock, Phone, User, Trash2, CalendarX, Settings, XCircle, RefreshCw, MessageSquare } from 'lucide-react';

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
    const [events, setEvents] = useState<EventoAgenda[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<View>(Views.WEEK);
    const [date, setDate] = useState(new Date());

    const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
    const [loadingBloqueios, setLoadingBloqueios] = useState(false);

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

    // Estado Modal Configuração de Expediente
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [expediente, setExpediente] = useState<Expediente | null>(null);
    const [loadingExpediente, setLoadingExpediente] = useState(false);
    const [savingExpediente, setSavingExpediente] = useState(false);

    useEffect(() => {
        fetchEvents();
        fetchBloqueios();
    }, [date, view]);

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
        setActionLoading(true);
        try {
            await agendaService.cancelarAgendamento(selectedEvent.id, {
                motivo: motivoAcao || undefined,
                avisarCliente: true
            });
            toast.success('Agendamento cancelado.');
            setShowEventModal(false);
            fetchEvents();
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
        setActionLoading(true);
        try {
            await agendaService.reagendarAgendamento(selectedEvent.id, {
                novoHorario: new Date(novoHorario),
                motivo: motivoAcao || undefined,
                avisarCliente: true
            });
            toast.success('Agendamento reagendado.');
            setShowEventModal(false);
            fetchEvents();
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
                mensagem: mensagemFinalProposta
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

    const eventStyleGetter = (event: EventoAgenda) => {
        let backgroundColor = event.backgroundColor || '#3174ad';
        if (event.extendedProps?.tipo === 'BLOQUEIO' || event.title.includes('BLOQUEIO')) backgroundColor = '#ef4444';
        if (event.extendedProps?.status === 'CONFIRMADO') backgroundColor = '#22c55e';
        return { style: { backgroundColor, borderRadius: '4px', opacity: 0.8, color: 'white', border: '0px', display: 'block' } };
    };

    const getStatusBadge = (status: string | undefined) => {
        switch (status) {
            case 'PENDENTE': return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="w-3 h-3 mr-1" />Aguardando</Badge>;
            case 'CONFIRMADO': return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300"><Check className="w-3 h-3 mr-1" />Confirmado</Badge>;
            case 'CANCELADO': return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300"><Ban className="w-3 h-3 mr-1" />Cancelado</Badge>;
            default: return <Badge variant="outline">{status || 'N/A'}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
                    <p className="text-muted-foreground">Gerencie sua disponibilidade e visualize agendamentos.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleOpenConfig}>
                        <Settings className="mr-2 h-4 w-4" />
                        Configurar Horários
                    </Button>
                    <Button variant="outline" onClick={() => { fetchEvents(); fetchBloqueios(); }} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
                        Atualizar
                    </Button>
                    <Button onClick={() => { setSelectedSlot({ start: new Date(), end: new Date() }); setShowModal(true); }}>
                        <Ban className="mr-2 h-4 w-4" />
                        Bloquear Horário
                    </Button>
                </div>
            </div>

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
                            <p className="text-sm text-muted-foreground text-center py-4">Nenhum bloqueio ativo</p>
                        ) : (
                            bloqueios.map((b) => (
                                <div key={b.id} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">{new Date(b.agendadoPara).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(b.agendadoPara).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleExcluirBloqueio(b.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
                                selectable
                                onSelectSlot={handleSelectSlot}
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
                            Ações de aprovação, cancelamento, reagendamento e proposta de novo horário.
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
                        </section>

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

                        <section className="space-y-2 w-full min-w-0">
                            <Label htmlFor="motivoAcao" className="font-medium">Observação interna (opcional)</Label>
                            <Input
                                id="motivoAcao"
                                className="w-full max-w-full"
                                placeholder="Ex.: conflito de agenda"
                                value={motivoAcao}
                                onChange={(e) => setMotivoAcao(e.target.value)}
                            />
                        </section>

                        <section className="space-y-2 w-full min-w-0">
                            <Label htmlFor="mensagemProposta" className="font-medium">Mensagem para o cliente (opcional)</Label>
                            <Textarea
                                id="mensagemProposta"
                                className="w-full max-w-full"
                                rows={3}
                                placeholder="Personalize usando [nome], [data_hora], [dia_semana]"
                                value={mensagemProposta}
                                onChange={(e) => setMensagemProposta(e.target.value)}
                            />
                        </section>

                        <section className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                                <p className="font-medium">Placeholders inteligentes</p>
                                <p><code>[nome]</code> insere o nome do cliente.</p>
                                <p><code>[data_hora]</code> (ou <code>[data]</code>) insere data e hora propostas.</p>
                                <p><code>[dia_semana]</code> insere o dia da semana do novo horário.</p>
                                <p>Em mensagem personalizada, inclua <code>[data_hora]</code> para manter contexto.</p>
                        </section>

                        {mensagemFinalProposta && (
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
                            <Button variant="destructive" onClick={handleCancelarAgendamento} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                Cancelar
                            </Button>
                            <Button variant="outline" onClick={handleReagendarAgendamento} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Reagendar
                            </Button>
                            <Button onClick={handleProporHorario} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                Propor Horário
                            </Button>
                        </div>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

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
                                <div key={dia.diaSemana} className={`flex items-center gap-4 p-3 rounded-lg border ${dia.ativo ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200' : 'bg-gray-50 dark:bg-gray-900 border-gray-200'}`}>
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
