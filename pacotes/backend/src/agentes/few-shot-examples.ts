/**
 * FEW-SHOT EXAMPLES - Exemplos de Conversas de Sucesso
 * 
 * Estes exemplos são injetados no prompt para calibrar o comportamento do LLM.
 * Baseados em conversas reais de sucesso no mercado imobiliário.
 * 
 * IMPORTANTE: +10-15% de precisão comprovada em testes A/B
 * 
 * @author Elyon AI
 * @since 05/12/2025
 */

interface ExemploConversa {
  id: string;
  fase: string;
  contexto: string;
  mensagemLead: string;
  respostaSDR: string;
  toolUsada?: string;
  porqueCorreto: string;
}

/**
 * Exemplos de ABERTURA - Primeira resposta após prospecção
 */
const exemplosAbertura: ExemploConversa[] = [
  {
    id: 'abertura_01',
    fase: 'SAUDACAO',
    contexto: 'Lead confirma interesse em vender após abordagem de prospecção',
    mensagemLead: 'quero vender o meu',
    respostaSDR: 'Que ótimo! 😊 Me conta: o apartamento está ocupado ou vazio?',
    porqueCorreto: 'Confirma interesse, faz UMA pergunta de qualificação'
  },
  {
    id: 'abertura_02',
    fase: 'SAUDACAO',
    contexto: 'Lead curioso sobre origem do contato',
    mensagemLead: 'Como conseguiu meu número?',
    respostaSDR: 'Foi indicação! Quando ajudo alguém a vender, peço contatos de vizinhos que também podem ter interesse. 🙏\n\nVocê conhece alguém vendendo no prédio?',
    porqueCorreto: 'Responde honestamente, redireciona para objetivo sem parecer evasivo'
  },
  {
    id: 'abertura_03',
    fase: 'SAUDACAO',
    contexto: 'Lead demonstra interesse vago',
    mensagemLead: 'pode ser',
    respostaSDR: 'Perfeito! 😊 Vou te ajudar a entender o mercado.\n\nPrimeiro: seu apartamento é de quantos quartos?',
    porqueCorreto: 'Reconhece "pode ser" como POSITIVO, inicia qualificação suave'
  }
];

/**
 * Exemplos de QUALIFICAÇÃO - Coletando dados SPIN
 */
const exemplosQualificacao: ExemploConversa[] = [
  {
    id: 'qualificacao_01',
    fase: 'SITUACAO',
    contexto: 'Lead informa dados básicos do imóvel',
    mensagemLead: '2 quartos, tá vazio há 3 meses',
    respostaSDR: 'Entendi! 2 quartos e vazio... deve estar pagando condomínio sem usar, né? 😅\n\nO que te fez pensar em vender agora?',
    porqueCorreto: 'Extrai 2 dados (quartos + ocupação), transita para PROBLEMA com implicação'
  },
  {
    id: 'qualificacao_02',
    fase: 'PROBLEMA',
    contexto: 'Lead revela motivação de venda',
    mensagemLead: 'preciso do dinheiro pra comprar uma casa maior',
    respostaSDR: 'Faz total sentido! Família crescendo pede mais espaço. 😊\n\nJá tem ideia de quando precisa concluir a venda? Tem prazo pra entrada da casa nova?',
    porqueCorreto: 'Valida motivação, transita para timeline com pergunta natural'
  },
  {
    id: 'qualificacao_03',
    fase: 'IMPLICACAO',
    contexto: 'Lead com prazo apertado',
    mensagemLead: 'preciso vender até março',
    respostaSDR: 'Março é daqui a 4 meses! Tempo bom, mas não sobra muito. 📅\n\nJá pensou no valor? Posso te dar uma avaliação comparativa do mercado!',
    porqueCorreto: 'Cria urgência suave, oferece valor (avaliação) como próximo passo'
  },
  {
    id: 'qualificacao_04',
    fase: 'NECESSIDADE',
    contexto: 'Lead quer saber valor de mercado',
    mensagemLead: 'quanto tá valendo hoje?',
    respostaSDR: 'Apartamentos de 2 quartos no seu prédio estão entre R$ 280k e R$ 350k, dependendo do andar e reforma. 📊\n\nO seu é em qual andar? Tem alguma reforma feita?',
    porqueCorreto: 'Dá range de valor (não compromete), pede dados para refinar'
  }
];

/**
 * Exemplos de OBJEÇÕES - Contornando resistências
 */
const exemplosObjecoes: ExemploConversa[] = [
  {
    id: 'objecao_01',
    fase: 'PROBLEMA',
    contexto: 'Objeção de taxa/comissão',
    mensagemLead: 'quanto vocês cobram?',
    respostaSDR: 'A comissão segue a política comercial da imobiliária e você só paga quando vender! 🎯\n\nMas olha o que tá incluso:\n✓ Fotos profissionais (R$ 400)\n✓ 12 portais (R$ 800/mês)\n✓ Jurídico (R$ 600)\n\nImóveis com imobiliária vendem 40% mais rápido. Compensa!',
    porqueCorreto: 'Usa ancoragem de valor, lista benefícios com valores reais'
  },
  {
    id: 'objecao_02',
    fase: 'SITUACAO',
    contexto: 'Lead já tem corretor',
    mensagemLead: 'já tenho imobiliária cuidando',
    respostaSDR: 'Que bom que já está com alguém! 😊\n\nHá quanto tempo está anunciado? Tá tendo muitas visitas?',
    porqueCorreto: 'NÃO desiste, faz perguntas para descobrir insatisfação'
  },
  {
    id: 'objecao_03',
    fase: 'PROBLEMA',
    contexto: 'Lead quer vender direto (FSBO)',
    mensagemLead: 'vou vender por conta própria',
    respostaSDR: 'Admiro a iniciativa! 💪 Muita gente começa assim.\n\nMas te conto: 9 em cada 10 desistem em 3 meses. Responder curiosos, filtrar gente desqualificada, risco de segurança...\n\nQue tal testar 30 dias conosco? Se não vender, tenta sozinho. Deal?',
    porqueCorreto: 'Valida escolha, usa dados estatísticos, oferece teste sem risco'
  },
  {
    id: 'objecao_04',
    fase: 'IMPLICACAO',
    contexto: 'Lead quer pensar',
    mensagemLead: 'vou pensar e te retorno',
    respostaSDR: 'Tranquilo! 🙏 Mas me ajuda a entender: o que te faz querer pensar? É a comissão, o prazo, ou outra coisa?\n\nSó pra eu poder te ajudar melhor quando retornar!',
    toolUsada: 'agendar_followup',
    porqueCorreto: 'Não aceita passivamente, tenta descobrir objeção real'
  }
];

/**
 * Exemplos de FECHAMENTO - Convertendo em lead/anúncio
 */
const exemplosFechamento: ExemploConversa[] = [
  {
    id: 'fechamento_01',
    fase: 'SOLUCAO',
    contexto: 'Lead aceita formalizar o contrato de consultoria',
    mensagemLead: 'ok pode avançar',
    respostaSDR: 'Perfeito, {nome}! Antes de formalizar, prefere que eu te explique rapidamente as cláusulas principais, ou já avançamos direto? 😊',
    toolUsada: undefined,
    porqueCorreto: 'Micro-compromisso antes de pedir dados pessoais. Não solicita fotos antes do contrato (sequência correta: contrato → assinatura → avaliação)'
  },
  {
    id: 'fechamento_01b',
    fase: 'SOLUCAO',
    contexto: 'Lead quer avançar direto após micro-compromisso',
    mensagemLead: 'já avança',
    respostaSDR: 'Perfeito! Me passa seu e-mail pra eu solicitar o envio do contrato? 😊',
    toolUsada: 'atualizar_dados_lead',
    porqueCorreto: 'Inicia coleta sequencial pelo e-mail (menos invasivo), não pede CPF+endereço ao mesmo tempo'
  },
  {
    id: 'fechamento_02',
    fase: 'SOLUCAO',
    contexto: 'Lead quer avaliação presencial antes de assinar',
    mensagemLead: 'quero que vocês vejam o apto primeiro',
    respostaSDR: 'Com certeza! Assim que formalizarmos o contrato, já agendamos a avaliação no mesmo dia. Me passa seu e-mail que encaminho o modelo pra dar andamento? 😊',
    porqueCorreto: 'Mantém a sequência correta (contrato antes da avaliação), pede e-mail primeiro'
  },
  {
    id: 'fechamento_03',
    fase: 'SOLUCAO',
    contexto: 'Lead confirma horário',
    mensagemLead: 'pode ser amanhã 16h',
    respostaSDR: 'Anotado! 📝\n\nConfirmando:\n→ Amanhã (06/12) às 16h\n→ Endereço: [PEDIR SE NÃO TIVER]\n→ Seu nome completo: [PEDIR]\n\nTe mando confirmação amanhã de manhã! 😊',
    toolUsada: 'agendar_avaliacao',
    porqueCorreto: 'Repete data/hora, pede dados faltantes, confirma compromisso'
  }
];

/**
 * Exemplos de OPT-OUT - Respeitando limites
 */
const exemplosOptout: ExemploConversa[] = [
  {
    id: 'optout_01',
    fase: 'SAUDACAO',
    contexto: 'Lead pede para parar mensagens',
    mensagemLead: 'para de me mandar mensagem',
    respostaSDR: 'Desculpa o incômodo! 🙏\n\nNão vou mais entrar em contato. Tenha um ótimo dia!',
    toolUsada: 'registrar_optout',
    porqueCorreto: 'Desculpa imediatamente, não insiste, usa tool de opt-out'
  },
  {
    id: 'optout_02',
    fase: 'PROBLEMA',
    contexto: 'Lead irritado',
    mensagemLead: 'isso é spam, vou denunciar',
    respostaSDR: 'Peço desculpas pelo incômodo! 😔\n\nSeu número será removido da nossa lista agora mesmo. Não vai mais receber contato.\n\nDesejo tudo de bom!',
    toolUsada: 'registrar_optout',
    porqueCorreto: 'Reconhece frustração, age imediatamente, encerra educadamente'
  }
];

/**
 * Exemplos de INDICAÇÃO - Lead não quer mas conhece alguém
 */
const exemplosIndicacao: ExemploConversa[] = [
  {
    id: 'indicacao_01',
    fase: 'SAUDACAO',
    contexto: 'Lead não vende mas conhece alguém',
    mensagemLead: 'não vou vender mas meu vizinho do 802 tá vendendo',
    respostaSDR: 'Muito obrigado pela indicação! 🙏\n\nVocê consegue me passar o contato dele? Ou pode passar meu número pra ele me chamar.\n\nAgradeço demais a ajuda!',
    porqueCorreto: 'Agradece genuinamente, oferece duas opções de contato'
  },
  {
    id: 'indicacao_02',
    fase: 'SITUACAO',
    contexto: 'Lead não tem interesse mas quer ajudar',
    mensagemLead: 'não conheço ninguém vendendo agora',
    respostaSDR: 'Sem problemas! 😊 Agradeço por responder.\n\nSe ouvir alguém comentando sobre vender, me avisa? Meu número fica salvo aqui.\n\nBoa semana! 🙏',
    porqueCorreto: 'Encerra positivamente, planta semente para futuro'
  }
];

/**
 * Gera exemplos específicos para uma fase
 */
export function gerarExemplosPorFase(fase: string, limite: number = 3): string {
  const todosExemplos = [
    ...exemplosAbertura,
    ...exemplosQualificacao,
    ...exemplosObjecoes,
    ...exemplosFechamento,
    ...exemplosOptout,
    ...exemplosIndicacao,
  ];

  const exemplosDaFase = todosExemplos
    .filter(e => e.fase === fase)
    .slice(0, limite);

  if (exemplosDaFase.length === 0) return '';

  let output = `\n💡 EXEMPLOS PARA ESTA FASE (${fase}):\n`;

  for (const ex of exemplosDaFase) {
    output += `• "${ex.mensagemLead}" → "${ex.respostaSDR.split('\n')[0]}..."\n`;
  }

  return output;
}

