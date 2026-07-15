import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import {
  concluirLoteInbound,
  falharLoteInbound,
  obterEstadoLoteInbound,
  registrarFragmentoInbound,
  reivindicarLoteInbound,
  validarFencingLoteInbound,
} from '../../src/servicos/consolidacao-mensagens-inbound';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';

describe('B04 consolidacao duravel de mensagens inbound', () => {
  let harness: OutboundBaselineHarness;
  beforeAll(async () => {
    OutboundBaselineHarness.assertDedicatedInfrastructure();
    harness = new OutboundBaselineHarness(prisma, await getRedisClient());
  });
  afterEach(async () => harness.cleanup());
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  it('consolida tres fragmentos na ordem em um unico lote tenant-safe', async () => {
    const fixture = await harness.seed();
    const base = Date.now();
    const ids: string[] = [];
    for (const [index, conteudo] of ['primeira', 'segunda', 'terceira'].entries()) {
      const result = await registrarFragmentoInbound({
        tenantId: fixture.tenantA, leadId: fixture.leadA,
        webhookEventoId: `order-${index}-${fixture.runId}`, messageId: `msg-${index}`,
        conteudo, tipo: 'TEXTO', recebidoEm: new Date(base + index), janelaMs: 5_000,
      });
      ids.push(result.loteId);
    }
    expect(new Set(ids).size).toBe(1);
    await prisma.loteMensagemInbound.update({ where: { id: ids[0] }, data: { fechaEm: new Date(Date.now() - 1) } });
    const lote = await reivindicarLoteInbound(ids[0], fixture.tenantA, fixture.leadA, 'order-worker');
    expect(lote?.fragmentos.map((item) => item.conteudo)).toEqual(['primeira', 'segunda', 'terceira']);
    await concluirLoteInbound(ids[0], 'order-worker');
  });

  it('replay nao duplica fragmento e mensagem apos a janela abre novo lote', async () => {
    const fixture = await harness.seed();
    const input = {
      tenantId: fixture.tenantA, leadId: fixture.leadA,
      webhookEventoId: `replay-b04-${fixture.runId}`, messageId: 'same-message',
      conteudo: 'unico', tipo: 'TEXTO', recebidoEm: new Date(), janelaMs: 50,
    };
    const first = await registrarFragmentoInbound(input);
    expect((await registrarFragmentoInbound(input))).toEqual({ loteId: first.loteId, duplicado: true });
    expect(await prisma.fragmentoMensagemInbound.count({ where: { loteId: first.loteId } })).toBe(1);
    await prisma.loteMensagemInbound.update({ where: { id: first.loteId }, data: { fechaEm: new Date(Date.now() - 1) } });
    const second = await registrarFragmentoInbound({ ...input, webhookEventoId: `later-${fixture.runId}`, messageId: 'later' });
    expect(second.loteId).not.toBe(first.loteId);
  });

  it('dois workers nao reivindicam o mesmo lote e lease expirado permite restart', async () => {
    const fixture = await harness.seed();
    const { loteId } = await registrarFragmentoInbound({
      tenantId: fixture.tenantA, leadId: fixture.leadA,
      webhookEventoId: `race-${fixture.runId}`, conteudo: 'corrida', tipo: 'TEXTO',
      recebidoEm: new Date(), janelaMs: 10,
    });
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { fechaEm: new Date(Date.now() - 1) } });
    const claims = await Promise.all([
      reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'worker-a', 30_000),
      reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'worker-b', 30_000),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { leaseAte: new Date(Date.now() - 1) } });
    expect(await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'worker-restarted')).not.toBeNull();
  });

  it('isola tenants e mantem lote falho recuperavel sem concluir efeito', async () => {
    const fixture = await harness.seed();
    const a = await registrarFragmentoInbound({ tenantId: fixture.tenantA, leadId: fixture.leadA, webhookEventoId: `a-${fixture.runId}`, conteudo: 'A', tipo: 'TEXTO', recebidoEm: new Date(), janelaMs: 10 });
    const b = await registrarFragmentoInbound({ tenantId: fixture.tenantB, leadId: fixture.leadB, webhookEventoId: `b-${fixture.runId}`, conteudo: 'B', tipo: 'TEXTO', recebidoEm: new Date(), janelaMs: 10 });
    expect(a.loteId).not.toBe(b.loteId);
    await prisma.loteMensagemInbound.update({ where: { id: a.loteId }, data: { fechaEm: new Date(Date.now() - 1) } });
    expect(await reivindicarLoteInbound(a.loteId, fixture.tenantB, fixture.leadB, 'foreign')).toBeNull();
    expect(await reivindicarLoteInbound(a.loteId, fixture.tenantA, fixture.leadA, 'owner')).not.toBeNull();
    await falharLoteInbound(a.loteId, new Error('agente indisponivel'), 'owner');
    expect(await obterEstadoLoteInbound(a.loteId)).toEqual(expect.objectContaining({ status: 'FALHO' }));
    expect(await reivindicarLoteInbound(a.loteId, fixture.tenantA, fixture.leadA, 'retry')).not.toBeNull();
  });

  it('fence invalida agente lento apos takeover e permite exatamente um efeito critico', async () => {
    const fixture = await harness.seed();
    const { loteId } = await registrarFragmentoInbound({
      tenantId: fixture.tenantA, leadId: fixture.leadA,
      webhookEventoId: `fence-${fixture.runId}`, conteudo: 'agente lento', tipo: 'TEXTO',
      recebidoEm: new Date(), janelaMs: 10,
    });
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { fechaEm: new Date(Date.now() - 1) } });
    const antigo = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'worker-lento');
    expect(antigo).not.toBeNull();

    let liberarAgente!: () => void;
    const agenteLento = new Promise<void>((resolve) => { liberarAgente = resolve; });
    const efeitos = { envios: 0, mutacoes: 0 };
    const tentativaAntiga = (async () => {
      await agenteLento;
      await validarFencingLoteInbound(loteId, 'worker-lento', antigo!.fencingToken);
      efeitos.mutacoes += 1;
      efeitos.envios += 1;
    })();

    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { leaseAte: new Date(Date.now() - 1) } });
    const novo = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'worker-takeover');
    expect(novo!.fencingToken).toBeGreaterThan(antigo!.fencingToken);
    await validarFencingLoteInbound(loteId, 'worker-takeover', novo!.fencingToken);
    efeitos.mutacoes += 1;
    efeitos.envios += 1;
    liberarAgente();
    await expect(tentativaAntiga).rejects.toThrow('LOTE_LEASE_PERDIDO');
    expect(efeitos).toEqual({ envios: 1, mutacoes: 1 });
    await concluirLoteInbound(loteId, 'worker-takeover', novo!.fencingToken);
  });
});
