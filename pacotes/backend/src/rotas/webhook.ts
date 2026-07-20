import { responderErro } from '../utilitarios/resposta';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';
import { normalizarTelefone } from '../utils/telefone';
// 🔄 Redis cache helpers (substitui Maps em memória)
import {
  marcarMensagemComoVista,
  jaVimosMensagem,
  registrarRespostaEnviada,
  estaNoCooldown,
  adquirirMutexContato,
  liberarMutexContato,
  marcarAssinaturaProcessada,
  obterAssinaturaProcessada,
  registrarHashResposta,
  obterHashResposta,
  registrarHashRespostaUnicaJanela
} from '../lib/redis-cache';
// 🆕 Orquestrador dos 4 Agentes de Captação
import {
  processarMensagemOrquestrada,
  buscarConfiguracaoTenant,
  buscarContextoConversa,
  resolverLeadIdCanonico
} from '../agentes/orchestrator';
import { ragConversasService } from '../servicos/rag-conversas';
import { ConverterParaLeadUseCase } from '../casos-de-uso/agentes/converter-para-lead.usecase';
import { QualificarLeadUseCase } from '../casos-de-uso/agentes/qualificar-lead.usecase';
import {
  DeteccaoInteresse,
  TelemetriaConversaoStatus,
  registrarTelemetriaConversao,
  detectarInteresseVendaLocacao,
  registrarIgnorado,
  TelemetriaSaidaStatus,
  registrarTelemetriaSaida,
  aguardar
} from '../servicos/webhook-utils';
import { capturarDocumentoWhatsapp, detectarTipoMidia } from '../servicos/servico-captura-documentos';
import { analisarMidiaParaContexto } from '../servicos/servico-analise-midia';
import { sintetizarFalaTenant } from '../servicos/servico-voz';
import {
  extrairSinaisNegociacaoHumana,
  deveAutoRetornarParaIA as avaliarAutoRetornoParaIA,
  deveExecutarFallbackConversao,
  deveExecutarFallbackAtualizacaoLead
} from './webhook-resilience';
import {
  autenticarWebhookEvolution,
  concluirEventoWebhook,
  hashPayload,
  liberarEventoWebhook,
  registrarEventoWebhook,
} from '../servicos/webhook-seguranca';
import {
  MARCADOR_AUDIO_NEGADO,
  MARCADOR_AUDIO_PERGUNTADO,
  MARCADOR_AUDIO_PERMITIDO,
  construirInstrucaoExclusividadePorTenant,
  construirInstrucaoTurnoMensagensSequenciais,
  detectarPermissaoAudioNoTexto,
  gerarAssinaturaLote,
  normalizarTextoAssinatura,
  normalizarTextoAssinaturaForte,
  preferenciaAudioPorObservacoes,
} from '../modulos/webhook/dominio/politicas-resposta';
import type { MensagemPendente, PreferenciaAudio } from '../modulos/webhook/dominio/tipos';
import {
  extrairMetadadosMidia,
  montarResumoMidiaParaIA,
  normalizarWebhookEvolutionGo,
} from '../modulos/webhook/adapters/evolution-go.adapter';
import { PrepararRespostaWebhookUseCase } from '../modulos/webhook/aplicacao/preparar-resposta.usecase';
import { DecidirCanalRespostaWebhookUseCase } from '../modulos/webhook/aplicacao/decidir-canal-resposta.usecase';
import {
  cancelarLoteInbound,
  concluirLoteInbound,
  falharLoteInbound,
  obterLoteReivindicado,
  registrarFragmentoInbound,
  reservarEfeitoLoteInbound,
  concluirEfeitoLoteInbound,
  liberarEfeitoLoteInbound,
  renovarLeaseLoteInbound,
  validarFencingLoteInbound,
} from '../servicos/consolidacao-mensagens-inbound';
import { executarComandoFenced } from '../servicos/executor-comando-fenced';
import { normalizeRagQuery, selectRagFacts, withRagTimeout, type RagFact } from '../agentes/rag-facts-context';
import { recordRagRecovery, recordRagSelection } from '../observabilidade/rag-facts-metrics';

const router = Router();
const MODO_OUTBOUND_ONLY = process.env.MODO_OUTBOUND_ONLY !== 'false';
const DESATIVAR_INBOUND = process.env.DESATIVAR_INBOUND !== 'false';
const converterParaLeadUseCase = new ConverterParaLeadUseCase();
const qualificarLeadUseCase = new QualificarLeadUseCase();
const prepararRespostaWebhook = new PrepararRespostaWebhookUseCase();
const decidirCanalRespostaWebhook = new DecidirCanalRespostaWebhookUseCase();
const CAPTURA_DOCS_INCLUIR_AUDIO = process.env.CAPTURA_DOCS_INCLUIR_AUDIO === 'true';

function lerEnvMs(nome: string, padrao: number, min: number = 100, max: number = 120000): number {
  const bruto = Number(process.env[nome] || padrao);
  if (!Number.isFinite(bruto)) return padrao;
  return Math.max(min, Math.min(max, Math.round(bruto)));
}


async function garantirConversaoAutomaticaSeElegivel(params: {
  contatoId: string;
  textoConversa: string;
}) {
  const deteccao = detectarInteresseVendaLocacao(params.textoConversa);
  if (!deteccao) {
    registrarTelemetriaConversao({
      status: 'nao_elegivel',
      contatoId: params.contatoId,
      textoConversa: params.textoConversa,
      reasonCode: 'NO_INTEREST_SIGNAL'
    });
    return;
  }

  const contatoAtual = await prisma.lead.findUnique({
    where: { id: params.contatoId },
    select: { id: true, statusProspeccao: true }
  });

  if (!contatoAtual) {
    registrarTelemetriaConversao({
      status: 'ja_convertido',
      contatoId: params.contatoId,
      textoConversa: params.textoConversa,
      deteccao,
      reasonCode: 'CONTACT_NOT_FOUND',
      leadId: undefined
    });
    return;
  }

  // Primeiro tenta qualificar (fallback técnico),
  // depois converter (idempotente) para manter o fluxo principal coerente.
  const resultadoQualificacao = await qualificarLeadUseCase.execute({
    contatoId: params.contatoId,
    temperatura: deteccao.temperatura,
    interesse: deteccao.tipoInteresse,
    timeline: deteccao.timeline,
    situacaoAtual: params.textoConversa
  });

  const resultadoConversao = await converterParaLeadUseCase.execute({
    leadId: params.contatoId,
    tipoInteresse: deteccao.tipoInteresse,
    temperatura: deteccao.temperatura,
    timeline: deteccao.timeline,
    situacaoAtual: params.textoConversa
  });

  if (resultadoConversao.success || resultadoQualificacao.success) {
    const contatoPosConversao = await prisma.lead.findUnique({
      where: { id: params.contatoId },
      select: { id: true, statusProspeccao: true }
    });

    if (!contatoPosConversao) {
      registrarTelemetriaConversao({
        status: 'inconsistente_pos_conversao',
        contatoId: params.contatoId,
        textoConversa: params.textoConversa,
        deteccao,
        reasonCode: 'POST_CONVERSION_LINK_MISSING',
        erro: 'Conversão reportou sucesso, mas lead não encontrado após operação'
      });
      return;
    }

      registrarTelemetriaConversao({
        status: 'convertido',
        contatoId: params.contatoId,
        textoConversa: params.textoConversa,
        deteccao,
        reasonCode: resultadoConversao.reasonCode || (resultadoQualificacao.success ? 'QUALIFIED_AND_LINKED' : undefined),
        leadId: contatoPosConversao.id
      });
      return;
  }

  if (resultadoConversao.reasonCode === 'ALREADY_LEAD') {
    registrarTelemetriaConversao({
      status: 'ja_convertido',
      contatoId: params.contatoId,
      textoConversa: params.textoConversa,
      deteccao,
      reasonCode: resultadoConversao.reasonCode,
      leadId: resultadoConversao.leadId
    });
    return;
  }

  registrarTelemetriaConversao({
    status: 'falha_conversao',
    contatoId: params.contatoId,
    textoConversa: params.textoConversa,
    deteccao,
    reasonCode: resultadoConversao.reasonCode,
    erro: resultadoConversao.error || 'erro desconhecido',
    leadId: resultadoConversao.leadId
  });
}

async function houveExecucaoToolRecente(leadId: string, janelaSegundos: number = 120): Promise<boolean> {
  try {
    const limite = new Date(Date.now() - (janelaSegundos * 1000));
    const atividade = await prisma.atividade.findFirst({
      where: {
        leadId,
        titulo: { startsWith: 'TOOL_EXEC:' },
        criadoEm: { gte: limite },
      },
      select: { id: true },
      orderBy: { criadoEm: 'desc' }
    });
    return !!atividade;
  } catch (error) {
    console.warn('[Webhook] Erro ao verificar TOOL_EXEC recente:', error);
    return false;
  }
}

async function garantirAtualizacaoLeadBasicaSeElegivel(params: {
  contatoId: string;
  leadId: string;
  textoConversa: string;
}) {
  const houveTool = await houveExecucaoToolRecente(params.leadId, 120);
  const podeAtualizar = deveExecutarFallbackAtualizacaoLead({
    leadId: params.leadId,
    houveToolExecRecente: houveTool,
    textoConversa: params.textoConversa,
  });
  if (!podeAtualizar) return;

  const deteccao = detectarInteresseVendaLocacao(params.textoConversa);

  const resultado = await qualificarLeadUseCase.execute({
    contatoId: params.contatoId,
    temperatura: deteccao?.temperatura || 'MORNO',
    interesse: deteccao?.tipoInteresse || 'VENDA',
    timeline: deteccao?.timeline || undefined,
    situacaoAtual: params.textoConversa,
    observacoes: 'Fallback técnico: atualização automática por ausência de TOOL_EXEC no turno'
  });

  console.info(`[OBS] lead_update_fallback_executed contatoId=${params.contatoId} leadId=${params.leadId} success=${resultado?.success ? 'true' : 'false'}`);
}


/**
 * Salvar mensagem no histórico de prospecção
 * Verifica duplicidade pelo messageId para evitar mensagens repetidas
 */
async function salvarMensagemProspeccao(params: {
  contatoId: string;
  direcao: 'ENTRADA' | 'SAIDA';
  conteudo: string;
  tipo?: string;
  messageId?: string;
  telefone?: string;
  urlMidia?: string;
  mimeTypeMidia?: string;
  nomeArquivoMidia?: string;
}) {
  try {
    // Verificar duplicidade se tiver messageId
    if (params.messageId) {
      const existente = await prisma.mensagemProspeccao.findFirst({
        where: { messageId: params.messageId }
      });

      if (existente) {
        console.log(`[Webhook] ⚠️ Mensagem ${params.messageId} já existe, ignorando duplicata`);
        return;
      }
    }

    const mensagemCriada = await prisma.mensagemProspeccao.create({
      data: {
        leadId: params.contatoId,
        direcao: params.direcao,
        conteudo: params.conteudo,
        tipo: params.tipo || 'TEXTO',
        messageId: params.messageId,
        telefone: params.telefone
      }
    });

    // params.contatoId IS the lead's id in the unified Lead model
    const leadIdParaConversa = params.contatoId;

    if (leadIdParaConversa) {
      let conversa = await prisma.conversa.findFirst({
        where: {
          leadId: leadIdParaConversa,
          canal: 'WHATSAPP',
          estadoConversa: 'ativa'
        }
      });

      if (!conversa) {
        conversa = await prisma.conversa.create({
          data: {
            leadId: leadIdParaConversa,
            canal: 'WHATSAPP',
            numeroOrigem: params.telefone || '',
            estadoConversa: 'ativa',
            contexto: {}
          }
        });
      }

      await prisma.mensagem.create({
        data: {
          conversaId: conversa.id,
          remetente: params.direcao === 'ENTRADA' ? 'cliente' : 'assistente',
          conteudo: params.conteudo,
          tipo: params.tipo?.toLowerCase() || 'texto',
          metadata: {
            origem: 'prospeccao_ativa',
            messageId: params.messageId || null,
            mensagemProspeccaoId: mensagemCriada.id,
            urlMidia: params.urlMidia || null,
            mimeTypeMidia: params.mimeTypeMidia || null,
            nomeArquivoMidia: params.nomeArquivoMidia || null,
          },
          enviadaEm: new Date()
        }
      });

      await prisma.conversa.update({
        where: { id: conversa.id },
        data: { ultimaMensagemEm: new Date() }
      });
    }
  } catch (error) {
    console.error('[Webhook] Erro ao salvar mensagem de prospecção:', error);
  }
}

/**
 * Carregar histórico de mensagens para contexto do SDR
 * Retorna as últimas N mensagens ordenadas do mais antigo ao mais recente
 */
async function carregarHistoricoMensagens(
  contatoId: string,
  limite: number = 20
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  try {
    const mensagens = await prisma.mensagemProspeccao.findMany({
      where: {
        leadId: contatoId
      },
      orderBy: {
        dataHora: 'desc'
      },
      take: limite,
      select: {
        direcao: true,
        conteudo: true,
        dataHora: true
      }
    });

    // Inverter para ordem cronológica (mais antiga primeiro)
    const ordenado = mensagens.reverse();

    // Converter para formato OpenAI
    return ordenado.map((m: { direcao: string; conteudo: string }) => ({
      role: m.direcao === 'ENTRADA' ? 'user' as const : 'assistant' as const,
      content: m.conteudo
    }));
  } catch (error) {
    console.error('[Webhook] Erro ao carregar histórico:', error);
    return [];
  }
}

/**
 * Busca a configuração do agente SDR baseado na instância do WhatsApp
 * Prioriza:
 * 1. Agente vinculado à sessão WhatsApp (SessaoWhatsapp.agenteId)
 * 2. Agente padrão do tenant (ConfiguracaoAgente.tenantId)
 */
async function buscarConfiguracaoAgentePorInstancia(instanceName: string, tenantIdCampanha?: string) {
  // 1. Tentar achar sessão pelo instanceName
  const sessao = await prisma.sessaoWhatsapp.findUnique({
    where: { instanceName },
    include: {
      agente: true,
      tenant: {
        select: {
          nome: true,
          perfilVenda: true,
          perfilLocacao: true
        }
      }
    }
  });

  // Se achou sessão e tem agente vinculado, usa ele
  if (sessao?.agente) {
    if (!sessao.agente.estaAtivo || sessao.agente.status !== 'ATIVO') {
      return null;
    }
    return { ...sessao.agente, tenant: sessao.tenant };
  }

  // Se achou sessão mas sem agente, usa o tenant da sessão
  const tenantId = sessao?.tenantId || tenantIdCampanha;

  if (!tenantId) return null;

  // 2. Fallback: Buscar agente padrão do tenant
  const agente = await prisma.configuracaoAgente.findFirst({
    where: {
      tenantId,
      estaAtivo: true
    }
  });

  if (!agente) return null;

  // Buscar tenant para pegar política
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      nome: true,
      perfilVenda: true,
      perfilLocacao: true
    }
  });

  return { ...agente, tenant };
}

/**
 * Verifica se o telefone pertence a um contato de prospecção ativa
 * e retorna os dados do contato e campanha se existir
 * 
 * MELHORIA: Busca usando SQL para normalizar telefones no banco
 */
async function buscarContatoProspeccao(telefone: string, tenantIdConfiavel: string) {
  // Normalizar telefone de entrada (remover DDI e formatação)
  const telNormalizado = normalizarTelefone(telefone);

  // Pegar os últimos 8 dígitos
  const ultimosDigitos = telNormalizado.slice(-8);

  // Para lidar com telefones com/sem o nono dígito, vamos buscar também com variação
  let ultimosDigitosVar = '';
  if (telNormalizado.length === 11) {
    // Remove o nono dígito e pega últimos 8
    const semNono = telNormalizado.slice(0, 2) + telNormalizado.slice(3);
    ultimosDigitosVar = semNono.slice(-8);
  } else if (telNormalizado.length === 10) {
    // Adiciona o nono dígito e pega últimos 8
    const comNono = telNormalizado.slice(0, 2) + '9' + telNormalizado.slice(2);
    ultimosDigitosVar = comNono.slice(-8);
  }

  console.log(`[Webhook] Buscando contato - Tel: ${telNormalizado}, Últimos8: ${ultimosDigitos}, Variação: ${ultimosDigitosVar}`);

  try {
    // ✅ Usando $queryRaw com Prisma.sql (template tag seguro) em vez de $queryRawUnsafe
    // para eliminar risco de SQL Injection via interpolação de templates.
    const { Prisma } = await import('@prisma/client');

    // Query 1: busca pelo número principal
    let contatos = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT c.*,
             camp.id as "campanha_id",
             camp.nome as "campanha_nome",
             camp."nomeEmpreendimento" as "campanha_nomeEmpreendimento",
             camp."briefingCompleto" as "campanha_briefingCompleto",
             camp."tenantId" as "campanha_tenantId",
             t.nome as "tenant_nome",
             e.id as "empreendimento_id",
             e.nome as "empreendimento_nome",
             e."briefingCompleto" as "empreendimento_briefingCompleto",
             e."briefingEstruturado" as "empreendimento_briefingEstruturado",
             l.id as "lead_id",
             l.status as "lead_status",
             l."doresIdentificadas" as "lead_doresIdentificadas"
      FROM contatos c
      LEFT JOIN campanhas camp ON c."campanhaId" = camp.id
      LEFT JOIN tenants t ON camp."tenantId" = t.id
      LEFT JOIN empreendimentos_conhecimento e ON camp."empreendimentoId" = e.id
      LEFT JOIN leads l ON c."leadId" = l.id
      WHERE c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO')
        AND camp."tenantId" = ${tenantIdConfiavel}
        AND (
          RIGHT(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitos}
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone2, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitos}
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone3, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitos}
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone4, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitos}
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone5, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitos}
        )
      ORDER BY
        CASE
          WHEN c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO') THEN 0
          ELSE 1
        END,
        c."atualizadoEm" DESC
      LIMIT 1
    `);

    // Query 2: se não encontrou e temos variação (nono dígito), tenta com a variação
    if ((!contatos || contatos.length === 0) && ultimosDigitosVar) {
      contatos = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT c.*,
               camp.id as "campanha_id",
               camp.nome as "campanha_nome",
               camp."nomeEmpreendimento" as "campanha_nomeEmpreendimento",
               camp."briefingCompleto" as "campanha_briefingCompleto",
               camp."tenantId" as "campanha_tenantId",
               t.nome as "tenant_nome",
               e.id as "empreendimento_id",
               e.nome as "empreendimento_nome",
               e."briefingCompleto" as "empreendimento_briefingCompleto",
               e."briefingEstruturado" as "empreendimento_briefingEstruturado",
               l.id as "lead_id",
               l.status as "lead_status",
               l."doresIdentificadas" as "lead_doresIdentificadas"
        FROM contatos c
        LEFT JOIN campanhas camp ON c."campanhaId" = camp.id
        LEFT JOIN tenants t ON camp."tenantId" = t.id
        LEFT JOIN empreendimentos_conhecimento e ON camp."empreendimentoId" = e.id
        LEFT JOIN leads l ON c."leadId" = l.id
        WHERE c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO')
          AND camp."tenantId" = ${tenantIdConfiavel}
          AND (
            RIGHT(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitosVar}
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone2, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitosVar}
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone3, ''), '[^0-9]', '', 'g'), 8) = ${ultimosDigitosVar}
          )
        ORDER BY
          CASE
            WHEN c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO') THEN 0
            ELSE 1
          END,
          c."atualizadoEm" DESC
        LIMIT 1
      `);
    }

    if (contatos && contatos.length > 0) {
      const c = contatos[0];
      console.log(`[Webhook] Contato encontrado: contatoId=${c.id} leadId=${c.lead_id || 'N/A'} status=${c.lead_status || 'N/A'}`);

      // Montar objeto similar ao retorno do Prisma
      return {
        ...c,
        // Lead para os 4 agentes
        lead: c.lead_id ? {
          id: c.lead_id,
          status: c.lead_status,
          doresIdentificadas: c.lead_doresIdentificadas || []
        } : null,
        campanha: c.campanha_id ? {
          id: c.campanha_id,
          nome: c.campanha_nome,
          nomeEmpreendimento: c.campanha_nomeEmpreendimento,
          briefingCompleto: c.campanha_briefingCompleto,
          tenantId: c.campanha_tenantId,
          tenant: c.tenant_nome ? { nome: c.tenant_nome } : null,
          empreendimento: c.empreendimento_id ? {
            id: c.empreendimento_id,
            nome: c.empreendimento_nome,
            briefingCompleto: c.empreendimento_briefingCompleto,
            briefingEstruturado: c.empreendimento_briefingEstruturado
          } : null
        } : null
      };
    }

    console.log(`[Webhook] ❌ Contato NÃO encontrado para telefone ${telefone}`);
    return null;

  } catch (error) {
    console.error('[Webhook] Erro na busca de contato:', error);

    // Fallback para busca simples se SQL raw falhar
    console.log('[Webhook] Tentando fallback com busca simples...');
    const contato = await prisma.lead.findFirst({
      where: {
        tenantId: tenantIdConfiavel,
        OR: [
          { telefone: { contains: ultimosDigitos } },
          { telefone2: { contains: ultimosDigitos } },
        ],
        statusProspeccao: {
          in: ['CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO']
        }
      },
      include: {
        campanhaOrigem: {
          include: {
            tenant: true,
            empreendimento: true
          }
        }
      }
    });

    return contato;
  }
}

// ====================================
// 🛡️ PROTEÇÃO ANTI-FLOOD
// ====================================

// Constantes de tempo
const TEMPO_MAXIMO_MSG_MS = 48 * 60 * 60 * 1000; // 48 horas - ignora mensagens mais antigas
const TEMPO_VERIFICAR_RESPOSTA_MS = 5 * 60 * 1000; // 5 minutos - abaixo disso, processa direto

// ====================================
// 🧯 DEDUPE DE EVENTOS (EVOLUTION / WEBHOOK)
// ====================================

// NOTA: Dedupe de mensagens migrado para Redis (redis-cache.ts)
// As funções marcarMensagemComoVista/jaVimosMensagem foram movidas para lib/redis-cache.ts
// para sobreviver a restarts e suportar múltiplas réplicas.

/**
 * Verifica se já respondemos uma mensagem após um determinado timestamp
 * Usado para evitar responder mensagens antigas que já foram tratadas
 */
async function jaRespondemosMensagem(contatoId: string, timestampMensagem: Date): Promise<boolean> {
  try {
    // Buscar se existe alguma mensagem de SAÍDA (nossa resposta) após o timestamp da mensagem
    const respostaPosterior = await prisma.mensagemProspeccao.findFirst({
      where: {
        leadId: contatoId,
        direcao: 'SAIDA',
        dataHora: {
          gt: timestampMensagem
        }
      },
      orderBy: {
        dataHora: 'asc'
      }
    });

    return respostaPosterior !== null;
  } catch (error) {
    console.error('[Webhook] Erro ao verificar se já respondemos:', error);
    return false; // Em caso de erro, processa a mensagem
  }
}

/**
 * Verifica se uma mensagem deve ser processada baseado em regras anti-flood
 * Retorna: { processar: boolean, motivo: string }
 */
async function deveProcessarMensagem(
  messageTimestamp: number | undefined,
  messageId: string | undefined,
  contatoId: string | null
): Promise<{ processar: boolean; motivo: string }> {
  const agora = Date.now();

  if (messageId && contatoId) {
    try {
      const existente = await prisma.mensagemProspeccao.findFirst({
        where: {
          leadId: contatoId,
          messageId
        },
        select: { id: true }
      });

      if (existente) {
        return { processar: false, motivo: `messageId duplicado (${messageId})` };
      }
    } catch (error) {
      console.error('[Webhook] Erro ao verificar duplicidade por messageId:', error);
    }
  }

  // Se não tem timestamp, processar (mensagem nova)
  if (!messageTimestamp) {
    return { processar: true, motivo: 'Sem timestamp (assume nova)' };
  }

  // Converter timestamp para ms se necessário (Evolution pode enviar em segundos)
  const timestampMs = messageTimestamp > 9999999999 ? messageTimestamp : messageTimestamp * 1000;
  const idadeMensagem = agora - timestampMs;

  // REGRA 1: Mensagem muito antiga (> 48h) → IGNORAR SEMPRE
  if (idadeMensagem > TEMPO_MAXIMO_MSG_MS) {
    const horas = Math.round(idadeMensagem / 1000 / 60 / 60);
    return { processar: false, motivo: `Mensagem muito antiga (${horas}h > 48h)` };
  }

  // REGRA 2: Mensagem recente (< 5 min) → PROCESSAR SEMPRE
  if (idadeMensagem < TEMPO_VERIFICAR_RESPOSTA_MS) {
    return { processar: true, motivo: 'Mensagem recente (< 5min)' };
  }

  // REGRA 3: Mensagem entre 5min e 48h → Verificar se já respondemos
  if (contatoId) {
    const timestampDate = new Date(timestampMs);
    const jaRespondemos = await jaRespondemosMensagem(contatoId, timestampDate);

    if (jaRespondemos) {
      const minutos = Math.round(idadeMensagem / 1000 / 60);
      return { processar: false, motivo: `Mensagem de ${minutos}min atrás já foi respondida` };
    }
  }

  // Se chegou aqui, processa (mensagem entre 5min-48h sem resposta)
  const minutos = Math.round(idadeMensagem / 1000 / 60);
  return { processar: true, motivo: `Mensagem de ${minutos}min atrás ainda não respondida` };
}

// ====================================
// 🔄 DEBOUNCE DE MENSAGENS
// ====================================

// Tempo de espera para consolidar mensagens
// Mensagens que parecem completas usam DEBOUNCE_RAPIDO_MS (2s); parciais usam DEBOUNCE_MS (5s).
const DEBOUNCE_MS = lerEnvMs('WEBHOOK_DEBOUNCE_MS', 5000);
const DEBOUNCE_RAPIDO_MS = lerEnvMs('WEBHOOK_DEBOUNCE_RAPIDO_MS', 2000);

/**
 * Heurística: a mensagem parece completa (não haverá continuação imediata)?
 * Critérios: termina com pontuação final, tem >20 chars, é áudio/mídia, ou é uma única palavra curta.
 */
function mensagemPareceCompleta(texto: string): boolean {
  const t = texto.trim();
  if (!t) return true; // mídia sem texto
  if (/[.?!]$/.test(t)) return true;       // termina com pontuação
  if (t.length > 20) return true;           // mensagem longa — provavelmente completa
  if (/^(sim|não|nao|ok|s|n|claro|pode)$/i.test(t)) return true; // resposta curta fechada
  return false;
}

function calcularDebounce(texto: string): number {
  return mensagemPareceCompleta(texto) ? DEBOUNCE_RAPIDO_MS : DEBOUNCE_MS;
}

// Tempo mínimo entre respostas para o mesmo contato (10 segundos)
const COOLDOWN_RESPOSTA_MS = lerEnvMs('WEBHOOK_COOLDOWN_RESPOSTA_MS', 10000);
const TTL_IDEMPOTENCIA_LOTE_MS = 2 * 60 * 1000;
const TTL_DEDUPE_RESPOSTA_MS = 30 * 1000;
const DEBOUNCE_RETRY_WHEN_LOCKED_MS = lerEnvMs('WEBHOOK_DEBOUNCE_RETRY_WHEN_LOCKED_MS', 1500, 200, 30000);
const MAX_TENTATIVAS_ENVIO_WHATSAPP = 3;
const AUTORIZACAO_VENDA_DOC_URL = (process.env.AUTORIZACAO_VENDA_DOC_URL || '').trim();
const AUTORIZACAO_VENDA_DOC_NOME = (process.env.AUTORIZACAO_VENDA_DOC_NOME || 'modelo_autorizacao_venda.pdf').trim();
const AUTORIZACAO_VENDA_DOC_CAPTION = (process.env.AUTORIZACAO_VENDA_DOC_CAPTION || 'Segue o modelo de autorização de venda para você analisar com calma.').trim();
const AUTO_RETORNO_HUMANO_PARA_IA = (process.env.AUTO_RETORNO_HUMANO_PARA_IA || 'true') === 'true';

interface FilaContato {
  mensagens: MensagemPendente[];
  timer: NodeJS.Timeout | null;
  contatoData: any; // Dados do contato para processamento
  telefone: string;
  reagendado?: boolean;
}

function deveAutoRetornarParaIA(contatoProspeccao: any): boolean {
  const statusLead = contatoProspeccao?.lead?.status || contatoProspeccao?.lead_status || '';
  return avaliarAutoRetornoParaIA(AUTO_RETORNO_HUMANO_PARA_IA, statusLead);
}

// Fila de mensagens pendentes por contatoId
const filasDebounce = new Map<string, FilaContato>();

// ====================================
// 🔄 DEBOUNCE DE MENSAGENS (LEAD INBOUND)
// ====================================

interface FilaLeadInbound {
  mensagens: Array<{ conteudo: string; tipo: string; timestamp: number }>;
  timer: NodeJS.Timeout | null;
  reagendado?: boolean;
}

const filasDebounceInbound = new Map<string, FilaLeadInbound>();
const processandoLeadInbound = new Set<string>();

function adicionarAFilaDebounceInbound(
  leadId: string,
  mensagem: { conteudo: string; tipo: string; timestamp: number },
  processarCallback: () => Promise<void>
): void {
  let fila = filasDebounceInbound.get(leadId);

  if (!fila) {
    fila = { mensagens: [mensagem], timer: null, reagendado: false };
    filasDebounceInbound.set(leadId, fila);

    fila.timer = setTimeout(async () => {
      try {
        await processarCallback();
      } finally {
        filasDebounceInbound.delete(leadId);
      }
    }, DEBOUNCE_MS);
    return;
  }

  if (fila.timer) clearTimeout(fila.timer);
  fila.mensagens.push(mensagem);
  fila.reagendado = false;

  fila.timer = setTimeout(async () => {
    try {
      await processarCallback();
    } finally {
      filasDebounceInbound.delete(leadId);
    }
  }, DEBOUNCE_MS);
}

function obterMensagensConsolidadasInbound(leadId: string): string | null {
  const fila = filasDebounceInbound.get(leadId);
  if (!fila || fila.mensagens.length === 0) return null;

  const ordenadas = [...fila.mensagens].sort((a, b) => a.timestamp - b.timestamp);
  const textos = ordenadas
    .map(m => (m.conteudo || '').trim())
    .filter(Boolean);

  if (textos.length === 0) return null;
  return textos.join('\n');
}

// NOTA: Maps em memória migrados para Redis (redis-cache.ts)
// Constantes de tempo mantidas aqui para documentação, definidas uma vez acima.




async function enviarMensagemComRetry(params: {
  instanceName: string;
  telefone: string;
  resposta: string;
  contatoId: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ENVIO_WHATSAPP; tentativa++) {
    try {
      registrarTelemetriaSaida({
        status: 'tentativa',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP
      });

      const whatsappService = getWhatsAppService(params.instanceName);
      await whatsappService.enviarMensagemTexto(params.telefone, params.resposta, params.idempotencyKey);

      registrarTelemetriaSaida({
        status: 'sucesso',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP
      });
      return true;
    } catch (erro: any) {
      const statusCode = erro?.response?.status;
      const mensagemErro = erro?.response?.data?.message || erro?.message || 'erro desconhecido';

      registrarTelemetriaSaida({
        status: 'falha',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP,
        erro: mensagemErro,
        statusCode
      });

      if (tentativa < MAX_TENTATIVAS_ENVIO_WHATSAPP) {
        await aguardar(tentativa * 1500);
      }
    }
  }

  return false;
}

async function enviarMensagemAudioComRetry(params: {
  instanceName: string;
  telefone: string;
  audioBase64: string;
  contatoId: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ENVIO_WHATSAPP; tentativa++) {
    try {
      registrarTelemetriaSaida({
        status: 'tentativa',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP
      });

      const whatsappService = getWhatsAppService(params.instanceName);
      await whatsappService.enviarMensagemAudio(params.telefone, params.audioBase64, true, params.idempotencyKey);

      registrarTelemetriaSaida({
        status: 'sucesso',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP
      });
      return true;
    } catch (erro: any) {
      const statusCode = erro?.response?.status;
      const mensagemErro = erro?.response?.data?.message || erro?.message || 'erro desconhecido';

      registrarTelemetriaSaida({
        status: 'falha',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP,
        erro: mensagemErro,
        statusCode
      });

      if (tentativa < MAX_TENTATIVAS_ENVIO_WHATSAPP) {
        await aguardar(tentativa * 1500);
      }
    }
  }

  return false;
}

async function enviarDocumentoComRetry(params: {
  instanceName: string;
  telefone: string;
  contatoId: string;
  media: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_ENVIO_WHATSAPP; tentativa++) {
    try {
      registrarTelemetriaSaida({
        status: 'tentativa',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP
      });

      const whatsappService = getWhatsAppService(params.instanceName);
      await whatsappService.enviarMensagemDocumento(params.telefone, params.media, {
        fileName: params.fileName,
        mimeType: params.mimeType,
        caption: params.caption,
        idempotencyKey: params.idempotencyKey,
      });

      registrarTelemetriaSaida({
        status: 'sucesso',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP
      });
      return true;
    } catch (erro: any) {
      const statusCode = erro?.response?.status;
      const mensagemErro = erro?.response?.data?.message || erro?.message || 'erro desconhecido';

      registrarTelemetriaSaida({
        status: 'falha',
        contatoId: params.contatoId,
        telefone: params.telefone,
        tentativa,
        totalTentativas: MAX_TENTATIVAS_ENVIO_WHATSAPP,
        erro: mensagemErro,
        statusCode
      });

      if (tentativa < MAX_TENTATIVAS_ENVIO_WHATSAPP) {
        await aguardar(tentativa * 1500);
      }
    }
  }

  return false;
}

async function salvarPreferenciaAudioContato(contatoId: string, preferencia: PreferenciaAudio): Promise<void> {
  const contato = await prisma.lead.findUnique({
    where: { id: contatoId },
    select: { observacoes: true }
  });
  const obsAtual = contato?.observacoes || '';
  const obsLimpa = obsAtual
    .replace(MARCADOR_AUDIO_PERMITIDO, '')
    .replace(MARCADOR_AUDIO_NEGADO, '')
    .replace(MARCADOR_AUDIO_PERGUNTADO, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const marcador = preferencia === 'PERMITIDO'
    ? MARCADOR_AUDIO_PERMITIDO
    : preferencia === 'NEGADO'
      ? MARCADOR_AUDIO_NEGADO
      : MARCADOR_AUDIO_PERGUNTADO;

  await prisma.lead.update({
    where: { id: contatoId },
    data: {
      observacoes: [obsLimpa, marcador].filter(Boolean).join('\n')
    }
  });
}

async function iniciarProcessamentoSerializado(contatoId: string, assinatura: string): Promise<boolean> {
  const chave = `${contatoId}|${assinatura}`;

  // Verificar se já existe esta assinatura sendo processada
  const assinaturaAtual = await obterAssinaturaProcessada(contatoId);
  if (assinaturaAtual === assinatura) {
    return false; // Ja processando ou já processado
  }

  // Tentar adquirir mutex
  const adquiriu = await adquirirMutexContato(chave);
  return adquiriu;
}

async function finalizarProcessamentoSerializado(contatoId: string, assinatura: string, marcarComoProcessado: boolean) {
  await liberarMutexContato(`${contatoId}|${assinatura}`);

  if (marcarComoProcessado) {
    await marcarAssinaturaProcessada(contatoId, assinatura);
  }
}

async function deveEnviarResposta(params: {
  contatoId: string;
  leadId?: string | null;
  resposta: string;
}): Promise<boolean> {
  const hashBasico = normalizarTextoAssinatura(params.resposta).slice(0, 400);
  const hashForte = normalizarTextoAssinaturaForte(params.resposta).slice(0, 400);
  if (!hashBasico || !hashForte) return false;

  const scope = params.leadId ? `lead:${params.leadId}` : `contato:${params.contatoId}`;
  const ttlJanela = Math.max(
    15,
    Math.min(30, Math.round(Number(process.env.WEBHOOK_DEDUPE_RESPOSTA_JANELA_S || 20)))
  );

  // 1) Dedupe atômico por janela curta (hash forte + escopo)
  const unicoNaJanela = await registrarHashRespostaUnicaJanela(scope, hashForte, ttlJanela);
  if (!unicoNaJanela) return false;

  // 2) Compatibilidade: último hash por contato
  const ultimo = await obterHashResposta(params.contatoId);
  if (ultimo && (ultimo === hashBasico || ultimo === hashForte)) {
    return false;
  }

  await registrarHashResposta(params.contatoId, hashForte);
  return true;
}

// ✅ Versões assíncronas usando Redis (substitui Maps em memória)
async function podeMosResponder(contatoId: string): Promise<boolean> {
  return !(await estaNoCooldown(contatoId));
}

async function registrarResposta(contatoId: string): Promise<void> {
  await registrarRespostaEnviada(contatoId);
}

/**
 * Adiciona mensagem à fila de debounce e agenda processamento
 * Retorna true se a mensagem foi adicionada à fila (processamento será feito depois)
 * Retorna false se deve processar imediatamente (primeira mensagem)
 */
function agendarProcessamentoFilaDebounce(
  contatoId: string,
  processarCallback: () => Promise<boolean>,
  delayMs: number
) {
  const fila = filasDebounce.get(contatoId);
  if (!fila) return;

  if (fila.timer) {
    clearTimeout(fila.timer);
  }

  fila.timer = setTimeout(async () => {
    const filaAtual = filasDebounce.get(contatoId);
    if (!filaAtual) return;

    const adquiriuLock = await adquirirMutexContato(contatoId);
    if (!adquiriuLock) {
      if (!filaAtual.reagendado) {
        filaAtual.reagendado = true;
        console.log(`[Debounce] 🔁 Contato ${contatoId} ainda processando; reagendando fila em ${DEBOUNCE_RETRY_WHEN_LOCKED_MS}ms`);
      }
      agendarProcessamentoFilaDebounce(contatoId, processarCallback, DEBOUNCE_RETRY_WHEN_LOCKED_MS);
      return;
    }

    filaAtual.reagendado = false;
    let limparFila = true;
    try {
      limparFila = await processarCallback();
    } catch (error) {
      console.error(`[Debounce] Erro ao processar fila:`, error);
      limparFila = true;
    } finally {
      await liberarMutexContato(contatoId);
      if (limparFila) {
        filasDebounce.delete(contatoId);
      } else {
        agendarProcessamentoFilaDebounce(contatoId, processarCallback, DEBOUNCE_RETRY_WHEN_LOCKED_MS);
      }
    }
  }, delayMs);
}

function adicionarAFilaDebounce(
  contatoId: string,
  mensagem: MensagemPendente,
  contatoData: any,
  telefone: string,
  processarCallback: () => Promise<boolean>,
  delayMs: number = DEBOUNCE_MS
): boolean {
  let fila = filasDebounce.get(contatoId);

  if (!fila) {
    fila = {
      mensagens: [mensagem],
      timer: null,
      contatoData,
      telefone,
      reagendado: false
    };
    filasDebounce.set(contatoId, fila);

    console.log(`[Debounce] 📥 Nova fila para ${contatoId} - Aguardando ${delayMs / 1000}s...`);
    agendarProcessamentoFilaDebounce(contatoId, processarCallback, delayMs);
    return true;
  }

  // Já existe fila — adicionar e resetar timer (mantém delay original da 1ª mensagem)
  fila.mensagens.push(mensagem);
  fila.reagendado = false;
  console.log(`[Debounce] 📥 +1 mensagem na fila de ${contatoId} (total: ${fila.mensagens.length})`);

  if (fila.timer) clearTimeout(fila.timer);
  agendarProcessamentoFilaDebounce(contatoId, processarCallback, delayMs);

  return true;
}

/**
 * Obtém todas as mensagens pendentes de um contato e limpa a fila
 * Retorna as mensagens consolidadas em um único texto
 */
function obterMensagensConsolidadas(contatoId: string): { mensagens: MensagemPendente[]; textoConsolidado: string } | null {
  const fila = filasDebounce.get(contatoId);
  if (!fila || fila.mensagens.length === 0) {
    return null;
  }

  // Consolidar mensagens em um único texto
  const textoConsolidado = fila.mensagens
    .map(m => m.conteudo)
    .join('\n');

  console.log(`[Debounce] 📤 Consolidando ${fila.mensagens.length} mensagens de ${contatoId}`);

  return {
    mensagens: fila.mensagens,
    textoConsolidado
  };
}

export async function processarWebhookEvolution(req: Request, res: Response): Promise<unknown> {
  let registroId: string | undefined = req.get('x-elyon-inbox-id');
  const loteIdAgendado = req.get('x-elyon-batch-id');
  const ownerLoteAgendado = req.get('x-elyon-batch-owner');
  const fencingTokenAgendado = Number(req.get('x-elyon-batch-fencing-token'));
  const processamentoAgendado = Boolean(loteIdAgendado && ownerLoteAgendado && Number.isInteger(fencingTokenAgendado));
  try {
    if (!registroId && !processamentoAgendado) {
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      const payloadHash = hashPayload(rawBody);
      const { instanceToken: _instanceToken, ...payloadPersistivel } = req.body || {};
      const registro = await registrarEventoWebhook({
        provedor: 'EVOLUTION',
        eventoId: payloadHash,
        tipo: String(req.body?.event || req.body?.type || 'UNKNOWN'),
        payloadHash,
        payload: payloadPersistivel,
      });

      if (registro.duplicado) {
        return res.status(200).json({ status: 'duplicate_ignored' });
      }
      return res.status(202).json({ status: 'accepted', eventoId: registro.registroId });
    }

    req.body = normalizarWebhookEvolutionGo(req.body);
    const { event, type, instance, data, sender } = req.body;

    // Normalizar instanceName:
    // O Evolution GO manda em req.body.instanceName (normalizado para `instance`).
    let instanceName = instance;
    if (!instanceName && req.query.instance) {
      instanceName = String(req.query.instance);
    }
    if (!instanceName && data?.instance) {
      instanceName = data.instance;
    }

    // Se não conseguimos determinar a instância, retornar erro
    if (!instanceName) {
      console.error('[Webhook] ❌ Não foi possível determinar a instância do webhook');
      if (registroId) await concluirEventoWebhook(registroId);
      return responderErro(res, 400, 'Instância não especificada');
    }

    const sessaoConfiavel = await prisma.sessaoWhatsapp.findUnique({
      where: { instanceName },
      select: { tenantId: true },
    });
    if (!sessaoConfiavel) {
      return responderErro(res, 400, 'Instância não reconhecida');
    }

    const agora = new Date().toISOString();
    console.log(`--- WEBHOOK RECEBIDO [${agora}] ---`);
    console.log('Event:', event || type);
    // Log detalhado para debug (desabilitado para reduzir spam)

    // Suporta tanto 'event' (novo) quanto 'type' (antigo)
    const eventType = event || type;

    if (eventType === 'MESSAGES_UPSERT' || eventType === 'messages.upsert') {
      // Normalização das mensagens
      let messages: any[] = [];

      if (Array.isArray(data)) {
        messages = data;
      } else if (data?.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (data?.data) {
        messages = [data.data];
      } else if (data) {
        messages = [data];
      }

      console.log(`[Webhook] Processando ${messages.length} mensagens...`);

      for (const message of messages) {
        try {
          if (!message || !message.key) {
            console.warn('[Webhook] Mensagem inválida ignorada:', message);
            continue;
          }

          const remoteJid = message.key.remoteJid;
          const fromMe = message.key.fromMe;

          if (fromMe) {
            console.log('[Webhook] Ignorando mensagem enviada por mim (fromMe=true)');
            continue;
          }

          if (remoteJid) {
            // Lógica para garantir que pegamos o número de telefone correto
            let targetJid = remoteJid;
            const remoteJidAlt = message.key.remoteJidAlt;

            if (targetJid.includes('@lid') && remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
              targetJid = remoteJidAlt;
            }

            const telefone = targetJid.split('@')[0];
            const texto = message.message?.conversation || message.message?.extendedTextMessage?.text;
            const messageId = message.key?.id;

            // Verifica se é mídia
            const tipoMidiaDetectado = detectarTipoMidia(message);
            const messageType = tipoMidiaDetectado || message.messageType || 'conversation';
            const isImage = messageType === 'imageMessage';
            const isAudio = messageType === 'audioMessage';
            const isDocument = messageType === 'documentMessage' || messageType === 'documentWithCaptionMessage';
            const isVideo = messageType === 'videoMessage';
            const isMedia = isImage || isAudio || isDocument || isVideo;
            const metaMidia = isMedia ? extrairMetadadosMidia(message, messageType) : {};
            const analiseMidia = isMedia
              ? await analisarMidiaParaContexto({
                  messageType,
                  mediaUrl: metaMidia.url,
                  mediaBase64: metaMidia.base64,
                  mimeType: metaMidia.mimeType,
                  fileName: metaMidia.fileName,
                  caption: metaMidia.caption,
                })
              : null;
            const resumoMidiaIA = isMedia ? montarResumoMidiaParaIA(messageType, metaMidia, analiseMidia) : '';
            const tipoMensagemEntrada = isImage
              ? 'IMAGEM'
              : isAudio
                ? 'AUDIO'
                : isVideo
                  ? 'VIDEO'
                  : isDocument
                    ? 'DOCUMENTO'
                    : 'TEXTO';
            const conteudoEntrada = isMedia
              ? [texto, resumoMidiaIA].filter(Boolean).join('\n').trim()
              : (texto || '');

            if (conteudoEntrada || isMedia) {
              console.log(`[Webhook] Mensagem recebida: tipo=${tipoMensagemEntrada} possuiMidia=${isMedia}`);

              // ====================================
              // 1. RESOLVER LEAD ID CANÔNICO (tenant-safe)
              // ====================================
              const leadIdCanonico = await resolverLeadIdCanonico(telefone, sessaoConfiavel.tenantId);

              if (!leadIdCanonico) {
                // Falha fechada: sem Lead, ambíguo, ou Contato sem mapeamento válido
                registrarIgnorado(telefone, 'lead_nao_resolvido_ou_ambiguo', 'unknown');
                continue;
              }

              // Buscar dados do Lead para validações (campanha, blacklist, etc.)
              const leadDados = await prisma.lead.findUnique({
                where: { id: leadIdCanonico },
                include: {
                  campanhaOrigem: {
                    include: {
                      tenant: true,
                      empreendimento: true,
                    },
                  },
                },
              });

              if (!leadDados) {
                registrarIgnorado(telefone, 'lead_nao_encontrado_apos_resolucao', 'unknown');
                continue;
              }

              if (!leadDados.campanhaOrigemId) {
                console.log(`[Webhook] ⚠️ Lead ${leadIdCanonico} sem campanha vinculada - ignorando inbound`);
                registrarIgnorado(telefone, 'sem_campanha_vinculada', leadIdCanonico);
                continue;
              }

              // Verificar Blacklist
              const telefoneNormalizado = telefone.replace(/\D/g, '').slice(-8);
              const tenantIdLead = leadDados.campanhaOrigem?.tenantId;
              const estaBloqueado = await prisma.telefoneBlacklist.findFirst({
                where: {
                  telefone: { contains: telefoneNormalizado },
                  OR: [{ tenantId: tenantIdLead || '' }, { tenantId: null }]
                }
              });

              if (estaBloqueado) {
                registrarIgnorado(telefone, 'blacklist', leadIdCanonico);
                continue;
              }

              const conteudoDuravel = conteudoEntrada || (isMedia ? resumoMidiaIA : '');
              const eventoTecnicoDuravel = registroId || `evolution:${instanceName}:${messageId || hashPayload(req.body)}`;
              if (!processamentoAgendado) {
                await registrarFragmentoInbound({
                  tenantId: sessaoConfiavel.tenantId,
                  leadId: leadIdCanonico,
                  webhookEventoId: eventoTecnicoDuravel,
                  messageId,
                  conteudo: conteudoDuravel,
                  tipo: tipoMensagemEntrada,
                  metadata: {
                    urlMidia: isMedia ? metaMidia.url : undefined,
                    mimeTypeMidia: isMedia ? metaMidia.mimeType : undefined,
                    nomeArquivoMidia: isMedia ? metaMidia.fileName : undefined,
                  },
                  recebidoEm: new Date(),
                  janelaMs: calcularDebounce(conteudoDuravel),
                });
                continue;
              }

              // Verificar modo de atendimento no Lead
              const modoAtendimento = (leadDados as any).modoAtendimento || 'IA';
              if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO'
                || leadDados.statusProspeccao === 'OPTOUT' || leadDados.statusProspeccao === 'OPT_OUT') {
                await salvarMensagemProspeccao({
                  contatoId: leadIdCanonico, direcao: 'ENTRADA', conteudo: conteudoDuravel,
                  tipo: tipoMensagemEntrada, messageId, telefone,
                });
                const motivo = leadDados.statusProspeccao === 'OPTOUT' || leadDados.statusProspeccao === 'OPT_OUT'
                  ? 'OPT_OUT_BLOCKS_AI' : 'HUMAN_MODE_BLOCKS_AI';
                await cancelarLoteInbound(loteIdAgendado!, motivo, ownerLoteAgendado!, fencingTokenAgendado);
                continue;
              }

              const chaveMsgProsp = messageId
                ? `prosp:${instanceName}:${messageId}`
                : `prosp:${instanceName}:${telefone}:${(texto || '').slice(0, 120)}:${message.messageTimestamp || ''}`;
              const tentativaInbox = Number(req.get('x-elyon-inbox-attempt') || 1);
              if (tentativaInbox <= 1 && await jaVimosMensagem(chaveMsgProsp)) {
                console.log(`[Webhook] ⚠️ Prospecção duplicada detectada, ignorando: ${chaveMsgProsp}`);
                continue;
              }
              await marcarMensagemComoVista(chaveMsgProsp);

              // Verificar Anti-Flood
              const messageTimestamp = message.messageTimestamp;
              const verificacao = await deveProcessarMensagem(messageTimestamp, messageId, leadIdCanonico);

              if (!verificacao.processar) {
                registrarIgnorado(telefone, `anti-flood: ${verificacao.motivo}`, leadIdCanonico);
                continue;
              }

              // Verificar Modo de Atendimento
              const modoAtendimento = (leadDados as any).modoAtendimento || 'IA';
              if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO') {
                registrarIgnorado(telefone, `modo ${modoAtendimento}`, leadIdCanonico);
                const conteudoHumano = conteudoEntrada || (isMedia ? resumoMidiaIA : '');
                const sinaisNegociacao = extrairSinaisNegociacaoHumana(conteudoHumano);
                await salvarMensagemProspeccao({
                  contatoId: leadIdCanonico,
                  direcao: 'ENTRADA',
                  conteudo: conteudoHumano,
                  tipo: tipoMensagemEntrada,
                  messageId: messageId,
                  telefone: telefone,
                  urlMidia: isMedia ? metaMidia.url : undefined,
                  mimeTypeMidia: isMedia ? metaMidia.mimeType : undefined,
                  nomeArquivoMidia: isMedia ? metaMidia.fileName : undefined,
                });

                const resumoNegociacao = [
                  sinaisNegociacao.tipoAutorizacao ? `tipo=${sinaisNegociacao.tipoAutorizacao}` : '',
                  sinaisNegociacao.comissaoAcordada ? `comissao=${sinaisNegociacao.comissaoAcordada}` : '',
                  sinaisNegociacao.prazoTrabalho ? `prazo=${sinaisNegociacao.prazoTrabalho}d` : ''
                ].filter(Boolean).join(' | ');

                if (resumoNegociacao) {
                  await prisma.lead.update({
                    where: { id: leadIdCanonico },
                    data: {
                      observacoes: `${((leadDados as any).observacoes || '').trim()}\n[RESUMO_FASE_HUMANA] ${resumoNegociacao}`.trim()
                    }
                  });
                }

                if (!deveAutoRetornarParaIA(leadDados)) {
                  continue;
                }

                await prisma.lead.update({
                  where: { id: leadIdCanonico },
                  data: {
                    modoAtendimento: 'IA',
                    observacoes: `${((leadDados as any).observacoes || '').trim()}\n[AUTO_RETORNO_IA] ${new Date().toISOString()}`.trim()
                  }
                });
                console.info(`[OBS] ia_auto_return_triggered leadId=${leadIdCanonico} statusLead=${leadDados?.status || 'N/A'}`);
                (leadDados as any).modoAtendimento = 'IA';
                if (resumoNegociacao) {
                  (leadDados as any).observacoes = `${((leadDados as any).observacoes || '').trim()}\n[RESUMO_FASE_HUMANA] ${resumoNegociacao}`.trim();
                }
                console.log(`[Webhook] 🔄 Auto-retorno para IA aplicado ao lead ${leadIdCanonico}`);
              }

              // Atualizar status
              await prisma.lead.update({
                where: { id: leadIdCanonico },
                data: {
                  respondeu: true,
                  primeiraResposta: leadDados.primeiraResposta || new Date(),
                  statusProspeccao: 'RESPONDEU'
                }
              });

              // ====================================
              // ⏳ DEBOUNCE / BUFFER DE MENSAGENS
              // ====================================

                // Feedback imediato — dispara typing antes do debounce para o usuário
                // saber que a mensagem foi recebida. Fire-and-forget (não bloqueia).
                getWhatsAppService(instanceName)
                  .enviarIndicadorDigitando(telefone, 30000)
                  .catch(() => {/* silencioso */});

                const conteudoDebounce = conteudoEntrada || (isMedia ? resumoMidiaIA : '');
                const debounceMs = calcularDebounce(conteudoDebounce);

                const mensagemPendente: MensagemPendente = {
                  conteudo: conteudoDebounce,
                  tipo: tipoMensagemEntrada,
                  messageId: messageId,
                  timestamp: Date.now(),
                  urlMidia: isMedia ? metaMidia.url : undefined,
                  mimeTypeMidia: isMedia ? metaMidia.mimeType : undefined,
                  nomeArquivoMidia: isMedia ? metaMidia.fileName : undefined,
                };

                const processarAposDebounce = async (): Promise<boolean> => {
                  console.log(`[Debounce] Processando leadId=${leadIdCanonico}`);
                  
                  // 🔍 VERIFICAR COOLDOWN ANTES DE PROCESSAR
                  if (!(await podeMosResponder(leadIdCanonico))) {
                    registrarIgnorado(telefone, 'cooldown', leadIdCanonico);
                    return true;
                  }
                  
                  // 🔍 VERIFICAR SE MENSAGENS SÃO MUITO RECENTES (< 2 segundos)
                  // O claim PostgreSQL somente ocorre depois de fechaEm; nao existe
                  // uma segunda espera baseada no relogio local do processo.

                  try {
                    // Consolidar mensagens
                    const dadosDebounce = obterMensagensConsolidadas(leadIdCanonico);
                    const mensagensAcumuladas = dadosDebounce?.mensagens || [mensagemPendente];
                    const textoConsolidado = mensagensAcumuladas.map(m => m.conteudo).join('\n').trim();
                    const assinaturaLote = gerarAssinaturaLote(leadIdCanonico, mensagensAcumuladas);
                    let deveMarcarLoteComoProcessado = false;
                    const instrucaoTurnoSequencial = construirInstrucaoTurnoMensagensSequenciais(mensagensAcumuladas);

                    if (!(await iniciarProcessamentoSerializado(leadIdCanonico, assinaturaLote))) {
                      registrarIgnorado(telefone, 'idempotencia_lote_duplicado', leadIdCanonico);
                      return true;
                    }

                    try {

                      // Salvar TODAS as mensagens acumuladas
                      for (const msg of mensagensAcumuladas) {
                        await salvarMensagemProspeccao({
                          contatoId: leadIdCanonico,
                          direcao: 'ENTRADA',
                          conteudo: msg.conteudo,
                          tipo: msg.tipo,
                          messageId: msg.messageId,
                          telefone: telefone,
                          urlMidia: msg.urlMidia,
                          mimeTypeMidia: msg.mimeTypeMidia,
                          nomeArquivoMidia: msg.nomeArquivoMidia,
                        });
                      }

                      // ── Captura automática de documentos WhatsApp ──
                      // Fire-and-forget: não bloqueia o fluxo principal
                      const deveCapturarNoAcervo = isImage || isDocument || isVideo || (isAudio && CAPTURA_DOCS_INCLUIR_AUDIO);
                      if (deveCapturarNoAcervo && leadDados.leadId) {
                        const tenantIdCaptura = leadDados.campanhaOrigem?.tenantId || '';
                        capturarDocumentoWhatsapp({
                          message,
                          messageType,
                          leadId: leadDados.leadId,
                          tenantId: tenantIdCaptura,
                        }).catch(err =>
                          console.error('[Webhook] Falha silenciosa na captura de doc:', err)
                        );
                      } else if (isAudio && leadDados.leadId && !CAPTURA_DOCS_INCLUIR_AUDIO) {
                        console.log('[Webhook] 🎙️ Áudio recebido (não capturado em DocumentoLead por configuração).');
                      }

                      deveMarcarLoteComoProcessado = true;

                      // Carregar Histórico
                      const historicoMensagens = await carregarHistoricoMensagens(leadIdCanonico, 50);

                      // Configuração do Agente e Processamento
                      const tenantId = leadDados.campanhaOrigem?.tenantId;
                      const agenteConfig = await buscarConfiguracaoAgentePorInstancia(instanceName, tenantId);
                      if (!agenteConfig || !agenteConfig.estaAtivo || agenteConfig.status !== 'ATIVO') {
                        registrarIgnorado(telefone, 'agente_pausado', leadIdCanonico);
                        return true;
                      }
                      const perfilVendaTenant = (agenteConfig as any)?.tenant?.perfilVenda || {};
                      const respostaEmAudioAtiva = !!perfilVendaTenant?.respostaEmAudioAtiva;
                      const preferenciaAudioEntrada = detectarPermissaoAudioNoTexto(textoConsolidado);
                      let preferenciaAudio = preferenciaAudioEntrada
                        || preferenciaAudioPorObservacoes((leadDados as any).observacoes);

                      if (preferenciaAudioEntrada) {
                        await salvarPreferenciaAudioContato(leadIdCanonico, preferenciaAudioEntrada);
                        console.log(`[Webhook] Preferência de áudio atualizada: ${preferenciaAudioEntrada}`);
                      }

                      const vozPadraoTenant = typeof perfilVendaTenant?.vozPadraoTenant === 'string' && perfilVendaTenant.vozPadraoTenant.trim().length > 0
                        ? perfilVendaTenant.vozPadraoTenant.trim()
                        : 'onyx';
                      const provedorVozTenant = perfilVendaTenant?.provedorVozTenant === 'elevenlabs' ? 'elevenlabs' : 'openai';
                      const elevenLabsVoiceId = typeof perfilVendaTenant?.elevenLabsVoiceId === 'string'
                        ? perfilVendaTenant.elevenLabsVoiceId.trim()
                        : '';
                      const elevenLabsModelId = typeof perfilVendaTenant?.elevenLabsModelId === 'string'
                        ? perfilVendaTenant.elevenLabsModelId.trim()
                        : undefined;

                      const empreendimentoContexto =
                        leadDados.campanhaOrigem?.empreendimento?.nome
                        || leadDados.campanhaOrigem?.nomeEmpreendimento
                        || leadDados.nomeEdificio
                        || '';

                    // Fatos RAG permanecem separados de perfil, briefing e historico.
                    let fatosRagSelecionados: RagFact[] = [];

                    // 🧠 RAG DE CONVERSAS (Memória de longo prazo)
                    // Só busca se tiver texto suficiente na mensagem atual
                    const queryRag = normalizeRagQuery(textoConsolidado);
                    if (tenantId && queryRag.length > 5) {
                      try {
                        const ragResult = await withRagTimeout(ragConversasService.buscarContextoRelevante(
                          tenantId,
                          leadIdCanonico,
                          queryRag,
                          ['objecao_superada', 'script_eficaz', 'pergunta_frequente']
                        ), 2500);

                        const selecao = selectRagFacts({ candidates: ragResult.facts || [], tenantId, leadId: leadIdCanonico });
                        fatosRagSelecionados = selecao.facts;
                        recordRagSelection(selecao);
                        recordRagRecovery(ragResult.degraded ? 'degraded' : selecao.facts.length ? 'success' : 'empty');
                      } catch {
                        recordRagRecovery('degraded');
                        console.error('[Webhook] Falha degradada ao recuperar fatos RAG');
                      }
                    }

                      // Governança de config:
                      // - Preferir USAR_ORQUESTRADOR (nome atual)
                      // - Manter fallback para USAR_ORQUESTRADOR_4_AGENTES (legado)
                      const usarOrquestrador = (process.env.USAR_ORQUESTRADOR ?? process.env.USAR_ORQUESTRADOR_4_AGENTES ?? 'true') === 'true';
                      let resposta: string | undefined;

                    if (!usarOrquestrador) {
                      registrarIgnorado(telefone, 'outbound_only:orchestrator_desativado', leadIdCanonico);
                      return true;
                    }

                    const configOrq = await buscarConfiguracaoTenant(tenantId || '');
                    const contextoOrq = await buscarContextoConversa(telefone, tenantId || '', leadIdCanonico);

                    if (!configOrq) {
                      registrarIgnorado(telefone, 'outbound_only:config_orchestrator_nao_encontrada', leadIdCanonico);
                      return true;
                    }

                    const empreendimentoBriefing = leadDados.campanhaOrigem?.empreendimento as any;
                    const briefingEmpreendimento = empreendimentoBriefing?.briefingCompleto
                      || leadDados.campanhaOrigem?.briefingCompleto
                      || undefined;
                    if (briefingEmpreendimento) {
                      configOrq.briefingEmpreendimento = briefingEmpreendimento;
                    }

                      const sinaisTurnoHumano = extrairSinaisNegociacaoHumana(textoConsolidado);
                      const sinaisContextoHumano = extrairSinaisNegociacaoHumana((leadDados as any).observacoes || '');
                      const tipoAutorizacaoContexto = contextoOrq?.tipoAutorizacao
                        || sinaisTurnoHumano.tipoAutorizacao
                        || sinaisContextoHumano.tipoAutorizacao;
                      const comissaoAcordadaContexto = contextoOrq?.comissaoAcordada
                        || sinaisTurnoHumano.comissaoAcordada
                        || sinaisContextoHumano.comissaoAcordada;
                      const prazoTrabalhoContexto = contextoOrq?.prazoTrabalho
                        || sinaisTurnoHumano.prazoTrabalho
                        || sinaisContextoHumano.prazoTrabalho;

                      const resumoHumano = [
                        tipoAutorizacaoContexto ? `tipo=${tipoAutorizacaoContexto}` : '',
                        comissaoAcordadaContexto ? `comissao=${comissaoAcordadaContexto}` : '',
                        prazoTrabalhoContexto ? `prazo=${prazoTrabalhoContexto} dias` : ''
                      ].filter(Boolean).join(' | ');

                      const msgsOrq = historicoMensagens.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
                      const instrucaoExclusividade = construirInstrucaoExclusividadePorTenant(perfilVendaTenant, textoConsolidado);
                      const instrucaoTurnoFinal = [
                        instrucaoTurnoSequencial,
                        instrucaoExclusividade,
                        resumoHumano ? `Contexto estruturado da fase humana: ${resumoHumano}. Não repetir coleta desses pontos.` : ''
                      ]
                        .filter(Boolean)
                        .join('\n\n')
                        .trim() || undefined;

                      const resultado = await processarMensagemOrquestrada(
                        msgsOrq,
                        configOrq,
                        {
                          ...contextoOrq,
                          contatoId: leadIdCanonico,
                          leadId: leadIdCanonico,
                          durableExecutionId: processamentoAgendado ? `inbound-batch:${lote.id}` : undefined,
                          statusLead: leadDados.lead?.status || undefined,
                          empreendimento: empreendimentoContexto,
                          tipoAutorizacao: tipoAutorizacaoContexto,
                          comissaoAcordada: comissaoAcordadaContexto,
                          prazoTrabalho: prazoTrabalhoContexto,
                          ragFacts: fatosRagSelecionados,
                          instrucaoTurno: instrucaoTurnoFinal,
                          assertFencing: processamentoAgendado ? assertFencing : undefined,
                          withFencedTransaction: processamentoAgendado
                            ? <T>(command: () => Promise<T>) => executarComandoFenced({
                              loteId: lote.id, owner: ownerLote, fencingToken: lote.fencingToken,
                            }, command)
                            : undefined,
                          executeExternalEffect: processamentoAgendado
                            ? async (toolName: string, command: () => Promise<string>) => {
                              const tipoEfeito = `TOOL_EXTERNAL:${toolName}`;
                              const intencao = await reservarEfeitoLoteInbound(
                                lote.id, ownerLote, lote.fencingToken, tipoEfeito,
                              );
                              if (intencao.estado === 'CONCLUIDA') {
                                return intencao.resultado || JSON.stringify({ success: true, reconciled: true });
                              }
                              if (intencao.estado === 'RESERVADA') {
                                throw new Error(`EFEITO_EXTERNO_REQUER_RECONCILIACAO:${toolName}`);
                              }
                              const resultadoExterno = await command();
                              await assertFencing();
                              if (!(await concluirEfeitoLoteInbound(
                                lote.id, lote.fencingToken, tipoEfeito, resultadoExterno,
                              ))) throw new Error('LOTE_LEASE_PERDIDO');
                              return resultadoExterno;
                            }
                            : undefined,
                        }
                      );
                      if (processamentoAgendado) await assertFencing();
                      console.log('[ORQUESTRADOR] Processamento concluído');

                      // Fallback técnico:
                      // No modelo unificado, o Lead já é canônico.
                      // A auto-conversão não se aplica; apenas qualificação/atualização pode ocorrer.
                      const leadPosOrquestrador = await prisma.lead.findUnique({
                        where: { id: leadIdCanonico },
                        select: { id: true, statusProspeccao: true }
                      });
                      // Como o registro já é um Lead, virouLead=true e leadId=seu próprio id,
                      // portanto deveExecutarFallbackConversao retornará false (sem ação necessária).
                      if (!leadPosOrquestrador) {
                        const chaveFallbackConversao = `fallback-conversao:${leadIdCanonico}`;
                        const lockFallbackConversao = await adquirirMutexContato(chaveFallbackConversao);
                        const podeExecutarFallback = deveExecutarFallbackConversao({
                          virouLead: false,
                          leadId: null,
                          lockAdquirido: lockFallbackConversao
                        });
                        if (podeExecutarFallback) {
                          try {
                            await garantirConversaoAutomaticaSeElegivel({
                              contatoId: leadIdCanonico,
                              textoConversa: textoConsolidado
                            });
                          } finally {
                            await liberarMutexContato(chaveFallbackConversao);
                          }
                        } else {
                          console.info(`[OBS] conversion_race_prevented contatoId=${leadIdCanonico} lockAcquired=${lockFallbackConversao}`);
                        }
                      }
                      const leadIdAtualizado = leadPosOrquestrador?.id || leadIdCanonico || undefined;
                      if (leadIdAtualizado) {
                        if (processamentoAgendado) await assertFencing();
                        await garantirAtualizacaoLeadBasicaSeElegivel({
                          contatoId: leadIdCanonico,
                          leadId: leadIdAtualizado,
                          textoConversa: textoConsolidado
                        });
                      }


                      if (resultado.sucesso) resposta = resultado.resposta;
                      const respostaPreparada = prepararRespostaWebhook.execute({
                        respostaOrquestrador: resposta,
                        textoConsolidado,
                      });
                      resposta = respostaPreparada.resposta;
                      if (respostaPreparada.fallbackAplicado) {
                        registrarIgnorado(telefone, 'fallback_sem_silencio:orquestrador_sem_resposta', leadIdCanonico);
                      }
                      const { leadPediuDocumentoAutorizacao, respostaOfereceuEmail } = respostaPreparada;

                      const deveEnviarDocumentoAutorizacao = !!AUTORIZACAO_VENDA_DOC_URL && (leadPediuDocumentoAutorizacao || respostaOfereceuEmail);
                      if (deveEnviarDocumentoAutorizacao) {
                        if (processamentoAgendado) await assertFencing();
                        const intencaoDocumento = processamentoAgendado ? await reservarEfeitoLoteInbound(
                          loteIdAgendado!, ownerLoteAgendado!, fencingTokenAgendado, 'DOCUMENTO_AUTORIZACAO',
                        ) : undefined;
                        if (intencaoDocumento?.estado === 'RESERVADA') {
                          throw new Error('EVOLUTION_EFFECT_REQUIRES_RECONCILIATION:DOCUMENTO_AUTORIZACAO');
                        }
                        const documentoJaConfirmado = intencaoDocumento?.estado === 'CONCLUIDA';
                        const documentoEnviado = documentoJaConfirmado || await enviarDocumentoComRetry({
                          instanceName,
                          telefone,
                          contatoId: leadIdCanonico,
                          media: AUTORIZACAO_VENDA_DOC_URL,
                          fileName: AUTORIZACAO_VENDA_DOC_NOME,
                          mimeType: 'application/pdf',
                          caption: AUTORIZACAO_VENDA_DOC_CAPTION,
                          idempotencyKey: intencaoDocumento?.chaveIdempotencia,
                        });

                        if (documentoEnviado) {
                          if (processamentoAgendado && !documentoJaConfirmado) await concluirEfeitoLoteInbound(loteIdAgendado!, fencingTokenAgendado, 'DOCUMENTO_AUTORIZACAO');
                          if (processamentoAgendado) await assertFencing();
                          await salvarMensagemProspeccao({
                            contatoId: leadIdCanonico,
                            direcao: 'SAIDA',
                            conteudo: `[Documento enviado pelo agente] ${AUTORIZACAO_VENDA_DOC_NOME}`,
                            tipo: 'DOCUMENTO',
                            telefone
                          });

                          if (!/te enviei|acabei de te enviar|enviei aqui no whatsapp/i.test(resposta)) {
                            resposta = `Acabei de te enviar aqui no WhatsApp o documento de autorização para você analisar com calma.\n\n${resposta}`;
                          }
                        } else if (leadPediuDocumentoAutorizacao) {
                          if (processamentoAgendado && !documentoJaConfirmado) await liberarEfeitoLoteInbound(loteIdAgendado!, fencingTokenAgendado, 'DOCUMENTO_AUTORIZACAO');
                          resposta = `Consigo te mandar o documento por aqui no WhatsApp, mas houve uma instabilidade no envio agora. Se você quiser, já tento novamente em seguida.\n\n${resposta}`;
                        }
                      }

                      const decisaoCanal = decidirCanalRespostaWebhook.execute({
                        resposta,
                        textoConsolidado,
                        mensagens: mensagensAcumuladas,
                        respostaEmAudioAtiva,
                        preferenciaAudio,
                      });
                      resposta = decisaoCanal.resposta;
                      const enviarAudioNesteTurno = decisaoCanal.enviarAudio;
                      if (decisaoCanal.pedirPermissaoAudio) {
                        salvarPreferenciaAudioContato(leadIdCanonico, 'PERGUNTADO')
                          .catch(() => {/* silencioso */});
                      }

                      // Enviar Resposta
                      if (resposta) {
                        if (processamentoAgendado) await assertFencing();
                        if (!(await deveEnviarResposta({
                          contatoId: leadIdCanonico,
                          leadId: leadDados.leadId || undefined,
                          resposta
                        }))) {
                          registrarIgnorado(telefone, 'resposta_duplicada_janela_curta', leadIdCanonico);
                          return true;
                        }

                        let envioOk = false;
                        let enviadoComoAudio = false;
                        if (enviarAudioNesteTurno) {
                          const audioBase64 = await sintetizarFalaTenant(resposta, {
                            provedor: provedorVozTenant,
                            vozOpenAI: vozPadraoTenant,
                            elevenLabsVoiceId,
                            elevenLabsModelId,
                            perfil: perfilVendaTenant?.perfilVozTenant || 'vendas_alta_energia',
                          });
                          if (audioBase64) {
                            if (processamentoAgendado) await assertFencing();
                            const intencaoAudio = processamentoAgendado ? await reservarEfeitoLoteInbound(
                              loteIdAgendado!, ownerLoteAgendado!, fencingTokenAgendado, 'RESPOSTA_AUDIO',
                            ) : undefined;
                            if (intencaoAudio?.estado === 'RESERVADA') {
                              throw new Error('EVOLUTION_EFFECT_REQUIRES_RECONCILIATION:RESPOSTA_AUDIO');
                            }
                            const audioJaConfirmado = intencaoAudio?.estado === 'CONCLUIDA';
                            envioOk = audioJaConfirmado || await enviarMensagemAudioComRetry({
                              instanceName,
                              telefone,
                              audioBase64,
                              contatoId: leadIdCanonico,
                              idempotencyKey: intencaoAudio?.chaveIdempotencia,
                            });
                            if (envioOk && processamentoAgendado && !audioJaConfirmado) await concluirEfeitoLoteInbound(loteIdAgendado!, fencingTokenAgendado, 'RESPOSTA_AUDIO');
                            if (!envioOk && processamentoAgendado && !audioJaConfirmado) await liberarEfeitoLoteInbound(loteIdAgendado!, fencingTokenAgendado, 'RESPOSTA_AUDIO');
                            enviadoComoAudio = envioOk;
                          }
                        }

                        if (!envioOk) {
                          if (processamentoAgendado) await assertFencing();
                          const intencaoTexto = processamentoAgendado ? await reservarEfeitoLoteInbound(
                            loteIdAgendado!, ownerLoteAgendado!, fencingTokenAgendado, 'RESPOSTA_TEXTO',
                          ) : undefined;
                          if (intencaoTexto?.estado === 'RESERVADA') {
                            throw new Error('EVOLUTION_EFFECT_REQUIRES_RECONCILIATION:RESPOSTA_TEXTO');
                          }
                          const textoJaConfirmado = intencaoTexto?.estado === 'CONCLUIDA';
                          envioOk = textoJaConfirmado || await enviarMensagemComRetry({
                            instanceName,
                            telefone,
                            resposta,
                            contatoId: leadIdCanonico,
                            idempotencyKey: intencaoTexto?.chaveIdempotencia,
                          });
                          if (envioOk && processamentoAgendado && !textoJaConfirmado) await concluirEfeitoLoteInbound(loteIdAgendado!, fencingTokenAgendado, 'RESPOSTA_TEXTO');
                          if (!envioOk && processamentoAgendado && !textoJaConfirmado) await liberarEfeitoLoteInbound(loteIdAgendado!, fencingTokenAgendado, 'RESPOSTA_TEXTO');
                        }

                        if (!envioOk) {
                          registrarIgnorado(telefone, 'falha_envio_whatsapp', leadIdCanonico);
                          return false;
                        }

                        if (processamentoAgendado) await assertFencing();
                        await registrarResposta(leadIdCanonico);
                        if (processamentoAgendado) await assertFencing();
                        await salvarMensagemProspeccao({
                          contatoId: leadIdCanonico,
                          direcao: 'SAIDA',
                          conteudo: enviadoComoAudio ? `[Áudio enviado pelo agente] ${resposta}` : resposta,
                          tipo: enviadoComoAudio ? 'AUDIO' : 'TEXTO',
                          telefone
                        });
                      }
                    } finally {
                      await finalizarProcessamentoSerializado(leadIdCanonico, assinaturaLote, deveMarcarLoteComoProcessado);
                    }

                    // Se chegaram novas mensagens enquanto este lote era processado,
                    // mantém apenas as pendentes para uma nova rodada do debounce.
                    const filaPosProcessamento = filasDebounce.get(leadIdCanonico);
                    if (filaPosProcessamento) {
                      const quantidadeProcessada = mensagensAcumuladas.length;
                      if (filaPosProcessamento.mensagens.length > quantidadeProcessada) {
                        filaPosProcessamento.mensagens = filaPosProcessamento.mensagens.slice(quantidadeProcessada);
                        filaPosProcessamento.reagendado = false;
                        console.log(`[Debounce] ♻️ ${filaPosProcessamento.mensagens.length} mensagem(ns) chegaram durante o processamento; reagendando próximo lote`);
                        return false;
                      }

                      // Sem novas mensagens no meio do processamento: lote totalmente consumido.
                      filaPosProcessamento.mensagens = [];
                    }

                    return true;

                  } catch (err) {
                    console.error('[Debounce] Erro processamento:', err);
                    throw err;
                  }
                };

                const eventoTecnicoId = registroId || `evolution:${instanceName}:${messageId || hashPayload(req.body)}`;
                if (!processamentoAgendado) {
                  await registrarFragmentoInbound({
                    tenantId: sessaoConfiavel.tenantId,
                    leadId: leadIdCanonico,
                    webhookEventoId: eventoTecnicoId,
                    messageId,
                    conteudo: mensagemPendente.conteudo,
                    tipo: mensagemPendente.tipo,
                    metadata: {
                      urlMidia: mensagemPendente.urlMidia,
                      mimeTypeMidia: mensagemPendente.mimeTypeMidia,
                      nomeArquivoMidia: mensagemPendente.nomeArquivoMidia,
                    },
                    recebidoEm: new Date(mensagemPendente.timestamp),
                    janelaMs: debounceMs,
                  });
                  // O recibo termina aqui: o claimer duravel processa o lote somente
                  // depois de fechaEm, inclusive com um unico loop de worker.
                  continue;
                }

                const ownerLote = ownerLoteAgendado!;
                const lote = await obterLoteReivindicado(loteIdAgendado!, ownerLote, fencingTokenAgendado);
                if (lote.tenantId !== sessaoConfiavel.tenantId || lote.leadId !== leadIdCanonico) {
                  throw new Error('TENANT_MISMATCH: lote agendado nao pertence a sessao confiavel');
                }
                let leaseValido = true;
                const assertFencing = async (): Promise<void> => {
                  if (!leaseValido) throw new Error('LOTE_LEASE_PERDIDO');
                  await validarFencingLoteInbound(lote.id, ownerLote, lote.fencingToken);
                };
                {
                    const leadAtual = await prisma.lead.findFirst({
                      where: { id: leadIdCanonico, tenantId: sessaoConfiavel.tenantId },
                      select: { modoAtendimento: true, statusProspeccao: true },
                    });
                    if (!leadAtual) throw new Error('TENANT_MISMATCH: Lead ausente no momento do claim');
                    if (leadAtual.modoAtendimento === 'HUMANO' || leadAtual.modoAtendimento === 'PAUSADO') {
                      await cancelarLoteInbound(lote.id, 'HUMAN_MODE_BLOCKS_AI', ownerLote, lote.fencingToken);
                      break;
                    }
                    if (leadAtual.statusProspeccao === 'OPTOUT' || leadAtual.statusProspeccao === 'OPT_OUT') {
                      await cancelarLoteInbound(lote.id, 'OPT_OUT_BLOCKS_AI', ownerLote, lote.fencingToken);
                      break;
                    }

                    const mensagensPersistidas: MensagemPendente[] = lote.fragmentos.map((fragmento) => {
                      const metadata = (fragmento.metadata || {}) as Record<string, string | undefined>;
                      return {
                        conteudo: fragmento.conteudo,
                        tipo: fragmento.tipo,
                        messageId: fragmento.messageId || undefined,
                        timestamp: fragmento.recebidoEm.getTime(),
                        urlMidia: metadata.urlMidia,
                        mimeTypeMidia: metadata.mimeTypeMidia,
                        nomeArquivoMidia: metadata.nomeArquivoMidia,
                      };
                    });
                    filasDebounce.set(leadIdCanonico, {
                      mensagens: mensagensPersistidas,
                      timer: null,
                      contatoData: leadDados,
                      telefone,
                      reagendado: false,
                    });
                    const heartbeatLote = setInterval(() => {
                      void renovarLeaseLoteInbound(lote.id, ownerLote, undefined, lote.fencingToken)
                        .then((renovado) => {
                          if (!renovado) leaseValido = false;
                        })
                        .catch((error) => {
                          leaseValido = false;
                          console.error('[Debounce] Falha ao renovar lease do lote duravel:', error);
                        });
                    }, Math.max(10_000, Number(process.env.WEBHOOK_WORKER_LEASE_SECONDS || 300) * 1_000 / 3));
                    try {
                      await assertFencing();
                      if (!(await processarAposDebounce())) throw new Error('Lote duravel nao ficou pronto para conclusao');
                      await assertFencing();
                      if (!(await concluirLoteInbound(lote.id, ownerLote, lote.fencingToken))) throw new Error('Lease do lote perdido antes da conclusao');
                    } catch (error) {
                      await falharLoteInbound(lote.id, error, ownerLote, lote.fencingToken);
                      throw error;
                    } finally {
                      clearInterval(heartbeatLote);
                      filasDebounce.delete(leadIdCanonico);
                    }
                }

                // IMPORTANTÍSSIMO: Continue aqui impede que caia no fluxo de Lead Inbound
                continue;
              }

              // ====================================
              // 2. FLUXO NORMAL: LEAD INBOUND (Se não for prospecção)
              // ====================================

              if (MODO_OUTBOUND_ONLY || DESATIVAR_INBOUND) {
                registrarIgnorado(telefone, 'inbound_desativado_global:outbound_only');
                continue;
              }
            }
          }
        } catch (msgError) {
          console.error('[Webhook] Erro msg:', msgError);
          throw msgError;
        }
      }
    }

    // ====================================
    // CONNECTION_UPDATE — sincroniza status da sessão WhatsApp no DB
    // ====================================
    if (eventType === 'CONNECTION_UPDATE' || eventType === 'connection.update') {
      try {
        const state = data?.state || data?.status || data?.action;
        console.log(`[Webhook] 🔄 CONNECTION_UPDATE para ${instanceName}: state=${state}`);

        const sessao = await prisma.sessaoWhatsapp.findFirst({
          where: { instanceName }
        });

        if (sessao) {
          let novoStatus: 'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO' | null = null;

          if (state === 'open') {
            novoStatus = 'CONECTADO';
          } else if (state === 'connecting') {
            novoStatus = 'CONECTANDO';
          } else if (state === 'close') {
            novoStatus = 'DESCONECTADO';
          }

          if (novoStatus && novoStatus !== sessao.status) {
            await prisma.sessaoWhatsapp.update({
              where: { id: sessao.id },
              data: {
                status: novoStatus,
                ultimoStatus: new Date(),
                ...(novoStatus === 'DESCONECTADO' ? { numeroWhatsapp: null, nomeWhatsapp: null } : {})
              }
            });
            console.log(`[Webhook] ✅ Status sessão ${instanceName} atualizado: ${sessao.status} → ${novoStatus}`);
          }
        } else {
          console.warn(`[Webhook] ⚠️ CONNECTION_UPDATE para instância desconhecida: ${instanceName}`);
        }
      } catch (connErr) {
        console.error('[Webhook] Erro ao processar CONNECTION_UPDATE:', connErr);
      }
    }

    if (registroId) await concluirEventoWebhook(registroId);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    if (registroId) await liberarEventoWebhook(registroId).catch(() => undefined);
    console.error('Erro webhook:', error);
    responderErro(res, 500, 'Internal server error');
  }
}

router.post('/', autenticarWebhookEvolution, processarWebhookEvolution);

export default router;
