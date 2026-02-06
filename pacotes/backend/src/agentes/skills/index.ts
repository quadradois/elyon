/**
 * Skills Registry - Sistema de Skills por Tipo de Imóvel
 * 
 * Permite carregar o skill correto baseado no tipoImovel da campanha.
 * Cada skill adapta as perguntas SPIN ao contexto específico.
 * 
 * @example
 * const skill = getSkillByTipo('Chácara');
 * const promptSituacao = skill.gerarPromptSituacao();
 */

import { SkillTipoImovel, TipoImovel, SkillContext } from './tipos';
import { apartamentoSkill } from './apartamento';
import { casaSkill } from './casa';
import { chacaraSkill } from './chacara';
import { terrenoSkill } from './terreno';

// Registry de todos os skills disponíveis
const skillsRegistry: Map<TipoImovel, SkillTipoImovel> = new Map([
    ['Apartamento', apartamentoSkill],
    ['Casa', casaSkill],
    ['Chácara', chacaraSkill],
    ['Lote', terrenoSkill],
    ['Terreno', terrenoSkill], // Alias
    ['Comercial', apartamentoSkill], // Fallback para comercial por enquanto
]);

/**
 * Retorna o skill apropriado para o tipo de imóvel
 * @param tipoImovel - Tipo do imóvel (Apartamento, Casa, Chácara, etc)
 * @returns Skill correspondente ou apartamento como fallback
 */
export function getSkillByTipo(tipoImovel?: TipoImovel | string): SkillTipoImovel {
    if (!tipoImovel) {
        return apartamentoSkill; // Default
    }

    // Normaliza o tipo (case-insensitive)
    const tipoNormalizado = tipoImovel.trim() as TipoImovel;

    return skillsRegistry.get(tipoNormalizado) || apartamentoSkill;
}

/**
 * Retorna skill baseado no contexto da campanha
 * @param context - Contexto com tipoImovel e opcionalmente campanhaId
 */
export function getSkillFromContext(context: SkillContext): SkillTipoImovel {
    return getSkillByTipo(context.tipoImovel as TipoImovel);
}

/**
 * Lista todos os skills disponíveis
 */
export function listarSkills(): SkillTipoImovel[] {
    // Remove duplicatas (Lote/Terreno apontam pro mesmo skill)
    const uniqueSkills = new Set(skillsRegistry.values());
    return Array.from(uniqueSkills);
}

/**
 * Gera o bloco de prompt SITUAÇÃO adaptado ao tipo de imóvel
 */
export function gerarPromptSituacaoParaTipo(tipoImovel?: TipoImovel | string): string {
    const skill = getSkillByTipo(tipoImovel);
    return skill.gerarPromptSituacao();
}

/**
 * Gera o bloco de prompt VALOR adaptado ao tipo de imóvel
 */
export function gerarPromptValorParaTipo(tipoImovel?: TipoImovel | string): string {
    const skill = getSkillByTipo(tipoImovel);
    return skill.gerarPromptValor();
}

// Re-exporta tipos e skills individuais
export { SkillTipoImovel, TipoImovel, SkillContext } from './tipos';
export { apartamentoSkill } from './apartamento';
export { casaSkill } from './casa';
export { chacaraSkill } from './chacara';
export { terrenoSkill } from './terreno';
