/**
 * Testes: knowledge-agent.ts (factory criarKnowledgeAgent)
 *
 * Cobre:
 * - Factory cria instância sem config (default)
 * - Factory cria instância com BYOK config
 * - Agent tem nome, tools e instructions corretos
 * - Export legado 'knowledgeAgent' funciona
 * - asTool() retorna tool invocável
 */

// Mock do @openai/agents
const mockAgentInstance = {
    name: 'knowledge_agent',
    model: 'gpt-4.1-mini',
    tools: [],
    asTool: jest.fn(() => ({ type: 'tool', name: 'knowledge_agent' })),
    instructions: null as any,
};

jest.mock('@openai/agents', () => ({
    Agent: jest.fn().mockImplementation((config: any) => {
        mockAgentInstance.name = config.name;
        mockAgentInstance.model = config.model;
        mockAgentInstance.tools = config.tools;
        mockAgentInstance.instructions = config.instructions;
        return mockAgentInstance;
    }),
    tool: jest.fn((config: any) => ({
        name: config.name,
        description: config.description,
        execute: config.execute,
    })),
}));

// Mock do serviço de conhecimento curado
jest.mock('../../servicos/conhecimento-curado', () => ({
    conhecimentoCuradoService: {
        buscar: jest.fn().mockResolvedValue([]),
    },
}));

// Mock do elyon-context
const mockCriarModeloBYOK = jest.fn((config: any, fallback: string) => {
    if (config?.model) return config.model;
    return fallback;
});

jest.mock('../elyon-context', () => ({
    criarModeloBYOK: (config: any, fallback: string) => mockCriarModeloBYOK(config, fallback),
}));

jest.mock('../byok-resolver', () => ({
    MODELO_PADRAO_AUXILIAR: 'gpt-4.1-mini',
    MODELO_PADRAO_PRINCIPAL: 'gpt-4.1',
}));

import { criarKnowledgeAgent, knowledgeAgent } from '../knowledge-agent';
import { Agent } from '@openai/agents';
import { conhecimentoCuradoService } from '../../servicos/conhecimento-curado';

beforeEach(() => {
    jest.clearAllMocks();
    mockCriarModeloBYOK.mockImplementation((config: any, fallback: string) => {
        if (config?.model) return config.model;
        return fallback;
    });
});

// ====================================
// FACTORY SEM CONFIG (DEFAULT)
// ====================================

describe('criarKnowledgeAgent() sem config', () => {
    it('cria agente com modelo padrão gpt-4.1-mini', () => {
        const agent = criarKnowledgeAgent();
        expect(Agent).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'knowledge_agent',
                model: 'gpt-4.1-mini',
            })
        );
    });

    it('inclui buscarConhecimentoInternoTool', () => {
        const agent = criarKnowledgeAgent();
        expect(Agent).toHaveBeenCalledWith(
            expect.objectContaining({
                tools: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'buscar_conhecimento_interno',
                    }),
                ]),
            })
        );
    });

    it('instructions é uma função (dinâmica)', () => {
        const agent = criarKnowledgeAgent();
        const callArgs = (Agent as unknown as jest.Mock).mock.calls[0][0];
        expect(typeof callArgs.instructions).toBe('function');
    });

    it('instructions menciona Estrategista de Vendas', () => {
        const agent = criarKnowledgeAgent();
        const callArgs = (Agent as unknown as jest.Mock).mock.calls[0][0];
        const prompt = callArgs.instructions({});
        expect(prompt).toContain('Estrategista de Vendas');
    });
});

// ====================================
// FACTORY COM BYOK
// ====================================

describe('criarKnowledgeAgent() com BYOK', () => {
    it('passa config para criarModeloBYOK', () => {
        const config = {
            model: 'deepseek-chat',
            apiKey: 'sk-test-123',
            baseUrl: 'https://api.deepseek.com/v1',
        };
        criarKnowledgeAgent(config);
        expect(mockCriarModeloBYOK).toHaveBeenCalledWith(config, 'gpt-4.1-mini');
    });

    it('usa modelo BYOK do tenant', () => {
        mockCriarModeloBYOK.mockReturnValue('deepseek-chat');
        const agent = criarKnowledgeAgent({ model: 'deepseek-chat' });
        expect(Agent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'deepseek-chat',
            })
        );
    });
});

// ====================================
// ASTOOL
// ====================================

describe('asTool()', () => {
    it('retorna tool invocável', () => {
        const agent = criarKnowledgeAgent();
        const t = agent.asTool({ toolDescription: 'Consulte o estrategista' });
        expect(agent.asTool).toHaveBeenCalledWith({ toolDescription: 'Consulte o estrategista' });
    });
});

// ====================================
// EXPORT LEGADO
// ====================================

describe('knowledgeAgent (legado)', () => {
    it('é uma instância criada pela factory', () => {
        expect(knowledgeAgent).toBeDefined();
        expect(knowledgeAgent.name).toBe('knowledge_agent');
    });
});

// ====================================
// TOOL EXECUTE
// ====================================

describe('buscar_conhecimento_interno tool', () => {
    it('retorna fallback quando busca não encontra resultados', async () => {
        (conhecimentoCuradoService.buscar as jest.Mock).mockResolvedValueOnce([]);

        criarKnowledgeAgent();
        const callArgs = (Agent as unknown as jest.Mock).mock.calls[0][0];
        const tool = callArgs.tools[0];

        const result = await tool.execute({
            perguntaOuObjecao: 'Cliente disse que comissão está alta',
            faseAtual: 'Presenter',
        });

        expect(conhecimentoCuradoService.buscar).toHaveBeenCalledWith({
            query: 'Cliente disse que comissão está alta',
            categoria: 'Presenter',
            limite: 3,
        });
        expect(result).toContain('Nenhuma tática específica encontrada');
    });

    it('serializa resultados da base curada quando há matches', async () => {
        (conhecimentoCuradoService.buscar as jest.Mock).mockResolvedValueOnce([
            {
                titulo: 'Sentir-Sentiu-Descobriu',
                texto: 'Use prova social para reduzir objeção de preço.',
                contextoUso: 'Objeção de comissão',
                exemplo: 'Entendo, outros clientes também sentiram isso...',
            },
        ]);

        criarKnowledgeAgent();
        const callArgs = (Agent as unknown as jest.Mock).mock.calls[0][0];
        const tool = callArgs.tools[0];

        const result = await tool.execute({
            perguntaOuObjecao: 'Comissão está cara',
        });

        expect(conhecimentoCuradoService.buscar).toHaveBeenCalledWith({
            query: 'Comissão está cara',
            categoria: 'Captacao_Outbound',
            limite: 3,
        });

        expect(result).toContain('Sentir-Sentiu-Descobriu');
        expect(result).toContain('Objeção de comissão');
    });
});
