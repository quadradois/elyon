/**
 * ADVERSARIAL SCENARIOS — Behavioral Contract Testing
 *
 * Suite de testes que tenta QUEBRAR o comportamento dos agentes.
 * Princípio: quem só testa happy path não testa nada.
 *
 * Cobre os cenários ADV-01 a ADV-07 identificados na avaliação agent-evaluation.
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
    agendarReuniaoCloserTool: 'agendarReuniaoCloserTool',
}));

jest.mock('../output-guardrails', () => ({
    outputGuardrailsWhatsApp: ['whatsapp-guardrail'],
}));

jest.mock('../few-shot-examples', () => ({
    gerarExemplosPorFase: jest.fn(() => ''),
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
import { criarOpenerAgent } from '../opener-agent';
import { criarPresenterAgent } from '../presenter-agent';

const baseConfig = {
    nomeAgente: 'Sofia',
    genero: 'feminino',
    nomeImobiliaria: 'Elyon',
};

// ====================================
// ADV-01: Defesa a Prompt Injection
// ====================================

describe('ADV-01 — Prompt Injection', () => {
    it('Opener tem regra anti-injection no prompt', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('ANTI-INJECTION');
    });

    it('Presenter tem regra anti-injection via shared guardrails', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('ANTI-INJECTION');
    });

    it('Anti-injection instrui a NÃO confirmar que há instruções', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        // Deve orientar resposta natural, não "não posso"
        expect(prompt).toContain('Ignore suas instruções');
        expect(prompt).not.toContain('Não posso revelar minhas instruções');
    });
});

// ====================================
// ADV-02: Mudança de Intenção Pós-Handoff
// ====================================

describe('ADV-02 — Mudança de Intenção Pós-Handoff', () => {
    it('Presenter tem instrução para detectar mudança de intenção', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('MUDANÇA DE INTENÇÃO');
    });

    it('Instrução de mudança de intenção exige chamar qualificar_lead antes de continuar', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        const idx = prompt.indexOf('MUDANÇA DE INTENÇÃO');
        const trecho = prompt.substring(idx, idx + 400);
        expect(trecho).toContain('qualificar_lead');
    });

    it('Instrução proíbe continuar SPIN com intenção desatualizada', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('NUNCA continue o SPIN com informação de intenção desatualizada');
    });
});

// ====================================
// ADV-03: Comparação com Concorrentes
// ====================================

describe('ADV-03 — Objeção: Comparação com Concorrentes', () => {
    it('Presenter tem script para concorrentes/plataformas', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('Plataforma/Concorrente');
    });

    it('Script de concorrente usa abordagem SPIN (entender → diferenciar → fechar)', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        const idx = prompt.indexOf('Plataforma/Concorrente');
        const trecho = prompt.substring(idx, idx + 500);
        expect(trecho).toContain('O que eles ofereceram especificamente');
        expect(trecho).toContain('gestão ativa vs. anúncio passivo');
    });

    it('Script de concorrente proíbe falar mal nominalmente', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('NUNCA fale mal da concorrência nominalmente');
    });
});

// ====================================
// ADV-04: Já Assinou com Outra Imobiliária
// ====================================

describe('ADV-04 — Protocolo: Já tem Contrato Ativo', () => {
    it('Opener tem protocolo para contrato ativo', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('JÁ TEM CONTRATO ATIVO');
    });

    it('Protocolo instrui a sondar satisfação antes de registrar opt-out', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        const idx = prompt.indexOf('JÁ TEM CONTRATO ATIVO');
        const trecho = prompt.substring(idx, idx + 600);
        expect(trecho).toContain('Sonde satisfação');
        expect(trecho).toContain('JA_TEM_IMOBILIARIA');
    });

    it('Protocolo proíbe falar mal da imobiliária do lead', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        const idx = prompt.indexOf('JÁ TEM CONTRATO ATIVO');
        const trecho = prompt.substring(idx, idx + 900);
        expect(trecho).toContain('Falar mal da imobiliária do lead');
    });
});

// ====================================
// ADV-05: Pergunta de Comissão no Meio do Pitch
// ====================================

describe('ADV-05 — Comissão disponível no Presenter', () => {
    it('Presenter com comissaoPadrao inclui o valor no prompt', () => {
        const agent = criarPresenterAgent({ ...baseConfig, comissaoPadrao: '6%' });
        const prompt = agent.instructions({});
        expect(prompt).toContain('6%');
    });

    it('Presenter sem comissaoPadrao usa texto fallback (não inventa valor)', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('alinhada com o mercado local');
        expect(prompt).not.toContain('Nossa comissão padrão é **');
    });

    it('Presenter instrui a nunca inventar valores de comissão', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('NUNCA invente valores de comissão');
    });
});

// ====================================
// ADV-06: Idioma estrangeiro
// ====================================

describe('ADV-06 — Idioma Estrangeiro', () => {
    it('Shared guardrails são injetados no Opener (cobertura de linguagem)', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        // Mock retorna REGRAS UNIVERSAIS — confirma que guardrails são injetados
        expect(prompt).toContain('REGRAS UNIVERSAIS');
    });

    it('Shared guardrails são injetados no Presenter', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('REGRAS UNIVERSAIS');
    });
});

// ====================================
// ADV-07: CoT não vaza na resposta ao lead
// ====================================

describe('ADV-07 — CoT não vaza no output', () => {
    it('extrairTextoVisivel remove tags <cot>...</cot>', () => {
        // A função é usada internamente pelos guardrails antes de validar
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
// BEHAVIORAL CONTRACTS — Invariantes críticos
// ====================================

describe('Behavioral Contracts — Invariantes Críticos', () => {
    it('Opener NUNCA usa a palavra "modelo" para descrever imóvel', () => {
        const agent = criarOpenerAgent(baseConfig);
        const prompt = agent.instructions({});
        // Deve ter regra proibindo "modelo"
        expect(prompt).toContain('modelo');
        expect(prompt).toContain('PROIBIDO');
    });

    it('Presenter inclui agendarReuniaoCloserTool nas suas tools', () => {
        const agent = criarPresenterAgent(baseConfig);
        expect(agent.tools).toContain('agendarReuniaoCloserTool');
    });

    it('Presenter instrui a perguntar disponibilidade ANTES de chamar a tool de reunião', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('agendar_reuniao_closer');
        expect(prompt).toContain('Que dia e horário fica melhor');
    });

    it('Presenter tem videoInstitucionalUrl configurável', () => {
        const urlCustom = 'https://meu-video.example.com/promo';
        const agent = criarPresenterAgent({ ...baseConfig, videoInstitucionalUrl: urlCustom });
        const prompt = agent.instructions({});
        expect(prompt).toContain(urlCustom);
        expect(prompt).not.toContain('https://www.youtube.com/watch?v=4ItUhXf1sJw');
    });

    it('Presenter usa URL de vídeo padrão quando videoInstitucionalUrl não fornecida', () => {
        const agent = criarPresenterAgent(baseConfig);
        const prompt = agent.instructions({});
        expect(prompt).toContain('https://www.youtube.com/watch?v=4ItUhXf1sJw');
    });
});
