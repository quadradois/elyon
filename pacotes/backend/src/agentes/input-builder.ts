import type { EstadoConversa } from './conversation-state';
import type { SchemaState } from './conversation-state';
import { construirSecaoPoliticaComercial } from './commercial-policy';
import type { AgentInputItem } from '@openai/agents';
import type { Lead } from '@prisma/client';
import { instrucaoGovernancaCurta } from './roteiro-governanca';

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
  leadRecord?: Lead | null;
}

interface ConstruirInputSdkParams {
  mensagens: MensagemConversa[];
  cachedHistory?: AgentInputItem[];
  estadoConversaAtual: EstadoConversa;
  schemaState?: SchemaState;
  config: InputBuilderConfig;
  contexto: InputBuilderContexto;
}

interface ConstruirInputSdkResult {
  inputSDK: AgentInputItem[];
  origem: 'cache' | 'primeiro_turno';
  cachedHistoryLength: number;
}

function pareceValorMonetario(texto?: string | null): boolean {
  const t = (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!t) return false;

  if (/r\$\s*\d/.test(t)) return true;
  if (/\b\d+(?:[.,]\d+)?\s*(k|mil|mi|milhao|milhoes|reais?)\b/.test(t)) return true;
  if (
    /\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b/.test(t)
    && !/\b(m2|m²|metros?|metro\s+quadrado|metros\s+quadrados)\b/.test(t)
  ) {
    return true;
  }

  return false;
}

function areaImovelConfiavel(area?: unknown): boolean {
  if (typeof area !== 'string') return false;
  const valor = area.trim();
  if (!valor) return false;
  if (pareceValorMonetario(valor)) return false;

  const t = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return /\b(m2|m²|metros?|metro\s+quadrado|metros\s+quadrados)\b/.test(t)
    || /^\d{2,4}(?:[.,]\d{1,2})?$/.test(t)
    || /\b(?:area|metragem)\b/.test(t);
}

function construirInputPrimeiroTurno(params: {
  mensagens: MensagemConversa[];
  estadoConversaAtual: EstadoConversa;
  schemaState?: SchemaState;
  config: InputBuilderConfig;
  contexto: InputBuilderContexto;
}): AgentInputItem[] {
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
  if (estadoConversaAtual.statusAnuncio === null || estadoConversaAtual.statusAnuncio === undefined) {
    linhasGuardrailEstado.push(`⛔ Status do anúncio ainda NÃO confirmado. Pergunte: "já está anunciando ou ainda não?" antes de avançar para SPIN.`);
  }
  if (estadoConversaAtual.estaAnunciando && !estadoConversaAtual.origemAnuncio) {
    linhasGuardrailEstado.push(`⛔ Lead já está anunciando, mas ORIGEM DO ANÚNCIO ainda não confirmada. Pergunte se é por conta própria ou com imobiliária/corretores.`);
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
        .filter(k => {
          const valor = leadResumo[k];
          if (valor === null || valor === undefined || valor === '') return false;
          if (k === 'areaImovel' && !areaImovelConfiavel(valor)) return false;
          return true;
        })
        .map(k => `  • ${k}: ${Array.isArray(leadResumo[k]) ? (leadResumo[k] as unknown[]).join(', ') : leadResumo[k]}`)
        .join('\n')}`
    : '';

  const contextoLead = `CONTEXTO DO LEAD (MEMÓRIA SEMÂNTICA):
- LeadId: ${contexto.leadId || 'N/A'}
- ContatoId: ${contexto.contatoId || 'N/A'}
- Fila do Funil: ${contexto.statusLead || 'Novo contato frio'}
- Dores/Objeções Anteriores: ${contexto.doresIdentificadas?.join(', ') || 'Nenhuma objeção mapeada ainda'}${leadResumoStr ? `
${leadResumoStr}` : ''}

${secaoMetodoTrabalho}${secaoBriefing}${schemaResumo}

ESTADO RESUMIDO (NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS):
- Intenção: ${estadoConversaAtual.intencao || 'não confirmada'}
- Metragem: ${estadoConversaAtual.metragem ? estadoConversaAtual.metragem + 'm²' : 'não confirmada'}
- Ocupação: ${estadoConversaAtual.ocupacao || 'não confirmada'}
- Valor pretendido: ${estadoConversaAtual.valorPretendido || 'não confirmado'}
- Já está anunciando: ${estadoConversaAtual.statusAnuncio || 'não confirmado'}
- Já anunciando: ${estadoConversaAtual.estaAnunciando ? 'SIM' : 'não detectado'}
- Origem do anúncio: ${estadoConversaAtual.origemAnuncio || 'não confirmada'}
- Timeline informada: ${estadoConversaAtual.timeline || 'não mencionada'}
- Já respondeu decisão de venda: ${estadoConversaAtual.jaRespondeuDecisao ? 'SIM — NUNCA mais pergunte se já decidiu vender' : 'não'}
${guardrailsAtivos}
🧭 GOVERNANÇA DE FLUXO: ${instrucaoGovernancaCurta()} Siga esse roteiro para decidir fase e tool. Não force tool call por checklist e não pule etapa.

Responda à última mensagem do proprietário com continuidade conversacional.`;

  const inputItems: AgentInputItem[] = [
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

    // Construir guardrails ricos com dados do leadRecord (mesmo nível do primeiro turno)
    const guardrails: string[] = [];
    if (estadoConversaAtual.intencao) guardrails.push(`⛔ Intenção JÁ confirmada: ${estadoConversaAtual.intencao}. NÃO pergunte se quer vender ou alugar.`);
    if (estadoConversaAtual.valorPretendido) guardrails.push(`⛔ Valor JÁ informado: ${estadoConversaAtual.valorPretendido}. NÃO pergunte o valor novamente.`);
    if (estadoConversaAtual.statusAnuncio === null || estadoConversaAtual.statusAnuncio === undefined) guardrails.push(`⛔ Status de anúncio ainda não confirmado (já anuncia ou ainda não).`);
    if (estadoConversaAtual.estaAnunciando && !estadoConversaAtual.origemAnuncio) guardrails.push(`⛔ Lead está anunciando, mas a origem do anúncio ainda não foi confirmada (conta própria vs imobiliária/corretores).`);
    if (estadoConversaAtual.timeline) guardrails.push(`⛔ Timeline JÁ informada: "${estadoConversaAtual.timeline}". NÃO pergunte prazo/urgência/prioridade.`);
    if (estadoConversaAtual.jaRespondeuDecisao) guardrails.push(`⛔ Lead já demonstrou decisão de venda. NÃO pergunte se já decidiu.`);

    // Dados do leadRecord (banco) — evita repetir perguntas sobre dados já salvos
    const leadRecord = contexto.leadRecord;
    if (leadRecord) {
      if (leadRecord.tipoImovel) guardrails.push(`⛔ Tipo do imóvel JÁ CONHECIDO: ${leadRecord.tipoImovel}. NÃO pergunte novamente.`);
      if (leadRecord.quartosImovel) guardrails.push(`⛔ Quartos JÁ CONHECIDO: ${leadRecord.quartosImovel}. NÃO pergunte novamente.`);
      if (leadRecord.areaImovel && areaImovelConfiavel(leadRecord.areaImovel)) {
        guardrails.push(`⛔ Área JÁ CONHECIDA: ${leadRecord.areaImovel}. NÃO pergunte novamente.`);
      }
      if (leadRecord.ocupacaoImovel) guardrails.push(`⛔ Ocupação JÁ CONHECIDA: ${leadRecord.ocupacaoImovel}. NÃO pergunte novamente.`);
      if (leadRecord.situacaoAtual) guardrails.push(`⛔ Situação JÁ CONHECIDA: ${leadRecord.situacaoAtual}. NÃO pergunte novamente.`);
      if (leadRecord.motivacaoVenda) guardrails.push(`⛔ Motivação JÁ CONHECIDA: ${leadRecord.motivacaoVenda}. NÃO pergunte novamente.`);
      if (leadRecord.enderecoImovel) guardrails.push(`⛔ Endereço JÁ CONHECIDO: ${leadRecord.enderecoImovel}. NÃO pergunte novamente.`);
    }

    const estadoResumo = [
      `ESTADO RESUMIDO DA CONVERSA (NÃO REPITA O QUE JÁ FOI RESPONDIDO):`,
      `intenção=${estadoConversaAtual.intencao || 'n/a'}`,
      `metragem=${estadoConversaAtual.metragem ? estadoConversaAtual.metragem + 'm²' : 'n/a'}`,
      `ocupação=${estadoConversaAtual.ocupacao || 'n/a'}`,
      `valor=${estadoConversaAtual.valorPretendido || 'n/a'}`,
      `status anúncio=${estadoConversaAtual.statusAnuncio || 'n/a'}`,
      `timeline=${estadoConversaAtual.timeline || 'n/a'}`,
      `já anunciando=${estadoConversaAtual.estaAnunciando ? 'SIM' : 'não'}`,
      `origem anúncio=${estadoConversaAtual.origemAnuncio || 'n/a'}`,
      `decisão já respondida=${estadoConversaAtual.jaRespondeuDecisao ? 'SIM' : 'não'}`,
    ];

    const conteudoCompleto = [
      ...estadoResumo,
      '',
      ...guardrails,
      '',
      `GOVERNANÇA: ${instrucaoGovernancaCurta()} Siga esse roteiro para decidir fase e tool. Não force tool call por checklist.`,
    ].filter(l => l !== undefined).join('\n');

    return {
      inputSDK: [
        ...cachedHistory,
        { role: 'system' as const, content: conteudoCompleto },
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
