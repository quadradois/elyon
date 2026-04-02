/**
 * Card de Contrato (Fase 4 do Playbook)
 * Exibe: URL do contrato, datas de assinatura e vigência
 * Permite: Gerar novo contrato quando não houver um pendente
 */

import { useState } from "react";
import { FileText, Calendar, ExternalLink, Download, Plus, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { Badge } from "../../../componentes/ui/badge";
import { Button } from "../../../componentes/ui/button";
import { formatarData } from "../utils";
import { api } from "../../../servicos/api";
import { toast } from "sonner";
import type { Lead } from "../tipos";

interface CardContratoProps {
    lead: Lead;
    onUpdate?: () => void;
}

export function CardContrato({ lead, onUpdate }: CardContratoProps) {
    const [gerando, setGerando] = useState(false);
    const [linkContrato, setLinkContrato] = useState<string | null>(null);

    const temContrato = lead.contratoUrl || lead.dataAssinatura;
    const temVigencia = lead.vigenciaInicio || lead.vigenciaFim;

    // Gerar novo contrato
    const handleGerarContrato = async () => {
        setGerando(true);
        try {
            const response = await api.post('/contratos/gerar', {
                leadId: lead.id,
                tipoContrato: 'CAPTACAO'
            });

            if (response.data.sucesso) {
                setLinkContrato(response.data.contrato.linkAceite);
                toast.success('Contrato gerado com sucesso!');
                onUpdate?.();
            } else {
                throw new Error(response.data.erro);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.erro || 'Erro ao gerar contrato');
        } finally {
            setGerando(false);
        }
    };

    // Copiar link do contrato
    const handleCopiarLink = () => {
        const link = linkContrato || lead.contratoUrl;
        if (link) {
            navigator.clipboard.writeText(link);
            toast.success('Link copiado! Envie ao proprietário.');
        }
    };

    // Enviar via WhatsApp
    const handleEnviarWhatsApp = () => {
        const link = linkContrato || lead.contratoUrl;
        if (link && lead.telefone) {
            const mensagem = encodeURIComponent(
                `Olá ${lead.nome}! 📄\n\nSegue o link para visualizar e aceitar nosso contrato de captação:\n\n${link}\n\nQualquer dúvida estou à disposição!`
            );
            const telefone = lead.telefone.replace(/\D/g, '');
            window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');
        }
    };

    // Só mostrar se o lead está em status relevante
    const statusRelevantes = ['TENTATIVA_AGENDAMENTO', 'DOCUMENTACAO', 'CAPTADO', 'CONVERTIDO', 'NOVO'];
    if (!statusRelevantes.includes(lead.status) && !temContrato) {
        return null;
    }

    // Estado: Nenhum contrato ainda - Botão para gerar
    if (!temContrato && !temVigencia && !linkContrato) {
        return (
            <Card className="border-dashed border-amber-200 bg-gradient-to-br from-amber-50/50 to-white overflow-hidden">
                <CardContent className="py-10 text-center relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full blur-3xl opacity-40 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full blur-xl opacity-60"></div>
                        <div className="relative w-14 h-14 bg-gradient-to-br from-amber-50 to-orange-50 rounded-full flex items-center justify-center border border-amber-200">
                            <FileText className="w-7 h-7 text-amber-500" />
                        </div>
                    </div>
                    <h4 className="text-base font-semibold text-amber-800 mb-1">Contrato Pendente</h4>
                    <p className="text-sm text-amber-600 mb-5 max-w-xs mx-auto">
                        Gere o contrato de captação para enviar ao proprietário
                    </p>
                    <Button
                        onClick={handleGerarContrato}
                        disabled={gerando}
                        className="btn-premium border-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                        {gerando ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Gerando...
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4 mr-2" />
                                Gerar Contrato
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Estado: Contrato gerado mas não assinado
    if (linkContrato && !lead.dataAssinatura) {
        return (
            <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Contrato Gerado
                        <Badge className="bg-blue-100 text-blue-700 ml-auto">⏳ Aguardando Aceite</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-600 mb-4">
                        Contrato pronto! Envie o link abaixo para o proprietário assinar digitalmente.
                    </p>

                    <div className="bg-white rounded-lg border border-blue-200 p-3 mb-4">
                        <p className="text-xs text-slate-500 mb-1">Link de aceite:</p>
                        <p className="text-sm text-blue-600 break-all font-mono">
                            {linkContrato}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopiarLink}
                            className="flex-1"
                        >
                            📋 Copiar Link
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleEnviarWhatsApp}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Enviar WhatsApp
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Estado: Contrato URL existe (pode ser link de aceite pendente ou assinado)
    return (
        <Card className={`${lead.dataAssinatura ? 'border-green-200 bg-green-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className={`w-5 h-5 ${lead.dataAssinatura ? 'text-green-600' : 'text-blue-600'}`} />
                    Contrato de Captação
                    {lead.dataAssinatura ? (
                        <Badge className="bg-green-100 text-green-700 ml-auto">✅ Assinado</Badge>
                    ) : (
                        <Badge className="bg-blue-100 text-blue-700 ml-auto">⏳ Aguardando</Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Datas */}
                    <div className="grid grid-cols-3 gap-4">
                        {lead.dataAssinatura && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Assinatura
                                </p>
                                <p className="font-medium text-sm">{formatarData(lead.dataAssinatura)}</p>
                            </div>
                        )}

                        {lead.vigenciaInicio && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Início</p>
                                <p className="font-medium text-sm">{formatarData(lead.vigenciaInicio)}</p>
                            </div>
                        )}

                        {lead.vigenciaFim && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Término</p>
                                <p className="font-medium text-sm">{formatarData(lead.vigenciaFim)}</p>
                            </div>
                        )}
                    </div>

                    {/* Link do contrato */}
                    {lead.contratoUrl && (
                        <div className={`flex items-center gap-2 pt-2 border-t ${lead.dataAssinatura ? 'border-green-200' : 'border-blue-200'}`}>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => window.open(lead.contratoUrl!, '_blank')}
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Visualizar Contrato
                            </Button>
                            {!lead.dataAssinatura && (
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => {
                                        if (lead.telefone) {
                                            const mensagem = encodeURIComponent(
                                                `Olá ${lead.nome}! 📄\n\nSegue o link para visualizar e aceitar nosso contrato:\n\n${lead.contratoUrl}\n\nQualquer dúvida estou à disposição!`
                                            );
                                            const telefone = lead.telefone.replace(/\D/g, '');
                                            window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');
                                        }
                                    }}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    // Abre a versão HTML em nova aba e dispara impressão
                                    const win = window.open(`/api/contratos/${linkContrato?.split('/').pop() || lead.contratoUrl?.split('/').pop()}/html`, '_blank');
                                    if (win) {
                                        win.onload = () => { win.print(); };
                                    }
                                }}
                                title="Imprimir / Salvar como PDF"
                            >
                                <Download className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
