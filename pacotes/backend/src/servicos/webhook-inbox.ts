import os from 'os';
import { Request, Response } from 'express';
import { prisma } from '../lib/db';
import { processarWebhookEvolution } from '../rotas/webhook';
import { processarWebhookManus } from '../rotas/webhook-manus';
import { processarWebhookAsaas } from '../rotas/rotas-billing';

export type ProvedorInbox = 'ASAAS' | 'EVOLUTION' | 'MANUS';

export interface EventoInbox {
  id: string;
  provedor: ProvedorInbox;
  eventoId: string;
  tipo: string;
  payload: Record<string, unknown>;
  tentativas: number;
  maxTentativas: number;
}

export interface ResultadoProcessamento {
  statusCode: number;
  body?: unknown;
}

export const WORKER_OWNER = `${os.hostname()}:${process.pid}`;

function inteiroConfigurado(nome: string, padrao: number, minimo: number, maximo: number): number {
  const valor = Number(process.env[nome] || padrao);
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) return padrao;
  return valor;
}

export function calcularBackoffMs(tentativa: number): number {
  const base = inteiroConfigurado('WEBHOOK_WORKER_BACKOFF_BASE_MS', 5_000, 100, 60_000);
  const maximo = inteiroConfigurado('WEBHOOK_WORKER_BACKOFF_MAX_MS', 15 * 60_000, base, 86_400_000);
  return Math.min(maximo, base * 2 ** Math.max(0, tentativa - 1));
}

export async function reivindicarProximoEvento(
  owner = WORKER_OWNER,
): Promise<EventoInbox | null> {
  const leaseSegundos = inteiroConfigurado('WEBHOOK_WORKER_LEASE_SECONDS', 300, 30, 3_600);
  const eventos = await prisma.$queryRawUnsafe<EventoInbox[]>(`
    WITH candidato AS (
      SELECT "id"
      FROM "webhook_eventos"
      WHERE (
        "status" IN ('PENDENTE', 'RETRY')
        AND "proximaTentativaEm" <= CURRENT_TIMESTAMP
      ) OR (
        "status" = 'PROCESSANDO'
        AND "leaseAte" < CURRENT_TIMESTAMP
      )
      ORDER BY "recebidoEm" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "webhook_eventos" evento
    SET
      "status" = 'PROCESSANDO',
      "tentativas" = evento."tentativas" + 1,
      "leaseOwner" = $1,
      "leaseAte" = CURRENT_TIMESTAMP + ($2::int * INTERVAL '1 second'),
      "atualizadoEm" = CURRENT_TIMESTAMP
    FROM candidato
    WHERE evento."id" = candidato."id"
    RETURNING
      evento."id",
      evento."provedor",
      evento."eventoId",
      evento."tipo",
      evento."payload",
      evento."tentativas",
      evento."maxTentativas"
  `, owner, leaseSegundos);

  return eventos[0] || null;
}

export async function concluirTentativa(evento: EventoInbox, owner = WORKER_OWNER): Promise<boolean> {
  const resultado = await prisma.webhookEvento.updateMany({
    where: { id: evento.id, status: 'PROCESSANDO', leaseOwner: owner },
    data: {
      status: 'CONCLUIDO',
      processadoEm: new Date(),
      leaseAte: null,
      leaseOwner: null,
      ultimoErro: null,
    },
  });
  return resultado.count === 1;
}

export async function renovarLease(evento: EventoInbox, owner = WORKER_OWNER): Promise<void> {
  const leaseSegundos = inteiroConfigurado('WEBHOOK_WORKER_LEASE_SECONDS', 300, 30, 3_600);
  await prisma.webhookEvento.updateMany({
    where: { id: evento.id, status: 'PROCESSANDO', leaseOwner: owner },
    data: { leaseAte: new Date(Date.now() + leaseSegundos * 1_000) },
  });
}

function sanitizarErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return mensagem.replace(/(token|secret|password|api[-_ ]?key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]').slice(0, 2_000);
}

export async function falharTentativa(
  evento: EventoInbox,
  erro: unknown,
  permanente = false,
  owner = WORKER_OWNER,
): Promise<'RETRY' | 'MORTO'> {
  const morto = permanente || evento.tentativas >= evento.maxTentativas;
  const status = morto ? 'MORTO' : 'RETRY';
  await prisma.webhookEvento.updateMany({
    where: { id: evento.id, status: 'PROCESSANDO', leaseOwner: owner },
    data: {
      status,
      proximaTentativaEm: new Date(Date.now() + calcularBackoffMs(evento.tentativas)),
      leaseAte: null,
      leaseOwner: null,
      ultimoErro: sanitizarErro(erro),
    },
  });
  return status;
}

function criarRequest(evento: EventoInbox): Request {
  const headers: Record<string, string> = {
    'x-elyon-inbox-id': evento.id,
    'x-elyon-inbox-attempt': String(evento.tentativas),
  };
  return {
    body: evento.payload,
    query: {},
    rawBody: Buffer.from(JSON.stringify(evento.payload)),
    headers,
    get(nome: string): string | undefined {
      return headers[nome.toLowerCase()];
    },
  } as unknown as Request;
}

function criarResponse(): { res: Response; resultado: ResultadoProcessamento } {
  const resultado: ResultadoProcessamento = { statusCode: 200 };
  const res = {
    status(codigo: number) {
      resultado.statusCode = codigo;
      return res;
    },
    json(body: unknown) {
      resultado.body = body;
      return res;
    },
    send(body?: unknown) {
      resultado.body = body;
      return res;
    },
    sendStatus(codigo: number) {
      resultado.statusCode = codigo;
      return res;
    },
    end() {
      return res;
    },
  } as unknown as Response;
  return { res, resultado };
}

export async function processarEvento(evento: EventoInbox): Promise<ResultadoProcessamento> {
  const req = criarRequest(evento);
  const { res, resultado } = criarResponse();

  if (evento.provedor === 'EVOLUTION') await processarWebhookEvolution(req, res);
  else if (evento.provedor === 'MANUS') await processarWebhookManus(req, res);
  else if (evento.provedor === 'ASAAS') await processarWebhookAsaas(req, res);
  else throw new Error(`Provedor de webhook nao suportado: ${evento.provedor}`);

  return resultado;
}
