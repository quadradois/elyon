import 'dotenv/config';
import http from 'http';
import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import { prisma } from './lib/db';
import {
  concluirTentativa,
  EventoInbox,
  falharTentativa,
  processarEvento,
  reivindicarProximoEvento,
  renovarLease,
} from './servicos/webhook-inbox';
import { schedulerSincronizacaoMapa } from './servicos/scheduler-sincronizacao-mapa';
import { schedulerLimpezaCache } from './servicos/scheduler-limpeza-cache';
import { schedulerReconciliacaoWhatsapp } from './servicos/scheduler-reconciliacao-whatsapp';
import { installSecureConsoleBridge, logger } from './lib/logger';
import { validarConfiguracaoCriptografia } from './lib/crypto';
import { validarConfiguracaoWebhooks } from './servicos/webhook-seguranca';

const registry = new Registry();
collectDefaultMetrics({ prefix: 'elyon_worker_', register: registry });

const processados = new Counter({
  name: 'elyon_webhook_worker_processed_total',
  help: 'Tentativas processadas pelo worker de webhooks.',
  labelNames: ['provedor', 'resultado'] as const,
  registers: [registry],
});
const ultimoLoop = new Gauge({
  name: 'elyon_webhook_worker_last_loop_timestamp_seconds',
  help: 'Timestamp do ultimo ciclo do worker.',
  registers: [registry],
});
const emProcessamento = new Gauge({
  name: 'elyon_webhook_worker_in_flight',
  help: 'Eventos de webhook atualmente em processamento.',
  registers: [registry],
});
const filaPorStatus = new Gauge({
  name: 'elyon_webhook_inbox_events',
  help: 'Quantidade de eventos na inbox por status.',
  labelNames: ['status'] as const,
  registers: [registry],
});

const porta = Number(process.env.WEBHOOK_WORKER_PORT || 3001);
const pollMs = Math.max(100, Math.min(10_000, Number(process.env.WEBHOOK_WORKER_POLL_MS || 1_000)));
let encerrando = false;
let bancoPronto = false;
let ultimoLoopEm = 0;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarEvento(evento: EventoInbox): Promise<void> {
  emProcessamento.inc();
  const heartbeatMs = Math.max(10_000, Number(process.env.WEBHOOK_WORKER_LEASE_SECONDS || 300) * 1_000 / 3);
  const heartbeat = setInterval(() => {
    void renovarLease(evento).catch((erro) => logger.error({ err: erro, eventoId: evento.id }, '[WORKER] Falha ao renovar lease'));
  }, heartbeatMs);
  try {
    if (!evento.payload) throw new Error('Evento sem payload persistido');
    const resultado = await processarEvento(evento);
    if (resultado.statusCode >= 500) {
      const status = await falharTentativa(evento, `Handler retornou HTTP ${resultado.statusCode}`);
      processados.inc({ provedor: evento.provedor, resultado: status.toLowerCase() });
      return;
    }
    if (resultado.statusCode >= 400) {
      await falharTentativa(evento, `Payload rejeitado com HTTP ${resultado.statusCode}`, true);
      processados.inc({ provedor: evento.provedor, resultado: 'morto' });
      return;
    }

    if (!(await concluirTentativa(evento))) {
      throw new Error('Lease perdido antes da conclusao do evento');
    }
    processados.inc({ provedor: evento.provedor, resultado: 'concluido' });
  } catch (erro) {
    const status = await falharTentativa(evento, erro);
    processados.inc({ provedor: evento.provedor, resultado: status.toLowerCase() });
    logger.error({ err: erro, eventoId: evento.id, provedor: evento.provedor }, '[WORKER] Falha no webhook');
  } finally {
    clearInterval(heartbeat);
    emProcessamento.dec();
  }
}

async function loop(): Promise<void> {
  while (!encerrando) {
    try {
      const evento = await reivindicarProximoEvento();
      bancoPronto = true;
      ultimoLoopEm = Date.now();
      ultimoLoop.set(Math.floor(ultimoLoopEm / 1_000));
      if (evento) await executarEvento(evento);
      else await esperar(pollMs);
    } catch (erro) {
      bancoPronto = false;
      ultimoLoopEm = Date.now();
      logger.error({ err: erro }, '[WORKER] Falha ao consultar inbox');
      await esperar(Math.max(pollMs, 2_000));
    }
  }
}

const servidorSaude = http.createServer(async (req, res) => {
  if (req.url === '/live') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'alive' }));
    return;
  }
  if (req.url === '/ready') {
    const recente = Date.now() - ultimoLoopEm < Math.max(30_000, pollMs * 5);
    const pronto = bancoPronto && recente && !encerrando;
    res.writeHead(pronto ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: pronto ? 'ready' : 'not_ready', banco: bancoPronto, loopRecente: recente }));
    return;
  }
  if (req.url === '/metrics') {
    try {
      const statuses = ['PENDENTE', 'RETRY', 'PROCESSANDO', 'MORTO'];
      const contagens = await Promise.all(statuses.map(async (status) => ({
        status,
        total: await prisma.webhookEvento.count({ where: { status } }),
      })));
      for (const item of contagens) filaPorStatus.set({ status: item.status }, item.total);
    } catch (erro) {
      logger.warn({ err: erro }, '[WORKER] Falha ao atualizar metricas da inbox');
    }
    res.writeHead(200, { 'content-type': registry.contentType });
    res.end(await registry.metrics());
    return;
  }
  res.writeHead(404).end();
});

async function encerrar(sinal: string): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  logger.info({ sinal }, '[WORKER] Encerrando');
  schedulerSincronizacaoMapa.parar();
  schedulerLimpezaCache.parar();
  schedulerReconciliacaoWhatsapp.parar();
  servidorSaude.close();
  await prisma.$disconnect();
}

async function iniciar(): Promise<void> {
  installSecureConsoleBridge();
  validarConfiguracaoCriptografia();
  validarConfiguracaoWebhooks();
  schedulerSincronizacaoMapa.iniciar();
  schedulerLimpezaCache.iniciar();
  schedulerReconciliacaoWhatsapp.iniciar();
  servidorSaude.listen(porta, '0.0.0.0', () => logger.info({ porta }, '[WORKER] Health server iniciado'));
  await loop();
}

process.once('SIGTERM', () => void encerrar('SIGTERM'));
process.once('SIGINT', () => void encerrar('SIGINT'));

void iniciar().catch((erro) => {
  logger.fatal({ err: erro }, '[WORKER] Falha fatal');
  process.exitCode = 1;
});
