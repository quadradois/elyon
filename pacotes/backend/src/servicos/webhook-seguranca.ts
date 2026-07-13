import axios from 'axios';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import net from 'net';
import { prisma } from '../lib/db';
import { responderErro } from '../utilitarios/resposta';

type ProvedorWebhook = 'ASAAS' | 'EVOLUTION' | 'MANUS';

interface RegistroWebhook {
  provedor: ProvedorWebhook;
  eventoId: string;
  tipo: string;
  payloadHash: string;
  payload: Record<string, unknown>;
}

interface ResultadoRegistro {
  duplicado: boolean;
  registroId?: string;
}

const JANELA_MANUS_SEGUNDOS = 300;
const CACHE_CHAVE_MANUS_MS = 60 * 60 * 1000;

let chaveManusCache: { pem: string; expiraEm: number } | null = null;

export function capturarRawBody(req: Request, _res: Response, buffer: Buffer): void {
  req.rawBody = Buffer.from(buffer);
}

export function hashPayload(payload: Buffer | string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function segredoValido(nome: string, minimo = 32): string | null {
  const valor = process.env[nome]?.trim();
  return valor && valor.length >= minimo ? valor : null;
}

function compararSegredo(recebido: string, esperado: string): boolean {
  const recebidoBuffer = Buffer.from(recebido);
  const esperadoBuffer = Buffer.from(esperado);
  return recebidoBuffer.length === esperadoBuffer.length
    && crypto.timingSafeEqual(recebidoBuffer, esperadoBuffer);
}

export function autenticarWebhookAsaas(req: Request, res: Response, next: NextFunction): void {
  const esperado = segredoValido('ASAAS_WEBHOOK_TOKEN');
  if (!esperado) {
    responderErro(res, 503, 'Webhook indisponivel');
    return;
  }

  const recebido = req.get('asaas-access-token') || '';
  if (!compararSegredo(recebido, esperado)) {
    responderErro(res, 401, 'Webhook nao autorizado');
    return;
  }

  next();
}

export async function autenticarWebhookEvolution(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const entradas = process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE
    ?.split(',')
    .map((valor) => valor.trim())
    .filter(Boolean) || [];
  const origens = entradas.map((valor) => valor.replace(/\/32$/, ''));

  if (origens.length === 0 || origens.some((ip) => !net.isIPv4(ip))) {
    responderErro(res, 503, 'Webhook indisponivel');
    return;
  }

  const ip = req.ip?.replace(/^::ffff:/, '');
  if (!ip || !origens.includes(ip)) {
    responderErro(res, 403, 'Webhook nao autorizado');
    return;
  }

  const instanceName = req.body?.instanceName;
  const instanceId = req.body?.instanceId;
  const instanceToken = req.body?.instanceToken;
  if (
    typeof instanceName !== 'string'
    || typeof instanceId !== 'string'
    || typeof instanceToken !== 'string'
  ) {
    responderErro(res, 401, 'Webhook nao autorizado');
    return;
  }

  try {
    const sessao = await prisma.sessaoWhatsapp.findFirst({
      where: { instanceName, evolutionInstanceId: instanceId },
      select: { evolutionToken: true },
    });
    const esperado = sessao?.evolutionToken;
    if (!esperado || !compararSegredo(instanceToken, esperado)) {
      responderErro(res, 403, 'Webhook nao autorizado');
      return;
    }
    next();
  } catch {
    responderErro(res, 503, 'Webhook indisponivel');
  }
}

function normalizarPem(valor: string): string {
  return valor.replace(/\\n/g, '\n').trim();
}

async function obterChavePublicaManus(): Promise<string> {
  const configurada = process.env.MANUS_WEBHOOK_PUBLIC_KEY?.trim();
  if (configurada) return normalizarPem(configurada);

  if (chaveManusCache && chaveManusCache.expiraEm > Date.now()) {
    return chaveManusCache.pem;
  }

  const apiKey = process.env.MANUS_API_KEY?.trim();
  if (!apiKey) throw new Error('MANUS_API_KEY ausente');

  const response = await axios.get<{ ok: boolean; public_key: string }>(
    'https://api.manus.ai/v2/webhook.publicKey',
    {
      headers: { 'x-manus-api-key': apiKey },
      timeout: 5000,
    },
  );

  if (!response.data?.ok || !response.data.public_key) {
    throw new Error('Chave publica Manus invalida');
  }

  const pem = normalizarPem(response.data.public_key);
  chaveManusCache = { pem, expiraEm: Date.now() + CACHE_CHAVE_MANUS_MS };
  return pem;
}

function urlPublicaWebhook(req: Request): string {
  const configurada = process.env.MANUS_WEBHOOK_URL?.trim();
  if (configurada) return configurada;
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

export async function autenticarWebhookManus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const assinatura = req.get('x-webhook-signature');
  const timestamp = req.get('x-webhook-timestamp');
  const rawBody = req.rawBody;

  if (!assinatura || !timestamp || !rawBody) {
    responderErro(res, 401, 'Webhook nao autorizado');
    return;
  }

  const timestampNumero = Number(timestamp);
  const agora = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(timestampNumero) || Math.abs(agora - timestampNumero) > JANELA_MANUS_SEGUNDOS) {
    responderErro(res, 401, 'Webhook nao autorizado');
    return;
  }

  try {
    const chavePublica = await obterChavePublicaManus();
    const conteudoAssinado = `${timestamp}.${urlPublicaWebhook(req)}.${hashPayload(rawBody)}`;
    const valido = crypto.verify(
      'RSA-SHA256',
      Buffer.from(conteudoAssinado),
      chavePublica,
      Buffer.from(assinatura, 'base64'),
    );

    if (!valido) {
      responderErro(res, 401, 'Webhook nao autorizado');
      return;
    }

    next();
  } catch {
    responderErro(res, 503, 'Webhook indisponivel');
  }
}

export async function registrarEventoWebhook(registro: RegistroWebhook): Promise<ResultadoRegistro> {
  try {
    const criado = await prisma.webhookEvento.create({
      data: {
        provedor: registro.provedor,
        eventoId: registro.eventoId,
        tipo: registro.tipo,
        payloadHash: registro.payloadHash,
        payload: registro.payload,
        status: 'PENDENTE',
      },
      select: { id: true },
    });
    return { duplicado: false, registroId: criado.id };
  } catch (erro) {
    if ((erro as { code?: string })?.code === 'P2002') {
      return { duplicado: true };
    }
    throw erro;
  }
}

export async function concluirEventoWebhook(_registroId: string): Promise<void> {
  // Compatibilidade temporaria dos handlers. A conclusao e feita pelo worker
  // com compare-and-set de id + leaseOwner, depois que o handler responde 2xx.
}

export async function liberarEventoWebhook(_registroId: string): Promise<void> {
  // O worker e o unico proprietario da transicao de falha/retry. Manter o lease
  // aqui evita uma segunda execucao concorrente antes de a tentativa ser registrada.
}

export function validarConfiguracaoWebhooks(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const ausentes: string[] = [];
  const origensEvolution = process.env.EVOLUTION_WEBHOOK_SOURCE_RANGE
    ?.split(',')
    .map((valor) => valor.trim().replace(/\/32$/, ''))
    .filter(Boolean) || [];
  if (origensEvolution.length === 0 || origensEvolution.some((ip) => !net.isIPv4(ip))) {
    ausentes.push('EVOLUTION_WEBHOOK_SOURCE_RANGE');
  }
  if (process.env.ASAAS_API_KEY && !segredoValido('ASAAS_WEBHOOK_TOKEN')) ausentes.push('ASAAS_WEBHOOK_TOKEN');

  if (ausentes.length > 0) {
    throw new Error(`Configuracao insegura de webhooks: ${ausentes.join(', ')}`);
  }
}

export function limparCacheChaveManusParaTestes(): void {
  chaveManusCache = null;
}
