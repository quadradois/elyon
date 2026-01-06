/**
 * Página Pública de Aceite de Contrato
 * Acessível sem autenticação via link único
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { Card, CardContent } from "../componentes/ui/card";
import { Check, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ContratoInfo {
    id: string;
    status: string;
    html: string;
    hash: string;
    geradoEm: string;
    aceiteEm: string | null;
    nomeImobiliaria: string;
    nomeProprietario: string;
    enderecoImovel: string;
}

export default function AceitarContrato() {
    const { token } = useParams<{ token: string }>();
    const [contrato, setContrato] = useState<ContratoInfo | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [aceitando, setAceitando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [sucesso, setSucesso] = useState(false);
    const [aceiteConfirmado, setAceiteConfirmado] = useState(false);

    // Carregar dados do contrato
    useEffect(() => {
        if (!token) return;

        const carregarContrato = async () => {
            try {
                const response = await fetch(`/api/contratos/${token}`);

                if (!response.ok) {
                    throw new Error("Contrato não encontrado");
                }

                const dados = await response.json();
                setContrato(dados);

                if (dados.status === "ACEITO") {
                    setAceiteConfirmado(true);
                }
            } catch (error) {
                setErro("Não foi possível carregar o contrato. Verifique se o link está correto.");
            } finally {
                setCarregando(false);
            }
        };

        carregarContrato();
    }, [token]);

    // Aceitar contrato
    const handleAceitar = async () => {
        if (!token || !contrato) return;

        setAceitando(true);
        setErro(null);

        try {
            const response = await fetch(`/api/contratos/${token}/aceitar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const dados = await response.json();

            if (!response.ok) {
                throw new Error(dados.erro || "Erro ao aceitar contrato");
            }

            setSucesso(true);
            setAceiteConfirmado(true);
        } catch (error: any) {
            setErro(error.message || "Erro ao processar aceite");
        } finally {
            setAceitando(false);
        }
    };

    // Loading state
    if (carregando) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg">
                    <CardContent className="py-12 text-center">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
                        <p className="text-slate-600">Carregando contrato...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (erro && !contrato) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg border-red-200">
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                        <h1 className="text-xl font-semibold text-red-700 mb-2">Contrato não encontrado</h1>
                        <p className="text-slate-600">{erro}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success state (já aceito ou aceite concluído)
    if (aceiteConfirmado) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-lg border-emerald-200">
                    <CardContent className="py-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 bg-emerald-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-emerald-700 mb-2">
                            Contrato Aceito!
                        </h1>

                        <p className="text-slate-600 mb-6">
                            {sucesso
                                ? "Obrigado por aceitar o contrato. Entraremos em contato para os próximos passos."
                                : "Este contrato já foi aceito anteriormente."}
                        </p>

                        <div className="bg-emerald-50 rounded-lg p-4 text-left">
                            <p className="text-sm text-emerald-800">
                                <strong>Proprietário:</strong> {contrato?.nomeProprietario}
                            </p>
                            <p className="text-sm text-emerald-800">
                                <strong>Imóvel:</strong> {contrato?.enderecoImovel}
                            </p>
                            <p className="text-sm text-emerald-800">
                                <strong>Imobiliária:</strong> {contrato?.nomeImobiliaria}
                            </p>
                        </div>

                        <div className="flex justify-center gap-4 mt-8">
                            <Button
                                variant="outline"
                                onClick={() => window.open(`/api/contratos/${token}/html`, '_blank')}
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Visualizar Contrato
                            </Button>
                        </div>

                        <p className="text-xs text-slate-500 mt-6">
                            Hash de verificação: {contrato?.hash}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Main contract view
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                    <h1 className="text-2xl font-bold text-slate-800">
                        Contrato de Autorização de Captação
                    </h1>
                    <p className="text-slate-600 mt-2">
                        {contrato?.nomeImobiliaria}
                    </p>
                </div>

                {/* Contract Preview */}
                <Card className="mb-6">
                    <CardContent className="p-0">
                        <iframe
                            src={`/api/contratos/${token}/html`}
                            className="w-full h-[600px] border-0"
                            title="Contrato"
                        />
                    </CardContent>
                </Card>

                {/* Error message */}
                {erro && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-700">{erro}</p>
                    </div>
                )}

                {/* Accept section */}
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="py-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-center md:text-left">
                                <h2 className="font-semibold text-slate-800">
                                    Você concorda com os termos acima?
                                </h2>
                                <p className="text-sm text-slate-600">
                                    Ao clicar em "Aceitar Contrato", você confirma que leu e aceita todas as cláusulas.
                                </p>
                            </div>

                            <Button
                                onClick={handleAceitar}
                                disabled={aceitando}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg min-w-[200px]"
                            >
                                {aceitando ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5 mr-2" />
                                        Aceitar Contrato
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center mt-8 text-sm text-slate-500">
                    <p>Este documento possui validade jurídica conforme Lei 14.063/2020</p>
                    <p className="mt-1">Hash: {contrato?.hash}</p>
                </div>
            </div>
        </div>
    );
}
