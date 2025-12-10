/**
 * Página de Detalhes do Contato
 * 
 * Design: Minimalista Profissional (inspirado em Linear, Stripe, Notion)
 * Princípios: Menos é mais, hierarquia clara, tipografia forte
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
  Pause
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { Textarea } from "../componentes/ui/textarea";
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
  modoAtendimento?: string | null; // IA, HUMANO, PAUSADO
  atendidoPor?: string | null;
  pausadoEm?: string | null;
  
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

// Helpers
const formatarTelefone = (numero: string) => {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0,2)}) ${limpo.slice(2,7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0,2)}) ${limpo.slice(2,6)}-${limpo.slice(6)}`;
  }
  return numero;
};

const formatarCpf = (cpf: string) => {
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `${limpo.slice(0,3)}.${limpo.slice(3,6)}.${limpo.slice(6,9)}-${limpo.slice(9)}`;
  }
  return cpf;
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

// Status config simples
const statusConfig: Record<string, { label: string; color: string }> = {
  AGUARDANDO: { label: 'Aguardando', color: 'text-slate-600 bg-slate-100' },
  EM_CONVERSA: { label: 'Em conversa', color: 'text-blue-700 bg-blue-50' },
  QUALIFICADO: { label: 'Qualificado', color: 'text-emerald-700 bg-emerald-50' },
  NAO_QUALIFICADO: { label: 'Não qualificado', color: 'text-red-700 bg-red-50' },
  CONVERTIDO: { label: 'Convertido', color: 'text-violet-700 bg-violet-50' },
};

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

  // Alternar modo de atendimento (IA/Humano/Pausado)
  const alternarModo = async (novoModo: 'IA' | 'HUMANO' | 'PAUSADO') => {
    if (!campanhaId || !contatoId || alternandoModo) return;
    
    try {
      setAlternandoModo(true);
      
      const endpoints: Record<string, string> = {
        'IA': 'ativar-ia',
        'HUMANO': 'ativar-humano',
        'PAUSADO': 'pausar'
      };
      
      await api.post(`/campanhas/${campanhaId}/contatos/${contatoId}/${endpoints[novoModo]}`);
      
      // Atualizar estado local
      if (contato) {
        setContato({ ...contato, modoAtendimento: novoModo });
      }
      
      const mensagens: Record<string, string> = {
        'IA': '🤖 IA reativada para este contato',
        'HUMANO': '👤 Você assumiu a conversa',
        'PAUSADO': '⏸️ Conversa pausada'
      };
      
      toast.success(mensagens[novoModo]);
    } catch (err) {
      toast.error('Erro ao alternar modo');
    } finally {
      setAlternandoModo(false);
    }
  };

  // Loading State
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

  // Error State
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

  // Parse telefones - suporta telefonesJson ou campos individuais
  const telefones = (() => {
    try {
      // Primeiro tenta telefonesJson
      if (contato.telefonesJson) {
        if (Array.isArray(contato.telefonesJson)) return contato.telefonesJson;
        if (typeof contato.telefonesJson === 'string') return JSON.parse(contato.telefonesJson);
      }
      
      // Fallback: monta array dos campos individuais
      const tels: any[] = [];
      if (contato.telefone) tels.push({ numero: contato.telefone, principal: true, whatsapp: true });
      if (contato.telefone2) tels.push({ numero: contato.telefone2, whatsapp: true });
      if (contato.telefone3) tels.push({ numero: contato.telefone3 });
      if (contato.telefone4) tels.push({ numero: contato.telefone4 });
      if (contato.telefone5) tels.push({ numero: contato.telefone5 });
      return tels;
    } catch { return []; }
  })();

  // Parse emails - suporta emailsJson ou campos individuais
  const emails = (() => {
    try {
      // Primeiro tenta emailsJson
      if (contato.emailsJson) {
        let parsed = contato.emailsJson;
        if (typeof contato.emailsJson === 'string') {
          parsed = JSON.parse(contato.emailsJson);
        }
        if (Array.isArray(parsed)) {
          // Normaliza: pode ser array de strings ou array de objetos
          return parsed.map((e: any) => {
            if (typeof e === 'string') return { email: e };
            return e;
          });
        }
      }
      
      // Fallback: monta array dos campos individuais
      const mails: any[] = [];
      if (contato.email) mails.push({ email: contato.email });
      if (contato.email2) mails.push({ email: contato.email2 });
      if (contato.email3) mails.push({ email: contato.email3 });
      return mails;
    } catch { 
      // Em caso de erro no parse, tenta campos individuais
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header Limpo */}
      <header className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Navegação */}
          <button 
            onClick={() => navigate(`/dashboard/campanhas/${campanhaId}`)}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para campanha</span>
          </button>

          {/* Info Principal */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar Simples */}
              <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-white text-xl font-semibold">
                {contato.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              
              <div>
                {/* Nome */}
                <h1 className="text-2xl font-semibold text-slate-900 mb-1">
                  {contato.nome}
                </h1>
                
                {/* Contatos Inline */}
                <div className="flex items-center gap-4 text-sm text-slate-500">
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
                </div>
                
                {/* Meta Info */}
                <div className="flex items-center gap-3 mt-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    Criado em {formatarDataCurta(contato.criadoEm)}
                  </span>
                  {contato.cpf && (
                    <span className="text-xs text-slate-400">
                      CPF: {formatarCpf(contato.cpf)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-4">
              {/* Botões de Contato */}
              <div className="flex items-center gap-2">
                {telefonePrincipal && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`tel:${telefonePrincipal.numero}`, '_blank')}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Ligar
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => window.open(`https://wa.me/55${telefonePrincipal.numero.replace(/\D/g, '')}`, '_blank')}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                  </>
                )}
                {emailPrincipal && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`mailto:${emailPrincipal.email}`, '_blank')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                )}
              </div>

              {/* Separador */}
              <div className="h-8 w-px bg-slate-200" />

              {/* Controle de Atendimento */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <Button
                  variant={contato.modoAtendimento === 'IA' || !contato.modoAtendimento ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => alternarModo('IA')}
                  disabled={alternandoModo || contato.modoAtendimento === 'IA'}
                  className={`h-7 px-3 ${contato.modoAtendimento === 'IA' || !contato.modoAtendimento ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Bot className="w-3.5 h-3.5 mr-1.5" />
                  IA
                </Button>
                <Button
                  variant={contato.modoAtendimento === 'HUMANO' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => alternarModo('HUMANO')}
                  disabled={alternandoModo || contato.modoAtendimento === 'HUMANO'}
                  className={`h-7 px-3 ${contato.modoAtendimento === 'HUMANO' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  Humano
                </Button>
                <Button
                  variant={contato.modoAtendimento === 'PAUSADO' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => alternarModo('PAUSADO')}
                  disabled={alternandoModo || contato.modoAtendimento === 'PAUSADO'}
                  className={`h-7 px-3 ${contato.modoAtendimento === 'PAUSADO' ? 'bg-slate-600 hover:bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Pause className="w-3.5 h-3.5 mr-1.5" />
                  Pausado
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Barra do Imóvel - Destaque */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/50">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Dados do Imóvel */}
            <div className="flex items-center gap-6">
              {/* 1. Empreendimento */}
              {contato.nomeEdificio && (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-slate-900">{contato.nomeEdificio}</span>
                  </div>
                  <div className="h-8 w-px bg-slate-300" />
                </>
              )}

              {/* 2. Endereço */}
              {(contato.enderecoImovel || contato.bairroImovel) && (
                <>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600">
                      {contato.enderecoImovel?.trim() || contato.bairroImovel?.trim()}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-300" />
                </>
              )}

              {/* 3. Unidade (Apto XX | Bloco XX) */}
              {(contato.apartamento || contato.unidade) && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-[10px] text-blue-500 uppercase">Unidade</p>
                      <p className="text-sm font-bold text-blue-700">
                        {contato.apartamento ? (
                          <>
                            Apto {contato.apartamento}
                            {contato.bloco && <span className="text-blue-400 mx-1">|</span>}
                            {contato.bloco && <>Bloco {contato.bloco}</>}
                          </>
                        ) : (
                          contato.unidade
                        )}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* 4. Box/Garagem */}
              {contato.box && (
                <div className="px-3 py-1.5 bg-slate-100 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase">Box</p>
                  <p className="text-sm font-bold text-slate-700">{contato.box}</p>
                </div>
              )}
            </div>

            {/* Score de Atendimento/Interesse (à direita) */}
            {contato.scoreQualificacao && contato.scoreQualificacao > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl">
                <div>
                  <p className="text-[10px] text-orange-600 font-medium uppercase">Atendimento</p>
                  <p className="text-xl font-bold text-orange-700">{contato.scoreQualificacao}</p>
                </div>
                <div className="w-16 h-2 bg-orange-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
                    style={{ width: `${Math.min(100, contato.scoreQualificacao)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal - 3 Colunas */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          
          {/* Coluna Esquerda: Contatos */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            
            {/* Card Telefones */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500 rounded-lg">
                    <Phone className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-emerald-900">Telefones</h3>
                  <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {telefones.length}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-1">
                {telefones.slice(0, 5).map((tel: any, idx: number) => (
                  <div 
                    key={idx}
                    className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-900">{formatarTelefone(tel.numero)}</span>
                      {tel.whatsapp && (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          WhatsApp
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => copiar(tel.numero, 'Telefone')}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 transition-all"
                    >
                      {copiado === 'Telefone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                ))}
                {telefones.length === 0 && (
                  <p className="text-sm text-slate-400 p-3 text-center">Nenhum telefone cadastrado</p>
                )}
              </div>
            </div>

            {/* Card Emails */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500 rounded-lg">
                    <Mail className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-blue-900">Emails</h3>
                  <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    {emails.filter((e: any) => e?.email).length}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-1">
                {emails.filter((e: any) => e?.email).slice(0, 5).map((email: any, idx: number) => (
                  <div 
                    key={idx}
                    className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-slate-900 truncate">{email.email}</span>
                    </div>
                    <button
                      onClick={() => copiar(email.email, 'Email')}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-100 transition-all flex-shrink-0"
                    >
                      {copiado === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                ))}
                {emails.filter((e: any) => e?.email).length === 0 && (
                  <p className="text-sm text-slate-400 p-3 text-center">Nenhum email cadastrado</p>
                )}
              </div>
            </div>

            {/* Card Observações */}
            {contato.observacoes && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-amber-900">Observações</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {contato.observacoes}
                  </p>
                </div>
              </div>
            )}
          </aside>

          {/* Coluna Central: Conversa */}
          <section className="col-span-12 lg:col-span-6">
            <div className="border border-slate-200 rounded-xl h-[600px] flex flex-col">
              {/* Header do Chat */}
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Conversa</h3>
                  {mensagens.length > 0 && (
                    <span className="text-xs text-slate-400">{mensagens.length} mensagens</span>
                  )}
                </div>
              </div>

              {/* Mensagens */}
              <div 
                ref={mensagensRef}
                className="flex-1 overflow-y-auto p-5 space-y-4"
              >
                {mensagens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  mensagens.map((msg) => {
                    const isSaida = msg.direcao === 'SAIDA' || msg.tipo === 'ENVIADA';
                    const dataMsg = msg.dataHora || msg.timestamp || '';
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isSaida ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${isSaida ? 'order-2' : ''}`}>
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isSaida
                                ? 'bg-slate-900 text-white rounded-br-md'
                                : 'bg-slate-100 text-slate-900 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{msg.conteudo}</p>
                          </div>
                          {dataMsg && (
                            <p className={`text-xs text-slate-400 mt-1 ${isSaida ? 'text-right' : ''}`}>
                              {tempoRelativo(dataMsg)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-3">
                  <Textarea
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 min-h-[44px] max-h-28 resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        enviarMensagem();
                      }
                    }}
                  />
                  <Button
                    onClick={enviarMensagem}
                    disabled={!novaMensagem.trim() || enviando}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {enviando ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Coluna Direita: Perfil Completo */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            
            {/* Card Principal - Dados Pessoais */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Dados Pessoais
                </h3>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Idade e Sexo - Grid */}
                {(contato.idade || contato.sexo) && (
                  <div className="grid grid-cols-2 gap-3">
                    {contato.idade && (
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-slate-900">{contato.idade}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Anos</p>
                      </div>
                    )}
                    {contato.sexo && (
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-sm font-semibold text-slate-900">{contato.sexo}</p>
                        {contato.signo && (
                          <p className="text-[10px] text-slate-500">{contato.signo}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* CPF */}
                {contato.cpf && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500">CPF</span>
                    <span className="text-sm font-mono text-slate-700">{formatarCpf(contato.cpf)}</span>
                  </div>
                )}

                {/* Nome da Mãe */}
                {contato.nomeMae && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500">Mãe</span>
                    <span className="text-xs text-slate-700 text-right max-w-[60%] truncate">{contato.nomeMae}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Profissional */}
            {(contato.empresaAtual || contato.profissao || contato.rendaEstimada) && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Profissional
                  </h3>
                </div>
                
                <div className="p-4 space-y-3">
                  {/* Empresa */}
                  {contato.empresaAtual && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Empresa</p>
                      <p className="text-sm font-medium text-slate-900 leading-tight">{contato.empresaAtual}</p>
                    </div>
                  )}

                  {/* Profissão */}
                  {contato.profissao && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Profissão</p>
                      <p className="text-sm text-slate-700">{contato.profissao}</p>
                    </div>
                  )}

                  {/* Renda - Destaque */}
                  {contato.rendaEstimada && (
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg p-3 mt-2">
                      <p className="text-[10px] text-emerald-600 uppercase mb-1">Renda Estimada</p>
                      <p className="text-xl font-bold text-emerald-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(contato.rendaEstimada))}
                      </p>
                      {contato.faixaSalarial && (
                        <p className="text-[10px] text-emerald-600 mt-1">{contato.faixaSalarial}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card Endereço Pessoal */}
            {(contato.endereco || contato.cidade) && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    Endereço Pessoal
                  </h3>
                </div>
                
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{contato.endereco || contato.cidade}</p>
                      {contato.cidade && contato.estado && (
                        <p className="text-xs text-slate-500 mt-0.5">{contato.cidade} - {contato.estado}</p>
                      )}
                      {contato.cep && (
                        <p className="text-xs text-slate-400 mt-0.5">CEP: {contato.cep}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Card Score de Qualidade */}
            {contato.scoreAssertiva && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Qualidade dos Dados</span>
                    <span className="text-2xl font-bold text-blue-600">{contato.scoreAssertiva}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Number(contato.scoreAssertiva))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    {Number(contato.scoreAssertiva) >= 80 ? '✓ Dados confiáveis' : 
                     Number(contato.scoreAssertiva) >= 50 ? '⚠ Verificar dados' : '✗ Dados incompletos'}
                  </p>
                </div>
              </div>
            )}

            {/* Card IPTU */}
            {contato.inscricaoIptu && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Inscrição IPTU</p>
                      <p className="font-mono text-sm font-medium text-slate-700">{contato.inscricaoIptu}</p>
                    </div>
                    <button
                      onClick={() => copiar(contato.inscricaoIptu!, 'IPTU')}
                      className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      {copiado === 'IPTU' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
