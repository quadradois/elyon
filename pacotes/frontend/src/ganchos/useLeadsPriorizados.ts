/**
 * Hook para consumir o endpoint de leads priorizados.
 * Faz polling a cada 30s para manter o feed atualizado.
 * v2.0 — Tipos completos alinhados com o serviço backend enriquecido.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../servicos/api';

export type CategoriaUrgencia = 'URGENTE' | 'ATENCAO' | 'IA_ATIVA' | 'SEM_ACAO';

// Imóvel da tabela Imovel (wizard de captação)
export interface ImovelCaptacao {
  id: string;
  inscricaoIptu: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  nomeEdificio: string | null;
  apartamento: string | null;
  bloco: string | null;
  tipoImovel: string | null;
  areaTerreno: number | null;
  areaEdificada: number | null;
  numeroPavimentos: number | null;
  vagasCobertas: number | null;
  vagasDescobertas: number | null;
  interesse: string | null;
  statusCaptacao: string | null;
  criadoEm: string;
}

export interface AtividadePriorizado {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  agendadoPara: string | null;
  completadoEm: string | null;
  statusAgendamento: string | null;
  criadoEm: string;
}

export interface LeadPriorizado {
  // ── Identificação ──
  id: string;
  nome: string | null;
  telefone: string | null;
  telefone2: string | null;
  telefone3: string | null;
  email: string | null;
  email2: string | null;
  cpf: string | null;
  status: string;
  temperatura: string | null;
  origem: string | null;
  criadoEm: string;
  atualizadoEm: string;
  primeiroContato: string | null;
  ultimaInteracao: string | null;
  briefingCloser: string | null;

  // ── Campanha ──
  campanhaOrigem: { id: string; nome: string } | null;

  // ── Imóvel flat ──
  enderecoImovel: string | null;
  tipoImovel: string | null;
  areaImovel: string | null;
  quartosImovel: number | null;
  vagasImovel: number | null;
  valorPretendido: string | null;
  ocupacaoImovel: string | null;
  interesseEm: string | null;
  bairroImovel: string | null;
  nomeEdificio: string | null;
  inscricaoIptu: string | null;
  valorVenal: string | null;

  // ── SPIN Qualificação completo ──
  situacaoAtual: string | null;
  tempoDecisao: string | null;
  tentativasAnteriores: string | null;
  comCorretorAtualmente: boolean | null;
  motivacaoVenda: string | null;
  doresIdentificadas: string[];
  prazoDesejado: string | null;
  urgenciaEnum: string | null;
  consequencias: string | null;
  custosAtuais: string | null;
  pressaoTempo: boolean | null;
  expectativaServico: string | null;
  objecoes: string[];
  interesseAvaliacao: boolean | null;
  observacoesSpin: string | null;

  // ── Qualificação adicional (Fase 2) ──
  situacaoFinanceira: string | null;
  temDividas: boolean | null;
  estadoConservacao: string | null;

  // ── Negociação (Fase 3) ──
  comissaoAcordada: string | null;
  tipoAutorizacao: string | null;
  prazoTrabalho: number | null;
  autorizouAnuncio: boolean | null;

  // ── Dados completos do imóvel — wizard de captação (pós-contrato) ──
  imovelSuites: number | null;
  imovelBanheiros: number | null;
  imovelAreaTotal: number | null;
  imovelAndar: number | null;
  imovelCaracteristicas: string[];
  imovelDescricao: string | null;
  imovelFotos: string[];
  imovelValorLocacao: number | null;
  imovelValorCondominio: number | null;
  imovelValorIPTU: number | null;
  dadosImovelColetadosEm: string | null;

  // ── Imóveis minerados (tabela Imovel — wizard de captação) ──
  imoveisCaptacao: ImovelCaptacao[];

  // ── Contato/Pessoa ──
  idade: number | null;
  sexo: string | null;
  rendaEstimada: string | null;
  faixaSalarial: string | null;
  scoreAssertiva: number | null;
  profissao: string | null;
  empresaAtual: string | null;

  // ── Tracking IA ──
  ultimaAcaoIA: string | null;
  ultimaAcaoIAEm: string | null;

  // ── Calculados ──
  urgencia: number;
  scoreQualificacao: number;
  scoreComposto: number;
  categoriaUrgencia: CategoriaUrgencia;
  motivoUrgencia: string;
  resumoIA: string;

  // ── Atividades ──
  proximaAtividade: AtividadePriorizado | null;
  atividades: AtividadePriorizado[];

  // ── Métricas ──
  totalMensagens: number;
  horasSemResposta: number | null;
  faseSPIN: string | null;
}

export interface EstatisticasPriorizadas {
  total: number;
  quentes: number;
  mornos: number;
  frios: number;
  agendamentosHoje: number;
  novosHoje: number;
  iaAtiva: number;
}

export interface PipelineResumo {
  qualificacao: number;
  apresentacao: number;
  documentacao: number;
  onboarding: number;
}

interface FiltrosPriorizados {
  temperatura?: string;
  categoria?: CategoriaUrgencia;
  busca?: string;
}

const ESTATISTICAS_VAZIA: EstatisticasPriorizadas = {
  total: 0, quentes: 0, mornos: 0, frios: 0,
  agendamentosHoje: 0, novosHoje: 0, iaAtiva: 0,
};

const PIPELINE_VAZIO: PipelineResumo = {
  qualificacao: 0, apresentacao: 0, documentacao: 0, onboarding: 0,
};

export function useLeadsPriorizados(filtros?: FiltrosPriorizados) {
  const [leads, setLeads] = useState<LeadPriorizado[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasPriorizadas>(ESTATISTICAS_VAZIA);
  const [pipeline, setPipeline] = useState<PipelineResumo>(PIPELINE_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro('');
      const response = await api.get('/leads/priorizados?limit=100');
      const data = response.data;

      let leadsFiltrados: LeadPriorizado[] = data.leads || [];

      // Filtros client-side
      if (filtros?.temperatura) {
        leadsFiltrados = leadsFiltrados.filter(
          (l) => l.temperatura === filtros.temperatura
        );
      }
      if (filtros?.categoria) {
        leadsFiltrados = leadsFiltrados.filter(
          (l) => l.categoriaUrgencia === filtros.categoria
        );
      }
      if (filtros?.busca) {
        const termo = filtros.busca.toLowerCase();
        leadsFiltrados = leadsFiltrados.filter((l) =>
          (l.nome || '').toLowerCase().includes(termo) ||
          (l.telefone || '').includes(termo) ||
          (l.email || '').toLowerCase().includes(termo) ||
          (l.cpf || '').includes(termo)
        );
      }

      setLeads(leadsFiltrados);
      setEstatisticas(data.estatisticas || ESTATISTICAS_VAZIA);
      setPipeline(data.pipeline || PIPELINE_VAZIO);
    } catch (error) {
      console.error('Erro ao carregar leads priorizados:', error);
      setErro('Não foi possível carregar os leads.');
    } finally {
      setCarregando(false);
    }
  }, [filtros?.temperatura, filtros?.categoria, filtros?.busca]);

  useEffect(() => {
    setCarregando(true);
    carregar();
    intervalRef.current = setInterval(carregar, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [carregar]);

  return { leads, estatisticas, pipeline, carregando, erro, recarregar: carregar };
}
