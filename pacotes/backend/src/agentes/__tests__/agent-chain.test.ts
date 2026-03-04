// Mock dos módulos pesados antes do import
jest.mock('@openai/agents', () => ({ handoff: jest.fn() }));
jest.mock('../opener-agent', () => ({ criarOpenerAgent: jest.fn() }));
jest.mock('../presenter-agent', () => ({ criarPresenterAgent: jest.fn() }));
jest.mock('../admin-agent', () => ({ criarAdminAgent: jest.fn() }));
jest.mock('../knowledge-agent', () => ({ knowledgeAgent: { asTool: jest.fn() } }));
jest.mock('../handoff-filters', () => ({ filterHistoryByQuery: jest.fn() }));

import {
  fasePorStatus,
  determinarAgente,
  ultimoAgentePorContato,
  STATUS_FASE_HUMANA,
  MAPA_NOMES_AGENTES,
  TipoAgente,
} from '../agent-chain';

// ============================================
// fasePorStatus
// ============================================

describe('fasePorStatus', () => {
  it('retorna FASE1 para undefined', () => {
    expect(fasePorStatus(undefined)).toBe('FASE1_QUALIFICACAO');
  });

  it.each([
    ['NOVO', 'FASE1_QUALIFICACAO'],
    ['QUALIFICADO', 'FASE1_QUALIFICACAO'],
  ])('mapeia %s → %s', (status, fase) => {
    expect(fasePorStatus(status)).toBe(fase);
  });

  it.each([
    ['TENTATIVA_AGENDAMENTO', 'FASE2_DIAGNOSTICO_SPIN'],
    ['VISITA_AGENDADA', 'FASE2_DIAGNOSTICO_SPIN'],
    ['CONTATANDO', 'FASE2_DIAGNOSTICO_SPIN'],
    ['AVALIACAO_EM_ANDAMENTO', 'FASE2_DIAGNOSTICO_SPIN'],
  ])('mapeia %s → %s', (status, fase) => {
    expect(fasePorStatus(status)).toBe(fase);
  });

  it.each([
    ['DOCUMENTACAO', 'FASE3_DOCUMENTACAO_HUMANA'],
    ['EM_NEGOCIACAO', 'FASE3_DOCUMENTACAO_HUMANA'],
  ])('mapeia %s → %s', (status, fase) => {
    expect(fasePorStatus(status)).toBe(fase);
  });

  it('mapeia ONBOARDING → FASE4_ONBOARDING', () => {
    expect(fasePorStatus('ONBOARDING')).toBe('FASE4_ONBOARDING');
  });

  it('mapeia CAPTADO → CARTEIRA', () => {
    expect(fasePorStatus('CAPTADO')).toBe('CARTEIRA');
  });

  it('retorna DESCONHECIDA para status não mapeado', () => {
    expect(fasePorStatus('STATUS_INVENTADO')).toBe('DESCONHECIDA');
  });
});

// ============================================
// determinarAgente
// ============================================

describe('determinarAgente', () => {
  beforeEach(() => {
    // Limpar cache entre testes
    ultimoAgentePorContato.clear();
  });

  it('usa agente persistido (Redis) como maior prioridade', () => {
    expect(determinarAgente('NOVO', 'contato-1', 'PRESENTER')).toBe('PRESENTER');
  });

  it('usa cache em memória como segunda prioridade', () => {
    ultimoAgentePorContato.set('contato-1', 'ADMIN');
    expect(determinarAgente('NOVO', 'contato-1')).toBe('ADMIN');
  });

  it('retorna OPENER sem status e sem cache', () => {
    expect(determinarAgente(undefined, undefined)).toBe('OPENER');
  });

  it.each<[string, TipoAgente]>([
    ['NOVO', 'OPENER'],
    ['QUALIFICADO', 'PRESENTER'],
    ['TENTATIVA_AGENDAMENTO', 'PRESENTER'],
    ['VISITA_AGENDADA', 'PRESENTER'],
    ['CONTATANDO', 'PRESENTER'],
    ['AVALIACAO_EM_ANDAMENTO', 'PRESENTER'],
    ['DOCUMENTACAO', 'ADMIN'],
    ['EM_NEGOCIACAO', 'ADMIN'],
    ['ONBOARDING', 'ADMIN'],
    ['CAPTADO', 'ADMIN'],
  ])('mapeia status "%s" → %s', (status, agente) => {
    expect(determinarAgente(status)).toBe(agente);
  });

  it('retorna OPENER para status desconhecido', () => {
    expect(determinarAgente('INEXISTENTE')).toBe('OPENER');
  });
});

// ============================================
// STATUS_FASE_HUMANA
// ============================================

describe('STATUS_FASE_HUMANA', () => {
  it('contém DOCUMENTACAO e EM_NEGOCIACAO', () => {
    expect(STATUS_FASE_HUMANA.has('DOCUMENTACAO')).toBe(true);
    expect(STATUS_FASE_HUMANA.has('EM_NEGOCIACAO')).toBe(true);
  });

  it('não contém NOVO', () => {
    expect(STATUS_FASE_HUMANA.has('NOVO')).toBe(false);
  });

  it('tem exatamente 2 itens', () => {
    expect(STATUS_FASE_HUMANA.size).toBe(2);
  });
});

// ============================================
// MAPA_NOMES_AGENTES
// ============================================

describe('MAPA_NOMES_AGENTES', () => {
  it('mapeia opener_agent_v11 → OPENER', () => {
    expect(MAPA_NOMES_AGENTES['opener_agent_v11']).toBe('OPENER');
  });

  it('mapeia presenter_agent_v4 → PRESENTER', () => {
    expect(MAPA_NOMES_AGENTES['presenter_agent_v4']).toBe('PRESENTER');
  });

  it('mapeia closer_agent_v5 → PRESENTER', () => {
    expect(MAPA_NOMES_AGENTES['closer_agent_v5']).toBe('PRESENTER');
  });

  it('mapeia admin_agent_v4 → ADMIN', () => {
    expect(MAPA_NOMES_AGENTES['admin_agent_v4']).toBe('ADMIN');
  });

  it('mapeia knowledge_agent → OPENER', () => {
    expect(MAPA_NOMES_AGENTES['knowledge_agent']).toBe('OPENER');
  });
});
