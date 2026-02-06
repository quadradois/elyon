/**
 * Skill: Chácara
 * 
 * Perguntas e vocabulário otimizados para qualificação
 * de leads interessados em chácaras e sítios.
 */

import { SkillTipoImovel, PerguntasSPIN, Vocabulario, ExemploConversa } from './tipos';

const perguntasSPIN: PerguntasSPIN = {
    situacao: [
        'Qual a área total do terreno?',
        'Tem construção? Quantos m² de área construída?',
        'Tem água encanada ou poço artesiano?',
        'Tem energia elétrica trifásica?',
        'Tem escritura ou é posse?',
        'Está com algum uso hoje? (moradia, lazer, produção)',
    ],
    problema: [
        'O que te fez pensar em vender a chácara?',
        'Está conseguindo manter os custos?',
        'Tá usando com frequência ou está parada?',
    ],
    implicacao: [
        'E esses custos de manutenção, tão pesando no orçamento?',
        'Quanto tempo faz que não vai lá?',
        'Se ficar mais tempo parada, o mato não toma conta?',
    ],
    necessidade: [
        'Posso incluir sua chácara na nossa carteira de rurais?',
        'Quando teria disponibilidade pra uma visita?',
        'Você tem fotos recentes ou precisa atualizar?',
    ],
};

const vocabulario: Vocabulario = {
    perguntaChave: 'Qual a área total do terreno?',
    dadosEssenciais: ['área terreno', 'área construída', 'água', 'energia', 'documentação'],
    valorExemplo: 'R$ 300 a 600 mil (dependendo da estrutura)',
    termosComuns: ['hectares', 'alqueires', 'nascente', 'poço', 'pomar', 'curral', 'caseiro'],
};

const exemplosConversa: ExemploConversa[] = [
    {
        contexto: 'Lead pergunta valor de chácara',
        lead: 'Quanto vale minha chácara?',
        agente: 'Chácaras na região variam MUITO! De R$ 300k a 1 milhão dependendo da estrutura. Me conta: qual a área total? Tem casa construída?',
        explicacao: 'Para chácaras, área e benfeitorias são essenciais',
    },
    {
        contexto: 'Lead menciona manutenção',
        lead: 'Tá muito caro manter',
        agente: 'Imagino! Chácara dá trabalho né? Caseiro, roçar, contas... Tá conseguindo ir com frequência ou tá parada?',
        explicacao: 'Explora dor específica de chácaras',
    },
    {
        contexto: 'Lead pergunta sobre documentação',
        lead: 'Não tenho escritura, só contrato',
        agente: 'Entendi! Isso é comum em chácaras. É posse antiga? A gente tem experiência em regularizar. Não impede a venda, só precisa ajustar o valor.',
        explicacao: 'Contorna objeção comum em rurais',
    },
];

const objecoes: Record<string, string> = {
    'sem escritura': 'Não impede a venda! A gente ajuda na regularização. Posse antiga tem valor sim.',
    'muito longe': 'Localização rural não é problema! Temos compradores que buscam exatamente isso - sossego longe da cidade.',
    'precisa de reforma': 'Muitos compradores preferem assim - pagam menos e reformam do jeito deles. Vamos avaliar como está?',
};

export const chacaraSkill: SkillTipoImovel = {
    id: 'Chácara',
    nome: 'Chácaras e Sítios',
    icone: '🌾',
    perguntasSPIN,
    vocabulario,
    exemplosConversa,
    objecoes,

    gerarPromptSituacao(): string {
        return `
**SITUAÇÃO (para Chácaras/Sítios):**
- Pergunte: "Qual a área total do terreno?" (hectares ou m²)
- Pergunte: "Tem construção? Quantos m² de área construída?"
- Pergunte: "Tem água? Poço artesiano ou encanada?"
- Pergunte: "Tem energia elétrica? Trifásica?"
- Pergunte: "Tem escritura ou é posse?" (objeção comum!)
- Pergunte: "Está com algum uso? Morando, lazer, produção?"

⚠️ NÃO pergunte "quantos quartos" ou "em qual andar" - não faz sentido para chácaras!
`;
    },

    gerarPromptValor(): string {
        return `
**QUANDO PERGUNTAREM VALOR (Chácaras):**
- "Chácaras variam MUITO! De R$ 300k a 1 milhão. Depende da área e estrutura. Qual a área total?"
- Se souber área: "Uma chácara de X hectares bem estruturada pode valer Y. Tem casa? Piscina? Pomar?"

OBJEÇÕES COMUNS EM CHÁCARAS:
- "Sem escritura": "Posse antiga tem valor sim! A gente ajuda a regularizar."
- "Muito longe": "Compradores de chácara buscam exatamente isso!"
- "Precisa reforma": "Muitos preferem assim - reforma do próprio jeito."
`;
    },
};

export default chacaraSkill;
