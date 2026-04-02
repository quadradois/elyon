import type { EstadoConversa } from './conversation-state';
import { construirSecaoPoliticaComercial } from './commercial-policy';

export interface MensagemConversa {
  role: 'user' | 'assistant';
  content: string;
}

interface InputBuilderConfig {
  ragPerfilTexto?: string;
  comissaoPadrao?: string;
  prazoContrato?: number;
  diferenciais?: string[];
  briefingEmpreendimento?: string;
}

interface InputBuilderContexto {
  leadId?: string;
  contatoId?: string;
  statusLead?: string;
  doresIdentificadas?: string[];
  empreendimento?: string;
  leadRecord?: any; // data fetched from lead table (resumo form-like)
}

interface ConstruirInputSdkParams {
  mensagens: MensagemConversa[];
  cachedHistory?: any[];
  estadoConversaAtual: EstadoConversa;
  schemaState?: any;
  config: InputBuilderConfig;
  contexto: InputBuilderContexto;
}

interface ConstruirInputSdkResult {
  inputSDK: any[];
  origem: 'cache' | 'primeiro_turno';
  cachedHistoryLength: number;
}

function construirInputPrimeiroTurno(params: {
  mensagens: MensagemConversa[];
  estadoConversaAtual: EstadoConversa;
  schemaState?: any;
  config: InputBuilderConfig;
  contexto: InputBuilderContexto;
}): any[] {
  const { mensagens, estadoConversaAtual, schemaState, config, contexto } = params;

  let secaoMetodoTrabalho: string;
  if (config.ragPerfilTexto) {
    secaoMetodoTrabalho = `PERFIL COMPLETO DA IMOBILIÁRIA (USE SEMPRE):\n${config.ragPerfilTexto}`;
  } else {
    secaoMetodoTrabalho = construirSecaoPoliticaComercial({
      comissaoPadrao: config.comissaoPadrao,
      prazoContrato: config.prazoContrato,
      diferenciais: config.diferenciais
    });
  }

  let secaoBriefing = '';
  if (config.briefingEmpreendimento) {
    secaoBriefing = `\n\nCONHECIMENTO DO EMPREENDIMENTO: ${contexto.empreendimento || 'N/A'}\n${config.briefingEmpreendimento}\n⚠️ USE esses dados! NÃO pergunte coisas que você já sabe!`;
  }

  const linhasGuardrailEstado: string[] = [];
  if (estadoConversaAtual.intencao) {
    linhasGuardrailEstado.push(`⛔ Intenção JÁ confirmada: ${estadoConversaAtual.intencao}. NÃO pergunte se quer vender ou alugar.`);
  }
  if (estadoConversaAtual.valorPretendido) {
    linhasGuardrailEstado.push(`⛔ Valor JÁ informado: ${estadoConversaAtual.valorPretendido}. NÃO pergunte o valor novamente.`);
  }
  if (estadoConversaAtual.estaAnunciando) {
    linhasGuardrailEstado.push(`⛔ Lead JÁ ESTÁ ANUNCIANDO → PULE a pergunta de valor (ele sabe o preço) e PULE a pergunta sobre decisão de venda. Vá direto para a mensagem de transição da Fase 2.`);
  }
  if (estadoConversaAtual.timeline) {
    linhasGuardrailEstado.push(`⛔ Timeline JÁ informada: "${estadoConversaAtual.timeline}". NÃO pergunte prazo, urgência ou se é prioridade vender.`);
  }
  if (estadoConversaAtual.jaRespondeuDecisao && !estadoConversaAtual.estaAnunciando) {
    linhasGuardrailEstado.push(`⛔ Lead já demonstrou decisão de venda. NÃO pergunte se já decidiu ou se é prioridade.`);
  }
  // Guardrails extras vindos do leadRecord (banco)
  if (contexto.leadRecord?.tipoImovel) {
    linhasGuardrailEstado.push(`⛔ Tipo do imóvel JÁ CONHECIDO (banco): ${contexto.leadRecord.tipoImovel}. NÃO pergunte novamente.`);
  }
  if (contexto.leadRecord?.quartosImovel) {
    linhasGuardrailEstado.push(`⛔ Número de quartos JÁ CONHECIDO (banco): ${contexto.leadRecord.quartosImovel} quartos. NÃO pergunte novamente.`);
  }
  if (contexto.leadRecord?.situacaoAtual) {
    linhasGuardrailEstado.push(`⛔ Situação JÁ CONHECIDA (banco): ${contexto.leadRecord.situacaoAtual}. NÃO pergunte novamente.`);
  }

  const guardrailsAtivos = linhasGuardrailEstado.length > 0
    ? `\n🔴 GUARDRAILS ATIVOS — RESPEITE ANTES DE RESPONDER:\n${linhasGuardrailEstado.join('\n')}\n`
    : '';

  const schemaResumo = params.schemaState
    ? `\nHISTÓRICO DE COLETA — já obtidos: ${Object.keys(params.schemaState || {}).filter(k=>k!=='collectedFields').join(', ')}`
    : '';
  const leadResumo = contexto.leadRecord;
  // Campos relevantes do imóvel para exibir no prompt (filtrar ruído como IDs, timestamps)
  const CAMPOS_IMOVEL = [
    'nome', 'tipoImovel', 'areaImovel', 'imovelAreaTotal', 'quartosImovel', 'imovelSuites',
    'imovelBanheiros', 'vagasImovel', 'ocupacaoImovel', 'valorPretendido', 'interesseEm',
    'enderecoImovel', 'situacaoAtual', 'motivacaoVenda', 'prazoDesejado', 'urgencia',
    'comissaoAcordada', 'tipoAutorizacao', 'estadoConservacao', 'situacaoFinanceira',
    'doresIdentificadas', 'objecoes',
  ] as const;
  const leadResumoStr = leadResumo
    ? `\nDADOS EXISTENTES NO LEAD (ficha do banco — NÃO pergunte o que já está aqui):\n${CAMPOS_IMOVEL
        .filter(k => leadResumo[k] !== null && leadResumo[k] !== undefined && leadResumo[k] !== '')
        .map(k => `  • ${k}: ${Array.isArray(leadResumo[k]) ? (leadResumo[k] as any[]).join(', ') : leadResumo[k]}`)
        .join('\n')}`
    : '';

  const contextoLead = `CONTEXTO DO LEAD (MEMÓRIA SEMÂNTICA):
- ID: ${contexto.leadId || contexto.contatoId || 'N/A'}
- Fila do Funil: ${contexto.statusLead || 'Novo contato frio'}
- Dores/Objeções Anteriores: ${contexto.doresIdentificadas?.join(', ') || 'Nenhuma objeção mapeada ainda'}${leadResumoStr ? `
${leadResumoStr}` : ''}

${secaoMetodoTrabalho}${secaoBriefing}${schemaResumo}

ESTADO RESUMIDO (NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS):
- Intenção: ${estadoConversaAtual.intencao || 'não confirmada'}
- Metragem: ${estadoConversaAtual.metragem ? estadoConversaAtual.metragem + 'm²' : 'não confirmada'}
- Ocupação: ${estadoConversaAtual.ocupacao || 'não confirmada'}
- Valor pretendido: ${estadoConversaAtual.valorPretendido || 'não confirmado'}
- Já anunciando: ${estadoConversaAtual.estaAnunciando ? 'SIM — lead tem experiência com venda, sabe o preço' : 'não detectado'}
- Timeline informada: ${estadoConversaAtual.timeline || 'não mencionada'}
- Já respondeu decisão de venda: ${estadoConversaAtual.jaRespondeuDecisao ? 'SIM — NUNCA mais pergunte se já decidiu vender' : 'não'}
${guardrailsAtivos}
📦 REGRA DE TOOL: Se você já coletou intenção + metragem + ocupação + valor, chame qualificar_lead IMEDIATAMENTE com todos os dados antes de responder.

Lembre-se: Extraia a intenção, faça o pitch de valor e peça para avaliar o imóvel. Responda à última mensagem do proprietário.`;

  const inputItems: any[] = [
    { role: 'system' as const, content: contextoLead }
  ];

  for (const msg of mensagens) {
    if (msg.role === 'user') {
      inputItems.push({
        role: 'user' as const,
        content: [{ type: 'input_text', text: msg.content }]
      });
    } else if (msg.role === 'assistant') {
      inputItems.push({
        type: 'message',
        role: 'assistant' as const,
        content: [{ type: 'output_text', text: msg.content }],
        status: 'completed'
      });
    }
  }

  return inputItems;
}

export function construirInputSdk(params: ConstruirInputSdkParams): ConstruirInputSdkResult {
  const { mensagens, cachedHistory, estadoConversaAtual, schemaState, config, contexto } = params;

  if (cachedHistory && cachedHistory.length > 0) {
    const ultimaMsgUser = mensagens.filter((m) => m.role === 'user').pop();
    return {
      inputSDK: [
        ...cachedHistory,
        {
          role: 'system' as const,
          content: [
            `ESTADO RESUMIDO (NÃO REPITA O QUE JÁ FOI RESPONDIDO):`,
            `intenção=${estadoConversaAtual.intencao || 'n/a'}`,
            `metragem=${estadoConversaAtual.metragem ? estadoConversaAtual.metragem + 'm²' : 'n/a'}`,
            `ocupação=${estadoConversaAtual.ocupacao || 'n/a'}`,
            `valor=${estadoConversaAtual.valorPretendido || 'n/a'}`,
            `timeline=${estadoConversaAtual.timeline || 'n/a'}`,
            `já anunciando=${estadoConversaAtual.estaAnunciando ? 'SIM' : 'não'}`,
            `decisão já respondida=${estadoConversaAtual.jaRespondeuDecisao ? 'SIM' : 'não'}`,
            estadoConversaAtual.valorPretendido ? '⛔ NÃO pergunte o valor novamente.' : '',
            estadoConversaAtual.intencao ? `⛔ NÃO pergunte se quer vender ou alugar.` : '',
            estadoConversaAtual.estaAnunciando ? '⛔ Lead JÁ ANUNCIANDO → PULE pergunta de valor e decisão, vá para transição da Fase 2.' : '',
            estadoConversaAtual.timeline ? `⛔ Timeline JÁ informada ("${estadoConversaAtual.timeline}"). NÃO pergunte sobre prazo/urgência/prioridade.` : '',
            estadoConversaAtual.jaRespondeuDecisao ? '⛔ NÃO pergunte se já decidiu vender.' : '',
            'Se tem intenção+metragem+ocupação+valor (ou lead anunciando), chame qualificar_lead COM TODOS OS DADOS.',
          ].filter(Boolean).join(' | ')
        },
        { role: 'user' as const, content: ultimaMsgUser?.content || '' }
      ],
      origem: 'cache',
      cachedHistoryLength: cachedHistory.length,
    };
  }

  return {
    inputSDK: construirInputPrimeiroTurno({ mensagens, estadoConversaAtual, schemaState, config, contexto }),
    origem: 'primeiro_turno',
    cachedHistoryLength: 0,
  };
}