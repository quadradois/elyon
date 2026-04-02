/**
 * Página de Detalhes do Lead - V3 (Refatorada)
 * 
 * Estrutura modular com componentes separados para melhor manutenção.
 * Alinhada ao Playbook de Captação MVP (4 Etapas).
 */

import { useState } from "react";
import {
    ArrowLeft,
    Loader2,
    AlertCircle,
    Calendar,
    Plus,
    Check,
    MessageSquare,
    Home,
    User,
    Clock,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Target,
    AlertTriangle,
    TrendingUp,
    Trophy,
    XOctagon,
    Save,
    Building2,
    Users,
} from "lucide-react";
import { Button } from "../../componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../componentes/ui/card";
import { Badge } from "../../componentes/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../componentes/ui/tabs";
import { Input } from "../../componentes/ui/input";
import { Textarea } from "../../componentes/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../componentes/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../componentes/ui/select";

// Hooks e utilidades
import { useLeadDetalhes } from "./hooks/useLeadDetalhes";
import { formatarData, formatarDataHora, tempoRelativo, formatarCNPJ } from "./utils";
import {
    statusAgendamentoConfig,
    tipoAtividadeConfig,
    motivosPerdaOptions,
    tipoAutorizacaoOptions,
    situacaoFinanceiraOptions,
    estadoConservacaoOptions,
    prazoTrabalhoOptions
} from "./constantes";

// Componentes
import {
    LeadHeader,
    BannersStatus,
    CardImovel,
    CardNegociacao,
    CardContrato,
    CardTrackingIA,
    InfoItem,
    FaseChecklist,
} from "./componentes";

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function LeadDetalhes() {
    const {
        lead,
        carregando,
        erro,
        salvando,
        formEditar,
        setFormEditar,
        formPerdido,
        setFormPerdido,
        formCaptado,
        setFormCaptado,
        formAtividade,
        setFormAtividade,
        carregarLead,
        salvarEdicao,
        marcarPerdido,
        marcarCaptado,
        arquivar,
        excluirComConfirmacao,
        reativar,
        criarAtividade,
        acaoAtividade,
        voltar,
        copiarTelefone,
        isPerdidoOuArquivado,
        isCaptado,
    } = useLeadDetalhes();

    // Modais
    const [modalEditar, setModalEditar] = useState(false);
    const [modalPerdido, setModalPerdido] = useState(false);
    const [modalCaptado, setModalCaptado] = useState(false);
    const [modalArquivar, setModalArquivar] = useState(false);
    const [modalAtividade, setModalAtividade] = useState(false);

    // Estado para modal de exclusão com confirmação
    const [dadosVinculados, setDadosVinculados] = useState<{
        conversas: number;
        mensagens: number;
        atividades: number;
        imoveis: number;
        contratos: number;
    } | null>(null);
    const [textoConfirmacao, setTextoConfirmacao] = useState('');
    const [mensagemExclusao, setMensagemExclusao] = useState('');

    // Handler para o botão de excluir
    const handleExcluir = async () => {
        const resultado = await arquivar();

        // Se retornou objeto com requiresConfirmation, mostra dados vinculados
        if (resultado && typeof resultado === 'object' && resultado.requiresConfirmation) {
            setDadosVinculados(resultado.dadosVinculados);
            setMensagemExclusao(resultado.mensagem);
        }
        // Se retornou true, fechou o modal e navegou
    };

    // Handler para confirmar exclusão
    const handleConfirmarExclusao = async () => {
        if (textoConfirmacao.toLowerCase() === 'excluir') {
            await excluirComConfirmacao();
            // O hook já navega de volta
        }
    };

    // Reset do modal ao fechar
    const handleFecharModalExcluir = (open: boolean) => {
        if (!open) {
            setDadosVinculados(null);
            setTextoConfirmacao('');
            setMensagemExclusao('');
        }
        setModalArquivar(open);
    };

    // Loading State
    if (carregando) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-slate-500">Carregando lead...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (erro || !lead) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <h3 className="text-lg font-medium text-slate-900">Erro ao carregar</h3>
                    <p className="text-slate-500">{erro || 'Lead não encontrado'}</p>
                    <Button variant="outline" onClick={voltar}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Leads
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <LeadHeader
                lead={lead}
                salvando={salvando}
                isPerdidoOuArquivado={isPerdidoOuArquivado}
                isCaptado={isCaptado}
                onVoltar={voltar}
                onEditar={() => setModalEditar(true)}
                onNovaAtividade={() => setModalAtividade(true)}
                onCaptar={() => setModalCaptado(true)}
                onMarcarPerdido={() => setModalPerdido(true)}
                onArquivar={() => setModalArquivar(true)}
                onReativar={reativar}
                onAtualizar={carregarLead}
                onCopiarTelefone={copiarTelefone}
                carregando={carregando}
            />

            {/* BANNERS DE STATUS */}
            <BannersStatus
                status={lead.status}
                isPerdidoOuArquivado={isPerdidoOuArquivado}
                isCaptado={isCaptado}
            />

            {/* CHECKLIST DE EXECUÇÃO */}
            <FaseChecklist lead={lead} />



            {/* CARD TRACKING IA */}
            <CardTrackingIA lead={lead} />

            {/* PRÓXIMA ATIVIDADE */}
            {lead.proximaAtividade && !isPerdidoOuArquivado && !isCaptado && (
                <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Calendar className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">{lead.proximaAtividade.titulo}</p>
                                    <p className="text-sm text-slate-600">
                                        {lead.proximaAtividade.agendadoPara
                                            ? formatarDataHora(lead.proximaAtividade.agendadoPara)
                                            : 'Sem data definida'}
                                        {lead.proximaAtividade.statusAgendamento && (
                                            <span className={`ml-2 px-2 py-0.5 rounded text-xs ${statusAgendamentoConfig[lead.proximaAtividade.statusAgendamento]?.color || ''}`}>
                                                {statusAgendamentoConfig[lead.proximaAtividade.statusAgendamento]?.label}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => acaoAtividade(lead.proximaAtividade!.id, 'nao_compareceu')}
                                >
                                    Não compareceu
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => acaoAtividade(lead.proximaAtividade!.id, 'completar')}
                                >
                                    <Check className="w-4 h-4 mr-1" />
                                    Realizada
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ============================================ */}
            {/* GRID PRINCIPAL */}
            {/* ============================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUNA ESQUERDA (2/3) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Card Imóvel */}
                    <CardImovel
                        lead={lead}
                        isPerdidoOuArquivado={isPerdidoOuArquivado}
                        isCaptado={isCaptado}
                        onEditar={() => setModalEditar(true)}
                    />

                    {/* Card Negociação (Fase 3) */}
                    <CardNegociacao lead={lead} />

                    {/* Card Contrato (Fase 4) */}
                    <CardContrato lead={lead} />

                    {/* Card Dados da Empresa (CNPJ) */}
                    {lead.cnpjEmpresa && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-slate-500" />
                                    Dados da Empresa
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-full">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Razão Social / Nome Fantasia</p>
                                        <p className="font-medium text-lg">{lead.empresaAtual || lead.nome}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">CNPJ</p>
                                        <p className="font-medium font-mono bg-slate-100 px-2 py-1 rounded inline-block text-sm">
                                            {formatarCNPJ(lead.cnpjEmpresa)}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Porte</p>
                                        <Badge variant="outline">{lead.setor || 'Não informado'}</Badge>
                                    </div>

                                    <div className="col-span-full">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Atividade Principal (CNAE)</p>
                                        <p className="font-medium text-sm text-slate-700">{lead.profissao || 'Não informado'}</p>
                                    </div>

                                    {lead.participacoesEmpresas && lead.participacoesEmpresas.length > 0 && (
                                        <div className="col-span-full mt-2 pt-4 border-t border-slate-100">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                                <Users className="w-3 h-3" /> Quadro Societário
                                            </p>
                                            <div className="space-y-2">
                                                {lead.participacoesEmpresas.map((socio, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                            <span className="text-sm font-medium">{socio.razaoSocial}</span>
                                                        </div>
                                                        <Badge variant="secondary" className="text-xs">{socio.participacao}</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* TABS SPIN */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Target className="w-5 h-5 text-slate-500" />
                                Qualificação SPIN
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="implicacao" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="situacao" className="text-xs sm:text-sm">Situação</TabsTrigger>
                                    <TabsTrigger value="problema" className="text-xs sm:text-sm">Problema</TabsTrigger>
                                    <TabsTrigger value="implicacao" className="text-xs sm:text-sm">Implicação</TabsTrigger>
                                    <TabsTrigger value="necessidade" className="text-xs sm:text-sm">Necessidade</TabsTrigger>
                                </TabsList>

                                <TabsContent value="situacao" className="mt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InfoItem label="Situação Atual" value={lead.spin.situacao.situacaoAtual} icon={<User className="w-4 h-4" />} />
                                        <InfoItem label="Tempo para Decisão" value={lead.spin.situacao.tempoDecisao} icon={<Clock className="w-4 h-4" />} />
                                        <InfoItem label="Tentativas Anteriores" value={lead.spin.situacao.tentativasAnteriores} icon={<RefreshCw className="w-4 h-4" />} />
                                        <InfoItem
                                            label="Com Corretor Atualmente"
                                            value={lead.spin.situacao.comCorretorAtualmente === null ? null : lead.spin.situacao.comCorretorAtualmente ? 'Sim' : 'Não'}
                                            icon={lead.spin.situacao.comCorretorAtualmente ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="problema" className="mt-4 space-y-4">
                                    <InfoItem label="Motivação da Venda" value={lead.spin.problema.motivacaoVenda} icon={<AlertTriangle className="w-4 h-4" />} fullWidth />
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Dores Identificadas</p>
                                        {lead.spin.problema.doresIdentificadas.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {lead.spin.problema.doresIdentificadas.map((dor, i) => (
                                                    <Badge key={i} variant="secondary" className="bg-red-50 text-red-700">{dor}</Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 text-sm">Nenhuma dor identificada</p>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="implicacao" className="mt-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InfoItem label="Prazo Desejado" value={lead.spin.implicacao.prazoDesejado} icon={<Calendar className="w-4 h-4" />} />
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Urgência</p>
                                            {lead.spin.implicacao.urgencia ? (
                                                <Badge className={
                                                    lead.spin.implicacao.urgencia === 'ALTA' ? 'bg-red-100 text-red-700' :
                                                        lead.spin.implicacao.urgencia === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-green-100 text-green-700'
                                                }>
                                                    {lead.spin.implicacao.urgencia}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400">Não informado</span>
                                            )}
                                        </div>
                                    </div>
                                    <InfoItem label="Consequências de Não Vender" value={lead.spin.implicacao.consequencias} icon={<TrendingUp className="w-4 h-4" />} fullWidth />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InfoItem label="Custos Atuais" value={lead.spin.implicacao.custosAtuais} icon={<AlertTriangle className="w-4 h-4" />} />
                                        <InfoItem label="Pressão de Tempo" value={lead.spin.implicacao.pressaoTempo} icon={<Clock className="w-4 h-4" />} />
                                    </div>
                                </TabsContent>

                                <TabsContent value="necessidade" className="mt-4 space-y-4">
                                    <InfoItem label="Expectativa do Serviço" value={lead.spin.necessidade.expectativaServico} icon={<Target className="w-4 h-4" />} fullWidth />
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Objeções</p>
                                        {lead.spin.necessidade.objecoes.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {lead.spin.necessidade.objecoes.map((obj, i) => (
                                                    <Badge key={i} variant="secondary" className="bg-orange-50 text-orange-700">{obj}</Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 text-sm">Nenhuma objeção registrada</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Interesse em Avaliação</p>
                                        {lead.spin.necessidade.interesseAvaliacao === null ? (
                                            <span className="text-slate-400">Não informado</span>
                                        ) : lead.spin.necessidade.interesseAvaliacao ? (
                                            <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Sim</Badge>
                                        ) : (
                                            <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Não</Badge>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {lead.spin.observacoes && (
                                <div className="mt-6 pt-4 border-t">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Observações Gerais</p>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{lead.spin.observacoes}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* COLUNA DIREITA (1/3) */}
                <div className="space-y-6">

                    {/* Info Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Informações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Origem</p>
                                <p className="font-medium">{lead.origem || 'Não informado'}</p>
                            </div>
                            {lead.campanhaOrigem && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Campanha</p>
                                    <p className="font-medium">{lead.campanhaOrigem.nome}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Primeiro Contato</p>
                                <p className="font-medium">{lead.primeiroContato ? formatarData(lead.primeiroContato) : 'Não registrado'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Última Interação</p>
                                <p className="font-medium">{lead.ultimaInteracao ? tempoRelativo(lead.ultimaInteracao) : 'Nenhuma'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Criado em</p>
                                <p className="font-medium">{formatarData(lead.criadoEm)}</p>
                            </div>
                            {lead.motivoPerda && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-red-500 uppercase tracking-wider mb-1">Motivo da Perda</p>
                                    <p className="font-medium text-red-600">{lead.motivoPerda}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline de Atividades */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Atividades</CardTitle>
                                {!isPerdidoOuArquivado && !isCaptado && (
                                    <Button size="sm" variant="ghost" onClick={() => setModalAtividade(true)}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {lead.atividades.length > 0 ? (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {lead.atividades.map((atividade, index) => {
                                        const tipoConfig = tipoAtividadeConfig[atividade.tipo] || tipoAtividadeConfig.OUTRO;
                                        const statusAg = atividade.statusAgendamento ? statusAgendamentoConfig[atividade.statusAgendamento] : null;

                                        return (
                                            <div key={atividade.id} className="relative group">
                                                {index < lead.atividades.length - 1 && (
                                                    <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-slate-200" />
                                                )}
                                                <div className="flex gap-3">
                                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center ${tipoConfig.color}`}>
                                                        {tipoConfig.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pb-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm text-slate-900">{atividade.titulo}</p>
                                                                {atividade.descricao && (
                                                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{atividade.descricao}</p>
                                                                )}
                                                            </div>
                                                            {statusAg && (
                                                                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded ${statusAg.color}`}>
                                                                    {statusAg.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            {atividade.agendadoPara ? formatarDataHora(atividade.agendadoPara) : formatarDataHora(atividade.criadoEm)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-500">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm">Nenhuma atividade registrada</p>
                                    {!isPerdidoOuArquivado && !isCaptado && (
                                        <Button size="sm" variant="outline" className="mt-3" onClick={() => setModalAtividade(true)}>
                                            <Plus className="w-4 h-4 mr-1" />
                                            Criar Atividade
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Conversas */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Conversas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {lead.conversas.length > 0 ? (
                                <div className="space-y-3">
                                    {lead.conversas.map((conversa) => (
                                        <div
                                            key={conversa.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                                    <MessageSquare className="w-4 h-4 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{conversa.canal}</p>
                                                    <p className="text-xs text-slate-500">{conversa.mensagens.length} mensagens</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400">{tempoRelativo(conversa.iniciadaEm)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-500">
                                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm">Nenhuma conversa registrada</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ============================================ */}
            {/* MODAIS */}
            {/* ============================================ */}

            {/* Modal Editar */}
            <Dialog open={modalEditar} onOpenChange={setModalEditar}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Lead</DialogTitle>
                        <DialogDescription>Atualize as informações do lead e do imóvel</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Dados básicos */}
                        <div>
                            <label className="text-sm font-medium">Nome</label>
                            <Input value={formEditar.nome || ''} onChange={(e) => setFormEditar({ ...formEditar, nome: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Telefone</label>
                                <Input value={formEditar.telefone || ''} onChange={(e) => setFormEditar({ ...formEditar, telefone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Email</label>
                                <Input value={formEditar.email || ''} onChange={(e) => setFormEditar({ ...formEditar, email: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Temperatura</label>
                            <Select value={formEditar.temperatura} onValueChange={(v) => setFormEditar({ ...formEditar, temperatura: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="QUENTE">🔥 Quente</SelectItem>
                                    <SelectItem value="MORNO">🌤️ Morno</SelectItem>
                                    <SelectItem value="FRIO">❄️ Frio</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Dados do imóvel */}
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Home className="w-4 h-4" /> Dados do Imóvel
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Endereço do Imóvel</label>
                            <Input value={formEditar.enderecoImovel || ''} onChange={(e) => setFormEditar({ ...formEditar, enderecoImovel: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Tipo de Imóvel</label>
                                <Input value={formEditar.tipoImovel || ''} onChange={(e) => setFormEditar({ ...formEditar, tipoImovel: e.target.value })} placeholder="Apartamento, Casa..." />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Valor Pretendido</label>
                                <Input type="number" value={formEditar.valorPretendido || ''} onChange={(e) => setFormEditar({ ...formEditar, valorPretendido: Number(e.target.value) })} />
                            </div>
                        </div>

                        {/* Dados de qualificação (novos campos) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Situação Financeira</label>
                                <Select value={formEditar.situacaoFinanceira || ''} onValueChange={(v) => setFormEditar({ ...formEditar, situacaoFinanceira: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {situacaoFinanceiraOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Estado de Conservação</label>
                                <Select value={formEditar.estadoConservacao || ''} onValueChange={(v) => setFormEditar({ ...formEditar, estadoConservacao: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {estadoConservacaoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Dados de negociação (novos campos) */}
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4" /> Negociação Comercial
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Comissão Acordada</label>
                                <Input value={formEditar.comissaoAcordada || ''} onChange={(e) => setFormEditar({ ...formEditar, comissaoAcordada: e.target.value })} placeholder="Ex: 6%" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Tipo de Autorização</label>
                                <Select value={formEditar.tipoAutorizacao || ''} onValueChange={(v) => setFormEditar({ ...formEditar, tipoAutorizacao: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {tipoAutorizacaoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Prazo de Trabalho</label>
                                <Select value={formEditar.prazoTrabalho?.toString() || ''} onValueChange={(v) => setFormEditar({ ...formEditar, prazoTrabalho: Number(v) })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {prazoTrabalhoOptions.map(o => <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input
                                    type="checkbox"
                                    id="autorizouAnuncio"
                                    checked={formEditar.autorizouAnuncio || false}
                                    onChange={(e) => setFormEditar({ ...formEditar, autorizouAnuncio: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300"
                                />
                                <label htmlFor="autorizouAnuncio" className="text-sm font-medium">Autorizou Anúncio</label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
                        <Button onClick={async () => { if (await salvarEdicao()) setModalEditar(false); }} disabled={salvando}>
                            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Perdido */}
            <Dialog open={modalPerdido} onOpenChange={setModalPerdido}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XOctagon className="w-5 h-5" />
                            Marcar como Perdido
                        </DialogTitle>
                        <DialogDescription>Registre o motivo para análise futura</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Motivo</label>
                            <Select value={formPerdido.motivo} onValueChange={(v) => setFormPerdido({ ...formPerdido, motivo: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                                <SelectContent>
                                    {motivosPerdaOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Observações (opcional)</label>
                            <Textarea value={formPerdido.observacoes} onChange={(e) => setFormPerdido({ ...formPerdido, observacoes: e.target.value })} placeholder="Detalhes adicionais..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalPerdido(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={async () => { if (await marcarPerdido()) setModalPerdido(false); }} disabled={salvando || !formPerdido.motivo}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Confirmar Perda
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Captado */}
            <Dialog open={modalCaptado} onOpenChange={setModalCaptado}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <Trophy className="w-5 h-5" />
                            Registrar Captação
                        </DialogTitle>
                        <DialogDescription>Parabéns! Registre os detalhes da captação</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Tipo de Contrato</label>
                            <Select value={formCaptado.tipoContrato} onValueChange={(v) => setFormCaptado({ ...formCaptado, tipoContrato: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="VENDA_EXCLUSIVA">Venda Exclusiva</SelectItem>
                                    <SelectItem value="VENDA_COMPARTILHADA">Venda Compartilhada</SelectItem>
                                    <SelectItem value="LOCACAO_EXCLUSIVA">Locação Exclusiva</SelectItem>
                                    <SelectItem value="LOCACAO_COMPARTILHADA">Locação Compartilhada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Valor do Contrato (R$)</label>
                            <Input type="number" value={formCaptado.valorContrato} onChange={(e) => setFormCaptado({ ...formCaptado, valorContrato: e.target.value })} placeholder="500000" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Observações (opcional)</label>
                            <Textarea value={formCaptado.observacoes} onChange={(e) => setFormCaptado({ ...formCaptado, observacoes: e.target.value })} placeholder="Detalhes do fechamento..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalCaptado(false)}>Cancelar</Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={async () => { if (await marcarCaptado()) setModalCaptado(false); }} disabled={salvando}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            🎉 Confirmar Captação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Excluir - Com confirmação segura */}
            <Dialog open={modalArquivar} onOpenChange={handleFecharModalExcluir}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Excluir Lead Permanentemente
                        </DialogTitle>
                    </DialogHeader>

                    {/* Se tem dados vinculados, mostra os detalhes */}
                    {dadosVinculados ? (
                        <div className="space-y-4 py-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-800 font-medium mb-3">
                                    {mensagemExclusao}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {dadosVinculados.conversas > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Conversas:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.conversas}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.mensagens > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Mensagens:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.mensagens}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.atividades > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Atividades:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.atividades}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.contratos > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Contratos:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.contratos}</span>
                                        </div>
                                    )}
                                    {dadosVinculados.imoveis > 0 && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-red-100">
                                            <span className="text-slate-600">Imóveis:</span>
                                            <span className="font-semibold text-red-600">{dadosVinculados.imoveis}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-slate-600">
                                    Para confirmar a exclusão permanente, digite <strong className="text-red-600">excluir</strong> abaixo:
                                </p>
                                <Input
                                    placeholder="Digite 'excluir' para confirmar"
                                    value={textoConfirmacao}
                                    onChange={(e) => setTextoConfirmacao(e.target.value)}
                                    className="border-red-200 focus:border-red-400 focus:ring-red-400"
                                />
                            </div>
                        </div>
                    ) : (
                        <DialogDescription className="py-4">
                            <span className="text-red-600 font-semibold">ATENÇÃO: Esta ação é irreversível!</span>
                            <br /><br />
                            O lead será excluído permanentemente do sistema.
                        </DialogDescription>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleFecharModalExcluir(false)}>
                            Cancelar
                        </Button>
                        {dadosVinculados ? (
                            <Button
                                variant="destructive"
                                onClick={handleConfirmarExclusao}
                                disabled={salvando || textoConfirmacao.toLowerCase() !== 'excluir'}
                            >
                                {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                🗑️ Confirmar Exclusão
                            </Button>
                        ) : (
                            <Button variant="destructive" onClick={handleExcluir} disabled={salvando}>
                                {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                🗑️ Excluir Permanentemente
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Nova Atividade */}
            <Dialog open={modalAtividade} onOpenChange={setModalAtividade}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Atividade</DialogTitle>
                        <DialogDescription>Crie uma atividade ou agendamento</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Tipo</label>
                            <Select value={formAtividade.tipo} onValueChange={(v) => setFormAtividade({ ...formAtividade, tipo: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LIGACAO">📞 Ligação</SelectItem>
                                    <SelectItem value="AVALIACAO">🏠 Avaliação</SelectItem>
                                    <SelectItem value="REUNIAO">👥 Reunião</SelectItem>
                                    <SelectItem value="FOLLOW_UP">🔄 Follow-up</SelectItem>
                                    <SelectItem value="TAREFA">✅ Tarefa</SelectItem>
                                    <SelectItem value="NOTA">📝 Nota</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Título</label>
                            <Input value={formAtividade.titulo} onChange={(e) => setFormAtividade({ ...formAtividade, titulo: e.target.value })} placeholder="Ex: Ligar para confirmar interesse" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Descrição (opcional)</label>
                            <Textarea value={formAtividade.descricao} onChange={(e) => setFormAtividade({ ...formAtividade, descricao: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Data/Hora (opcional)</label>
                            <Input type="datetime-local" value={formAtividade.agendadoPara} onChange={(e) => setFormAtividade({ ...formAtividade, agendadoPara: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalAtividade(false)}>Cancelar</Button>
                        <Button onClick={async () => { if (await criarAtividade()) setModalAtividade(false); }} disabled={salvando || !formAtividade.titulo}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Criar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
