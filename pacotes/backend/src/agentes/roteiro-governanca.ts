export const ROTEIRO_GOVERNANCA_NOME = 'ROTEIRO_SDR_FASES_V1';
export const ROTEIRO_GOVERNANCA_VERSAO = '2026-04-13-GOV06B';

export const FASES_ROTEIRO_SDR = [
  'MEIO_CAMPO',
  'DESCOBERTA',
  'DIAGNOSTICO_SPIN',
  'PITCH',
  'AGENDAMENTO',
  'FOLLOW_UP',
  'RECUO',
] as const;

export type FaseRoteiroSdr = (typeof FASES_ROTEIRO_SDR)[number];

interface RegraFase {
  objetivo: string;
  toolsPermitidas: string[];
  regraAvanco: string;
}

interface GuiaPerguntasFase {
  perguntas: string[];
  proibicoes: string[];
}

const REGRAS_FASE: Record<FaseRoteiroSdr, RegraFase> = {
  MEIO_CAMPO: {
    objetivo: 'Abertura e sondagem inicial de interesse',
    toolsPermitidas: ['registrar_optout', 'registrar_indicacao', 'ler_skill'],
    regraAvanco: 'Se o lead indicar interesse proprio, avance para DESCOBERTA.',
  },
  DESCOBERTA: {
    objetivo: 'Coletar dados minimos obrigatorios (intencao, valor, metragem, ocupacao, status e origem do anuncio)',
    toolsPermitidas: ['converter_para_lead', 'qualificar_lead', 'ler_skill', 'agendar_followup'],
    regraAvanco: 'Nao avance para DIAGNOSTICO_SPIN sem descoberta minima completa e converter_para_lead.',
  },
  DIAGNOSTICO_SPIN: {
    objetivo: 'Mapear dores explicitas em SPIN com perguntas abertas curtas',
    toolsPermitidas: ['qualificar_lead', 'atualizar_dados_lead', 'ler_skill', 'consultar_preco_mercado'],
    regraAvanco: 'Avance para PITCH somente com 2 dores explicitas do lead.',
  },
  PITCH: {
    objetivo: 'Apresentar diferencial conectado as dores mapeadas',
    toolsPermitidas: ['qualificar_lead', 'mover_para_fase', 'ler_skill'],
    regraAvanco: 'Avance para AGENDAMENTO apenas apos aceite explicito do lead.',
  },
  AGENDAMENTO: {
    objetivo: 'Validar interesse explicito no agendamento e so entao coletar dia/horario sem inventar datas',
    toolsPermitidas: ['agendar_reuniao_closer', 'enviar_link_agendamento', 'agendar_followup', 'mover_para_fase'],
    regraAvanco: 'Antes de pedir horario, confirme interesse no agendamento. Se pedir tempo, registre follow-up com data combinada. Chame agendar_reuniao_closer somente com data+hora explicitas.',
  },
  FOLLOW_UP: {
    objetivo: 'Registrar recontato quando lead pede tempo',
    toolsPermitidas: ['agendar_followup'],
    regraAvanco: 'Encerrar cordialmente apos registrar follow-up.',
  },
  RECUO: {
    objetivo: 'Conter hostilidade e respeitar opt-out',
    toolsPermitidas: ['registrar_optout', 'agendar_followup'],
    regraAvanco: 'Encerrar cordialmente e nao insistir sem nova abertura do lead.',
  },
};

const GUIA_PERGUNTAS_FASE: Record<FaseRoteiroSdr, GuiaPerguntasFase> = {
  MEIO_CAMPO: {
    perguntas: [
      'Quando o lead ainda nao indicou interesse proprio: "Voce conhece alguem com interesse em vender/alugar ou voce mesmo teria?"',
      'Se responder "nao conheco ninguem": "E no seu caso, pensa em vender ou alugar?"',
    ],
    proibicoes: [
      'Nao entrar em pitch ou diagnostico antes de confirmar interesse proprio.',
      'Nao fazer checklist de dados do imovel nesta fase.',
    ],
  },
  DESCOBERTA: {
    perguntas: [
      'Se intencao nao confirmada: "Voce quer vender ou alugar?"',
      'Se valorPretendido estiver vazio: "Voce ja tem um valor em mente?"',
      'Se status de anuncio estiver vazio: "Voce ja esta anunciando ou ainda nao?"',
      'Se metragem estiver vazia: "Qual e a metragem do apartamento?"',
      'Se ocupacao estiver vazia: "Hoje ele esta ocupado, alugado ou vago?"',
      'Se ja anuncia e origem estiver vazia: "Voce esta anunciando por conta propria ou com imobiliaria/corretores?"',
    ],
    proibicoes: [
      'Nao confundir valor (R$) com area (m2).',
      'Nao pular para SPIN/PITCH sem fechar descoberta minima.',
    ],
  },
  DIAGNOSTICO_SPIN: {
    perguntas: [
      'Problema: "Como esta o retorno ate agora: visitas qualificadas ou mais curiosos?"',
      'Implicacao sem suposicao: "Qual tem sido o principal impacto disso pra voce?"',
      'Necessidade: "O que voce espera que melhore primeiro nesse processo?"',
    ],
    proibicoes: [
      'Nao assumir emocao (ex.: "voce esta chateado") sem evidencia textual do lead.',
      'Nao assumir "imovel parado" se o lead nao confirmou explicitamente.',
    ],
  },
  PITCH: {
    perguntas: [
      'Entrada no pitch: "Posso te mostrar em 1 minuto como estruturamos isso?"',
      'Apos explicacao curta: "Faz sentido pra voce esse formato?"',
    ],
    proibicoes: [
      'Nao alongar explicacao apos aceite do lead.',
      'Nao usar jargoes de bastidor ou termos tecnicos internos.',
    ],
  },
  AGENDAMENTO: {
    perguntas: [
      'Pre-CTA obrigatorio: "Faz sentido pra voce avancar para essa consultoria gratuita com o especialista?"',
      'Pergunta de agendamento (apos aceite): "Qual dia e horario ficam melhores pra voce?"',
      'Se horario indisponivel: "Entre estas opcoes, qual funciona melhor pra voce?"',
    ],
    proibicoes: [
      'Nao marcar reuniao sem dia e horario explicitos.',
      'Nao enviar link de agenda como primeira opcao sem tentar horario no chat.',
    ],
  },
  FOLLOW_UP: {
    perguntas: [
      'Follow-up consultivo: "Sem problema. Qual dia fica melhor pra eu te chamar e retomarmos com calma?"',
      'Se o lead nao definir data: "Prefere que eu te chame na [opcao 1] ou [opcao 2]?"',
    ],
    proibicoes: [
      'Nao pressionar o lead.',
      'Nao reabrir pitch completo sem nova abertura do lead.',
    ],
  },
  RECUO: {
    perguntas: [
      'Encerramento com respeito: "Perfeito, respeito total. Quer que eu nao te chame mais por aqui?"',
    ],
    proibicoes: [
      'Nao insistir apos hostilidade clara.',
      'Nao retomar roteiro comercial no mesmo turno de recuo.',
    ],
  },
};

export function instrucaoGovernancaCurta(): string {
  return `Fonte unica de verdade do roteiro: ${ROTEIRO_GOVERNANCA_NOME}@${ROTEIRO_GOVERNANCA_VERSAO}.`;
}

export function renderRoteiroGovernancaMarkdown(): string {
  const linhas: string[] = [];
  for (const fase of FASES_ROTEIRO_SDR) {
    const regra = REGRAS_FASE[fase];
    linhas.push(`### ${fase}`);
    linhas.push(`- Objetivo: ${regra.objetivo}`);
    linhas.push(`- Tools permitidas: ${regra.toolsPermitidas.join(', ')}`);
    linhas.push(`- Regra de avanço: ${regra.regraAvanco}`);
    linhas.push('');
  }

  return linhas.join('\n').trim();
}

export function renderPerguntasObrigatoriasMarkdown(): string {
  const linhas: string[] = [
    '## Contrato de Perguntas por Fase (Fonte Unica)',
    '- Uma pergunta por mensagem.',
    '- Evite justificativa longa antes da pergunta (nao usar "Pergunto porque..." antes da pergunta principal).',
    '- Use apenas fatos confirmados pelo lead; sem suposicoes de emocao, ocupacao ou urgencia.',
    '',
  ];

  for (const fase of FASES_ROTEIRO_SDR) {
    const guia = GUIA_PERGUNTAS_FASE[fase];
    linhas.push(`### ${fase}`);
    linhas.push('- Perguntas permitidas/prioritarias:');
    for (const pergunta of guia.perguntas) {
      linhas.push(`  - ${pergunta}`);
    }
    linhas.push('- Proibicoes:');
    for (const proibicao of guia.proibicoes) {
      linhas.push(`  - ${proibicao}`);
    }
    linhas.push('');
  }

  return linhas.join('\n').trim();
}
