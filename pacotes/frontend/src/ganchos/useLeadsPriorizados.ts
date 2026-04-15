/**
 * Hook para consumir o endpoint de leads priorizados.
 * Faz polling a cada 30s para manter o feed atualizado.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../servicos/api';

// Tipos alinhados com o backend
export type CategoriaUrgencia = 'URGENTE' | 'ATENCAO' | 'IA_ATIVA' | 'SEM_ACAO';

export interface LeadPriorizado {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  temperatura: string | null;
  origem: string | null;
  criadoEm: string;
  atualizadoEm: string;
  primeiroContato: string | null;
  ultimaInteracao: string | null;
  briefingCloser: string | null;
  urgencia: number;
  categoriaUrgencia: CategoriaUrgencia;
  motivoUrgencia: string;
  resumoIA: string;
  ultimaAcaoIA: string | null;
  ultimaAcaoIAEm: string | null;
  proximaAtividade: {
    tipo: string;
    titulo: string;
    agendadoPara: string | null;
  } | null;
  totalMensagens: number;
  horasSemResposta: number | null;
  interesseEm: string | null;
  tipoImovel: string | null;
  valorPretendido: number | string | null;
  enderecoImovel: string | null;
  doresIdentificadas: string[];
  objecoes: string[];
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

export function useLeadsPriorizados(filtros?: FiltrosPriorizados) {
  const [leads, setLeads] = useState<LeadPriorizado[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasPriorizadas>({
    total: 0, quentes: 0, mornos: 0, frios: 0,
    agendamentosHoje: 0, novosHoje: 0, iaAtiva: 0,
  });
  const [pipeline, setPipeline] = useState<PipelineResumo>({
    qualificacao: 0, apresentacao: 0, documentacao: 0, onboarding: 0,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro('');
      const response = await api.get('/leads/priorizados?limit=100');
      const data = response.data;

      let leadsFiltrados = data.leads || [];

      // Filtros client-side (busca / temperatura / categoria)
      if (filtros?.temperatura) {
        leadsFiltrados = leadsFiltrados.filter(
          (l: LeadPriorizado) => l.temperatura === filtros.temperatura
        );
      }
      if (filtros?.categoria) {
        leadsFiltrados = leadsFiltrados.filter(
          (l: LeadPriorizado) => l.categoriaUrgencia === filtros.categoria
        );
      }
      if (filtros?.busca) {
        const termo = filtros.busca.toLowerCase();
        leadsFiltrados = leadsFiltrados.filter((l: LeadPriorizado) =>
          (l.nome || '').toLowerCase().includes(termo) ||
          (l.telefone || '').includes(termo) ||
          (l.email || '').toLowerCase().includes(termo)
        );
      }

      setLeads(leadsFiltrados);
      setEstatisticas(data.estatisticas || estatisticas);
      setPipeline(data.pipeline || pipeline);
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

    // Polling a cada 30s
    intervalRef.current = setInterval(carregar, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [carregar]);

  return {
    leads,
    estatisticas,
    pipeline,
    carregando,
    erro,
    recarregar: carregar,
  };
}
