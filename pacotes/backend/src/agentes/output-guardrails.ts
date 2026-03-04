/**
 * OUTPUT GUARDRAILS — Validação programática de respostas dos agentes
 * 
 * Estes guardrails rodam APÓS o agente gerar a resposta.
 * Se a resposta viola uma regra, o SDK rejeita e pede nova geração.
 * 
 * @version 2.0 — recalibrado após incidentes de falso positivo (04/03/2026)
 * @date 22/02/2026
 */

import type { OutputGuardrail } from '@openai/agents';

/**
 * Limpa CoT e structured output antes de validar.
 */
function extrairTextoVisivel(agentOutput: unknown): string {
    let texto = typeof agentOutput === 'string' ? agentOutput : '';
    if (!texto && typeof agentOutput === 'object' && agentOutput !== null) {
        texto = (agentOutput as any).respostaParaOCliente || JSON.stringify(agentOutput);
    }
    return texto.replace(/<cot>[\s\S]*?<\/cot>\s*/g, '').trim();
}

// ====================================
// 1. MAX LINHAS WHATSAPP (tolerância: 15)
// ====================================

/**
 * Garante que a resposta não seja absurdamente longa.
 * 
 * Calibração v2:
 * - Limite: 15 linhas não-vazias (era 8 → bloqueava pitch legítimo)
 * - Diagnóstico SPIN: ~2 linhas (ok)
 * - Etapa de Pitch completa: ~6-10 linhas (ok)
 * - Pitch + checkpoint: ~12 linhas (ok)
 * - Hallucination loop: 20+ linhas (BLOQUEIA)
 */
const maxLinhasGuardrail: OutputGuardrail = {
    name: 'WhatsApp Max Lines',
    execute: async ({ agentOutput }) => {
        const semCot = extrairTextoVisivel(agentOutput);
        const linhas = semCot.split('\n').filter(l => l.trim().length > 0).length;
        return {
            outputInfo: { linhas, max: 15 },
            tripwireTriggered: linhas > 15
        };
    }
};

// ====================================
// 2. ANTI-BOMBARDEIO DE PERGUNTAS (tolerância: 3)
// ====================================

/**
 * Impede que o agente faça muitas perguntas numa única mensagem.
 * 
 * Calibração v2:
 * - Limite: 3 interrogações (era 2 → bloqueava checkpoint + retórica)
 * - 1 pergunta: padrão normal (ok)
 * - 2 perguntas: retórica + pergunta real (ok)
 * - 3 perguntas: checkpoint raro mas legítimo (ok)
 * - 4+ perguntas: bombardeio, confunde lead (BLOQUEIA)
 */
const umaPerguntaGuardrail: OutputGuardrail = {
    name: 'Question Limit',
    execute: async ({ agentOutput }) => {
        const semCot = extrairTextoVisivel(agentOutput);
        const perguntas = (semCot.match(/\?/g) || []).length;
        return {
            outputInfo: { perguntas, max: 3 },
            tripwireTriggered: perguntas > 3
        };
    }
};

// ====================================
// LISTA DE OUTPUT GUARDRAILS ATIVOS
// ====================================

// ✅ Reativados em 04/03/2026 com tolerâncias recalibradas:
// - maxLinhas: 8 → 15 (permite pitch completo)
// - umaPergunta: 2 → 3 (permite checkpoint + retórica)
// - antiReapresentação: REMOVIDO — gerava falso positivo no Protocolo de
//   Desconfiança ("Sou X da Y"). A regra continua no prompt de cada agente
//   e no filtro anti-narração do orchestrator.
export const outputGuardrailsWhatsApp: OutputGuardrail[] = [
    maxLinhasGuardrail,
    umaPerguntaGuardrail
];
