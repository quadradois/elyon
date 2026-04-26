/// <reference types="jest" />

/**
 * INTEGRATION TESTS — Fluxo conversacional multi-turn
 *
 * Simula o ciclo completo: mensagem → orchestrator → agente → handoff → resposta
 * Foco: validar que os handoffs, guardrails, filtros e fallbacks funcionam
 * corretamente em cenários realistas de conversação.
 *
 * Mocks:
 * - @openai/agents (run): simula resposta do SDK com handoffs
 * - guardrails: permite tudo por padrão (override por teste)
 * - conversation-cache: in-memory
 * - prisma: mock estático
 * - openai: mock (para gerarBriefingHandoff)
 */

// ====================================
// MOCKS — declarar ANTES dos imports
// ====================================

// Mock do resultado de run() — mutável por teste
let mockRunResult: any = {
    finalOutput: 'Olá! Como posso ajudar?',
    lastAgent: { name: 'opener_agent_v11' },
    history: [],
    newItems: [],
};

// Stub do SDK @openai/agents
jest.mock('@openai/agents', () => ({
    run: jest.fn(async () => mockRunResult),
    setTracingExportApiKey: jest.fn(),
    Agent: jest.fn().mockImplementation((cfg: any) => ({
        name: cfg.name,
        model: cfg.model,
        tools: cfg.tools || [],
        handoffs: [],
        instructions: cfg.instructions,
        on: jest.fn(),
        asTool: jest.fn(() => ({ type: 'tool' })),
    })),
    tool: jest.fn((cfg: any) => ({
        name: cfg.name,
        description: cfg.description,
        execute: cfg.execute,
    })),
    handoff: jest.fn((_agent: any, opts: any) => ({
        type: 'handoff',
        toolDescriptionOverride: opts?.toolDescriptionOverride,
        inputFilter: opts?.inputFilter,
        strictJsonSchema: false,
        inputJsonSchema: { additionalProperties: true },
    })),
}));

// Mock do Prisma
jest.mock('../../lib/db', () => ({
    prisma: {
        contato: { findFirst: jest.fn().mockResolvedValue(null) },
        lead: {
            findFirst: jest.fn().mockResolvedValue(null),
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(null),
        },
        logAuditoria: {
            create: jest.fn().mockResolvedValue(null),
        },
        aprendizadoAgente: {
            create: jest.fn().mockResolvedValue(null),
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
        },
    },
}));

// Mock dos guardrails de entrada
const mockExecutarGuardrails = jest.fn().mockResolvedValue({ permitido: true });
jest.mock('../guardrails', () => ({
    executarGuardrails: (...args: any[]) => mockExecutarGuardrails(...args),
}));

// Mock do conversation-cache (in-memory)
const cacheStore = new Map<string, any>();
const lastAgentStore = new Map<string, string>();

jest.mock('../conversation-cache', () => ({
    getHistory: jest.fn(async (id: string) => cacheStore.get(id)),
    setHistory: jest.fn(async (id: string, history: any, agentName?: string) => {
        cacheStore.set(id, history);
        if (agentName) lastAgentStore.set(id, agentName);
    }),
    getLastAgent: jest.fn(async (id: string) => lastAgentStore.get(id)),
    clearHistory: jest.fn(async (id: string) => {
        cacheStore.delete(id);
        lastAgentStore.delete(id);
    }),
    getCacheStats: jest.fn(async () => ({ redisKeys: 0, memoryKeys: cacheStore.size })),
    getSchemaState: jest.fn(async (id: string) => undefined),
    setSchemaState: jest.fn(async (id: string, state: any) => {}),
    getActiveAgent: jest.fn(async (id: string) => lastAgentStore.get(id)),
    setActiveAgent: jest.fn(async (id: string, agente: string) => { lastAgentStore.set(id, agente); }),
    clearActiveAgent: jest.fn(async (id: string) => { lastAgentStore.delete(id); }),
}));

// Mock do OpenAI (para gerarBriefingHandoff)
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Lead receptivo. Evitar comissão.' } }],
                }),
            },
        },
    }));
});

// Mock do serviço de conhecimento curado
jest.mock('../../servicos/conhecimento-curado', () => ({
    conhecimentoCuradoService: {
        buscar: jest.fn().mockResolvedValue([]),
    },
}));

// Mock do orchestrator-queries
jest.mock('../orchestrator-queries', () => ({
    buscarConfiguracaoTenant: jest.fn(),
    buscarContextoConversa: jest.fn(),
}));

// ====================================
// IMPORTS
// ====================================

import { processarMensagemOrquestrada, ConfiguracaoOrquestrador, ContextoConversa } from '../orchestrator';
import { run } from '@openai/agents';
import { ultimoAgentePorContato } from '../agent-chain';
import { prisma } from '../../lib/db';

// ====================================
// FIXTURES
// ====================================

const CONFIG_BASE: ConfiguracaoOrquestrador = {
    tenantId: 'tenant-test-001',
    nomeAgente: 'Ana',
    genero: 'feminino',
    nomeImobiliaria: 'Imobiliária Teste',
    cidade: 'São Paulo',
    diferenciais: ['Fotos Profissionais', 'Tour 360º'],
    comissaoPadrao: '6%',
    prazoContrato: 180,
};

const CONTEXTO_NOVO: ContextoConversa = {
    telefone: '5511999990001',
    contatoId: 'contato-integ-001',
    leadId: 'lead-integ-001',
    statusLead: 'NOVO',
};

// ====================================
// SETUP
// ====================================

beforeEach(() => {
    jest.clearAllMocks();
    cacheStore.clear();
    lastAgentStore.clear();
    ultimoAgentePorContato.clear();

    // Reset run mock para resposta padrão
    mockRunResult = {
        finalOutput: 'Olá! Como posso ajudar?',
        lastAgent: { name: 'opener_agent_v11' },
        history: [
            { role: 'user', content: 'Oi' },
            { role: 'assistant', content: 'Olá! Como posso ajudar?' },
        ],
        newItems: [],
    };

    mockExecutarGuardrails.mockResolvedValue({ permitido: true });
});

// ====================================
// CENÁRIO 1: LEAD RECEPTIVO — FLUXO COMPLETO
// ====================================

describe('Cenário 1: Lead receptivo — fluxo SDR→Admin', () => {
    it('primeiro turno roteia para SDR quando status é NOVO', async () => {
        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Oi, quero vender meu apartamento' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta).toBe('Olá! Como posso ajudar?');
        expect(result.agenteUsado).toBe('SDR');
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('inclui resumo do lead nas instruções enviadas ao SDK', async () => {
        // arrange: make prisma return a fake lead record
        const fakeLead = { id: 'lead-integ-001', nome: 'Fulan', telefone: '5550000' };
        (prisma.lead.findUnique as jest.Mock).mockResolvedValue(fakeLead);

        // act
        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Oi, quero vender meu apartamento' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        // should have successfully returned response
        expect(result.sucesso).toBe(true);

        // prisma.update ought to have been called with schemaState payload
        expect(prisma.lead.update).toHaveBeenCalledTimes(1);
        const updateArg = (prisma.lead.update as jest.Mock).mock.calls[0][0];
        expect(updateArg.where).toEqual({ id: 'lead-integ-001' });
        expect(updateArg.data).toHaveProperty('schemaState');

        // assert that run was called and examine its options
        expect(run).toHaveBeenCalledTimes(1);
        const callArgs = (run as jest.Mock).mock.calls[0];
        // signature: run(agent, inputSDK, options)
        const inputItems: any[] = callArgs[1] || [];
        const systemMsg = inputItems.find((i: any) => i.role === 'system' && typeof i.content === 'string' && i.content.includes('DADOS EXISTENTES NO LEAD'));
        expect(systemMsg).toBeDefined();
        expect(systemMsg.content).toContain('DADOS EXISTENTES NO LEAD');
        expect(systemMsg.content).toContain('nome: Fulan');
    });

    it('handoff SDR→Admin detectado e persistido', async () => {
        // Simular que o SDK fez handoff SDR→Admin
        mockRunResult = {
            finalOutput: { respostaParaOCliente: 'Perfeito! Me passa seu CPF pra gerar o contrato?', proximoPasso: 'coletar_cpf' },
            lastAgent: { name: 'admin_agent_v4' },
            history: [
                { role: 'user', content: 'Sim, vamos fechar' },
                { role: 'assistant', content: 'Perfeito! Me passa seu CPF pra gerar o contrato?' },
            ],
            newItems: [
                { type: 'handoff_call_item', name: 'transfer_to_admin_agent_v4' },
                { type: 'handoff_output_item' },
            ],
        };

        const result = await processarMensagemOrquestrada(
            [
                { role: 'user', content: 'Oi' },
                { role: 'assistant', content: 'Boa tarde! Seu apto é de quantos quartos?' },
                { role: 'user', content: 'Sim, vamos fechar' },
            ],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.agenteUsado).toBe('ADMIN');
        // Handoff persistido no cache em memória
        expect(ultimoAgentePorContato.get('contato-integ-001')).toBe('ADMIN');
    });

    it('handoff SDR→Admin via cache detectado', async () => {
        // Lead já está no SDR (cache)
        ultimoAgentePorContato.set('contato-integ-001', 'SDR');
        lastAgentStore.set('contato-integ-001', 'SDR');

        mockRunResult = {
            finalOutput: { respostaParaOCliente: 'Me passa seu CPF pra eu gerar o contrato?', proximoPasso: 'coletar_cpf' },
            lastAgent: { name: 'admin_agent_v4' },
            history: [],
            newItems: [
                { type: 'handoff_call_item', name: 'transfer_to_admin_agent_v4' },
            ],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Perfeito, vamos fechar!' }],
            CONFIG_BASE,
            { ...CONTEXTO_NOVO, statusLead: 'AVALIACAO_EM_ANDAMENTO' },
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta).toBe('Me passa seu CPF pra eu gerar o contrato?');
        expect(result.agenteUsado).toBe('ADMIN');
        expect(ultimoAgentePorContato.get('contato-integ-001')).toBe('ADMIN');
    });
});

// ====================================
// CENÁRIO 2: SDR LEGADO — resolve nome legado para SDR
// ====================================

describe('Cenário 2: Agente legado resolve para SDR', () => {
    it('opener_agent_v11 legado é mapeado para SDR', async () => {
        // Cache tem nome legado
        lastAgentStore.set('contato-integ-001', 'opener_agent_v11');

        mockRunResult = {
            finalOutput: 'Entendo sua preocupação! Sou a Ana, da Imobiliária Teste.',
            lastAgent: { name: 'sdr_agent_v1' },
            history: [],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Quem é você?' }],
            CONFIG_BASE,
            { ...CONTEXTO_NOVO, statusLead: 'QUALIFICADO' },
        );

        expect(result.sucesso).toBe(true);
        expect(result.agenteUsado).toBe('SDR');
    });
});

// ====================================
// CENÁRIO 3: GUARDRAILS DE ENTRADA
// ====================================

describe('Cenário 3: Guardrails de entrada', () => {
    it('bloqueia opt-out e retorna mensagem de fallback', async () => {
        mockExecutarGuardrails.mockResolvedValueOnce({
            permitido: false,
            tipo: 'OPT_OUT',
            mensagemFallback: 'Seu número foi removido da nossa lista. Desculpe o incômodo!',
        });

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Para de me mandar mensagem' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta).toBe('Seu número foi removido da nossa lista. Desculpe o incômodo!');
        expect(result.guardrailAcionado?.tipo).toBe('OPT_OUT');
        // run() NÃO deve ter sido chamado (guardrail bloqueou antes)
        expect(run).not.toHaveBeenCalled();
    });

    it('bloqueia spam e retorna mensagem', async () => {
        mockExecutarGuardrails.mockResolvedValueOnce({
            permitido: false,
            tipo: 'SPAM',
            mensagemFallback: 'Aguarde um momento antes de enviar outra mensagem.',
        });

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'oi oi oi oi oi' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.guardrailAcionado?.tipo).toBe('SPAM');
        expect(run).not.toHaveBeenCalled();
    });
});

// ====================================
// CENÁRIO 4: FILTRO ANTI-NARRAÇÃO
// ====================================

describe('Cenário 4: Filtro anti-narração de handoff', () => {
    it('remove linhas de narração de handoff da resposta', async () => {
        mockRunResult = {
            finalOutput: 'Transferindo para o especialista.\nVou te explicar como funciona nossa avaliação premium! Qual andar é o seu apartamento?',
            lastAgent: { name: 'sdr_agent_v1' },
            history: [],
            newItems: [{ type: 'handoff_call_item' }],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Sim, quero saber mais' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        // "Transferindo para o especialista" deve ter sido removido
        expect(result.resposta).not.toContain('Transferindo');
        expect(result.resposta).toContain('avaliação premium');
    });

    it('aplica fallback se resposta fica vazia após filtro de handoff', async () => {
        // Resposta é APENAS narração de handoff
        mockRunResult = {
            finalOutput: 'Vou te passar para o próximo agente',
            lastAgent: { name: 'sdr_agent_v1' },
            history: [],
            newItems: [{ type: 'handoff_call_item' }],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Sim' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        // Deve ter aplicado fallback contextual (resposta não vazia)
        expect(result.resposta!.length).toBeGreaterThan(10);
        expect(result.resposta).not.toContain('próximo agente');
    });
});

// ====================================
// CENÁRIO 5: FASE HUMANA (DOCUMENTAÇÃO/NEGOCIAÇÃO)
// ====================================

describe('Cenário 5: Lead em fase humana', () => {
    it('roteia para ADMIN mesmo em status DOCUMENTACAO (sem resposta fixa)', async () => {
        mockRunResult = {
            finalOutput: 'Oi! Vi que vocês estão em fase de documentação. Em que posso ajudar?',
            lastAgent: { name: 'admin_agent_v4' },
            history: [],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Oi, tenho uma dúvida sobre o contrato' }],
            CONFIG_BASE,
            { ...CONTEXTO_NOVO, statusLead: 'DOCUMENTACAO' },
        );

        expect(result.sucesso).toBe(true);
        // run() DEVE ter sido chamado (não mais resposta fixa — fix F4)
        expect(run).toHaveBeenCalledTimes(1);
        expect(result.agenteUsado).toBe('ADMIN');
    });
});

// ====================================
// CENÁRIO 6: STRUCTURED OUTPUT (Admin)
// ====================================

describe('Cenário 6: Structured output do Admin', () => {
    it('extrai respostaParaOCliente do structured output', async () => {
        mockRunResult = {
            finalOutput: {
                respostaParaOCliente: 'CPF anotado! Agora me passa seu e-mail?',
                proximoPasso: 'coletar_email',
                sentimento: 'positivo',
            },
            lastAgent: { name: 'admin_agent_v4' },
            history: [],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Meu CPF é 123.456.789-00' }],
            CONFIG_BASE,
            { ...CONTEXTO_NOVO, statusLead: 'ONBOARDING' },
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta).toBe('CPF anotado! Agora me passa seu e-mail?');
    });
});

// ====================================
// CENÁRIO 7: FALLBACK — RESPOSTA VAZIA SEM HANDOFF
// ====================================

describe('Cenário 7: Fallbacks', () => {
    it('aplica fallback genérico se LLM retorna vazio sem handoff', async () => {
        mockRunResult = {
            finalOutput: '',
            lastAgent: { name: 'opener_agent_v11' },
            history: [],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'kkk' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta!.length).toBeGreaterThan(5);
    });

    it('aplica fallback de transição via CoT', async () => {
        mockRunResult = {
            finalOutput: '<cot>Devo avançar para diagnóstico SPIN</cot>',
            lastAgent: { name: 'sdr_agent_v1' },
            history: [],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Sim, quero vender' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        // Deve ter usado fallback consultivo para PRESENTER
        expect(result.resposta!.length).toBeGreaterThan(10);
    });

    it('aplica fallback quando SDR executa tool crítica e retorna vazio', async () => {
        mockRunResult = {
            finalOutput: '',
            lastAgent: { name: 'sdr_agent_v1' },
            history: [],
            newItems: [
                { type: 'function_call', name: 'mover_para_fase' },
            ],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Pode seguir' }],
            CONFIG_BASE,
            { ...CONTEXTO_NOVO, statusLead: 'QUALIFICADO' },
        );

        expect(result.sucesso).toBe(true);
        expect(result.agenteUsado).toBe('SDR');
        // Fallback contextual gerado
        expect(result.resposta!.length).toBeGreaterThan(10);
    });

    it('aplica fallback de onboarding quando ADMIN faz handoff e resposta é só narração', async () => {
        mockRunResult = {
            finalOutput: 'Vou te passar para o próximo agente',
            lastAgent: { name: 'admin_agent_v4' },
            history: [],
            newItems: [
                { type: 'handoff_call_item', name: 'transfer_to_admin_agent_v4' },
            ],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Fechamos, bora onboarding' }],
            CONFIG_BASE,
            { ...CONTEXTO_NOVO, statusLead: 'NOVO' },
        );

        expect(result.sucesso).toBe(true);
        expect(result.agenteUsado).toBe('ADMIN');
        expect(result.resposta).toBe('Ótimo! Pra eu seguir com seu onboarding, posso começar confirmando seu CPF e e-mail?');
    });
});

// ====================================
// CENÁRIO 8: CACHE SDK SUBSEQUENTE
// ====================================

describe('Cenário 8: Turnos subsequentes com cache SDK', () => {
    it('usa cache SDK quando disponível em turno subsequente', async () => {
        // Simular cache existente com 2 itens
        cacheStore.set('contato-integ-001', [
            { role: 'user', content: 'Oi' },
            { role: 'assistant', content: 'Boa tarde!' },
        ]);

        mockRunResult = {
            finalOutput: 'Seu apartamento é de quantos quartos?',
            lastAgent: { name: 'opener_agent_v11' },
            history: [
                { role: 'user', content: 'Oi' },
                { role: 'assistant', content: 'Boa tarde!' },
                { role: 'user', content: 'Quero vender meu apto' },
                { role: 'assistant', content: 'Seu apartamento é de quantos quartos?' },
            ],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Quero vender meu apto' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta).toBe('Seu apartamento é de quantos quartos?');

        // run deve receber o cache + nova mensagem
        const runArgs = (run as jest.Mock).mock.calls[0][1];
        // Input deve ter: cache (2 itens) + system state + user msg = 4+ itens
        expect(runArgs.length).toBeGreaterThanOrEqual(4);
    });
});

// ====================================
// CENÁRIO 9: ERRO DO SDK — TRATAMENTO GRACEFUL
// ====================================

describe('Cenário 9: Erro do SDK', () => {
    it('retorna erro graceful se run() falhar', async () => {
        (run as jest.Mock).mockRejectedValueOnce(new Error('OpenAI API rate limit'));

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Oi' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(false);
        expect(result.erro).toContain('rate limit');
    });

    it('retenta sem cache se erro de tool_call_id obsoleto', async () => {
        // Primeiro call falha com tool_call_id not found, segundo sucede
        (run as jest.Mock)
            .mockRejectedValueOnce(Object.assign(new Error('tool_call_id abc123 is not found'), { status: 400 }))
            .mockResolvedValueOnce({
                finalOutput: 'Oi! Tudo bem?',
                lastAgent: { name: 'opener_agent_v11' },
                history: [],
                newItems: [],
            });

        // Precisa ter cache para acionar o retry
        cacheStore.set('contato-integ-001', [
            { role: 'user', content: 'Msg anterior' },
        ]);

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'Oi' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.resposta).toBe('Oi! Tudo bem?');
        // run deve ter sido chamado 2x (retry)
        expect(run).toHaveBeenCalledTimes(2);
    });
});

// ====================================
// CENÁRIO 10: AGENTE LEGADO CLOSER → PRESENTER
// ====================================

describe('Cenário 10: Migração de agente legado', () => {
    it('migra CLOSER para SDR automaticamente', async () => {
        lastAgentStore.set('contato-integ-001', 'CLOSER');

        mockRunResult = {
            finalOutput: 'Continuando nosso diagnóstico...',
            lastAgent: { name: 'sdr_agent_v1' },
            history: [],
            newItems: [],
        };

        const result = await processarMensagemOrquestrada(
            [{ role: 'user', content: 'E aí, como ficou?' }],
            CONFIG_BASE,
            CONTEXTO_NOVO,
        );

        expect(result.sucesso).toBe(true);
        expect(result.agenteUsado).toBe('SDR');
    });
});
