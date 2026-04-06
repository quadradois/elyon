/**
 * Card de Negociação Comercial (Fase 3 do Playbook)
 * Exibe: comissão, tipo de autorização, prazo de trabalho
 */

import { FileSignature, FileCheck, Clock, Percent } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { Badge } from "../../../componentes/ui/badge";
import type { Lead } from "../tipos";

interface CardNegociacaoProps {
    lead: Lead;
}

export function CardNegociacao({ lead }: CardNegociacaoProps) {
    const temDados = lead.comissaoAcordada || lead.tipoAutorizacao || lead.prazoTrabalho || lead.autorizouAnuncio !== null;

    if (!temDados) {
        return (
            <Card className="border-dashed border-slate-200 bg-gradient-to-br from-slate-50/50 to-white">
                <CardContent className="py-10 text-center">
                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full blur-xl opacity-60"></div>
                        <div className="relative w-14 h-14 bg-gradient-to-br from-amber-50 to-orange-50 rounded-full flex items-center justify-center border border-amber-100">
                            <FileSignature className="w-7 h-7 text-amber-500" />
                        </div>
                    </div>
                    <h4 className="text-base font-semibold text-slate-700 mb-1">Negociação Comercial</h4>
                    <p className="text-sm text-slate-500">Complete a Fase 3 do playbook para preencher</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-amber-500" />
                    Negociação Comercial
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    {lead.comissaoAcordada && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Percent className="w-3 h-3" /> Comissão
                            </p>
                            <p className="font-semibold text-lg text-emerald-600">{lead.comissaoAcordada}</p>
                        </div>
                    )}

                    {lead.tipoAutorizacao && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FileCheck className="w-3 h-3" /> Autorização
                            </p>
                            <Badge variant="outline" className={
                                lead.tipoAutorizacao === 'exclusiva'
                                    ? 'border-violet-500 text-violet-700 bg-violet-50'
                                    : 'border-slate-500 text-slate-700'
                            }>
                                {lead.tipoAutorizacao === 'exclusiva' ? '🔒 Exclusiva' : 'Simples'}
                            </Badge>
                        </div>
                    )}

                    {lead.prazoTrabalho && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Prazo
                            </p>
                            <p className="font-medium">{lead.prazoTrabalho} dias</p>
                        </div>
                    )}

                    {lead.autorizouAnuncio !== null && lead.autorizouAnuncio !== undefined && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Anúncio Autorizado</p>
                            <Badge className={
                                lead.autorizouAnuncio
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                            }>
                                {lead.autorizouAnuncio ? '✅ Sim' : '⏳ Pendente'}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
