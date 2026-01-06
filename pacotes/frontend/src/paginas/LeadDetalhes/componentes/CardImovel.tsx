/**
 * Card com dados do imóvel para captação
 */

import { Home, MapPin, Building2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { Badge } from "../../../componentes/ui/badge";
import { Button } from "../../../componentes/ui/button";
import { formatarMoeda } from "../utils";
import type { Lead } from "../tipos";

interface CardImovelProps {
    lead: Lead;
    isPerdidoOuArquivado: boolean;
    isCaptado: boolean;
    onEditar: () => void;
}

export function CardImovel({ lead, isPerdidoOuArquivado, isCaptado, onEditar }: CardImovelProps) {
    const temDados = lead.imovel.endereco || lead.imovel.tipo || lead.imovel.interesseEm;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Home className="w-5 h-5 text-slate-500" />
                    Imóvel para Captação
                </CardTitle>
            </CardHeader>
            <CardContent>
                {temDados ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {lead.imovel.endereco && (
                            <div className="col-span-2 md:col-span-3">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Endereço</p>
                                <p className="font-medium flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    {lead.imovel.endereco}
                                </p>
                            </div>
                        )}

                        {lead.imovel.interesseEm && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Interesse em</p>
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                    {lead.imovel.interesseEm}
                                </Badge>
                            </div>
                        )}

                        {lead.imovel.tipo && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tipo</p>
                                <p className="font-medium">{lead.imovel.tipo}</p>
                            </div>
                        )}

                        {lead.imovel.area && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Área</p>
                                <p className="font-medium">{lead.imovel.area} m²</p>
                            </div>
                        )}

                        {lead.imovel.quartos && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Quartos</p>
                                <p className="font-medium">{lead.imovel.quartos}</p>
                            </div>
                        )}

                        {lead.imovel.vagas && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Vagas</p>
                                <p className="font-medium">{lead.imovel.vagas}</p>
                            </div>
                        )}

                        {lead.imovel.valorPretendido && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Valor Pretendido</p>
                                <p className="font-medium text-emerald-600">{formatarMoeda(lead.imovel.valorPretendido)}</p>
                            </div>
                        )}

                        {lead.imovel.ocupacao && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ocupação</p>
                                <p className="font-medium">{lead.imovel.ocupacao}</p>
                            </div>
                        )}

                        {/* Novos campos do playbook */}
                        {lead.estadoConservacao && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Conservação</p>
                                <Badge variant="outline" className={
                                    lead.estadoConservacao === 'excelente' ? 'border-green-500 text-green-700' :
                                        lead.estadoConservacao === 'bom' ? 'border-blue-500 text-blue-700' :
                                            'border-orange-500 text-orange-700'
                                }>
                                    {lead.estadoConservacao === 'excelente' ? 'Excelente' :
                                        lead.estadoConservacao === 'bom' ? 'Bom' : 'Precisa reforma'}
                                </Badge>
                            </div>
                        )}

                        {lead.situacaoFinanceira && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Situação</p>
                                <Badge variant="outline">
                                    {lead.situacaoFinanceira === 'quitado' ? 'Quitado' : 'Financiado'}
                                </Badge>
                            </div>
                        )}

                        {lead.temDividas !== null && lead.temDividas !== undefined && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Dívidas</p>
                                <Badge variant={lead.temDividas ? "destructive" : "secondary"} className={
                                    lead.temDividas ? '' : 'bg-green-100 text-green-700'
                                }>
                                    {lead.temDividas ? 'Possui dívidas' : 'Sem dívidas'}
                                </Badge>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <div className="relative inline-block mb-4">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-full blur-xl opacity-60"></div>
                            <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-full flex items-center justify-center border border-indigo-100">
                                <Building2 className="w-8 h-8 text-indigo-400" />
                            </div>
                        </div>
                        <h4 className="text-base font-semibold text-slate-700 mb-1">
                            Vamos começar?
                        </h4>
                        <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">
                            Adicione as informações do imóvel para avançar no processo de captação
                        </p>
                        {!isPerdidoOuArquivado && !isCaptado && (
                            <Button
                                size="sm"
                                className="btn-premium border-0"
                                onClick={onEditar}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar Dados do Imóvel
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
