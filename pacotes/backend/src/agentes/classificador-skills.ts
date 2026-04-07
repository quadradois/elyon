/**
 * CLASSIFICADOR DE SKILLS — Detecção de Gatilhos (Zero IA)
 *
 * Detecta qual skill é relevante para a mensagem do lead usando regex/keywords.
 * Sem chamada de LLM: determinístico, sub-1ms, sem custo de tokens.
 *
 * Retorna o ID da skill mais relevante ou null se nenhum gatilho detectar.
 *
 * @version 1.0
 */

import { lerConteudoSkill } from '../agentes/skills/SKILLS_REGISTRY';
import { logger } from '../lib/logger';

// ─── Mapa de Gatilhos → Skill ID ────────────────────────────────────────────
// Ordem importa: mais específico primeiro.

interface GatilhoSkill {
    id: string;
    agentes: ('opener' | 'presenter' | 'ambos')[];
    regex: RegExp;
}

const GATILHOS: GatilhoSkill[] = [
    // ── Compartilhados ──────────────────────────────────────────────────────
    {
        id: 'compartilhados/anti-injection',
        agentes: ['ambos'],
        regex: /ignore (suas |suas )?instru[cç][oõ]es|esque[cç]a tudo|voc[eê] [eé] (uma? )?ia|voc[eê] [eé] (um )?rob[oô]|mostre (seu|o) prompt|qual [eé] (o )?seu sistema/i,
    },
    {
        id: 'compartilhados/reset-emocional',
        agentes: ['ambos'],
        regex: /que saco|uma merda|me deixa em paz|para de me encher|n[aã]o quero mais|t[aá] cansado/i,
    },

    // ── Opener ──────────────────────────────────────────────────────────────
    {
        id: 'opener/protocolo-desconfianca',
        agentes: ['opener'],
        regex: /como (voc[eê] |vc )?(conseguiu|achou|pegou) (meu|o meu) n[uú]mero|de onde (voc[eê]|vc) [eé]|quem [eé] voc[eê]|n[aã]o te conhe[cç]o/i,
    },
    {
        id: 'opener/protocolo-recuo-hostilidade',
        agentes: ['opener'],
        regex: /n[aã]o pedi sua ajuda|me deixa|para de me ligar|n[aã]o tenho interesse|me tira (da lista)?|n[aã]o quero/i,
    },
    {
        id: 'opener/protocolo-indicacao',
        agentes: ['opener'],
        regex: /tem um amigo|conhe[cç]o algu[eé]m|meu vizinho|meu cunhado|minha irm[aã]|meu irm[aã]o|pode ser indica[cç][aã]o/i,
    },
    {
        id: 'opener/tratativa-exclusividade',
        agentes: ['opener'],
        regex: /exclusividade|contrato exclusivo|n[aã]o quero exclusividade|fico preso|ficar preso/i,
    },
    {
        id: 'opener/tratativa-varios-corretores',
        agentes: ['opener'],
        regex: /j[aá] tenho (v[aá]rios|muitos) corretores|deixar (solto|aberto)|poucas visitas|ningu[eé]m visita|plaquinha/i,
    },
    {
        id: 'opener/protocolo-ja-tem-contrato',
        agentes: ['opener'],
        regex: /j[aá] (assinei|fechei|tenho) (contrato|com uma imobili[aá]ria)|j[aá] (estou|tô) com (uma )?imobili[aá]ria/i,
    },

    // ── Presenter ────────────────────────────────────────────────────────────
    {
        id: 'presenter/tratativa-exclusividade',
        agentes: ['presenter'],
        regex: /exclusividade|contrato exclusivo|n[aã]o quero exclusividade|fico preso|ficar preso/i,
    },
    {
        id: 'presenter/tratativa-vender-sozinho',
        agentes: ['presenter'],
        regex: /se eu (achar|encontrar|conseguir) (o )?comprador|posso vender sozinho|vender por fora|sem pagar (comiss[aã]o)?|n[aã]o preciso de imobili[aá]ria/i,
    },
    {
        id: 'presenter/tratativa-comissao',
        agentes: ['presenter'],
        regex: /comiss[aã]o (t[aá]|[eé]) (alta|cara|muito|absurda)|desconto na comiss[aã]o|menos de (6|7|8|5)%|cobram demais/i,
    },
    {
        id: 'presenter/escalation-trigger-matrix',
        agentes: ['presenter'],
        regex: /sim (pode|quero|vamos)|pode avan[cç]ar|t[oô] dentro|vamos l[aá]|pode ser|avan[cç]a/i,
    },
];

// ─── Classificar ─────────────────────────────────────────────────────────────

export type AgenteAtual = 'opener' | 'presenter';

/**
 * Detecta qual skill é relevante para a mensagem do lead.
 * Retorna o ID da skill ou null se nenhum gatilho for ativado.
 */
export function detectarSkillGatilho(
    mensagem: string,
    agenteAtual: AgenteAtual
): string | null {
    for (const gatilho of GATILHOS) {
        const agenteCompativel =
            gatilho.agentes.includes('ambos') || gatilho.agentes.includes(agenteAtual);

        if (agenteCompativel && gatilho.regex.test(mensagem)) {
            logger.debug(`[SKILL_CLASSIFIER] 🎯 Gatilho detectado → skill: ${gatilho.id}`);
            return gatilho.id;
        }
    }
    return null;
}

/**
 * Se um gatilho for detectado, carrega o conteúdo da skill e retorna
 * como system message para injeção no inputSDK.
 * Retorna null se nenhum gatilho ou se a skill não for encontrada.
 */
export async function tentarPreCarregarSkill(
    mensagem: string,
    agenteAtual: AgenteAtual
): Promise<string | null> {
    const skillId = detectarSkillGatilho(mensagem, agenteAtual);
    if (!skillId) return null;

    try {
        const conteudo = lerConteudoSkill(skillId);
        logger.debug(`[SKILL_CLASSIFIER] ✅ Skill pré-carregada: ${skillId} (${conteudo.length} chars)`);
        return `[PRÉ-CARGA AUTOMÁTICA DE SKILL]\nO sistema detectou um gatilho na última mensagem do lead e carregou automaticamente o playbook correspondente. SIGA ESTRITAMENTE as instruções abaixo antes de responder:\n\n${conteudo}`;
    } catch (err) {
        logger.warn(`[SKILL_CLASSIFIER] ⚠️ Falha ao carregar skill ${skillId}: ${err}`);
        return null;
    }
}
