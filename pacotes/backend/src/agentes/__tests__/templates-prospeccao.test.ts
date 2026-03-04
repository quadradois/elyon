/**
 * Testes: templates-prospeccao.ts
 *
 * Cobre:
 * - substituirVariaveis: substituição com e sem variáveis
 * - gerarPrimeiraMensagem: 3 tipos de template
 * - gerarFollowUp: tentativas 1 e 2
 * - TODOS_TEMPLATES: estrutura
 * - Constantes de templates individuais
 */

import {
    substituirVariaveis,
    gerarPrimeiraMensagem,
    gerarFollowUp,
    TODOS_TEMPLATES,
    PRIMEIRA_MENSAGEM_STORYTELLING,
    PRIMEIRA_MENSAGEM_DIRETA,
    PRIMEIRA_MENSAGEM_ESCASSEZ,
    FOLLOWUP_1,
    FOLLOWUP_2,
    VariaveisTemplate,
} from '../templates-prospeccao';

const variaveis: VariaveisTemplate = {
    nome: 'João',
    agente: 'Sofia',
    empreendimento: 'Ed. Solar',
    bairro: 'Barra da Tijuca',
    imobiliaria: 'Imob Teste',
};

// ====================================
// substituirVariaveis
// ====================================

describe('substituirVariaveis', () => {
    it('substitui {nome} pelo valor', () => {
        const result = substituirVariaveis('Olá {nome}!', { nome: 'Maria' });
        expect(result).toBe('Olá Maria!');
    });

    it('substitui múltiplas variáveis', () => {
        const result = substituirVariaveis(
            'Sou {agente} da {imobiliaria}',
            { agente: 'Lia', imobiliaria: 'XYZ' }
        );
        expect(result).toBe('Sou Lia da XYZ');
    });

    it('substitui múltiplas ocorrências da mesma variável', () => {
        const result = substituirVariaveis('{nome} e {nome}', { nome: 'Ana' });
        expect(result).toBe('Ana e Ana');
    });

    it('ignora variáveis com valor undefined', () => {
        const result = substituirVariaveis('Olá {nome}!', { nome: undefined } as any);
        expect(result).toBe('Olá {nome}!');
    });

    it('mantém texto sem variáveis intacto', () => {
        const result = substituirVariaveis('Sem variáveis aqui', {});
        expect(result).toBe('Sem variáveis aqui');
    });
});

// ====================================
// gerarPrimeiraMensagem
// ====================================

describe('gerarPrimeiraMensagem', () => {
    it('gera mensagem storytelling (default)', () => {
        const msg = gerarPrimeiraMensagem(variaveis);
        expect(msg).toContain('João');
        expect(msg).toContain('Sofia');
        expect(msg).toContain('Ed. Solar');
        expect(msg).toContain('Imob Teste');
    });

    it('gera mensagem direta', () => {
        const msg = gerarPrimeiraMensagem(variaveis, 'direta');
        expect(msg).toContain('João');
        expect(msg).toContain('clientes procurando');
    });

    it('gera mensagem escassez', () => {
        const msg = gerarPrimeiraMensagem(variaveis, 'escassez');
        expect(msg).toContain('João');
        expect(msg).toContain('avaliação gratuita');
    });

    it('storytelling é o default quando tipo não especificado', () => {
        const msgDefault = gerarPrimeiraMensagem(variaveis);
        const msgStory = gerarPrimeiraMensagem(variaveis, 'storytelling');
        expect(msgDefault).toBe(msgStory);
    });
});

// ====================================
// gerarFollowUp
// ====================================

describe('gerarFollowUp', () => {
    it('gera follow-up tentativa 1', () => {
        const msg = gerarFollowUp(variaveis, 1);
        expect(msg).toContain('João');
        expect(msg).toContain('Ed. Solar');
        expect(msg).toContain('mensagem');
    });

    it('gera follow-up tentativa 2 (encerramento)', () => {
        const msg = gerarFollowUp(variaveis, 2);
        expect(msg).toContain('João');
        expect(msg).toContain('Ed. Solar');
        expect(msg).toContain('fechar');
    });
});

// ====================================
// TODOS_TEMPLATES
// ====================================

describe('TODOS_TEMPLATES', () => {
    it('tem primeiraMensagem com 3 templates', () => {
        expect(TODOS_TEMPLATES.primeiraMensagem).toHaveLength(3);
    });

    it('tem followUp com 2 templates', () => {
        expect(TODOS_TEMPLATES.followUp).toHaveLength(2);
    });
});

// ====================================
// Templates individuais
// ====================================

describe('Templates de prospecção', () => {
    it.each([
        PRIMEIRA_MENSAGEM_STORYTELLING,
        PRIMEIRA_MENSAGEM_DIRETA,
        PRIMEIRA_MENSAGEM_ESCASSEZ,
        FOLLOWUP_1,
        FOLLOWUP_2,
    ])('$nome tem id, tipo e variáveis definidos', (template) => {
        expect(template.id).toBeTruthy();
        expect(template.tipo).toBeTruthy();
        expect(template.mensagem).toBeTruthy();
        expect(template.variaveis.length).toBeGreaterThan(0);
    });

    it('primeira mensagem usa tipo PRIMEIRA_MENSAGEM', () => {
        expect(PRIMEIRA_MENSAGEM_STORYTELLING.tipo).toBe('PRIMEIRA_MENSAGEM');
        expect(PRIMEIRA_MENSAGEM_DIRETA.tipo).toBe('PRIMEIRA_MENSAGEM');
        expect(PRIMEIRA_MENSAGEM_ESCASSEZ.tipo).toBe('PRIMEIRA_MENSAGEM');
    });

    it('follow-ups usam tipos corretos', () => {
        expect(FOLLOWUP_1.tipo).toBe('FOLLOWUP_1');
        expect(FOLLOWUP_2.tipo).toBe('FOLLOWUP_2');
    });
});
