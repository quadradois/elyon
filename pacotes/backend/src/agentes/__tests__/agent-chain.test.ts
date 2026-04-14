// Mock dos módulos pesados antes do import
const mockSdrAgent = { name: 'sdr_agent_v1', handoffs: [] as any[], on: jest.fn() };
const mockAdminAgent = { name: 'admin_agent_v4', handoffs: [] as any[], on: jest.fn() };
const mockKnowledgeTool = jest.fn();
const mockKnowledgeAgent = { asTool: jest.fn(() => mockKnowledgeTool) };
const mockHandoffResult = { strictJsonSchema: false, inputJsonSchema: { additionalProperties: false } };

jest.mock('@openai/agents', () => ({ handoff: jest.fn(() => ({ ...mockHandoffResult })) }));
jest.mock('../sdr-agent', () => ({ criarSdrAgent: jest.fn(() => mockSdrAgent) }));
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

import { criarSdrAgent } from '../sdr-agent';
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
    ultimoAgentePorContato.clear();
  });

  it('usa agente persistido (Redis) como maior prioridade', () => {
    expect(determinarAgente('NOVO', 'contato-1', 'SDR')).toBe('SDR');
  });

  it('usa cache em memória como segunda prioridade', () => {
    ultimoAgentePorContato.set('contato-1', 'ADMIN');
    expect(determinarAgente('NOVO', 'contato-1')).toBe('ADMIN');
  });

  it('retorna SDR sem status e sem cache', () => {
    expect(determinarAgente(undefined, undefined)).toBe('SDR');
  });

  it.each<[string, TipoAgente]>([
    ['NOVO', 'SDR'],
    ['QUALIFICADO', 'SDR'],
    ['TENTATIVA_AGENDAMENTO', 'SDR'],
    ['VISITA_AGENDADA', 'SDR'],
    ['CONTATANDO', 'SDR'],
    ['AVALIACAO_EM_ANDAMENTO', 'SDR'],
    ['DOCUMENTACAO', 'ADMIN'],
    ['EM_NEGOCIACAO', 'ADMIN'],
    ['ONBOARDING', 'ADMIN'],
    ['CAPTADO', 'ADMIN'],
  ])('mapeia status "%s" → %s', (status, agente) => {
    expect(determinarAgente(status)).toBe(agente);
  });

  it('retorna SDR para status desconhecido', () => {
    expect(determinarAgente('INEXISTENTE')).toBe('SDR');
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
  it('mapeia sdr_agent_v1 → SDR', () => {
    expect(MAPA_NOMES_AGENTES['sdr_agent_v1']).toBe('SDR');
  });

  it('mapeia opener_agent_v11 → SDR (legado)', () => {
    expect(MAPA_NOMES_AGENTES['opener_agent_v11']).toBe('SDR');
  });

  it('mapeia presenter_agent_v4 → SDR (legado)', () => {
    expect(MAPA_NOMES_AGENTES['presenter_agent_v4']).toBe('SDR');
  });

  it('mapeia closer_agent_v5 → SDR (legado)', () => {
    expect(MAPA_NOMES_AGENTES['closer_agent_v5']).toBe('SDR');
  });

  it('mapeia admin_agent_v4 → ADMIN', () => {
    expect(MAPA_NOMES_AGENTES['admin_agent_v4']).toBe('ADMIN');
  });

  it('mapeia knowledge_agent → SDR', () => {
    expect(MAPA_NOMES_AGENTES['knowledge_agent']).toBe('SDR');
  });

  it('mapeia opener_agent_v12 → SDR (legado)', () => {
    expect(MAPA_NOMES_AGENTES['opener_agent_v12']).toBe('SDR');
  });

  it('mapeia presenter_agent_v5 → SDR (legado)', () => {
    expect(MAPA_NOMES_AGENTES['presenter_agent_v5']).toBe('SDR');
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
    mockSdrAgent.handoffs = [];
    jest.clearAllMocks();
  });

  it('retorna objeto com SDR e ADMIN', () => {
    const cadeia = criarCadeiaAgentes(config as any);
    expect(cadeia).toHaveProperty('SDR');
    expect(cadeia).toHaveProperty('ADMIN');
  });

  it('chama criarSdrAgent com config correta', () => {
    criarCadeiaAgentes(config as any);
    expect(criarSdrAgent).toHaveBeenCalledWith(
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

  it('chama criarAdminAgent com dados de contrato', () => {
    criarCadeiaAgentes(config as any);
    expect(criarAdminAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        comissaoPadrao: '6%',
        prazoContrato: 180,
      }),
    );
  });

  it('cria knowledge agent e injeta como tool', () => {
    criarCadeiaAgentes(config as any);
    expect(criarKnowledgeAgent).toHaveBeenCalled();
    expect(mockKnowledgeAgent.asTool).toHaveBeenCalled();
  });

  it('configura handoff SDR→Admin no SDK', () => {
    criarCadeiaAgentes(config as any);
    // handoff() é chamado 1 vez: SDR→Admin
    expect(handoff).toHaveBeenCalledTimes(1);
  });

  it('registra lifecycle hooks (agent_start, agent_end) em todos os agentes', () => {
    criarCadeiaAgentes(config as any);
    expect(mockSdrAgent.on).toHaveBeenCalledWith('agent_start', expect.any(Function));
    expect(mockSdrAgent.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
    expect(mockAdminAgent.on).toHaveBeenCalledWith('agent_start', expect.any(Function));
  });

  it('usa BYOK quando configurado', () => {
    const configBYOK = {
      ...config,
      llmModelo: 'deepseek-chat',
      llmApiKey: 'sk-custom',
      llmBaseUrl: 'https://api.deepseek.com/v1',
    };
    criarCadeiaAgentes(configBYOK as any);
    expect(criarSdrAgent).toHaveBeenCalledWith(
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
    mockSdrAgent.handoffs = [];
    jest.clearAllMocks();
  });

  it('retorna agente SDR quando tipo=SDR', () => {
    const agente = criarAgente('SDR', config as any, contexto);
    expect(agente).toBeDefined();
    expect(agente.name).toBe('sdr_agent_v1');
  });

  it('retorna agente ADMIN quando tipo=ADMIN', () => {
    const agente = criarAgente('ADMIN', config as any, contexto);
    expect(agente).toBeDefined();
    expect(agente.name).toBe('admin_agent_v4');
  });
});
