import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { UploadCSV } from "../componentes/UploadCSV";
import { EditorBriefing } from "../componentes/EditorBriefing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../componentes/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../componentes/ui/dialog";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Users,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Home,
  TrendingUp,
  Pause,
  PauseCircle,
  Play,
  Archive,
  Upload,
  X,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Eye,
  Trash2,
  List,
} from "lucide-react";
import { api } from "../servicos/api";

// Tipos
interface CampanhaDetalhes {
  id: string;
  nome: string;
  tenantId: string;
  tipo: string;
  parametrosBusca: any;
  nomeEmpreendimento: string | null;
  tipoImovel: string | null;
  localizacao: string | null;
  perfilImovel: string | null;
  briefingCompleto: string | null;
  briefingEstruturado: any;
  briefingGeradoEm: string | null;
  briefingConfiabilidade: string | null;
  totalContatos: number;
  totalLeads: number;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface Contato {
  id: string;
  nome: string;
  cpf: string | null;
  // Telefones (até 5)
  telefone: string | null;
  telefone2: string | null;
  telefone3: string | null;
  telefone4: string | null;
  telefone5: string | null;
  telefonesJson: any | null;
  temWhatsapp: boolean;
  quantidadeWhatsapp: number;
  // Emails (até 5)
  email: string | null;
  email2: string | null;
  email3: string | null;
  email4: string | null;
  email5: string | null;
  emailsJson: any | null;
  inscricaoIptu: string | null;
  enderecoImovel: string | null;
  bairroImovel: string | null;
  nomeEdificio: string | null;
  apartamento: string | null;
  bloco: string | null;
  unidade: string | null;
  box: string | null;
  quadra: string | null;
  lote: string | null;
  areaTerreno: number | null;
  areaConstruida: number | null;
  tipoImovel: string | null;
  valorVenal: number | null;
  scoreAssertiva: number | null;
  statusProspeccao: string;
  tentativasContato: number;
  ultimaTentativa: string | null;
  respondeu: boolean;
  manifestouInteresse: boolean;
  virouLead: boolean;
  observacoes: string | null;
  criadoEm: string;
}

type TabType = 'visao-geral' | 'contatos' | 'empreendimento';

interface ListaSimples {
  id: string;
  nome: string;
  nomeEdificio: string;
  totalContatos: number;
  totalComWhatsapp: number;
  totalUsados: number;
}

export function CampanhaDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campanha, setCampanha] = useState<CampanhaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Estados para Abas
  const [abaAtiva, setAbaAtiva] = useState<TabType>('visao-geral');

  // Estados para Contatos
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalContatos, setTotalContatos] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [estatisticasContatos, setEstatisticasContatos] = useState<Record<string, number>>({});

  // Estados para Importação
  const [modalImportacaoOpen, setModalImportacaoOpen] = useState(false);
  const [abaImportacao, setAbaImportacao] = useState<'csv' | 'texto'>('csv');
  const [textoImportacao, setTextoImportacao] = useState("");
  const [importando, setImportando] = useState(false);

  // Estados para Importar de Lista
  const [modalListaOpen, setModalListaOpen] = useState(false);
  const [listas, setListas] = useState<ListaSimples[]>([]);
  const [listaSelecionada, setListaSelecionada] = useState<string>('');
  const [carregandoListas, setCarregandoListas] = useState(false);
  const [importandoDeLista, setImportandoDeLista] = useState(false);

  // Estados para Modal de Contato
  const [contatoSelecionado, setContatoSelecionado] = useState<Contato | null>(null);

  // Estados para Modais de Confirmação
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [modalStatusOpen, setModalStatusOpen] = useState(false);
  const [novoStatusPendente, setNovoStatusPendente] = useState<"PAUSADA" | "FINALIZADA" | "ATIVA" | null>(null);
  const [processando, setProcessando] = useState(false);
  
  // Estados para Toast/Notificação
  const [notificacao, setNotificacao] = useState<{
    tipo: 'sucesso' | 'erro';
    mensagem: string;
  } | null>(null);

  // Mostrar notificação temporária
  const mostrarNotificacao = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => setNotificacao(null), 4000);
  };

  useEffect(() => {
    if (id) {
      carregarCampanha();
    }
  }, [id]);

  // Carregar contatos quando mudar aba, página ou filtro
  useEffect(() => {
    if (id && abaAtiva === 'contatos') {
      carregarContatos();
    }
  }, [id, abaAtiva, paginaAtual, filtroStatus]);

  const carregarCampanha = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/campanhas/${id}`);
      setCampanha(response.data.campanha);
    } catch (error) {
      console.error("Erro ao carregar campanha:", error);
      setErro("Não foi possível carregar os detalhes da campanha.");
    } finally {
      setLoading(false);
    }
  };

  const carregarContatos = async () => {
    try {
      setLoadingContatos(true);
      const params = new URLSearchParams();
      params.append('page', paginaAtual.toString());
      params.append('limit', '20');
      if (filtroStatus) params.append('status', filtroStatus);
      
      const response = await api.get(`/campanhas/${id}/contatos?${params}`);
      setContatos(response.data.contatos);
      setTotalContatos(response.data.paginacao.total);
      setTotalPaginas(response.data.paginacao.totalPaginas);
      setEstatisticasContatos(response.data.estatisticas?.porStatus || {});
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
    } finally {
      setLoadingContatos(false);
    }
  };

  const formatarTelefone = (tel: string | null) => {
    if (!tel) return '-';
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 11) {
      return `(${limpo.slice(0,2)}) ${limpo.slice(2,7)}-${limpo.slice(7)}`;
    }
    if (limpo.length === 10) {
      return `(${limpo.slice(0,2)}) ${limpo.slice(2,6)}-${limpo.slice(6)}`;
    }
    return tel;
  };

  const getStatusProspeccaoColor = (status: string) => {
    const cores: Record<string, string> = {
      'AGUARDANDO': 'bg-slate-100 text-slate-700',
      'CONTATANDO': 'bg-blue-100 text-blue-700',
      'RESPONDEU': 'bg-green-100 text-green-700',
      'SEM_INTERESSE': 'bg-red-100 text-red-700',
      'INTERESSADO': 'bg-purple-100 text-purple-700',
      'LEAD': 'bg-emerald-100 text-emerald-700',
    };
    return cores[status] || 'bg-slate-100 text-slate-700';
  };

  const exportarContatos = async () => {
    if (!contatos.length) return;
    
    // Criar CSV
    const headers = ['Nome', 'CPF', 'Telefone', 'Telefone 2', 'WhatsApp', 'Email', 'Endereço Imóvel', 'Bairro', 'Área (m²)', 'Score', 'Status'];
    const rows = contatos.map(c => [
      c.nome,
      c.cpf || '',
      c.telefone || '',
      c.telefone2 || '',
      c.temWhatsapp ? 'Sim' : 'Não',
      c.email || '',
      c.enderecoImovel || '',
      c.bairroImovel || '',
      c.areaConstruida || c.areaTerreno || '',
      c.scoreAssertiva || '',
      c.statusProspeccao,
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${campanha?.nome || 'campanha'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const excluirCampanha = async () => {
    if (!campanha) return;
    
    setProcessando(true);
    try {
      await api.delete(`/campanhas/${id}`);
      setModalExcluirOpen(false);
      mostrarNotificacao('sucesso', 'Campanha excluída com sucesso!');
      setTimeout(() => navigate('/dashboard/campanhas'), 1500);
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      mostrarNotificacao('erro', 'Erro ao excluir campanha. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  // Função de status (agora usa estados já declarados acima)
  const confirmarAtualizarStatus = (novoStatus: "PAUSADA" | "FINALIZADA" | "ATIVA") => {
    setNovoStatusPendente(novoStatus);
    setModalStatusOpen(true);
  };

  const executarAtualizarStatus = async () => {
    if (!campanha || !novoStatusPendente) return;

    try {
      setProcessando(true);
      await api.patch(`/campanhas/${id}/status`, { status: novoStatusPendente });
      setModalStatusOpen(false);
      
      const statusLabels = {
        PAUSADA: 'pausada',
        FINALIZADA: 'finalizada',
        ATIVA: 'reativada'
      };
      
      mostrarNotificacao('sucesso', `Campanha ${statusLabels[novoStatusPendente]} com sucesso!`);
      carregarCampanha(); // Recarrega dados
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      mostrarNotificacao('erro', 'Erro ao atualizar status da campanha. Tente novamente.');
    } finally {
      setProcessando(false);
      setNovoStatusPendente(null);
    }
  };

  const getStatusModalConfig = () => {
    const configs = {
      PAUSADA: {
        titulo: 'Pausar Campanha',
        mensagem: `Deseja pausar a campanha "${campanha?.nome}"? Os contatos não serão processados enquanto pausada.`,
        icone: PauseCircle,
        corIcone: 'text-amber-500',
        corBotao: 'bg-amber-600 hover:bg-amber-700'
      },
      FINALIZADA: {
        titulo: 'Finalizar Campanha',
        mensagem: `Deseja finalizar a campanha "${campanha?.nome}"? Esta ação encerrará definitivamente a campanha.`,
        icone: CheckCircle2,
        corIcone: 'text-green-500',
        corBotao: 'bg-green-600 hover:bg-green-700'
      },
      ATIVA: {
        titulo: 'Reativar Campanha',
        mensagem: `Deseja reativar a campanha "${campanha?.nome}"? O processamento dos contatos será retomado.`,
        icone: Play,
        corIcone: 'text-blue-500',
        corBotao: 'bg-blue-600 hover:bg-blue-700'
      }
    };
    return novoStatusPendente ? configs[novoStatusPendente] : null;
  };

  const importarContatos = async () => {
    if (!textoImportacao.trim()) return;

    try {
      setImportando(true);

      // Parser simples: Nome, Telefone (por linha)
      const linhas = textoImportacao.split("\n").filter((l) => l.trim());
      const contatos = linhas
        .map((linha) => {
          const [nome, telefone, email] = linha.split(",").map((s) => s.trim());
          return {
            nome: nome || "Sem Nome",
            telefone: telefone || "",
            email: email || "",
          };
        })
        .filter((c) => c.nome && c.telefone);

      if (contatos.length === 0) {
        mostrarNotificacao('erro', 'Nenhum contato válido encontrado. Use o formato: Nome, Telefone');
        return;
      }

      const response = await api.post(`/campanhas/${id}/importar-contatos`, {
        contatos,
      });

      mostrarNotificacao('sucesso', response.data.mensagem);
      setModalImportacaoOpen(false);
      setTextoImportacao("");
      carregarCampanha();
    } catch (error) {
      console.error("Erro ao importar:", error);
      mostrarNotificacao('erro', 'Erro ao importar contatos. Verifique o formato.');
    } finally {
      setImportando(false);
    }
  };

  const carregarListas = async () => {
    try {
      setCarregandoListas(true);
      const response = await api.get('/listas');
      // Mostrar todas as listas que têm contatos
      const listasDisponiveis = response.data.filter(
        (lista: ListaSimples) => lista.totalContatos > 0
      );
      setListas(listasDisponiveis);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    } finally {
      setCarregandoListas(false);
    }
  };

  const abrirModalLista = () => {
    setModalListaOpen(true);
    carregarListas();
  };

  const importarDeLista = async () => {
    if (!listaSelecionada) {
      mostrarNotificacao('erro', 'Selecione uma lista');
      return;
    }

    try {
      setImportandoDeLista(true);
      const response = await api.post(`/listas/${listaSelecionada}/adicionar-campanha`, {
        campanhaId: id,
      });

      const { adicionados, duplicados } = response.data;
      
      setModalListaOpen(false);
      setListaSelecionada('');
      
      if (adicionados > 0) {
        mostrarNotificacao('sucesso', `${adicionados} contatos importados da lista!${duplicados > 0 ? ` (${duplicados} duplicados ignorados)` : ''}`);
        carregarCampanha();
        if (abaAtiva === 'contatos') {
          carregarContatos();
        }
      } else {
        mostrarNotificacao('erro', 'Nenhum contato novo para importar (todos já existem na campanha).');
      }
    } catch (error) {
      console.error('Erro ao importar da lista:', error);
      mostrarNotificacao('erro', 'Erro ao importar contatos da lista.');
    } finally {
      setImportandoDeLista(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATIVA":
        return "bg-green-100 text-green-700 border-green-200";
      case "PAUSADA":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "FINALIZADA":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const formatarPreco = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (erro || !campanha) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/campanhas")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro || "Campanha não encontrada"}
        </div>
      </div>
    );
  }

  const briefing = campanha.briefingEstruturado;
  const confiabilidade = parseFloat(campanha.briefingConfiabilidade || "0");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard/campanhas")}
            className="gap-2 -ml-3 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Campanhas
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{campanha.nome}</h1>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campanha.status)}`}
            >
              {campanha.status}
            </span>
            {campanha.nomeEmpreendimento && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="w-4 h-4" />
                {campanha.nomeEmpreendimento}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Botão Importar de Lista */}
          <Button 
            variant="outline" 
            className="gap-2 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            onClick={abrirModalLista}
          >
            <List className="w-4 h-4" />
            Importar de Lista
          </Button>

          {/* Botão Importar Contatos */}
          <Dialog
            open={modalImportacaoOpen}
            onOpenChange={setModalImportacaoOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white">
                <Upload className="w-4 h-4" />
                Importar Contatos
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Importar Contatos</DialogTitle>
                <DialogDescription>
                  Importe contatos via arquivo CSV ou cole manualmente.
                </DialogDescription>
              </DialogHeader>
              
              {/* Abas */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setAbaImportacao('csv')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    abaImportacao === 'csv' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📄 Arquivo CSV
                </button>
                <button
                  onClick={() => setAbaImportacao('texto')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    abaImportacao === 'texto' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ✏️ Colar Texto
                </button>
              </div>

              {/* Conteúdo das Abas */}
              <div className="py-4">
                {abaImportacao === 'csv' ? (
                  <UploadCSV
                    campanhaId={id || ''}
                    onSuccess={(resultado) => {
                      mostrarNotificacao('sucesso', `${resultado.importados} contatos importados!`);
                      carregarCampanha();
                      if (abaAtiva === 'contatos') {
                        carregarContatos();
                      }
                    }}
                    onClose={() => setModalImportacaoOpen(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Cole sua lista no formato: <strong>Nome, Telefone</strong> (um por linha)
                    </p>
                    <textarea
                      className="w-full h-48 p-3 border rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder={`João Silva, 62999998888\nMaria Santos, 62988887777`}
                      value={textoImportacao}
                      onChange={(e) => setTextoImportacao(e.target.value)}
                    />
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setModalImportacaoOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={importarContatos} disabled={importando}>
                        {importando ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          "Importar Contatos"
                        )}
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {campanha.status === "ATIVA" && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => confirmarAtualizarStatus("PAUSADA")}
              >
                <Pause className="w-4 h-4" />
                Pausar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => confirmarAtualizarStatus("FINALIZADA")}
              >
                <Archive className="w-4 h-4" />
                Finalizar
              </Button>
            </>
          )}
          {campanha.status === "PAUSADA" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => confirmarAtualizarStatus("ATIVA")}
            >
              <Play className="w-4 h-4" />
              Reativar
            </Button>
          )}
          
          {/* Botão Excluir - sempre visível */}
          <Button
            variant="outline"
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => setModalExcluirOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total de Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalContatos}
              </span>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Leads Qualificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalLeads}
              </span>
              <Target className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalContatos > 0
                  ? Math.round(
                      (campanha.totalLeads / campanha.totalContatos) * 100
                    )
                  : 0}
                %
              </span>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setAbaAtiva('visao-geral')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === 'visao-geral' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Visão Geral
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva('contatos')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === 'contatos' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contatos
              {campanha.totalContatos > 0 && (
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                  {campanha.totalContatos}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva('empreendimento')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              abaAtiva === 'empreendimento' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empreendimento
            </span>
          </button>
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      
      {/* ABA: Visão Geral */}
      {abaAtiva === 'visao-geral' && (
        <div className="space-y-6">
          {/* Resumo rápido do empreendimento */}
          {briefing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo do Empreendimento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed">
                  {campanha.briefingCompleto || 'Sem resumo disponível.'}
                </p>
                {briefing.faixa_preco && (
                  <div className="mt-4 flex items-center gap-4">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-slate-900 font-medium">
                      {formatarPreco(briefing.faixa_preco.min)} - {formatarPreco(briefing.faixa_preco.max)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Estatísticas de Contatos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estatísticas de Prospecção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">{estatisticasContatos['AGUARDANDO'] || 0}</div>
                  <div className="text-sm text-slate-600">Aguardando</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{estatisticasContatos['CONTATANDO'] || 0}</div>
                  <div className="text-sm text-slate-600">Em Contato</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{estatisticasContatos['INTERESSADO'] || 0}</div>
                  <div className="text-sm text-slate-600">Interessados</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">{estatisticasContatos['LEAD'] || 0}</div>
                  <div className="text-sm text-slate-600">Leads</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA: Contatos */}
      {abaAtiva === 'contatos' && (
        <div className="space-y-4">
          {/* Barra de ações */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={filtroStatus}
                onChange={(e) => { setFiltroStatus(e.target.value); setPaginaAtual(1); }}
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Filtrar por status"
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                <option value="AGUARDANDO">Aguardando</option>
                <option value="CONTATANDO">Contatando</option>
                <option value="RESPONDEU">Respondeu</option>
                <option value="INTERESSADO">Interessado</option>
                <option value="SEM_INTERESSE">Sem Interesse</option>
                <option value="LEAD">Lead</option>
              </select>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportarContatos}>
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Tabela de Contatos */}
          <Card>
            <CardContent className="p-0">
              {loadingContatos ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : contatos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <Users className="w-12 h-12 mb-2 text-slate-300" />
                  <p>Nenhum contato encontrado</p>
                  <p className="text-sm">Execute a mineração para capturar contatos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Telefone</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Imóvel</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contatos.map((contato) => (
                        <tr key={contato.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{contato.nome}</div>
                            {contato.cpf && (
                              <div className="text-xs text-slate-500">CPF: {contato.cpf}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {contato.temWhatsapp && (
                                <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                              )}
                              <span>{formatarTelefone(contato.telefone)}</span>
                            </div>
                            {contato.telefone2 && (
                              <div className="text-xs text-slate-500">{formatarTelefone(contato.telefone2)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-700">{contato.email || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-700 max-w-[200px]" title={`${contato.unidade || ''} ${contato.box ? '| Box ' + contato.box : ''}`}>
                              {contato.unidade ? (
                                <>
                                  <span className="font-medium">{contato.unidade}</span>
                                  {contato.box && (
                                    <span className="text-emerald-600 ml-1">Box {contato.box}</span>
                                  )}
                                </>
                              ) : (
                                <span className="truncate">{contato.enderecoImovel || '-'}</span>
                              )}
                            </div>
                            {contato.bairroImovel && (
                              <div className="text-xs text-slate-500">{contato.bairroImovel}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {contato.scoreAssertiva ? (
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                contato.scoreAssertiva >= 70 ? 'bg-green-100 text-green-700' :
                                contato.scoreAssertiva >= 40 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {contato.scoreAssertiva}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusProspeccaoColor(contato.statusProspeccao)}`}>
                              {contato.statusProspeccao.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => setContatoSelecionado(contato)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Mostrando {contatos.length} de {totalContatos} contatos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual === 1}
                  onClick={() => setPaginaAtual(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual === totalPaginas}
                  onClick={() => setPaginaAtual(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA: Empreendimento - Editor Completo */}
      {abaAtiva === 'empreendimento' && (
        <EditorBriefing
          briefingAtual={briefing}
          resumoAtual={campanha?.briefingCompleto || ''}
          confiabilidade={confiabilidade}
          onSalvar={async (dados) => {
            try {
              await api.put(`/campanhas/${id}/briefing`, {
                briefingCompleto: dados.briefingCompleto,
                briefingEstruturado: dados.briefingEstruturado,
                validar: true,
              });
              mostrarNotificacao('sucesso', 'Dados do empreendimento salvos com sucesso!');
              carregarCampanha();
            } catch (error) {
              console.error('Erro ao salvar briefing:', error);
              mostrarNotificacao('erro', 'Erro ao salvar alterações.');
              throw error;
            }
          }}
        />
      )}

      {/* Modal de Detalhes do Contato */}
      <Dialog open={!!contatoSelecionado} onOpenChange={() => setContatoSelecionado(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Contato</DialogTitle>
          </DialogHeader>
          {contatoSelecionado && (
            <div className="space-y-4">
              {/* Dados Pessoais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Nome</label>
                  <p className="font-medium text-slate-900">{contatoSelecionado.nome}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">CPF</label>
                  <p className="font-medium text-slate-900">{contatoSelecionado.cpf || '-'}</p>
                </div>
              </div>

              {/* Contatos */}
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contatos
                  {contatoSelecionado.quantidadeWhatsapp > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      <MessageSquare className="w-3 h-3" />
                      {contatoSelecionado.quantidadeWhatsapp} WhatsApp
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Renderizar telefones do JSON se disponível, senão usa campos individuais */}
                  {contatoSelecionado.telefonesJson && Array.isArray(contatoSelecionado.telefonesJson) ? (
                    <>
                      {(contatoSelecionado.telefonesJson as any[]).map((tel, idx) => (
                        <div key={idx}>
                          <label className="text-xs text-slate-500">
                            Telefone {idx + 1} ({tel.tipo === 'CELULAR' ? 'Cel' : 'Fixo'})
                          </label>
                          <p className="font-medium text-slate-900 flex items-center gap-1">
                            {formatarTelefone(tel.numero)}
                            {tel.whatsapp && (
                              <MessageSquare className="w-4 h-4 text-green-600" />
                            )}
                          </p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-slate-500">Telefone Principal</label>
                        <p className="font-medium text-slate-900 flex items-center gap-1">
                          {formatarTelefone(contatoSelecionado.telefone)}
                          {contatoSelecionado.temWhatsapp && (
                            <MessageSquare className="w-4 h-4 text-green-600" />
                          )}
                        </p>
                      </div>
                      {contatoSelecionado.telefone2 && (
                        <div>
                          <label className="text-xs text-slate-500">Telefone 2</label>
                          <p className="font-medium text-slate-900">{formatarTelefone(contatoSelecionado.telefone2)}</p>
                        </div>
                      )}
                      {contatoSelecionado.telefone3 && (
                        <div>
                          <label className="text-xs text-slate-500">Telefone 3</label>
                          <p className="font-medium text-slate-900">{formatarTelefone(contatoSelecionado.telefone3)}</p>
                        </div>
                      )}
                      {contatoSelecionado.telefone4 && (
                        <div>
                          <label className="text-xs text-slate-500">Telefone 4</label>
                          <p className="font-medium text-slate-900">{formatarTelefone(contatoSelecionado.telefone4)}</p>
                        </div>
                      )}
                      {contatoSelecionado.telefone5 && (
                        <div>
                          <label className="text-xs text-slate-500">Telefone 5</label>
                          <p className="font-medium text-slate-900">{formatarTelefone(contatoSelecionado.telefone5)}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs text-slate-500">Email Principal</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.email || '-'}</p>
                  </div>
                  {contatoSelecionado.email2 && (
                    <div>
                      <label className="text-xs text-slate-500">Email 2</label>
                      <p className="font-medium text-slate-900">{contatoSelecionado.email2}</p>
                    </div>
                  )}
                  {contatoSelecionado.email3 && (
                    <div>
                      <label className="text-xs text-slate-500">Email 3</label>
                      <p className="font-medium text-slate-900">{contatoSelecionado.email3}</p>
                    </div>
                  )}
                  {contatoSelecionado.email4 && (
                    <div>
                      <label className="text-xs text-slate-500">Email 4</label>
                      <p className="font-medium text-slate-900">{contatoSelecionado.email4}</p>
                    </div>
                  )}
                  {contatoSelecionado.email5 && (
                    <div>
                      <label className="text-xs text-slate-500">Email 5</label>
                      <p className="font-medium text-slate-900">{contatoSelecionado.email5}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dados do Imóvel */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-blue-900 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Dados do Imóvel
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500">Endereço</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.enderecoImovel || '-'}</p>
                  </div>
                  {contatoSelecionado.unidade && (
                    <div>
                      <label className="text-xs text-slate-500">Unidade</label>
                      <p className="font-medium text-blue-700">{contatoSelecionado.unidade}</p>
                    </div>
                  )}
                  {contatoSelecionado.box && (
                    <div>
                      <label className="text-xs text-slate-500">Box/Garagem</label>
                      <p className="font-medium text-blue-700">{contatoSelecionado.box}</p>
                    </div>
                  )}
                  {contatoSelecionado.quadra && (
                    <div>
                      <label className="text-xs text-slate-500">Quadra</label>
                      <p className="font-medium text-slate-900">{contatoSelecionado.quadra}</p>
                    </div>
                  )}
                  {contatoSelecionado.lote && (
                    <div>
                      <label className="text-xs text-slate-500">Lote</label>
                      <p className="font-medium text-slate-900">{contatoSelecionado.lote}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-500">Bairro</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.bairroImovel || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Tipo</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.tipoImovel || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Área Terreno</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.areaTerreno ? `${contatoSelecionado.areaTerreno} m²` : '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Área Construída</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.areaConstruida ? `${contatoSelecionado.areaConstruida} m²` : '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Valor Venal</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.valorVenal ? formatarPreco(Number(contatoSelecionado.valorVenal)) : '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Inscrição IPTU</label>
                    <p className="font-medium text-slate-900">{contatoSelecionado.inscricaoIptu || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Status e Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-xs text-slate-500">Score</label>
                    <p className={`font-bold text-lg ${
                      (contatoSelecionado.scoreAssertiva || 0) >= 70 ? 'text-green-600' :
                      (contatoSelecionado.scoreAssertiva || 0) >= 40 ? 'text-yellow-600' : 'text-slate-600'
                    }`}>
                      {contatoSelecionado.scoreAssertiva || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Status</label>
                    <p className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusProspeccaoColor(contatoSelecionado.statusProspeccao)}`}>
                      {contatoSelecionado.statusProspeccao.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <label className="text-xs text-slate-500">Tentativas de Contato</label>
                  <p className="font-medium text-slate-900">{contatoSelecionado.tentativasContato}</p>
                </div>
              </div>

              {/* Observações */}
              {contatoSelecionado.observacoes && (
                <div>
                  <label className="text-xs text-slate-500">Observações</label>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{contatoSelecionado.observacoes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContatoSelecionado(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Importar de Lista */}
      <Dialog open={modalListaOpen} onOpenChange={setModalListaOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="w-5 h-5 text-purple-600" />
              Importar de Lista
            </DialogTitle>
            <DialogDescription>
              Selecione uma lista de contatos minerados para importar para esta campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {carregandoListas ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : listas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <List className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">Nenhuma lista disponível</p>
                <p className="text-sm mt-1">
                  Vá em <strong>Captação</strong> para minerar novos contatos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Selecione a lista
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {listas.map((lista) => {
                    const disponiveis = lista.totalContatos - lista.totalUsados;
                    return (
                      <button
                        key={lista.id}
                        onClick={() => setListaSelecionada(lista.id)}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          listaSelecionada === lista.id
                            ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                            : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{lista.nome}</p>
                            <p className="text-sm text-slate-500">{lista.nomeEdificio}</p>
                          </div>
                          {listaSelecionada === lista.id && (
                            <CheckCircle2 className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {disponiveis} disponíveis
                          </span>
                          {lista.totalComWhatsapp > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <MessageSquare className="w-3 h-3" />
                              {lista.totalComWhatsapp} WhatsApp
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalListaOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={importarDeLista} 
              disabled={!listaSelecionada || importandoDeLista}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {importandoDeLista ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar Contatos'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Status */}
      <Dialog open={modalStatusOpen} onOpenChange={setModalStatusOpen}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const config = getStatusModalConfig();
            if (!config) return null;
            
            const IconeStatus = config.icone;
            
            return (
              <>
                <DialogHeader className="text-center sm:text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <IconeStatus className={`h-8 w-8 ${config.corIcone}`} />
                  </div>
                  <DialogTitle className="text-xl">{config.titulo}</DialogTitle>
                  <DialogDescription className="text-slate-600 text-base pt-2">
                    {config.mensagem}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-3 sm:justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setModalStatusOpen(false);
                      setNovoStatusPendente(null);
                    }}
                    disabled={processando}
                    className="flex-1 sm:flex-none"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={executarAtualizarStatus}
                    disabled={processando}
                    className={`flex-1 sm:flex-none text-white ${config.corBotao}`}
                  >
                    {processando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Confirmar'
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Excluir Campanha</DialogTitle>
            <DialogDescription className="text-slate-600 text-base pt-2">
              Tem certeza que deseja excluir a campanha <strong>"{campanha?.nome}"</strong>? 
              <span className="block mt-2 text-red-600 font-medium">
                Todos os contatos associados serão removidos permanentemente.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setModalExcluirOpen(false)}
              disabled={processando}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={excluirCampanha}
              disabled={processando}
              className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white"
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sim, Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast de Notificação */}
      {notificacao && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-right-5 duration-300 ${
          notificacao.tipo === 'sucesso' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            notificacao.tipo === 'sucesso' ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {notificacao.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <p className="font-medium">{notificacao.mensagem}</p>
          <button 
            onClick={() => setNotificacao(null)}
            title="Fechar notificação"
            className={`ml-2 p-1 rounded-lg hover:bg-white/50 transition-colors ${
              notificacao.tipo === 'sucesso' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
