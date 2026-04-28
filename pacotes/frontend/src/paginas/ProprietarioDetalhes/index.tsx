import { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  MessageSquare,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  FileText,
  User,
  Bot,
  Pause,
  Briefcase,
  Home,
  Shield,
  Activity,
  Target,
  Sparkles,
  Users,
  Rocket,
  Link2,
  CheckCircle2,
  RefreshCw,
  CalendarPlus,
  AlertTriangle,
  HelpCircle,
  ClipboardCheck,
  MoreVertical,
  BellOff,
  ShieldBan,
  UserMinus,
  Trash2,
} from 'lucide-react';
import { Button } from '../../componentes/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../componentes/ui/dropdown-menu';
import { Textarea } from '../../componentes/ui/textarea';
import { Input } from '../../componentes/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../componentes/ui/card';
import { Tabs, TabsContent } from '../../componentes/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../componentes/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../componentes/ui/select';
import { api } from '../../servicos/api';
import { toast } from 'sonner';
import { useProprietarioDetalhes } from './hooks/useProprietarioDetalhes';
import {
  CardNegociacao,
  CardContrato,
  CardTrackingIA,
  CardBriefingIA,
  FaseChecklist,
} from '../LeadDetalhes/componentes';

const ChatModal = lazy(() => import('../../componentes/ChatModal').then((m) => ({ default: m.ChatModal })));

type TabType = 'atendimento' | 'proprietario' | 'imovel' | 'qualificacao' | 'negociacao' | 'contrato' | 'atividades';

const limparTexto = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (texto.toLowerCase() === '[object object]') return null;
  return texto;
};

const normalizarLista = (valor: unknown): any[] => {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatarTelefone = (numero: string) => {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length === 11) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  if (limpo.length === 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  return numero;
};

const formatarCpf = (cpf: string) => {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length === 11) return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
  return cpf;
};

const formatarMoeda = (valor: number | string) => {
  const texto = String(valor).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(texto);
  if (Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num);
};

const formatarDataCurta = (data: string) =>
  new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

const formatarDataHora = (data: string) =>
  new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatarTipoImovel = (tipo: string | null) => {
  if (!tipo) return '-';
  const t = tipo.toUpperCase();
  if (t.includes('PREDIAL') || t.includes('APTO') || t.includes('APARTAMENTO')) return 'Apartamento';
  if (t.includes('TERRITORIAL') || t.includes('LOTE') || t.includes('TERRENO')) return 'Terreno/Lote';
  if (t.includes('CASA') && t.includes('CONDOMINIO')) return 'Casa em Condomínio';
  if (t.includes('CASA')) return 'Casa';
  if (t.includes('COMERCIAL')) return 'Comercial';
  return tipo;
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  AGUARDANDO: { label: 'Aguardando', color: 'text-slate-600', bg: 'bg-slate-100' },
  CONTATANDO: { label: 'Contatando', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  RESPONDEU: { label: 'Respondeu', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  INTERESSADO: { label: 'Interessado', color: 'text-violet-700', bg: 'bg-violet-50' },
  LEAD: { label: 'Lead', color: 'text-amber-700', bg: 'bg-amber-50' },
};

function extrairTelefones(contato: any, lead: any) {
  if (contato?.telefonesJson) {
    try {
      const parsed = typeof contato.telefonesJson === 'string' ? JSON.parse(contato.telefonesJson) : contato.telefonesJson;
      if (Array.isArray(parsed)) {
        return parsed
          .map((t: any) => (typeof t === 'string' ? { numero: t } : t))
          .filter((t: any) => limparTexto(t?.numero));
      }
    } catch {
      // fallback abaixo
    }
  }

  const base: any[] = [];
  const push = (numero: unknown, principal = false, whatsapp = false) => {
    const limpo = limparTexto(numero);
    if (limpo) base.push({ numero: limpo, principal, whatsapp });
  };
  push(contato?.telefone ?? lead?.telefone, true, true);
  push(contato?.telefone2 ?? lead?.telefone2, false, true);
  push(contato?.telefone3 ?? lead?.telefone3);
  push(contato?.telefone4);
  push(contato?.telefone5);
  return base;
}

function extrairEmails(contato: any, lead: any) {
  if (contato?.emailsJson) {
    try {
      const parsed = typeof contato.emailsJson === 'string' ? JSON.parse(contato.emailsJson) : contato.emailsJson;
      if (Array.isArray(parsed)) {
        return parsed
          .map((e: any) => (typeof e === 'string' ? { email: e } : e))
          .filter((e: any) => limparTexto(e?.email));
      }
    } catch {
      // fallback abaixo
    }
  }
  const base: any[] = [];
  const push = (email: unknown) => {
    const limpo = limparTexto(email);
    if (limpo) base.push({ email: limpo });
  };
  push(contato?.email ?? lead?.email);
  push(contato?.email2 ?? lead?.email2);
  push(contato?.email3);
  return base;
}

export default function ProprietarioDetalhes() {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useProprietarioDetalhes();

  const [activeTab, setActiveTab] = useState<TabType>('atendimento');
  const [alternandoModo, setAlternandoModo] = useState(false);
  const [promovendo, setPromovendo] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [processandoCrm, setProcessandoCrm] = useState<null | 'status' | 'enviar' | 'reenviar'>(null);
  const [resumoCrm, setResumoCrm] = useState<string>('');
  const [modalAtividade, setModalAtividade] = useState(false);
  const [salvandoAtividade, setSalvandoAtividade] = useState(false);
  const [formAtividade, setFormAtividade] = useState({
    tipo: 'TAREFA',
    titulo: '',
    descricao: '',
    agendadoPara: '',
    resultado: '',
  });

  const [processandoGestao, setProcessandoGestao] = useState(false);
  const [confirmGestao, setConfirmGestao] = useState<null | 'desativar' | 'blacklist' | 'removerLead' | 'excluir'>(null);

  const campanha = dados?.campanha;
  const lead = dados?.lead;
  const contato = dados?.contato;
  const nome = limparTexto(contato?.nome) || limparTexto(lead?.nome) || 'Proprietário';
  const temLeadReal = !!lead;

  const leadVisual = useMemo(() => {
    if (lead) {
      return {
        ...lead,
        imovel: lead.imovel || {},
        atividades: dados?.atividades || lead.atividades || [],
        conversas: dados?.conversas || lead.conversas || [],
      };
    }
    if (!contato) return null;
    return {
      id: contato.id,
      nome: contato.nome,
      telefone: limparTexto(contato.telefone),
      telefone2: limparTexto(contato.telefone2),
      telefone3: limparTexto(contato.telefone3),
      email: limparTexto(contato.email),
      email2: limparTexto(contato.email2),
      cpf: limparTexto(contato.cpf),
      idade: contato.idade,
      sexo: limparTexto(contato.sexo),
      rendaEstimada: limparTexto(contato.rendaEstimada),
      faixaSalarial: limparTexto(contato.faixaSalarial),
      scoreAssertiva: contato.scoreAssertiva,
      empresaAtual: limparTexto(contato.empresaAtual),
      profissao: limparTexto(contato.profissao),
      setor: limparTexto(contato.setor),
      cnpjEmpresa: limparTexto(contato.cnpjEmpresa),
      enderecoImovel: limparTexto(contato.enderecoImovel),
      tipoImovel: limparTexto(contato.tipoImovel),
      nomeEdificio: limparTexto(contato.nomeEdificio),
      bairroImovel: limparTexto(contato.bairroImovel),
      inscricaoIptu: limparTexto(contato.inscricaoIptu),
      valorVenal: limparTexto(contato.valorVenal),
      imovel: {
        endereco: limparTexto(contato.enderecoImovel),
        tipo: limparTexto(contato.tipoImovel),
        area: limparTexto(contato.areaConstruida),
        quartos: null,
        vagas: null,
        valorPretendido: null,
        ocupacao: null,
        interesseEm: null,
      },
      status: 'NOVO',
      atividades: [],
      conversas: [],
      spin: {
        situacao: {},
        problema: { doresIdentificadas: [] },
        implicacao: {},
        necessidade: { objecoes: [] },
        observacoes: null,
      },
    };
  }, [lead, contato, dados?.atividades, dados?.conversas]);

  const telefones = useMemo(() => extrairTelefones(contato, lead), [contato, lead]);
  const emails = useMemo(() => extrairEmails(contato, lead), [contato, lead]);
  const telefonePrincipal = useMemo(() => telefones.find((t: any) => t.principal) || telefones[0], [telefones]);
  const emailPrincipal = useMemo(() => emails[0], [emails]);

  const statusProspeccao = limparTexto(contato?.statusProspeccao) || (temLeadReal ? 'LEAD' : 'AGUARDANDO');
  const statusInfo = statusConfig[statusProspeccao] || statusConfig.AGUARDANDO;
  const mostrarConversao = statusProspeccao === 'INTERESSADO' && !contato?.virouLead;

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
      const endpoints: Record<string, string> = {
        IA: 'devolver-ia',
        HUMANO: 'assumir-humano',
        PAUSADO: 'pausar',
      };
      await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/${endpoints[novoModo]}`);
      await recarregar();
      const mensagensToast: Record<string, string> = {
        IA: '🤖 IA reativada para este contato',
        HUMANO: '👤 Você assumiu a conversa',
        PAUSADO: '⏸️ Conversa pausada',
      };
      toast.success(mensagensToast[novoModo]);
    } catch {
      toast.error('Erro ao alternar modo');
    } finally {
      setAlternandoModo(false);
    }
  };

  const desativarContato = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.patch(`/campanhas/${campanha.id}/contatos/${contato.id}`, { statusProspeccao: 'SEM_INTERESSE' });
      toast.success('Contato desativado');
      setConfirmGestao(null);
      await recarregar();
    } catch {
      toast.error('Erro ao desativar contato');
    } finally {
      setProcessandoGestao(false);
    }
  };

  const blacklistContato = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/blacklist`, { motivo: 'MANUAL' });
      toast.success('Telefone adicionado à blacklist');
      setConfirmGestao(null);
      await recarregar();
    } catch {
      toast.error('Erro ao adicionar à blacklist');
    } finally {
      setProcessandoGestao(false);
    }
  };

  const removerLead = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.post(`/campanhas/${campanha.id}/contatos/${contato.id}/remover-lead`);
      toast.success('Lead removido. Contato restaurado como prospect.');
      setConfirmGestao(null);
      await recarregar();
    } catch {
      toast.error('Erro ao remover lead');
    } finally {
      setProcessandoGestao(false);
    }
  };

  const excluirContato = async () => {
    if (!campanha?.id || !contato?.id || processandoGestao) return;
    try {
      setProcessandoGestao(true);
      await api.delete(`/campanhas/${campanha.id}/contatos/${contato.id}`);
      toast.success('Contato excluído');
      navigate('/dashboard/proprietarios');
    } catch {
      toast.error('Erro ao excluir contato');
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
      if (leadId) {
        navigate(`/dashboard/proprietarios/${leadId}`);
      } else {
        await recarregar();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.erro || 'Erro ao promover contato');
    } finally {
      setPromovendo(false);
    }
  };

  const executarAcaoCrm = async (acao: 'status' | 'enviar' | 'reenviar') => {
    if (!lead?.id || processandoCrm) return;
    try {
      setProcessandoCrm(acao);
      if (acao === 'status') {
        const response = await api.get(`/leads/${lead.id}/crm/status`);
        const ok = !!response?.data?.sucesso;
        const textoStatus =
          response?.data?.resultado?.status ||
          response?.data?.resultado?.syncStatus ||
          response?.data?.resultado?.mensagem ||
          (ok ? 'Status atualizado.' : response?.data?.resultado?.error || 'Sem confirmação.');
        setResumoCrm(textoStatus);
        if (ok) {
          toast.success('Status do CRM atualizado.');
        } else {
          toast.warning(textoStatus);
        }
      } else {
        const endpoint = acao === 'enviar' ? 'enviar' : 'reenviar';
        const response = await api.post(`/leads/${lead.id}/crm/${endpoint}`);
        const ok = !!response?.data?.sucesso;
        const mensagem = response?.data?.mensagem || response?.data?.erro || (ok ? 'Operação concluída.' : 'Falha ao operar CRM.');
        setResumoCrm(mensagem);
        if (ok) {
          toast.success(mensagem);
        } else {
          toast.error(mensagem);
        }
      }
      await recarregar();
    } catch (error: any) {
      const mensagem = error?.response?.data?.erro || 'Erro ao executar ação CRM';
      setResumoCrm(mensagem);
      toast.error(mensagem);
    } finally {
      setProcessandoCrm(null);
    }
  };

  const criarAtividade = async () => {
    if (!lead?.id || !formAtividade.titulo.trim()) return;
    try {
      setSalvandoAtividade(true);
      await api.post(`/leads/${lead.id}/atividades`, {
        tipo: formAtividade.tipo,
        titulo: formAtividade.titulo.trim(),
        descricao: formAtividade.descricao.trim() || undefined,
        agendadoPara: formAtividade.agendadoPara || undefined,
        resultado: formAtividade.resultado.trim() || undefined,
      });
      toast.success('Atividade criada!');
      setModalAtividade(false);
      setFormAtividade({
        tipo: 'TAREFA',
        titulo: '',
        descricao: '',
        agendadoPara: '',
        resultado: '',
      });
      await recarregar();
    } catch (error: any) {
      toast.error(error?.response?.data?.erro || 'Erro ao criar atividade');
    } finally {
      setSalvandoAtividade(false);
    }
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
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'atendimento', label: 'Atendimento', icon: <Activity className="w-4 h-4" /> },
    { id: 'proprietario', label: 'Proprietário', icon: <User className="w-4 h-4" /> },
    { id: 'imovel', label: 'Imóvel', icon: <Home className="w-4 h-4" /> },
    { id: 'qualificacao', label: 'Qualificação', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'negociacao', label: 'Negociação', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'contrato', label: 'Contrato', icon: <FileText className="w-4 h-4" /> },
    { id: 'atividades', label: 'Atividades', icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/dashboard/proprietarios')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para proprietários</span>
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
                      <Phone className="w-3.5 h-3.5" />
                      {formatarTelefone(telefonePrincipal.numero)}
                    </span>
                  )}
                  {emailPrincipal?.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {emailPrincipal.email}
                    </span>
                  )}
                  {limparTexto(contato?.cpf || lead?.cpf) && (
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      {formatarCpf(limparTexto(contato?.cpf || lead?.cpf)!)}
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
                    <Phone className="w-4 h-4 mr-2" />
                    Ligar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success-dark text-white"
                    onClick={() => window.open(`https://wa.me/55${telefonePrincipal.numero.replace(/\D/g, '')}`, '_blank')}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </>
              )}
              {emailPrincipal?.email && (
                <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${emailPrincipal.email}`, '_blank')}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              )}

              {temLeadReal && (
                <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat do Lead
                </Button>
              )}

              {/* Dropdown de gestão manual */}
              {campanha?.id && contato?.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={desativarContato}
                      className="gap-2 cursor-pointer"
                      disabled={processandoGestao}
                    >
                      <BellOff className="w-4 h-4 text-slate-500" />
                      Desativar contato
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => setConfirmGestao('blacklist')}
                      className="gap-2 cursor-pointer text-orange-700"
                      disabled={processandoGestao}
                    >
                      <ShieldBan className="w-4 h-4" />
                      Enviar para blacklist
                    </DropdownMenuItem>

                    {contato?.virouLead && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setConfirmGestao('removerLead')}
                          className="gap-2 cursor-pointer text-violet-700"
                          disabled={processandoGestao}
                        >
                          <UserMinus className="w-4 h-4" />
                          Remover de leads
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmGestao('removerLead')}
                          className="gap-2 cursor-pointer text-violet-700"
                          disabled={processandoGestao}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Definir como contato
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmGestao('excluir')}
                      className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                      disabled={processandoGestao}
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir contato
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {mostrarConversao ? (
                <Button className="bg-brand hover:bg-brand-dark text-white ml-2 shadow-sm" onClick={promoverLead} disabled={promovendo}>
                  {promovendo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                  Promover a Oportunidade
                </Button>
              ) : contato?.virouLead ? (
                <Button
                  variant="outline"
                  className="ml-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  onClick={() => navigate(`/dashboard/proprietarios/${contato?.leadId || lead?.id}`)}
                >
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
              {confirmGestao === 'blacklist' && 'Enviar para blacklist?'}
              {confirmGestao === 'removerLead' && 'Remover de leads?'}
              {confirmGestao === 'excluir' && 'Excluir contato?'}
            </DialogTitle>
            <DialogDescription>
              {confirmGestao === 'blacklist' && 'O telefone deste contato será bloqueado e não receberá mais nenhuma mensagem. Esta ação pode ser revertida na lista de blacklist.'}
              {confirmGestao === 'removerLead' && 'O lead associado a este contato será removido e ele voltará ao status de prospect qualificado (Interessado). As conversas e atividades do lead serão perdidas.'}
              {confirmGestao === 'excluir' && 'O contato e todos os dados associados (mensagens, lead, atividades) serão excluídos permanentemente. Esta ação não pode ser desfeita.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmGestao(null)} disabled={processandoGestao}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={processandoGestao}
              onClick={() => {
                if (confirmGestao === 'blacklist') blacklistContato();
                else if (confirmGestao === 'removerLead') removerLead();
                else if (confirmGestao === 'excluir') excluirContato();
              }}
            >
              {processandoGestao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {confirmGestao === 'blacklist' && 'Confirmar blacklist'}
              {confirmGestao === 'removerLead' && 'Remover lead'}
              {confirmGestao === 'excluir' && 'Excluir permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200">
            <nav className="flex -mb-px overflow-x-auto">
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
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
              <TabsContent value="atendimento">
                <TabAtendimento
                  contato={contato}
                  lead={lead}
                  statusInfo={statusInfo}
                  alternarModo={alternarModo}
                  alternandoModo={alternandoModo}
                />
              </TabsContent>

              <TabsContent value="proprietario">
                <TabProprietario
                  contato={contato || leadVisual}
                  telefones={telefones}
                  emails={emails}
                  copiar={copiar}
                  copiado={copiado}
                />
              </TabsContent>

              <TabsContent value="imovel">
                <TabImovel contato={contato || leadVisual} copiar={copiar} copiado={copiado} />
              </TabsContent>

              <TabsContent value="qualificacao">
                {leadVisual ? (
                  <TabQualificacao lead={leadVisual as any} temLeadReal={temLeadReal} />
                ) : (
                  <Card>
                    <CardContent className="p-4 text-sm text-slate-500">Sem dados de qualificação ainda.</CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="negociacao">
                {temLeadReal ? (
                  <CardNegociacao lead={leadVisual as any} />
                ) : (
                  <Card>
                    <CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="contrato">
                {temLeadReal ? (
                  <CardContrato lead={leadVisual as any} onUpdate={recarregar} />
                ) : (
                  <Card>
                    <CardContent className="p-4 text-sm text-slate-500">Disponível após conversão em lead.</CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="atividades">
                <div className="space-y-4">
                  {temLeadReal && (
                    <Card className="border-indigo-200">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Bot className="w-4 h-4 text-indigo-500" />
                          Integração CRM
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
                          <Button variant="outline" disabled={processandoCrm !== null} onClick={() => executarAcaoCrm('status')}>
                            {processandoCrm === 'status' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                            Verificar
                          </Button>
                          <Button variant="outline" disabled={processandoCrm !== null} onClick={() => executarAcaoCrm('enviar')}>
                            {processandoCrm === 'enviar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Enviar
                          </Button>
                          <Button variant="outline" disabled={processandoCrm !== null} onClick={() => executarAcaoCrm('reenviar')}>
                            {processandoCrm === 'reenviar' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Reenviar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <CardTitle>Atividades</CardTitle>
                      {temLeadReal && (
                        <Button size="sm" onClick={() => setModalAtividade(true)}>
                          <CalendarPlus className="w-4 h-4 mr-2" />
                          Nova Atividade
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
                      {(dados.atividades || []).length === 0 && <p className="text-sm text-slate-500">Sem atividades registradas.</p>}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {temLeadReal && (
        <>
          <Suspense fallback={null}>
            <ChatModal
              lead={{
                id: leadVisual.id,
                nome: leadVisual.nome || nome,
                telefone: leadVisual.telefone || null,
              }}
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
                  <Select value={formAtividade.tipo} onValueChange={(v) => setFormAtividade((prev) => ({ ...prev, tipo: v }))}>
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
                  <Input
                    id="atividade-titulo"
                    value={formAtividade.titulo}
                    onChange={(e) => setFormAtividade((prev) => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Ex: confirmar documentação pendente"
                  />
                </div>
                <div>
                  <label htmlFor="atividade-descricao" className="text-sm font-medium">Descrição</label>
                  <Textarea
                    id="atividade-descricao"
                    value={formAtividade.descricao}
                    onChange={(e) => setFormAtividade((prev) => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Detalhes da atividade"
                  />
                </div>
                <div>
                  <label htmlFor="atividade-agendado-para" className="text-sm font-medium">Agendado para</label>
                  <Input
                    id="atividade-agendado-para"
                    type="datetime-local"
                    value={formAtividade.agendadoPara}
                    onChange={(e) => setFormAtividade((prev) => ({ ...prev, agendadoPara: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="atividade-resultado" className="text-sm font-medium">Resultado (opcional)</label>
                  <Input
                    id="atividade-resultado"
                    value={formAtividade.resultado}
                    onChange={(e) => setFormAtividade((prev) => ({ ...prev, resultado: e.target.value }))}
                    placeholder="Ex: cliente confirmou visita"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalAtividade(false)}>Cancelar</Button>
                <Button onClick={criarAtividade} disabled={salvandoAtividade || !formAtividade.titulo.trim()}>
                  {salvandoAtividade && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Criar atividade
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function TabAtendimento({
  contato,
  lead,
  statusInfo,
  alternarModo,
  alternandoModo,
}: {
  contato: any;
  lead: any;
  statusInfo: { label: string; color: string; bg: string };
  alternarModo: (modo: 'IA' | 'HUMANO' | 'PAUSADO') => void;
  alternandoModo: boolean;
}) {
  const modoAtual = contato?.modoAtendimento || 'IA';
  const scoreAssertiva = contato?.scoreAssertiva ?? lead?.scoreAssertiva;
  const scoreQualificacao = contato?.scoreQualificacao ?? lead?.scoreQualificacao;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Status da Prospecção</h3>
          </div>
          <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${statusInfo.color} ${statusInfo.bg}`}>{statusInfo.label}</div>
          {contato?.criadoEm && <p className="text-xs text-slate-400 mt-3">Criado em {formatarDataCurta(contato.criadoEm)}</p>}
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Modo de Atendimento</h3>
          </div>
          {contato?.id ? (
            <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200">
              <Button
                variant={modoAtual === 'IA' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => alternarModo('IA')}
                disabled={alternandoModo || modoAtual === 'IA'}
                className={`flex-1 h-9 ${modoAtual === 'IA' ? 'bg-brand hover:bg-brand-dark text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Bot className="w-4 h-4 mr-1.5" />
                IA
              </Button>
              <Button
                variant={modoAtual === 'HUMANO' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => alternarModo('HUMANO')}
                disabled={alternandoModo || modoAtual === 'HUMANO'}
                className={`flex-1 h-9 ${modoAtual === 'HUMANO' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <User className="w-4 h-4 mr-1.5" />
                Humano
              </Button>
              <Button
                variant={modoAtual === 'PAUSADO' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => alternarModo('PAUSADO')}
                disabled={alternandoModo || modoAtual === 'PAUSADO'}
                className={`flex-1 h-9 ${modoAtual === 'PAUSADO' ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Pause className="w-4 h-4 mr-1.5" />
                Pausado
              </Button>
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
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all" style={{ width: `${Math.min(100, scoreAssertiva)}%` }} />
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
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, scoreQualificacao)}%` }} />
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
    </div>
  );
}

const temValorQualificacao = (valor: unknown) => {
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === 'boolean') return true;
  return !!limparTexto(valor);
};

const formatarBooleanoQualificacao = (valor: unknown) => {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return null;
};

function CampoQualificacao({ label, valor }: { label: string; valor: unknown }) {
  const texto = Array.isArray(valor)
    ? valor.join(', ')
    : formatarBooleanoQualificacao(valor) || limparTexto(valor);

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
  const spin = lead?.spin || {};
  const situacao = spin.situacao || {};
  const problema = spin.problema || {};
  const implicacao = spin.implicacao || {};
  const necessidade = spin.necessidade || {};
  const faseSPIN = lead?.conversas?.[0]?.faseSPIN || 'Não iniciada';

  const campos = [
    situacao.situacaoAtual,
    situacao.tempoDecisao,
    situacao.tentativasAnteriores,
    situacao.comCorretorAtualmente,
    problema.motivacaoVenda,
    problema.doresIdentificadas,
    implicacao.prazoDesejado,
    implicacao.urgencia,
    implicacao.consequencias,
    implicacao.custosAtuais,
    implicacao.pressaoTempo,
    necessidade.expectativaServico,
    necessidade.objecoes,
    necessidade.interesseAvaliacao,
    spin.observacoes,
  ];
  const preenchidos = campos.filter(temValorQualificacao).length;
  const percentual = Math.round((preenchidos / campos.length) * 100);

  const lacunas = [
    !temValorQualificacao(situacao.situacaoAtual) && 'Situação atual do imóvel',
    !temValorQualificacao(problema.motivacaoVenda) && 'Motivação para vender/alugar',
    !temValorQualificacao(problema.doresIdentificadas) && 'Dores explícitas do proprietário',
    !temValorQualificacao(implicacao.prazoDesejado) && 'Prazo/urgência desejada',
    !temValorQualificacao(necessidade.expectativaServico) && 'Expectativa sobre a solução/imobiliária',
    !temValorQualificacao(necessidade.objecoes) && 'Objeções ou travas de decisão',
  ].filter(Boolean) as string[];

  const resumoAtendimento =
    limparTexto(lead?.briefingCloser) ||
    limparTexto(spin.observacoes) ||
    limparTexto(lead?.ultimaAcaoIA) ||
    null;

  if (!temLeadReal) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Qualificação ainda não iniciada</h3>
            <p className="text-sm text-amber-800 mt-1">
              Este proprietário ainda não virou lead qualificado. A aba será preenchida quando a IA coletar dados de atendimento, SPIN e intenção comercial.
            </p>
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
            <ClipboardCheck className="w-5 h-5 text-brand" />
            Diagnóstico Comercial e SPIN
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
                <HelpCircle className="w-4 h-4 text-slate-400" />
                S - Situação
              </h3>
              <CampoQualificacao label="Situação atual" valor={situacao.situacaoAtual} />
              <CampoQualificacao label="Tempo de decisão" valor={situacao.tempoDecisao} />
              <CampoQualificacao label="Tentativas anteriores" valor={situacao.tentativasAnteriores} />
              <CampoQualificacao label="Com corretor atualmente" valor={situacao.comCorretorAtualmente} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">P - Problema</h3>
              <CampoQualificacao label="Motivação" valor={problema.motivacaoVenda} />
              <CampoQualificacao label="Dores identificadas" valor={problema.doresIdentificadas} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">I - Implicação</h3>
              <CampoQualificacao label="Prazo desejado" valor={implicacao.prazoDesejado} />
              <CampoQualificacao label="Consequências" valor={implicacao.consequencias} />
              <CampoQualificacao label="Custos atuais" valor={implicacao.custosAtuais} />
              <CampoQualificacao label="Pressão de tempo" valor={implicacao.pressaoTempo} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">N - Necessidade de Solução</h3>
              <CampoQualificacao label="Expectativa de serviço" valor={necessidade.expectativaServico} />
              <CampoQualificacao label="Objeções" valor={necessidade.objecoes} />
              <CampoQualificacao label="Aceitou avaliação" valor={necessidade.interesseAvaliacao} />
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4">
            <h3 className="font-semibold text-amber-900 mb-2">Lacunas para a próxima interação</h3>
            {lacunas.length > 0 ? (
              <ul className="space-y-1">
                {lacunas.map((lacuna) => (
                  <li key={lacuna} className="text-sm text-amber-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {lacuna}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Diagnóstico comercial mínimo preenchido.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CardBriefingIA lead={lead} />
      <FaseChecklist lead={lead} />
      <CardTrackingIA lead={lead} />
    </div>
  );
}

function TabProprietario({
  contato,
  telefones,
  emails,
  copiar,
  copiado,
}: {
  contato: any;
  telefones: any[];
  emails: any[];
  copiar: (texto: string, tipo: string) => void;
  copiado: string | null;
}) {
  if (!contato) return null;
  const participacoesEmpresas = normalizarLista(contato?.participacoesEmpresas);
  const redesSociais = normalizarLista(contato?.redesSociais);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Dados Pessoais</h3>
          </div>
          <div className="space-y-3">
            {(contato.idade || contato.sexo) && (
              <div className="grid grid-cols-2 gap-3">
                {contato.idade && (
                  <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                    <p className="text-2xl font-bold text-slate-900">{contato.idade}</p>
                    <p className="text-xs text-slate-500">anos</p>
                  </div>
                )}
                {contato.sexo && (
                  <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                    <p className="text-sm font-semibold text-slate-900">{contato.sexo}</p>
                    {contato.signo && <p className="text-xs text-slate-500">{contato.signo}</p>}
                  </div>
                )}
              </div>
            )}
            {limparTexto(contato.cpf) && (
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-500">CPF</span>
                <span className="text-sm font-mono text-slate-900">{formatarCpf(contato.cpf)}</span>
              </div>
            )}
            {limparTexto(contato.dataNascimento) && (
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-500">Nascimento</span>
                <span className="text-sm text-slate-900">{String(contato.dataNascimento).includes('T') ? formatarDataCurta(contato.dataNascimento) : contato.dataNascimento}</span>
              </div>
            )}
            {limparTexto(contato.nomeMae) && (
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-500">Mãe</span>
                <span className="text-sm text-slate-900 text-right max-w-[60%] truncate">{contato.nomeMae}</span>
              </div>
            )}
            {limparTexto(contato.cpfMae) && (
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-500">CPF da mãe</span>
                <span className="text-sm font-mono text-slate-900">{formatarCpf(contato.cpfMae)}</span>
              </div>
            )}
            {limparTexto(contato.estadoCivil) && (
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-500">Estado civil</span>
                <span className="text-sm text-slate-900">{contato.estadoCivil}</span>
              </div>
            )}
            {limparTexto(contato.escolaridade) && (
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-sm text-slate-500">Escolaridade</span>
                <span className="text-sm text-slate-900 text-right max-w-[60%]">{contato.escolaridade}</span>
              </div>
            )}
            {limparTexto(contato.situacaoCadastral) && (
              <div className="flex justify-between py-2">
                <span className="text-sm text-slate-500">Situação</span>
                <span className={`text-sm font-medium ${contato.situacaoCadastral === 'REGULAR' ? 'text-emerald-600' : 'text-amber-600'}`}>{contato.situacaoCadastral}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-indigo-900">Dados Profissionais</h3>
          </div>
          <div className="space-y-3">
            {limparTexto(contato.empresaAtual) && (
              <div>
                <p className="text-xs text-indigo-500 uppercase mb-1">Empresa</p>
                <p className="text-sm font-medium text-indigo-900">{contato.empresaAtual}</p>
              </div>
            )}
            {limparTexto(contato.profissao) && (
              <div>
                <p className="text-xs text-indigo-500 uppercase mb-1">Cargo/Profissão</p>
                <p className="text-sm text-indigo-800">{contato.profissao}</p>
              </div>
            )}
            {limparTexto(contato.setor) && (
              <div>
                <p className="text-xs text-indigo-500 uppercase mb-1">Setor</p>
                <p className="text-sm text-indigo-800">{contato.setor}</p>
              </div>
            )}
            {limparTexto(contato.cnpjEmpresa) && (
              <div>
                <p className="text-xs text-indigo-500 uppercase mb-1">CNPJ Empresa</p>
                <p className="text-sm font-mono text-indigo-900">{contato.cnpjEmpresa}</p>
              </div>
            )}
            {limparTexto(contato.rendaEstimada) && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 mt-3 border border-emerald-200">
                <p className="text-xs text-emerald-600 uppercase mb-1">Renda Estimada</p>
                <p className="text-xl font-bold text-emerald-700">{formatarMoeda(contato.rendaEstimada)}</p>
                {limparTexto(contato.faixaSalarial) && <p className="text-xs text-emerald-600 mt-1">{contato.faixaSalarial}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-emerald-900">Telefones</h3>
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{telefones.length}</span>
          </div>
          <div className="space-y-2">
            {telefones.slice(0, 5).map((tel: any, idx: number) => (
              <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-emerald-200 hover:border-emerald-300 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900">{formatarTelefone(tel.numero)}</span>
                  {tel.whatsapp && <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">WhatsApp</span>}
                </div>
                <button onClick={() => copiar(tel.numero, 'Telefone')} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-emerald-100 transition-all">
                  {copiado === 'Telefone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-violet-50 rounded-xl p-5 border border-violet-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold text-violet-900">Emails</h3>
            </div>
            <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">{emails.filter((e: any) => e?.email).length}</span>
          </div>
          <div className="space-y-2">
            {emails.filter((e: any) => e?.email).slice(0, 5).map((email: any, idx: number) => (
              <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-violet-200 hover:border-violet-300 transition-colors">
                <span className="text-sm font-medium text-slate-900 truncate flex-1">{email.email}</span>
                <button onClick={() => copiar(email.email, 'Email')} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-violet-100 transition-all flex-shrink-0">
                  {copiado === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900">Compliance e Risco</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-600">PPE</span>
                <HelpCircle
                  className="w-3.5 h-3.5 text-slate-400"
                  title="PPE significa Pessoa Politicamente Exposta (também chamada PEP): pessoa com cargo ou função pública relevante, atual ou nos últimos 5 anos, conforme regras de compliance/PLD."
                />
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${contato?.ppe ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                {contato?.ppe ? 'Sim' : 'Não'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-3 py-2">
              <span className="text-sm text-slate-600">Óbito provável</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${contato?.obitoProvavel ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {contato?.obitoProvavel ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-sky-50 rounded-xl p-5 border border-sky-100">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-sky-600" />
            <h3 className="font-semibold text-sky-900">Endereço Residencial</h3>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-slate-800 font-medium">
              {limparTexto(contato.endereco) || '-'}
            </p>
            <p className="text-xs text-slate-600">
              {[limparTexto(contato.cidade), limparTexto(contato.estado)].filter(Boolean).join(' - ') || '-'}
            </p>
            {limparTexto(contato.cep) && <p className="text-xs text-slate-500">CEP: {contato.cep}</p>}
          </div>
        </div>
      </div>

      {(participacoesEmpresas.length > 0 || redesSociais.length > 0) && (
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Dados Societários e Redes</h3>
            {contato?.perfilInvestidor && <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">Perfil investidor</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Participações</p>
              {participacoesEmpresas.length === 0 && <p className="text-sm text-slate-400">Sem participações registradas.</p>}
              {participacoesEmpresas.slice(0, 5).map((p: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-slate-200 p-2.5">
                  <p className="text-sm font-medium text-slate-800">{p?.razaoSocial || '-'}</p>
                  <p className="text-xs text-slate-500">{p?.cnpj || '-'}{p?.participacao ? ` • ${p.participacao}` : ''}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Redes Sociais</p>
              {redesSociais.length === 0 && <p className="text-sm text-slate-400">Sem redes sociais registradas.</p>}
              {redesSociais.slice(0, 5).map((r: any, idx: number) => (
                <a
                  key={idx}
                  href={limparTexto(r?.url) || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-800">{limparTexto(r?.rede) || 'Rede'}</p>
                  <p className="text-xs text-slate-500 truncate">{limparTexto(r?.url) || '-'}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabImovel({
  contato,
  copiar,
  copiado,
}: {
  contato: any;
  copiar: (texto: string, tipo: string) => void;
  copiado: string | null;
}) {
  if (!contato) return null;

  const temDadosImovel = contato?.nomeEdificio || contato?.enderecoImovel || contato?.apartamento || contato?.inscricaoIptu;
  if (!temDadosImovel) {
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-indigo-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-7 h-7 text-brand" />
          </div>
          <div className="flex-1">
            {limparTexto(contato.nomeEdificio) && <h1 className="text-2xl font-black text-slate-900 tracking-tight">{contato.nomeEdificio}</h1>}
            <p className="text-sm text-brand font-medium mt-1 uppercase tracking-wider">Identificação do Edifício</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <MapPin className="w-5 h-5 text-brand" />
          <h3 className="font-bold text-lg text-slate-800">Dossiê de Localização e Unidade</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Endereço Completo</p>
              <p className="text-sm font-semibold text-slate-900">{limparTexto(contato.enderecoImovel) || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bairro</p>
              <p className="text-sm font-semibold text-slate-900">{limparTexto(contato.bairroImovel) || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quadra</p>
                <p className="text-sm font-semibold text-slate-900">{limparTexto(contato.quadra) || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Lote</p>
                <p className="text-sm font-semibold text-slate-900">{limparTexto(contato.lote) || '-'}</p>
              </div>
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
            {limparTexto(contato.areaConstruida) && (
              <div className="bg-emerald-600 rounded-lg p-4 text-white shadow-md text-center">
                <p className="text-[11px] text-emerald-100 font-bold uppercase tracking-wider mb-1">Tamanho do Apartamento</p>
                <p className="text-3xl font-black">{contato.areaConstruida} m²</p>
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
            <Button variant="outline" size="sm" onClick={() => copiar(contato.inscricaoIptu, 'IPTU')} className="hover:bg-slate-50">
              {copiado === 'IPTU' ? <Check className="w-4 h-4 text-emerald-500 mr-2" /> : <Copy className="w-4 h-4 text-slate-400 mr-2" />}
              Copiar IPTU
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <span className="text-sm text-slate-500">Área do Condomínio</span>
                <span className="text-sm font-medium text-slate-900">{contato.areaTerreno} m²</span>
              </div>
            )}
            {limparTexto(contato.valorVenal) && (
              <div className="flex justify-between py-2">
                <span className="text-sm text-slate-500">Valor Venal</span>
                <span className="text-sm font-medium text-emerald-600">{formatarMoeda(contato.valorVenal)}</span>
              </div>
            )}
            {limparTexto(contato.anoConstituicao) && (
              <div className="flex justify-between py-2 border-t border-slate-200">
                <span className="text-sm text-slate-500">Ano de Constituição</span>
                <span className="text-sm font-medium text-slate-900">{contato.anoConstituicao}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
