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
// ============================================

export const PRIMEIRA_MENSAGEM_STORYTELLING: TemplateProspeccao = {
  id: 'pm_storytelling_v1',
  nome: 'Storytelling - Cliente Buscando',
  descricao: 'Abordagem pedindo ajuda para encontrar imóvel',
  tipo: 'PRIMEIRA_MENSAGEM',
  variaveis: ['nome', 'agente', 'empreendimento', 'bairro'],
  mensagem: `Oi {nome}! Tudo bem?

Sou {agente}, corretor de imóveis aqui do {bairro}.

Preciso da sua ajuda: tenho um cliente querendo comprar no {empreendimento}, mas tá difícil achar quem esteja vendendo.

Você conhece alguém que possa estar pensando em vender?`
};

export const PRIMEIRA_MENSAGEM_DIRETA: TemplateProspeccao = {
  id: 'pm_direta_v1',
  nome: 'Direta - Cliente Interessado',
  descricao: 'Abordagem mais direta pedindo indicação',
  tipo: 'PRIMEIRA_MENSAGEM',
  variaveis: ['nome', 'agente', 'empreendimento'],
  mensagem: `Oi {nome}! 😊

Você conhece alguém vendendo apartamento no {empreendimento}?

Tenho um cliente super interessado e não consigo achar nada disponível!

Se souber de alguém (ou você mesmo tiver interesse), me avisa? 🙏

Me chamo {agente}, trabalho com imóveis aqui na região.`
};

export const PRIMEIRA_MENSAGEM_ESCASSEZ: TemplateProspeccao = {
  id: 'pm_escassez_v1',
  nome: 'Escassez - Alta Demanda',
  descricao: 'Destaca a dificuldade de encontrar imóveis',
  tipo: 'PRIMEIRA_MENSAGEM',
  variaveis: ['nome', 'agente', 'empreendimento'],
  mensagem: `Oi {nome}! 🙏

Me ajuda? 

Tá super difícil encontrar apartamento à venda no {empreendimento}!

Tenho clientes na fila esperando e não aparece nada...

Você conhece alguém vendendo? (Ou se for você, melhor ainda! 😊)

Sou {agente}, trabalho com imóveis na região.`
};

// ============================================
// TEMPLATES DE FOLLOW-UP
// ============================================

export const FOLLOWUP_1: TemplateProspeccao = {
  id: 'fu1_v1',
  nome: 'Follow-up 24h',
  descricao: 'Enviado 24h após primeira mensagem sem resposta',
  tipo: 'FOLLOWUP_1',
  variaveis: ['nome', 'empreendimento'],
  mensagem: `Oi {nome}! 😊

Só passando de novo sobre o {empreendimento}.

Conseguiu lembrar de alguém que esteja pensando em vender?

Agradeço qualquer dica! 🙏`
};

export const FOLLOWUP_2: TemplateProspeccao = {
  id: 'fu2_v1',
  nome: 'Follow-up Final 48h',
  descricao: 'Última tentativa, 48h após follow-up 1',
  tipo: 'FOLLOWUP_2',
  variaveis: ['nome', 'empreendimento'],
  mensagem: `{nome}, última mensagem sobre isso! 😊

Se souber de alguém vendendo no {empreendimento}, me avisa.

Se não, sem problemas! Não vou mais incomodar.

Obrigado e boa semana! 🙏`
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
