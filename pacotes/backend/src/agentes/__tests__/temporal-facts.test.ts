import { buildTemporalFactsContext, filterActiveTemporalFacts, type TemporalFact } from '../temporal-facts';
import type { EstadoConversa } from '../conversation-state';

describe('temporal-facts', () => {
  const estadoBase: EstadoConversa = {
    intencao: 'vender',
    metragem: null,
    ocupacao: null,
    valorPretendido: null,
    jaRespondeuDecisao: true,
    estaAnunciando: false,
    timeline: '3 meses',
    perguntasJaFeitas: {
      prioridade: false,
      decisaoVenda: false,
      valor: false,
    },
    statusAnuncio: 'nao',
    origemAnuncio: null,
  };

  it('gera fatos ativos para contexto recente', () => {
    const now = new Date('2026-04-26T10:00:00.000Z');
    const leadRecord = {
      urgencia: 'ALTA',
      objecoes: ['comissão alta'],
      atualizadoEm: now,
      ultimaInteracao: now,
      criadoEm: now,
    } as any;

    const result = buildTemporalFactsContext({
      estadoConversaAtual: estadoBase,
      leadRecord,
      now,
    });

    expect(result.fatosAtivos.length).toBeGreaterThan(0);
    expect(result.stats.expirados).toBe(0);
    expect(result.secaoPrompt).toContain('FATOS TEMPORAIS ATIVOS');
  });

  it('remove fatos expirados e calcula taxa', () => {
    const now = new Date('2026-04-26T10:00:00.000Z');
    const antigos: TemporalFact[] = [
      {
        type: 'OBJECAO',
        fact: 'Objeção antiga',
        validFrom: new Date('2026-04-20T10:00:00.000Z'),
        validUntil: new Date('2026-04-21T10:00:00.000Z'),
        confidence: 0.7,
        source: 'lead',
      },
      {
        type: 'INTENCAO',
        fact: 'Intenção ativa',
        validFrom: new Date('2026-04-26T08:00:00.000Z'),
        validUntil: new Date('2026-05-20T10:00:00.000Z'),
        confidence: 0.9,
        source: 'estado',
      },
    ];

    const filtrados = filterActiveTemporalFacts(antigos, now);
    expect(filtrados.ativos).toHaveLength(1);
    expect(filtrados.expirados).toHaveLength(1);
    expect(filtrados.stats.taxaExpirados).toBe(50);
  });
});

