import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { z } from "zod";
import { prisma } from "../lib/db";
import { logger } from "../lib/logger";
import { resolveCorrelationId, runWithLogContext } from "../lib/log-context";
import { verificarToken } from "../utilitarios/token";

interface ConexaoCliente {
  socketId: string;
  tenantId: string;
  usuarioId: string;
  nome: string;
  papel: string;
}

const JANELA_EVENTOS_MS = 60_000;
const MAX_EVENTOS_MUTACAO = 30;
const alertaIdSchema = z.string().uuid();
const alertaAtendidoSchema = z
  .union([
    alertaIdSchema,
    z
      .object({
        alertaId: alertaIdSchema,
        // Compatibilidade temporária com clientes antigos. O valor é ignorado:
        // atendidoPor sempre vem da identidade autenticada no handshake.
        usuarioId: z.unknown().optional(),
      })
      .strict(),
  ])
  .transform((valor) => (typeof valor === "string" ? valor : valor.alertaId));

function resolverOrigensPermitidas(): string[] {
  const configuradas = process.env.FRONTEND_URL?.split(",")
    .map((origem) => origem.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (configuradas?.length) return configuradas;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[FATAL] FRONTEND_URL não configurado para o WebSocket em produção.",
    );
  }

  return ["http://localhost:5173", "http://localhost:3000"];
}

/**
 * Serviço de WebSocket para alertas em tempo real.
 *
 * A identidade e o tenant são derivados exclusivamente do JWT validado no
 * handshake. Eventos enviados pelo cliente nunca funcionam como autorização.
 */
export class WebSocketService {
  private io: SocketIOServer | null = null;
  private conexoes: Map<string, ConexaoCliente> = new Map();

  inicializar(httpServer: HTTPServer): void {
    if (this.io) {
      throw new Error("WebSocket Service já foi inicializado.");
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: resolverOrigensPermitidas(),
        methods: ["GET", "POST"],
      },
      path: "/ws",
    });

    this.io.use(async (socket, next) => {
      const correlationId = resolveCorrelationId(
        socket.handshake.headers["x-correlation-id"],
      );
      socket.data.correlationId = correlationId;

      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== "string" || !token) {
          logger.warn(
            { correlationId, socketId: socket.id, motivo: "token_ausente" },
            "[WS] Handshake recusado",
          );
          next(new Error("Não autorizado"));
          return;
        }

        const tokenValidado = verificarToken(token);
        const usuarioId =
          tokenValidado.payload?.id || tokenValidado.payload?.usuarioId;
        if (tokenValidado.erro || typeof usuarioId !== "string" || !usuarioId) {
          logger.warn(
            {
              socketId: socket.id,
              correlationId,
              motivo: tokenValidado.erro || "payload_invalido",
            },
            "[WS] Handshake recusado",
          );
          next(new Error("Não autorizado"));
          return;
        }

        const usuario = await prisma.usuario.findUnique({
          where: { id: usuarioId },
          select: {
            id: true,
            tenantId: true,
            nome: true,
            papel: true,
            estaAtivo: true,
          },
        });

        if (!usuario?.estaAtivo || !usuario.tenantId) {
          logger.warn(
            { correlationId, socketId: socket.id, motivo: "usuario_inativo_ou_inexistente" },
            "[WS] Handshake recusado",
          );
          next(new Error("Não autorizado"));
          return;
        }

        socket.data.principal = {
          socketId: socket.id,
          tenantId: usuario.tenantId,
          usuarioId: usuario.id,
          nome: usuario.nome,
          papel: usuario.papel,
        } satisfies ConexaoCliente;

        next();
      } catch (error) {
        logger.error(
          { err: error, correlationId, socketId: socket.id },
          "[WS] Falha ao autenticar handshake",
        );
        next(new Error("Não autorizado"));
      }
    });

    this.io.on("connection", async (socket) => {
      const correlationId = resolveCorrelationId(socket.data.correlationId);
      socket.use((_event, next) => {
        runWithLogContext({ correlationId, channel: "websocket" }, next);
      });

      const principal = socket.data.principal as ConexaoCliente;
      this.conexoes.set(socket.id, principal);
      await socket.join(`tenant:${principal.tenantId}`);

      logger.info({ correlationId, socketId: socket.id }, "[WS] Cliente autenticado");
      socket.emit("autenticado", { sucesso: true, correlationId });
      await this.enviarAlertasPendentes(socket, principal.tenantId);

      let janelaIniciadaEm = Date.now();
      let eventosNaJanela = 0;

      const permitirMutacao = (): boolean => {
        const agora = Date.now();
        if (agora - janelaIniciadaEm >= JANELA_EVENTOS_MS) {
          janelaIniciadaEm = agora;
          eventosNaJanela = 0;
        }

        eventosNaJanela += 1;
        if (eventosNaJanela <= MAX_EVENTOS_MUTACAO) return true;

        socket.emit("erro", {
          codigo: "LIMITE_EVENTOS",
          mensagem: "Limite de eventos excedido",
        });
        return false;
      };

      socket.on("alerta:visualizado", async (payload: unknown) => {
        if (!permitirMutacao()) return;

        const alertaId = alertaIdSchema.safeParse(payload);
        if (!alertaId.success) {
          socket.emit("erro", {
            codigo: "PAYLOAD_INVALIDO",
            mensagem: "Alerta inválido",
          });
          return;
        }

        try {
          const resultado = await (prisma as any).alertaCorretor.updateMany({
            where: {
              id: alertaId.data,
              tenantId: principal.tenantId,
            },
            data: {
              status: "VISUALIZADO",
              visualizadoEm: new Date(),
            },
          });

          if (resultado.count === 0) {
            socket.emit("erro", {
              codigo: "ALERTA_NAO_ENCONTRADO",
              mensagem: "Alerta não encontrado",
            });
          }
        } catch (error) {
          logger.error(
            { err: error, correlationId, socketId: socket.id },
            "[WS] Erro ao marcar alerta como visualizado",
          );
          socket.emit("erro", {
            codigo: "ERRO_INTERNO",
            mensagem: "Não foi possível atualizar o alerta",
          });
        }
      });

      socket.on("alerta:atendido", async (payload: unknown) => {
        if (!permitirMutacao()) return;

        const alertaId = alertaAtendidoSchema.safeParse(payload);
        if (!alertaId.success) {
          socket.emit("erro", {
            codigo: "PAYLOAD_INVALIDO",
            mensagem: "Alerta inválido",
          });
          return;
        }

        try {
          const resultado = await (prisma as any).alertaCorretor.updateMany({
            where: {
              id: alertaId.data,
              tenantId: principal.tenantId,
            },
            data: {
              status: "ATENDIDO",
              atendidoEm: new Date(),
              atendidoPor: principal.usuarioId,
            },
          });

          if (resultado.count === 0) {
            socket.emit("erro", {
              codigo: "ALERTA_NAO_ENCONTRADO",
              mensagem: "Alerta não encontrado",
            });
            return;
          }

          this.io
            ?.to(`tenant:${principal.tenantId}`)
            .emit("alerta:atualizado", {
              alertaId: alertaId.data,
              status: "ATENDIDO",
              atendidoPor: principal.usuarioId,
            });
        } catch (error) {
          logger.error(
            { err: error, correlationId, socketId: socket.id },
            "[WS] Erro ao atender alerta",
          );
          socket.emit("erro", {
            codigo: "ERRO_INTERNO",
            mensagem: "Não foi possível atualizar o alerta",
          });
        }
      });

      socket.on("disconnect", () => {
        runWithLogContext({ correlationId, channel: "websocket" }, () => {
          this.conexoes.delete(socket.id);
          logger.info({ socketId: socket.id }, "[WS] Cliente desconectado");
        });
      });
    });

    logger.info("[WS] WebSocket Service inicializado");
  }

  private async enviarAlertasPendentes(
    socket: Socket,
    tenantId: string,
  ): Promise<void> {
    try {
      const alertas = await (prisma as any).alertaCorretor.findMany({
        where: {
          tenantId,
          status: "PENDENTE",
        },
        orderBy: [{ prioridade: "desc" }, { criadoEm: "desc" }],
        take: 20,
      });

      if (alertas.length > 0) {
        socket.emit("alertas:pendentes", alertas);
      }
    } catch (error) {
      logger.error(
        { err: error, socketId: socket.id },
        "[WS] Erro ao buscar alertas pendentes",
      );
    }
  }

  emitirAlerta(tenantId: string, alerta: unknown): void {
    if (!this.io) {
      logger.warn("[WS] WebSocket não inicializado");
      return;
    }

    this.io.to(`tenant:${tenantId}`).emit("alerta:novo", alerta);
  }

  emitirAtualizacaoLead(
    tenantId: string,
    leadId: string,
    dados: Record<string, unknown>,
  ): void {
    if (!this.io) return;

    this.io.to(`tenant:${tenantId}`).emit("lead:atualizado", {
      leadId,
      ...dados,
    });
  }

  emitirNovaMensagem(
    tenantId: string,
    dados: {
      leadId: string;
      leadNome: string;
      mensagem: string;
      tipo: "ENTRADA" | "SAIDA";
    },
  ): void {
    if (!this.io) return;
    this.io.to(`tenant:${tenantId}`).emit("mensagem:nova", dados);
  }

  getEstatisticas(): {
    totalConexoes: number;
    conexoesPorTenant: Record<string, number>;
  } {
    const conexoesPorTenant: Record<string, number> = {};

    this.conexoes.forEach((conexao) => {
      conexoesPorTenant[conexao.tenantId] =
        (conexoesPorTenant[conexao.tenantId] || 0) + 1;
    });

    return {
      totalConexoes: this.conexoes.size,
      conexoesPorTenant,
    };
  }

  estaAtivo(): boolean {
    return this.io !== null;
  }

  async encerrar(): Promise<void> {
    const io = this.io;
    this.io = null;
    this.conexoes.clear();

    if (!io) return;
    await new Promise<void>((resolve) => io.close(() => resolve()));
  }
}

export const websocketService = new WebSocketService();
