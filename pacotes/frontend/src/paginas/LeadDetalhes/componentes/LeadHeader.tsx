/**
 * Header da página de detalhes do Lead
 * Contém nome, badges de status e ações rápidas
 */

import {
    ArrowLeft,
    Phone,
    Mail,
    Target,
    Copy,
    Edit,
    Plus,
    Trophy,
    MoreVertical,
    XOctagon,
    Archive,
    RotateCcw,
    RefreshCw,
    Bot,
} from "lucide-react";
import { Button } from "../../../componentes/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../../../componentes/ui/dropdown-menu";
import { statusConfig, temperaturaConfig } from "../constantes";
import { formatarTelefone, tempoRelativo } from "../utils";
import type { Lead } from "../tipos";

interface LeadHeaderProps {
    lead: Lead;
    salvando: boolean;
    isPerdidoOuArquivado: boolean;
    isCaptado: boolean;
    onVoltar: () => void;
    onEditar: () => void;
    onNovaAtividade: () => void;
    onCaptar: () => void;
    onMarcarPerdido: () => void;
    onArquivar: () => void;
    onReativar: () => void;
    onAtualizar: () => void;
    onCopiarTelefone: () => void;
    carregando?: boolean;
}

export function LeadHeader({
    lead,
    salvando,
    isPerdidoOuArquivado,
    isCaptado,
    onVoltar,
    onEditar,
    onNovaAtividade,
    onCaptar,
    onMarcarPerdido,
    onArquivar,
    onReativar,
    onAtualizar,
    onCopiarTelefone,
    carregando = false,
}: LeadHeaderProps) {
    const status = statusConfig[lead.status] || statusConfig.NOVO;
    const temperatura = temperaturaConfig[lead.temperatura] || temperaturaConfig.MORNO;

    return (
        <div className="flex items-center justify-between flex-wrap gap-4 p-4 -mx-4 -mt-4 mb-2 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onVoltar}
                    className="hover:bg-slate-100 rounded-full"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-900">{lead.nome}</h1>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all ${status.bgColor} ${status.color} ${isCaptado ? 'badge-pulse glow-success' : ''}`}>
                            {isCaptado && <Trophy className="w-3.5 h-3.5" />}
                            {status.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100/80 ${temperatura.color}`} title={`Temperatura: ${temperatura.label}`}>
                            {temperatura.icon}
                        </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                        {lead.telefone && (
                            <button
                                onClick={onCopiarTelefone}
                                className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors group"
                                title="Clique para copiar"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="font-medium">{formatarTelefone(lead.telefone)}</span>
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        )}
                        {lead.email && (
                            <span className="flex items-center gap-1.5">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-500">{lead.email}</span>
                            </span>
                        )}
                        {lead.origem && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-full text-xs">
                                <Target className="w-3.5 h-3.5 text-slate-400" />
                                {lead.origem}
                            </span>
                        )}
                        {lead.ultimaAcaoIA && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium" title={`Última ação: ${lead.ultimaAcaoIAEm ? tempoRelativo(lead.ultimaAcaoIAEm) : ''}`}>
                                <Bot className="w-3.5 h-3.5" />
                                {lead.ultimaAcaoIA}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Botão Reativar (para perdidos/arquivados) */}
                {isPerdidoOuArquivado && (
                    <Button variant="outline" onClick={onReativar} disabled={salvando} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reativar
                    </Button>
                )}

                {/* Ações normais */}
                {!isPerdidoOuArquivado && !isCaptado && (
                    <>
                        <Button variant="outline" onClick={onEditar} className="hover:border-slate-300">
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                        </Button>

                        <Button variant="outline" onClick={onNovaAtividade} className="hover:border-slate-300">
                            <Plus className="w-4 h-4 mr-2" />
                            Atividade
                        </Button>

                        <Button
                            onClick={onCaptar}
                            className="btn-success-premium border-0 px-5"
                        >
                            <Trophy className="w-4 h-4 mr-2" />
                            Captar
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                                    <MoreVertical className="w-5 h-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={onMarcarPerdido} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                    <XOctagon className="w-4 h-4 mr-2" />
                                    Marcar como Perdido
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={onArquivar} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                    <Archive className="w-4 h-4 mr-2" />
                                    Excluir Lead
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}

                <Button variant="ghost" size="icon" onClick={onAtualizar} title="Atualizar" className="hover:bg-slate-100 rounded-full">
                    <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
    );
}
