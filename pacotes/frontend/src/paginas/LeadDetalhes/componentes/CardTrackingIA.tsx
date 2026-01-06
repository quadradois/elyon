/**
 * Card de Tracking da IA
 * Exibe a última ação realizada pela IA neste lead
 */

import { Bot, Clock, MessageSquare, Phone, Calendar, RefreshCw } from "lucide-react";
import { Card, CardContent } from "../../../componentes/ui/card";
import { tempoRelativo } from "../utils";
import type { Lead } from "../tipos";

interface CardTrackingIAProps {
    lead: Lead;
}

export function CardTrackingIA({ lead }: CardTrackingIAProps) {
    if (!lead.ultimaAcaoIA) {
        return null;
    }

    // Determinar ícone baseado no tipo de ação
    const getIconeAcao = (acao: string) => {
        const acaoLower = acao.toLowerCase();
        if (acaoLower.includes('mensagem') || acaoLower.includes('enviou')) {
            return <MessageSquare className="w-4 h-4" />;
        }
        if (acaoLower.includes('ligação') || acaoLower.includes('ligar')) {
            return <Phone className="w-4 h-4" />;
        }
        if (acaoLower.includes('agendou') || acaoLower.includes('visita')) {
            return <Calendar className="w-4 h-4" />;
        }
        if (acaoLower.includes('follow')) {
            return <RefreshCw className="w-4 h-4" />;
        }
        return <Bot className="w-4 h-4" />;
    };

    return (
        <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50">
            <CardContent className="py-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 rounded-lg">
                        <Bot className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-violet-600 uppercase tracking-wider">
                                Última Ação da IA
                            </span>
                            {lead.ultimaAcaoIAEm && (
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {tempoRelativo(lead.ultimaAcaoIAEm)}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-2 mt-0.5">
                            {getIconeAcao(lead.ultimaAcaoIA)}
                            {lead.ultimaAcaoIA}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
