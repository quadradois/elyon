/**
 * Testes: output-guardrails.ts v2.0
 *
 * Cobre:
 * - extrairTextoVisivel (string, structured output, CoT)
 * - maxLinhasGuardrail (limite 15)
 * - umaPerguntaGuardrail (limite 3)
 * - exportação correta de outputGuardrailsWhatsApp
 */

// Mockamos @openai/agents para não precisar de SDK real
jest.mock('@openai/agents', () => ({}));

// Precisamos acessar funções internas — reimportamos via require
// O módulo exporta outputGuardrailsWhatsApp (array de guardrails)
import { outputGuardrailsWhatsApp } from '../output-guardrails';

// Helper: executa um guardrail com output simulado
async function executarGuardrail(guardrail: any, agentOutput: unknown) {
    return guardrail.execute({ agentOutput });
}

// Atalhos para os guardrails
const maxLinhas = outputGuardrailsWhatsApp[0];
const umaPergunta = outputGuardrailsWhatsApp[1];

// ====================================
// EXPORTAÇÃO
// ====================================

describe('outputGuardrailsWhatsApp export', () => {
    it('exporta array com 2 guardrails ativos', () => {
        expect(outputGuardrailsWhatsApp).toHaveLength(2);
    });

    it('guardrails têm nomes corretos', () => {
        expect(maxLinhas.name).toBe('WhatsApp Max Lines');
        expect(umaPergunta.name).toBe('Question Limit');
    });
});

// ====================================
// MAX LINHAS GUARDRAIL
// ====================================

describe('maxLinhasGuardrail', () => {
    it('NÃO bloqueia resposta curta (2 linhas)', async () => {
        const result = await executarGuardrail(maxLinhas, 'Oi!\nComo posso ajudar?');
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.linhas).toBe(2);
    });

    it('NÃO bloqueia pitch completo (10 linhas)', async () => {
        const linhas = Array.from({ length: 10 }, (_, i) => `Linha ${i + 1} do pitch`).join('\n');
        const result = await executarGuardrail(maxLinhas, linhas);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.linhas).toBe(10);
    });

    it('NÃO bloqueia no limite exato (15 linhas)', async () => {
        const linhas = Array.from({ length: 15 }, (_, i) => `Linha ${i + 1}`).join('\n');
        const result = await executarGuardrail(maxLinhas, linhas);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.linhas).toBe(15);
    });

    it('BLOQUEIA hallucination loop (20 linhas)', async () => {
        const linhas = Array.from({ length: 20 }, (_, i) => `Hallucination line ${i + 1}`).join('\n');
        const result = await executarGuardrail(maxLinhas, linhas);
        expect(result.tripwireTriggered).toBe(true);
        expect(result.outputInfo.linhas).toBe(20);
    });

    it('ignora linhas vazias na contagem', async () => {
        const texto = 'Linha 1\n\n\nLinha 2\n\n\nLinha 3';
        const result = await executarGuardrail(maxLinhas, texto);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.linhas).toBe(3);
    });

    it('remove CoT antes de contar linhas', async () => {
        const texto = '<cot>Pensando muito aqui\nlinha interna\noutra linha</cot>\nResposta real';
        const result = await executarGuardrail(maxLinhas, texto);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.linhas).toBe(1);
    });

    it('extrai respostaParaOCliente de structured output', async () => {
        const structured = {
            respostaParaOCliente: 'Oi! Tudo bem?',
            sentimento: 'positivo'
        };
        const result = await executarGuardrail(maxLinhas, structured);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.linhas).toBe(1);
    });

    it('trata objeto sem respostaParaOCliente como JSON stringificado', async () => {
        const obj = { qualquer: 'coisa', campo: 'outro' };
        const result = await executarGuardrail(maxLinhas, obj);
        expect(result.tripwireTriggered).toBe(false);
        // JSON.stringify produz 1 linha
        expect(result.outputInfo.linhas).toBe(1);
    });
});

// ====================================
// UMA PERGUNTA GUARDRAIL
// ====================================

describe('umaPerguntaGuardrail', () => {
    it('NÃO bloqueia sem perguntas', async () => {
        const result = await executarGuardrail(umaPergunta, 'Entendido. Vou anotar.');
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.perguntas).toBe(0);
    });

    it('NÃO bloqueia 1 pergunta', async () => {
        const result = await executarGuardrail(umaPergunta, 'Qual é o tamanho do imóvel?');
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.perguntas).toBe(1);
    });

    it('NÃO bloqueia 2 perguntas (retórica + real)', async () => {
        const result = await executarGuardrail(umaPergunta, 'Sabe o que é mais importante? Qual o tamanho do imóvel?');
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.perguntas).toBe(2);
    });

    it('NÃO bloqueia 3 perguntas (checkpoint legítimo)', async () => {
        const result = await executarGuardrail(umaPergunta, 'Faz sentido? Alguma dúvida? Quer que eu explique melhor?');
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.perguntas).toBe(3);
    });

    it('BLOQUEIA 4 perguntas (bombardeio)', async () => {
        const result = await executarGuardrail(umaPergunta, 'Quantos quartos? Qual andar? Tem garagem? Tem reforma?');
        expect(result.tripwireTriggered).toBe(true);
        expect(result.outputInfo.perguntas).toBe(4);
    });

    it('BLOQUEIA 6 perguntas', async () => {
        const result = await executarGuardrail(umaPergunta, 'P1? P2? P3? P4? P5? P6?');
        expect(result.tripwireTriggered).toBe(true);
        expect(result.outputInfo.perguntas).toBe(6);
    });

    it('remove CoT antes de contar perguntas', async () => {
        const texto = '<cot>Será que devo perguntar? Será que não? Qual a melhor abordagem?</cot>\nQual o tamanho?';
        const result = await executarGuardrail(umaPergunta, texto);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.perguntas).toBe(1);
    });

    it('extrai respostaParaOCliente de structured output', async () => {
        const structured = {
            respostaParaOCliente: 'Qual é o tamanho?',
            sentimento: 'curioso'
        };
        const result = await executarGuardrail(umaPergunta, structured);
        expect(result.tripwireTriggered).toBe(false);
        expect(result.outputInfo.perguntas).toBe(1);
    });
});
