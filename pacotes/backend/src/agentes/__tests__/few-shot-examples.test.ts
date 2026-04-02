/**
 * Testes: few-shot-examples.ts
 *
 * Cobre:
 * - gerarExemplosPorFase retorna exemplos filtrados por fase
 * - Fases existentes: SAUDACAO, SITUACAO, PROBLEMA, IMPLICACAO, NECESSIDADE, SOLUCAO
 * - Fase inexistente retorna string vazia
 * - Limite de exemplos funciona
 * - Integridade dos exemplos (campos obrigatórios)
 */

jest.mock('@openai/agents', () => ({}));

import { gerarExemplosPorFase } from '../few-shot-examples';

// ====================================
// FASES COM EXEMPLOS
// ====================================

describe('gerarExemplosPorFase', () => {
    it('retorna exemplos para fase SAUDACAO', () => {
        const result = gerarExemplosPorFase('SAUDACAO');
        expect(result).toContain('SAUDACAO');
        expect(result.length).toBeGreaterThan(0);
    });

    it('retorna exemplos para fase SITUACAO', () => {
        const result = gerarExemplosPorFase('SITUACAO');
        expect(result).toContain('SITUACAO');
    });

    it('retorna exemplos para fase PROBLEMA', () => {
        const result = gerarExemplosPorFase('PROBLEMA');
        expect(result).toContain('PROBLEMA');
    });

    it('retorna exemplos para fase IMPLICACAO', () => {
        const result = gerarExemplosPorFase('IMPLICACAO');
        expect(result).toContain('IMPLICACAO');
    });

    it('retorna exemplos para fase NECESSIDADE', () => {
        const result = gerarExemplosPorFase('NECESSIDADE');
        expect(result).toContain('NECESSIDADE');
    });

    it('retorna exemplos para fase SOLUCAO', () => {
        const result = gerarExemplosPorFase('SOLUCAO');
        expect(result).toContain('SOLUCAO');
    });

    it('retorna string vazia para fase inexistente', () => {
        const result = gerarExemplosPorFase('FASE_FANTASMA');
        expect(result).toBe('');
    });

    // ====================================
    // LIMITE DE EXEMPLOS
    // ====================================

    it('respeita limite padrão de 3', () => {
        const result = gerarExemplosPorFase('SAUDACAO');
        // Cada exemplo é prefixado com '• ' — contar ocorrências
        const exemplos = (result.match(/•/g) || []).length;
        expect(exemplos).toBeLessThanOrEqual(3);
    });

    it('respeita limite customizado de 1', () => {
        const result = gerarExemplosPorFase('SAUDACAO', 1);
        const exemplos = (result.match(/•/g) || []).length;
        expect(exemplos).toBe(1);
    });

    it('respeita limite de 2', () => {
        const result = gerarExemplosPorFase('PROBLEMA', 2);
        const exemplos = (result.match(/•/g) || []).length;
        expect(exemplos).toBeLessThanOrEqual(2);
    });

    // ====================================
    // FORMATO
    // ====================================

    it('inclui emoji 💡 no header', () => {
        const result = gerarExemplosPorFase('SAUDACAO');
        expect(result).toContain('💡');
    });

    it('contém seta → entre mensagem e resposta', () => {
        const result = gerarExemplosPorFase('SAUDACAO');
        expect(result).toContain('→');
    });

    it('contém aspas nos exemplos', () => {
        const result = gerarExemplosPorFase('SAUDACAO');
        expect(result).toContain('"');
    });

    // ====================================
    // INTEGRIDADE DOS EXEMPLOS
    // ====================================

    it('abertura_01 não menciona "técnica do idoso confuso"', () => {
        const result = gerarExemplosPorFase('SAUDACAO', 10);
        expect(result).not.toContain('idoso confuso');
    });

    it('abertura_01 não menciona "família que mencionei"', () => {
        const result = gerarExemplosPorFase('SAUDACAO', 10);
        expect(result).not.toContain('família que mencionei');
    });
});
