/**
 * Testes: opener-agent.ts, presenter-agent.ts, admin-agent.ts
 *
 * Cobre a criação dos agentes SDK:
 * - criarOpenerAgent: retorno Agent com nome, tools, guardrails
 * - criarPresenterAgent: idem + diferenciais
 * - criarAdminAgent: idem + resultType (structured output)
 */

// Mocks de dependências pesadas
jest.mock('@openai/agents', () => {
    return {
        Agent: jest.fn().mockImplementation((cfg: any) => ({
            name: cfg.name,
            model: cfg.model,
            instructions: cfg.instructions,
            tools: cfg.tools || [],
            handoffs: cfg.handoffs || [],
            resultType: cfg.resultType,
            outputGuardrails: cfg.outputGuardrails,
            on: jest.fn(),
        })),
        tool: jest.fn((schema: any, fn: any) => fn),
        handoff: jest.fn(),
    };
});

jest.mock('../elyon-context', () => ({
    ElyonContext: jest.fn(),
    criarModeloBYOK: jest.fn((_cfg: any, fallback: string) => fallback),
}));

jest.mock('../../ferramentas/sdr-tools-agents', () => ({
    converterParaLeadTool: 'converterParaLeadTool',
    qualificarLeadTool: 'qualificarLeadTool',
    registrarOptoutTool: 'registrarOptoutTool',
    agendarFollowupTool: 'agendarFollowupTool',
    moverParaFaseTool: 'moverParaFaseTool',
    registrarIndicacaoTool: 'registrarIndicacaoTool',
    atualizarDadosLeadTool: 'atualizarDadosLeadTool',
    agendarAvaliacaoTool: 'agendarAvaliacaoTool',
    agendarReuniaoCloserTool: 'agendarReuniaoCloserTool',
    encaminharCorretorTool: 'encaminharCorretorTool',
    gerarLinkContratoTool: 'gerarLinkContratoTool',
    salvarDadosImovelTool: 'salvarDadosImovelTool',
    enviarParaCrmTool: 'enviarParaCrmTool',
}));


jest.mock('../output-guardrails', () => ({
    outputGuardrailsWhatsApp: ['whatsapp-guardrail'],
}));

jest.mock('../few-shot-examples', () => ({
    gerarExemplosPorFase: jest.fn(() => ''),
}));

jest.mock('../shared-behavioral-guardrails', () => ({
    getSharedBehavioralRules: jest.fn(() => '\n# REGRAS COMPARTILHADAS'),
}));

import { criarOpenerAgent } from '../opener-agent';
import { criarPresenterAgent } from '../presenter-agent';
import { criarAdminAgent } from '../admin-agent';
import { criarModeloBYOK } from '../elyon-context';

const baseConfig = {
    nomeAgente: 'Sofia',
    genero: 'feminino',
    nomeImobiliaria: 'Imob Teste',
};

// ====================================
// OPENER AGENT
// ====================================

describe('criarOpenerAgent', () => {
    it('cria agente com nome opener_agent_v11', () => {
        const agent = criarOpenerAgent(baseConfig);
        expect(agent.name).toBe('opener_agent_v11');
    });

    it('usa criarModeloBYOK para o modelo', () => {
        criarOpenerAgent(baseConfig);
        expect(criarModeloBYOK).toHaveBeenCalledWith(baseConfig, 'gpt-4.1');
    });

    it('inclui tools core do SDR', () => {
        const agent = criarOpenerAgent(baseConfig);
        expect(agent.tools).toContain('converterParaLeadTool');
        expect(agent.tools).toContain('qualificarLeadTool');
        expect(agent.tools).toContain('registrarOptoutTool');
        expect(agent.tools).toContain('agendarFollowupTool');
        expect(agent.tools).toContain('moverParaFaseTool');
        expect(agent.tools).toContain('registrarIndicacaoTool');
    });

    it('inclui tools extras quando passados', () => {
        const customTool = 'meuToolCustom';
        const agent = criarOpenerAgent({ ...baseConfig, tools: [customTool] });
        expect(agent.tools).toContain(customTool);
    });

    it('aplica output guardrails WhatsApp', () => {
        const agent = criarOpenerAgent(baseConfig);
        expect(agent.outputGuardrails).toBeDefined();
    });

    it('gera instructions com cidade e empreendimento', () => {
        const agent = criarOpenerAgent({
            ...baseConfig,
            cidade: 'São Paulo',
            empreendimento: 'Ed. Solar',
        });
        // instructions é uma função
        const prompt = agent.instructions({});
        expect(prompt).toContain('Sofia');
        expect(prompt).toContain('Imob Teste');
        expect(prompt).toContain('São Paulo');
        expect(prompt).toContain('Ed. Solar');
    });

    it('inclui contexto ultimaInteracao quando presente', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({ ultimaInteracao: 'Lead respondeu ontem' });
        expect(prompt).toContain('Lead respondeu ontem');
    });

    it('inclui regras comportamentais compartilhadas', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('REGRAS COMPARTILHADAS');
    });

    it('passa BYOK config para criarModeloBYOK', () => {
        criarOpenerAgent({
            ...baseConfig,
            model: 'deepseek-chat',
            apiKey: 'sk-custom',
            baseUrl: 'https://api.deepseek.com/v1',
        });
        expect(criarModeloBYOK).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'deepseek-chat',
                apiKey: 'sk-custom',
                baseUrl: 'https://api.deepseek.com/v1',
            }),
            'gpt-4.1',
        );
    });
});

// ====================================
// PRESENTER AGENT
// ====================================

describe('criarPresenterAgent', () => {
    it('cria agente com nome presenter_agent_v4', () => {
        const agent = criarPresenterAgent(baseConfig);
        expect(agent.name).toBe('presenter_agent_v4');
    });

    it('usa gpt-4.1 como modelo padrão', () => {
        criarPresenterAgent(baseConfig);
        expect(criarModeloBYOK).toHaveBeenCalledWith(baseConfig, 'gpt-4.1');
    });

    it('inclui tools de diagnóstico', () => {
        const agent = criarPresenterAgent(baseConfig);
        expect(agent.tools).toContain('moverParaFaseTool');
        expect(agent.tools).toContain('agendarFollowupTool');
        expect(agent.tools).toContain('qualificarLeadTool');
        expect(agent.tools).toContain('atualizarDadosLeadTool');
    });

    it('gera prompt com diferenciais quando fornecidos', () => {
        const agent = criarPresenterAgent({
            ...baseConfig,
            diferenciais: ['Tour 360', 'Rede de Parceiros'],
        });
        const prompt = agent.instructions({});
        expect(prompt).toContain('Tour 360');
        expect(prompt).toContain('Rede de Parceiros');
    });

    it('gera prompt sem diferenciais quando não fornecidos', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('Sofia');
        expect(prompt).toContain('Imob Teste');
    });

    it('aplica output guardrails WhatsApp', () => {
        const agent = criarPresenterAgent(baseConfig);
        expect(agent.outputGuardrails).toBeDefined();
    });

    it('inclui comissaoPadrao no prompt quando fornecida (ADV-05)', () => {
        const agent = criarPresenterAgent({ ...baseConfig, comissaoPadrao: '5%' });
        const prompt = agent.instructions({});
        expect(prompt).toContain('5%');
    });

    it('usa texto fallback de comissão quando comissaoPadrao não fornecida (ADV-05)', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('alinhada com o mercado local');
    });

    it('usa videoInstitucionalUrl customizada quando fornecida (Q3)', () => {
        const agent = criarPresenterAgent({ ...baseConfig, videoInstitucionalUrl: 'https://custom.video/link' });
        const prompt = agent.instructions({});
        expect(prompt).toContain('https://custom.video/link');
    });

    it('usa URL de vídeo padrão quando videoInstitucionalUrl não fornecida (Q3)', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('https://www.youtube.com/watch?v=4ItUhXf1sJw');
    });

    it('inclui agendarReuniaoCloserTool nas tools (C1)', () => {
        const agent = criarPresenterAgent(baseConfig);
        expect(agent.tools).toContain('agendarReuniaoCloserTool');
    });
});

// ====================================
// ADMIN AGENT
// ====================================

describe('criarAdminAgent', () => {
    it('cria agente com nome admin_agent_v4', () => {
        const agent = criarAdminAgent(baseConfig);
        expect(agent.name).toBe('admin_agent_v4');
    });

    it('usa gpt-4.1-mini como modelo padrão', () => {
        criarAdminAgent(baseConfig);
        expect(criarModeloBYOK).toHaveBeenCalledWith(baseConfig, 'gpt-4.1-mini');
    });

    it('usa resultType (Structured Output)', () => {
        const agent = criarAdminAgent(baseConfig);
        expect(agent.resultType).toBeDefined();
    });

    it('inclui tools administrativas', () => {
        const agent = criarAdminAgent(baseConfig);
        expect(agent.tools).toContain('moverParaFaseTool');
        expect(agent.tools).toContain('agendarAvaliacaoTool');
        expect(agent.tools).toContain('encaminharCorretorTool');
        expect(agent.tools).toContain('gerarLinkContratoTool');
        expect(agent.tools).toContain('salvarDadosImovelTool');
        expect(agent.tools).toContain('enviarParaCrmTool');
    });

    it('gera prompt com dados de contrato', () => {
        const agent = criarAdminAgent({
            ...baseConfig,
            tipoAutorizacao: 'exclusiva',
            comissaoAcordada: '6%',
            prazoTrabalho: 90,
        });
        const prompt = agent.instructions({});
        expect(prompt).toContain('AUTORIZAÇÃO EXCLUSIVA');
        expect(prompt).toContain('90 dias');
        expect(prompt).toContain('6%');
    });

    it('não tem outputGuardrails (incompatível com resultType)', () => {
        const agent = criarAdminAgent(baseConfig);
        // Admin não usa outputGuardrails por ser Structured Output
        expect(agent.outputGuardrails).toBeUndefined();
    });

    it('inclui instrução de saída estruturada no prompt', () => {
        const agent = criarAdminAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('respostaParaOCliente');
        expect(prompt).toContain('dadosColetados');
    });
});
