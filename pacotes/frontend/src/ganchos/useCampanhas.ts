import { useCallback, useEffect, useState } from 'react';
import { api } from '../servicos/api';

export interface CampanhaItem {
  id: string;
  nome: string;
}

export function useCampanhas() {
  const [campanhas, setCampanhas] = useState<CampanhaItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const res = await api.get('/campanhas');
      setCampanhas(res.data?.campanhas || []);
    } catch {
      setCampanhas([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return { campanhas, carregando };
}
