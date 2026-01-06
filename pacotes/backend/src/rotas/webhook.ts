import { Router } from 'express';
import { prisma } from '../lib/db';
import { openaiService } from '../servicos/openai';
import { elyonCore } from '../agentes/elyon-core';
import { ConfiguracaoAgente } from '../agentes/workers/sdr-worker';
import { getWhatsAppService } from '../servicos/whatsapp';
// SDR Agent usando @openai/agents SDK (gpt-4o-mini) - LEGADO
import { sdrAgentService, ConfiguracaoSdrAgent } from '../agentes/sdr-agent';
// 🆕 Orquestrador dos 4 Agentes de Captação
import {
  processarMensagemOrquestrada,
  buscarConfiguracaoTenant,
  buscarContextoConversa
} from '../agentes/orchestrator';
import { ragConversasService } from '../servicos/rag-conversas';

const router = Router();


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

    await prisma.mensagemProspeccao.create({
      data: {
        contatoId: params.contatoId,
        direcao: params.direcao,
        conteudo: params.conteudo,
        tipo: params.tipo || 'TEXTO',
        messageId: params.messageId,
        telefone: params.telefone
      }
    });
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
 * Normaliza telefone removendo formatação e DDI
 */
function normalizarTelefone(telefone: string): string {
  // Remove tudo que não é dígito
  const apenasDigitos = telefone.replace(/\D/g, '');

  // Remove DDI 55 se presente
  if (apenasDigitos.startsWith('55') && apenasDigitos.length > 11) {
    return apenasDigitos.slice(2);
  }

  return apenasDigitos;
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
    // Usar query raw para comparar telefones normalizados
    // REGEXP_REPLACE remove caracteres não-numéricos antes de comparar
    const contatos = await prisma.$queryRawUnsafe<any[]>(`
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
          RIGHT(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8) = $1
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone2, ''), '[^0-9]', '', 'g'), 8) = $1
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone3, ''), '[^0-9]', '', 'g'), 8) = $1
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone4, ''), '[^0-9]', '', 'g'), 8) = $1
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone5, ''), '[^0-9]', '', 'g'), 8) = $1
          ${ultimosDigitosVar ? `
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8) = $2
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone2, ''), '[^0-9]', '', 'g'), 8) = $2
          OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone3, ''), '[^0-9]', '', 'g'), 8) = $2
          ` : ''}
        )
      LIMIT 1
    `, ultimosDigitos, ultimosDigitosVar || ultimosDigitos);

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
const DEBOUNCE_MS = 10000; // 10 segundos de espera para acumular mensagens

// Tempo mínimo entre respostas para o mesmo contato (10 segundos)
const COOLDOWN_RESPOSTA_MS = 10000;

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
}

// Fila de mensagens pendentes por contatoId
const filasDebounce = new Map<string, FilaContato>();

// Registro de quando respondemos por último a cada contato
const ultimaRespostaPorContato = new Map<string, number>();

// 🔒 MUTEX: Controle de processamento em andamento por contato
const processandoContato = new Map<string, boolean>();

/**
 * Verifica se podemos responder ao contato (cooldown de 10s)
 */
function podeMosResponder(contatoId: string): boolean {
  const ultimaResposta = ultimaRespostaPorContato.get(contatoId);
  if (!ultimaResposta) return true;

  const tempoDesdeUltimaResposta = Date.now() - ultimaResposta;
  return tempoDesdeUltimaResposta > COOLDOWN_RESPOSTA_MS;
}

/**
 * Registra que respondemos ao contato
 */
function registrarResposta(contatoId: string): void {
  ultimaRespostaPorContato.set(contatoId, Date.now());

  // Limpar registros antigos (> 5 min) para não acumular memória
  const agora = Date.now();
  for (const [id, timestamp] of ultimaRespostaPorContato.entries()) {
    if (agora - timestamp > 5 * 60 * 1000) {
      ultimaRespostaPorContato.delete(id);
    }
  }
}

/**
 * Adiciona mensagem à fila de debounce e agenda processamento
 * Retorna true se a mensagem foi adicionada à fila (processamento será feito depois)
 * Retorna false se deve processar imediatamente (primeira mensagem)
 */
function adicionarAFilaDebounce(
  contatoId: string,
  mensagem: MensagemPendente,
  contatoData: any,
  telefone: string,
  processarCallback: () => Promise<void>
): boolean {
  let fila = filasDebounce.get(contatoId);

  if (!fila) {
    // Primeira mensagem - criar fila e agendar processamento
    fila = {
      mensagens: [mensagem],
      timer: null,
      contatoData,
      telefone
    };
    filasDebounce.set(contatoId, fila);

    console.log(`[Debounce] 📥 Nova fila para ${contatoId} - Aguardando ${DEBOUNCE_MS / 1000}s...`);

    // Agendar processamento após debounce
    fila.timer = setTimeout(async () => {
      try {
        await processarCallback();
      } catch (error) {
        console.error(`[Debounce] Erro ao processar fila:`, error);
      } finally {
        // Limpar fila após processamento
        filasDebounce.delete(contatoId);
      }
    }, DEBOUNCE_MS);

    return true; // Mensagem adicionada, será processada depois
  }

  // Já existe fila - adicionar mensagem e resetar timer
  fila.mensagens.push(mensagem);
  console.log(`[Debounce] 📥 +1 mensagem na fila de ${contatoId} (total: ${fila.mensagens.length})`);

  // Resetar timer
  if (fila.timer) {
    clearTimeout(fila.timer);
  }

  fila.timer = setTimeout(async () => {
    try {
      await processarCallback();
    } catch (error) {
      console.error(`[Debounce] Erro ao processar fila:`, error);
    } finally {
      filasDebounce.delete(contatoId);
    }
  }, DEBOUNCE_MS);

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

    // Normalizar instanceName (pode vir undefined em versões antigas)
    const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME || 'elyon_main';

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

            // Verifica se é mídia
            const messageType = message.messageType || (message.message?.imageMessage ? 'imageMessage' : (message.message?.audioMessage ? 'audioMessage' : 'conversation'));
            const isImage = messageType === 'imageMessage';
            const isAudio = messageType === 'audioMessage';
            const isMedia = isImage || isAudio;

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
                  console.log(`[Webhook] 🚫 BLACKLIST IGNORADA`);
                  continue;
                }

                // Verificar Anti-Flood
                const messageTimestamp = message.messageTimestamp;
                const messageId = message.key?.id;
                const verificacao = await deveProcessarMensagem(messageTimestamp, messageId, contatoProspeccao.id);

                if (!verificacao.processar) {
                  console.log(`[Webhook] ⏭️ IGNORADO ANTI-FLOOD: ${verificacao.motivo}`);
                  continue;
                }

                // Verificar Modo de Atendimento
                const modoAtendimento = (contatoProspeccao as any).modoAtendimento || 'IA';
                if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO') {
                  console.log(`[Webhook] ⏸️ Modo ${modoAtendimento} - Salvando mensagem sem resposta IA`);
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

                const processarAposDebounce = async () => {
                  console.log(`[Debounce] 🚀 PROCESSANDO AGORA: ${contatoProspeccao.nome}`);
                  processandoContato.set(contatoProspeccao.id, true);

                  try {
                    // Consolidar mensagens
                    const dadosDebounce = obterMensagensConsolidadas(contatoProspeccao.id);
                    const mensagensAcumuladas = dadosDebounce?.mensagens || [mensagemPendente];

                    // Salvar TODAS as mensagens acumuladas
                    for (const msg of mensagensAcumuladas) {
                      await salvarMensagemProspeccao({
                        contatoId: contatoProspeccao.id,
                        direcao: 'ENTRADA',
                        conteudo: msg.conteudo,
                        tipo: msg.tipo,
                        telefone: telefone
                      });
                    }

                    // Carregar Histórico
                    const historicoMensagens = await carregarHistoricoMensagens(contatoProspeccao.id, 20);

                    // Configuração do Agente e Processamento
                    const tenantId = contatoProspeccao.campanha?.tenantId;
                    const agenteConfig = await buscarConfiguracaoAgentePorInstancia(instanceName, tenantId);

                    // --- Mover lógica detalhada de configuração para helper se possível, mas mantendo aqui simplificado ---
                    const personalidadeAgente = agenteConfig?.personalidade as any;
                    const expertiseAgente = agenteConfig?.expertise as any;
                    const scriptsAgente = agenteConfig?.scripts as any;
                    const perfilImob = agenteConfig?.perfilImobiliaria as any;
                    const perfilVenda = agenteConfig?.tenant?.perfilVenda as any || {};
                    const perfilLocacao = agenteConfig?.tenant?.perfilLocacao as any || {};

                    const nomeImobiliariaResolvido =
                      perfilImob?.dadosGerais?.nomeImobiliaria ||
                      contatoProspeccao.campanha?.tenant?.nome ||
                      agenteConfig?.tenant?.nome ||
                      'nossa imobiliária';

                    const configSDR: ConfiguracaoAgente = {
                      nome: agenteConfig?.nome || 'Sofia',
                      personalidade: {
                        tom: personalidadeAgente?.tom || 'amigavel',
                        usarEmojis: personalidadeAgente?.usarEmojis ?? true
                      },
                      expertise: {
                        bairros: expertiseAgente?.bairros || [],
                        tiposImovel: expertiseAgente?.tiposImovel || []
                      },
                      scripts: {
                        saudacao: scriptsAgente?.saudacao || '',
                        despedida: scriptsAgente?.despedida || ''
                      },
                      tenantNome: nomeImobiliariaResolvido,
                      modoProspeccao: true,
                      empreendimento: contatoProspeccao.campanha?.empreendimento?.nome || contatoProspeccao.campanha?.nomeEmpreendimento || contatoProspeccao.nomeEdificio || '',
                      politica: {
                        comissaoVenda: perfilVenda.comissaoPadrao,
                        taxaLocacao: perfilLocacao.taxaAdministracao
                      }
                    };

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

                    // Passar para SDR ou Orquestrador
                    const idParaSDR = contatoProspeccao.virouLead && contatoProspeccao.leadId
                      ? contatoProspeccao.leadId
                      : contatoProspeccao.id;

                    // Orquestrador de 4 Agentes
                    const USAR_ORQUESTRADOR = process.env.USAR_ORQUESTRADOR_4_AGENTES === 'true';
                    let resposta: string | undefined;

                    if (USAR_ORQUESTRADOR) {
                      const configOrq = await buscarConfiguracaoTenant(tenantId || '');
                      const contextoOrq = await buscarContextoConversa(telefone, tenantId || '');

                      if (configOrq) {
                        const msgsOrq = historicoMensagens.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
                        const resultado = await processarMensagemOrquestrada(
                          msgsOrq,
                          configOrq,
                          {
                            ...contextoOrq,
                            contatoId: contatoProspeccao.id,
                            leadId: contatoProspeccao.leadId || undefined,
                            statusLead: contatoProspeccao.lead?.status || undefined,
                            empreendimento: configSDR.empreendimento
                          }
                        );
                        if (resultado.sucesso) resposta = resultado.resposta;
                      }
                    } else {
                      // SDR Legado
                      const configSdrAgent: Partial<ConfiguracaoSdrAgent> = {
                        nome: configSDR.nome,
                        imobiliaria: configSDR.tenantNome || 'nossa imobiliária',
                        empreendimento: configSDR.empreendimento,
                        tom: configSDR.personalidade.tom,
                        usarEmojis: configSDR.personalidade.usarEmojis,
                        briefingEmpreendimento: contextoRAG
                      };

                      resposta = await sdrAgentService.processar(
                        historicoMensagens,
                        idParaSDR,
                        configSdrAgent,
                        contextoRAG
                      );
                    }

                    // Enviar Resposta
                    if (resposta) {
                      const whatsappService = getWhatsAppService(instanceName);
                      await whatsappService.enviarMensagemTexto(telefone, resposta);
                      await salvarMensagemProspeccao({ contatoId: contatoProspeccao.id, direcao: 'SAIDA', conteudo: resposta, tipo: 'TEXTO', telefone });
                      registrarResposta(contatoProspeccao.id);
                    }

                  } catch (err) {
                    console.error('[Debounce] Erro processamento:', err);
                  } finally {
                    processandoContato.delete(contatoProspeccao.id);
                  }
                };

                const adicionado = adicionarAFilaDebounce(contatoProspeccao.id, mensagemPendente, contatoProspeccao, telefone, processarAposDebounce);
                if (adicionado) console.log(`[Webhook] ⏳ DEBOUNCE: Mensagem aguardando 20s...`);

                // IMPORTANTÍSSIMO: Continue aqui impede que caia no fluxo de Lead Inbound
                continue;
              }

              // ====================================
              // 2. FLUXO NORMAL: LEAD INBOUND (Se não for prospecção)
              // ====================================

              const ultimosDigitos = telefone.slice(-8);
              let lead = await prisma.lead.findFirst({ where: { telefone: { contains: ultimosDigitos } } });
              let leadId = lead?.id;

              if (!lead) {
                // Criar Lead novo
                const sessao = await prisma.sessaoWhatsapp.findUnique({ where: { instanceName } });
                if (sessao) {
                  const novo = await prisma.lead.create({
                    data: {
                      nome: message.pushName || `Lead ${telefone}`,
                      telefone,
                      status: 'NOVO',
                      origem: 'WHATSAPP_INBOUND',
                      tenantId: sessao.tenantId
                    }
                  });
                  leadId = novo.id;
                }
              }

              if (leadId) {
                // ... Lógica de Conversa Elyon Core ...
                // Simplificação para manter o foco na correção
                let conversa = await prisma.conversa.findFirst({ where: { leadId, canal: 'WHATSAPP', estadoConversa: 'ativa' } });
                if (!conversa) {
                  conversa = await prisma.conversa.create({
                    data: { leadId, canal: 'WHATSAPP', numeroOrigem: telefone, estadoConversa: 'ativa', contexto: {} }
                  });
                }

                let tipoMensagem = 'TEXTO';
                let conteudoMensagem = texto || '';
                let urlMidia = null;

                if (isMedia) {
                  tipoMensagem = isImage ? 'IMAGEM' : 'AUDIO';
                  const base64 = data.base64 || message.base64 || message.message?.base64 || message.message?.imageMessage?.jpegThumbnail;

                  if (base64) {
                    const mime = isImage ? 'image/jpeg' : 'audio/ogg';
                    urlMidia = `data:${mime};base64,${base64}`;
                    conteudoMensagem = isImage ? (message.message?.imageMessage?.caption || '') : '';

                    if (isAudio) {
                      try {
                        console.log('[Webhook] Transcrevendo áudio...');
                        const transcricao = await openaiService.transcreverAudioBase64(base64);
                        conteudoMensagem = transcricao;
                        console.log(`[Webhook] Transcrição: "${transcricao}"`);
                      } catch (err) {
                        console.error('[Webhook] Falha na transcrição:', err);
                        conteudoMensagem = '[Áudio sem transcrição]';
                      }
                    }
                  } else {
                    conteudoMensagem = '[Mídia recebida]';
                    console.warn('[Webhook] Mídia recebida sem base64 explícito.');
                  }
                }

                await prisma.mensagem.create({
                  data: {
                    conversaId: conversa.id,
                    remetente: 'usuario',
                    conteudo: conteudoMensagem,
                    tipo: tipoMensagem.toLowerCase(),
                    metadata: urlMidia ? { urlMidia } : undefined,
                    enviadaEm: new Date((message.messageTimestamp || Date.now() / 1000) * 1000)
                  }
                });

                await prisma.lead.update({
                  where: { id: leadId },
                  data: { ultimaInteracao: new Date() }
                });

                await elyonCore.processarMensagem(leadId, conteudoMensagem, tipoMensagem as any);
              }
            }
          }
        } catch (msgError) {
          console.error('[Webhook] Erro msg:', msgError);
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Erro webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
