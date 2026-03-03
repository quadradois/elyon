/**
 * OUTPUT GUARDRAILS — Validação programática de respostas dos agentes
 * 
 * Estes guardrails rodam APÓS o agente gerar a resposta.
 * Se a resposta viola uma regra, o SDK rejeita e pede nova geração.
 * 
 * @version 1.0
 * @date 22/02/2026
 */

import type { OutputGuardrail } from '@openai/agents';

// ====================================
// 1. MAX LINHAS WHATSAPP
// ====================================

/**
 * Garante que a resposta do agente tenha no máximo 8 linhas.
 * Mensagens longas no WhatsApp têm baixa taxa de leitura.
 * (5 era muito restritivo — bloqueava pitch + pergunta legítimos)
 */
const maxLinhasGuardrail: OutputGuardrail = {
    name: 'WhatsApp Max Lines',
    execute: async ({ agentOutput }) => {
        const texto = typeof agentOutput === 'string' ? agentOutput : JSON.stringify(agentOutput);
        // Remove CoT antes de contar linhas
        const semCot = texto.replace(/<cot>[\s\S]*?<\/cot>\s*/g, '').trim();
        const linhas = semCot.split('\n').filter(l => l.trim().length > 0).length;
        return {
            outputInfo: { linhas, max: 8 },
            tripwireTriggered: linhas > 8
        };
    }
};

// ====================================
// 2. UMA PERGUNTA POR MENSAGEM
// ====================================

/**
 * Garante que o agente faça no máximo 1 pergunta por mensagem.
 * Múltiplas perguntas confundem o lead no WhatsApp.
 */
const umaPerguntaGuardrail: OutputGuardrail = {
    name: 'Single Question',
    execute: async ({ agentOutput }) => {
        const texto = typeof agentOutput === 'string' ? agentOutput : JSON.stringify(agentOutput);
        const semCot = texto.replace(/<cot>[\s\S]*?<\/cot>\s*/g, '').trim();
        // Contar interrogações (ignora emojis com ?)
        const perguntas = (semCot.match(/\?/g) || []).length;
        return {
            outputInfo: { perguntas, max: 1 },
            tripwireTriggered: perguntas > 2 // Tolerância de 2 (pode ter retórica)
        };
    }
};

// ====================================
// 3. ANTI-REAPRESENTAÇÃO
// ====================================

/**
 * Impede que o agente se apresente novamente após handoff.
 * Frases como "Sou X da Y" ou "Meu nome é" quebram a ilusão.
 */
const antiReapresentacaoGuardrail: OutputGuardrail = {
    name: 'Anti Re-Introduction',
    execute: async ({ agentOutput }) => {
        const texto = typeof agentOutput === 'string' ? agentOutput : JSON.stringify(agentOutput);
        const semCot = texto.replace(/<cot>[\s\S]*?<\/cot>\s*/g, '').trim();
        const seApresentou = /\b(sou .{2,20} da |me chamo |meu nome é |prazer.{0,10}sou )/i.test(semCot);
        return {
            outputInfo: { seApresentou },
            tripwireTriggered: seApresentou
        };
    }
};

// ====================================
// LISTA DE TODOS OS OUTPUT GUARDRAILS
// ====================================

// ⚠️ TODOS DESATIVADOS TEMPORARIAMENTE (23/02/2026)
// Motivo: 3 incidentes em produção onde tripwireTriggered=true
// bloqueou respostas LEGÍTIMAS do agente, impedindo conversas.
//
// Incidentes:
// 1. antiReapresentacaoGuardrail → bloqueou Protocolo de Desconfiança
// 2. maxLinhasGuardrail (5 linhas) → bloqueou pitch + pergunta
// 3. maxLinhasGuardrail (8 linhas) → bloqueou resposta de 3 parágrafos
//
// As regras continuam nos PROMPTS dos agentes (max 3 linhas, 1 pergunta).
// Guardrails devem ser reimplementados com testes em conversas reais.
export const outputGuardrailsWhatsApp: OutputGuardrail[] = [];
