import { useCallback, useEffect, useState } from 'react';
import { api } from '../servicos/api';

// BUG-FIX: 'Descartado' adicionado ao funil
export type EstagioProprietario =
  | 'Em Prospecção'
  | 'Respondeu'
  | 'Qualificado'
  | 'Em Negociação'
  | 'Captado'
  | 'Descartado';

export interface ProprietarioItem {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  campanhaId?: string | null;
  campanhaNome?: string | null;
  empreendimento?: string | null;
  statusProspeccao?: string | null;
  statusLead?: string | null;
  temperatura?: string | null;
  estagio: EstagioProprietario;
  criadoEm?: string;
  ultimaInteracao?: string;
  // DEAD-CODE removido: virouLead e leadId eram redundantes com Option A (leadId === id sempre)
}

interface Metadata {
  total: number;
  pagina: number;
  limit: number;
  totalPaginas: number;
  // BUG-FIX: contagens reais por estágio vindas do backend (não calculadas dos 50 itens da página)
  countsByEstagio: Record<EstagioProprietario, number>;
}

interface UseProprietariosParams {
  busca?: string;
  campanhaId?: string;
  estagio?: EstagioProprietario | 'Todos';
  page?: number;
  limit?: number;
  skip?: boolean; // permite suprimir o fetch (ex: quando em modo Kanban)
}

const COUNTS_VAZIO: Record<EstagioProprietario, number> = {
  'Em Prospecção': 0,
  'Respondeu':     0,
  'Qualificado':   0,
  'Em Negociação': 0,
  'Captado':       0,
  'Descartado':    0,
};

export function useProprietarios(params: UseProprietariosParams) {
  const [dados, setDados] = useState<ProprietarioItem[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({
    total: 0, pagina: 1, limit: params.limit || 20, totalPaginas: 1,
    countsByEstagio: { ...COUNTS_VAZIO },
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (params.skip) return;
    try {
      setCarregando(true);
      setErro('');

      const query = new URLSearchParams();
      query.set('page',  String(params.page  || 1));
      query.set('limit', String(params.limit || 20));
      if (params.busca)    query.set('busca',     params.busca);
      if (params.campanhaId) query.set('campanhaId', params.campanhaId);
      if (params.estagio && params.estagio !== 'Todos') query.set('estagio', params.estagio);

      const response = await api.get(`/proprietarios?${query.toString()}`);
      setDados(response.data?.data || []);
      setMetadata({
        total:          response.data?.metadata?.total          || 0,
        pagina:         response.data?.metadata?.pagina         || 1,
        limit:          response.data?.metadata?.limit          || params.limit || 20,
        totalPaginas:   response.data?.metadata?.totalPaginas   || 1,
        countsByEstagio: { ...COUNTS_VAZIO, ...(response.data?.metadata?.countsByEstagio || {}) },
      });
    } catch (error) {
      console.error('[useProprietarios] erro ao carregar:', error);
      setErro('Não foi possível carregar proprietários.');
    } finally {
      setCarregando(false);
    }
  }, [params.page, params.limit, params.busca, params.campanhaId, params.estagio, params.skip]);

  useEffect(() => { carregar(); }, [carregar]);

  return { dados, metadata, carregando, erro, recarregar: carregar };
}
