import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../servicos/api";

// Tipos
export interface CampanhaDetalhes {
  id: string;
  nome: string;
  tenantId: string;
  tipo: string;
  parametrosBusca: any;
  nomeEmpreendimento: string | null;
  tipoImovel: string | null;
  localizacao: string | null;
  perfilImovel: string | null;
  // Endereço detalhado
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  // Briefing
  briefingCompleto: string | null;
  briefingEstruturado: any;
  briefingGeradoEm: string | null;
  briefingConfiabilidade: string | null;
  briefingValidado: boolean;
  validadoPor: string | null;
  validadoEm: string | null;
  // Métricas
  totalContatos: number;
  totalLeads: number;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Contato {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  telefone2: string | null;
  telefone3: string | null;
  telefone4: string | null;
  telefone5: string | null;
  telefonesJson: any | null;
  temWhatsapp: boolean;
  quantidadeWhatsapp: number;
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
  statusProspeccao: string | null;
  tentativasContato: number;
  ultimaTentativa: string | null;
  respondeu: boolean;
  manifestouInteresse: boolean;
  virouLead: boolean;
  leadId: string | null;
  observacoes: string | null;
  criadoEm: string;
}

export interface ListaSimples {
  id: string;
  nome: string;
  nomeEdificio: string;
  totalContatos: number;
  totalComWhatsapp: number;
  totalUsados: number;
}

export type TabType = 'visao-geral' | 'contatos' | 'empreendimento' | 'disparos';

export type StatusCampanha = "PAUSADA" | "FINALIZADA" | "ATIVA";

export interface Notificacao {
  tipo: 'sucesso' | 'erro';
  mensagem: string;
}

// Utilitários
export const formatarTelefone = (tel: string | null): string => {
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

export const formatarPreco = (valor: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(valor);
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "ATIVA":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "PAUSADA":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "FINALIZADA":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
  }
};

export const getStatusProspeccaoColor = (status: string): string => {
  const cores: Record<string, string> = {
    'AGUARDANDO': 'bg-slate-100 text-slate-700',
    'CONTATANDO': 'bg-indigo-100 text-indigo-700',
    'RESPONDEU': 'bg-emerald-100 text-emerald-700',
    'SEM_INTERESSE': 'bg-red-100 text-red-700',
    'INTERESSADO': 'bg-violet-100 text-violet-700',
    'LEAD': 'bg-emerald-100 text-emerald-700',
  };
  return cores[status] || 'bg-slate-100 text-slate-700';
};

// Hook Principal
export function useCampanhaDetalhes(id: string | undefined) {
  const navigate = useNavigate();
  
  // Estados principais
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

  // Estados para Modais de Confirmação
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [modalStatusOpen, setModalStatusOpen] = useState(false);
  const [novoStatusPendente, setNovoStatusPendente] = useState<StatusCampanha | null>(null);
  const [processando, setProcessando] = useState(false);
  
  // Estados para Notificação
  const [notificacao, setNotificacao] = useState<Notificacao | null>(null);

  // Funções
  const mostrarNotificacao = useCallback((tipo: 'sucesso' | 'erro', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => setNotificacao(null), 4000);
  }, []);

  const carregarCampanha = useCallback(async () => {
    if (!id) return;
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
  }, [id]);

  const carregarContatos = useCallback(async () => {
    if (!id) return;
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
  }, [id, paginaAtual, filtroStatus]);

  const exportarContatos = useCallback(async () => {
    if (!id || !campanha) return;
    
    try {
      setProcessando(true);
      mostrarNotificacao('sucesso', 'Gerando exportação completa (Dossiê). Aguarde...');
      
      // Chamada para o novo endpoint de exportação enriquecida no backend
      const response = await api.get(`/campanhas/${id}/exportar-csv`, {
        responseType: 'blob'
      });
      
      // Criar link e disparar download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const dataStr = new Date().toISOString().split('T')[0];
      const nomeCampanha = campanha.nome ? campanha.nome.substring(0, 30).replace(/\s+/g, '_') : 'campanha';
      link.setAttribute('download', `dossie_${nomeCampanha}_${dataStr}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Limpeza
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      mostrarNotificacao('sucesso', 'Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar contatos:', error);
      mostrarNotificacao('erro', 'Erro ao gerar exportação completa. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }, [id, campanha, mostrarNotificacao]);

  const excluirCampanha = useCallback(async () => {
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
  }, [campanha, id, navigate, mostrarNotificacao]);

  const confirmarAtualizarStatus = useCallback((novoStatus: StatusCampanha) => {
    setNovoStatusPendente(novoStatus);
    setModalStatusOpen(true);
  }, []);

  const executarAtualizarStatus = useCallback(async () => {
    if (!campanha || !novoStatusPendente) return;

    try {
      setProcessando(true);
      await api.patch(`/campanhas/${id}/status`, { status: novoStatusPendente });
      setModalStatusOpen(false);
      
      const statusLabels: Record<StatusCampanha, string> = {
        PAUSADA: 'pausada',
        FINALIZADA: 'finalizada',
        ATIVA: 'reativada'
      };
      
      mostrarNotificacao('sucesso', `Campanha ${statusLabels[novoStatusPendente]} com sucesso!`);
      carregarCampanha();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      mostrarNotificacao('erro', 'Erro ao atualizar status da campanha. Tente novamente.');
    } finally {
      setProcessando(false);
      setNovoStatusPendente(null);
    }
  }, [campanha, id, novoStatusPendente, mostrarNotificacao, carregarCampanha]);

  const importarContatos = useCallback(async () => {
    if (!textoImportacao.trim()) return;

    try {
      setImportando(true);

      const linhas = textoImportacao.split("\n").filter((l) => l.trim());
      const contatosParaImportar = linhas
        .map((linha) => {
          const [nome, telefone, email] = linha.split(",").map((s) => s.trim());
          return {
            nome: nome || "Sem Nome",
            telefone: telefone || "",
            email: email || "",
          };
        })
        .filter((c) => c.nome && c.telefone);

      if (contatosParaImportar.length === 0) {
        mostrarNotificacao('erro', 'Nenhum contato válido encontrado. Use o formato: Nome, Telefone');
        return;
      }

      const response = await api.post(`/campanhas/${id}/importar-contatos`, {
        contatos: contatosParaImportar,
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
  }, [id, textoImportacao, mostrarNotificacao, carregarCampanha]);

  const carregarListas = useCallback(async () => {
    try {
      setCarregandoListas(true);
      const response = await api.get('/listas');
      // Proteção contra resposta corrompida (erro 500 parseado no interceptor)
      const dataAsArray = Array.isArray(response.data) ? response.data : [];
      
      const listasDisponiveis = dataAsArray.filter(
        (lista: ListaSimples) => lista.totalContatos > 0
      );
      setListas(listasDisponiveis);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    } finally {
      setCarregandoListas(false);
    }
  }, []);

  const abrirModalLista = useCallback(() => {
    setModalListaOpen(true);
    carregarListas();
  }, [carregarListas]);

  const importarDeLista = useCallback(async () => {
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
  }, [id, listaSelecionada, abaAtiva, mostrarNotificacao, carregarCampanha, carregarContatos]);

  const salvarBriefing = useCallback(async (dados: { briefingCompleto: string; briefingEstruturado: any }) => {
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
  }, [id, mostrarNotificacao, carregarCampanha]);

  const fecharNotificacao = useCallback(() => {
    setNotificacao(null);
  }, []);

  // Effects
  useEffect(() => {
    if (id) {
      carregarCampanha();
    }
  }, [id, carregarCampanha]);

  useEffect(() => {
    if (id && abaAtiva === 'contatos') {
      carregarContatos();
    }
  }, [id, abaAtiva, carregarContatos]);

  return {
    // Dados
    campanha,
    loading,
    erro,
    contatos,
    loadingContatos,
    paginaAtual,
    totalContatos,
    totalPaginas,
    filtroStatus,
    estatisticasContatos,
    listas,
    listaSelecionada,
    carregandoListas,
    importandoDeLista,
    notificacao,
    processando,
    novoStatusPendente,
    
    // Estados de Abas
    abaAtiva,
    setAbaAtiva,
    
    // Estados de Modais
    modalImportacaoOpen,
    setModalImportacaoOpen,
    modalListaOpen,
    setModalListaOpen,
    modalExcluirOpen,
    setModalExcluirOpen,
    modalStatusOpen,
    setModalStatusOpen,
    
    // Estados de Importação
    abaImportacao,
    setAbaImportacao,
    textoImportacao,
    setTextoImportacao,
    importando,
    
    // Funções de Paginação
    setPaginaAtual,
    setFiltroStatus,
    setListaSelecionada,
    
    // Ações
    carregarCampanha,
    carregarContatos,
    exportarContatos,
    excluirCampanha,
    confirmarAtualizarStatus,
    executarAtualizarStatus,
    setNovoStatusPendente,
    importarContatos,
    abrirModalLista,
    importarDeLista,
    salvarBriefing,
    mostrarNotificacao,
    fecharNotificacao,
    navigate,
  };
}
