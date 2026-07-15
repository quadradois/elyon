jest.mock('../../src/servicos/servico-captura-documentos', () => ({ detectarTipoMidia: jest.fn(() => null), capturarDocumentoWhatsapp: jest.fn() }));
jest.mock('../../src/servicos/servico-analise-midia', () => ({ analisarMidiaParaContexto: jest.fn(async () => null) }));
jest.mock('../../src/servicos/servico-voz', () => ({ sintetizarFalaTenant: jest.fn(async () => null) }));
jest.mock('../../src/servicos/rag-conversas', () => ({ ragConversasService: { buscarContextoRelevante: jest.fn(async () => ({ contextoFormatado: 'RAG_FATO_SINTETICO' })) } }));
jest.mock('../../src/casos-de-uso/agentes/qualificar-lead.usecase', () => ({ QualificarLeadUseCase: class { execute = jest.fn(async () => ({ success: false })); } }));
jest.mock('../../src/casos-de-uso/agentes/converter-para-lead.usecase', () => ({ ConverterParaLeadUseCase: class { execute = jest.fn(async () => ({ success: false })); } }));
jest.mock('../../src/agentes/orchestrator', () => {
  const doubles = require('./support/deterministic-doubles');
  return { processarMensagemOrquestrada: doubles.deterministicOrchestrator, buscarConfiguracaoTenant: jest.fn(async (tenantId: string) => ({ tenantId })), buscarContextoConversa: jest.fn(async () => ({})) };
});
jest.mock('../../src/servicos/whatsapp', () => ({ getWhatsAppService: jest.fn(() => ({ enviarIndicadorDigitando: jest.fn(async () => undefined), enviarMensagemTexto: jest.fn(async () => ({ key: { id: 'det' } })) })) }));

import { prisma } from '../../src/lib/db';
import { closeRedisClient, getRedisClient } from '../../src/lib/redis';
import { captured, resetDoubles } from './support/deterministic-doubles';
import { OutboundBaselineHarness } from './support/outbound-baseline-harness';

describe('probes executáveis de falhas conhecidas', () => {
  let harness: OutboundBaselineHarness;
  beforeAll(async () => { harness = new OutboundBaselineHarness(prisma, await getRedisClient()); });
  afterEach(async () => { await harness.cleanup(); resetDoubles(); });
  afterAll(async () => { await closeRedisClient(); await prisma.$disconnect(); });

  it('XF-B05 briefing/histórico chegam, mas fatos RAG não são repassados ao orquestrador', async () => {
    const f = await harness.seed();
    await harness.acceptInbound(f, `context-${f.runId}`, 'quero informações completas');
    await harness.runWorkerAndBatch('context-worker');
    const call = captured.orchestrator[0];
    expect(JSON.stringify(call.messages)).toContain('HISTORICO_SINTETICO');
    expect(JSON.stringify(call.config)).toContain('BRIEFING_SINTETICO_CONFIAVEL');
    expect(JSON.stringify(call)).not.toContain('RAG_FATO_SINTETICO');
  });

  it('XF-B16 cancelamento deixa estágio VISITA_AGENDADA incoerente', async () => {
    const f = await harness.seed();
    await prisma.lead.update({ where: { id: f.leadA }, data: { status: 'VISITA_AGENDADA' } });
    await prisma.atividade.create({ data: { leadId: f.leadA, tipo: 'AVALIACAO', titulo: 'Visita sintética', agendadoPara: new Date('2026-01-16T17:00:00Z'), statusAgendamento: 'CANCELADO', canceladoEm: new Date(), canceladoPor: 'sistema' } });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: f.leadA } })).status).toBe('VISITA_AGENDADA');
  });
});
