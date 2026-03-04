import type { EstadoConversa } from './conversation-state';

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
}

interface ConstruirInputSdkParams {
  mensagens: MensagemConversa[];
  cachedHistory?: any[];
  estadoConversaAtual: EstadoConversa;
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
  config: InputBuilderConfig;
  contexto: InputBuilderContexto;
}): any[] {
  const { mensagens, estadoConversaAtual, config, contexto } = params;

  let secaoMetodoTrabalho: string;
  if (config.ragPerfilTexto) {
    secaoMetodoTrabalho = `PERFIL COMPLETO DA IMOBILIÁRIA (USE SEMPRE):\n${config.ragPerfilTexto}`;
  } else {
    secaoMetodoTrabalho = `NOSSO MÉTODO DE TRABALHO (USE NO PITCH SE A INTENÇÃO FOR VALIDADA):
- Nossa comissão é de ${config.comissaoPadrao || '6%'}
- Contrato de Consultoria de ${config.prazoContrato || 180} dias
- Rede de Parceiros conectada: Imóvel ganha visibilidade de dezenas de corretores da cidade trabalhando de forma organizada
- Apresentação Premium: Avaliação com IA, Fotos Profissionais, Vídeo e Tour 360º
- Diferenciais: ${config.diferenciais?.join(', ') || 'Avaliação com IA, Material Profissional, Rede de Parceiros'}`;
  }

  let secaoBriefing = '';
  if (config.briefingEmpreendimento) {
    secaoBriefing = `\n\nCONHECIMENTO DO EMPREENDIMENTO: ${contexto.empreendimento || 'N/A'}\n${config.briefingEmpreendimento}\n⚠️ USE esses dados! NÃO pergunte coisas que você já sabe!`;
  }

  const contextoLead = `CONTEXTO DO LEAD (MEMÓRIA SEMÂNTICA):
- ID: ${contexto.leadId || contexto.contatoId || 'N/A'}
- Fila do Funil: ${contexto.statusLead || 'Novo contato frio'}
- Dores/Objeções Anteriores: ${contexto.doresIdentificadas?.join(', ') || 'Nenhuma objeção mapeada ainda'}

${secaoMetodoTrabalho}${secaoBriefing}

ESTADO RESUMIDO (NÃO REPETIR PERGUNTAS JÁ RESPONDIDAS):
- Intenção: ${estadoConversaAtual.intencao || 'não confirmada'}
- Metragem: ${estadoConversaAtual.metragem || 'não confirmada'}
- Ocupação: ${estadoConversaAtual.ocupacao || 'não confirmada'}
- Valor pretendido: ${estadoConversaAtual.valorPretendido || 'não confirmado'}
- Já respondeu decisão de venda: ${estadoConversaAtual.jaRespondeuDecisao ? 'SIM — NUNCA mais pergunte se já decidiu vender' : 'não'}
${estadoConversaAtual.valorPretendido ? '⛔ O proprietário JÁ informou o valor. NÃO pergunte o valor novamente.' : ''}
${estadoConversaAtual.intencao ? '⛔ A intenção JÁ foi confirmada como ' + estadoConversaAtual.intencao + '. NÃO pergunte se quer vender ou alugar.' : ''}

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
  const { mensagens, cachedHistory, estadoConversaAtual, config, contexto } = params;

  if (cachedHistory && cachedHistory.length > 0) {
    const ultimaMsgUser = mensagens.filter((m) => m.role === 'user').pop();
    return {
      inputSDK: [
        ...cachedHistory,
        {
          role: 'system' as const,
          content: `ESTADO RESUMIDO (NÃO REPITA O QUE JÁ FOI RESPONDIDO): intenção=${estadoConversaAtual.intencao || 'n/a'}, metragem=${estadoConversaAtual.metragem || 'n/a'}, ocupação=${estadoConversaAtual.ocupacao || 'n/a'}, valor=${estadoConversaAtual.valorPretendido || 'n/a'}, decisão já respondida=${estadoConversaAtual.jaRespondeuDecisao ? 'SIM-NÃO PERGUNTE NOVAMENTE' : 'não'}. ${estadoConversaAtual.valorPretendido ? 'NÃO pergunte o valor novamente.' : ''} ${estadoConversaAtual.intencao ? 'NÃO pergunte se quer vender ou alugar.' : ''} Se tem intenção+metragem+ocupação+valor, chame qualificar_lead COM TODOS OS DADOS.`
        },
        { role: 'user' as const, content: ultimaMsgUser?.content || '' }
      ],
      origem: 'cache',
      cachedHistoryLength: cachedHistory.length,
    };
  }

  return {
    inputSDK: construirInputPrimeiroTurno({ mensagens, estadoConversaAtual, config, contexto }),
    origem: 'primeiro_turno',
    cachedHistoryLength: 0,
  };
}