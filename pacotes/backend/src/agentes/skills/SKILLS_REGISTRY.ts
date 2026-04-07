/**
 * SKILLS REGISTRY
 * 
 * Mapa central de todas as skills disponíveis para os agentes.
 * Cada skill é um arquivo .md com playbook instrucional carregado sob demanda.
 * 
 * Para adicionar uma nova skill:
 * 1. Crie o arquivo .md na pasta correspondente (opener/, presenter/, compartilhados/)
 * 2. Adicione a entrada no SKILLS_REGISTRY abaixo
 * 
 * @version 1.0
 */

import * as path from 'path';
import * as fs from 'fs';

const SKILLS_DIR = path.join(__dirname, 'skills');

export const SKILLS_REGISTRY: Record<string, string> = {
    // ===========================
    // Compartilhadas (todos os agentes)
    // ===========================
    'compartilhados/regras-whatsapp':         'compartilhados/regras-whatsapp.md',
    'compartilhados/anti-injection':          'compartilhados/anti-injection.md',
    'compartilhados/reset-emocional':         'compartilhados/reset-emocional.md',

    // ===========================
    // Opener — Primeiro contato
    // ===========================
    'opener/protocolo-desconfianca':          'opener/protocolo-desconfianca.md',
    'opener/protocolo-recuo-hostilidade':     'opener/protocolo-recuo-hostilidade.md',
    'opener/protocolo-indicacao':             'opener/protocolo-indicacao.md',
    'opener/tratativa-exclusividade':         'opener/tratativa-exclusividade.md',
    'opener/tratativa-varios-corretores':     'opener/tratativa-varios-corretores.md',
    'opener/protocolo-ja-tem-contrato':       'opener/protocolo-ja-tem-contrato.md',

    // ===========================
    // Presenter — Diagnóstico e pitch
    // ===========================
    'presenter/spin-diagnostico':             'presenter/spin-diagnostico.md',
    'presenter/pitch-rede-parceiros':         'presenter/pitch-rede-parceiros.md',
    'presenter/tratativa-exclusividade':      'presenter/tratativa-exclusividade.md',
    'presenter/tratativa-vender-sozinho':     'presenter/tratativa-vender-sozinho.md',
    'presenter/tratativa-comissao':           'presenter/tratativa-comissao.md',
    'presenter/escalation-trigger-matrix':    'presenter/escalation-trigger-matrix.md',
};

/**
 * Carrega o conteúdo de uma skill pelo seu ID.
 * Retorna o texto markdown da skill para injeção no prompt.
 */
export function lerConteudoSkill(skillId: string): string {
    const arquivo = SKILLS_REGISTRY[skillId];

    if (!arquivo) {
        return `[SKILL NÃO ENCONTRADA: "${skillId}". IDs disponíveis: ${Object.keys(SKILLS_REGISTRY).join(', ')}]`;
    }

    const fullPath = path.join(SKILLS_DIR, arquivo);

    try {
        return fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
        return `[ERRO AO LER SKILL: "${skillId}" — arquivo: ${fullPath}]`;
    }
}

/**
 * Lista todos os IDs de skills disponíveis.
 */
export function listarSkillsDisponiveis(): string[] {
    return Object.keys(SKILLS_REGISTRY);
}
