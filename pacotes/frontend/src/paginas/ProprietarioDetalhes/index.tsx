import { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, MessageSquare,
  Copy, Check, Loader2, AlertCircle, FileText, User, Bot, Pause,
  Briefcase, Home, Shield, Activity, Target, Sparkles, Users,
  Rocket, Link2, CheckCircle2, RefreshCw, CalendarPlus,
  AlertTriangle, HelpCircle, ClipboardCheck, MoreVertical,
  BellOff, ShieldBan, UserMinus, Trash2,
} from 'lucide-react';
import { Button } from '../../componentes/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../componentes/ui/dropdown-menu';
import { Textarea } from '../../componentes/ui/textarea';
import { Input } from '../../componentes/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../componentes/ui/card';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '../../componentes/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../componentes/ui/select';
import { api } from '../../servicos/api';
import { toast } from 'sonner';
import { useProprietarioDetalhes } from './hooks/useProprietarioDetalhes';
import { CardNegociacao, CardContrato, CardTrackingIA, CardBriefingIA, FaseChecklist } from '../LeadDetalhes/componentes';
// DUP-FIX: formatadores e extratores importados do utilitário compartilhado
import {
  limparTexto, normalizarLista,
  formatarTelefone, formatarCpf, formatarMoeda,
  formatarDataCurta, formatarDataHora, formatarTipoImovel,
  extrairTelefones, extrairEmails, urlWhatsApp,
  type TelefoneItem, type EmailItem,
} from '../../lib/formatters';

const ChatModal = lazy(() => import('../../componentes/ChatModal').then((m) => ({ default: m.ChatModal })));

type TabType = 'atendimento' | 'proprietario' | 'imovel' | 'qualificacao' | 'negociacao' | 'contrato' | 'atividades';

// DEAD-CODE-FIX: removido 'LEAD' que nunca é atingido (statusProspeccao não tem valor 'LEAD')
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  AGUARDANDO:   { label: 'Aguardando',  color: 'text-slate-600',   bg: 'bg-slate-100'   },
  CONTATANDO:   { label: 'Contatando',  color: 'text-indigo-700',  bg: 'bg-indigo-50'   },
  RESPONDEU:    { label: 'Respondeu',   color: 'text-emerald-700', bg: 'bg-emerald-50'  },
  INTERESSADO:  { label: 'Interessado', color: 'text-violet-700',  bg: 'bg-violet-50'   },
  SEM_INTERESSE:{ label: 'Sem interesse', color: 'text-slate-500', bg: 'bg-slate-100'   },
  OPT_OUT:      { label: 'Opt-out',     color: 'text-red-600',     bg: 'bg-red-50'      },
  FALHA:        { label: 'Falha',       color: 'text-orange-600',  bg: 'bg-orange-50'   },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProprietarioDetalhes() {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useProprietarioDetalhes();

  const [activeTab, setActiveTab]             = useState<TabType>('atendimento');
  const [alternandoModo, setAlternandoModo]   = useState(false);
  const [promovendo, setPromovendo]           = useState(false);
  const [copiado, setCopiado]                 = useState<string | null>(null);
  const [chatOpen, setChatOpen]               = useState(false);
  const [processandoCrm, setProcessandoCrm]   = useState<null | 'status' | 'enviar' | 'reenviar'>(null);
  const [resumoCrm, setResumoCrm]             = useState<string>('');
  const [modalAtividade, setModalAtividade]   = useState(false);
  const [salvandoAtividade, setSalvandoAtividade] = useState(false);
  const [formAtividade, setFormAtividade] = useState({
    tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '', resultado: '',
  });

  const [processandoGestao, setProcessandoGestao] = useState(false);
  // DEAD-CODE-FIX: removido 'desativar' do type — nunca era settado, era um placeholder esquecido
  const [confirmGestao, setConfirmGestao] = useState<null | 'blacklist' | 'removerLead' | 'excluir'>(null);

  const campanha = dados?.campanha;
  const lead     = dados?.lead;
  const contato  = dados?.contato;

  // BUG-FIX: virouLead agora vem calculado do backend no endpoint de detalhe
  const virouLead           = !!contato?.virouLead;
  const podeGerenciarContato = !!campanha?.id && !!contato?.id;
  const podeExcluirLeadManual = !podeGerenciarContato && !!lead?.id;
  const nome       = limparTexto(contato?.nome) || limparTexto(lead?.nome) || 'Proprietário';
  const temLeadReal = !!lead;

  const leadVisual = useMemo(() => {
    if (!lead && !contato) return null;
    if (lead) {
      return {
        ...lead,
        imovel:     lead.imovel || {},
        atividades: dados?.atividades || lead.atividades || [],
        conversas:  dados?.conversas  || lead.conversas  || [],
      };
    }
    // Fallback para contato puro (sem lead CRM ainda)
    return {
      id: contato!.id,
      nome: contato!.nome,
      telefone: limparTexto(contato!.telefone),
      email:    limparTexto(contato!.email),
      cpf:      limparTexto(contato!.cpf),
      idade:    contato!.idade,
      sexo:     limparTexto(contato!.sexo),
      imovel: {
        endereco:  limparTexto(contato!.enderecoImovel),
        tipo:      limparTexto(contato!.tipoImovel),
        area:      limparTexto(contato!.areaConstruida),
        quartos: null, vagas: null, valorPretendido: null, ocupacao: null, interesseEm: null,
      },
      status: 'NOVO', atividades: [], conversas: [],
      spin: { situacao: {}, problema: { doresIdentificadas: [] }, implicacao: {}, necessidade: { objecoes: [] }, observacoes: null },
    };
  }, [lead, contato, dados?.atividades, dados?.conversas]);

  // DUP-FIX: usa extrairTelefones/extrairEmails do utilitário compartilhado
  const telefones       = useMemo(() => extrairTelefones(contato ?? lead), [contato, lead]);
  const emails          = useMemo(() => extrairEmails(contato ?? lead),    [contato, lead]);
  const telefonePrincipal = useMemo(() => telefones.find((t) => t.principal) || telefones[0], [telefones]);
  const emailPrincipal    = useMemo(() => emails[0], [emails]);

  const statusProspeccao = limparTexto(contato?.statusProspeccao) || 'AGUARDANDO';
  const statusInfo       = statusConfig[statusProspeccao] || statusConfig.AGUARDANDO;
  const mostrarConversao = statusProspeccao === 'INTERESSADO' && !virouLead;

  const copiar = async (texto: string, tipo: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    toast.success(`${tipo} copiado`);
    setTimeout(() => setCopiado(null), 2000);
  };

  const alternarModo = async (novoModo: 'IA' | 'HUMANO' | 'PAUSADO') => {
    if (!campanha?.id || !contato?.id || alternandoModo) return;
    try {
      setAlternandoModo(true);
      const endpoints: Record<string, string> = { IA: 'devolver-ia', HUMANO: 'assumir-humano', PAUSADO: 'pausar' };
      await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/${endpoints[novoModo]}`);
      await recarregar();
      const msgs: Record<string, string> = { IA: '🤖 IA reativada', HUMANO: '👤 Você assumiu a conversa', PAUSADO: '⏸️ Conversa pausada' };
      toast.success(msgs[novoModo]);
    } catch { toast.error('Erro ao alternar modo'); }
    finally { setAlternandoModo(false); }
  };

  const desativarContato = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.patch(`/campanhas/${campanha.id}/contatos/${contato.id}`, { statusProspeccao: 'SEM_INTERESSE' });
      toast.success('Contato desativado');
      await recarregar();
    } catch { toast.error('Erro ao desativar contato'); }
    finally { setProcessandoGestao(false); }
  };

  const blacklistContato = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/blacklist`, { motivo: 'MANUAL' });
      toast.success('Telefone adicionado à blacklist');
      setConfirmGestao(null);
      await recarregar();
    } catch { toast.error('Erro ao adicionar à blacklist'); }
    finally { setProcessandoGestao(false); }
  };

  const removerLead = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/remover-lead`);
      toast.success('Lead removido. Contato restaurado como prospect.');
      setConfirmGestao(null);
      await recarregar();
    } catch { toast.error('Erro ao remover lead'); }
    finally { setProcessandoGestao(false); }
  };

  const excluirContato = async () => {
    if (processandoGestao) return;
    try {
      setProcessandoGestao(true);
      if (podeGerenciarContato) {
        await api.delete(`/campanhas/${campanha!.id}/contatos/${contato!.id}`);
        toast.success('Contato excluído');
      } else if (podeExcluirLeadManual) {
        await api.delete(`/leads/${lead!.id}`, { data: { confirmacao: 'excluir' } });
        toast.success('Lead excluído');
      } else {
        toast.error('Não foi possível identificar o registro para exclusão');
        setProcessandoGestao(false);
        return;
      }
      navigate('/dashboard/proprietarios');
    } catch (error: any) {
      toast.error(error?.response?.data?.erro || 'Erro ao excluir');
      setProcessandoGestao(false);
    }
  };

  const promoverLead = async () => {
    if (!campanha?.id || !contato?.id || promovendo) return;
    try {
      setPromovendo(true);
      const response = await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/promover`);
      const leadId = response?.data?.leadId;
      toast.success('Contato promovido com sucesso!');
      if (leadId) navigate(`/dashboard/proprietarios/${leadId}`);
      else await recarregar();
    } catch (error: any) {
      toast.error(error?.response?.data?.erro || 'Erro ao promover contato');
    } finally { setPromovendo(false); }
  };

  const executarAcaoCrm = async (acao: 'status' | 'enviar' | 'reenviar') => {
    if (!lead?.id || processandoCrm) return;
    try {
      setProcessandoCrm(acao);
      if (acao === 'status') {
        const response = await api.get(`/leads/${lead.id}/crm/status`);
        const ok = !!response?.data?.sucesso;
        const texto = response?.data?.resultado?.status || response?.data?.resultado?.mensagem || (ok ? 'Status atualizado.' : 'Sem confirmação.');
        setResumoCrm(texto);
        ok ? toast.success('Status do CRM atualizado.') : toast.warning(texto);
      } else {
        const response = await api.post(`/leads/${lead.id}/crm/${acao === 'enviar' ? 'enviar' : 'reenviar'}`);
        const ok = !!response?.data?.sucesso;
        const msg = response?.data?.mensagem || response?.data?.erro || (ok ? 'Operação concluída.' : 'Falha ao operar CRM.');
        setResumoCrm(msg);
        ok ? toast.success(msg) : toast.error(msg);
      }
      await recarregar();
    } catch (error: any) {
      const msg = error?.response?.data?.erro || 'Erro ao executar ação CRM';
      setResumoCrm(msg);
      toast.error(msg);
    } finally { setProcessandoCrm(null); }
  };

  const criarAtividade = async () => {
    if (!lead?.id || !formAtividade.titulo.trim()) return;
    try {
      setSalvandoAtividade(true);
      await api.post(`/leads/${lead.id}/atividades`, {
        tipo:         formAtividade.tipo,
        titulo:       formAtividade.titulo.trim(),
        descricao:    formAtividade.descricao.trim()    || undefined,
        agendadoPara: formAtividade.agendadoPara        || undefined,
        resultado:    formAtividade.resultado.trim()    || undefined,
      });
      toast.success('Atividade criada!');
      setModalAtividade(false);
      setFormAtividade({ tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '', resultado: '' });
      await recarregar();
    } catch (error: any) {
      toast.error(error?.response?.data?.erro || 'Erro ao criar atividade');
    } finally { setSalvandoAtividade(false); }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Erro ao carregar</h2>
          <p className="text-slate-500 mb-6">{erro || 'Proprietário não encontrado'}</p>
          <Button variant="outline" onClick={() => navigate('/dashboard/proprietarios')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'atendimento',  label: 'Atendimento',  icon: <Activity    className="w-4 h-4" /> },
    { id: 'proprietario', label: 'Proprietário',  icon: <User        className="w-4 h-4" /> },
    { id: 'imovel',       label: 'Imóvel',        icon: <Home        className="w-4 h-4" /> },
    { id: 'qualificacao', label: 'Qualificação',  icon: <Briefcase   className="w-4 h-4" /> },
    { id: 'negociacao',   label: 'Negociação',    icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'contrato',     label: 'Contrato',      icon: <FileText    className="w-4 h-4" /> },
    { id: 'atividades',   label: 'Atividades',    icon: <Target      className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/dashboard/proprietarios')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /><span>Voltar para proprietários</span>
          </button>

          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-lg font-bold shadow-lg flex-shrink-0">
                {nome.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900 truncate">{nome}</h1>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bg}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                  {telefonePrincipal?.numero && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />{formatarTelefone(telefonePrincipal.numero)}
                    </span>
                  )}
                  {emailPrincipal?.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />{emailPrincipal.email}
                    </span>
                  )}
                  {limparTexto(contato?.cpf || lead?.cpf) && (
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />{formatarCpf(limparTexto(contato?.cpf || lead?.cpf)!)}
                    </span>
                  )}
                  {campanha?.nome && (
                    <button className="text-brand hover:underline" onClick={() => navigate(`/dashboard/campanhas/${campanha.id}`)}>
                      {campanha.nome}
                    </button>
                  )}
                  {campanha?.empreendimento?.nome && (
                    <span className="text-slate-400">
                      Empreendimento: <span className="text-slate-700 font-medium">{campanha.empreendimento.nome}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {telefonePrincipal?.numero && (
                <>
                  <Button variant="outline" size="sm" onClick={() => window.open(`tel:${telefonePrincipal.numero}`, '_blank')}>
                    <Phone className="w-4 h-4 mr-2" />Ligar
                  </Button>
                  {/* BUG-FIX: urlWhatsApp() garante que o prefixo 55 não é duplicado */}
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success-dark text-white"
                    onClick={() => window.open(urlWhatsApp(telefonePrincipal.numero), '_blank')}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />WhatsApp
                  </Button>
                </>
              )}
              {emailPrincipal?.email && (
                <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${emailPrincipal.email}`, '_blank')}>
                  <Mail className="w-4 h-4 mr-2" />Email
                </Button>
              )}
              {temLeadReal && (
                <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
                  <MessageSquare className="w-4 h-4 mr-2" />Chat do Lead
                </Button>
              )}

              {(podeGerenciarContato || podeExcluirLeadManual) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {podeGerenciarContato && (
                      <>
                        <DropdownMenuItem onClick={desativarContato} className="gap-2 cursor-pointer" disabled={processandoGestao}>
                          <BellOff className="w-4 h-4 text-slate-500" />Desativar contato
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmGestao('blacklist')} className="gap-2 cursor-pointer text-orange-700" disabled={processandoGestao}>
                          <ShieldBan className="w-4 h-4" />Enviar para blacklist
                        </DropdownMenuItem>
                        {/* BUG-FIX: virouLead vem do backend; removido item duplicado "Definir como contato" */}
                        {virouLead && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmGestao('removerLead')} className="gap-2 cursor-pointer text-violet-700" disabled={processandoGestao}>
                              <UserMinus className="w-4 h-4" />Remover de leads
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setConfirmGestao('excluir')} className="gap-2 cursor-pointer text-red-600 focus:text-red-600" disabled={processandoGestao}>
                      <Trash2 className="w-4 h-4" />{podeGerenciarContato ? 'Excluir contato' : 'Excluir lead'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {mostrarConversao ? (
                <Button className="bg-brand hover:bg-brand-dark text-white ml-2 shadow-sm" onClick={promoverLead} disabled={promovendo}>
                  {promovendo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                  Promover a Oportunidade
                </Button>
              ) : virouLead ? (
                <Button variant="outline" className="ml-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  onClick={() => navigate(`/dashboard/proprietarios/${lead?.id || contato?.id}`)}>
                  Ver no CRM
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Dialog de confirmação de ações destrutivas */}
      <Dialog open={confirmGestao !== null} onOpenChange={(open) => { if (!open) setConfirmGestao(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmGestao === 'blacklist'   && 'Enviar para blacklist?'}
              {confirmGestao === 'removerLead' && 'Remover de leads?'}
              {confirmGestao === 'excluir'     && (podeGerenciarContato ? 'Excluir contato?' : 'Excluir lead?')}
            </DialogTitle>
            <DialogDescription>
              {confirmGestao === 'blacklist'   && 'O telefone deste contato será bloqueado. Pode ser revertido na lista de blacklist.'}
              {confirmGestao === 'removerLead' && 'O lead associado será removido e o contato voltará ao status de prospect. As conversas e atividades serão perdidas.'}
              {confirmGestao === 'excluir'     && (podeGerenciarContato
                ? 'O contato e todos os dados associados serão excluídos permanentemente.'
                : 'O lead e todos os dados associados serão excluídos permanentemente.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmGestao(null)} disabled={processandoGestao}>Cancelar</Button>
            <Button variant="destructive" disabled={processandoGestao} onClick={() => {
              if (confirmGestao === 'blacklist')   blacklistContato();
              else if (confirmGestao === 'removerLead') removerLead();
              else if (confirmGestao === 'excluir')     excluirContato();
            }}>
              {processandoGestao && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {confirmGestao === 'blacklist'   && 'Confirmar blacklist'}
              {confirmGestao === 'removerLead' && 'Remover lead'}
              {confirmGestao === 'excluir'     && 'Excluir permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* DUP-FIX: sistema de tabs unificado — botões custom sem wrapper <Tabs> redundante */}
          <nav className="border-b border-slate-200 flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>

          <div className="p-6">
            {activeTab === 'atendimento' && (
              <TabAtendimento
                contato={contato}
                lead={lead}
                statusInfo={statusInfo}
                mensagensProspecao={dados.mensagensProspecao}
                alternarModo={alternarModo}
                alternandoModo={alternandoModo}
              />
            )}
            {activeTab === 'proprietario' && (
              <TabProprietario
                contato={contato || leadVisual}
                telefones={telefones}
                emails={emails}
                copiar={copiar}
                copiado={copiado}
              />
            )}
            {activeTab === 'imovel' && (
              <TabImovel contato={contato || leadVisual} copiar={copiar} copiado={copiado} />
            )}
            {activeTab === 'qualificacao' && (
              leadVisual
                ? <TabQualificacao lead={leadVisual as any} temLeadReal={temLeadReal} />
                : <Card><CardContent className="p-4 text-sm text-slate-500">Sem dados de qualificação ainda.</CardContent></Card>
            )}
            {activeTab === 'negociacao' && (
              temLeadReal
                ? <CardNegociacao lead={leadVisual as any} />
                : <Card><CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent></Card>
            )}
            {activeTab === 'contrato' && (
              temLeadReal
                ? <CardContrato lead={leadVisual as any} onUpdate={recarregar} />
                : <Card><CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent></Card>
            )}
            {activeTab === 'atividades' && (
              <TabAtividades
                leadVisual={leadVisual}
                dados={dados}
                temLeadReal={temLeadReal}
                processandoCrm={processandoCrm}
                resumoCrm={resumoCrm}
                executarAcaoCrm={executarAcaoCrm}
                onNovaAtividade={() => setModalAtividade(true)}
              />
            )}
          </div>
        </div>
      </main>

      {temLeadReal && (
        <>
          <Suspense fallback={null}>
            <ChatModal
              lead={{ id: leadVisual!.id, nome: leadVisual!.nome || nome, telefone: leadVisual!.telefone || null }}
              open={chatOpen}
              onOpenChange={setChatOpen}
            />
          </Suspense>

          <Dialog open={modalAtividade} onOpenChange={setModalAtividade}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Atividade</DialogTitle>
                <DialogDescription>Crie uma atividade de acompanhamento do proprietário.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <label htmlFor="atividade-tipo" className="text-sm font-medium">Tipo</label>
                  <Select value={formAtividade.tipo} onValueChange={(v) => setFormAtividade((p) => ({ ...p, tipo: v }))}>
                    <SelectTrigger id="atividade-tipo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIGACAO">Ligação</SelectItem>
                      <SelectItem value="AVALIACAO">Avaliação</SelectItem>
                      <SelectItem value="REUNIAO">Reunião</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                      <SelectItem value="TAREFA">Tarefa</SelectItem>
                      <SelectItem value="NOTA">Nota</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="atividade-titulo" className="text-sm font-medium">Título</label>
                  <Input id="atividade-titulo" value={formAtividade.titulo}
                    onChange={(e) => setFormAtividade((p) => ({ ...p, titulo: e.target.value }))}
                    placeholder="Ex: confirmar documentação pendente" />
                </div>
                <div>
                  <label htmlFor="atividade-descricao" className="text-sm font-medium">Descrição</label>
                  <Textarea id="atividade-descricao" value={formAtividade.descricao}
                    onChange={(e) => setFormAtividade((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Detalhes da atividade" />
                </div>
                <div>
                  <label htmlFor="atividade-agendado" className="text-sm font-medium">Agendado para</label>
                  <Input id="atividade-agendado" type="datetime-local" value={formAtividade.agendadoPara}
                    onChange={(e) => setFormAtividade((p) => ({ ...p, agendadoPara: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="atividade-resultado" className="text-sm font-medium">Resultado (opcional)</label>
                  <Input id="atividade-resultado" value={formAtividade.resultado}
                    onChange={(e) => setFormAtividade((p) => ({ ...p, resultado: e.target.value }))}
                    placeholder="Ex: cliente confirmou visita" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalAtividade(false)}>Cancelar</Button>
                <Button onClick={criarAtividade} disabled={salvandoAtividade || !formAtividade.titulo.trim()}>
                  {salvandoAtividade && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Criar atividade
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

// ─── Tab Atendimento ──────────────────────────────────────────────────────────

function TabAtendimento({
  contato, lead, statusInfo, mensagensProspecao, alternarModo, alternandoModo,
}: {
  contato: any; lead: any;
  statusInfo: { label: string; color: string; bg: string };
  mensagensProspecao: any[];
  alternarModo: (modo: 'IA' | 'HUMANO' | 'PAUSADO') => void;
  alternandoModo: boolean;
}) {
  const modoAtual         = contato?.modoAtendimento || 'IA';
  const scoreAssertiva    = contato?.scoreAssertiva  ?? lead?.scoreAssertiva;
  const scoreQualificacao = contato?.scoreQualificacao ?? lead?.scoreQualificacao;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Status da Prospecção</h3>
          </div>
          <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${statusInfo.color} ${statusInfo.bg}`}>
            {statusInfo.label}
          </div>
          {contato?.criadoEm && <p className="text-xs text-slate-400 mt-3">Criado em {formatarDataCurta(contato.criadoEm)}</p>}
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Modo de Atendimento</h3>
          </div>
          {contato?.id ? (
            <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200">
              {(['IA', 'HUMANO', 'PAUSADO'] as const).map((modo) => {
                const cfg = {
                  IA:     { icon: <Bot className="w-4 h-4 mr-1.5" />,  label: 'IA',      active: 'bg-brand hover:bg-brand-dark text-white' },
                  HUMANO: { icon: <User className="w-4 h-4 mr-1.5" />, label: 'Humano',  active: 'bg-amber-600 hover:bg-amber-700 text-white' },
                  PAUSADO:{ icon: <Pause className="w-4 h-4 mr-1.5" />,label: 'Pausado', active: 'bg-slate-600 hover:bg-slate-700 text-white' },
                }[modo];
                return (
                  <Button key={modo} variant={modoAtual === modo ? 'default' : 'ghost'} size="sm"
                    onClick={() => alternarModo(modo)}
                    disabled={alternandoModo || modoAtual === modo}
                    className={`flex-1 h-9 ${modoAtual === modo ? cfg.active : 'text-slate-600 hover:text-slate-900'}`}>
                    {cfg.icon}{cfg.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Modo de atendimento disponível apenas para contatos em prospecção.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!!scoreAssertiva && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-indigo-900">Score de Dados</h3>
              </div>
              <span className="text-3xl font-bold text-brand">{scoreAssertiva}</span>
            </div>
            <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: `${Math.min(100, scoreAssertiva)}%` }} />
            </div>
          </div>
        )}
        {!!scoreQualificacao && scoreQualificacao > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-amber-900">Score de Interesse</h3>
              </div>
              <span className="text-3xl font-bold text-amber-600">{scoreQualificacao}</span>
            </div>
            <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${Math.min(100, scoreQualificacao)}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-900">Observações</h3>
        </div>
        <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">
          {limparTexto(contato?.observacoes) || 'Nenhuma observação registrada.'}
        </p>
      </div>

      {/* GAP-FIX: histórico de mensagens de prospecção (era buscado mas nunca renderizado) */}
      {mensagensProspecao?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Histórico de Prospecção</h3>
            <span className="ml-auto text-xs text-slate-400">{mensagensProspecao.length} mensagens</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {mensagensProspecao.map((m: any) => (
              <div key={m.id} className={`flex gap-3 text-sm ${m.direcao === 'ENTRADA' ? 'flex-row-reverse' : ''}`}>
                <div className={`rounded-lg px-3 py-2 max-w-[80%] ${m.direcao === 'ENTRADA' ? 'bg-indigo-50 text-indigo-900' : 'bg-slate-100 text-slate-800'}`}>
                  <p>{m.mensagem}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{m.dataHora ? formatarDataHora(m.dataHora) : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Atividades ───────────────────────────────────────────────────────────

function TabAtividades({
  leadVisual, dados, temLeadReal,
  processandoCrm, resumoCrm, executarAcaoCrm, onNovaAtividade,
}: {
  leadVisual: any; dados: any; temLeadReal: boolean;
  processandoCrm: string | null; resumoCrm: string;
  executarAcaoCrm: (a: 'status' | 'enviar' | 'reenviar') => void;
  onNovaAtividade: () => void;
}) {
  return (
    <div className="space-y-4">
      {temLeadReal && (
        <Card className="border-indigo-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-500" />Integração CRM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Status atual</p>
              <p className="text-sm font-medium text-slate-800">
                {resumoCrm || leadVisual?.crm?.syncStatus || 'Ainda não verificado nesta sessão.'}
              </p>
              {!!leadVisual?.crm?.syncError && <p className="text-xs text-red-600 mt-1">{leadVisual.crm.syncError}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(['status', 'enviar', 'reenviar'] as const).map((acao) => (
                <Button key={acao} variant="outline" disabled={processandoCrm !== null} onClick={() => executarAcaoCrm(acao)}>
                  {processandoCrm === acao
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : acao === 'status'   ? <Link2       className="w-4 h-4 mr-2" />
                    : acao === 'enviar'   ? <CheckCircle2 className="w-4 h-4 mr-2" />
                    :                       <RefreshCw    className="w-4 h-4 mr-2" />}
                  {acao === 'status' ? 'Verificar' : acao === 'enviar' ? 'Enviar' : 'Reenviar'}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Atividades</CardTitle>
          {temLeadReal && (
            <Button size="sm" onClick={onNovaAtividade}>
              <CalendarPlus className="w-4 h-4 mr-2" />Nova Atividade
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(dados.atividades || []).map((a: any) => (
            <div key={a.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{a.titulo || a.tipo}</p>
                {a.agendadoPara && <span className="text-[11px] text-slate-500">{formatarDataHora(a.agendadoPara)}</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">{a.descricao || 'Sem descrição'}</p>
              {a.resultado && <p className="text-xs text-slate-700 mt-2">Resultado: {a.resultado}</p>}
            </div>
          ))}
          {(dados.atividades || []).length === 0 && (
            <p className="text-sm text-slate-500">Sem atividades registradas.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab Qualificação ─────────────────────────────────────────────────────────

const temValorQualificacao = (valor: unknown) => {
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === 'boolean') return true;
  return !!limparTexto(valor);
};

const formatarBooleano = (valor: unknown) => {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return null;
};

function CampoQualificacao({ label, valor }: { label: string; valor: unknown }) {
  const texto = Array.isArray(valor) ? valor.join(', ') : formatarBooleano(valor) || limparTexto(valor);
  if (!texto) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-400">Ainda não identificado</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{texto}</p>
    </div>
  );
}

function TabQualificacao({ lead, temLeadReal }: { lead: any; temLeadReal: boolean }) {
  const spin        = lead?.spin || {};
  const situacao    = spin.situacao    || {};
  const problema    = spin.problema    || {};
  const implicacao  = spin.implicacao  || {};
  const necessidade = spin.necessidade || {};
  const faseSPIN    = lead?.conversas?.[0]?.faseSPIN || 'Não iniciada';

  const campos = [
    situacao.situacaoAtual, situacao.tempoDecisao, situacao.tentativasAnteriores, situacao.comCorretorAtualmente,
    problema.motivacaoVenda, problema.doresIdentificadas,
    implicacao.prazoDesejado, implicacao.urgencia, implicacao.consequencias, implicacao.custosAtuais, implicacao.pressaoTempo,
    necessidade.expectativaServico, necessidade.objecoes, necessidade.interesseAvaliacao,
    spin.observacoes,
  ];
  const preenchidos = campos.filter(temValorQualificacao).length;
  const percentual  = Math.round((preenchidos / campos.length) * 100);

  const lacunas = [
    !temValorQualificacao(situacao.situacaoAtual)        && 'Situação atual do imóvel',
    !temValorQualificacao(problema.motivacaoVenda)       && 'Motivação para vender/alugar',
    !temValorQualificacao(problema.doresIdentificadas)   && 'Dores explícitas do proprietário',
    !temValorQualificacao(implicacao.prazoDesejado)      && 'Prazo/urgência desejada',
    !temValorQualificacao(necessidade.expectativaServico) && 'Expectativa sobre a solução/imobiliária',
    !temValorQualificacao(necessidade.objecoes)          && 'Objeções ou travas de decisão',
  ].filter(Boolean) as string[];

  const resumoAtendimento = limparTexto(lead?.briefingCloser) || limparTexto(spin.observacoes) || limparTexto(lead?.ultimaAcaoIA) || null;

  if (!temLeadReal) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Qualificação ainda não iniciada</h3>
            <p className="text-sm text-amber-800 mt-1">Este proprietário ainda não virou lead qualificado. A aba será preenchida quando a IA coletar dados de atendimento.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand" />Diagnóstico Comercial e SPIN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-xs uppercase tracking-wide text-indigo-500">Fase SPIN</p>
              <p className="text-xl font-bold text-indigo-900 mt-1">{faseSPIN}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-600">Completude</p>
              <p className="text-xl font-bold text-emerald-800 mt-1">{percentual}%</p>
              <div className="mt-2 h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentual}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-600">Urgência</p>
              <p className="text-xl font-bold text-amber-800 mt-1">{limparTexto(implicacao.urgencia) || 'Não mapeada'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-800">Resumo do Atendimento IA</h3>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {resumoAtendimento || 'A IA ainda não registrou um resumo comercial para este lead.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />S - Situação
              </h3>
              <CampoQualificacao label="Situação atual"        valor={situacao.situacaoAtual} />
              <CampoQualificacao label="Tempo de decisão"      valor={situacao.tempoDecisao} />
              <CampoQualificacao label="Tentativas anteriores" valor={situacao.tentativasAnteriores} />
              <CampoQualificacao label="Com corretor atualmente" valor={situacao.comCorretorAtualmente} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">P - Problema</h3>
              <CampoQualificacao label="Motivação"          valor={problema.motivacaoVenda} />
              <CampoQualificacao label="Dores identificadas" valor={problema.doresIdentificadas} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">I - Implicação</h3>
              <CampoQualificacao label="Prazo desejado"  valor={implicacao.prazoDesejado} />
              <CampoQualificacao label="Consequências"   valor={implicacao.consequencias} />
              <CampoQualificacao label="Custos atuais"   valor={implicacao.custosAtuais} />
              <CampoQualificacao label="Pressão de tempo" valor={implicacao.pressaoTempo} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">N - Necessidade de Solução</h3>
              <CampoQualificacao label="Expectativa de serviço" valor={necessidade.expectativaServico} />
              <CampoQualificacao label="Objeções"               valor={necessidade.objecoes} />
              <CampoQualificacao label="Aceitou avaliação"      valor={necessidade.interesseAvaliacao} />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4">
            <h3 className="font-semibold text-amber-900 mb-2">Lacunas para a próxima interação</h3>
            {lacunas.length > 0 ? (
              <ul className="space-y-1">
                {lacunas.map((l) => (
                  <li key={l} className="text-sm text-amber-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{l}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />Diagnóstico comercial mínimo preenchido.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CardBriefingIA lead={lead} />
      <FaseChecklist  lead={lead} />
      <CardTrackingIA lead={lead} />
    </div>
  );
}

// ─── Tab Proprietário ─────────────────────────────────────────────────────────

// Campo individual no estilo da aba Imóvel: label em uppercase + valor em destaque
function CampoInfo({
  label, valor, mono = false, col2 = false,
}: {
  label: string; valor: string | null | undefined; mono?: boolean; col2?: boolean;
}) {
  if (!valor) return null;
  return (
    <div className={`rounded-lg bg-white border border-slate-200 px-3 py-2.5 ${col2 ? 'col-span-2' : ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-slate-800 truncate ${mono ? 'font-mono' : ''}`}>{valor}</p>
    </div>
  );
}

// Badge sim/não para compliance
function BadgeBool({
  label, valor, simColor = 'text-amber-800 bg-amber-100', naoColor = 'text-emerald-700 bg-emerald-100',
}: {
  label: string; valor: boolean | null | undefined; simColor?: string; naoColor?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${valor ? simColor : naoColor}`}>
        {valor ? 'Sim' : 'Não'}
      </span>
    </div>
  );
}

function TabProprietario({
  contato, telefones, emails, copiar, copiado,
}: {
  contato: any;
  telefones: TelefoneItem[];
  emails: EmailItem[];
  copiar: (texto: string, tipo: string) => void;
  copiado: string | null;
}) {
  if (!contato) return null;
  const participacoesEmpresas = normalizarLista(contato?.participacoesEmpresas);
  const redesSociais          = normalizarLista(contato?.redesSociais);

  const nascimento = limparTexto(contato.dataNascimento)
    ? (String(contato.dataNascimento).includes('T') ? formatarDataCurta(contato.dataNascimento) : String(contato.dataNascimento))
    : null;

  const situacaoCadastral = limparTexto(contato.situacaoCadastral);

  return (
    <div className="space-y-5">

      {/* ── Card 1: Dados Pessoais + Profissionais (2 colunas internas) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <User className="w-5 h-5 text-slate-400" />
          <h3 className="font-bold text-slate-800">Dados do Proprietário</h3>
          {/* Idade e sexo no header, compactos */}
          {contato.idade && (
            <span className="ml-auto text-sm font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {contato.idade} anos{contato.sexo ? ` · ${contato.sexo}` : ''}
            </span>
          )}
          {situacaoCadastral && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${situacaoCadastral === 'REGULAR' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {situacaoCadastral}
            </span>
          )}
        </div>

        {/* Grid 2 colunas: Pessoal | Profissional */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

          {/* Col esquerda — Dados Pessoais */}
          <div className="p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />Dados Pessoais
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CampoInfo label="CPF"          valor={limparTexto(contato.cpf) ? formatarCpf(contato.cpf) : null} mono />
              <CampoInfo label="Nascimento"   valor={nascimento} />
              <CampoInfo label="Estado civil" valor={limparTexto(contato.estadoCivil)} />
              <CampoInfo label="Escolaridade" valor={limparTexto(contato.escolaridade)} />
              <CampoInfo label="Nome da mãe"  valor={limparTexto(contato.nomeMae)} col2 />
              <CampoInfo label="CPF da mãe"   valor={limparTexto(contato.cpfMae) ? formatarCpf(contato.cpfMae) : null} mono />
              <CampoInfo label="Signo"        valor={limparTexto(contato.signo)} />
            </div>
            {situacaoCadastral === 'SUSPENSA' && (
              <p className="text-[11px] leading-4 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                CPF com situação cadastral SUSPENSA na Receita Federal. Orientar regularização antes de avançar na negociação.
              </p>
            )}
          </div>

          {/* Col direita — Dados Profissionais */}
          <div className="p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />Dados Profissionais
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CampoInfo label="Empresa"        valor={limparTexto(contato.empresaAtual)} col2 />
              <CampoInfo label="Cargo / Profissão" valor={limparTexto(contato.profissao)} col2 />
              <CampoInfo label="Setor"          valor={limparTexto(contato.setor)} />
              <CampoInfo label="CNPJ Empresa"   valor={limparTexto(contato.cnpjEmpresa)} mono />
            </div>

            {limparTexto(contato.rendaEstimada) && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200 mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Renda Estimada</p>
                <p className="text-2xl font-black text-emerald-700">{formatarMoeda(contato.rendaEstimada)}</p>
                {limparTexto(contato.faixaSalarial) && (
                  <p className="text-xs text-emerald-600 mt-1">Faixa: {contato.faixaSalarial}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Card 2: Contatos — Telefones e Emails (2 colunas) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

          {/* Telefones */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-slate-800">Telefones</h3>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{telefones.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {telefones.slice(0, 6).map((tel, idx) => (
                <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-900 truncate">{formatarTelefone(tel.numero)}</span>
                    {tel.whatsapp && <span className="text-[10px] font-medium text-emerald-600">WhatsApp</span>}
                  </div>
                  <button onClick={() => copiar(tel.numero, 'Telefone')} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-emerald-100 transition-all flex-shrink-0 ml-1">
                    {copiado === 'Telefone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              ))}
              {telefones.length === 0 && <p className="text-sm text-slate-400 col-span-2">Sem telefones cadastrados.</p>}
            </div>
          </div>

          {/* Emails */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-violet-500" />
                <h3 className="font-bold text-slate-800">Emails</h3>
              </div>
              <span className="text-xs font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{emails.filter((e) => e?.email).length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {emails.filter((e) => e?.email).slice(0, 6).map((email, idx) => (
                <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors">
                  <span className="text-sm font-semibold text-slate-900 truncate flex-1">{email.email}</span>
                  <button onClick={() => copiar(email.email, 'Email')} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-violet-100 transition-all flex-shrink-0 ml-1">
                    {copiado === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              ))}
              {emails.filter((e) => e?.email).length === 0 && <p className="text-sm text-slate-400 col-span-2">Sem emails cadastrados.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 3: Endereço + Compliance (2 colunas) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

          {/* Endereço Residencial */}
          <div className="p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />Endereço Residencial
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CampoInfo label="Logradouro" valor={limparTexto(contato.enderecoPrincipal || contato.endereco)} col2 />
              <CampoInfo label="Cidade"     valor={limparTexto(contato.cidade)} />
              <CampoInfo label="Estado"     valor={limparTexto(contato.estado)} />
              <CampoInfo label="CEP"        valor={limparTexto(contato.cep)} mono />
            </div>
          </div>

          {/* Compliance e Risco */}
          <div className="p-5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />Compliance e Risco
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <BadgeBool
                label="PPE (Politicamente Exposto)"
                valor={contato?.ppe}
                simColor="text-amber-800 bg-amber-100"
                naoColor="text-emerald-700 bg-emerald-100"
              />
              <BadgeBool
                label="Óbito provável"
                valor={contato?.obitoProvavel}
                simColor="text-red-700 bg-red-100"
                naoColor="text-emerald-700 bg-emerald-100"
              />
            </div>
            {contato?.ppe && (
              <p className="text-[11px] leading-4 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                PPE: exige procedimentos adicionais de KYC/PLD antes de fechar negócio.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Card 4: Dados Societários e Redes (opcional) ── */}
      {(participacoesEmpresas.length > 0 || redesSociais.length > 0 || contato?.perfilInvestidor) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Dados Societários e Redes</h3>
            {contato?.perfilInvestidor && (
              <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">Perfil investidor</span>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Participações */}
            <div className="p-5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Participações em Empresas</p>
              {participacoesEmpresas.length === 0
                ? <p className="text-sm text-slate-400">Sem participações registradas.</p>
                : participacoesEmpresas.slice(0, 6).map((p: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-800">{p?.razaoSocial || '-'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p?.cnpj || '-'}{p?.participacao ? ` · ${p.participacao}` : ''}</p>
                    </div>
                  ))
              }
            </div>
            {/* Redes Sociais */}
            <div className="p-5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Redes Sociais</p>
              {redesSociais.length === 0
                ? <p className="text-sm text-slate-400">Sem redes sociais registradas.</p>
                : redesSociais.slice(0, 6).map((r: any, idx: number) => (
                    <a key={idx} href={limparTexto(r?.url) || '#'} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{limparTexto(r?.rede) || 'Rede'}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{limparTexto(r?.url) || '-'}</p>
                      </div>
                      <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
                    </a>
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Imóvel ───────────────────────────────────────────────────────────────

function TabImovel({
  contato, copiar, copiado,
}: {
  contato: any;
  copiar: (texto: string, tipo: string) => void;
  copiado: string | null;
}) {
  if (!contato) return null;

  const temDados = contato?.nomeEdificio || contato?.enderecoImovel || contato?.inscricaoIptu || contato?.bairroImovel || contato?.tipoImovel;
  if (!temDados) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Home className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-600 mb-2">Sem dados do imóvel</h3>
        <p className="text-sm text-slate-400 max-w-sm">As informações do imóvel serão exibidas aqui quando disponíveis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {limparTexto(contato.nomeEdificio) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-indigo-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-brand" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{contato.nomeEdificio}</h1>
              <p className="text-sm text-brand font-medium mt-1 uppercase tracking-wider">Identificação do Edifício</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <MapPin className="w-5 h-5 text-brand" />
          <h3 className="font-bold text-lg text-slate-800">Dossiê de Localização e Unidade</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div><p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Endereço Completo</p><p className="text-sm font-semibold text-slate-900">{limparTexto(contato.enderecoImovel) || '-'}</p></div>
            <div><p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bairro</p><p className="text-sm font-semibold text-slate-900">{limparTexto(contato.bairroImovel) || '-'}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quadra</p><p className="text-sm font-semibold text-slate-900">{limparTexto(contato.quadra) || '-'}</p></div>
              <div><p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Lote</p><p className="text-sm font-semibold text-slate-900">{limparTexto(contato.lote) || '-'}</p></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 text-center">
                <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider mb-1">Unidade</p>
                <p className="text-xl font-bold text-indigo-700">{limparTexto(contato.unidade) || '-'}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 text-center">
                <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider mb-1">Bloco</p>
                <p className="text-xl font-bold text-indigo-700">{limparTexto(contato.bloco) || '-'}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Box/Garagem</p>
              <p className="text-lg font-bold text-slate-700">{limparTexto(contato.box) || 'Não informado'}</p>
            </div>
            {limparTexto(contato.areaConstruida ?? contato.areaImovel) && (
              <div className="bg-emerald-600 rounded-lg p-4 text-white shadow-md text-center">
                <p className="text-[11px] text-emerald-100 font-bold uppercase tracking-wider mb-1">Área Construída</p>
                <p className="text-3xl font-black">{contato.areaConstruida ?? contato.areaImovel} m²</p>
              </div>
            )}
          </div>
        </div>

        {limparTexto(contato.inscricaoIptu) && (
          <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Inscrição IPTU</p>
              <p className="font-mono text-lg font-bold text-slate-700">{contato.inscricaoIptu}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copiar(contato.inscricaoIptu, 'IPTU')}>
              {copiado === 'IPTU' ? <Check className="w-4 h-4 text-emerald-500 mr-2" /> : <Copy className="w-4 h-4 text-slate-400 mr-2" />}
              Copiar IPTU
            </Button>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Home className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-700">Outras Características</h3>
        </div>
        <div className="space-y-3">
          {limparTexto(contato.tipoImovel) && (
            <div className="flex justify-between py-2 border-b border-slate-200">
              <span className="text-sm text-slate-500">Tipo de Imóvel</span>
              <span className="text-sm font-medium text-slate-900">{formatarTipoImovel(contato.tipoImovel)}</span>
            </div>
          )}
          {limparTexto(contato.areaTerreno) && (
            <div className="flex justify-between py-2 border-b border-slate-200">
              <span className="text-sm text-slate-500">Área do Condomínio/Terreno</span>
              <span className="text-sm font-medium text-slate-900">{contato.areaTerreno} m²</span>
            </div>
          )}
          {limparTexto(contato.valorVenal) && (
            <div className="flex justify-between py-2 border-b border-slate-200">
              <span className="text-sm text-slate-500">Valor Venal</span>
              <span className="text-sm font-medium text-emerald-600">{formatarMoeda(contato.valorVenal)}</span>
            </div>
          )}
          {limparTexto(contato.anoConstituicao) && (
            <div className="flex justify-between py-2">
              <span className="text-sm text-slate-500">Ano de Constituição</span>
              <span className="text-sm font-medium text-slate-900">{contato.anoConstituicao}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
