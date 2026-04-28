import { useState, useMemo } from "react";
import {
    MoreHorizontal,
    Phone,
    Calendar,
    Clock,
    Ban,
    Home,
    User,
    Megaphone,
    Flame,
    Zap,
    Snowflake,
} from "lucide-react";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "./ui/dialog";
import { api } from "../servicos/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getStatusLeadUI, getTemperaturaLeadUI } from "./leads/lead-ui";

// Tipos enriquecidos — alinhados com LeadPriorizado do hook
interface Lead {
    id: string;
    nome: string | null;
    telefone: string | null;
    email: string | null;
    status: string;
    temperatura: string | null;
    dataCriacao?: string;
    criadoEm?: string; // campo real do backend
    proximaAtividade?: {
        tipo: string;
        dataAgendada?: string;
        agendadoPara?: string;
        titulo?: string;
    } | null;

    // ── Campanha de origem ──
    campanhaOrigem?: { id: string; nome: string } | null;

    // ── Dados do imóvel (wizard de captação) ──
    interesseEm?: string | null;
    valorPretendido?: string | null;
    tipoImovel?: string | null;
    bairroImovel?: string | null;
    enderecoImovel?: string | null;

    // ── Perfil Assertiva (enriquecimento na mineração) ──
    scoreAssertiva?: number | null;
    rendaEstimada?: string | null;
    faixaSalarial?: string | null;
    profissao?: string | null;

    // ── Score Composto ──
    scoreComposto?: number | null;
}

interface KanbanLeadsProps {
    leads: Lead[];
    onLeadUpdate: () => void;
    paginadoPorColuna?: boolean;
}

// Colunas do Kanban alinhadas aos 4 Agentes de Captação
const KANBAN_COLUMNS = [
    {
        id: "FASE1",
        label: "1. Qualificação",
        status: "NOVO",
        color: "bg-indigo-50 border-indigo-200",
        text: "text-indigo-700",
        description: "Opener: Confirmar interesse + identificar dores",
        agente: "OPENER"
    },
    {
        id: "FASE2",
        label: "2. Apresentação",
        status: "TENTATIVA_AGENDAMENTO",
        color: "bg-amber-50 border-amber-200",
        text: "text-amber-700",
        description: "Presenter: Conectar dores às soluções",
        agente: "PRESENTER"
    },
    {
        id: "FASE3",
        label: "3. Documentação",
        status: "DOCUMENTACAO",
        color: "bg-violet-50 border-violet-200",
        text: "text-violet-700",
        description: "Humano: Contrato e formalização",
        agente: "HUMANO"
    },
    {
        id: "FASE4",
        label: "4. Onboarding",
        status: "ONBOARDING",
        color: "bg-emerald-50 border-emerald-200",
        text: "text-emerald-700",
        description: "Admin: Documentos + agendamento",
        agente: "ADMIN"
    },
];

export function KanbanLeads({ leads, onLeadUpdate }: KanbanLeadsProps) {
    const navigate = useNavigate();
    const tenant = JSON.parse(localStorage.getItem('elyon_tenant') || '{}');
    const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);

    // State para modal de blacklist
    const [blacklistModal, setBlacklistModal] = useState<{
        open: boolean;
        lead: Lead | null;
    }>({ open: false, lead: null });
    const [blacklistMotivo, setBlacklistMotivo] = useState<string>('MANUAL');
    const [blacklistObs, setBlacklistObs] = useState<string>('');
    const [blacklistLoading, setBlacklistLoading] = useState(false);

    // Função para enviar para blacklist
    const enviarParaBlacklist = async () => {
        if (!blacklistModal.lead?.telefone || !tenant?.id) return;

        setBlacklistLoading(true);
        try {
            await api.post('/blacklist', {
                telefone: blacklistModal.lead.telefone,
                motivo: blacklistMotivo,
                tenantId: tenant.id,
                nomeContato: blacklistModal.lead.nome || 'Lead Kanban',
                observacoes: blacklistObs
            });

            // Também marca o lead como PERDIDO
            await api.patch(`/leads/${blacklistModal.lead.id}`, { status: 'PERDIDO' });

            toast.success('Lead bloqueado e removido do Kanban!');
            setBlacklistModal({ open: false, lead: null });
            setBlacklistMotivo('MANUAL');
            setBlacklistObs('');
            onLeadUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao bloquear');
        } finally {
            setBlacklistLoading(false);
        }
    };

    // Mapeamento de status para colunas (Opener + Presenter + Humano + Admin)
    const getColumnId = (status: string): string | null => {
        // Fase 1: Opener (Qualificação)
        if (['NOVO'].includes(status)) return "FASE1";

        // Fase 2: Presenter (Apresentação)
        if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA'].includes(status)) return "FASE2";

        // Fase 3: Humano (Documentação)
        if (['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO'].includes(status)) return "FASE3";

        // Fase 4: Admin (Onboarding)
        if (['ONBOARDING'].includes(status)) return "FASE4";

        // Leads CAPTADO saem do Kanban e vão para Carteira
        if (['CAPTADO', 'ATIVO'].includes(status)) return null;

        // Não mostrar no Kanban
        if (["PERDIDO", "ARQUIVADO"].includes(status)) return null;

        return "FASE1"; // Fallback para status desconhecidos
    };

    // Obter o status real a partir do ID da coluna
    const getStatusFromColumnId = (columnId: string): string => {
        const column = KANBAN_COLUMNS.find(c => c.id === columnId);
        return column?.status || "NOVO";
    };

    // Agrupar leads por coluna
    const columns = useMemo(() => {
        const cols: Record<string, Lead[]> = {};
        KANBAN_COLUMNS.forEach(c => cols[c.id] = []);

        leads.forEach(lead => {
            const colId = getColumnId(lead.status);
            if (colId && cols[colId]) {
                cols[colId].push(lead);
            }
        });
        return cols;
    }, [leads]);

    // Handlers de Drag and Drop
    const handleDragStart = (e: React.DragEvent, leadId: string) => {
        setDraggedLeadId(leadId);
        e.dataTransfer.setData("leadId", leadId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");

        if (!leadId || updating) return;

        // Encontrar lead original
        const lead = leads.find(l => l.id === leadId);
        if (!lead || getColumnId(lead.status) === targetColumnId) return;

        // Converter ID da coluna para status real do banco
        const newStatus = getStatusFromColumnId(targetColumnId);

        // Otimistic Update
        setUpdating(leadId);

        try {
            await api.patch(`/leads/${leadId}`, {
                status: newStatus
            });
            toast.success("Status atualizado!");
            onLeadUpdate();
        } catch (error) {
            toast.error("Erro ao atualizar status");
            console.error(error);
        } finally {
            setUpdating(null);
            setDraggedLeadId(null);
        }
    };

    return (
        <>
            <div className="relative">
                <div className="flex h-[calc(100vh-220px)] overflow-x-auto pb-4 gap-4 items-start">
                    {KANBAN_COLUMNS.map((col) => (
                        <div
                            key={col.id}
                            className="flex-1 min-w-[280px] flex flex-col h-full rounded-xl bg-slate-50/50 border border-slate-200/60"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                        {/* Header da Coluna */}
                        <div className={`p-3 border-b border-slate-200 flex items-center justify-between font-semibold ${col.text} rounded-t-xl bg-white sticky top-0 z-10 shadow-sm`}>
                            <span>{col.label}</span>
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                                {columns[col.id]?.length || 0}
                            </span>
                        </div>

                        {/* Área de Cards (Scrollável) */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-3 min-h-[150px]">
                            {columns[col.id]?.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-lg m-2 p-4">
                                    Nenhuma oportunidade
                                </div>
                            )}

                            {columns[col.id]?.map((lead) => {
                                const dataBase = lead.criadoEm || lead.dataCriacao || new Date().toISOString();
                                const horasCriacao = Math.floor((new Date().getTime() - new Date(dataBase).getTime()) / (1000 * 60 * 60));
                                const isAtrasado = horasCriacao > 24 && lead.status === 'NOVO';

                                return (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        className={`
                   relative group bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all
                   ${updating === lead.id ? 'opacity-50 pointer-events-none' : ''}
                   ${draggedLeadId === lead.id ? 'border-indigo-400 rotate-2' : ''}
                 `}
                                        onClick={() => navigate(`/dashboard/proprietarios/${lead.id}`)}
                                    >
                                        {(() => {
                                            const statusUi = getStatusLeadUI(lead.status);
                                            const tempUi = getTemperaturaLeadUI(lead.temperatura);
                                            const tempIcon =
                                                tempUi.icon === "quente"
                                                    ? <Flame className="w-3 h-3 text-red-500" />
                                                    : tempUi.icon === "morno"
                                                        ? <Zap className="w-3 h-3 text-amber-500" />
                                                        : <Snowflake className="w-3 h-3 text-blue-400" />;
                                            return (
                                                <>
                                        {/* Botão de Conclusão (Fase 3 apenas) */}
                                        {col.id === 'FASE3' && (
                                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    size="sm"
                                                    className="bg-success hover:bg-success-dark text-white text-[10px] h-6 px-3 shadow-lg rounded-full"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Usar endpoint de captação
                                                        api.post(`/leads/${lead.id}/captar`).then(() => {
                                                            toast.success("Lead captado e movido para Carteira!");
                                                            onLeadUpdate();
                                                        });
                                                    }}
                                                >
                                                    Concluir Captação
                                                </Button>
                                            </div>
                                        )}

                                        {/* SLA Timer Badge */}
                                        {isAtrasado && (
                                            <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200 shadow-sm animate-pulse">
                                                <Clock className="w-3 h-3" />
                                                {horasCriacao}h
                                            </div>
                                        )}
                                        {/* Header do Card */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md mb-1 inline-flex items-center gap-1 ${tempUi.pillClass}`}>
                                                    {tempIcon}
                                                    {tempUi.label}
                                                </span>
                                                <div>
                                                    <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md ${statusUi.className}`}>
                                                        {statusUi.label}
                                                    </span>
                                                </div>
                                                <h4 className="font-semibold text-slate-900 line-clamp-1">{lead.nome || "Sem Nome"}</h4>
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreHorizontal className="h-3 w-3" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem onClick={() => navigate(`/dashboard/proprietarios/${lead.id}`)}>
                                                        Ver Detalhes
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={async () => {
                                                        await api.patch(`/leads/${lead.id}`, { status: 'PERDIDO' });
                                                        onLeadUpdate();
                                                    }}>
                                                        Marcar como Perdido
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-slate-600"
                                                        onClick={() => setBlacklistModal({ open: true, lead })}
                                                    >
                                                        <Ban className="w-3 h-3 mr-2" />
                                                        Bloquear Contato
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Campanha de origem */}
                                        {lead.campanhaOrigem && (
                                            <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-md mb-2">
                                                <Megaphone className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{lead.campanhaOrigem.nome}</span>
                                            </div>
                                        )}

                                        {/* Infos básicas */}
                                        <div className="space-y-1.5 mb-2">
                                            {lead.telefone && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Phone className="w-3 h-3" />
                                                    {lead.telefone}
                                                </div>
                                            )}
                                            {lead.proximaAtividade ? (
                                                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(
                                                        lead.proximaAtividade.agendadoPara ||
                                                        lead.proximaAtividade.dataAgendada ||
                                                        new Date().toISOString()
                                                    ).toLocaleDateString('pt-BR')}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                    <Clock className="w-3 h-3" />
                                                    Sem atividade
                                                </div>
                                            )}
                                        </div>

                                        {/* Dados do imóvel */}
                                        {(lead.tipoImovel || lead.valorPretendido || lead.bairroImovel) && (
                                            <div className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md mb-2">
                                                <Home className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                                                <span className="truncate">
                                                    {[lead.tipoImovel, lead.valorPretendido, lead.bairroImovel]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Perfil Assertiva */}
                                        {(lead.scoreAssertiva || lead.rendaEstimada || lead.faixaSalarial) && (
                                            <div className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md mb-2">
                                                <User className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                                                <span className="truncate">
                                                    {lead.scoreAssertiva && `Score ${lead.scoreAssertiva}`}
                                                    {lead.scoreAssertiva && (lead.rendaEstimada || lead.faixaSalarial) && ' · '}
                                                    {lead.rendaEstimada || lead.faixaSalarial || ''}
                                                    {lead.profissao && ` · ${lead.profissao}`}
                                                </span>
                                            </div>
                                        )}

                                        {/* Footer: data + score composto */}
                                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
                                            <span>{new Date(lead.criadoEm || lead.dataCriacao || '').toLocaleDateString('pt-BR')}</span>
                                            <div className="flex items-center gap-2">
                                                {lead.scoreComposto != null && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                        lead.scoreComposto >= 60 ? 'bg-emerald-100 text-emerald-700' :
                                                        lead.scoreComposto >= 35 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-slate-100 text-slate-500'
                                                    }`}>{lead.scoreComposto} pts</span>
                                                )}
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {(lead.nome || "?")[0]}
                                                </div>
                                            </div>
                                        </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                        </div>
                    ))}
                </div>
                <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-slate-50 pointer-events-none lg:hidden" />
            </div>

            {/* Modal de Blacklist */}
            <Dialog open={blacklistModal.open} onOpenChange={(open) => !open && setBlacklistModal({ open: false, lead: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ban className="w-5 h-5 text-slate-600" />
                            Bloquear Contato
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="font-medium">{blacklistModal.lead?.nome || 'Sem nome'}</p>
                            <p className="text-sm text-slate-500">{blacklistModal.lead?.telefone}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Motivo do bloqueio</label>
                            <select
                                value={blacklistMotivo}
                                onChange={(e) => setBlacklistMotivo(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            >
                                <option value="MANUAL">Bloqueio Manual</option>
                                <option value="OPTOUT">Solicitou Opt-out</option>
                                <option value="RECLAMACAO">Reclamação</option>
                                <option value="INVALIDO">Número Inválido</option>
                                <option value="CONTATO_PESSOAL">Contato Pessoal</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Observações (opcional)</label>
                            <textarea
                                value={blacklistObs}
                                onChange={(e) => setBlacklistObs(e.target.value)}
                                placeholder="Motivo adicional..."
                                className="w-full p-2 border rounded-lg resize-none h-20"
                            />
                        </div>

                        <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-700">
                            ⚠️ O contato será bloqueado e o lead removido do Kanban.
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setBlacklistModal({ open: false, lead: null })}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={enviarParaBlacklist}
                            disabled={blacklistLoading}
                        >
                            {blacklistLoading ? 'Bloqueando...' : 'Confirmar Bloqueio'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
