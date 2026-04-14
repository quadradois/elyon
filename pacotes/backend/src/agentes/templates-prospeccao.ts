/**
 * TEMPLATES DE PROSPECÇÃO ATIVA
 * 
 * Templates para abordagem inicial e follow-ups
 * Usa a "Técnica do Idoso Confuso": pedir ajuda ao invés de oferecer
 * 
 * @version 2.0 - Simplificado
 * @date 16/12/2025
 */

// ============================================
// TIPOS
// ============================================

export interface VariaveisTemplate {
  nome: string;           // Nome do contato
  agente: string;         // Nome do agente IA
  empreendimento: string; // Nome do empreendimento/condomínio
  bairro: string;         // Bairro do imóvel
  imobiliaria?: string;   // Nome da imobiliária do tenant
}

export interface TemplateProspeccao {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'PRIMEIRA_MENSAGEM' | 'FOLLOWUP_1' | 'FOLLOWUP_2';
  mensagem: string;
  variaveis: string[];
}

// ============================================
// TEMPLATES DE PRIMEIRA MENSAGEM
// Alinhados com estrategia.md — Roteiro WhatsApp
// ============================================

export const PRIMEIRA_MENSAGEM_STORYTELLING: TemplateProspeccao = {
  id: 'pm_storytelling_v3',
  nome: 'Meio Campo — Mapeamento Natural',
  descricao: 'Abordagem indireta: apresenta o motivo do contato e abre porta pra interesse ou indicação',
  tipo: 'PRIMEIRA_MENSAGEM',
  variaveis: ['nome', 'agente', 'empreendimento', 'imobiliaria'],
  mensagem: `Oi {nome}, tudo bem? 😊

Sou {agente}, da {imobiliaria}. Tô conversando com alguns proprietários do {empreendimento} porque tenho clientes buscando imóveis na região.

Você conhece alguém com interesse em vender ou alugar, ou você mesmo teria? 🙏`
};

export const PRIMEIRA_MENSAGEM_DIRETA: TemplateProspeccao = {
  id: 'pm_direta_v3',
  nome: 'Demanda Ativa — Perfil Procurado',
  descricao: 'Abordagem com demanda real: mostra que tem compradores procurando',
  tipo: 'PRIMEIRA_MENSAGEM',
  variaveis: ['nome', 'agente', 'empreendimento', 'imobiliaria'],
  mensagem: `Oi {nome}! 😊

Sou {agente}, da {imobiliaria}. Tô com clientes procurando apartamento no {empreendimento} e o perfil de lá é exatamente o que eles querem.

Você teria interesse ou conhece alguém que possa ter? 🙏`
};

export const PRIMEIRA_MENSAGEM_ESCASSEZ: TemplateProspeccao = {
  id: 'pm_escassez_v3',
  nome: 'Consultoria — Proprietários da Região',
  descricao: 'Abordagem como consultor mapeando proprietários',
  tipo: 'PRIMEIRA_MENSAGEM',
  variaveis: ['nome', 'agente', 'empreendimento', 'imobiliaria'],
  mensagem: `Oi {nome}! 😊

Aqui é {agente}, da {imobiliaria}. Trabalho com imóveis na região do {empreendimento} e tô mapeando proprietários que possam ter interesse em uma avaliação gratuita do imóvel.

Faz sentido pra você? Sem compromisso 🙏`
};

// ============================================
// TEMPLATES DE FOLLOW-UP
// Alinhados com estrategia.md — Cenário 4
// ============================================

export const FOLLOWUP_1: TemplateProspeccao = {
  id: 'fu1_v2',
  nome: 'Follow-up 2h — Mensagem perdida',
  descricao: 'Enviado cerca de 2h após primeira mensagem sem resposta',
  tipo: 'FOLLOWUP_1',
  variaveis: ['nome', 'empreendimento'],
  mensagem: `Oi, {nome}! 😊

Passando rapidinho: minha mensagem sobre o imóvel no {empreendimento} chegou pra você?`
};

export const FOLLOWUP_2: TemplateProspeccao = {
  id: 'fu2_v2',
  nome: 'Follow-up Final — Encerramento cordial',
  descricao: 'Última tentativa. Se ignorar, encerrar o contato.',
  tipo: 'FOLLOWUP_2',
  variaveis: ['nome', 'empreendimento'],
  mensagem: `{nome}, tudo bem? 😊 Só pra fechar por aqui:

Se fizer sentido, posso te chamar outro dia sobre seu imóvel no {empreendimento}. Prefere que eu retome depois?`
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

export function substituirVariaveis(
  template: string,
  variaveis: Partial<VariaveisTemplate>
): string {
  let resultado = template;

  Object.entries(variaveis).forEach(([chave, valor]) => {
    if (valor) {
      const regex = new RegExp(`\\{${chave}\\}`, 'g');
      resultado = resultado.replace(regex, valor);
    }
  });

  return resultado;
}

export function gerarPrimeiraMensagem(
  variaveis: VariaveisTemplate,
  tipoTemplate: 'storytelling' | 'direta' | 'escassez' = 'storytelling'
): string {
  let template: TemplateProspeccao;

  switch (tipoTemplate) {
    case 'direta':
      template = PRIMEIRA_MENSAGEM_DIRETA;
      break;
    case 'escassez':
      template = PRIMEIRA_MENSAGEM_ESCASSEZ;
      break;
    default:
      template = PRIMEIRA_MENSAGEM_STORYTELLING;
  }

  return substituirVariaveis(template.mensagem, variaveis);
}

export function gerarFollowUp(
  variaveis: VariaveisTemplate,
  tentativa: 1 | 2
): string {
  const template = tentativa === 1 ? FOLLOWUP_1 : FOLLOWUP_2;
  return substituirVariaveis(template.mensagem, variaveis);
}

// ============================================
// EXPORTAR TODOS OS TEMPLATES
// ============================================

export const TODOS_TEMPLATES = {
  primeiraMensagem: [
    PRIMEIRA_MENSAGEM_STORYTELLING,
    PRIMEIRA_MENSAGEM_DIRETA,
    PRIMEIRA_MENSAGEM_ESCASSEZ
  ],
  followUp: [
    FOLLOWUP_1,
    FOLLOWUP_2
  ]
};

export default {
  substituirVariaveis,
  gerarPrimeiraMensagem,
  gerarFollowUp,
  TODOS_TEMPLATES
};
