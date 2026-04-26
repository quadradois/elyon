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
    /** 'sdr' = disparável pelo SDR, 'admin' = só pelo Admin, 'ambos' = qualquer agente */
    agentes: ('sdr' | 'admin' | 'ambos')[];
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

    // ── SDR — Skills de Abertura/Prospecção ─────────────────────────────────────────────────
    {
        id: 'opener/protocolo-desconfianca',
        agentes: ['sdr'],
        regex: /como (voc[eê] |vc )?(conseguiu|achou|pegou) (meu|o meu) n[uú]mero|de onde (voc[eê]|vc) [eé]|quem [eé] voc[eê]|n[aã]o te conhe[cç]o/i,
    },
    {
        id: 'opener/protocolo-recuo-hostilidade',
        agentes: ['sdr'],
        regex: /n[aã]o pedi sua ajuda|me deixa|para de me ligar|n[aã]o tenho interesse|me tira (da lista)?|n[aã]o quero(?!\s+marcar|\s+agendar)/i,
    },
    {
        id: 'opener/protocolo-indicacao',
        agentes: ['sdr'],
        regex: /tem um amigo|conhe[cç]o algu[eé]m|meu vizinho|meu cunhado|minha irm[aã]|meu irm[aã]o|pode ser indica[cç][aã]o/i,
    },
    {
        id: 'opener/protocolo-autorizacao-venda',
        agentes: ['sdr'],
        regex: /vamos fazer (algum )?contrato|tem (algum )?contrato|como funciona (o )?(contrato|autoriza[cç][aã]o)|precisa assinar|que documento precisa|autoriza[cç][aã]o de venda/i,
    },
    {
        id: 'opener/tratativa-varios-corretores',
        agentes: ['sdr'],
        regex: /j[aá] tenho (v[aá]rios|muitos) corretores|tenho \d+\s*corretores|prefiro deixar (solto|aberto)|v[aá]rios corretores trabalhando/i,
    },
    {
        id: 'opener/protocolo-ja-tem-contrato',
        agentes: ['sdr'],
        regex: /j[aá] (assinei|fechei|tenho) (contrato|com uma imobili[aá]ria)|j[aá] (estou|tô) com (uma )?imobili[aá]ria/i,
    },

    // ── SDR — Skills de Diagnóstico/Pitch ─────────────────────────────────────────────────
    {
        id: 'presenter/tratativa-exclusividade',
        agentes: ['sdr'],
        regex: /exclusividade|contrato exclusivo|n[aã]o quero exclusividade|fico preso|ficar preso|[eé]\s*exclusivo\??|tem exclusividade\??/i,
    },
    {
        id: 'presenter/tratativa-vender-sozinho',
        agentes: ['sdr'],
        regex: /se eu (achar|encontrar|conseguir) (o )?comprador|posso vender sozinho|vender por fora|sem pagar (comiss[aã]o)?|n[aã]o preciso de imobili[aá]ria/i,
    },
    {
        id: 'presenter/tratativa-comissao',
        agentes: ['sdr'],
        regex: /comiss[aã]o (t[aá]|[eé]) (alta|cara|muito|absurda)|desconto na comiss[aã]o|menos de (6|7|8|5)%|cobram demais/i,
    },
    {
        id: 'presenter/tratativa-duvidas-contrato-template-contato',
        agentes: ['sdr'],
        regex: /vi (sua|a) mensagem.*(contrato|autoriza[cç][aã]o)|nesse modelo que voc[eê] mandou|template de contato|isso [eé] pegadinha|documento do contato|isso [eé] obrigat[oó]rio/i,
    },
    {
        id: 'presenter/tratativa-clausulas-contrato',
        agentes: ['sdr'],
        regex: /cl[aá]usula|o que significa a cl[aá]usula|explica a cl[aá]usula|me explica o contrato|como funciona a autoriza[cç][aã]o|d[uú]vida sobre (o )?(contrato|autoriza[cç][aã]o)|e se aparecer (um )?comprador direto|e se outro corretor vender|quem paga (os )?an[uú]ncios|posso trabalhar com mais de uma imobili[aá]ria|proposta inferior|valor inferior|for[çc]ar.*baixar|baixar.*pre[çc]o|voc[eê]s.*baixar.*valor|comiss[aã]o (dobrada|tripla|extra)|pagar.*mais.*corretor|fim do contrato.*comiss[aã]o|depois (que acabar|do contrato).*comiss[aã]o|ap[oó]s o prazo.*comiss[aã]o|cliente apresentado.*comiss[aã]o|cliente n[aã]o comunicado|respons[aá]vel exclusivo|gest[aã]o exclusiva|direcionad[oa]s? ao autorizado|tenho que mandar (todos )?(clientes|corretores|interessados)|direcionar (todos )?os interessados para voc[eê]s|negociar direto|por outro corretor|interessado (apresentado|identificado|comunicado)|devidamente (comunicado|identificado)/i,
    },
    {
        id: 'presenter/tratativa-contrato-condicoes',
        agentes: ['sdr'],
        regex: /me manda (o |a )?(contrato|documento|autoriza[cç][aã]o)|enviar (o |a )?(contrato|documento|autoriza[cç][aã]o)|pode rescindir|rescis[aã]o|custo para rescindir|multa|negociar prazo|prazo (especial|diferente)|condi[cç][oõ]es (especiais|fora do padr[aã]o)|isen[cç][aã]o|desconto no contrato|penalidade/i,
    },
    {
        id: 'presenter/tratativa-sem-aceite-agendamento',
        agentes: ['sdr'],
        regex: /\b(agora n[aã]o|vou pensar|depois eu vejo|n[aã]o quero marcar|ainda n[aã]o|n[aã]o quero agendar)\b/i,
    },
    {
        id: 'presenter/escalation-trigger-matrix',
        agentes: ['sdr'],
        regex: /\b(sim\s+pode\s+avan[cç]ar|pode\s+avan[cç]ar|quero\s+avan[cç]ar|vamos\s+avan[cç]ar|vamos\s+agendar|pode\s+agendar|quero\s+agendar)\b/i,
    },
];

// ─── Classificar ─────────────────────────────────────────────────────────────

export type AgenteAtual = 'sdr' | 'admin';

/**
 * Detecta qual skill é relevante para a mensagem do lead.
 * Retorna o ID da skill ou null se nenhum gatilho for ativado.
 */
export function detectarSkillGatilho(
    mensagem: string,
    agenteAtual: AgenteAtual
): string | null {
    for (const gatilho of GATILHOS) {
        // SDR tem acesso a TODAS as skills (qualquer agente)
        const agenteCompativel =
            gatilho.agentes.includes('ambos')
            || gatilho.agentes.includes(agenteAtual)
            || agenteAtual === 'sdr'; // SDR unifica todas as skills

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
        return `[PRÉ-CARGA AUTOMÁTICA DE SKILL]\nO sistema detectou um gatilho na última mensagem do lead e carregou automaticamente o playbook correspondente.\nAplique as instruções da skill apenas se estiverem compatíveis com a fase atual e com o que o lead disse explicitamente.\n\n${conteudo}`;
    } catch (err) {
        logger.warn(`[SKILL_CLASSIFIER] ⚠️ Falha ao carregar skill ${skillId}: ${err}`);
        return null;
    }
}
