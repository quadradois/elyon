import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { prisma } from '../lib/db';

/**
 * SERVIÇO DE WEBSOCKET PARA ALERTAS
 * 
 * Responsável por:
 * - Gerenciar conexões WebSocket por tenant
 * - Emitir alertas em tempo real para corretores
 * - Notificar atualizações de leads
 */

interface ConexaoCliente {
  socketId: string;
  tenantId: string;
  usuarioId: string;
  nome: string;
  papel: string;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private conexoes: Map<string, ConexaoCliente> = new Map();
  
  /**
   * Inicializa o servidor WebSocket
   */
  inicializar(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
      },
      path: '/ws'
    });
    
    this.io.on('connection', (socket) => {
      console.log(`[WS] 🔌 Nova conexão: ${socket.id}`);
      
      // Autenticação do cliente
      socket.on('autenticar', async (dados: { token: string; tenantId: string }) => {
        try {
          // TODO: Validar token JWT
          // Por enquanto, aceita qualquer conexão com tenantId
          const { tenantId } = dados;
          
          if (!tenantId) {
            socket.emit('erro', { mensagem: 'TenantId obrigatório' });
            return;
          }
          
          // Registrar conexão
          this.conexoes.set(socket.id, {
            socketId: socket.id,
            tenantId,
            usuarioId: 'temp', // TODO: extrair do token
            nome: 'Usuário', // TODO: buscar do banco
            papel: 'CORRETOR'
          });
          
          // Entrar na sala do tenant
          socket.join(`tenant:${tenantId}`);
          
          console.log(`[WS] ✅ Cliente autenticado: ${socket.id} (Tenant: ${tenantId})`);
          socket.emit('autenticado', { sucesso: true });
          
          // Enviar alertas pendentes
          await this.enviarAlertasPendentes(socket, tenantId);
          
        } catch (error) {
          console.error('[WS] Erro na autenticação:', error);
          socket.emit('erro', { mensagem: 'Erro na autenticação' });
        }
      });
      
      // Marcar alerta como visualizado
      socket.on('alerta:visualizado', async (alertaId: string) => {
        try {
          await (prisma as any).alertaCorretor.update({
            where: { id: alertaId },
            data: {
              status: 'VISUALIZADO',
              visualizadoEm: new Date()
            }
          });
          console.log(`[WS] 👁️ Alerta visualizado: ${alertaId}`);
        } catch (error) {
          console.error('[WS] Erro ao marcar alerta:', error);
        }
      });
      
      // Marcar alerta como atendido
      socket.on('alerta:atendido', async (dados: { alertaId: string; usuarioId: string }) => {
        try {
          await (prisma as any).alertaCorretor.update({
            where: { id: dados.alertaId },
            data: {
              status: 'ATENDIDO',
              atendidoEm: new Date(),
              atendidoPor: dados.usuarioId
            }
          });
          
          // Notificar outros clientes do tenant
          const conexao = this.conexoes.get(socket.id);
          if (conexao) {
            this.io?.to(`tenant:${conexao.tenantId}`).emit('alerta:atualizado', {
              alertaId: dados.alertaId,
              status: 'ATENDIDO',
              atendidoPor: dados.usuarioId
            });
          }
          
          console.log(`[WS] ✅ Alerta atendido: ${dados.alertaId}`);
        } catch (error) {
          console.error('[WS] Erro ao atender alerta:', error);
        }
      });
      
      // Desconexão
      socket.on('disconnect', () => {
        this.conexoes.delete(socket.id);
        console.log(`[WS] 🔌 Desconectado: ${socket.id}`);
      });
    });
    
    console.log('[WS] 🚀 WebSocket Service inicializado');
  }
  
  /**
   * Envia alertas pendentes para um socket
   */
  private async enviarAlertasPendentes(socket: any, tenantId: string): Promise<void> {
    try {
      const alertas = await (prisma as any).alertaCorretor.findMany({
        where: {
          tenantId,
          status: 'PENDENTE'
        },
        orderBy: [
          { prioridade: 'desc' },
          { criadoEm: 'desc' }
        ],
        take: 20
      });
      
      if (alertas.length > 0) {
        socket.emit('alertas:pendentes', alertas);
        console.log(`[WS] 📨 Enviados ${alertas.length} alertas pendentes`);
      }
    } catch (error) {
      console.error('[WS] Erro ao buscar alertas:', error);
    }
  }
  
  /**
   * Emite um novo alerta para todos os clientes do tenant
   */
  emitirAlerta(tenantId: string, alerta: any): void {
    if (!this.io) {
      console.warn('[WS] WebSocket não inicializado');
      return;
    }
    
    this.io.to(`tenant:${tenantId}`).emit('alerta:novo', alerta);
    console.log(`[WS] 🚨 Alerta emitido para tenant ${tenantId}`);
  }
  
  /**
   * Emite atualização de lead para todos os clientes do tenant
   */
  emitirAtualizacaoLead(tenantId: string, leadId: string, dados: any): void {
    if (!this.io) return;
    
    this.io.to(`tenant:${tenantId}`).emit('lead:atualizado', {
      leadId,
      ...dados
    });
  }
  
  /**
   * Emite notificação de nova mensagem
   */
  emitirNovaMensagem(tenantId: string, dados: {
    leadId: string;
    leadNome: string;
    mensagem: string;
    tipo: 'ENTRADA' | 'SAIDA';
  }): void {
    if (!this.io) return;
    
    this.io.to(`tenant:${tenantId}`).emit('mensagem:nova', dados);
  }
  
  /**
   * Retorna estatísticas de conexões
   */
  getEstatisticas(): {
    totalConexoes: number;
    conexoesPorTenant: Record<string, number>;
  } {
    const conexoesPorTenant: Record<string, number> = {};
    
    this.conexoes.forEach(conexao => {
      conexoesPorTenant[conexao.tenantId] = (conexoesPorTenant[conexao.tenantId] || 0) + 1;
    });
    
    return {
      totalConexoes: this.conexoes.size,
      conexoesPorTenant
    };
  }
  
  /**
   * Verifica se o serviço está ativo
   */
  estaAtivo(): boolean {
    return this.io !== null;
  }
}

export const websocketService = new WebSocketService();
