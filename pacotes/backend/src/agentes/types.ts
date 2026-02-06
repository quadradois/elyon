import { Tool } from '@openai/agents';

// ====================================
// CORE ENTITIES
// ====================================

export interface Especialista {
    id: 'SALES' | 'CAPTURE';
    nome: string;
    descricao: string;

    // Subtipos (Ex: Lançamento vs Pronto)
    subtipos: {
        id: string;
        nome: string;
        promptDelta: string;  // Adicionado ao prompt base
    }[];

    // Estrutura Base
    systemPromptBase: string;
    toolsBase: Tool[];
    fluxoBase: FaseFunil[];

    // Hooks de Ciclo de Vida (Prompts reativos)
    hooks?: {
        onConversaInicio?: string;
        onEtapaMudanca?: string;
        onSkillAtivada?: string;
        onFallback?: string;
    };

    // Restrições Globais (aplicadas a todas skills)
    restricoesGlobais?: string[];

    // Regras de Composição
    skillsObrigatorias?: string[];
    skillsRecomendadas?: string[];
    maxSkills?: number;
}

export interface Skill {
    id: string;
    nome: string;
    descricao: string;
    versao: string;

    // Comportamento
    prioridade: number; // 0-100 (Maior vence)
    mergeStrategy: 'APPEND' | 'OVERRIDE';

    // Relacionamentos
    dependeDe?: string[];          // IDs de outras skills necessárias
    incompativelCom?: string[];    // IDs de skills conflitantes
    especialistasCompativeis?: string[]; // Se omitido, compatível com todos

    // Ativação
    ativarQuando: 'SEMPRE' | 'CONDICIONAL';
    condicoes?: Condicao[]; // Se CONDICIONAL

    // Componentes
    tools: Tool[]; // Serão prefixadas (namespace)
    promptInjection: string; // Template com {{parametros}}

    // Configuração Exposta
    parametros?: ParametroSchema[];

    // Metadata
    fasesAplicaveis?: ('OPENER' | 'QUALIFIER' | 'PRESENTER' | 'CLOSER')[];
    categoria?: 'COMUNICACAO' | 'NEGOCIACAO' | 'TECNICO' | 'OPERACIONAL';

    // Valores de parâmetros ativos (preenchidos durante o build)
    parametrosAtivos?: Record<string, any>;
}

// ====================================
// CONFIGURAÇÃO & BUILD
// ====================================

export interface AgenteConfiguracao {
    id: string;
    tenantId: string;

    especialista: 'SALES' | 'CAPTURE';
    subtipo?: string;

    skills: {
        id: string;
        versao: string;
        parametros?: Record<string, any>;
    }[];

    parametrosGlobais: {
        nomeAgente?: string;
        nomeEmpresa?: string;
        cidade?: string;
        comissao?: string;
        [key: string]: any;
    };

    versaoConfig: number;
}

export interface AgenteExecutavel {
    id: string;
    tenantId: string;
    especialista: string;
    subtipo?: string;

    systemPrompt: string;
    tools: Tool[];
    skills: Skill[]; // Skills ativas e ordenadas

    fluxo: FaseFunil[];
    hooks?: Especialista['hooks'];

    metadata: {
        versao: number;
        skillsAtivas: string[]; // "SKILL_ID@VERSAO"
        compiladoEm: Date;
    };
}

// ====================================
// UTILITÁRIOS
// ====================================

export interface FaseFunil {
    nome: string;
    descricao: string;
}

export interface Condicao {
    campo: string; // ex: "lead.perfil"
    operador: 'IGUAL' | 'DIFERENTE' | 'MAIOR_QUE' | 'MENOR_QUE' | 'CONTEM';
    valor: any;
}

export interface ParametroSchema {
    nome: string;
    tipo: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_SELECT';
    valorPadrao?: any;
    opcoes?: string[]; // Para ENUM/MULTI_SELECT
    obrigatorio: boolean;
}
