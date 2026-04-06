// Mock dos módulos pesados antes do import
const mockOpenerAgent = { name: 'opener_agent_v11', handoffs: [] as any[], on: jest.fn() };
const mockPresenterAgent = { name: 'presenter_agent_v4', handoffs: [] as any[], on: jest.fn() };
const mockAdminAgent = { name: 'admin_agent_v4', handoffs: [] as any[], on: jest.fn() };
const mockKnowledgeTool = jest.fn();
const mockKnowledgeAgent = { asTool: jest.fn(() => mockKnowledgeTool) };
const mockHandoffResult = { strictJsonSchema: false, inputJsonSchema: { additionalProperties: false } };

jest.mock('@openai/agents', () => ({ handoff: jest.fn(() => ({ ...mockHandoffResult })) }));
jest.mock('../opener-agent', () => ({ criarOpenerAgent: jest.fn(() => mockOpenerAgent) }));
jest.mock('../presenter-agent', () => ({ criarPresenterAgent: jest.fn(() => mockPresenterAgent) }));
jest.mock('../admin-agent', () => ({ criarAdminAgent: jest.fn(() => mockAdminAgent) }));
jest.mock('../knowledge-agent', () => ({ criarKnowledgeAgent: jest.fn(() => mockKnowledgeAgent) }));
jest.mock('../handoff-filters', () => ({ filterHistoryByQuery: jest.fn((h: any[]) => h) }));

import {
  fasePorStatus,
  determinarAgente,
  ultimoAgentePorContato,
  STATUS_FASE_HUMANA,
  MAPA_NOMES_AGENTES,
  criarCadeiaAgentes,
  criarAgente,
  TipoAgente,
} from '../agent-chain';

import { criarOpenerAgent } from '../opener-agent';
import { criarPresenterAgent } from '../presenter-agent';
import { criarAdminAgent } from '../admin-agent';
import { criarKnowledgeAgent } from '../knowledge-agent';
import { handoff } from '@openai/agents';

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

  it('mapeia opener_agent_v12 → OPENER', () => {
    expect(MAPA_NOMES_AGENTES['opener_agent_v12']).toBe('OPENER');
  });

  it('mapeia presenter_agent_v5 → PRESENTER', () => {
    expect(MAPA_NOMES_AGENTES['presenter_agent_v5']).toBe('PRESENTER');
  });
});

// ============================================
// criarCadeiaAgentes
// ============================================

describe('criarCadeiaAgentes', () => {
  const config = {
    tenantId: 'tenant-001',
    nomeAgente: 'Sofia',
    genero: 'feminino',
    nomeImobiliaria: 'Imob Teste',
    cidade: 'São Paulo',
    diferenciais: ['Tour 360'],
    comissaoPadrao: '6%',
    prazoContrato: 180,
  };
  const contexto = {
    telefone: '5511999990001',
    leadId: 'lead-001',
    statusLead: 'NOVO',
  };

  beforeEach(() => {
    // Reset handoff arrays para cada teste
    mockOpenerAgent.handoffs = [];
    mockPresenterAgent.handoffs = [];
    jest.clearAllMocks();
  });

  it('retorna objeto com OPENER, PRESENTER e ADMIN', () => {
    const cadeia = criarCadeiaAgentes(config as any, contexto);
    expect(cadeia).toHaveProperty('OPENER');
    expect(cadeia).toHaveProperty('PRESENTER');
    expect(cadeia).toHaveProperty('ADMIN');
  });

  it('chama criarOpenerAgent com config correta', () => {
    criarCadeiaAgentes(config as any, contexto);
    expect(criarOpenerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        nomeAgente: 'Sofia',
        genero: 'feminino',
        nomeImobiliaria: 'Imob Teste',
        cidade: 'São Paulo',
        comissaoPadrao: '6%',
        prazoContrato: 180,
      }),
    );
  });

  it('chama criarPresenterAgent com diferenciais e situação', () => {
    criarCadeiaAgentes(config as any, { ...contexto, situacaoAtual: 'sozinho' });
    expect(criarPresenterAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        diferenciais: ['Tour 360'],
        situacaoAtual: 'sozinho',
      }),
    );
  });

  it('chama criarAdminAgent com dados de contrato', () => {
    criarCadeiaAgentes(config as any, {
      ...contexto,
      tipoAutorizacao: 'exclusiva',
      comissaoAcordada: '6%',
      prazoTrabalho: 90,
    });
    expect(criarAdminAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoAutorizacao: 'exclusiva',
        comissaoAcordada: '6%',
        prazoTrabalho: 90,
      }),
    );
  });

  it('cria knowledge agent e injeta como tool', () => {
    criarCadeiaAgentes(config as any, contexto);
    expect(criarKnowledgeAgent).toHaveBeenCalled();
    expect(mockKnowledgeAgent.asTool).toHaveBeenCalled();
  });

  it('configura handoffs bidirecionais no SDK', () => {
    criarCadeiaAgentes(config as any, contexto);
    // handoff() é chamado 3 vezes: opener→presenter, presenter→admin, presenter→opener (reverse)
    expect(handoff).toHaveBeenCalledTimes(3);
  });

  it('registra lifecycle hooks (agent_start, agent_end) em todos os agentes', () => {
    criarCadeiaAgentes(config as any, contexto);
    // Cada agente deve ter 2 chamadas a .on() (agent_start + agent_end)
    expect(mockOpenerAgent.on).toHaveBeenCalledWith('agent_start', expect.any(Function));
    expect(mockOpenerAgent.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
    expect(mockPresenterAgent.on).toHaveBeenCalledWith('agent_start', expect.any(Function));
    expect(mockAdminAgent.on).toHaveBeenCalledWith('agent_start', expect.any(Function));
  });

  it('usa BYOK quando configurado', () => {
    const configBYOK = {
      ...config,
      llmModelo: 'deepseek-chat',
      llmApiKey: 'sk-custom',
      llmBaseUrl: 'https://api.deepseek.com/v1',
    };
    criarCadeiaAgentes(configBYOK as any, contexto);
    expect(criarOpenerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-chat',
        apiKey: 'sk-custom',
        baseUrl: 'https://api.deepseek.com/v1',
      }),
    );
  });
});

// ============================================
// criarAgente
// ============================================

describe('criarAgente', () => {
  const config = {
    tenantId: 'tenant-001',
    nomeAgente: 'Sofia',
    genero: 'feminino',
    nomeImobiliaria: 'Imob Teste',
  };
  const contexto = { telefone: '5511999990001' };

  beforeEach(() => {
    mockOpenerAgent.handoffs = [];
    mockPresenterAgent.handoffs = [];
    jest.clearAllMocks();
  });

  it('retorna agente OPENER quando tipo=OPENER', () => {
    const agente = criarAgente('OPENER', config as any, contexto);
    expect(agente).toBeDefined();
    expect(agente.name).toBe('opener_agent_v11');
  });

  it('retorna agente PRESENTER quando tipo=PRESENTER', () => {
    const agente = criarAgente('PRESENTER', config as any, contexto);
    expect(agente).toBeDefined();
    expect(agente.name).toBe('presenter_agent_v4');
  });

  it('retorna agente ADMIN quando tipo=ADMIN', () => {
    const agente = criarAgente('ADMIN', config as any, contexto);
    expect(agente).toBeDefined();
    expect(agente.name).toBe('admin_agent_v4');
  });
});
