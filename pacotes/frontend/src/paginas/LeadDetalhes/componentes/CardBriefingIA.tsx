/**
 * CardBriefingIA — Dossiê gerado pelo agente IA no handoff para o Closer.
 * Exibido em destaque no topo da ficha do Lead.
 */

import { Bot, Flame, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { useState } from "react";
import type { Lead } from "../tipos";

interface CardBriefingIAProps {
    lead: Lead;
}

export function CardBriefingIA({ lead }: CardBriefingIAProps) {
    const [expandido, setExpandido] = useState(true);
    const marcadoresSecao = ["🏠", "🔥", "💢", "🎯", "📋", "⚡", "💰", "🚨", "🤝", "👤"];

    if (!lead.briefingCloser) return null;

    // Tenta extrair seções do briefing se ele usar o formato "🏠 ...\n🔥 ..."
    const linhas = lead.briefingCloser.split('\n').filter(l => l.trim());

    return (
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 shadow-md">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-violet-800">
                        <div className="p-1.5 bg-violet-100 rounded-lg border border-violet-200">
                            <Bot className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-base font-bold">Dossiê IA — Briefing para o Closer</p>
                            <p className="text-xs font-normal text-violet-500 mt-0.5">
                                Gerado automaticamente pelo agente após qualificação
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpandido(!expandido)}
                        className="p-1.5 rounded-lg hover:bg-violet-100 transition-colors text-violet-500"
                    >
                        {expandido
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        }
                    </button>
                </CardTitle>
            </CardHeader>

            {expandido && (
                <CardContent className="pt-0">
                    <div className="bg-white/70 rounded-xl p-4 border border-violet-100 space-y-1">
                        {linhas.map((linha, i) => {
                            // Detectar cabeçalhos de seção (linhas que começam com emoji ou ##)
                            const linhaNormalizada = linha.trim();
                            const isHeader =
                                linhaNormalizada.startsWith("#") ||
                                marcadoresSecao.some((marcador) => linhaNormalizada.startsWith(marcador));
                            return (
                                <p
                                    key={i}
                                    className={
                                        isHeader
                                            ? "text-sm font-bold text-violet-800 mt-3 first:mt-0 flex items-center gap-1"
                                            : "text-sm text-slate-700 leading-relaxed pl-2"
                                    }
                                >
                                    {linha}
                                </p>
                            );
                        })}
                    </div>

                    <div className="flex gap-3 mt-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-semibold text-amber-700">Atenção: leia antes de ligar</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 text-violet-500" />
                            <span className="text-xs font-semibold text-violet-700">Objeções mapeadas no dossiê</span>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
