/**
 * Skill: Apartamento (Padrão)
 * 
 * Perguntas e vocabulário otimizados para qualificação
 * de leads interessados em apartamentos.
 */

import { SkillTipoImovel, PerguntasSPIN, Vocabulario, ExemploConversa } from './tipos';

const perguntasSPIN: PerguntasSPIN = {
    situacao: [
        'Quantos quartos tem o apartamento?',
        'Em qual andar fica?',
        'Está morando ou alugado?',
        'Tem garagem? Quantas vagas?',
        'É de frente ou fundos?',
        'Está reformado ou original?',
    ],
    problema: [
        'O que te fez pensar em vender?',
        'Há quanto tempo está pensando nisso?',
        'Já tentou vender antes?',
    ],
    implicacao: [
        'E enquanto não vende, esse custo tá impactando como?',
        'Quanto tá custando manter o apartamento parado?',
        'Se demorar mais uns meses, como fica?',
    ],
    necessidade: [
        'Posso incluir seu apartamento na nossa carteira?',
        'Quando teria disponibilidade pra uma visita de avaliação?',
        'Você tem fotos do apartamento ou prefere que a gente tire?',
    ],
};

const vocabulario: Vocabulario = {
    perguntaChave: 'Em qual andar fica o seu apartamento?',
    dadosEssenciais: ['quartos', 'andar', 'ocupação', 'vagas', 'estado conservação'],
    valorExemplo: 'R$ 280 a 380 mil',
    termosComuns: ['andar', 'vaga', 'condomínio', 'metragem', 'suíte', 'varanda'],
};

const exemplosConversa: ExemploConversa[] = [
    {
        contexto: 'Lead pergunta valor',
        lead: 'Quanto vale meu apartamento?',
        agente: 'Apartamentos de 2 quartos aqui estão saindo de R$ 280 a 380k! Mas pra te dar valor exato, preciso saber: é em qual andar?',
        explicacao: 'Usa faixa de valor + coleta dado que influencia preço',
    },
    {
        contexto: 'Lead relutante',
        lead: 'Vou pensar...',
        agente: 'Tranquilo! Mas me conta: o que te fez pensar em vender? Às vezes conversar ajuda a clarear as ideias 😊',
        explicacao: 'Recovery com pergunta aberta sobre motivação',
    },
];

export const apartamentoSkill: SkillTipoImovel = {
    id: 'Apartamento',
    nome: 'Apartamentos',
    icone: '🏢',
    perguntasSPIN,
    vocabulario,
    exemplosConversa,

    gerarPromptSituacao(): string {
        return `
**SITUAÇÃO (para Apartamentos):**
- Pergunte: "O seu é em qual andar?" (influencia no valor!)
- Pergunte: "Quantos quartos?" se não souber
- Pergunte: "Está morando ou alugado?" (ocupação)
- Pergunte: "Tem garagem? Quantas vagas?"
- Pergunte: "Está reformado ou original?"
`;
    },

    gerarPromptValor(): string {
        return `
**QUANDO PERGUNTAREM VALOR (Apartamentos):**
- COM briefing: "Apartamentos de 2 quartos no [empreendimento] estão saindo de R$ 280 a 380k! O seu é em qual andar?"
- SEM briefing: "Depende de vários fatores! Me conta mais - quantos quartos, em qual andar?"
→ Use a pergunta para coletar dados que você NÃO TEM!
`;
    },
};

export default apartamentoSkill;
