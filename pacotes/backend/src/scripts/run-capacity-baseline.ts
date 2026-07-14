import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/db';
import { closeRedisClient, getRedisClient } from '../lib/redis';
import { executarAgenteComRetry } from '../agentes/agent-runner';
import { executarCenario, ResultadoCenario, ResultadoOperacao } from '../capacidade/benchmark';
import { CAPACITY_FIXTURE } from '../capacidade/fixture';
import { validarAlvoBaseline, validarBancoBaseline } from '../capacidade/seguranca-baseline';

interface SnapshotAplicacao {
  rssBytes: number;
  heapBytes: number;
  eventLoopP99Seconds: number;
  requestsInFlight: number;
  cpuUserSeconds: number;
}

function numeroEnv(nome: string, padrao: number, minimo: number, maximo: number): number {
  const valor = Number(process.env[nome] || padrao);
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) throw new Error(`${nome} inválida`);
  return valor;
}

function metrica(texto: string, nome: string): number {
  const linha = texto.split('\n').find((item) => item.startsWith(`${nome} `));
  return linha ? Number(linha.slice(nome.length + 1)) || 0 : 0;
}

async function snapshotAplicacao(alvo: URL): Promise<SnapshotAplicacao> {
  const response = await fetch(new URL('/metrics', alvo));
  if (!response.ok) throw new Error(`Falha ao coletar /metrics: ${response.status}`);
  const texto = await response.text();
  return {
    rssBytes: metrica(texto, 'elyon_process_resident_memory_bytes'),
    heapBytes: metrica(texto, 'elyon_nodejs_heap_size_used_bytes'),
    eventLoopP99Seconds: metrica(texto, 'elyon_nodejs_eventloop_lag_p99_seconds'),
    requestsInFlight: metrica(texto, 'elyon_http_requests_in_flight'),
    cpuUserSeconds: metrica(texto, 'elyon_process_cpu_user_seconds_total'),
  };
}

function maximoAplicacao(amostras: SnapshotAplicacao[]): SnapshotAplicacao {
  const max = (campo: keyof SnapshotAplicacao) => Math.max(0, ...amostras.map((amostra) => amostra[campo]));
  return {
    rssBytes: max('rssBytes'),
    heapBytes: max('heapBytes'),
    eventLoopP99Seconds: max('eventLoopP99Seconds'),
    requestsInFlight: max('requestsInFlight'),
    cpuUserSeconds: max('cpuUserSeconds'),
  };
}

async function comAmostragem<T>(alvo: URL, operacao: Promise<T>): Promise<{ resultado: T; pico: SnapshotAplicacao }> {
  const amostras: SnapshotAplicacao[] = [];
  let ativo = true;
  const amostrar = async () => {
    while (ativo) {
      try { amostras.push(await snapshotAplicacao(alvo)); } catch { /* a falha aparece no cenário */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };
  const sampler = amostrar();
  try {
    const resultado = await operacao;
    return { resultado, pico: maximoAplicacao(amostras) };
  } finally {
    ativo = false;
    await sampler;
  }
}

async function requisicao(url: URL, init: RequestInit): Promise<ResultadoOperacao> {
  const response = await fetch(url, init);
  const corpo = await response.arrayBuffer();
  return { sucesso: response.ok, status: response.status, bytes: corpo.byteLength };
}

async function snapshotPostgres(): Promise<Record<string, number>> {
  const linhas = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(`
    SELECT xact_commit::text, xact_rollback::text, blks_read::text, blks_hit::text,
           tup_returned::text, tup_fetched::text, temp_bytes::text, deadlocks::text
    FROM pg_stat_database WHERE datname = current_database()
  `);
  return Object.fromEntries(Object.entries(linhas[0] || {}).map(([chave, valor]) => [chave, Number(valor)]));
}

function parseInfoRedis(info: string): Record<string, number> {
  const campos = new Set(['total_commands_processed', 'keyspace_hits', 'keyspace_misses', 'used_memory', 'used_memory_peak', 'connected_clients', 'rejected_connections']);
  const resultado: Record<string, number> = {};
  for (const linha of info.split(/\r?\n/)) {
    const [chave, valor] = linha.split(':');
    if (campos.has(chave)) resultado[chave] = Number(valor) || 0;
  }
  return resultado;
}

function delta(depois: Record<string, number>, antes: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(depois).map(([chave, valor]) => [chave, valor - (antes[chave] || 0)]));
}

async function tokenAutenticacao(alvo: URL): Promise<string> {
  const response = await fetch(new URL('/api/auth/login', alvo), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: CAPACITY_FIXTURE.email, senha: CAPACITY_FIXTURE.senha, tenantSlug: CAPACITY_FIXTURE.tenantSlug }),
  });
  const corpo = await response.json() as { token?: string };
  if (!response.ok || !corpo.token) throw new Error(`Login de preparação falhou: ${response.status}`);
  return corpo.token;
}

async function main(): Promise<void> {
  const alvo = validarAlvoBaseline(process.env.CAPACITY_BASELINE_TARGET || 'http://127.0.0.1:3109', process.env.CAPACITY_BASELINE_ALLOW_REMOTE === 'true');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória');
  const banco = validarBancoBaseline(databaseUrl, process.env.CAPACITY_BASELINE_ALLOW_REMOTE === 'true');
  const duracaoMs = numeroEnv('CAPACITY_BASELINE_DURATION_MS', 5_000, 500, 120_000);
  const aquecimentoMs = numeroEnv('CAPACITY_BASELINE_WARMUP_MS', 500, 0, 30_000);
  const providerLatencyMs = numeroEnv('CAPACITY_BASELINE_PROVIDER_LATENCY_MS', 40, 0, 30_000);
  const inputTokens = numeroEnv('CAPACITY_BASELINE_INPUT_TOKENS', 1_200, 0, 100_000);
  const outputTokens = numeroEnv('CAPACITY_BASELINE_OUTPUT_TOKENS', 300, 0, 100_000);
  const inputCostPer1k = numeroEnv('TOKEN_CUSTO_INPUT_1K', 0.002, 0, 100);
  const outputCostPer1k = numeroEnv('TOKEN_CUSTO_OUTPUT_1K', 0.008, 0, 100);
  const token = await tokenAutenticacao(alvo);
  const redis = await getRedisClient();
  const postgresAntes = await snapshotPostgres();
  const redisAntes = parseInfoRedis(await redis.info());
  const cenarios: ResultadoCenario[] = [];
  const saturacaoHttp: Record<string, SnapshotAplicacao> = {};

  const executarHttp = async (nome: string, concorrencia: number, operacao: (sequencia: number) => Promise<ResultadoOperacao>) => {
    const medicao = await comAmostragem(alvo, executarCenario({ nome, duracaoMs, aquecimentoMs, concorrencia, operacao }));
    cenarios.push(medicao.resultado);
    saturacaoHttp[nome] = medicao.pico;
  };

  await executarHttp('login', 2, () => requisicao(new URL('/api/auth/login', alvo), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: CAPACITY_FIXTURE.email, senha: CAPACITY_FIXTURE.senha, tenantSlug: CAPACITY_FIXTURE.tenantSlug }),
  }));
  await executarHttp('leads-list', 8, () => requisicao(new URL('/api/leads?page=1&limit=100', alvo), {
    method: 'GET', headers: { authorization: `Bearer ${token}` },
  }));
  await executarHttp('webhook-ingress', 4, (sequencia) => requisicao(new URL('/webhooks', alvo), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'capacity-baseline', instanceName: CAPACITY_FIXTURE.instanceName,
      instanceId: CAPACITY_FIXTURE.instanceId, instanceToken: CAPACITY_FIXTURE.instanceToken,
      data: { sequencia, nonce: `${Date.now()}-${sequencia}` },
    }),
  }));

  const orquestrador = await executarCenario({
    nome: 'orchestrator-control-plane', duracaoMs, aquecimentoMs, concorrencia: 4,
    operacao: async () => {
      const resultado = await executarAgenteComRetry({
        agente: { name: 'capacity-agent' } as any,
        inputSDK: [{ role: 'user', content: 'baseline' }],
        elyonContext: { tenantId: 'capacity-baseline' } as any,
        mensagensLength: 1,
        construirInputSemCache: () => [],
        limparHistoricoContato: async () => undefined,
        executarRun: (async () => {
          if (providerLatencyMs) await new Promise((resolve) => setTimeout(resolve, providerLatencyMs));
          return { finalOutput: 'ok', usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
        }) as any,
      });
      return { sucesso: resultado.result.finalOutput === 'ok', status: 200 };
    },
  });
  cenarios.push(orquestrador);

  const postgresDepois = await snapshotPostgres();
  const redisDepois = parseInfoRedis(await redis.info());
  const custoPorTurno = (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
  const limites = Object.fromEntries(cenarios.map((cenario) => [cenario.nome, {
    rpsSeguro: Number((cenario.throughputPorSegundo * 0.6).toFixed(2)),
    alertaP95Ms: Math.ceil(Math.max(50, cenario.latenciaMs.p95 * 2)),
    concorrenciaValidada: cenario.concorrencia,
  }]));
  const relatorio = {
    schemaVersion: 1,
    geradoEm: new Date().toISOString(),
    ambiente: { alvo: alvo.origin, banco: banco.pathname.slice(1), producaoBloqueada: true, duracaoMs, aquecimentoMs },
    cenarios,
    saturacao: { aplicacaoPicos: saturacaoHttp, postgresDelta: delta(postgresDepois, postgresAntes), redisDelta: delta(redisDepois, redisAntes), redisFinal: redisDepois },
    custoIA: {
      natureza: 'projecao-com-provedor-simulado', providerLatencyMs, inputTokens, outputTokens,
      inputCostPer1kUSD: inputCostPer1k, outputCostPer1kUSD: outputCostPer1k,
      custoPorTurnoUSD: Number(custoPorTurno.toFixed(6)),
      custoPorMilTurnosUSD: Number((custoPorTurno * 1000).toFixed(2)),
    },
    limites,
    limitacoes: [
      'Resultados representam uma máquina local e não substituem teste em staging equivalente à produção.',
      'O cenário do orquestrador mede o control plane com latência de provedor simulada; tokens e custo são projeções configuráveis.',
      'Nenhuma requisição de carga foi enviada à produção ou a provedores externos de IA.',
    ],
  };
  const saida = path.resolve(process.env.CAPACITY_BASELINE_OUTPUT || 'capacity-baseline-report.json');
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ saida, cenarios: cenarios.map(({ nome, throughputPorSegundo, taxaErro, latenciaMs }) => ({ nome, throughputPorSegundo, taxaErro, latenciaMs })) }));
}

main()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(async () => { await closeRedisClient(); await prisma.$disconnect(); });
