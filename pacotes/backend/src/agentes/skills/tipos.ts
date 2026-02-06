/**
 * Skills por Tipo de Imóvel - Interfaces
 * 
 * Define a estrutura que cada skill deve implementar
 * para adaptar perguntas SPIN ao contexto do imóvel.
 */

export type TipoImovel =
    | 'Apartamento'
    | 'Casa'
    | 'Chácara'
    | 'Terreno'
    | 'Lote'
    | 'Comercial';

/**
 * Perguntas categorizadas por fase SPIN
 */
export interface PerguntasSPIN {
    situacao: string[];    // Dados básicos do imóvel
    problema: string[];    // Motivação/dores
    implicacao: string[];  // Amplificar consequências
    necessidade: string[]; // Solução/próximos passos
}

/**
 * Exemplos de conversa para few-shot learning
 */
export interface ExemploConversa {
    contexto: string;
    lead: string;
    agente: string;
    explicacao?: string;
}

/**
 * Vocabulário específico do tipo de imóvel
 */
export interface Vocabulario {
    perguntaChave: string;      // "Em qual andar?" vs "Qual a área do terreno?"
    dadosEssenciais: string[];  // Lista de dados a coletar
    valorExemplo: string;       // "R$ 280 a 380k" vs "R$ 800k a 1.2M"
    termosComuns: string[];     // ["andar", "vaga"] vs ["hectares", "nascente"]
}

/**
 * Interface principal que cada skill deve implementar
 */
export interface SkillTipoImovel {
    id: TipoImovel;
    nome: string;
    icone: string;

    /** Perguntas categorizadas por fase SPIN */
    perguntasSPIN: PerguntasSPIN;

    /** Exemplos de conversa para o prompt */
    exemplosConversa: ExemploConversa[];

    /** Vocabulário e terminologia específica */
    vocabulario: Vocabulario;

    /** Objeções específicas deste tipo */
    objecoes?: Record<string, string>;

    /** Texto para injetar no prompt (seção SITUAÇÃO) */
    gerarPromptSituacao(): string;

    /** Texto para injetar no prompt (seção VALOR) */
    gerarPromptValor(): string;
}

/**
 * Configuração para buscar skill baseado na campanha
 */
export interface SkillContext {
    tipoImovel?: TipoImovel | string;
    campanhaId?: string;
    briefing?: string;
}
