import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
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
  buscarContextoConversa
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

const router = Router();
const MODO_OUTBOUND_ONLY = process.env.MODO_OUTBOUND_ONLY !== 'false';
const DESATIVAR_INBOUND = process.env.DESATIVAR_INBOUND !== 'false';
const converterParaLeadUseCase = new ConverterParaLeadUseCase();
const qualificarLeadUseCase = new QualificarLeadUseCase();
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

  const contatoAtual = await prisma.contato.findUnique({
    where: { id: params.contatoId },
    select: { id: true, virouLead: true, leadId: true }
  });

  if (!contatoAtual || contatoAtual.virouLead || contatoAtual.leadId) {
    registrarTelemetriaConversao({
      status: 'ja_convertido',
      contatoId: params.contatoId,
      textoConversa: params.textoConversa,
      deteccao,
      reasonCode: !contatoAtual ? 'CONTACT_NOT_FOUND' : 'ALREADY_LEAD',
      leadId: contatoAtual?.leadId || undefined
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
    contatoId: params.contatoId,
    tipoInteresse: deteccao.tipoInteresse,
    temperatura: deteccao.temperatura,
    timeline: deteccao.timeline,
    situacaoAtual: params.textoConversa
  });

  if (resultadoConversao.success || resultadoQualificacao.success) {
    const contatoPosConversao = await prisma.contato.findUnique({
      where: { id: params.contatoId },
      select: { virouLead: true, leadId: true }
    });

    if (!contatoPosConversao?.virouLead || !contatoPosConversao?.leadId) {
      registrarTelemetriaConversao({
        status: 'inconsistente_pos_conversao',
        contatoId: params.contatoId,
        textoConversa: params.textoConversa,
        deteccao,
        reasonCode: 'POST_CONVERSION_LINK_MISSING',
        erro: 'Conversão reportou sucesso, mas contato não ficou vinculado a lead'
      });
      return;
    }

      registrarTelemetriaConversao({
        status: 'convertido',
        contatoId: params.contatoId,
        textoConversa: params.textoConversa,
        deteccao,
        reasonCode: resultadoConversao.reasonCode || (resultadoQualificacao.success ? 'QUALIFIED_AND_LINKED' : undefined),
        leadId: contatoPosConversao.leadId
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
        contatoId: params.contatoId,
        direcao: params.direcao,
        conteudo: params.conteudo,
        tipo: params.tipo || 'TEXTO',
        messageId: params.messageId,
        telefone: params.telefone
      }
    });

    const contatoComLead = await prisma.contato.findUnique({
      where: { id: params.contatoId },
      select: { leadId: true }
    });

    if (contatoComLead?.leadId) {
      let conversa = await prisma.conversa.findFirst({
        where: {
          leadId: contatoComLead.leadId,
          canal: 'WHATSAPP',
          estadoConversa: 'ativa'
        }
      });

      if (!conversa) {
        conversa = await prisma.conversa.create({
          data: {
            leadId: contatoComLead.leadId,
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
        contatoId: contatoId
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
async function buscarContatoProspeccao(telefone: string) {
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
      console.log(`[Webhook] ✅ Contato encontrado: ${c.nome} (${c.telefone}), Lead: ${c.lead_id || 'N/A'}, Status: ${c.lead_status || 'N/A'}`);

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
    const contato = await prisma.contato.findFirst({
      where: {
        OR: [
          { telefone: { contains: ultimosDigitos } },
          { telefone2: { contains: ultimosDigitos } },
        ],
        statusProspeccao: {
          in: ['CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO']
        }
      },
      include: {
        campanha: {
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
        contatoId: contatoId,
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
          contatoId,
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

// Tempo de espera para consolidar mensagens (5 segundos)
const DEBOUNCE_MS = lerEnvMs('WEBHOOK_DEBOUNCE_MS', 5000); // 5 segundos (default)

// Tempo mínimo entre respostas para o mesmo contato (10 segundos)
const COOLDOWN_RESPOSTA_MS = lerEnvMs('WEBHOOK_COOLDOWN_RESPOSTA_MS', 10000);
const TTL_IDEMPOTENCIA_LOTE_MS = 2 * 60 * 1000;
const TTL_DEDUPE_RESPOSTA_MS = 30 * 1000;
const DEBOUNCE_RETRY_WHEN_LOCKED_MS = lerEnvMs('WEBHOOK_DEBOUNCE_RETRY_WHEN_LOCKED_MS', 1500, 200, 30000);
const MAX_TENTATIVAS_ENVIO_WHATSAPP = 3;
const MARCADOR_AUDIO_PERMITIDO = '[PREFERENCIA_AUDIO=PERMITIDO]';
const MARCADOR_AUDIO_NEGADO = '[PREFERENCIA_AUDIO=NEGADO]';
const AUTORIZACAO_VENDA_DOC_URL = (process.env.AUTORIZACAO_VENDA_DOC_URL || '').trim();
const AUTORIZACAO_VENDA_DOC_NOME = (process.env.AUTORIZACAO_VENDA_DOC_NOME || 'modelo_autorizacao_venda.pdf').trim();
const AUTORIZACAO_VENDA_DOC_CAPTION = (process.env.AUTORIZACAO_VENDA_DOC_CAPTION || 'Segue o modelo de autorização de venda para você analisar com calma.').trim();

// Estrutura para armazenar mensagens pendentes por contato
interface MensagemPendente {
  conteudo: string;
  tipo: string;
  messageId?: string;
  timestamp: number;
  urlMidia?: string;
  mimeTypeMidia?: string;
  nomeArquivoMidia?: string;
}

interface FilaContato {
  mensagens: MensagemPendente[];
  timer: NodeJS.Timeout | null;
  contatoData: any; // Dados do contato para processamento
  telefone: string;
  reagendado?: boolean;
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
      await whatsappService.enviarMensagemTexto(params.telefone, params.resposta);

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
      await whatsappService.enviarMensagemAudio(params.telefone, params.audioBase64, true);

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

function normalizarTextoAssinatura(texto: string): string {
  return (texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizarTextoAssinaturaForte(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairMetadadosMidia(message: any, messageType: string): {
  caption?: string;
  fileName?: string;
  mimeType?: string;
  url?: string;
  base64?: string;
} {
  const payload = message?.message || {};
  const campoDireto = payload?.[messageType] || {};
  const campoDocComLegenda = payload?.documentWithCaptionMessage?.message?.documentMessage || {};
  const campo = Object.keys(campoDireto).length > 0 ? campoDireto : campoDocComLegenda;
  const base64 =
    campo?.base64
    || campo?.media
    || payload?.base64
    || message?.base64
    || message?.mediaBase64
    || message?.message?.base64
    || message?.message?.mediaBase64;

  return {
    caption: campo?.caption || payload?.extendedTextMessage?.text || undefined,
    fileName: campo?.fileName || campo?.title || undefined,
    mimeType: campo?.mimetype || undefined,
    url: campo?.url || campo?.mediaUrl || message?.mediaUrl || undefined,
    base64: typeof base64 === 'string' && !base64.startsWith('http') ? base64 : undefined,
  };
}

function montarResumoMidiaParaIA(messageType: string, meta: {
  caption?: string;
  fileName?: string;
  mimeType?: string;
}, analiseAutomatica?: string | null): string {
  const legenda = meta.caption ? ` | legenda: "${meta.caption}"` : '';
  const analise = analiseAutomatica ? ` | análise: ${analiseAutomatica}` : '';
  if (messageType === 'imageMessage') {
    return `[MÍDIA RECEBIDA: imagem enviada pelo lead${legenda}${analise}]`;
  }
  if (messageType === 'audioMessage') {
    return `[MÍDIA RECEBIDA: áudio enviado pelo lead${analise}]`;
  }
  if (messageType === 'videoMessage') {
    return `[MÍDIA RECEBIDA: vídeo enviado pelo lead${legenda}${analise}]`;
  }
  if (messageType === 'documentMessage' || messageType === 'documentWithCaptionMessage') {
    const nome = meta.fileName ? ` | arquivo: "${meta.fileName}"` : '';
    const mime = meta.mimeType ? ` | mime: ${meta.mimeType}` : '';
    return `[MÍDIA RECEBIDA: anexo/documento enviado pelo lead${nome}${mime}${legenda}${analise}]`;
  }
  return `[MÍDIA RECEBIDA pelo lead${analise ? ` | análise: ${analiseAutomatica}` : ''}]`;
}

function construirInstrucaoTurnoMensagensSequenciais(mensagens: MensagemPendente[]): string | undefined {
  if (!Array.isArray(mensagens) || mensagens.length <= 1) return undefined;

  const textos = mensagens
    .map((m) => (m?.conteudo || '').trim())
    .filter(Boolean);
  if (textos.length <= 1) return undefined;

  const blob = textos.join('\n').toLowerCase();
  const topicos: string[] = [];
  const instrucoesExtras: string[] = [];
  if (/como.*(encontrou|conseguiu).*(numero|número)|onde.*(conseguiu|pegou).*(numero|número)|de onde.*(numero|número)|lista p[úu]blica|privacidade/.test(blob)) {
    topicos.push('origem do número e privacidade');
  }
  if (/(quais|que|o que).*(informac|dados).*(enviar|preciso)|o que te enviar|quais informa(c|ç)ões tenho que te enviar/.test(blob)) {
    topicos.push('dados necessários para avançar');
  }
  if (/documenta(c|ç)[aã]o|documentos?|precisa de alguma documenta/.test(blob)) {
    topicos.push('documentação necessária');
  }
  if (/exclusiv|exclusivo|controle de tudo|como voc[eê]s conseguem ter o controle/.test(blob)) {
    topicos.push('modelo de trabalho e exclusividade');
  }

  const valoresDetectados = Array.from(
    new Set(
      (blob.match(/(?:r\$\s*)?\d{2,3}(?:[.\s]?\d{3})*(?:,\d{2})?|\b\d+(?:[.,]\d+)?\s*(?:k|mil|mi)\b/gi) || [])
        .map((v) => v.replace(/\s+/g, ' ').trim())
        .filter((v) => /\d/.test(v))
    )
  );
  if (valoresDetectados.length >= 2) {
    topicos.push('reconciliação de valores informados no mesmo contexto');
    instrucoesExtras.push(
      `Há potencial conflito de valor (${valoresDetectados.slice(0, 3).join(' vs ')}). Confirme o valor final com uma frase objetiva no formato: "Confirmando: R$ X líquidos para você, comissão à parte, certo?"`
    );
  }

  if (/\ba vista\b|à vista|financiamento|financiad[oa]/.test(blob)) {
    topicos.push('condição de pagamento');
    instrucoesExtras.push('Consolide condição financeira junto com valor final (à vista/financiamento e líquido/comissão).');
  }

  const mensagensComPergunta = textos.filter((t) => t.includes('?')).map((t) => t.slice(0, 140));
  const perguntasRecentes = mensagensComPergunta.length > 0
    ? `Perguntas recentes do lead: ${mensagensComPergunta.map((p) => `"${p}"`).join(' | ')}`
    : '';
  const topicosTxt = topicos.length > 0 ? topicos.join('; ') : 'responder todas as mensagens sequenciais sem omitir nenhuma pergunta';

  return `[INSTRUÇÃO DE TURNO - MENSAGENS SEQUENCIAIS]
O lead enviou múltiplas mensagens em sequência no mesmo contexto. Responda PRIMEIRO todos os tópicos pendentes antes de fazer uma nova pergunta.
Tópicos obrigatórios neste turno: ${topicosTxt}.
${perguntasRecentes}
${instrucoesExtras.join('\n')}
Regra: resposta única, objetiva, cobrindo tudo que o lead perguntou neste bloco.`;
}

function gerarFallbackSemSilencio(textoConsolidado: string): string {
  const t = (textoConsolidado || '').toLowerCase();
  if (/(como|onde).*(encontrou|conseguiu).*(numero|número)|de onde.*(numero|número)/.test(t)) {
    return 'Perfeito, te explico com transparência: seu contato veio de base pública de proprietários da região para prospecção imobiliária. Se preferir, eu encerro por aqui sem problema.';
  }
  if (/(quais|que|o que).*(informac|dados).*(enviar|preciso)|documenta(c|ç)[aã]o|documentos?/.test(t)) {
    return 'Ótima pergunta. Para avançar agora, preciso só de dados básicos do imóvel (metragem, situação, valor pretendido e se já está anunciando). A documentação completa fica para a etapa seguinte, com orientação do corretor.';
  }
  return 'Perfeito, recebi suas mensagens. Para não te deixar sem retorno: já organizei seu contexto aqui e vou te responder objetivamente no próximo passo. Pode contar comigo.';
}

function detectarPermissaoAudioNoTexto(texto: string): 'PERMITIDO' | 'NEGADO' | null {
  const normalizado = normalizarTextoAssinaturaForte(texto || '');
  if (!normalizado) return null;

  if (
    /\b(pode|podes|pode sim|manda|mandar|envia|enviar|responde|responder)\b.*\b(audio|áudio|voz|falando)\b/.test(normalizado)
    || /\b(audio|áudio|voz)\b.*\b(pode|sim|manda|envia|ok|pode sim)\b/.test(normalizado)
    || /\bpode mandar audio\b/.test(normalizado)
    || /\bmanda audio\b/.test(normalizado)
  ) {
    return 'PERMITIDO';
  }

  if (
    /\b(nao|não)\b.*\b(audio|áudio|voz)\b/.test(normalizado)
    || /\b(prefiro|melhor)\b.*\b(texto|escrito|mensagem)\b/.test(normalizado)
    || /\bsem audio\b/.test(normalizado)
    || /\bagora nao posso ouvir\b/.test(normalizado)
    || /\bnao posso ouvir\b/.test(normalizado)
  ) {
    return 'NEGADO';
  }

  return null;
}

function preferenciaAudioPorObservacoes(observacoes?: string | null): 'PERMITIDO' | 'NEGADO' | null {
  const obs = observacoes || '';
  if (obs.includes(MARCADOR_AUDIO_NEGADO)) return 'NEGADO';
  if (obs.includes(MARCADOR_AUDIO_PERMITIDO)) return 'PERMITIDO';
  return null;
}

async function salvarPreferenciaAudioContato(contatoId: string, preferencia: 'PERMITIDO' | 'NEGADO'): Promise<void> {
  const contato = await prisma.contato.findUnique({
    where: { id: contatoId },
    select: { observacoes: true }
  });
  const obsAtual = contato?.observacoes || '';
  const obsLimpa = obsAtual
    .replace(MARCADOR_AUDIO_PERMITIDO, '')
    .replace(MARCADOR_AUDIO_NEGADO, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const marcador = preferencia === 'PERMITIDO' ? MARCADOR_AUDIO_PERMITIDO : MARCADOR_AUDIO_NEGADO;

  await prisma.contato.update({
    where: { id: contatoId },
    data: {
      observacoes: [obsLimpa, marcador].filter(Boolean).join('\n')
    }
  });
}

function clienteMandouAudio(mensagens: MensagemPendente[]): boolean {
  return mensagens.some((m) => m.tipo === 'AUDIO');
}

function contemLinkOuAgendamentoOperacional(texto: string): boolean {
  const normalizado = normalizarTextoAssinaturaForte(texto || '');
  const bruto = texto || '';

  const contemLink =
    /https?:\/\/|www\.|wa\.me\/|bit\.ly\/|maps\.app\.goo\.gl|goo\.gl\/maps|calendar\.google|meet\.google|zoom\.us|teams\.microsoft/i.test(bruto);

  const contemAgenda =
    /\b(agendad[oa]|confirmad[oa]|marcad[oa]|horario confirmado|visita confirmada|agenda confirmada|reuniao confirmada|reunião confirmada)\b/.test(normalizado)
    || /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b.*\b(\d{1,2}h|\d{1,2}:\d{2})\b/.test(normalizado)
    || /\b(hoje|amanha|amanhã)\b.*\b(\d{1,2}h|\d{1,2}:\d{2})\b/.test(normalizado);

  return contemLink || contemAgenda;
}

function deveResponderEmAudio(params: {
  respostaEmAudioAtiva: boolean;
  preferenciaAudio: 'PERMITIDO' | 'NEGADO' | null;
  clienteEnviouAudio: boolean;
  resposta: string;
}): boolean {
  if (!params.respostaEmAudioAtiva) return false;
  if (contemLinkOuAgendamentoOperacional(params.resposta)) return false;
  if (params.preferenciaAudio === 'NEGADO') return false;
  if (params.preferenciaAudio === 'PERMITIDO') return true;
  if (params.clienteEnviouAudio) return true;

  return false;
}

function devePedirPermissaoAudio(params: {
  respostaEmAudioAtiva: boolean;
  preferenciaAudio: 'PERMITIDO' | 'NEGADO' | null;
  clienteEnviouAudio: boolean;
  textoConsolidado: string;
  resposta: string;
}): boolean {
  if (!params.respostaEmAudioAtiva) return false;
  if (params.preferenciaAudio) return false;
  if (params.clienteEnviouAudio) return false;
  if (detectarPermissaoAudioNoTexto(params.textoConsolidado)) return false;
  if (params.resposta.length < 140) return false;
  return true;
}

function anexarPedidoPermissaoAudio(resposta: string): string {
  const base = resposta.trim();
  const pedido = 'Se for mais prático pra você, posso te responder por áudio também. Pode ser ou prefere que eu mantenha tudo por texto?';
  if (base.toLowerCase().includes('responder por áudio') || base.toLowerCase().includes('responder em áudio')) {
    return base;
  }
  return `${base}\n\n${pedido}`;
}

function textoPedeDocumentoAutorizacao(texto: string): boolean {
  const normalizado = normalizarTextoAssinaturaForte(texto || '');
  if (!normalizado) return false;
  return /(manda|enviar|envia|me mostra|quero ver|pode mandar).*(documento|termos|autorizacao|autorização|contrato)/.test(normalizado)
    || /(documento|termos|autorizacao|autorização|contrato).*(manda|enviar|envia|ver)/.test(normalizado);
}

function respostaOfereceEmailParaTermos(resposta: string): boolean {
  const texto = normalizarTextoAssinaturaForte(resposta || '');
  return /(termos|autorizacao|autorização|documento).*(e mail|email)/.test(texto)
    || /(enviar|envio).*(e mail|email).*(termos|autorizacao|autorização|documento)/.test(texto);
}

function normalizarCanalTermosParaWhatsapp(resposta: string): string {
  let texto = resposta || '';
  texto = texto.replace(
    /quer que eu te envie os termos por e-?mail para ver antes ou prefere que o corretor explique tudo na nossa pr[oó]xima reuni[aã]o\?/gi,
    'Quer que eu te envie o documento de autorização aqui no WhatsApp para você analisar com calma, ou prefere que o corretor explique tudo na nossa próxima reunião?'
  );
  texto = texto.replace(/por e-?mail/gi, 'aqui no WhatsApp');
  return texto;
}

function construirInstrucaoExclusividadePorTenant(perfilVendaTenant: any, textoConsolidado: string): string | undefined {
  const texto = normalizarTextoAssinaturaForte(textoConsolidado || '');
  if (!/(exclusiv|exclusivo|controle de tudo)/.test(texto)) {
    return undefined;
  }

  const modalidades = Array.isArray(perfilVendaTenant?.modalidadesVenda)
    ? Array.from(new Set(perfilVendaTenant.modalidadesVenda))
    : [];
  const temExclusiva = modalidades.includes('EXCLUSIVA');
  const temNaoExclusiva = modalidades.includes('NAO_EXCLUSIVA');
  const preferencial = perfilVendaTenant?.modalidadePreferencial === 'NAO_EXCLUSIVA' ? 'NAO_EXCLUSIVA' : 'EXCLUSIVA';

  if (temExclusiva && !temNaoExclusiva) {
    return `[INSTRUÇÃO DE TURNO - EXCLUSIVIDADE]
Pergunta do lead sobre exclusividade detectada.
Responda DIRETAMENTE primeiro: esta imobiliária trabalha com autorização EXCLUSIVA.
Depois explique em linguagem consultiva (sem termos proibidos) e convide para próximo passo.
Nunca use "contrato simples" e nunca diga "duas opções de contrato".`;
  }

  if (!temExclusiva && temNaoExclusiva) {
    return `[INSTRUÇÃO DE TURNO - EXCLUSIVIDADE]
Pergunta do lead sobre exclusividade detectada.
Responda DIRETAMENTE primeiro: esta imobiliária trabalha com autorização NÃO EXCLUSIVA.
Depois explique como coordena processo e resultados mesmo sem exclusividade.
Nunca use "contrato simples" e nunca diga "duas opções de contrato".`;
  }

  // Ambas modalidades habilitadas (ou fallback)
  const prefTxt = preferencial === 'NAO_EXCLUSIVA' ? 'não exclusiva' : 'exclusiva';
  return `[INSTRUÇÃO DE TURNO - EXCLUSIVIDADE]
Pergunta do lead sobre exclusividade detectada.
Responda DIRETAMENTE primeiro: a imobiliária pode operar com autorização exclusiva e não exclusiva.
Em seguida, deixe claro que a recomendação inicial costuma ser ${prefTxt}, ajustada ao contexto do proprietário.
Nunca use "contrato simples" e nunca diga "duas opções de contrato".`;
}

function gerarAssinaturaLote(contatoId: string, mensagens: MensagemPendente[]): string {
  const ids = mensagens
    .map(msg => msg.messageId)
    .filter((id): id is string => !!id)
    .sort();

  if (ids.length > 0) {
    return `${contatoId}|ids:${ids.join('|')}`;
  }

  const textos = mensagens
    .map(msg => normalizarTextoAssinatura(msg.conteudo))
    .filter(Boolean)
    .join('|')
    .slice(0, 240);
  const ultimoTimestamp = mensagens.length > 0
    ? Math.max(...mensagens.map(msg => msg.timestamp || 0))
    : Date.now();
  const bucket = Math.floor(ultimoTimestamp / 5000);

  return `${contatoId}|txt:${textos}|n:${mensagens.length}|b:${bucket}`;
}

// ✅ limparCachesIdempotencia() não é mais necessária — Redis expira automaticamente via TTL

// ✅ Versão assíncrona usando Redis (substitui Maps em memória)
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
  processarCallback: () => Promise<boolean>
): boolean {
  let fila = filasDebounce.get(contatoId);

  if (!fila) {
    // Primeira mensagem - criar fila e agendar processamento
    fila = {
      mensagens: [mensagem],
      timer: null,
      contatoData,
      telefone,
      reagendado: false
    };
    filasDebounce.set(contatoId, fila);

    console.log(`[Debounce] 📥 Nova fila para ${contatoId} - Aguardando ${DEBOUNCE_MS / 1000}s...`);

    agendarProcessamentoFilaDebounce(contatoId, processarCallback, DEBOUNCE_MS);

    return true; // Mensagem adicionada, será processada depois
  }

  // Já existe fila - adicionar mensagem e resetar timer
  fila.mensagens.push(mensagem);
  fila.reagendado = false;
  console.log(`[Debounce] 📥 +1 mensagem na fila de ${contatoId} (total: ${fila.mensagens.length})`);

  // Resetar timer
  if (fila.timer) {
    clearTimeout(fila.timer);
  }

  agendarProcessamentoFilaDebounce(contatoId, processarCallback, DEBOUNCE_MS);

  return true; // Mensagem adicionada à fila existente
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

router.post('/', async (req, res) => {
  try {
    const { event, type, instance, data, sender } = req.body;

    // Normalizar instanceName:
    // A Evolution pode mandar em: req.body.instance, req.query.instance, ou dentro do req.body.data.instance.
    let instanceName = instance;
    if (!instanceName && req.query.instance) {
      instanceName = String(req.query.instance);
    }
    if (!instanceName && data?.instance) {
      instanceName = data.instance;
    }
    // Falha apenas se todos os cenários falharem
    instanceName = instanceName || process.env.EVOLUTION_INSTANCE_NAME;
    
    // Se não conseguimos determinar a instância, retornar erro
    if (!instanceName) {
      console.error('[Webhook] ❌ Não foi possível determinar a instância do webhook');
      return responderErro(res, 400, 'Instância não especificada');
    }

    const agora = new Date().toISOString();
    console.log(`--- WEBHOOK RECEBIDO [${agora}] ---`);
    console.log('Event:', event || type);
    // Log detalhado para debug (desabilitado para reduzir spam)
    // console.log('Body:', JSON.stringify(req.body, null, 2));

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
              console.log(`[Webhook] 📨 Mensagem de ${telefone}: "${conteudoEntrada || '[Mídia]'}"`);

              // ====================================
              // 1. VERIFICAR SE É RESPOSTA DE PROSPECÇÃO ATIVA
              // ====================================
              const contatoProspeccao = await buscarContatoProspeccao(telefone);

              if (contatoProspeccao) {
                console.log(`[Webhook] 🎯 Prospecção Ativa: ${contatoProspeccao.nome}`);

                if (!contatoProspeccao.campanhaId) {
                  console.log(`[Webhook] ⚠️ Contato ${contatoProspeccao.id} sem campanha vinculada - ignorando inbound`);
                  registrarIgnorado(telefone, 'sem_campanha_vinculada', contatoProspeccao.id);
                  continue;
                }

                // Verificar Blacklist
                const telefoneNormalizado = telefone.replace(/\D/g, '').slice(-8);
                const tenantIdContato = contatoProspeccao.campanha?.tenantId;
                const estaBloqueado = await prisma.telefoneBlacklist.findFirst({
                  where: {
                    telefone: { contains: telefoneNormalizado },
                    OR: [{ tenantId: tenantIdContato || '' }, { tenantId: null }]
                  }
                });

                if (estaBloqueado) {
                  registrarIgnorado(telefone, 'blacklist', contatoProspeccao.id);
                  continue;
                }

                const chaveMsgProsp = messageId
                  ? `prosp:${instanceName}:${messageId}`
                  : `prosp:${instanceName}:${telefone}:${(texto || '').slice(0, 120)}:${message.messageTimestamp || ''}`;
                if (await jaVimosMensagem(chaveMsgProsp)) {
                  console.log(`[Webhook] ⚠️ Prospecção duplicada detectada, ignorando: ${chaveMsgProsp}`);
                  continue;
                }
                await marcarMensagemComoVista(chaveMsgProsp);

                // Verificar Anti-Flood
                const messageTimestamp = message.messageTimestamp;
                const verificacao = await deveProcessarMensagem(messageTimestamp, messageId, contatoProspeccao.id);

                if (!verificacao.processar) {
                  registrarIgnorado(telefone, `anti-flood: ${verificacao.motivo}`, contatoProspeccao.id);
                  continue;
                }

                // Verificar Modo de Atendimento
                const modoAtendimento = (contatoProspeccao as any).modoAtendimento || 'IA';
                if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO') {
                  registrarIgnorado(telefone, `modo ${modoAtendimento}`, contatoProspeccao.id);
                  await salvarMensagemProspeccao({
                    contatoId: contatoProspeccao.id,
                    direcao: 'ENTRADA',
                    conteudo: conteudoEntrada || (isMedia ? resumoMidiaIA : ''),
                    tipo: tipoMensagemEntrada,
                    messageId: messageId,
                    telefone: telefone,
                    urlMidia: isMedia ? metaMidia.url : undefined,
                    mimeTypeMidia: isMedia ? metaMidia.mimeType : undefined,
                    nomeArquivoMidia: isMedia ? metaMidia.fileName : undefined,
                  });
                  continue;
                }

                // Atualizar status
                await prisma.contato.update({
                  where: { id: contatoProspeccao.id },
                  data: {
                    respondeu: true,
                    primeiraResposta: contatoProspeccao.primeiraResposta || new Date(),
                    statusProspeccao: 'RESPONDEU'
                  }
                });

                // ====================================
                // ⏳ DEBOUNCE / BUFFER DE MENSAGENS (20s)
                // ====================================

                const mensagemPendente: MensagemPendente = {
                  conteudo: conteudoEntrada || (isMedia ? resumoMidiaIA : ''),
                  tipo: tipoMensagemEntrada,
                  messageId: messageId,
                  timestamp: Date.now(),
                  urlMidia: isMedia ? metaMidia.url : undefined,
                  mimeTypeMidia: isMedia ? metaMidia.mimeType : undefined,
                  nomeArquivoMidia: isMedia ? metaMidia.fileName : undefined,
                };

                const processarAposDebounce = async (): Promise<boolean> => {
                  console.log(`[Debounce] 🚀 PROCESSANDO AGORA: ${contatoProspeccao.nome}`);
                  
                  // 🔍 VERIFICAR COOLDOWN ANTES DE PROCESSAR
                  if (!(await podeMosResponder(contatoProspeccao.id))) {
                    registrarIgnorado(telefone, 'cooldown', contatoProspeccao.id);
                    return true;
                  }
                  
                  // 🔍 VERIFICAR SE MENSAGENS SÃO MUITO RECENTES (< 2 segundos)
                  const dadosDebounce = obterMensagensConsolidadas(contatoProspeccao.id);
                  const mensagensAcumuladas = dadosDebounce?.mensagens || [mensagemPendente];
                  
                  const agora = Date.now();
                  const mensagemMaisRecente = Math.max(...mensagensAcumuladas.map(m => m.timestamp));
                  const tempoDesdeUltimaMensagem = agora - mensagemMaisRecente;
                  
                  if (tempoDesdeUltimaMensagem < 2000) { // Menos de 2 segundos
                    console.log(`[Debounce] ⏸️ MUITO RECENTE - Aguardando mais ${2000 - tempoDesdeUltimaMensagem}ms`);
                    
                    const fila = filasDebounce.get(contatoProspeccao.id);
                    if (fila && !fila.reagendado) {
                      fila.reagendado = true;
                      agendarProcessamentoFilaDebounce(contatoProspeccao.id, processarAposDebounce, 2000 - tempoDesdeUltimaMensagem);
                    }
                    return false;
                  }

                  try {
                    // Consolidar mensagens
                    const dadosDebounce = obterMensagensConsolidadas(contatoProspeccao.id);
                    const mensagensAcumuladas = dadosDebounce?.mensagens || [mensagemPendente];
                    const textoConsolidado = mensagensAcumuladas.map(m => m.conteudo).join('\n').trim();
                    const assinaturaLote = gerarAssinaturaLote(contatoProspeccao.id, mensagensAcumuladas);
                    let deveMarcarLoteComoProcessado = false;
                    const instrucaoTurnoSequencial = construirInstrucaoTurnoMensagensSequenciais(mensagensAcumuladas);

                    if (!(await iniciarProcessamentoSerializado(contatoProspeccao.id, assinaturaLote))) {
                      registrarIgnorado(telefone, 'idempotencia_lote_duplicado', contatoProspeccao.id);
                      return true;
                    }

                    try {

                      // Salvar TODAS as mensagens acumuladas
                      for (const msg of mensagensAcumuladas) {
                        await salvarMensagemProspeccao({
                          contatoId: contatoProspeccao.id,
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
                      if (deveCapturarNoAcervo && contatoProspeccao.leadId) {
                        const tenantIdCaptura = contatoProspeccao.campanha?.tenantId || '';
                        capturarDocumentoWhatsapp({
                          message,
                          messageType,
                          leadId: contatoProspeccao.leadId,
                          tenantId: tenantIdCaptura,
                        }).catch(err =>
                          console.error('[Webhook] Falha silenciosa na captura de doc:', err)
                        );
                      } else if (isAudio && contatoProspeccao.leadId && !CAPTURA_DOCS_INCLUIR_AUDIO) {
                        console.log('[Webhook] 🎙️ Áudio recebido (não capturado em DocumentoLead por configuração).');
                      }

                      deveMarcarLoteComoProcessado = true;

                      // Carregar Histórico
                      const historicoMensagens = await carregarHistoricoMensagens(contatoProspeccao.id, 50);

                      // Configuração do Agente e Processamento
                      const tenantId = contatoProspeccao.campanha?.tenantId;
                      const agenteConfig = await buscarConfiguracaoAgentePorInstancia(instanceName, tenantId);
                      if (!agenteConfig || !agenteConfig.estaAtivo || agenteConfig.status !== 'ATIVO') {
                        registrarIgnorado(telefone, 'agente_pausado', contatoProspeccao.id);
                        return true;
                      }
                      const perfilVendaTenant = (agenteConfig as any)?.tenant?.perfilVenda || {};
                      const respostaEmAudioAtiva = !!perfilVendaTenant?.respostaEmAudioAtiva;
                      const preferenciaAudioEntrada = detectarPermissaoAudioNoTexto(textoConsolidado);
                      let preferenciaAudio = preferenciaAudioEntrada
                        || preferenciaAudioPorObservacoes((contatoProspeccao as any).observacoes);

                      if (preferenciaAudioEntrada) {
                        await salvarPreferenciaAudioContato(contatoProspeccao.id, preferenciaAudioEntrada);
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
                        contatoProspeccao.campanha?.empreendimento?.nome
                        || contatoProspeccao.campanha?.nomeEmpreendimento
                        || contatoProspeccao.nomeEdificio
                        || '';

                    // Montar Contexto RAG
                    const partesRAG: string[] = [];
                    if (agenteConfig?.ragPerfilTexto) partesRAG.push(`### PERFIL DA IMOBILIÁRIA ###\n${agenteConfig.ragPerfilTexto}`);

                    const empreendimentoData = contatoProspeccao.campanha?.empreendimento as any;
                    if (empreendimentoData?.briefingCompleto) {
                      partesRAG.push(`### CONHECIMENTO DO EMPREENDIMENTO: ${empreendimentoData.nome} ###\n${empreendimentoData.briefingCompleto}`);
                    } else if (contatoProspeccao.campanha?.briefingCompleto) {
                      partesRAG.push(`### CONHECIMENTO DO EMPREENDIMENTO ###\n${contatoProspeccao.campanha.briefingCompleto}`);
                    }

                    // 🧠 RAG DE CONVERSAS (Memória de longo prazo)
                    // Só busca se tiver texto suficiente na mensagem atual
                    if (tenantId && mensagemPendente.conteudo.length > 5) {
                      try {
                        const ragResult = await ragConversasService.buscarContextoRelevante(
                          tenantId,
                          mensagemPendente.conteudo,
                          ['objecao_superada', 'script_eficaz', 'pergunta_frequente']
                        );

                        if (ragResult.contextoFormatado) {
                          partesRAG.push(ragResult.contextoFormatado);
                          console.log('[Webhook] 🧠 Contexto RAG injetado com sucesso');
                        }
                      } catch (ragError) {
                        console.error('[Webhook] Erro ao buscar RAG:', ragError);
                      }
                    }

                      const contextoRAG = partesRAG.length > 0 ? partesRAG.join('\n\n') : undefined;

                      // Governança de config:
                      // - Preferir USAR_ORQUESTRADOR (nome atual)
                      // - Manter fallback para USAR_ORQUESTRADOR_4_AGENTES (legado)
                      const usarOrquestrador = (process.env.USAR_ORQUESTRADOR ?? process.env.USAR_ORQUESTRADOR_4_AGENTES ?? 'true') === 'true';
                      let resposta: string | undefined;

                    if (!usarOrquestrador) {
                      registrarIgnorado(telefone, 'outbound_only:orchestrator_desativado', contatoProspeccao.id);
                      return true;
                    }

                    const configOrq = await buscarConfiguracaoTenant(tenantId || '');
                    const contextoOrq = await buscarContextoConversa(telefone, tenantId || '');

                    if (!configOrq) {
                      registrarIgnorado(telefone, 'outbound_only:config_orchestrator_nao_encontrada', contatoProspeccao.id);
                      return true;
                    }

                    const empreendimentoBriefing = contatoProspeccao.campanha?.empreendimento as any;
                    const briefingEmpreendimento = empreendimentoBriefing?.briefingCompleto
                      || contatoProspeccao.campanha?.briefingCompleto
                      || undefined;
                    if (briefingEmpreendimento) {
                      configOrq.briefingEmpreendimento = briefingEmpreendimento;
                    }

                      const msgsOrq = historicoMensagens.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
                      const instrucaoExclusividade = construirInstrucaoExclusividadePorTenant(perfilVendaTenant, textoConsolidado);
                      const instrucaoTurnoFinal = [instrucaoTurnoSequencial, instrucaoExclusividade]
                        .filter(Boolean)
                        .join('\n\n')
                        .trim() || undefined;

                      const resultado = await processarMensagemOrquestrada(
                        msgsOrq,
                        configOrq,
                        {
                          ...contextoOrq,
                          contatoId: contatoProspeccao.id,
                          leadId: contatoProspeccao.leadId || undefined,
                          statusLead: contatoProspeccao.lead?.status || undefined,
                          empreendimento: empreendimentoContexto,
                          instrucaoTurno: instrucaoTurnoFinal
                        }
                      );
                      console.log('[DEBUG_ORQUESTRADOR] Resposta bruta do processarMensagemOrquestrada:', JSON.stringify(resultado, null, 2));

                      // Fallback técnico:
                      // tenta auto-conversão somente se o fluxo principal (orquestrador/tools) ainda
                      // não tiver vinculado o contato a um lead.
                      const contatoPosOrquestrador = await prisma.contato.findUnique({
                        where: { id: contatoProspeccao.id },
                        select: { virouLead: true, leadId: true }
                      });
                      if (!contatoPosOrquestrador?.virouLead || !contatoPosOrquestrador?.leadId) {
                        await garantirConversaoAutomaticaSeElegivel({
                          contatoId: contatoProspeccao.id,
                          textoConversa: textoConsolidado
                        });
                      }

                      if (resultado.sucesso) resposta = resultado.resposta;
                      if (!resposta || !resposta.trim()) {
                        registrarIgnorado(telefone, 'fallback_sem_silencio:orquestrador_sem_resposta', contatoProspeccao.id);
                        resposta = gerarFallbackSemSilencio(textoConsolidado);
                      }
                      const leadPediuDocumentoAutorizacao = textoPedeDocumentoAutorizacao(textoConsolidado);
                      const respostaOfereceuEmail = respostaOfereceEmailParaTermos(resposta);
                      if (respostaOfereceuEmail) {
                        resposta = normalizarCanalTermosParaWhatsapp(resposta);
                      }

                      const deveEnviarDocumentoAutorizacao = !!AUTORIZACAO_VENDA_DOC_URL && (leadPediuDocumentoAutorizacao || respostaOfereceuEmail);
                      if (deveEnviarDocumentoAutorizacao) {
                        const documentoEnviado = await enviarDocumentoComRetry({
                          instanceName,
                          telefone,
                          contatoId: contatoProspeccao.id,
                          media: AUTORIZACAO_VENDA_DOC_URL,
                          fileName: AUTORIZACAO_VENDA_DOC_NOME,
                          mimeType: 'application/pdf',
                          caption: AUTORIZACAO_VENDA_DOC_CAPTION,
                        });

                        if (documentoEnviado) {
                          await salvarMensagemProspeccao({
                            contatoId: contatoProspeccao.id,
                            direcao: 'SAIDA',
                            conteudo: `[Documento enviado pelo agente] ${AUTORIZACAO_VENDA_DOC_NOME}`,
                            tipo: 'DOCUMENTO',
                            telefone
                          });

                          if (!/te enviei|acabei de te enviar|enviei aqui no whatsapp/i.test(resposta)) {
                            resposta = `Acabei de te enviar aqui no WhatsApp o documento de autorização para você analisar com calma.\n\n${resposta}`;
                          }
                        } else if (leadPediuDocumentoAutorizacao) {
                          resposta = `Consigo te mandar o documento por aqui no WhatsApp, mas houve uma instabilidade no envio agora. Se você quiser, já tento novamente em seguida.\n\n${resposta}`;
                        }
                      }
                      const clienteEnviouAudioNesteTurno = clienteMandouAudio(mensagensAcumuladas);
                      const enviarAudioNesteTurno = deveResponderEmAudio({
                        respostaEmAudioAtiva,
                        preferenciaAudio,
                        clienteEnviouAudio: clienteEnviouAudioNesteTurno,
                        resposta,
                      });
                      const pedirPermissaoAudioNesteTurno = devePedirPermissaoAudio({
                        respostaEmAudioAtiva,
                        preferenciaAudio,
                        clienteEnviouAudio: clienteEnviouAudioNesteTurno,
                        textoConsolidado,
                        resposta,
                      });

                      if (pedirPermissaoAudioNesteTurno) {
                        resposta = anexarPedidoPermissaoAudio(resposta);
                      }

                      // Enviar Resposta
                      if (resposta) {
                        if (!(await deveEnviarResposta({
                          contatoId: contatoProspeccao.id,
                          leadId: contatoProspeccao.leadId || undefined,
                          resposta
                        }))) {
                          registrarIgnorado(telefone, 'resposta_duplicada_janela_curta', contatoProspeccao.id);
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
                            envioOk = await enviarMensagemAudioComRetry({
                              instanceName,
                              telefone,
                              audioBase64,
                              contatoId: contatoProspeccao.id
                            });
                            enviadoComoAudio = envioOk;
                          }
                        }

                        if (!envioOk) {
                          envioOk = await enviarMensagemComRetry({
                            instanceName,
                            telefone,
                            resposta,
                            contatoId: contatoProspeccao.id
                          });
                        }

                        if (!envioOk) {
                          registrarIgnorado(telefone, 'falha_envio_whatsapp', contatoProspeccao.id);
                          return false;
                        }

                        await registrarResposta(contatoProspeccao.id);
                        await salvarMensagemProspeccao({
                          contatoId: contatoProspeccao.id,
                          direcao: 'SAIDA',
                          conteudo: enviadoComoAudio ? `[Áudio enviado pelo agente] ${resposta}` : resposta,
                          tipo: enviadoComoAudio ? 'AUDIO' : 'TEXTO',
                          telefone
                        });
                      }
                    } finally {
                      await finalizarProcessamentoSerializado(contatoProspeccao.id, assinaturaLote, deveMarcarLoteComoProcessado);
                    }

                    // Se chegaram novas mensagens enquanto este lote era processado,
                    // mantém apenas as pendentes para uma nova rodada do debounce.
                    const filaPosProcessamento = filasDebounce.get(contatoProspeccao.id);
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
                    try {
                      const dadosAtuais = obterMensagensConsolidadas(contatoProspeccao.id);
                      const textoFallback = dadosAtuais?.textoConsolidado || mensagemPendente.conteudo || '';
                      const respostaFallback = gerarFallbackSemSilencio(textoFallback);
                      const envioOk = await enviarMensagemComRetry({
                        instanceName,
                        telefone,
                        resposta: respostaFallback,
                        contatoId: contatoProspeccao.id
                      });
                      if (envioOk) {
                        await registrarResposta(contatoProspeccao.id);
                        await salvarMensagemProspeccao({ contatoId: contatoProspeccao.id, direcao: 'SAIDA', conteudo: respostaFallback, tipo: 'TEXTO', telefone });
                      }
                    } catch (fallbackErr) {
                      console.error('[Debounce] Falha no fallback anti-silêncio:', fallbackErr);
                    }
                    return true;
                  }
                };

                const adicionado = adicionarAFilaDebounce(contatoProspeccao.id, mensagemPendente, contatoProspeccao, telefone, processarAposDebounce);
                if (adicionado) console.log(`[Webhook] ⏳ DEBOUNCE: Mensagem aguardando ${DEBOUNCE_MS/1000}s...`);

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

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Erro webhook:', error);
    responderErro(res, 500, 'Internal server error');
  }
});

export default router;
