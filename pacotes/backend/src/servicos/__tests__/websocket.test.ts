import { createServer, Server as HTTPServer } from "http";
import { AddressInfo } from "net";
import {
  io as criarSocketCliente,
  Socket as SocketCliente,
} from "socket.io-client";

jest.mock("../../lib/db", () => ({
  prisma: {
    usuario: { findUnique: jest.fn() },
    alertaCorretor: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../../utilitarios/token", () => ({
  verificarToken: jest.fn(),
}));

jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from "../../lib/db";
import { logger } from "../../lib/logger";
import { verificarToken } from "../../utilitarios/token";
import { WebSocketService } from "../websocket";

const ALERTA_ID = "11111111-1111-4111-8111-111111111111";
const prismaMock = prisma as unknown as {
  usuario: { findUnique: jest.Mock };
  alertaCorretor: { findMany: jest.Mock; updateMany: jest.Mock };
};
const verificarTokenMock = verificarToken as jest.Mock;
const loggerMock = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

describe("WebSocketService - autenticação e isolamento tenant", () => {
  let httpServer: HTTPServer;
  let service: WebSocketService;
  let url: string;
  let clientes: SocketCliente[];

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "http://localhost:5173";
    clientes = [];

    verificarTokenMock.mockImplementation((token: string) => {
      if (token === "token-invalido")
        return { payload: null, erro: "INVALIDO" };
      return {
        payload: { id: token === "token-b" ? "usuario-b" : "usuario-a" },
        erro: null,
      };
    });

    prismaMock.usuario.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === "usuario-b") {
          return Promise.resolve({
            id: "usuario-b",
            tenantId: "tenant-b",
            nome: "Usuário B",
            papel: "CORRETOR",
            estaAtivo: true,
          });
        }

        return Promise.resolve({
          id: "usuario-a",
          tenantId: "tenant-a",
          nome: "Usuário A",
          papel: "CORRETOR",
          estaAtivo: true,
        });
      },
    );
    prismaMock.alertaCorretor.findMany.mockResolvedValue([]);
    prismaMock.alertaCorretor.updateMany.mockResolvedValue({ count: 1 });

    httpServer = createServer();
    service = new WebSocketService();
    service.inicializar(httpServer);

    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve),
    );
    const endereco = httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${endereco.port}`;
  });

  afterEach(async () => {
    clientes.forEach((cliente) => cliente.disconnect());
    await service.encerrar();
  });

  function conectar(
    auth: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<SocketCliente> {
    const cliente = criarSocketCliente(url, {
      path: "/ws",
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      autoConnect: false,
      auth,
      extraHeaders,
    });
    clientes.push(cliente);

    return new Promise((resolve, reject) => {
      cliente.once("connect", () => resolve(cliente));
      cliente.once("connect_error", reject);
      cliente.connect();
    });
  }

  function aguardarEvento<T>(
    cliente: SocketCliente,
    evento: string,
  ): Promise<T> {
    return new Promise((resolve) => cliente.once(evento, resolve));
  }

  async function aguardarCondicao(
    condicao: () => boolean,
    timeoutMs = 1_000,
  ): Promise<void> {
    const inicio = Date.now();
    while (!condicao()) {
      if (Date.now() - inicio > timeoutMs)
        throw new Error("Timeout aguardando condição");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  it("recusa handshake sem token antes de consultar o usuário", async () => {
    await expect(conectar({})).rejects.toThrow("Não autorizado");
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled();
    expect(service.getEstatisticas().totalConexoes).toBe(0);
  });

  it("recusa token inválido", async () => {
    await expect(conectar({ token: "token-invalido" })).rejects.toThrow(
      "Não autorizado",
    );
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled();
  });

  it("deriva usuário e tenant do JWT e isola as salas", async () => {
    const clienteA = await conectar({ token: "token-a", tenantId: "tenant-b" });
    const clienteB = await conectar({ token: "token-b", tenantId: "tenant-a" });
    let tenantBRecebeu = false;
    clienteB.once("alerta:novo", () => {
      tenantBRecebeu = true;
    });

    const recebidoPorA = aguardarEvento<{ id: string }>(
      clienteA,
      "alerta:novo",
    );
    service.emitirAlerta("tenant-a", { id: ALERTA_ID });

    await expect(recebidoPorA).resolves.toEqual({ id: ALERTA_ID });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(tenantBRecebeu).toBe(false);
    expect(service.getEstatisticas()).toEqual({
      totalConexoes: 2,
      conexoesPorTenant: { "tenant-a": 1, "tenant-b": 1 },
    });
  });

  it("propaga correlation id do handshake para os logs", async () => {
    await conectar(
      { token: "token-a" },
      { "x-correlation-id": "websocket-request-123" },
    );

    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "websocket-request-123" }),
      "[WS] Cliente autenticado",
    );
  });

  it("aplica ownership do tenant ao atualizar um alerta", async () => {
    prismaMock.alertaCorretor.updateMany.mockResolvedValueOnce({ count: 0 });
    const cliente = await conectar({ token: "token-a" });
    const erro = aguardarEvento<{ codigo: string }>(cliente, "erro");

    cliente.emit("alerta:visualizado", ALERTA_ID);

    await expect(erro).resolves.toMatchObject({
      codigo: "ALERTA_NAO_ENCONTRADO",
    });
    expect(prismaMock.alertaCorretor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALERTA_ID, tenantId: "tenant-a" },
      }),
    );
  });

  it("ignora usuarioId controlado pelo cliente ao atender um alerta", async () => {
    const cliente = await conectar({ token: "token-a" });
    const atualizado = aguardarEvento<{ atendidoPor: string }>(
      cliente,
      "alerta:atualizado",
    );

    cliente.emit("alerta:atendido", {
      alertaId: ALERTA_ID,
      usuarioId: "usuario-atacante",
    });

    await expect(atualizado).resolves.toMatchObject({
      alertaId: ALERTA_ID,
      atendidoPor: "usuario-a",
    });
    expect(prismaMock.alertaCorretor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ALERTA_ID, tenantId: "tenant-a" },
        data: expect.objectContaining({ atendidoPor: "usuario-a" }),
      }),
    );
  });

  it("limita eventos de mutação por conexão", async () => {
    const cliente = await conectar({ token: "token-a" });
    const erro = aguardarEvento<{ codigo: string }>(cliente, "erro");

    for (let indice = 0; indice < 31; indice += 1) {
      cliente.emit("alerta:visualizado", ALERTA_ID);
    }

    await expect(erro).resolves.toMatchObject({ codigo: "LIMITE_EVENTOS" });
    await aguardarCondicao(
      () => prismaMock.alertaCorretor.updateMany.mock.calls.length === 30,
    );
    expect(prismaMock.alertaCorretor.updateMany).toHaveBeenCalledTimes(30);
  });
});
