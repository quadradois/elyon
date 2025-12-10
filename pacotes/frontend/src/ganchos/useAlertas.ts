/**
 * Hook useAlertas
 * 
 * Gerencia alertas em tempo real via WebSocket
 * Mantém estado sincronizado com o servidor
 */

import { useState, useEffect, useCallback } from 'react';
import { websocketService, AlertaEvento } from '../servicos/websocket';
import { api } from '../servicos/api';

interface UseAlertasReturn {
  alertas: AlertaEvento[];
  totalPendentes: number;
  conectado: boolean;
  carregando: boolean;
  marcarVisualizado: (alertaId: string) => void;
  marcarAtendido: (alertaId: string) => void;
  recarregar: () => Promise<void>;
}

export function useAlertas(): UseAlertasReturn {
  const [alertas, setAlertas] = useState<AlertaEvento[]>([]);
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  
  // Carregar alertas iniciais via API
  const carregarAlertas = useCallback(async () => {
    try {
      setCarregando(true);
      const response = await api.get('/alertas?status=pendente&limite=20');
      if (response.data.sucesso) {
        setAlertas(response.data.alertas || []);
      }
    } catch (error) {
      console.error('[useAlertas] Erro ao carregar:', error);
    } finally {
      setCarregando(false);
    }
  }, []);
  
  // Conectar WebSocket ao montar
  useEffect(() => {
    // Obter tenant do localStorage
    const tenantData = localStorage.getItem('elyon_tenant');
    if (!tenantData) {
      setCarregando(false);
      return;
    }
    
    let tenantId: string;
    try {
      const tenant = JSON.parse(tenantData);
      tenantId = tenant.id;
    } catch {
      setCarregando(false);
      return;
    }
    
    // Conectar ao WebSocket
    websocketService.conectar(tenantId);
    
    // Carregar alertas iniciais
    carregarAlertas();
    
    // Registrar callbacks
    const unsubConexao = websocketService.onConexao((status) => {
      setConectado(status);
    });
    
    const unsubNovoAlerta = websocketService.onNovoAlerta((alerta) => {
      setAlertas(prev => {
        // Evitar duplicatas
        if (prev.some(a => a.id === alerta.id)) {
          return prev;
        }
        // Adicionar no início
        return [alerta, ...prev];
      });
    });
    
    const unsubAtualizado = websocketService.onAlertaAtualizado((dados) => {
      setAlertas(prev => 
        prev.map(a => 
          a.id === dados.alertaId 
            ? { ...a, status: dados.status }
            : a
        ).filter(a => a.status === 'pendente') // Remove resolvidos
      );
    });
    
    const unsubPendentes = websocketService.onAlertasPendentes((alertasPendentes) => {
      setAlertas(alertasPendentes);
      setCarregando(false);
    });
    
    // Cleanup
    return () => {
      unsubConexao();
      unsubNovoAlerta();
      unsubAtualizado();
      unsubPendentes();
    };
  }, [carregarAlertas]);
  
  // Marcar como visualizado
  const marcarVisualizado = useCallback((alertaId: string) => {
    websocketService.marcarAlertaVisualizado(alertaId);
    setAlertas(prev => 
      prev.map(a => 
        a.id === alertaId 
          ? { ...a, status: 'visualizado' }
          : a
      )
    );
  }, []);
  
  // Marcar como atendido
  const marcarAtendido = useCallback((alertaId: string) => {
    const userData = localStorage.getItem('elyon_user');
    let usuarioId = 'unknown';
    try {
      if (userData) {
        const user = JSON.parse(userData);
        usuarioId = user.id;
      }
    } catch {}
    
    websocketService.marcarAlertaAtendido(alertaId, usuarioId);
    setAlertas(prev => prev.filter(a => a.id !== alertaId));
  }, []);
  
  // Contar pendentes
  const totalPendentes = alertas.filter(a => a.status === 'pendente').length;
  
  return {
    alertas,
    totalPendentes,
    conectado,
    carregando,
    marcarVisualizado,
    marcarAtendido,
    recarregar: carregarAlertas
  };
}
