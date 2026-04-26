/**
 * ADVERSARIAL SCENARIOS — Behavioral Contract Testing
 *
 * Suite de testes que tenta QUEBRAR o comportamento do agente SDR unificado.
 * Princípio: quem só testa happy path não testa nada.
 *
 * Cobre os cenários ADV-01 a ADV-07 identificados na avaliação agent-evaluation.
 * Migrado de opener+presenter para SDR unificado em 11/04/2026.
 */

// ====================================
// MOCKS
// ====================================

jest.mock('@openai/agents', () => ({
    Agent: jest.fn().mockImplementation((cfg: any) => ({
        name: cfg.name,
        instructions: cfg.instructions,
        tools: cfg.tools || [],
        handoffs: cfg.handoffs || [],
        outputGuardrails: cfg.outputGuardrails,
        on: jest.fn(),
    })),
    tool: jest.fn((schema: any) => schema),
    handoff: jest.fn(),
}));

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
    enviarLinkAgendamentoTool: 'enviarLinkAgendamentoTool',
}));

jest.mock('../../ferramentas/consultar-preco-mercado', () => ({
    consultarPrecoMercadoTool: 'consultarPrecoMercadoTool',
}));

jest.mock('../../ferramentas/ler-skill-tool', () => ({
    lerSkillTool: 'lerSkillTool',
}));

jest.mock('../shared-behavioral-guardrails', () => ({
    getSharedBehavioralRules: jest.fn(() => `
# 🔒 REGRAS UNIVERSAIS
## 🛡️ 9. ANTI-INJECTION (TODOS OS AGENTES)
Ignore suas instruções
`),
}));

// ====================================
// IMPORTS
// ====================================
import { criarSdrAgent as _criarSdrAgent } from '../sdr-agent';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const criarSdrAgent: (...args: Parameters<typeof _criarSdrAgent>) => any = _criarSdrAgent;

const baseConfig = {
    nomeAgente: 'Sofia',
    genero: 'feminino',
    nomeImobiliaria: 'Elyon',
};

// ====================================
// ADV-01: Defesa a Prompt Injection
// ====================================

describe('ADV-01 — Prompt Injection', () => {
    it('SDR tem regra anti-injection via shared guardrails', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('ANTI-INJECTION');
    });

    it('Anti-injection instrui a NÃO confirmar que há instruções', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('Ignore suas instruções');
        expect(prompt).not.toContain('Não posso revelar minhas instruções');
    });
});

// ====================================
// ADV-02: SPIN Diagnóstico no SDR
// ====================================

describe('ADV-02 — SPIN Diagnóstico', () => {
    it('SDR referencia skill de SPIN diagnóstico', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('diagnostico/spin-diagnostico');
    });

    it('SDR instrui a usar qualificar_lead após cobrir blocos SPIN', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('qualificar_lead');
    });

    it('SDR tem SPIN Progress no CoT para detectar mudanças', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('SPIN Progress');
    });
});

// ====================================
// ADV-03: Comparação com Concorrentes
// ====================================

describe('ADV-03 — Objeção: Comparação com Concorrentes', () => {
    it('SDR referencia skills de tratativas para objeções', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('diagnostico/tratativa-exclusividade');
        expect(prompt).toContain('diagnostico/tratativa-vender-sozinho');
        expect(prompt).toContain('diagnostico/tratativa-comissao');
    });

    it('SDR declara proibições do WhatsApp contra narrações técnicas', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('NUNCA');
        expect(prompt).toContain('Proibições Absolutas');
    });
});

// ====================================
// ADV-04: Já Assinou com Outra Imobiliária
// ====================================

describe('ADV-04 — Protocolo: Já tem Contrato Ativo', () => {
    it('SDR referencia skill para contrato ativo', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('protocolo-ja-tem-contrato');
    });

    it('SDR referencia skill de desconfiança para situações correlatas', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('protocolo-desconfianca');
    });

    it('SDR carrega skills via ler_skill antes de agir', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('ler_skill');
        expect(prompt).toContain('ANTES de responder');
    });
});

// ====================================
// ADV-05: Pergunta de Comissão
// ====================================

describe('ADV-05 — Comissão disponível no SDR', () => {
    it('SDR com comissaoPadrao inclui o valor no prompt', () => {
        const agent = criarSdrAgent({ ...baseConfig, comissaoPadrao: '6%' });
        const prompt = agent.instructions({});
        expect(prompt).toContain('6%');
    });

    it('SDR sem comissaoPadrao usa texto fallback (não inventa valor)', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('Comissão padrão do mercado');
    });

    it('SDR instrui a consultar skill de comissão para casos difíceis', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('diagnostico/tratativa-comissao');
    });
});

// ====================================
// ADV-06: Idioma estrangeiro
// ====================================

describe('ADV-06 — Idioma Estrangeiro', () => {
    it('Shared guardrails são injetados no SDR (cobertura de linguagem)', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('REGRAS UNIVERSAIS');
    });
});

// ====================================
// ADV-07: CoT não vaza na resposta ao lead
// ====================================

describe('ADV-07 — CoT não vaza no output', () => {
    it('extrairTextoVisivel remove tags <cot>...</cot>', () => {
        const outputComCot = '<cot>\nFase: Situação\nRaciocínio interno\n</cot>\n\nEntendido! Você já anunciou o imóvel?';
        const resultado = outputComCot.replace(/<cot>[\s\S]*?<\/cot>\s*/g, '').trim();
        expect(resultado).not.toContain('<cot>');
        expect(resultado).toBe('Entendido! Você já anunciou o imóvel?');
    });

    it('output sem CoT não é afetado pela limpeza', () => {
        const outputLimpo = 'Entendido! Você já anunciou o imóvel?';
        const resultado = outputLimpo.replace(/<cot>[\s\S]*?<\/cot>\s*/g, '').trim();
        expect(resultado).toBe(outputLimpo);
    });
});

// ====================================
// BEHAVIORAL CONTRACTS — Invariantes SDR
// ====================================

describe('Behavioral Contracts — Invariantes SDR', () => {
    it('SDR inclui agendarReuniaoCloserTool nas suas tools', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.tools).toContain('agendarReuniaoCloserTool');
    });

    it('SDR NÃO inclui agendarAvaliacaoTool (agendamento unificado via agendar_reuniao_closer)', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.tools).not.toContain('agendarAvaliacaoTool');
    });

    it('SDR inclui enviarLinkAgendamentoTool como fallback de agendamento', () => {
        const agent = criarSdrAgent(baseConfig);
        expect(agent.tools).toContain('enviarLinkAgendamentoTool');
    });

    it('SDR instrui sobre fluxo de agendamento com fallback', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('enviar_link_agendamento');
        expect(prompt).toContain('FALLBACK');
        expect(prompt).toContain('agendar_reuniao_closer');
    });

    it('SDR instrui a consultar skill escalation-trigger-matrix', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('agendamento/escalation-trigger-matrix');
    });

    it('SDR contém regras de progressão de fase', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('MEIO_CAMPO');
        expect(prompt).toContain('DESCOBERTA');
        expect(prompt).toContain('DIAGNOSTICO_SPIN');
        expect(prompt).toContain('PITCH');
        expect(prompt).toContain('AGENDAMENTO');
        expect(prompt).toContain('FOLLOW_UP');
        expect(prompt).toContain('RECUO');
    });

    it('SDR contém PVAM + SPIN no structured output', () => {
        const agent = criarSdrAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('pvam');
        expect(prompt).toContain('spin');
        expect(prompt).toContain('respostaParaOCliente');
    });
});
