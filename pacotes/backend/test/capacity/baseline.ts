import { mkdir, writeFile } from 'node:fs/promises';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { cpus, platform, release } from 'node:os';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import rotaAutenticacao from '../../src/rotas/autenticacao';
import rotaLeads from '../../src/rotas/leads';
import { exigirAutenticacaoPorPadrao } from '../../src/middleware/default-deny';
import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { hashSenha } from '../../src/utilitarios/senha';
import {
  autenticarWebhookAsaas,
  capturarRawBody,
} from '../../src/servicos/webhook-seguranca';
import { processarWebhookAsaas } from '../../src/rotas/rotas-billing';
import {
  processarMensagemOrquestrada,
  type ConfiguracaoOrquestrador,
} from '../../src/agentes/orchestrator';
import type { ExecutorAgente } from '../../src/agentes/agent-runner';

type ScenarioName = 'login' | 'leads' | 'webhook' | 'orchestrator';

interface ScenarioConfig {
  requests: number;
  concurrency: number;
  maxP95Ms: number;
}

interface InfraSnapshot {
  postgres: Record<string, number>;
  redis: Record<string, number>;
}

interface ScenarioResult {
  scenario: ScenarioName;
  requests: number;
  concurrency: number;
  successes: number;
  errors: number;
  errorRate: number;
  durationMs: number;
  throughputRps: number;
  latencyMs: {
    min: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  saturation: {
    cpuPercent: number;
    rssStartMb: number;
    rssPeakMb: number;
    rssDeltaMb: number;
    heapPeakMb: number;
    eventLoopDelayP95Ms: number;
    eventLoopDelayMaxMs: number;
  };
  infraDelta: InfraSnapshot;
  threshold: {
    maxP95Ms: number;
    maxErrorRate: number;
    passed: boolean;
  };
}

const PROFILE = process.env.CAPACITY_PROFILE || 'quick';
const OUTPUT_DIR = process.env.CAPACITY_OUTPUT_DIR || 'capacity-results';
const MAX_ERROR_RATE = 0.01;
const TENANT_SLUG = `capacity-${process.pid}`;
const EMAIL = 'capacity@elyon.local';
const PASSWORD = 'capacity-password-2026';
const ASAAS_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || '';
const TOKEN_INPUT = Number(process.env.CAPACITY_AI_INPUT_TOKENS || 750);
const TOKEN_OUTPUT = Number(process.env.CAPACITY_AI_OUTPUT_TOKENS || 120);
const INPUT_PRICE_PER_1K = Number(process.env.TOKEN_CUSTO_INPUT_1K || 0.002);
const OUTPUT_PRICE_PER_1K = Number(process.env.TOKEN_CUSTO_OUTPUT_1K || 0.008);

function assertIsolatedTargets(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) {
    throw new Error('DATABASE_URL e REDIS_URL sao obrigatorios para o baseline');
  }
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  const redisDatabase = new URL(redisUrl).pathname;
  if (!/^elyon_capacity(?:_|$)/.test(databaseName)) {
    throw new Error(`Baseline recusado fora de banco dedicado elyon_capacity*: ${databaseName}`);
  }
  if (redisDatabase !== '/14') {
    throw new Error(`Baseline recusado fora do Redis DB /14: ${redisDatabase || '/0'}`);
  }
}

const profiles: Record<string, Record<ScenarioName, ScenarioConfig>> = {
  quick: {
    login: { requests: 8, concurrency: 2, maxP95Ms: 1500 },
    leads: { requests: 20, concurrency: 4, maxP95Ms: 1000 },
    webhook: { requests: 20, concurrency: 4, maxP95Ms: 750 },
    orchestrator: { requests: 6, concurrency: 2, maxP95Ms: 2000 },
  },
  ci: {
    login: { requests: 40, concurrency: 4, maxP95Ms: 1500 },
    leads: { requests: 150, concurrency: 12, maxP95Ms: 1000 },
    webhook: { requests: 120, concurrency: 12, maxP95Ms: 750 },
    orchestrator: { requests: 30, concurrency: 3, maxP95Ms: 2000 },
  },
};

const scenarioConfig = profiles[PROFILE];
if (!scenarioConfig) {
  throw new Error(`CAPACITY_PROFILE invalido: ${PROFILE}`);
}
if (!ASAAS_TOKEN || ASAAS_TOKEN.length < 32) {
  throw new Error('ASAAS_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres');
}
assertIsolatedTargets();

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentile(sorted: number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

function mb(bytes: number): number {
  return round(bytes / 1024 / 1024);
}

function parseRedisInfo(raw: string): Record<string, number> {
  const wanted = new Set([
    'total_commands_processed',
    'keyspace_hits',
    'keyspace_misses',
    'used_memory',
    'evicted_keys',
    'rejected_connections',
  ]);
  const result: Record<string, number> = {};
  for (const line of raw.split('\n')) {
    const [key, value] = line.trim().split(':');
    if (wanted.has(key)) result[key] = Number(value) || 0;
  }
  return result;
}

async function infraSnapshot(): Promise<InfraSnapshot> {
  const rows = await prisma.$queryRaw<Array<Record<string, number>>>
    `SELECT numbackends::float8 AS connections,
            xact_commit::float8 AS commits,
            xact_rollback::float8 AS rollbacks,
            blks_read::float8 AS blocks_read,
            blks_hit::float8 AS blocks_hit,
            temp_bytes::float8 AS temp_bytes
       FROM pg_stat_database
      WHERE datname = current_database()`;
  const redis = await getRedisClient();
  return {
    postgres: rows[0] || {},
    redis: parseRedisInfo(await redis.info()),
  };
}

function subtractSnapshot(after: InfraSnapshot, before: InfraSnapshot): InfraSnapshot {
  const subtract = (right: Record<string, number>, left: Record<string, number>) =>
    Object.fromEntries(Object.keys(right).map((key) => [key, round((right[key] || 0) - (left[key] || 0))]));
  return {
    postgres: subtract(after.postgres, before.postgres),
    redis: subtract(after.redis, before.redis),
  };
}

async function runConcurrent(
  requests: number,
  concurrency: number,
  operation: (index: number) => Promise<boolean>,
): Promise<{ latencies: number[]; successes: number }> {
  const latencies = new Array<number>(requests);
  let successes = 0;
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, requests) }, async () => {
    while (true) {
      const index = next++;
      if (index >= requests) return;
      const started = performance.now();
      try {
        if (await operation(index)) successes += 1;
      } catch {
        // A falha e contabilizada no resultado; o relatorio preserva a taxa agregada.
      } finally {
        latencies[index] = performance.now() - started;
      }
    }
  });
  await Promise.all(workers);
  return { latencies, successes };
}

async function measureScenario(
  scenario: ScenarioName,
  config: ScenarioConfig,
  operation: (index: number) => Promise<boolean>,
): Promise<ScenarioResult> {
  for (let i = 0; i < Math.min(config.concurrency, 3); i += 1) await operation(-1 - i);

  const beforeInfra = await infraSnapshot();
  const beforeCpu = process.cpuUsage();
  const rssStart = process.memoryUsage().rss;
  let rssPeak = rssStart;
  let heapPeak = process.memoryUsage().heapUsed;
  const eventLoop = monitorEventLoopDelay({ resolution: 10 });
  eventLoop.enable();
  const sampler = setInterval(() => {
    const memory = process.memoryUsage();
    rssPeak = Math.max(rssPeak, memory.rss);
    heapPeak = Math.max(heapPeak, memory.heapUsed);
  }, 20);

  const started = performance.now();
  const measured = await runConcurrent(config.requests, config.concurrency, operation);
  const durationMs = performance.now() - started;
  clearInterval(sampler);
  eventLoop.disable();

  const cpu = process.cpuUsage(beforeCpu);
  const cpuPercent = ((cpu.user + cpu.system) / 1000 / durationMs) * 100;
  const afterInfra = await infraSnapshot();
  const sorted = [...measured.latencies].sort((a, b) => a - b);
  const errors = config.requests - measured.successes;
  const errorRate = errors / config.requests;
  const p95 = percentile(sorted, 0.95);

  return {
    scenario,
    requests: config.requests,
    concurrency: config.concurrency,
    successes: measured.successes,
    errors,
    errorRate: round(errorRate, 4),
    durationMs: round(durationMs),
    throughputRps: round(config.requests / (durationMs / 1000)),
    latencyMs: {
      min: round(sorted[0] || 0),
      p50: round(percentile(sorted, 0.5)),
      p95: round(p95),
      p99: round(percentile(sorted, 0.99)),
      max: round(sorted.at(-1) || 0),
    },
    saturation: {
      cpuPercent: round(cpuPercent),
      rssStartMb: mb(rssStart),
      rssPeakMb: mb(rssPeak),
      rssDeltaMb: mb(rssPeak - rssStart),
      heapPeakMb: mb(heapPeak),
      eventLoopDelayP95Ms: round(eventLoop.percentile(95) / 1e6),
      eventLoopDelayMaxMs: round(eventLoop.max / 1e6),
    },
    infraDelta: subtractSnapshot(afterInfra, beforeInfra),
    threshold: {
      maxP95Ms: config.maxP95Ms,
      maxErrorRate: MAX_ERROR_RATE,
      passed: p95 <= config.maxP95Ms && errorRate <= MAX_ERROR_RATE,
    },
  };
}

async function startApplication(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json({ limit: '1mb', verify: capturarRawBody }));
  app.use(exigirAutenticacaoPorPadrao);
  app.use('/api/auth', rotaAutenticacao);
  app.use('/api/leads', rotaLeads);
  app.post('/api/billing/webhook/asaas', autenticarWebhookAsaas, processarWebhookAsaas);

  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function seed(): Promise<{ tenantId: string; leadIds: string[] }> {
  await prisma.tenant.deleteMany({ where: { slug: TENANT_SLUG } });
  const tenant = await prisma.tenant.create({
    data: {
      nome: 'Capacity Baseline ELYON',
      slug: TENANT_SLUG,
      status: 'ATIVO',
      statusPagamento: 'PAGO',
    },
  });
  await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      nome: 'Capacity Runner',
      email: EMAIL,
      senha: await hashSenha(PASSWORD),
      papel: 'ADMIN',
      estaAtivo: true,
    },
  });
  await prisma.lead.createMany({
    data: Array.from({ length: 1000 }, (_, index) => ({
      tenantId: tenant.id,
      nome: `Lead Capacity ${index.toString().padStart(4, '0')}`,
      email: `lead-${index}@capacity.local`,
      telefone: `55629${index.toString().padStart(8, '0')}`,
      status: 'NOVO' as const,
      temperatura: index % 3 === 0 ? 'QUENTE' as const : 'FRIO' as const,
      origem: 'capacity-test',
    })),
  });
  const leads = await prisma.lead.findMany({
    where: { tenantId: tenant.id },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
    take: scenarioConfig.orchestrator.requests + scenarioConfig.orchestrator.concurrency + 5,
  });
  return { tenantId: tenant.id, leadIds: leads.map((lead) => lead.id) };
}

const deterministicRun: ExecutorAgente = (async (_agent, input) => ({
  finalOutput: {
    respostaParaOCliente: 'Posso entender melhor o imovel e o objetivo da venda?',
    raciocinio: 'Resposta deterministica do baseline de capacidade.',
    proximoPasso: 'coletar_contexto',
    sinaisDetectados: [],
  },
  lastAgent: { name: 'sdr_agent_v1' },
  history: Array.isArray(input) ? input : [],
  newItems: [],
  usage: {
    inputTokens: TOKEN_INPUT,
    outputTokens: TOKEN_OUTPUT,
    totalTokens: TOKEN_INPUT + TOKEN_OUTPUT,
  },
}) as unknown) as ExecutorAgente;

async function login(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, senha: PASSWORD, tenantSlug: TENANT_SLUG }),
  });
  const body = await response.json() as { token?: string };
  if (!response.ok || !body.token) throw new Error(`Falha no login de setup: HTTP ${response.status}`);
  return body.token;
}

function formatReport(result: Record<string, unknown> & { scenarios: ScenarioResult[] }): string {
  const rows = result.scenarios.map((item) =>
    `| ${item.scenario} | ${item.requests} | ${item.concurrency} | ${item.throughputRps} | ${item.latencyMs.p50} | ${item.latencyMs.p95} | ${item.latencyMs.p99} | ${(item.errorRate * 100).toFixed(2)}% | ${item.threshold.passed ? 'PASS' : 'FAIL'} |`,
  ).join('\n');
  const safe = result.scenarios.map((item) =>
    `- ${item.scenario}: ${round(item.throughputRps * 0.7)} req/s (70% do throughput observado).`,
  ).join('\n');
  const cost = result.cost as { perTurnUsd: number; perThousandTurnsUsd: number; projections: Record<string, number> };
  const resources = result.scenarios.map((item) =>
    `- ${item.scenario}: CPU ${item.saturation.cpuPercent}%, RSS pico ${item.saturation.rssPeakMb} MB, event loop p95 ${item.saturation.eventLoopDelayP95Ms} ms.`,
  ).join('\n');
  return `# Baseline de capacidade ELYON\n\n` +
    `Gerado em: ${result.generatedAt}\n\n` +
    `Perfil: ${result.profile}. Ambiente: ${result.environment}.\n\n` +
    `Este baseline usa PostgreSQL e Redis reais em ambiente efemero. O provedor de IA e deterministico: o fluxo completo do orquestrador e exercitado sem rede externa e sem cobranca real. Os numeros nao representam a latencia do provedor LLM.\n\n` +
    `## Resultados\n\n` +
    `| Cenario | Requisicoes | Concorrencia | req/s | p50 ms | p95 ms | p99 ms | Erros | Gate |\n` +
    `|---|---:|---:|---:|---:|---:|---:|---:|---|\n${rows}\n\n` +
    `## Limites seguros iniciais\n\n${safe}\n\n` +
    `Os limites sao conservadores e valem para uma instancia equivalente ao runner medido. Recalibrar com janela aprovada antes de qualquer teste em producao.\n\n` +
    `## Saturacao observada\n\n${resources}\n\n` +
    `## FinOps de IA\n\n` +
    `Hipotese por turno: ${TOKEN_INPUT} tokens de entrada e ${TOKEN_OUTPUT} de saida. Precos configurados: US$ ${INPUT_PRICE_PER_1K}/1k entrada e US$ ${OUTPUT_PRICE_PER_1K}/1k saida.\n\n` +
    `- Custo estimado por turno: US$ ${cost.perTurnUsd}.\n` +
    `- Custo estimado por 1.000 turnos: US$ ${cost.perThousandTurnsUsd}.\n` +
    `- 10.000 turnos/mes: US$ ${cost.projections['10000']}.\n` +
    `- 100.000 turnos/mes: US$ ${cost.projections['100000']}.\n` +
    `- 1.000.000 turnos/mes: US$ ${cost.projections['1000000']}.\n\n` +
    `Valores sao estimativas, nao faturamento. Atualizar as tarifas por modelo antes de decisao financeira.\n`;
}

async function main(): Promise<void> {
  let server: Server | undefined;
  let tenantId: string | undefined;
  try {
    const seeded = await seed();
    tenantId = seeded.tenantId;
    const app = await startApplication();
    server = app.server;
    const token = await login(app.baseUrl);
    let webhookSequence = 0;

    const configOrchestrator: ConfiguracaoOrquestrador = {
      tenantId,
      nomeAgente: 'Ana',
      genero: 'feminino',
      nomeImobiliaria: 'Capacity Baseline ELYON',
      cidade: 'Goiania',
      diferenciais: ['Atendimento consultivo'],
    };

    const results: ScenarioResult[] = [];
    results.push(await measureScenario('login', scenarioConfig.login, async () => {
      const response = await fetch(`${app.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, senha: PASSWORD, tenantSlug: TENANT_SLUG }),
      });
      await response.arrayBuffer();
      return response.status === 200;
    }));
    results.push(await measureScenario('leads', scenarioConfig.leads, async () => {
      const response = await fetch(`${app.baseUrl}/api/leads?page=1&limit=50`, {
        headers: { authorization: `Bearer ${token}` },
      });
      await response.arrayBuffer();
      return response.status === 200;
    }));
    results.push(await measureScenario('webhook', scenarioConfig.webhook, async () => {
      const sequence = webhookSequence++;
      const response = await fetch(`${app.baseUrl}/api/billing/webhook/asaas`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'asaas-access-token': ASAAS_TOKEN,
        },
        body: JSON.stringify({
          id: `capacity-event-${process.pid}-${sequence}`,
          event: 'PAYMENT_CREATED',
          payment: { id: `capacity-payment-${sequence}`, value: 100 },
        }),
      });
      await response.arrayBuffer();
      return response.status === 202;
    }));
    results.push(await measureScenario('orchestrator', scenarioConfig.orchestrator, async (index) => {
      const safeIndex = Math.abs(index);
      const leadId = seeded.leadIds[safeIndex % seeded.leadIds.length];
      const result = await processarMensagemOrquestrada(
        [{ role: 'user', content: 'Ola, quero avaliar meu apartamento.' }],
        configOrchestrator,
        {
          telefone: `556298${safeIndex.toString().padStart(7, '0')}`,
          contatoId: `capacity-contact-${process.pid}-${index}`,
          leadId,
          statusLead: 'NOVO',
        },
        { executarRun: deterministicRun },
      );
      return result.sucesso && Boolean(result.resposta);
    }));

    const perTurnUsd = (TOKEN_INPUT / 1000) * INPUT_PRICE_PER_1K
      + (TOKEN_OUTPUT / 1000) * OUTPUT_PRICE_PER_1K;
    const passed = results.every((item) => item.threshold.passed);
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      profile: PROFILE,
      environment: `${platform()} ${release()} / Node ${process.version} / ${cpus().length} vCPU`,
      productionTraffic: false,
      providerMode: 'deterministic-no-network-no-billing',
      scenarios: results,
      cost: {
        currency: 'USD',
        inputTokensPerTurn: TOKEN_INPUT,
        outputTokensPerTurn: TOKEN_OUTPUT,
        inputPricePerThousand: INPUT_PRICE_PER_1K,
        outputPricePerThousand: OUTPUT_PRICE_PER_1K,
        perTurnUsd: round(perTurnUsd, 6),
        perThousandTurnsUsd: round(perTurnUsd * 1000),
        projections: {
          '10000': round(perTurnUsd * 10_000),
          '100000': round(perTurnUsd * 100_000),
          '1000000': round(perTurnUsd * 1_000_000),
        },
      },
      passed,
    };

    await mkdir(OUTPUT_DIR, { recursive: true });
    await Promise.all([
      writeFile(`${OUTPUT_DIR}/baseline.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
      writeFile(`${OUTPUT_DIR}/baseline.md`, formatReport(report), 'utf8'),
    ]);
    console.log(JSON.stringify({ passed, profile: PROFILE, scenarios: results }, null, 2));
    if (!passed) process.exitCode = 1;
  } finally {
    if (server) await stopServer(server);
    if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
    await closeRedisClient().catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
