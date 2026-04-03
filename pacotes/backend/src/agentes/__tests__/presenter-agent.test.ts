/**
 * Testes: presenter-agent.ts
 *
 * Verifica:
 * - gerarPromptPresenter: presença das 5 camadas estruturais
 * - gerarPromptPresenter: presença do bloco SPIN Progress no CoT
 * - gerarPromptPresenter: presença da Close & Escalation Trigger Matrix
 * - Interface pública criarPresenterAgent não quebrou
 */

import { gerarPromptPresenter, criarPresenterAgent } from '../presenter-agent';

const configBase = {
    nomeAgente: 'Bruno',
    genero: 'masculino',
    nomeImobiliaria: 'Test Imobiliária Premium',
    diferenciais: ['Fotos profissionais', 'Drone'],
    comissaoPadrao: '6% sobre a venda',
    videoInstitucionalUrl: 'https://youtube.com/test'
};

describe('gerarPromptPresenter — 5 camadas estruturais', () => {
    let prompt: string;

    beforeAll(() => {
        prompt = gerarPromptPresenter(configBase);
    });

    it('Camada 1: contém IDENTIDADE E MISSÃO REAL', () => {
        expect(prompt).toContain('IDENTIDADE E MISSÃO REAL');
        expect(prompt).toContain('Test Imobiliária Premium');
        expect(prompt).toContain('consultor investigativo');
    });

    it('Camada 2: contém REGRAS DO WHATSAPP', () => {
        expect(prompt).toContain('REGRAS DO WHATSAPP');
        expect(prompt).toContain('UMA PERGUNTA POR MENSAGEM');
    });

    it('Camada 3: contém CONTEXTO DINÂMICO E DADOS OBRIGATÓRIOS', () => {
        expect(prompt).toContain('CONTEXTO DINÂMICO E DADOS OBRIGATÓRIOS');
        expect(prompt).toContain('qualificar_lead');
    });

    it('Camada 4: contém RACIOCÍNIO E TAREFA (SPIN PROGRESS)', () => {
        expect(prompt).toContain('RACIOCÍNIO E TAREFA (SPIN PROGRESS)');
        expect(prompt).toContain('<cot>');
        expect(prompt).toContain('ETAPA DE PITCH (A APRESENTAÇÃO)');
    });

    it('Camada 5: contém CLOSE & ESCALATION TRIGGER MATRIX', () => {
        expect(prompt).toContain('CLOSE & ESCALATION TRIGGER MATRIX');
        expect(prompt).toContain('| Ação / Sinal do Lead | Ação e Reação Matemática do Agente |');
    });
});

describe('gerarPromptPresenter — SPIN Progress e Matrix', () => {
    let prompt: string;

    beforeAll(() => {
        prompt = gerarPromptPresenter(configBase);
    });

    it('contém bloco Inferência SPIN Progress', () => {
        expect(prompt).toContain('Inferência SPIN Progress');
        expect(prompt).toContain('Dor Financeira (I - Implicação)');
        expect(prompt).toContain('Necessidade de Gestão (N)');
        expect(prompt).toContain('Sinal de Compra');
    });

    it('Matrix orienta mover_para_fase("FASE3")', () => {
        expect(prompt).toContain('mover_para_fase("FASE3")');
    });
});

describe('gerarPromptPresenter — Interpolação de Configuração', () => {
    it('Lida com variações de Proprietário Ativo vs Passivo', () => {
        const ativo = gerarPromptPresenter({ ...configBase, proprietarioAtivo: true });
        expect(ativo).toContain('TRILHA A — PROPRIETÁRIO ATIVO');

        const passivo = gerarPromptPresenter({ ...configBase, proprietarioAtivo: false });
        expect(passivo).toContain('TRILHA B — PROPRIETÁRIO PASSIVO/VIRGEM');

        const desconhecido = gerarPromptPresenter({ ...configBase });
        expect(desconhecido).toContain('TRILHA C — DESCONHECIDA');
    });

    it('Insere comissão e link do vídeo', () => {
        const prompt = gerarPromptPresenter(configBase);
        expect(prompt).toContain('6% sobre a venda');
        expect(prompt).toContain('https://youtube.com/test');
    });
});

describe('criarPresenterAgent — interface pública', () => {
    it('retorna um objeto (Agent) compatível', () => {
        // Mock rápido da criação do modelo e tools
        jest.mock('../elyon-context', () => ({
            criarModeloBYOK: jest.fn().mockReturnValue('mock-model'),
        }));

        expect(() => {
            criarPresenterAgent({
                nomeAgente: 'Bruno',
                nomeImobiliaria: 'Test',
            });
        }).not.toThrow();
    });
});
