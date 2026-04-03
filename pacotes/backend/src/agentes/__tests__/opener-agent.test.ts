/**
 * Testes: opener-agent.ts
 *
 * Verifica:
 * - gerarPromptOpener: presença das 5 camadas estruturais
 * - gerarPromptOpener: presença do bloco PVAM no CoT
 * - gerarPromptOpener: presença da Handoff Trigger Matrix (via shared-behavioral-guardrails)
 * - Interface pública criarOpenerAgent não quebrou
 */

import { gerarPromptOpener, criarOpenerAgent } from '../opener-agent';

// ==========================================
// CONFIGURAÇÃO BASE
// ==========================================

const configBase = {
    nomeAgente: 'Ana',
    genero: 'feminino',
    nomeImobiliaria: 'Test Imobiliária',
    cidade: 'São Paulo',
    empreendimento: 'Residencial Teste',
};

// ==========================================
// CAMADAS DO PROMPT
// ==========================================

describe('gerarPromptOpener — 5 camadas estruturais', () => {
    let prompt: string;

    beforeAll(() => {
        prompt = gerarPromptOpener(configBase);
    });

    it('Camada 1: contém IDENTIDADE E PAPEL', () => {
        expect(prompt).toContain('IDENTIDADE E PAPEL');
        expect(prompt).toContain('PROSPECTOR');
    });

    it('Camada 2: contém REGRAS DO WHATSAPP', () => {
        expect(prompt).toContain('REGRAS DO WHATSAPP');
        expect(prompt).toContain('UMA PERGUNTA POR MENSAGEM');
    });

    it('Camada 3: contém CONTEXTO DINÂMICO com briefing e tools', () => {
        expect(prompt).toContain('CONTEXTO DINÂMICO');
        expect(prompt).toContain('Briefing do Empreendimento');
        expect(prompt).toContain('converter_para_lead');
    });

    it('Camada 4: contém RACIOCÍNIO INTERNO E TAREFA', () => {
        expect(prompt).toContain('RACIOCÍNIO INTERNO E TAREFA');
        expect(prompt).toContain('<cot>');
    });

    it('Camada 5: contém PROTOCOLOS E GUARDRAILS', () => {
        expect(prompt).toContain('PROTOCOLOS E GUARDRAILS');
        expect(prompt).toContain('Protocolo de Desconfiança');
        expect(prompt).toContain('Protocolo de Recuo');
        expect(prompt).toContain('Protocolo de Indicação');
    });
});

// ==========================================
// PVAM NO CoT
// ==========================================

describe('gerarPromptOpener — PVAM por inferência no CoT', () => {
    let prompt: string;

    beforeAll(() => {
        prompt = gerarPromptOpener(configBase);
    });

    it('contém bloco PVAM inferido', () => {
        expect(prompt).toContain('PVAM inferido');
    });

    it('contém as 4 dimensões P V A M', () => {
        expect(prompt).toContain('P (Preço)');
        expect(prompt).toContain('V (Veto)');
        expect(prompt).toContain('A (Ativador)');
        expect(prompt).toContain('M (Momento)');
    });

    it('contém a regra de decisão PVAM', () => {
        expect(prompt).toContain('Decisão PVAM');
        expect(prompt).toContain('A (Ativador) + M (Momento)');
    });

    it('exemplos do CoT demonstram uso do PVAM', () => {
        // Os exemplos few-shot devem mostrar PVAM preenchido
        expect(prompt).toContain('PVAM inferido: P=');
    });
});

// ==========================================
// INTERPOLAÇÃO DO CONFIG
// ==========================================

describe('gerarPromptOpener — interpolação dinâmica do config', () => {
    it('injeta o nome do agente', () => {
        const prompt = gerarPromptOpener(configBase);
        expect(prompt).toContain('Ana');
    });

    it('injeta o nome da imobiliária', () => {
        const prompt = gerarPromptOpener(configBase);
        expect(prompt).toContain('Test Imobiliária');
    });

    it('injeta a cidade quando fornecida', () => {
        const prompt = gerarPromptOpener(configBase);
        expect(prompt).toContain('São Paulo');
    });

    it('injeta o empreendimento quando fornecido', () => {
        const prompt = gerarPromptOpener(configBase);
        expect(prompt).toContain('Residencial Teste');
    });

    it('funciona sem cidade ou empreendimento', () => {
        const prompt = gerarPromptOpener({
            nomeAgente: 'Bia',
            genero: 'feminino',
            nomeImobiliaria: 'Minha Imob',
        });
        expect(prompt).toContain('IDENTIDADE E PAPEL');
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(500);
    });
});

// ==========================================
// HANDOFF TRIGGER MATRIX (via shared-behavioral-guardrails)
// ==========================================

describe('gerarPromptOpener — inclui Handoff Trigger Matrix', () => {
    let prompt: string;

    beforeAll(() => {
        const { getSharedBehavioralRules } = require('../shared-behavioral-guardrails');
        prompt = gerarPromptOpener(configBase) + getSharedBehavioralRules();
    });

    it('contém seção HANDOFF TRIGGER MATRIX', () => {
        expect(prompt).toContain('HANDOFF TRIGGER MATRIX');
    });

    it('matrix referencia gatilhos PVAM-M e PVAM-A', () => {
        expect(prompt).toContain('PVAM-M');
        expect(prompt).toContain('PVAM-A');
    });

    it('matrix inclui registrar_optout como ação', () => {
        expect(prompt).toContain('registrar_optout');
    });
});

// ==========================================
// INTERFACE PÚBLICA
// ==========================================

describe('criarOpenerAgent — interface pública inalterada', () => {
    it('retorna um objeto (Agent) sem lançar erros', () => {
        // Mock mínimo para evitar dependências externas
        jest.mock('../elyon-context', () => ({
            criarModeloBYOK: jest.fn().mockReturnValue('mock-model'),
        }));

        let agentObj: any;
        expect(() => {
            agentObj = criarOpenerAgent({
                nomeAgente: 'Ana',
                nomeImobiliaria: 'Imob Teste',
            });
        }).not.toThrow();
    });

    it('aceita config sem campos opcionais', () => {
        expect(() => {
            criarOpenerAgent({
                nomeAgente: 'Carlos',
                nomeImobiliaria: 'Construtora X',
            });
        }).not.toThrow();
    });
});
