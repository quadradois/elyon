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
  obterHashResposta
} from '../lib/redis-cache';
// 🆕 Orquestrador dos 4 Agentes de Captação
import {
  processarMensagemOrquestrada,
  buscarConfiguracaoTenant,
  buscarContextoConversa
} from '../agentes/orchestrator';
import { ragConversasService } from '../servicos/rag-conversas';
import { ConverterParaLeadUseCase } from '../casos-de-uso/agentes/converter-para-lead.usecase';
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

const router = Router();
const MODO_OUTBOUND_ONLY = process.env.MODO_OUTBOUND_ONLY !== 'false';
const DESATIVAR_INBOUND = process.env.DESATIVAR_INBOUND !== 'false';
const converterParaLeadUseCase = new ConverterParaLeadUseCase();



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

  const resultadoConversao = await converterParaLeadUseCase.execute({
    contatoId: params.contatoId,
    tipoInteresse: deteccao.tipoInteresse,
    temperatura: deteccao.temperatura,
    timeline: deteccao.timeline,
    situacaoAtual: params.textoConversa
  });

  if (resultadoConversao.success) {
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
      reasonCode: resultadoConversao.reasonCode,
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
            mensagemProspeccaoId: mensagemCriada.id
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
      ORDER BY l.id IS NOT NULL DESC, c."atualizadoEm" DESC
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
        ORDER BY l.id IS NOT NULL DESC, c."atualizadoEm" DESC
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
const DEBOUNCE_MS = 5000; // 5 segundos de espera para acumular mensagens

// Tempo mínimo entre respostas para o mesmo contato (10 segundos)
const COOLDOWN_RESPOSTA_MS = 10000;
const TTL_IDEMPOTENCIA_LOTE_MS = 2 * 60 * 1000;
const TTL_DEDUPE_RESPOSTA_MS = 30 * 1000;
const DEBOUNCE_RETRY_WHEN_LOCKED_MS = 1500;
const MAX_TENTATIVAS_ENVIO_WHATSAPP = 3;

// Estrutura para armazenar mensagens pendentes por contato
interface MensagemPendente {
  conteudo: string;
  tipo: string;
  messageId?: string;
  timestamp: number;
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

function normalizarTextoAssinatura(texto: string): string {
  return (texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
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

async function deveEnviarResposta(contatoId: string, resposta: string): Promise<boolean> {
  const hash = normalizarTextoAssinatura(resposta).slice(0, 400);
  if (!hash) return false;

  const ultimo = await obterHashResposta(contatoId);
  if (ultimo && ultimo === hash) {
    return false; // Mesma resposta recente
  }

  await registrarHashResposta(contatoId, hash);
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

            if (texto || isMedia) {
              console.log(`[Webhook] 📨 Mensagem de ${telefone}: "${texto || '[Mídia]'}"`);

              // ====================================
              // 1. VERIFICAR SE É RESPOSTA DE PROSPECÇÃO ATIVA
              // ====================================
              const contatoProspeccao = await buscarContatoProspeccao(telefone);

              if (contatoProspeccao) {
                console.log(`[Webhook] 🎯 Prospecção Ativa: ${contatoProspeccao.nome}`);

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
                    conteudo: texto || (isMedia ? '[Mídia]' : ''),
                    tipo: isImage ? 'IMAGEM' : isAudio ? 'AUDIO' : 'TEXTO',
                    messageId: messageId,
                    telefone: telefone
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
                  conteudo: texto || (isMedia ? '[Mídia]' : ''),
                  tipo: isImage ? 'IMAGEM' : isAudio ? 'AUDIO' : 'TEXTO',
                  messageId: messageId,
                  timestamp: Date.now()
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

                    if (!(await iniciarProcessamentoSerializado(contatoProspeccao.id, assinaturaLote))) {
                      registrarIgnorado(telefone, 'idempotencia_lote_duplicado', contatoProspeccao.id);
                      return true;
                    }

                    try {

                      // Trava técnica: garantir conversão para lead ao detectar intenção de vender/alugar
                      // Executar antes da persistência para espelhar TODAS as mensagens no chat padrão do lead
                      await garantirConversaoAutomaticaSeElegivel({
                        contatoId: contatoProspeccao.id,
                        textoConversa: textoConsolidado
                      });

                      // Salvar TODAS as mensagens acumuladas
                      for (const msg of mensagensAcumuladas) {
                        await salvarMensagemProspeccao({
                          contatoId: contatoProspeccao.id,
                          direcao: 'ENTRADA',
                          conteudo: msg.conteudo,
                          tipo: msg.tipo,
                          messageId: msg.messageId,
                          telefone: telefone
                        });
                      }

                      // ── Captura automática de documentos WhatsApp ──
                      // Fire-and-forget: não bloqueia o fluxo principal
                      if (isMedia && contatoProspeccao.leadId) {
                        const tenantIdCaptura = contatoProspeccao.campanha?.tenantId || '';
                        capturarDocumentoWhatsapp({
                          message,
                          messageType,
                          leadId: contatoProspeccao.leadId,
                          tenantId: tenantIdCaptura,
                        }).catch(err =>
                          console.error('[Webhook] Falha silenciosa na captura de doc:', err)
                        );
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
                      const resultado = await processarMensagemOrquestrada(
                        msgsOrq,
                        configOrq,
                        {
                          ...contextoOrq,
                          contatoId: contatoProspeccao.id,
                          leadId: contatoProspeccao.leadId || undefined,
                          statusLead: contatoProspeccao.lead?.status || undefined,
                          empreendimento: empreendimentoContexto
                        }
                      );
                      console.log('[DEBUG_ORQUESTRADOR] Resposta bruta do processarMensagemOrquestrada:', JSON.stringify(resultado, null, 2));
                      if (resultado.sucesso) resposta = resultado.resposta;

                      // Enviar Resposta
                      if (resposta) {
                        if (!(await deveEnviarResposta(contatoProspeccao.id, resposta))) {
                          registrarIgnorado(telefone, 'resposta_duplicada_janela_curta', contatoProspeccao.id);
                          return true;
                        }

                        const envioOk = await enviarMensagemComRetry({
                          instanceName,
                          telefone,
                          resposta,
                          contatoId: contatoProspeccao.id
                        });

                        if (!envioOk) {
                          registrarIgnorado(telefone, 'falha_envio_whatsapp', contatoProspeccao.id);
                          return false;
                        }

                        await registrarResposta(contatoProspeccao.id);
                        await salvarMensagemProspeccao({ contatoId: contatoProspeccao.id, direcao: 'SAIDA', conteudo: resposta, tipo: 'TEXTO', telefone });
                      }
                    } finally {
                      await finalizarProcessamentoSerializado(contatoProspeccao.id, assinaturaLote, deveMarcarLoteComoProcessado);
                    }

                    return true;

                  } catch (err) {
                    console.error('[Debounce] Erro processamento:', err);
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
