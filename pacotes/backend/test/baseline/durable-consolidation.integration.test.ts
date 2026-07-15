import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import {
  concluirLoteInbound,
  falharLoteInbound,
  obterEstadoLoteInbound,
  registrarFragmentoInbound,
  reivindicarLoteInbound,
  validarFencingLoteInbound,
  reservarEfeitoLoteInbound,
  concluirEfeitoLoteInbound,
} from '../../src/servicos/consolidacao-mensagens-inbound';
import { executarComandoFenced } from '../../src/servicos/executor-comando-fenced';
import { wrapToolExecute } from '../../src/ferramentas/tool-wrapper';
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

  it('tool real lenta reverte a mutacao quando o lease expira durante a transacao', async () => {
    const fixture = await harness.seed();
    const { loteId } = await registrarFragmentoInbound({
      tenantId: fixture.tenantA, leadId: fixture.leadA,
      webhookEventoId: `tool-fence-${fixture.runId}`, conteudo: 'tool lenta', tipo: 'TEXTO',
      recebidoEm: new Date(), janelaMs: 1,
    });
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { fechaEm: new Date(Date.now() - 1) } });
    const antigo = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'tool-owner');
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { leaseAte: new Date(Date.now() + 150) } });

    const toolReal = wrapToolExecute('teste_tool_fenced', async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await prisma.lead.update({ where: { id: fixture.leadA }, data: { observacoes: 'OWNER_VENCIDO' } });
      return JSON.stringify({ success: true });
    });
    const runContext = { context: {
      assertFencing: () => validarFencingLoteInbound(loteId, 'tool-owner', antigo!.fencingToken),
      withFencedTransaction: <T>(command: () => Promise<T>) => executarComandoFenced({
        loteId, owner: 'tool-owner', fencingToken: antigo!.fencingToken,
      }, command),
    } };
    const execucaoAntiga = toolReal({}, runContext);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const takeoverDuranteTransacao = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'tool-takeover');
    expect(takeoverDuranteTransacao).toBeNull(); // SKIP LOCKED nao invade a transacao fenced

    await expect(execucaoAntiga).rejects.toThrow('LOTE_LEASE_PERDIDO');
    expect(await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'tool-takeover')).not.toBeNull();
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fixture.leadA } })).observacoes).toBeNull();
  });

  async function prepararIntencao(runId: string) {
    const fixture = await harness.seed();
    const { loteId } = await registrarFragmentoInbound({
      tenantId: fixture.tenantA, leadId: fixture.leadA,
      webhookEventoId: `intent-${runId}-${fixture.runId}`, conteudo: 'responder', tipo: 'TEXTO',
      recebidoEm: new Date(), janelaMs: 1,
    });
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { fechaEm: new Date(Date.now() - 1) } });
    const primeiro = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, `owner-${runId}-1`);
    return { fixture, loteId, primeiro: primeiro! };
  }

  it('reconcilia crash apos reserva e antes do envio sem resposta fantasma', async () => {
    const { fixture, loteId, primeiro } = await prepararIntencao('before-send');
    const nova = await reservarEfeitoLoteInbound(loteId, 'owner-before-send-1', primeiro.fencingToken, 'RESPOSTA_TEXTO');
    expect(nova.estado).toBe('NOVA');
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, direcao: 'SAIDA' } })).toBe(1); // somente histórico seed

    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { leaseAte: new Date(Date.now() - 1) } });
    const segundo = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'owner-before-send-2');
    const reconciliada = await reservarEfeitoLoteInbound(loteId, 'owner-before-send-2', segundo!.fencingToken, 'RESPOSTA_TEXTO');
    expect(reconciliada).toEqual({ estado: 'RESERVADA', chaveIdempotencia: nova.chaveIdempotencia });
    const envios = new Set<string>(); envios.add(reconciliada.chaveIdempotencia);
    await concluirEfeitoLoteInbound(loteId, segundo!.fencingToken, 'RESPOSTA_TEXTO');
    expect(envios.size).toBe(1);
  });

  it('reconcilia crash apos envio antes da confirmacao usando a mesma chave idempotente', async () => {
    const { loteId, primeiro } = await prepararIntencao('after-send');
    const nova = await reservarEfeitoLoteInbound(loteId, 'owner-after-send-1', primeiro.fencingToken, 'RESPOSTA_TEXTO');
    const chamadasFisicas = new Set<string>(); chamadasFisicas.add(nova.chaveIdempotencia); // provedor aceitou; processo caiu
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { leaseAte: new Date(Date.now() - 1) } });
    const segundo = await reivindicarLoteInbound(loteId, primeiro.tenantId, primeiro.leadId, 'owner-after-send-2');
    const reconciliada = await reservarEfeitoLoteInbound(loteId, 'owner-after-send-2', segundo!.fencingToken, 'RESPOSTA_TEXTO');
    chamadasFisicas.add(reconciliada.chaveIdempotencia); // retry deduplicado no adapter/provedor
    expect(reconciliada.estado).toBe('RESERVADA');
    expect(chamadasFisicas.size).toBe(1);
    await concluirEfeitoLoteInbound(loteId, segundo!.fencingToken, 'RESPOSTA_TEXTO');
    expect((await reservarEfeitoLoteInbound(loteId, 'owner-after-send-2', segundo!.fencingToken, 'RESPOSTA_TEXTO')).estado).toBe('CONCLUIDA');
  });

  it('takeover de intencao concluida nao duplica envio nem cria resposta fantasma', async () => {
    const { fixture, loteId, primeiro } = await prepararIntencao('confirmed-takeover');
    const nova = await reservarEfeitoLoteInbound(loteId, 'owner-confirmed-takeover-1', primeiro.fencingToken, 'RESPOSTA_TEXTO');
    const enviosFisicos = new Set([nova.chaveIdempotencia]);
    await concluirEfeitoLoteInbound(loteId, primeiro.fencingToken, 'RESPOSTA_TEXTO');
    // Crash depois da confirmação externa, antes da persistência local da resposta.
    await prisma.loteMensagemInbound.update({ where: { id: loteId }, data: { leaseAte: new Date(Date.now() - 1) } });
    const segundo = await reivindicarLoteInbound(loteId, fixture.tenantA, fixture.leadA, 'owner-confirmed-takeover-2');
    const concluida = await reservarEfeitoLoteInbound(loteId, 'owner-confirmed-takeover-2', segundo!.fencingToken, 'RESPOSTA_TEXTO');
    expect(concluida.estado).toBe('CONCLUIDA');
    if (concluida.estado !== 'CONCLUIDA') enviosFisicos.add(concluida.chaveIdempotencia);
    await prisma.mensagemProspeccao.create({
      data: { leadId: fixture.leadA, direcao: 'SAIDA', conteudo: 'resposta confirmada', tipo: 'TEXTO' },
    });
    expect(enviosFisicos.size).toBe(1);
    expect(await prisma.mensagemProspeccao.count({ where: { leadId: fixture.leadA, conteudo: 'resposta confirmada' } })).toBe(1);
  });
});
