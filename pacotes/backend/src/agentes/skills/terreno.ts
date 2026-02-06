/**
 * Skill: Terreno/Lote
 * 
 * Perguntas e vocabulário otimizados para qualificação
 * de leads interessados em terrenos e lotes.
 */

import { SkillTipoImovel, PerguntasSPIN, Vocabulario, ExemploConversa } from './tipos';

const perguntasSPIN: PerguntasSPIN = {
    situacao: [
        'Qual a metragem do terreno?',
        'Tem escritura ou ainda está em contrato?',
        'É plano ou em aclive/declive?',
        'Já está murado?',
        'Tem água e luz na rua?',
        'É de esquina ou meio de quadra?',
    ],
    problema: [
        'O que te fez pensar em vender?',
        'Tá pagando IPTU de terreno parado?',
        'Desistiu de construir?',
    ],
    implicacao: [
        'E esse IPTU todo mês, tá pesando?',
        'O mato não toma conta? Recebe notificação da prefeitura?',
        'Quanto tempo tá pagando sem usar?',
    ],
    necessidade: [
        'Posso incluir seu terreno na nossa carteira?',
        'O terreno tá limpo pra eu tirar fotos?',
        'Tem algum projeto aprovado ou é só o lote?',
    ],
};

const vocabulario: Vocabulario = {
    perguntaChave: 'Qual a metragem do terreno?',
    dadosEssenciais: ['metragem', 'documentação', 'topografia', 'infraestrutura'],
    valorExemplo: 'R$ 150 a 300 mil',
    termosComuns: ['metragem', 'frente', 'fundos', 'murado', 'plano', 'aclive'],
};

const exemplosConversa: ExemploConversa[] = [
    {
        contexto: 'Lead pergunta valor de terreno',
        lead: 'Quanto vale meu lote?',
        agente: 'Terrenos aqui variam de R$ 150k a 300k! Depende da localização e metragem. Qual a área? É de esquina?',
        explicacao: 'Esquina e metragem são fatores-chave',
    },
    {
        contexto: 'Lead menciona IPTU',
        lead: 'Tô cansado de pagar IPTU',
        agente: 'Entendo! Terreno parado só dá despesa né? Há quanto tempo tá pagando sem usar? Talvez seja hora de transformar em dinheiro!',
        explicacao: 'Explora dor do custo sem retorno',
    },
];

export const terrenoSkill: SkillTipoImovel = {
    id: 'Lote',
    nome: 'Terrenos e Lotes',
    icone: '📐',
    perguntasSPIN,
    vocabulario,
    exemplosConversa,

    gerarPromptSituacao(): string {
        return `
**SITUAÇÃO (para Terrenos/Lotes):**
- Pergunte: "Qual a metragem do terreno?" (frente x fundos)
- Pergunte: "Tem escritura ou ainda é contrato?"
- Pergunte: "É plano ou tem inclinação?"
- Pergunte: "Já está murado?"
- Pergunte: "Tem água e luz na rua?"
- Pergunte: "É de esquina ou meio de quadra?"

⚠️ NÃO pergunte "quantos quartos" - é um terreno vazio!
`;
    },

    gerarPromptValor(): string {
        return `
**QUANDO PERGUNTAREM VALOR (Terrenos):**
- "Terrenos aqui variam de R$ 150k a 300k! Depende da localização. Qual a metragem?"
- Se souber metragem: "Lote de Xm² bem localizado pode valer Y. É de esquina? Faz diferença!"
`;
    },
};

export default terrenoSkill;
