/**
 * Página de Detalhes do Lead - V2
 * 
 * Melhorias:
 * - Ações rápidas: Editar, Perdido, Captado, Arquivar
 * - Modal de edição inline
 * - Confirmação de ações destrutivas
 * - Timeline interativa
 * - Melhor UX/UI
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  Clock,
  User,
  Home,
  Target,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Plus,
  Edit,
  Loader2,
  AlertCircle,
  Flame,
  Sun,
  Snowflake,
  RefreshCw,
  MoreVertical,
  Trophy,
  XOctagon,
  RotateCcw,
  Archive,
  Copy,
  Check,
  Save,
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../componentes/ui/card";
import { Badge } from "../componentes/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../componentes/ui/tabs";
import { Input } from "../componentes/ui/input";
import { Textarea } from "../componentes/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../componentes/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../componentes/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../componentes/ui/select";
import { api } from "../servicos/api";
import { toast } from "sonner";

// ============================================
// TIPOS
// ============================================

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  status: string;
  temperatura: string;
  origem: string | null;
  primeiroContato: string | null;
  ultimaInteracao: string | null;
  criadoEm: string;
  atualizadoEm: string;
  campanhaOrigem: {
    id: string;
    nome: string;
  } | null;
  imovel: {
    endereco: string | null;
    tipo: string | null;
    area: number | null;
    quartos: number | null;
    vagas: number | null;
    valorPretendido: number | null;
    ocupacao: string | null;
    interesseEm: string | null;
  };
  spin: {
    situacao: {
      situacaoAtual: string | null;
      tempoDecisao: string | null;
      tentativasAnteriores: string | null;
      comCorretorAtualmente: boolean | null;
    };
    problema: {
      motivacaoVenda: string | null;
      doresIdentificadas: string[];
    };
    implicacao: {
      prazoDesejado: string | null;
      urgencia: string | null;
      consequencias: string | null;
      custosAtuais: string | null;
      pressaoTempo: string | null;
    };
    necessidade: {
      expectativaServico: string | null;
      objecoes: string[];
      interesseAvaliacao: boolean | null;
    };
    observacoes: string | null;
  };
  atividades: Atividade[];
  conversas: Conversa[];
  proximaAtividade: Atividade | null;
}

interface Atividade {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  agendadoPara: string | null;
  completadoEm: string | null;
  statusAgendamento: string | null;
  criadoEm: string;
}

interface Conversa {
  id: string;
  canal: string;
  estado: string;
  iniciadaEm: string;
  ultimaMensagemEm: string | null;
  mensagens: any[];
}

// ============================================
// HELPERS
// ============================================

const formatarTelefone = (numero: string) => {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.length === 13) { // Com código do país
    return `+${limpo.slice(0,2)} (${limpo.slice(2,4)}) ${limpo.slice(4,9)}-${limpo.slice(9)}`;
  }
  if (limpo.length === 11) {
    return `(${limpo.slice(0,2)}) ${limpo.slice(2,7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0,2)}) ${limpo.slice(2,6)}-${limpo.slice(6)}`;
  }
  return numero;
};

const formatarMoeda = (valor: number) => {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

const formatarData = (data: string) => {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatarDataHora = (data: string) => {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const tempoRelativo = (data: string) => {
  const agora = new Date();
  const dataEvento = new Date(data);
  const diffMs = agora.getTime() - dataEvento.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHora = Math.floor(diffMs / 3600000);
  const diffDia = Math.floor(diffMs / 86400000);
  
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHora < 24) return `${diffHora}h atrás`;
  if (diffDia < 7) return `${diffDia}d atrás`;
  return formatarData(data);
};

// Configurações
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  NOVO: { label: 'Novo', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  QUALIFICANDO: { label: 'Qualificando', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  QUALIFICADO: { label: 'Qualificado', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  NAO_QUALIFICADO: { label: 'Não Qualificado', color: 'text-red-700', bgColor: 'bg-red-100' },
  AGENDADO: { label: 'Agendado', color: 'text-violet-700', bgColor: 'bg-violet-100' },
  CONVERTIDO: { label: 'Captado', color: 'text-green-700', bgColor: 'bg-green-100' },
  PERDIDO: { label: 'Perdido', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  ARQUIVADO: { label: 'Arquivado', color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

const temperaturaConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  QUENTE: { label: 'Quente', icon: <Flame className="w-4 h-4" />, color: 'text-orange-500' },
  MORNO: { label: 'Morno', icon: <Sun className="w-4 h-4" />, color: 'text-yellow-500' },
  FRIO: { label: 'Frio', icon: <Snowflake className="w-4 h-4" />, color: 'text-blue-500' },
};

const tipoAtividadeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  LIGACAO: { label: 'Ligação', icon: <Phone className="w-4 h-4" />, color: 'text-blue-500' },
  MENSAGEM: { label: 'Mensagem', icon: <MessageSquare className="w-4 h-4" />, color: 'text-green-500' },
  AVALIACAO: { label: 'Avaliação', icon: <Home className="w-4 h-4" />, color: 'text-violet-500' },
  FOLLOW_UP: { label: 'Follow-up', icon: <RefreshCw className="w-4 h-4" />, color: 'text-orange-500' },
  REUNIAO: { label: 'Reunião', icon: <Calendar className="w-4 h-4" />, color: 'text-indigo-500' },
  TAREFA: { label: 'Tarefa', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-slate-500' },
  NOTA: { label: 'Nota', icon: <Edit className="w-4 h-4" />, color: 'text-slate-400' },
  OUTRO: { label: 'Outro', icon: <Target className="w-4 h-4" />, color: 'text-gray-500' },
};

const statusAgendamentoConfig: Record<string, { label: string; color: string }> = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  REALIZADO: { label: 'Realizado', color: 'bg-blue-100 text-blue-700' },
  NAO_COMPARECEU: { label: 'Não Compareceu', color: 'bg-gray-100 text-gray-700' },
};

const motivosPerdaOptions = [
  'Não quer vender agora',
  'Preço não atendeu expectativa',
  'Fechou com outro corretor',
  'Desistiu de vender',
  'Não conseguimos contato',
  'Imóvel já vendido',
  'Outro'
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function LeadDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  // Modais
  const [modalEditar, setModalEditar] = useState(false);
  const [modalPerdido, setModalPerdido] = useState(false);
  const [modalCaptado, setModalCaptado] = useState(false);
  const [modalArquivar, setModalArquivar] = useState(false);
  const [modalAtividade, setModalAtividade] = useState(false);
  
  // Formulários
  const [formEditar, setFormEditar] = useState<any>({});
  const [formPerdido, setFormPerdido] = useState({ motivo: '', observacoes: '' });
  const [formCaptado, setFormCaptado] = useState({ tipoContrato: '', valorContrato: '', observacoes: '' });
  const [formAtividade, setFormAtividade] = useState({ tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '' });

  useEffect(() => {
    if (id) {
      carregarLead();
    }
  }, [id]);

  const carregarLead = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const response = await api.get(`/leads/${id}`);
      setLead(response.data);
      setFormEditar({
        nome: response.data.nome,
        telefone: response.data.telefone,
        email: response.data.email,
        temperatura: response.data.temperatura,
        enderecoImovel: response.data.imovel?.endereco,
        tipoImovel: response.data.imovel?.tipo,
        valorPretendido: response.data.imovel?.valorPretendido,
      });
    } catch (error: any) {
      console.error('Erro ao carregar lead:', error);
      setErro(error.response?.data?.erro || 'Erro ao carregar dados do lead');
      toast.error('Erro ao carregar lead');
    } finally {
      setCarregando(false);
    }
  };

  // ============================================
  // AÇÕES
  // ============================================

  const handleSalvarEdicao = async () => {
    try {
      setSalvando(true);
      await api.patch(`/leads/${id}`, formEditar);
      toast.success('Lead atualizado com sucesso!');
      setModalEditar(false);
      carregarLead();
    } catch (error: any) {
      toast.error(error.response?.data?.erro || 'Erro ao atualizar lead');
    } finally {
      setSalvando(false);
    }
  };

  const handleMarcarPerdido = async () => {
    try {
      setSalvando(true);
      await api.post(`/leads/${id}/perder`, formPerdido);
      toast.success('Lead marcado como perdido');
      setModalPerdido(false);
      carregarLead();
    } catch (error: any) {
      toast.error(error.response?.data?.erro || 'Erro ao marcar como perdido');
    } finally {
      setSalvando(false);
    }
  };

  const handleMarcarCaptado = async () => {
    try {
      setSalvando(true);
      await api.post(`/leads/${id}/captar`, formCaptado);
      toast.success('🎉 Parabéns! Imóvel captado com sucesso!');
      setModalCaptado(false);
      carregarLead();
    } catch (error: any) {
      toast.error(error.response?.data?.erro || 'Erro ao registrar captação');
    } finally {
      setSalvando(false);
    }
  };

  const handleArquivar = async () => {
    try {
      setSalvando(true);
      await api.delete(`/leads/${id}`);
      toast.success('Lead arquivado');
      navigate('/dashboard/leads');
    } catch (error: any) {
      toast.error(error.response?.data?.erro || 'Erro ao arquivar');
    } finally {
      setSalvando(false);
    }
  };

  const handleReativar = async () => {
    try {
      setSalvando(true);
      await api.post(`/leads/${id}/reativar`, { temperatura: 'MORNO' });
      toast.success('Lead reativado!');
      carregarLead();
    } catch (error: any) {
      toast.error(error.response?.data?.erro || 'Erro ao reativar');
    } finally {
      setSalvando(false);
    }
  };

  const handleCriarAtividade = async () => {
    try {
      setSalvando(true);
      await api.post(`/leads/${id}/atividades`, formAtividade);
      toast.success('Atividade criada!');
      setModalAtividade(false);
      setFormAtividade({ tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '' });
      carregarLead();
    } catch (error: any) {
      toast.error(error.response?.data?.erro || 'Erro ao criar atividade');
    } finally {
      setSalvando(false);
    }
  };

  const handleAcaoAtividade = async (atividadeId: string, acao: string) => {
    try {
      await api.patch(`/leads/${id}/atividades/${atividadeId}`, { acao });
      toast.success('Atividade atualizada');
      carregarLead();
    } catch (error: any) {
      toast.error('Erro ao atualizar atividade');
    }
  };

  const copiarTelefone = () => {
    if (lead?.telefone) {
      navigator.clipboard.writeText(lead.telefone);
      toast.success('Telefone copiado!');
    }
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
          <Button variant="outline" onClick={() => navigate('/dashboard/leads')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Leads
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[lead.status] || statusConfig.NOVO;
  const temperatura = temperaturaConfig[lead.temperatura] || temperaturaConfig.MORNO;
  const isPerdidoOuArquivado = lead.status === 'PERDIDO' || lead.status === 'ARQUIVADO';
  const isCaptado = lead.status === 'CONVERTIDO';

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/leads')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{lead.nome}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                {isCaptado && <Trophy className="w-3 h-3" />}
                {status.label}
              </span>
              <span className={`inline-flex items-center gap-1 ${temperatura.color}`} title={`Temperatura: ${temperatura.label}`}>
                {temperatura.icon}
              </span>
            </div>
            
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
              {lead.telefone && (
                <button 
                  onClick={copiarTelefone}
                  className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                  title="Clique para copiar"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {formatarTelefone(lead.telefone)}
                  <Copy className="w-3 h-3 opacity-50" />
                </button>
              )}
              {lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {lead.email}
                </span>
              )}
              {lead.origem && (
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {lead.origem}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Reativar (para perdidos/arquivados) */}
          {isPerdidoOuArquivado && (
            <Button variant="outline" onClick={handleReativar} disabled={salvando}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reativar
            </Button>
          )}

          {/* Ações normais */}
          {!isPerdidoOuArquivado && !isCaptado && (
            <>
              <Button variant="outline" onClick={() => setModalEditar(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              
              <Button variant="outline" onClick={() => setModalAtividade(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Atividade
              </Button>

              <Button 
                onClick={() => setModalCaptado(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Captar
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setModalPerdido(true)} className="text-red-600">
                    <XOctagon className="w-4 h-4 mr-2" />
                    Marcar como Perdido
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setModalArquivar(true)} className="text-red-600">
                    <Archive className="w-4 h-4 mr-2" />
                    Excluir Lead
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Button variant="ghost" size="icon" onClick={carregarLead} title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Banner de status especial */}
      {isCaptado && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Trophy className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-800">🎉 Imóvel Captado com Sucesso!</p>
            <p className="text-sm text-green-600">Este lead foi convertido em captação</p>
          </div>
        </div>
      )}

      {isPerdidoOuArquivado && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              {lead.status === 'PERDIDO' ? <XOctagon className="w-6 h-6 text-gray-500" /> : <Archive className="w-6 h-6 text-gray-500" />}
            </div>
            <div>
              <p className="font-medium text-gray-800">
                {lead.status === 'PERDIDO' ? 'Lead Perdido' : 'Lead Arquivado'}
              </p>
              <p className="text-sm text-gray-500">Clique em "Reativar" para tentar novamente</p>
            </div>
          </div>
        </div>
      )}

      {/* Próxima Atividade */}
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
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                        statusAgendamentoConfig[lead.proximaAtividade.statusAgendamento]?.color || ''
                      }`}>
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
                  onClick={() => handleAcaoAtividade(lead.proximaAtividade!.id, 'nao_compareceu')}
                >
                  Não compareceu
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleAcaoAtividade(lead.proximaAtividade!.id, 'completar')}
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
        
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card Imóvel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="w-5 h-5 text-slate-500" />
                Imóvel para Captação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.imovel.endereco || lead.imovel.tipo || lead.imovel.interesseEm ? (
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
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>Nenhuma informação de imóvel coletada</p>
                  {!isPerdidoOuArquivado && !isCaptado && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-3"
                      onClick={() => setModalEditar(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Dados
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

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

        {/* COLUNA DIREITA */}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>Atualize as informações do lead</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={formEditar.nome || ''} onChange={(e) => setFormEditar({...formEditar, nome: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input value={formEditar.telefone || ''} onChange={(e) => setFormEditar({...formEditar, telefone: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={formEditar.email || ''} onChange={(e) => setFormEditar({...formEditar, email: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Temperatura</label>
              <Select value={formEditar.temperatura} onValueChange={(v) => setFormEditar({...formEditar, temperatura: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUENTE">🔥 Quente</SelectItem>
                  <SelectItem value="MORNO">🌤️ Morno</SelectItem>
                  <SelectItem value="FRIO">❄️ Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Endereço do Imóvel</label>
              <Input value={formEditar.enderecoImovel || ''} onChange={(e) => setFormEditar({...formEditar, enderecoImovel: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo de Imóvel</label>
                <Input value={formEditar.tipoImovel || ''} onChange={(e) => setFormEditar({...formEditar, tipoImovel: e.target.value})} placeholder="Apartamento, Casa..." />
              </div>
              <div>
                <label className="text-sm font-medium">Valor Pretendido</label>
                <Input type="number" value={formEditar.valorPretendido || ''} onChange={(e) => setFormEditar({...formEditar, valorPretendido: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button onClick={handleSalvarEdicao} disabled={salvando}>
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
              <Select value={formPerdido.motivo} onValueChange={(v) => setFormPerdido({...formPerdido, motivo: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {motivosPerdaOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea value={formPerdido.observacoes} onChange={(e) => setFormPerdido({...formPerdido, observacoes: e.target.value})} placeholder="Detalhes adicionais..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPerdido(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleMarcarPerdido} disabled={salvando || !formPerdido.motivo}>
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
              <Select value={formCaptado.tipoContrato} onValueChange={(v) => setFormCaptado({...formCaptado, tipoContrato: v})}>
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
              <Input type="number" value={formCaptado.valorContrato} onChange={(e) => setFormCaptado({...formCaptado, valorContrato: e.target.value})} placeholder="500000" />
            </div>
            <div>
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea value={formCaptado.observacoes} onChange={(e) => setFormCaptado({...formCaptado, observacoes: e.target.value})} placeholder="Detalhes do fechamento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCaptado(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleMarcarCaptado} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              🎉 Confirmar Captação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir Permanentemente */}
      <Dialog open={modalArquivar} onOpenChange={setModalArquivar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Excluir Lead Permanentemente</DialogTitle>
            <DialogDescription>
              <span className="text-red-600 font-semibold">ATENÇÃO: Esta ação é irreversível!</span>
              <br /><br />
              O lead será excluído permanentemente do sistema, junto com todas as suas conversas, 
              mensagens e atividades. Esta ação NÃO pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalArquivar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleArquivar} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              🗑️ Excluir Permanentemente
            </Button>
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
              <Select value={formAtividade.tipo} onValueChange={(v) => setFormAtividade({...formAtividade, tipo: v})}>
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
              <Input value={formAtividade.titulo} onChange={(e) => setFormAtividade({...formAtividade, titulo: e.target.value})} placeholder="Ex: Ligar para confirmar interesse" />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Textarea value={formAtividade.descricao} onChange={(e) => setFormAtividade({...formAtividade, descricao: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-medium">Data/Hora (opcional)</label>
              <Input type="datetime-local" value={formAtividade.agendadoPara} onChange={(e) => setFormAtividade({...formAtividade, agendadoPara: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAtividade(false)}>Cancelar</Button>
            <Button onClick={handleCriarAtividade} disabled={salvando || !formAtividade.titulo}>
              {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente auxiliar
function InfoItem({ label, value, icon, fullWidth = false }: { label: string; value: string | null; icon?: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      {value ? (
        <p className="font-medium flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          {value}
        </p>
      ) : (
        <p className="text-slate-400 flex items-center gap-2">
          {icon && <span className="text-slate-300">{icon}</span>}
          Não informado
        </p>
      )}
    </div>
  );
}
