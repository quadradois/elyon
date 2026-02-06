/**
 * Skill: Casa
 * 
 * Perguntas e vocabulário otimizados para qualificação
 * de leads interessados em casas.
 */

import { SkillTipoImovel, PerguntasSPIN, Vocabulario, ExemploConversa } from './tipos';

const perguntasSPIN: PerguntasSPIN = {
    situacao: [
        'Quantos quartos tem a casa?',
        'Tem quintal? Qual o tamanho do terreno?',
        'Está morando ou alugada?',
        'Tem garagem? Pra quantos carros?',
        'Quantos banheiros?',
        'É casa de esquina ou meio de quadra?',
    ],
    problema: [
        'O que te fez pensar em vender?',
        'A casa está precisando de manutenção?',
        'A família cresceu/diminuiu?',
    ],
    implicacao: [
        'E esses custos de manutenção, tão pesando?',
        'A casa ficou grande/pequena demais?',
        'O bairro mudou? Segurança, vizinhança...',
    ],
    necessidade: [
        'Posso incluir sua casa na nossa carteira?',
        'Quando teria disponibilidade pra uma visita de avaliação?',
        'Você tem fotos atualizadas ou prefere que a gente tire?',
    ],
};

const vocabulario: Vocabulario = {
    perguntaChave: 'Quantos quartos tem a casa?',
    dadosEssenciais: ['quartos', 'terreno', 'ocupação', 'garagem', 'banheiros'],
    valorExemplo: 'R$ 400 a 700 mil',
    termosComuns: ['terreno', 'quintal', 'edícula', 'puxadinho', 'muro', 'portão'],
};

const exemplosConversa: ExemploConversa[] = [
    {
        contexto: 'Lead pergunta valor de casa',
        lead: 'Quanto vale minha casa?',
        agente: 'Casas na região variam de R$ 400k a 700k! Depende do terreno e estrutura. Qual o tamanho do terreno? Quantos quartos?',
        explicacao: 'Para casas, terreno é fator determinante',
    },
    {
        contexto: 'Lead menciona quintal grande',
        lead: 'Tenho um quintal enorme',
        agente: 'Quintal grande é um diferencial! Muitas famílias buscam isso. Qual a área total do terreno? Dá pra construir mais?',
        explicacao: 'Explora potencial de valorização',
    },
];

export const casaSkill: SkillTipoImovel = {
    id: 'Casa',
    nome: 'Casas',
    icone: '🏠',
    perguntasSPIN,
    vocabulario,
    exemplosConversa,

    gerarPromptSituacao(): string {
        return `
**SITUAÇÃO (para Casas):**
- Pergunte: "Quantos quartos tem a casa?"
- Pergunte: "Tem quintal? Qual o tamanho do terreno?"
- Pergunte: "Está morando ou alugada?" (ocupação)
- Pergunte: "Tem garagem? Pra quantos carros?"
- Pergunte: "É casa de esquina ou meio de quadra?"
`;
    },

    gerarPromptValor(): string {
        return `
**QUANDO PERGUNTAREM VALOR (Casas):**
- "Casas aqui variam de R$ 400k a 700k! Depende muito do terreno. Qual a área total?"
- Se souber área: "Casa em terreno de Xm² bem localizada pode valer Y. Tem edícula? Piscina?"
`;
    },
};

export default casaSkill;
