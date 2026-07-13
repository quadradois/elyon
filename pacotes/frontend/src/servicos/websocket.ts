/**
 * Serviço WebSocket para Notificações em Tempo Real
 * 
 * Gerencia conexão Socket.IO com o backend para:
 * - Receber alertas de atendimento humano
 * - Notificações de novas mensagens
 * - Atualizações de leads em tempo real
 */

import { io, Socket } from 'socket.io-client';

// Tipos de eventos
export interface AlertaEvento {
  id: string;
  tenantId: string;
  leadId?: string;
  leadNome?: string;
  leadTelefone?: string;
  tipo: string;
  prioridade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  mensagemPreview?: string;
  status: string;
  criadoEm: string;
}

export interface MensagemEvento {
  leadId: string;
  leadNome: string;
  mensagem: string;
  tipo: 'ENTRADA' | 'SAIDA';
}

export interface AlertaAtualizadoEvento {
  alertaId: string;
  status: string;
  atendidoPor?: string;
}

type AlertaCallback = (alerta: AlertaEvento) => void;
type MensagemCallback = (mensagem: MensagemEvento) => void;
type AlertaAtualizadoCallback = (dados: AlertaAtualizadoEvento) => void;
type ConexaoCallback = (conectado: boolean) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private conectado: boolean = false;
  private tokenAtual: string | null = null;

  // Callbacks registrados
  private alertaCallbacks: AlertaCallback[] = [];
  private mensagemCallbacks: MensagemCallback[] = [];
  private alertaAtualizadoCallbacks: AlertaAtualizadoCallback[] = [];
  private conexaoCallbacks: ConexaoCallback[] = [];
  private alertasPendentesCallback: ((alertas: AlertaEvento[]) => void) | null = null;

  /**
   * Conecta ao servidor WebSocket
   */
  conectar(): void {
    const token = localStorage.getItem('elyon_token');
    if (!token) {
      this.desconectar();
      return;
    }

    if (this.socket?.connected && this.tokenAtual === token) {
      return;
    }

    // Desconectar anterior se existir
    if (this.socket) {
      this.socket.disconnect();
    }

    this.tokenAtual = token;

    // Criar nova conexão
    // Criar nova conexão
    // Usar URL relativa para aproveitar o proxy do Nginx
    const wsUrl = '/';

    this.socket = io(wsUrl, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Eventos de conexão
    this.socket.on('connect', () => {
      console.log('[WS] ✅ Conectado ao servidor');
      this.conectado = true;
      this.notificarConexao(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[WS] ❌ Desconectado do servidor');
      this.conectado = false;
      this.notificarConexao(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Erro de conexão:', error.message);
      this.conectado = false;
      this.notificarConexao(false);
    });

    // Eventos de autenticação
    this.socket.on('autenticado', (dados) => {
      console.log('[WS] ✅ Autenticado com sucesso:', dados);
    });

    this.socket.on('erro', (dados) => {
      console.error('[WS] Erro do servidor:', dados);
    });

    // Eventos de alertas
    this.socket.on('alerta:novo', (alerta: AlertaEvento) => {
      console.log('[WS] 🔔 Novo alerta:', alerta);
      this.alertaCallbacks.forEach(cb => cb(alerta));
    });

    this.socket.on('alerta:atualizado', (dados: AlertaAtualizadoEvento) => {
      console.log('[WS] 📝 Alerta atualizado:', dados);
      this.alertaAtualizadoCallbacks.forEach(cb => cb(dados));
    });

    this.socket.on('alertas:pendentes', (alertas: AlertaEvento[]) => {
      console.log('[WS] 📋 Alertas pendentes recebidos:', alertas.length);
      if (this.alertasPendentesCallback) {
        this.alertasPendentesCallback(alertas);
      }
    });

    // Eventos de mensagens
    this.socket.on('mensagem:nova', (mensagem: MensagemEvento) => {
      console.log('[WS] 💬 Nova mensagem:', mensagem);
      this.mensagemCallbacks.forEach(cb => cb(mensagem));
    });
  }

  /**
   * Desconecta do servidor
   */
  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.conectado = false;
    this.tokenAtual = null;
  }

  /**
   * Verifica se está conectado
   */
  estaConectado(): boolean {
    return this.conectado && this.socket?.connected === true;
  }

  /**
   * Marca alerta como visualizado
   */
  marcarAlertaVisualizado(alertaId: string): void {
    if (!this.socket) return;
    this.socket.emit('alerta:visualizado', alertaId);
  }

  /**
   * Marca alerta como atendido
   */
  marcarAlertaAtendido(alertaId: string): void {
    if (!this.socket) return;
    this.socket.emit('alerta:atendido', alertaId);
  }

  // ========================================
  // REGISTRAR CALLBACKS
  // ========================================

  onNovoAlerta(callback: AlertaCallback): () => void {
    this.alertaCallbacks.push(callback);
    return () => {
      this.alertaCallbacks = this.alertaCallbacks.filter(cb => cb !== callback);
    };
  }

  onNovaMensagem(callback: MensagemCallback): () => void {
    this.mensagemCallbacks.push(callback);
    return () => {
      this.mensagemCallbacks = this.mensagemCallbacks.filter(cb => cb !== callback);
    };
  }

  onAlertaAtualizado(callback: AlertaAtualizadoCallback): () => void {
    this.alertaAtualizadoCallbacks.push(callback);
    return () => {
      this.alertaAtualizadoCallbacks = this.alertaAtualizadoCallbacks.filter(cb => cb !== callback);
    };
  }

  onConexao(callback: ConexaoCallback): () => void {
    this.conexaoCallbacks.push(callback);
    // Notificar estado atual imediatamente
    callback(this.conectado);
    return () => {
      this.conexaoCallbacks = this.conexaoCallbacks.filter(cb => cb !== callback);
    };
  }

  onAlertasPendentes(callback: (alertas: AlertaEvento[]) => void): () => void {
    this.alertasPendentesCallback = callback;
    return () => {
      this.alertasPendentesCallback = null;
    };
  }

  private notificarConexao(status: boolean): void {
    this.conexaoCallbacks.forEach(cb => cb(status));
  }
}

// Exportar instância singleton
export const websocketService = new WebSocketService();
