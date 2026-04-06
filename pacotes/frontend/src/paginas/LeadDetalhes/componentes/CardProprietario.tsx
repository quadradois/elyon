/**
 * CardProprietario — Dados pessoais do proprietário (Assertiva) na ficha do Lead.
 * Exibe: CPF, idade, sexo, renda, score Assertiva, múltiplos telefones e emails.
 */

import {
    User,
    Phone,
    Mail,
    Briefcase,
    Sparkles,
    MessageSquare,
    Copy,
    Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { formatarTelefone } from "../utils";
import type { Lead } from "../tipos";

interface CardProprietarioProps {
    lead: Lead;
}

const formatarMoedaRenda = (valor: string | null | undefined): string => {
    if (!valor) return "–";
    const num = parseFloat(valor);
    if (isNaN(num)) return valor;
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(num);
};

export function CardProprietario({ lead }: CardProprietarioProps) {
    const [copiado, setCopiado] = useState<string | null>(null);

    const temDadosPessoais = lead.idade || lead.sexo || lead.rendaEstimada || lead.scoreAssertiva;
    const temDadosProfissionais = lead.profissao || lead.empresaAtual || lead.faixaSalarial;
    const telefonesExtras = [lead.telefone2, lead.telefone3].filter(Boolean);
    const emailsExtras = [lead.email2].filter(Boolean);

    const copiar = async (texto: string, tipo: string) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(tipo);
            toast.success(`${tipo} copiado`);
            setTimeout(() => setCopiado(null), 2000);
        } catch {
            toast.error("Não foi possível copiar");
        }
    };

    if (!temDadosPessoais && !temDadosProfissionais && telefonesExtras.length === 0) {
        return null;
    }

    return (
        <Card className="border-slate-200">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-slate-500" />
                    Perfil do Proprietário
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

                {/* Score Assertiva */}
                {lead.scoreAssertiva && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-indigo-100">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                <p className="text-sm font-semibold text-indigo-900">Score Assertiva</p>
                            </div>
                            <span className="text-2xl font-black text-brand">{lead.scoreAssertiva}</span>
                        </div>
                        <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, lead.scoreAssertiva)}%` }}
                            />
                        </div>
                        <p className="text-xs text-brand mt-1.5">
                            {lead.scoreAssertiva >= 80
                                ? "✓ Dados confiáveis"
                                : lead.scoreAssertiva >= 50
                                ? "⚠ Verificar dados"
                                : "✗ Dados incompletos"}
                        </p>
                    </div>
                )}

                {/* Dados Pessoais */}
                {temDadosPessoais && (
                    <div className="grid grid-cols-2 gap-3">
                        {lead.idade && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                <p className="text-2xl font-bold text-slate-900">{lead.idade}</p>
                                <p className="text-xs text-slate-500 mt-0.5">anos</p>
                            </div>
                        )}
                        {lead.sexo && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                                <p className="text-sm font-semibold text-slate-900">{lead.sexo}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Gênero</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Dados Profissionais */}
                {temDadosProfissionais && (
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-3">
                            <Briefcase className="w-4 h-4 text-indigo-500" />
                            <p className="text-sm font-semibold text-indigo-900">Dados Profissionais</p>
                        </div>
                        <div className="space-y-2">
                            {lead.empresaAtual && (
                                <div>
                                    <p className="text-xs text-indigo-500 uppercase tracking-wide">Empresa</p>
                                    <p className="text-sm font-medium text-indigo-900">{lead.empresaAtual}</p>
                                </div>
                            )}
                            {lead.profissao && (
                                <div>
                                    <p className="text-xs text-indigo-500 uppercase tracking-wide">Profissão</p>
                                    <p className="text-sm text-indigo-800">{lead.profissao}</p>
                                </div>
                            )}
                            {lead.rendaEstimada && (
                                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 mt-2">
                                    <p className="text-xs text-emerald-600 uppercase tracking-wide mb-0.5">Renda Estimada</p>
                                    <p className="text-xl font-bold text-emerald-700">
                                        {formatarMoedaRenda(lead.rendaEstimada)}
                                    </p>
                                    {lead.faixaSalarial && (
                                        <p className="text-xs text-emerald-600 mt-1">{lead.faixaSalarial}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Telefones Extras */}
                {telefonesExtras.length > 0 && (
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" /> Outros Telefones
                        </p>
                        <div className="space-y-2">
                            {telefonesExtras.map((tel, i) => (
                                <div
                                    key={i}
                                    className="group flex items-center justify-between p-2.5 bg-emerald-50 rounded-lg border border-emerald-100 hover:border-emerald-200 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-900">
                                            {formatarTelefone(tel!)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => window.open(`https://wa.me/55${tel!.replace(/\D/g, "")}`, "_blank")}
                                            className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                            title="Abrir no WhatsApp"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => copiar(tel!, "Telefone")}
                                            className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                            title="Copiar"
                                        >
                                            {copiado === "Telefone" ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Emails Extras */}
                {emailsExtras.length > 0 && (
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" /> Emails Adicionais
                        </p>
                        <div className="space-y-2">
                            {emailsExtras.map((email, i) => (
                                <div
                                    key={i}
                                    className="group flex items-center justify-between p-2.5 bg-violet-50 rounded-lg border border-violet-100 hover:border-violet-200 transition-colors"
                                >
                                    <span className="text-sm font-medium text-slate-900 truncate flex-1">{email}</span>
                                    <button
                                        onClick={() => copiar(email!, "Email")}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-violet-100 transition-all flex-shrink-0"
                                    >
                                        {copiado === "Email" ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
