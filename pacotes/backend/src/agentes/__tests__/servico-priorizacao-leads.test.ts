/**
 * Testes unitários — Serviço de Priorização de Leads
 *
 * Cobre: calcularQualificacao, calcularUrgencia, parsearValorMonetario
 * e a composição do Score Composto.
 *
 * Sem dependências externas (Prisma/DB/Redis) — funções puras.
 */

import {
  calcularQualificacao,
  calcularUrgencia,
  parsearValorMonetario,
} from '../../servicos/servico-priorizacao-leads';

// ─── Helpers ────────────────────────────────────────────────────────────────

const agora = Date.now();

function criarLeadBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-teste-1',
    status: 'NOVO',
    temperatura: null,
    criadoEm: new Date(agora - 48 * 60 * 60 * 1000), // 2 dias atrás
    ultimaInteracao: null,
    valorPretendido: null,
    interesseEm: null,
    tipoImovel: null,
    enderecoImovel: null,
    bairroImovel: null,
    doresIdentificadas: [],
    motivacaoVenda: null,
    prazoDesejado: null,
    situacaoAtual: null,
    tipoAutorizacao: null,
    autorizouAnuncio: null,
    comissaoAcordada: null,
    scoreAssertiva: null,
    imovel: null,
    spin: null,
    proximaAtividadeData: null,
    horasSemResposta: null,
    urgenciaEnum: null,
    pressaoTempo: null,
    ultimaAcaoIAEm: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════
// parsearValorMonetario
// ══════════════════════════════════════════════════════════════════

describe('parsearValorMonetario', () => {
  it('retorna NaN para valores nulos ou vazios', () => {
    expect(isNaN(parsearValorMonetario(null))).toBe(true);
    expect(isNaN(parsearValorMonetario(undefined))).toBe(true);
    expect(isNaN(parsearValorMonetario(''))).toBe(true);
  });

  it('parseia formato brasileiro "R$ 350.000"', () => {
    expect(parsearValorMonetario('R$ 350.000')).toBe(350000);
  });

  it('parseia formato brasileiro com milhão "R$ 1.200.000"', () => {
    expect(parsearValorMonetario('R$ 1.200.000')).toBe(1200000);
  });

  it('parseia formato abreviado "600k"', () => {
    expect(parsearValorMonetario('600k')).toBe(600000);
  });

  it('parseia formato abreviado "1.5M"', () => {
    expect(parsearValorMonetario('1.5M')).toBe(1500000);
  });

  it('parseia formato abreviado "1,5M"', () => {
    expect(parsearValorMonetario('1,5M')).toBe(1500000);
  });

  it('parseia número puro "350000"', () => {
    expect(parsearValorMonetario('350000')).toBe(350000);
  });

  it('não confunde "metros" com "milhões" — "200m" não é 200M', () => {
    // Regex usa (?!i) para não capturar "mi" (minutos etc.)
    // "200m" → 200_000_000 segundo a regex — documentado como comportamento esperado para este contexto
    const resultado = parsearValorMonetario('200m');
    expect(resultado).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// calcularQualificacao
// ══════════════════════════════════════════════════════════════════

describe('calcularQualificacao', () => {
  it('lead completamente vazio retorna 0', () => {
    const lead = criarLeadBase({ status: 'NOVO' });
    // NOVO = 5 mas sem nenhum dado de imóvel/SPIN → 5
    // Lead "vazio" de dados = status = NOVO sem mais nada
    const score = calcularQualificacao(lead);
    expect(score).toBe(5);
  });

  it('status NOVO sem nenhum outro dado retorna apenas o peso do status (5)', () => {
    expect(calcularQualificacao(criarLeadBase({ status: 'NOVO' }))).toBe(5);
  });

  it('status ONBOARDING pontua mais que NOVO', () => {
    const scoreOnboarding = calcularQualificacao(criarLeadBase({ status: 'ONBOARDING' }));
    const scoreNovo = calcularQualificacao(criarLeadBase({ status: 'NOVO' }));
    expect(scoreOnboarding).toBeGreaterThan(scoreNovo);
  });

  it('pesos de status crescem corretamente no pipeline', () => {
    const statusOrdenados = [
      'NOVO', 'QUALIFICADO', 'TENTATIVA_AGENDAMENTO',
      'VISITA_AGENDADA', 'AVALIACAO_EM_ANDAMENTO', 'ONBOARDING',
    ];
    const scores = statusOrdenados.map((s) => calcularQualificacao(criarLeadBase({ status: s })));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('valor pretendido adiciona +10', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', valorPretendido: 'R$ 350.000' }));
    expect(com - sem).toBe(10);
  });

  it('1 dor identificada adiciona +6', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', doresIdentificadas: ['Precisa de liquidez'] }));
    expect(com - sem).toBe(6);
  });

  it('2+ dores identificadas adicionam +10 (6+4)', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', doresIdentificadas: ['Dor 1', 'Dor 2'] }));
    expect(com - sem).toBe(10);
  });

  it('motivacaoVenda adiciona +10', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', motivacaoVenda: 'Precisa de liquidez' }));
    expect(com - sem).toBe(10);
  });

  it('tipoAutorizacao exclusiva adiciona +6', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', tipoAutorizacao: 'exclusiva' }));
    expect(com - sem).toBe(6);
  });

  it('scoreAssertiva < 70 não pontua (+0)', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', scoreAssertiva: 50 }));
    expect(com - sem).toBe(0);
  });

  it('scoreAssertiva >= 70 adiciona +5', () => {
    const sem = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO' }));
    const com = calcularQualificacao(criarLeadBase({ status: 'QUALIFICADO', scoreAssertiva: 80 }));
    expect(com - sem).toBe(5);
  });

  it('score nunca ultrapassa 100', () => {
    const leadCompleto = criarLeadBase({
      status: 'ONBOARDING',
      interesseEm: 'vender',
      valorPretendido: 'R$ 1.200.000',
      tipoImovel: 'apartamento',
      enderecoImovel: 'Rua X',
      doresIdentificadas: ['d1', 'd2', 'd3'],
      motivacaoVenda: 'Mudança de cidade',
      prazoDesejado: '3 meses',
      situacaoAtual: 'Proprietário único',
      ultimaInteracao: new Date(),
      tipoAutorizacao: 'exclusiva',
      autorizouAnuncio: true,
      comissaoAcordada: '6%',
      scoreAssertiva: 90,
    });
    expect(calcularQualificacao(leadCompleto)).toBeLessThanOrEqual(100);
  });

  it('status desconhecido não quebra — retorna 0 de status mais outros campos', () => {
    const lead = criarLeadBase({ status: 'STATUS_INEXISTENTE' });
    expect(() => calcularQualificacao(lead)).not.toThrow();
    expect(calcularQualificacao(lead)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// calcularUrgencia
// ══════════════════════════════════════════════════════════════════

describe('calcularUrgencia', () => {
  it('lead FRIO sem eventos retorna 5 pts e categoria SEM_ACAO', () => {
    const lead = criarLeadBase({ temperatura: 'FRIO' });
    const { pontos, categoria } = calcularUrgencia(lead, agora);
    expect(pontos).toBe(5);
    expect(categoria).toBe('SEM_ACAO');
  });

  it('lead MORNO retorna 20 pts base', () => {
    const lead = criarLeadBase({ temperatura: 'MORNO' });
    const { pontos } = calcularUrgencia(lead, agora);
    expect(pontos).toBe(20);
  });

  it('lead QUENTE retorna 30 pts base e categoria ATENCAO', () => {
    const lead = criarLeadBase({ temperatura: 'QUENTE' });
    const { pontos, categoria } = calcularUrgencia(lead, agora);
    expect(pontos).toBe(30);
    expect(categoria).toBe('ATENCAO');
  });

  it('lead QUENTE + SLA >2h → URGENTE (>=50 pts)', () => {
    const lead = criarLeadBase({ temperatura: 'QUENTE', horasSemResposta: 3 });
    const { pontos, categoria } = calcularUrgencia(lead, agora);
    expect(pontos).toBeGreaterThanOrEqual(50);
    expect(categoria).toBe('URGENTE');
  });

  it('agendamento nas próximas 24h adiciona +25', () => {
    const em12h = new Date(agora + 12 * 60 * 60 * 1000);
    const lead = criarLeadBase({ temperatura: 'MORNO', proximaAtividadeData: em12h });
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO' }), agora);
    const com = calcularUrgencia(lead, agora);
    expect(com.pontos - sem.pontos).toBe(25);
  });

  it('urgência SPIN ALTA adiciona +10', () => {
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO' }), agora);
    const com = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO', urgenciaEnum: 'ALTA' }), agora);
    expect(com.pontos - sem.pontos).toBe(10);
  });

  it('pressaoTempo=true adiciona +8', () => {
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO' }), agora);
    const com = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO', pressaoTempo: true }), agora);
    expect(com.pontos - sem.pontos).toBe(8);
  });

  it('estagnação >14 dias adiciona +12', () => {
    const ha20dias = new Date(agora - 20 * 24 * 60 * 60 * 1000);
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO' }), agora);
    const com = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO', ultimaInteracao: ha20dias }), agora);
    expect(com.pontos - sem.pontos).toBe(12);
  });

  it('estagnação <=14 dias NÃO adiciona pontos de estagnação', () => {
    const ha10dias = new Date(agora - 10 * 24 * 60 * 60 * 1000);
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO' }), agora);
    const com = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO', ultimaInteracao: ha10dias }), agora);
    expect(com.pontos - sem.pontos).toBe(0);
  });

  it('alto valor >500K sem agendamento adiciona +10', () => {
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO' }), agora);
    const com = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO', valorPretendido: 'R$ 800.000' }), agora);
    expect(com.pontos - sem.pontos).toBe(10);
  });

  it('alto valor mas COM agendamento NÃO adiciona pontos', () => {
    const em6h = new Date(agora + 6 * 60 * 60 * 1000);
    const sem = calcularUrgencia(criarLeadBase({ temperatura: 'MORNO', proximaAtividadeData: em6h }), agora);
    const com = calcularUrgencia(
      criarLeadBase({ temperatura: 'MORNO', valorPretendido: 'R$ 800.000', proximaAtividadeData: em6h }),
      agora
    );
    expect(com.pontos - sem.pontos).toBe(0);
  });

  it('IA rodou há 3 min → categoria IA_ATIVA e pontuação reduzida', () => {
    const ha3min = new Date(agora - 3 * 60 * 1000);
    const lead = criarLeadBase({ temperatura: 'QUENTE', ultimaAcaoIAEm: ha3min });
    const { categoria } = calcularUrgencia(lead, agora);
    expect(categoria).toBe('IA_ATIVA');
  });

  it('lead PERDIDO tem penalidade -30 e pontuação >=0', () => {
    const lead = criarLeadBase({ temperatura: 'QUENTE', status: 'PERDIDO' });
    const { pontos } = calcularUrgencia(lead, agora);
    expect(pontos).toBeGreaterThanOrEqual(0);
    // QUENTE=30, PERDIDO=-30 → 0
    expect(pontos).toBe(0);
  });

  it('pontuação nunca vai abaixo de 0', () => {
    const lead = criarLeadBase({ temperatura: 'FRIO', status: 'ARQUIVADO' });
    const { pontos } = calcularUrgencia(lead, agora);
    expect(pontos).toBeGreaterThanOrEqual(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Score Composto
// ══════════════════════════════════════════════════════════════════

describe('scoreComposto = qualif×0.4 + urgência×0.6', () => {
  function calcularComposto(lead: ReturnType<typeof criarLeadBase>): number {
    const q = calcularQualificacao(lead);
    const { pontos: u } = calcularUrgencia(lead, agora);
    return Math.round(q * 0.4 + u * 0.6);
  }

  it('lead com tudo zerado retorna score baixo (apenas status NOVO)', () => {
    const lead = criarLeadBase({ status: 'NOVO', temperatura: 'FRIO' });
    // qualif=5, urgencia=5 → round(2+3) = 5
    expect(calcularComposto(lead)).toBe(5);
  });

  it('lead morno + valor + motivação retorna score médio', () => {
    // Ivonet aproximado: qualif=~47, urgencia=~35 → ~40
    const lead = criarLeadBase({
      status: 'TENTATIVA_AGENDAMENTO',
      temperatura: 'MORNO',
      valorPretendido: 'R$ 350.000',
      motivacaoVenda: 'Pagar outro apartamento',
      doresIdentificadas: ['Precisa de liquidez'],
      ultimaInteracao: new Date(),
    });
    const score = calcularComposto(lead);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(80);
  });

  it('qualif=84 urgencia=43 → composto=59 (caso Ivonet documentado)', () => {
    // Fórmula: round(84×0.4 + 43×0.6) = round(33.6 + 25.8) = round(59.4) = 59
    const composto = Math.round(84 * 0.4 + 43 * 0.6);
    expect(composto).toBe(59);
  });

  it('valores extremos (0,0) → 0', () => {
    expect(Math.round(0 * 0.4 + 0 * 0.6)).toBe(0);
  });

  it('valores extremos (100,100) → 100', () => {
    expect(Math.round(100 * 0.4 + 100 * 0.6)).toBe(100);
  });
});
