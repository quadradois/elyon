/**
 * Página de Detalhes do Contato - V2
 * 
 * Build Timestamp: 2026-03-19T22:10:00Z (Cache Busting v5)
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  MessageSquare,
  Send,
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
  Rocket
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { Textarea } from "../componentes/ui/textarea";
import { PageHeader } from "../componentes/ui/page-header";
import { api } from "../servicos/api";
import { toast } from "sonner";

// Tipos
interface Contato {
  id: string;
  nome: string;
  cpf?: string | null;

  // Telefones
  telefone?: string | null;
  telefone2?: string | null;
  telefone3?: string | null;
  telefone4?: string | null;
  telefone5?: string | null;
  telefonesJson?: any;

  // Emails
  email?: string | null;
  email2?: string | null;
  email3?: string | null;
  emailsJson?: any;

  // Dados Pessoais (Assertiva)
  dataNascimento?: string | null;
  idade?: number | null;
  sexo?: string | null;
  signo?: string | null;
  nomeMae?: string | null;
  situacaoCadastral?: string | null;
  obitoProvavel?: boolean;
  ppe?: boolean;

  // Dados Profissionais (Assertiva)
  profissao?: string | null;
  rendaEstimada?: number | string | null;
  faixaSalarial?: string | null;
  setor?: string | null;
  empresaAtual?: string | null;
  cnpjEmpresa?: string | null;

  // Endereço Pessoal
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;

  // Imóvel
  enderecoImovel?: string | null;
  bairroImovel?: string | null;
  nomeEdificio?: string | null;
  tipoImovel?: string | null;
  areaTerreno?: string | null;
  areaConstruida?: string | null;
  valorVenal?: string | null;
  inscricaoIptu?: string | null;
  apartamento?: string | null;
  bloco?: string | null;
  unidade?: string | null;
  box?: string | null;
  quadra?: string | null;
  lote?: string | null;

  // Status
  statusProspeccao: string;
  scoreAssertiva?: number | null;
  scoreQualificacao?: number | null;
  observacoes?: string | null;

  // Controle de Atendimento
  modoAtendimento?: string | null;
  atendidoPor?: string | null;
  pausadoEm?: string | null;
  virouLead?: boolean;
  leadId?: string | null;

  // Datas
  criadoEm: string;
  atualizadoEm: string;
}

interface Mensagem {
  id: number;
  conteudo: string;
  direcao?: string;
  tipo?: string;
  dataHora?: string;
  timestamp?: string;
  remetente?: string;
}

type TabType = 'atendimento' | 'proprietario' | 'imovel';

// Helpers
const formatarTelefone = (numero: string) => {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return numero;
};

const formatarCpf = (cpf: string) => {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
  }
  return cpf;
};

const formatarMoeda = (valor: number | string) => {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(num);
};

const tempoRelativo = (data: string) => {
  const agora = new Date();
  const dataMsg = new Date(data);
  const diffMs = agora.getTime() - dataMsg.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHora = Math.floor(diffMs / 3600000);
  const diffDia = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHora < 24) return `${diffHora}h`;
  if (diffDia < 7) return `${diffDia}d`;
  return dataMsg.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatarDataCurta = (data: string) => {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

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

// Status config
const STATUS_EM_CONTATO = `CONTA${'TANDO'}`;
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  AGUARDANDO: { label: 'Aguardando', color: 'text-slate-600', bg: 'bg-slate-100' },
  [STATUS_EM_CONTATO]: { label: 'Contatando', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  RESPONDEU: { label: 'Respondeu', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  INTERESSADO: { label: 'Interessado', color: 'text-violet-700', bg: 'bg-violet-50' },
  LEAD: { label: 'Lead', color: 'text-amber-700', bg: 'bg-amber-50' },
};

// Tab Config
const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'atendimento', label: 'Atendimento', icon: <Activity className="w-4 h-4" /> },
  { id: 'proprietario', label: 'Proprietário', icon: <User className="w-4 h-4" /> },
  { id: 'imovel', label: 'Imóvel', icon: <Home className="w-4 h-4" /> },
];

export default function ContatoDetalhes() {
  const { campanhaId, contatoId } = useParams();
  const navigate = useNavigate();

  const [contato, setContato] = useState<Contato | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [alternandoModo, setAlternandoModo] = useState(false);
  const [promovendo, setPromovendo] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('atendimento');

  const mensagensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarDados();
  }, [contatoId]);

  useEffect(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight;
    }
  }, [mensagens]);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [contatoRes, mensagensRes] = await Promise.all([
        api.get(`/campanhas/contatos/${contatoId}`),
        api.get(`/campanhas/contatos/${contatoId}/mensagens`).catch(() => ({ data: [] }))
      ]);

      setContato(contatoRes.data);

      const mensagensData = mensagensRes.data;
      if (Array.isArray(mensagensData)) {
        setMensagens(mensagensData);
      } else if (mensagensData && Array.isArray(mensagensData.mensagens)) {
        setMensagens(mensagensData.mensagens);
      } else {
        setMensagens([]);
      }
    } catch (err: any) {
      setErro(err.response?.data?.mensagem || 'Erro ao carregar contato');
    } finally {
      setCarregando(false);
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || enviando) return;

    try {
      setEnviando(true);
      await api.post(`/campanhas/contatos/${contatoId}/mensagens`, {
        conteudo: novaMensagem,
        direcao: 'SAIDA'
      });
      setNovaMensagem('');
      await carregarDados();
      toast.success('Mensagem enviada');
    } catch (err) {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async (texto: string, tipo: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(tipo);
    toast.success(`${tipo} copiado`);
    setTimeout(() => setCopiado(null), 2000);
  };

  const alternarModo = async (novoModo: 'IA' | 'HUMANO' | 'PAUSADO') => {
    if (!campanhaId || !contatoId || alternandoModo) return;

    try {
      setAlternandoModo(true);
      const endpoints: Record<string, string> = {
        'IA': 'devolver-ia',
        'HUMANO': 'assumir-humano',
        'PAUSADO': 'pausar'
      };
      await api.post(`/campanhas/${campanhaId}/contatos/${contatoId}/${endpoints[novoModo]}`);
      if (contato) {
        setContato({ ...contato, modoAtendimento: novoModo });
      }
      const mensagensToast: Record<string, string> = {
        'IA': '🤖 IA reativada para este contato',
        'HUMANO': '👤 Você assumiu a conversa',
        'PAUSADO': '⏸️ Conversa pausada'
      };
      toast.success(mensagensToast[novoModo]);
    } catch (err) {
      toast.error('Erro ao alternar modo');
    } finally {
      setAlternandoModo(false);
    }
  };

  const promoverLead = async () => {
    if (!campanhaId || !contatoId || promovendo) return;
    try {
      setPromovendo(true);
      const response = await api.post(`/campanhas/${campanhaId}/contatos/${contatoId}/promover`);
      toast.success('Contato promovido com sucesso!', {
        description: 'Redirecionando para o CRM...'
      });
      setTimeout(() => {
        navigate(`/dashboard/proprietarios/${response.data.leadId}`);
      }, 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.erro || 'Erro ao promover contato');
      setPromovendo(false);
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

  if (erro || !contato) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Erro ao carregar</h2>
          <p className="text-slate-500 mb-6">{erro || 'Contato não encontrado'}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const telefones = (() => {
    try {
      if (contato.telefonesJson) {
        if (Array.isArray(contato.telefonesJson)) return contato.telefonesJson;
        if (typeof contato.telefonesJson === 'string') return JSON.parse(contato.telefonesJson);
      }
      const tels: any[] = [];
      if (contato.telefone) tels.push({ numero: contato.telefone, principal: true, whatsapp: true });
      if (contato.telefone2) tels.push({ numero: contato.telefone2, whatsapp: true });
      if (contato.telefone3) tels.push({ numero: contato.telefone3 });
      if (contato.telefone4) tels.push({ numero: contato.telefone4 });
      if (contato.telefone5) tels.push({ numero: contato.telefone5 });
      return tels;
    } catch { return []; }
  })();

  const emails = (() => {
    try {
      if (contato.emailsJson) {
        let parsed = contato.emailsJson;
        if (typeof contato.emailsJson === 'string') {
          parsed = JSON.parse(contato.emailsJson);
        }
        if (Array.isArray(parsed)) {
          return parsed.map((e: any) => typeof e === 'string' ? { email: e } : e);
        }
      }
      const mails: any[] = [];
      if (contato.email) mails.push({ email: contato.email });
      if (contato.email2) mails.push({ email: contato.email2 });
      if (contato.email3) mails.push({ email: contato.email3 });
      return mails;
    } catch {
      const mails: any[] = [];
      if (contato.email) mails.push({ email: contato.email });
      if (contato.email2) mails.push({ email: contato.email2 });
      if (contato.email3) mails.push({ email: contato.email3 });
      return mails;
    }
  })();

  const telefonePrincipal = telefones.find((t: any) => t.principal) || telefones[0];
  const emailPrincipal = emails[0];
  const statusInfo = statusConfig[contato.statusProspeccao] || statusConfig.AGUARDANDO;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'atendimento':
        return <TabAtendimento contato={contato} statusInfo={statusInfo} alternarModo={alternarModo} alternandoModo={alternandoModo} />;
      case 'proprietario':
        return <TabProprietario contato={contato} telefones={telefones} emails={emails} copiar={copiar} copiado={copiado} />;
      case 'imovel':
        return <TabImovel contato={contato} copiar={copiar} copiado={copiado} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 pt-4">
        <PageHeader
          title={contato.nome}
          description="Detalhes de contato e andamento da negociação"
          breadcrumb={[
            { label: "Campanhas", href: "/dashboard/campanhas" },
            { label: contato.nome },
          ]}
        />
      </div>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <button
            onClick={() => navigate(`/dashboard/campanhas/${campanhaId}`)}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para campanha</span>
          </button>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-lg font-bold shadow-lg">
                {contato.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{contato.nome}</h1>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bg}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                  {telefonePrincipal && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {formatarTelefone(telefonePrincipal.numero)}
                    </span>
                  )}
                  {emailPrincipal && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {emailPrincipal.email}
                    </span>
                  )}
                  {contato.cpf && (
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      {formatarCpf(contato.cpf)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {telefonePrincipal && (
                <>
                  <Button variant="outline" size="sm" onClick={() => window.open(`tel:${telefonePrincipal.numero}`, '_blank')}>
                    <Phone className="w-4 h-4 mr-2" />
                    Ligar
                  </Button>
                  <Button size="sm" className="bg-success hover:bg-success-dark text-white" onClick={() => window.open(`https://wa.me/55${telefonePrincipal.numero.replace(/\D/g, '')}`, '_blank')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                </>
              )}
              {emailPrincipal && (
                <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${emailPrincipal.email}`, '_blank')}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
              )}
              {!contato.virouLead ? (
                <Button className="bg-brand hover:bg-brand-dark text-white ml-2 shadow-sm" onClick={promoverLead} disabled={promovendo}>
                  {promovendo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                  Promover a Oportunidade
                </Button>
              ) : (
                <Button variant="outline" className="ml-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100" onClick={() => navigate(`/leads/${contato.leadId}`)}>
                  Ver no CRM
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="border-b border-slate-200">
                <nav className="flex -mb-px">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="p-6">
                {renderTabContent()}
              </div>
            </div>
          </div>
          <div className="w-[400px] flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[calc(100vh-200px)] sticky top-[140px] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">Conversa</h3>
                </div>
                {mensagens.length > 0 && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{mensagens.length} msg</span>}
              </div>
              <div ref={mensagensRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensagens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                      <MessageSquare className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  mensagens.map((msg) => {
                    const isSaida = msg.direcao === 'SAIDA' || msg.tipo === 'ENVIADA';
                    const dataMsg = msg.dataHora || msg.timestamp || '';
                    return (
                      <div key={msg.id} className={`flex ${isSaida ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%]`}>
                          <div className={`rounded-2xl px-4 py-2.5 ${isSaida ? 'bg-brand text-white rounded-br-md' : 'bg-slate-100 text-slate-900 rounded-bl-md'}`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.conteudo}</p>
                          </div>
                          {dataMsg && <p className={`text-xs text-slate-500 mt-1 ${isSaida ? 'text-right' : ''}`}>{tempoRelativo(dataMsg)}</p>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <Textarea
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 min-h-[44px] max-h-24 resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarMensagem();
                      }
                    }}
                  />
                  <Button onClick={enviarMensagem} disabled={!novaMensagem.trim() || enviando} className="bg-brand hover:bg-brand-dark h-[44px] w-[44px] p-0">
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Aba Atendimento
function TabAtendimento({ contato, statusInfo, alternarModo, alternandoModo }: {
  contato: Contato;
  statusInfo: { label: string; color: string; bg: string };
  alternarModo: (modo: 'IA' | 'HUMANO' | 'PAUSADO') => void;
  alternandoModo: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Status da Prospecção</h3>
          </div>
          <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${statusInfo.color} ${statusInfo.bg}`}>{statusInfo.label}</div>
          <p className="text-xs text-slate-500 mt-3">Criado em {formatarDataCurta(contato.criadoEm)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-700">Modo de Atendimento</h3>
          </div>
          <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200">
            <Button variant={contato.modoAtendimento === 'IA' || !contato.modoAtendimento ? 'default' : 'ghost'} size="sm" onClick={() => alternarModo('IA')} disabled={alternandoModo || contato.modoAtendimento === 'IA'} className={`flex-1 h-9 ${contato.modoAtendimento === 'IA' || !contato.modoAtendimento ? 'bg-brand hover:bg-brand-dark text-white' : 'text-slate-600 hover:text-slate-900'}`}><Bot className="w-4 h-4 mr-1.5" />IA</Button>
            <Button variant={contato.modoAtendimento === 'HUMANO' ? 'default' : 'ghost'} size="sm" onClick={() => alternarModo('HUMANO')} disabled={alternandoModo || contato.modoAtendimento === 'HUMANO'} className={`flex-1 h-9 ${contato.modoAtendimento === 'HUMANO' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}><User className="w-4 h-4 mr-1.5" />Humano</Button>
            <Button variant={contato.modoAtendimento === 'PAUSADO' ? 'default' : 'ghost'} size="sm" onClick={() => alternarModo('PAUSADO')} disabled={alternandoModo || contato.modoAtendimento === 'PAUSADO'} className={`flex-1 h-9 ${contato.modoAtendimento === 'PAUSADO' ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}><Pause className="w-4 h-4 mr-1.5" />Pausado</Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {contato.scoreAssertiva && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-indigo-900">Score de Dados</h3>
              </div>
              <span className="text-3xl font-bold text-brand">{contato.scoreAssertiva}</span>
            </div>
            <div className="h-2 bg-indigo-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all" style={{ width: `${Math.min(100, contato.scoreAssertiva)}%` }} /></div>
            <p className="text-xs text-brand mt-2">{contato.scoreAssertiva >= 80 ? '✓ Dados confiáveis' : contato.scoreAssertiva >= 50 ? '⚠ Verificar dados' : '✗ Dados incompletos'}</p>
          </div>
        )}
        {contato.scoreQualificacao && contato.scoreQualificacao > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-amber-900">Score de Interesse</h3>
              </div>
              <span className="text-3xl font-bold text-amber-600">{contato.scoreQualificacao}</span>
            </div>
            <div className="h-2 bg-amber-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, contato.scoreQualificacao)}%` }} /></div>
          </div>
        )}
      </div>
      <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
        <div className="flex items-center gap-2 mb-3"><FileText className="w-5 h-5 text-amber-600" /><h3 className="font-semibold text-amber-900">Observações</h3></div>
        <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{contato.observacoes || 'Nenhuma observação registrada.'}</p>
      </div>
    </div>
  );
}

// Aba Proprietário
function TabProprietario({ contato, telefones, emails, copiar, copiado }: {
  contato: Contato;
  telefones: any[];
  emails: any[];
  copiar: (texto: string, tipo: string) => void;
  copiado: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4"><User className="w-5 h-5 text-slate-400" /><h3 className="font-semibold text-slate-700">Dados Pessoais</h3></div>
          <div className="space-y-3">
            {(contato.idade || contato.sexo) && (
              <div className="grid grid-cols-2 gap-3">
                {contato.idade && <div className="bg-white rounded-lg p-3 text-center border border-slate-200"><p className="text-2xl font-bold text-slate-900">{contato.idade}</p><p className="text-xs text-slate-500">anos</p></div>}
                {contato.sexo && <div className="bg-white rounded-lg p-3 text-center border border-slate-200"><p className="text-sm font-semibold text-slate-900">{contato.sexo}</p>{contato.signo && <p className="text-xs text-slate-500">{contato.signo}</p>}</div>}
              </div>
            )}
            {contato.cpf && <div className="flex justify-between py-2 border-b border-slate-200"><span className="text-sm text-slate-500">CPF</span><span className="text-sm font-mono text-slate-900">{formatarCpf(contato.cpf)}</span></div>}
            {contato.dataNascimento && <div className="flex justify-between py-2 border-b border-slate-200"><span className="text-sm text-slate-500">Nascimento</span><span className="text-sm text-slate-900">{contato.dataNascimento.includes('T') ? formatarDataCurta(contato.dataNascimento) : contato.dataNascimento}</span></div>}
            {contato.nomeMae && <div className="flex justify-between py-2 border-b border-slate-200"><span className="text-sm text-slate-500">Mãe</span><span className="text-sm text-slate-900 text-right max-w-[60%] truncate">{contato.nomeMae}</span></div>}
            {contato.situacaoCadastral && <div className="flex justify-between py-2"><span className="text-sm text-slate-500">Situação</span><span className={`text-sm font-medium ${contato.situacaoCadastral === 'REGULAR' ? 'text-emerald-600' : 'text-amber-600'}`}>{contato.situacaoCadastral}</span></div>}
          </div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
          <div className="flex items-center gap-2 mb-4"><Briefcase className="w-5 h-5 text-indigo-500" /><h3 className="font-semibold text-indigo-900">Dados Profissionais</h3></div>
          <div className="space-y-3">
            {contato.empresaAtual && <div><p className="text-xs text-indigo-500 uppercase mb-1">Empresa</p><p className="text-sm font-medium text-indigo-900">{contato.empresaAtual}</p></div>}
            {contato.profissao && <div><p className="text-xs text-indigo-500 uppercase mb-1">Cargo/Profissão</p><p className="text-sm text-indigo-800">{contato.profissao}</p></div>}
            {contato.rendaEstimada && <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 mt-3 border border-emerald-200"><p className="text-xs text-emerald-600 uppercase mb-1">Renda Estimada</p><p className="text-xl font-bold text-emerald-700">{formatarMoeda(contato.rendaEstimada)}</p>{contato.faixaSalarial && <p className="text-xs text-emerald-600 mt-1">{contato.faixaSalarial}</p>}</div>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><Phone className="w-5 h-5 text-emerald-500" /><h3 className="font-semibold text-emerald-900">Telefones</h3></div><span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{telefones.length}</span></div>
          <div className="space-y-2">
            {telefones.slice(0, 5).map((tel: any, idx: number) => (
              <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-emerald-200 hover:border-emerald-300 transition-colors">
                <div className="flex items-center gap-3"><span className="text-sm font-medium text-slate-900">{formatarTelefone(tel.numero)}</span>{tel.whatsapp && <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">WhatsApp</span>}</div>
                <button onClick={() => copiar(tel.numero, 'Telefone')} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-emerald-100 transition-all">{copiado === 'Telefone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-violet-50 rounded-xl p-5 border border-violet-100">
          <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><Mail className="w-5 h-5 text-violet-500" /><h3 className="font-semibold text-violet-900">Emails</h3></div><span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">{emails.filter((e: any) => e?.email).length}</span></div>
          <div className="space-y-2">
            {emails.filter((e: any) => e?.email).slice(0, 5).map((email: any, idx: number) => (
              <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg bg-white border border-violet-200 hover:border-violet-300 transition-colors">
                <span className="text-sm font-medium text-slate-900 truncate flex-1">{email.email}</span>
                <button onClick={() => copiar(email.email, 'Email')} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-violet-100 transition-all flex-shrink-0">{copiado === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Aba Imóvel
function TabImovel({ contato, copiar, copiado }: {
  contato: Contato;
  copiar: (texto: string, tipo: string) => void;
  copiado: string | null;
}) {
  const temDadosImovel = contato.nomeEdificio || contato.enderecoImovel || contato.apartamento || contato.inscricaoIptu;

  if (!temDadosImovel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Home className="w-10 h-10 text-slate-300" /></div>
        <h3 className="text-lg font-semibold text-slate-600 mb-2">Sem dados do imóvel</h3>
        <p className="text-sm text-slate-500 max-w-sm">As informações do imóvel serão exibidas aqui quando disponíveis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Compacto - Apenas Nome */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-indigo-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0"><Building2 className="w-7 h-7 text-brand" /></div>
          <div className="flex-1">
            {contato.nomeEdificio && (
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {typeof contato.nomeEdificio === 'object' ? (contato.nomeEdificio as any).nome || 'Empreendimento' : String(contato.nomeEdificio)}
              </h1>
            )}
            <p className="text-sm text-brand font-medium mt-1 uppercase tracking-wider">Identificação do Edifício</p>
          </div>
        </div>
      </div>

      {/* Dossiê de Localização e Unidade (Completo) */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <MapPin className="w-5 h-5 text-brand" />
          <h3 className="font-bold text-lg text-slate-800">Dossiê de Localização e Unidade</h3>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Coluna 1: Endereço */}
          <div className="space-y-5">
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Endereço Completo</p>
              <p className="text-sm font-semibold text-slate-900">
                {typeof contato.enderecoImovel === 'object' ? 'Endereço Indisponível' : String(contato.enderecoImovel || '-')}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bairro</p>
              <p className="text-sm font-semibold text-slate-900">{String(contato.bairroImovel || '-')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quadra</p>
                <p className="text-sm font-semibold text-slate-900">{contato.quadra || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Lote</p>
                <p className="text-sm font-semibold text-slate-900">{contato.lote || '-'}</p>
              </div>
            </div>
          </div>

          {/* Coluna 2: Dados da Unidade */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 text-center">
                <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider mb-1">Unidade</p>
                <p className="text-xl font-bold text-indigo-700">{contato.unidade || '-'}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 text-center">
                <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider mb-1">Bloco</p>
                <p className="text-xl font-bold text-indigo-700">{contato.bloco || '-'}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Box/Garagem</p>
              <p className="text-lg font-bold text-slate-700">{contato.box || 'Não informado'}</p>
            </div>

            {contato.areaConstruida && (
              <div className="bg-emerald-600 rounded-lg p-4 text-white shadow-md text-center">
                <p className="text-[11px] text-emerald-100 font-bold uppercase tracking-wider mb-1">Tamanho do Apartamento</p>
                <p className="text-3xl font-black">{contato.areaConstruida} m²</p>
              </div>
            )}
          </div>
        </div>

        {/* IPTU */}
        {contato.inscricaoIptu && (
          <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Inscrição IPTU</p>
              <p className="font-mono text-lg font-bold text-slate-700">{contato.inscricaoIptu}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => copiar(contato.inscricaoIptu!, 'IPTU')} className="hover:bg-slate-50">
              {copiado === 'IPTU' ? <Check className="w-4 h-4 text-emerald-500 mr-2" /> : <Copy className="w-4 h-4 text-slate-400 mr-2" />}
              Copiar IPTU
            </Button>
          </div>
        )}
      </div>

      {/* Características Secundárias */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <div className="flex items-center gap-2 mb-4"><Home className="w-5 h-5 text-slate-400" /><h3 className="font-semibold text-slate-700">Outras Características</h3></div>
          <div className="space-y-3">
            {contato.tipoImovel && <div className="flex justify-between py-2 border-b border-slate-200"><span className="text-sm text-slate-500">Tipo de Imóvel</span><span className="text-sm font-medium text-slate-900">{formatarTipoImovel(contato.tipoImovel)}</span></div>}
            {contato.areaTerreno && <div className="flex justify-between py-2 border-b border-slate-200"><span className="text-sm text-slate-500">Área do Condomínio</span><span className="text-sm font-medium text-slate-900">{contato.areaTerreno} m²</span></div>}
            {contato.valorVenal && <div className="flex justify-between py-2"><span className="text-sm text-slate-500">Valor Venal</span><span className="text-sm font-medium text-emerald-600">{formatarMoeda(contato.valorVenal)}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
