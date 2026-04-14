/**
 * Testes: sdr-agent.ts, admin-agent.ts
 *
 * Cobre a criação dos agentes SDK:
 * - criarSdrAgent: retorno Agent com nome, tools, resultType (structured output)
 * - criarAdminAgent: idem + resultType (structured output)
 *
 * Migrado de opener+presenter para SDR unificado em 11/04/2026.
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
    criarModeloBYOK: jest.fn((_cfg: any, fallback?: string) => fallback || 'modelo-mock-default'),
}));

jest.mock('../byok-resolver', () => ({
    MODELO_PADRAO_AUXILIAR: 'gpt-4.1-mini',
    MODELO_PADRAO_PRINCIPAL: 'gpt-4.1',
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
    enviarLinkAgendamentoTool: 'enviarLinkAgendamentoTool',
}));

jest.mock('../../ferramentas/consultar-preco-mercado', () => ({
    consultarPrecoMercadoTool: 'consultarPrecoMercadoTool',
}));

jest.mock('../../ferramentas/ler-skill-tool', () => ({
    lerSkillTool: 'lerSkillTool',
}));

jest.mock('../shared-behavioral-guardrails', () => ({
    getSharedBehavioralRules: jest.fn(() => '\n# REGRAS COMPARTILHADAS'),
}));

import { criarSdrAgent as _criarSdrAgent } from '../sdr-agent';
import { criarAdminAgent as _criarAdminAgent } from '../admin-agent';
import { criarModeloBYOK } from '../elyon-context';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const criarSdrAgent: (...args: Parameters<typeof _criarSdrAgent>) => any = _criarSdrAgent;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const criarAdminAgent: (...args: Parameters<typeof _criarAdminAgent>) => any = _criarAdminAgent;

const baseConfig = {
    nomeAgente: 'Sofia',
    genero: 'feminino',
    nomeImobiliaria: 'Imob Teste',
};

// ====================================
// SDR AGENT (unificação Opener + Presenter)
// ====================================

describe('criarSdrAgent', () => {
    it('cria agente com nome sdr_agent_v1', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.name).toBe('sdr_agent_v1');
    });

    it('usa criarModeloBYOK para o modelo', () => {
        criarSdrAgent(baseConfig);
        expect(criarModeloBYOK).toHaveBeenCalledWith(baseConfig);
    });

    it('inclui todas as 11 tools do SDR unificado', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.tools).toContain('converterParaLeadTool');
        expect(agent.tools).toContain('qualificarLeadTool');
        expect(agent.tools).toContain('registrarOptoutTool');
        expect(agent.tools).toContain('agendarFollowupTool');
        expect(agent.tools).toContain('moverParaFaseTool');
        expect(agent.tools).toContain('registrarIndicacaoTool');
        expect(agent.tools).toContain('atualizarDadosLeadTool');
        expect(agent.tools).toContain('agendarReuniaoCloserTool');
        expect(agent.tools).toContain('enviarLinkAgendamentoTool');
        expect(agent.tools).toContain('consultarPrecoMercadoTool');
        expect(agent.tools).toContain('lerSkillTool');
    });

    it('NÃO inclui agendarAvaliacaoTool (agendamento unificado via agendar_reuniao_closer)', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.tools).not.toContain('agendarAvaliacaoTool');
    });

    it('inclui tools extras quando passados', () => {
        const customTool = 'meuToolCustom' as any;
        const agent = criarSdrAgent({ ...baseConfig, tools: [customTool] });
        expect(agent.tools).toContain(customTool);
    });

    it('usa resultType (Structured Output) em vez de outputGuardrails', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.resultType).toBeDefined();
        expect(agent.outputGuardrails).toBeUndefined();
    });

    it('gera instructions com cidade e empreendimento', () => {
        const agent = criarSdrAgent({
            ...baseConfig,
            cidade: 'São Paulo',
            empreendimento: 'Ed. Solar',
        });
        const prompt = agent.instructions({});
        expect(prompt).toContain('Sofia');
        expect(prompt).toContain('Imob Teste');
        expect(prompt).toContain('São Paulo');
        expect(prompt).toContain('Ed. Solar');
    });

    it('inclui contexto ultimaInteracao quando presente', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({ context: { ultimaInteracao: 'Lead respondeu ontem' } });
        expect(prompt).toContain('Lead respondeu ontem');
    });

    it('inclui instrução de saída estruturada no prompt do SDR', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('respostaParaOCliente');
        expect(prompt).toContain('pvam');
        expect(prompt).toContain('spin');
    });

    it('inclui regras comportamentais compartilhadas', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('REGRAS COMPARTILHADAS');
    });

    it('passa BYOK config para criarModeloBYOK', () => {
        criarSdrAgent({
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
        );
    });

    it('inclui regra de comissão quando fornecida', () => {
        const agent = criarSdrAgent({ ...baseConfig, comissaoPadrao: '5%' });
        const prompt = agent.instructions({});
        expect(prompt).toContain('5%');
    });

    it('SDR sem comissaoPadrao usa texto fallback', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('Comissão padrão do mercado');
    });

    it('gera prompt com diferenciais quando fornecidos', () => {
        const agent = criarSdrAgent({
            ...baseConfig,
            diferenciais: ['Tour 360', 'Rede de Parceiros'],
        });
        const prompt = agent.instructions({});
        expect(prompt).toContain('Tour 360');
        expect(prompt).toContain('Rede de Parceiros');
    });

    it('prompt contém as 5 camadas estruturais', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('CAMADA 1');
        expect(prompt).toContain('CAMADA 2');
        expect(prompt).toContain('CAMADA 3');
        expect(prompt).toContain('CAMADA 4');
        expect(prompt).toContain('CAMADA 5');
    });

    it('prompt contém CoT com PVAM e SPIN', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('<cot>');
        expect(prompt).toContain('PVAM');
        expect(prompt).toContain('SPIN');
    });

    it('prompt contém regras de progressão de fase', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('MEIO_CAMPO');
        expect(prompt).toContain('DESCOBERTA');
        expect(prompt).toContain('DIAGNOSTICO_SPIN');
        expect(prompt).toContain('PITCH');
        expect(prompt).toContain('AGENDAMENTO');
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

    it('usa modelo auxiliar BYOK como padrão', () => {
        criarAdminAgent(baseConfig);
        expect(criarModeloBYOK).toHaveBeenCalledWith(baseConfig, 'gpt-4.1-mini');
    });

    it('usa resultType (Structured Output)', () => {
        const agent = criarAdminAgent(baseConfig);
        expect(agent.resultType).toBeDefined();
    });

    it('inclui tools administrativas (sem agendamento)', () => {
        const agent = criarAdminAgent(baseConfig);
        expect(agent.tools).toContain('moverParaFaseTool');
        expect(agent.tools).toContain('encaminharCorretorTool');
        expect(agent.tools).toContain('gerarLinkContratoTool');
        expect(agent.tools).toContain('salvarDadosImovelTool');
        expect(agent.tools).toContain('enviarParaCrmTool');
        expect(agent.tools).not.toContain('agendarAvaliacaoTool');
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
        expect(agent.outputGuardrails).toBeUndefined();
    });

    it('inclui instrução de saída estruturada no prompt', () => {
        const agent = criarAdminAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('respostaParaOCliente');
        expect(prompt).toContain('dadosColetados');
    });
});
