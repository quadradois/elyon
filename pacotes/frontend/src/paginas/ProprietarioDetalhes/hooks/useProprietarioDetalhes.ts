import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../servicos/api';

export interface ProprietarioDetalhesData {
  id: string;
  estagio: string;
  contato: any | null;
  lead: any | null;
  campanha: any | null;
  mensagensProspecao: any[];
  atividades: any[];
  conversas: any[];
}

export function useProprietarioDetalhes() {
  const { id } = useParams<{ id: string }>();
  const [dados, setDados] = useState<ProprietarioDetalhesData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setCarregando(true);
      setErro('');
      const response = await api.get(`/proprietarios/${id}`);
      setDados(response.data?.data || null);
    } catch (error) {
      console.error('[useProprietarioDetalhes] erro:', error);
      setErro('Não foi possível carregar o proprietário.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { id, dados, carregando, erro, recarregar: carregar };
}
