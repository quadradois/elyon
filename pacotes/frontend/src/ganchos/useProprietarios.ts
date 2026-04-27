import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../servicos/api';

export type EstagioProprietario = 'Em Prospecção' | 'Respondeu' | 'Qualificado' | 'Em Negociação' | 'Captado';

export interface ProprietarioItem {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  campanhaId?: string | null;
  campanhaNome?: string | null;
  empreendimento?: string | null;
  statusProspeccao?: string | null;
  virouLead?: boolean;
  leadId?: string | null;
  statusLead?: string | null;
  temperatura?: string | null;
  estagio: EstagioProprietario;
  criadoEm?: string;
  ultimaInteracao?: string;
}

interface Metadata {
  total: number;
  pagina: number;
  limit: number;
  totalPaginas: number;
}

interface UseProprietariosParams {
  busca?: string;
  campanhaId?: string;
  estagio?: EstagioProprietario | 'Todos';
  page?: number;
  limit?: number;
}

export function useProprietarios(params: UseProprietariosParams) {
  const [dados, setDados] = useState<ProprietarioItem[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({ total: 0, pagina: 1, limit: params.limit || 20, totalPaginas: 1 });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');

      const query = new URLSearchParams();
      query.set('page', String(params.page || 1));
      query.set('limit', String(params.limit || 20));
      if (params.busca) query.set('busca', params.busca);
      if (params.campanhaId) query.set('campanhaId', params.campanhaId);
      if (params.estagio && params.estagio !== 'Todos') query.set('estagio', params.estagio);

      const response = await api.get(`/proprietarios?${query.toString()}`);
      setDados(response.data?.data || []);
      setMetadata(response.data?.metadata || { total: 0, pagina: 1, limit: params.limit || 20, totalPaginas: 1 });
    } catch (error) {
      console.error('[useProprietarios] erro ao carregar:', error);
      setErro('Não foi possível carregar proprietários.');
    } finally {
      setCarregando(false);
    }
  }, [params.page, params.limit, params.busca, params.campanhaId, params.estagio]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contagemPorEstagio = useMemo(() => {
    const base = {
      'Em Prospecção': 0,
      'Respondeu': 0,
      'Qualificado': 0,
      'Em Negociação': 0,
      'Captado': 0,
    } as Record<EstagioProprietario, number>;

    for (const item of dados) {
      if (item.estagio in base) {
        base[item.estagio as EstagioProprietario] += 1;
      }
    }

    return base;
  }, [dados]);

  return {
    dados,
    metadata,
    carregando,
    erro,
    contagemPorEstagio,
    recarregar: carregar,
  };
}
