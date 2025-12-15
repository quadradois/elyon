import { Router } from 'express';
import { prisma } from '../lib/db';
import { openaiService } from '../servicos/openai';
import { elyonCore } from '../agentes/elyon-core';
import { sdrWorker, ConfiguracaoAgente } from '../agentes/workers/sdr-worker';
import { getWhatsAppService } from '../servicos/whatsapp';

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
             e."briefingEstruturado" as "empreendimento_briefingEstruturado"
      FROM contatos c
      LEFT JOIN campanhas camp ON c."campanhaId" = camp.id
      LEFT JOIN tenants t ON camp."tenantId" = t.id
      LEFT JOIN empreendimentos_conhecimento e ON camp."empreendimentoId" = e.id
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
      console.log(`[Webhook] ✅ Contato encontrado: ${c.nome} (${c.telefone})`);

      // Montar objeto similar ao retorno do Prisma
      return {
        ...c,
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
const DEBOUNCE_MS = 5000;

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
      // Normalização das mensagens: Evolution pode enviar um array em data.messages ou um objeto único em data
      let messages: any[] = [];

      if (Array.isArray(data)) {
        messages = data;
      } else if (data?.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (data?.data) {
        // Formato legado ou específico
        messages = [data.data];
      } else if (data) {
        // Tenta usar o próprio data como mensagem se não for nenhum dos anteriores
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
            // Mensagem recebida de um cliente

            // Lógica para garantir que pegamos o número de telefone e não o LID
            let targetJid = remoteJid;
            const remoteJidAlt = message.key.remoteJidAlt;

            if (targetJid.includes('@lid') && remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
              console.log(`[Webhook] Trocando remoteJid (LID) por remoteJidAlt (Phone): ${remoteJidAlt}`);
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
              const agora = new Date().toISOString();
              console.log(`[Webhook] 📨 ${agora} | Mensagem de ${telefone}: "${texto || '[Mídia]'}"`);
              console.log(`[Webhook] 📊 Estado filas: ${filasDebounce.size} contatos, cooldowns: ${ultimaRespostaPorContato.size}, processando: ${processandoContato.size}`);

              // ====================================
              // VERIFICAR SE É RESPOSTA DE PROSPECÇÃO ATIVA
              // ====================================
              const contatoProspeccao = await buscarContatoProspeccao(telefone);

              if (contatoProspeccao) {
                console.log(`[Webhook] 🎯 Resposta de PROSPECÇÃO ATIVA! Contato: ${contatoProspeccao.nome}`);

                // ====================================
                // 🛡️ VERIFICAÇÃO ANTI-FLOOD
                // ====================================
                const messageTimestamp = message.messageTimestamp;
                const messageId = message.key?.id;

                const verificacao = await deveProcessarMensagem(
                  messageTimestamp,
                  messageId,
                  contatoProspeccao.id
                );

                if (!verificacao.processar) {
                  console.log(`[Webhook] ⏭️ IGNORANDO: ${verificacao.motivo}`);
                  continue;
                }

                console.log(`[Webhook] ✅ PROCESSANDO: ${verificacao.motivo}`);

                // ====================================
                // 🆕 VERIFICAR MODO DE ATENDIMENTO
                // ====================================
                const modoAtendimento = (contatoProspeccao as any).modoAtendimento || 'IA';

                if (modoAtendimento === 'HUMANO' || modoAtendimento === 'PAUSADO') {
                  console.log(`[Webhook] ⏸️ Modo ${modoAtendimento} - IA não responderá. Atendido por: ${(contatoProspeccao as any).atendidoPor || 'Corretor'}`);

                  // Ainda assim, salvar a mensagem no histórico
                  const conteudoMsg = texto || (isImage ? '[Imagem]' : isAudio ? '[Áudio]' : '[Mídia]');
                  await salvarMensagemProspeccao({
                    contatoId: contatoProspeccao.id,
                    direcao: 'ENTRADA',
                    conteudo: conteudoMsg,
                    tipo: isImage ? 'IMAGEM' : isAudio ? 'AUDIO' : 'TEXTO',
                    messageId: message.key?.id,
                    telefone: telefone
                  });

                  console.log(`[Webhook] 💬 Mensagem salva no histórico (modo ${modoAtendimento})`);
                  continue; // Não processa com IA, espera atendimento humano
                }

                // Atualizar status do contato
                await prisma.contato.update({
                  where: { id: contatoProspeccao.id },
                  data: {
                    respondeu: true,
                    primeiraResposta: contatoProspeccao.primeiraResposta || new Date(),
                    statusProspeccao: 'RESPONDEU'
                  }
                });

                // 🆕 Processar conteúdo da mensagem (incluindo transcrição de áudio)
                let conteudoMsgEntrada = texto || '';

                if (isAudio) {
                  // Transcrever áudio usando OpenAI Whisper
                  const base64 = data.base64 || message.base64 || message.message?.base64;
                  if (base64) {
                    try {
                      console.log('[Webhook] 🎤 Transcrevendo áudio de prospecção...');
                      const transcricao = await openaiService.transcreverAudioBase64(base64);
                      conteudoMsgEntrada = transcricao;
                      console.log(`[Webhook] ✅ Transcrição: "${transcricao.substring(0, 100)}..."`);
                    } catch (err) {
                      console.error('[Webhook] ❌ Falha na transcrição:', err);
                      conteudoMsgEntrada = '[Áudio não transcrito]';
                    }
                  } else {
                    conteudoMsgEntrada = '[Áudio recebido - sem base64]';
                  }
                } else if (isImage) {
                  conteudoMsgEntrada = message.message?.imageMessage?.caption || '[Imagem recebida]';
                } else if (!conteudoMsgEntrada) {
                  conteudoMsgEntrada = '[Mídia recebida]';
                }

                // Salvar mensagem de ENTRADA no histórico
                await salvarMensagemProspeccao({
                  contatoId: contatoProspeccao.id,
                  direcao: 'ENTRADA',
                  conteudo: conteudoMsgEntrada,
                  tipo: isImage ? 'IMAGEM' : isAudio ? 'AUDIO' : 'TEXTO',
                  messageId: message.key?.id,
                  telefone: telefone
                });

                // ====================================
                // 🔄 DEBOUNCE: Atrasar resposta para consolidar mensagens
                // ====================================
                const contatoId = contatoProspeccao.id;

                // Criar função de callback para processar após debounce
                const processarAposDebounce = async () => {
                  console.log(`[Debounce] ⏰ Timer expirado para ${contatoId} - Verificando mutex e cooldown...`);

                  // 🔒 MUTEX: Verificar se já está processando
                  if (processandoContato.get(contatoId)) {
                    console.log(`[Debounce] 🔒 MUTEX: Já processando ${contatoId} - Ignorando callback duplicado`);
                    return;
                  }

                  // 🛡️ Verificar cooldown antes de processar
                  const ultimaResposta = ultimaRespostaPorContato.get(contatoId);
                  if (ultimaResposta) {
                    const tempoDesdeUltima = Date.now() - ultimaResposta;
                    if (tempoDesdeUltima < COOLDOWN_RESPOSTA_MS) {
                      // Ainda em cooldown - reagendar para quando terminar
                      const tempoRestante = COOLDOWN_RESPOSTA_MS - tempoDesdeUltima;
                      console.log(`[Debounce] ⏸️ Cooldown ativo (${Math.round(tempoRestante / 1000)}s restantes) - Reagendando...`);

                      // Reagendar para quando o cooldown terminar
                      setTimeout(async () => {
                        await processarAposDebounce();
                      }, tempoRestante + 100); // +100ms de margem
                      return;
                    }
                  }

                  // 🔒 MUTEX: Marcar que estamos processando
                  processandoContato.set(contatoId, true);
                  console.log(`[Debounce] ✅ Cooldown OK + MUTEX adquirido - Processando com SDR...`);

                  try {
                    // Buscar configuração do agente usando a instância
                    const tenantIdCampanha = contatoProspeccao.campanha?.tenantId;
                    const agenteConfig = await buscarConfiguracaoAgentePorInstancia(instanceName, tenantIdCampanha);

                    console.log(`[Webhook] Agente encontrado: ${agenteConfig?.nome || 'Nenhum (usando padrão)'}`);

                    // 🆕 Carregar histórico de mensagens (últimas 20)
                    // O histórico já conterá TODAS as mensagens que chegaram durante o debounce
                    const historicoMensagens = await carregarHistoricoMensagens(contatoProspeccao.id, 20);
                    console.log(`[Webhook] Histórico carregado: ${historicoMensagens.length} mensagens`);

                    // Se não há histórico (primeira mensagem), usar apenas a atual
                    const mensagensSDR = historicoMensagens.length > 0
                      ? historicoMensagens
                      : [{ role: 'user' as const, content: conteudoMsgEntrada }];

                    // Montar configuração do SDR a partir do agente configurado ou usar padrão
                    const personalidadeAgente = agenteConfig?.personalidade as any;
                    const expertiseAgente = agenteConfig?.expertise as any;
                    const scriptsAgente = agenteConfig?.scripts as any;
                    const perfilImob = agenteConfig?.perfilImobiliaria as any;

                    // Extrair política da imobiliária do Tenant
                    const perfilVenda = agenteConfig?.tenant?.perfilVenda as any || {};
                    const perfilLocacao = agenteConfig?.tenant?.perfilLocacao as any || {};

                    // 🏢 Resolver nome da imobiliária com fallback inteligente
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

                    console.log(`[Webhook] 🏢 Imobiliária: "${configSDR.tenantNome}" | Empreendimento: "${configSDR.empreendimento}"`);
                    console.log(`[Webhook] 📋 DEBUG DADOS:`);
                    console.log(`[Webhook]   - contatoProspeccao.campanha?.tenant?.nome: "${contatoProspeccao.campanha?.tenant?.nome}"`);
                    console.log(`[Webhook]   - agenteConfig?.tenant?.nome: "${agenteConfig?.tenant?.nome}"`);
                    console.log(`[Webhook]   - campanha.briefingCompleto existe: ${!!contatoProspeccao.campanha?.briefingCompleto}`);
                    console.log(`[Webhook]   - campanha.briefingCompleto tamanho: ${contatoProspeccao.campanha?.briefingCompleto?.length || 0}`);

                    // Montar contexto RAG
                    const partesRAG: string[] = [];

                    if (agenteConfig?.ragPerfilTexto) {
                      partesRAG.push(`### PERFIL DA IMOBILIÁRIA ###\n${agenteConfig.ragPerfilTexto}`);
                    }

                    const empreendimentoData = contatoProspeccao.campanha?.empreendimento as any;
                    if (empreendimentoData?.briefingCompleto) {
                      partesRAG.push(`### CONHECIMENTO DO EMPREENDIMENTO: ${empreendimentoData.nome} ###\n${empreendimentoData.briefingCompleto}`);
                    } else if (contatoProspeccao.campanha?.briefingCompleto) {
                      partesRAG.push(`### CONHECIMENTO DO EMPREENDIMENTO ###\n${contatoProspeccao.campanha.briefingCompleto}`);
                    }

                    if (empreendimentoData?.briefingEstruturado) {
                      const dados = empreendimentoData.briefingEstruturado as any;
                      if (dados.precos || dados.diferenciais || dados.infraestrutura) {
                        const resumo = [];
                        if (dados.precos) resumo.push(`Preços: ${JSON.stringify(dados.precos)}`);
                        if (dados.diferenciais) resumo.push(`Diferenciais: ${dados.diferenciais.join(', ')}`);
                        if (dados.infraestrutura) resumo.push(`Infraestrutura: ${dados.infraestrutura.join(', ')}`);
                        if (resumo.length > 0) {
                          partesRAG.push(`### DADOS ESTRUTURADOS ###\n${resumo.join('\n')}`);
                        }
                      }
                    }

                    const contextoRAG = partesRAG.length > 0 ? partesRAG.join('\n\n') : undefined;

                    // 🔍 DEBUG: Ver o que está no contextoRAG
                    console.log(`[Webhook] 📚 contextoRAG existe? ${!!contextoRAG}`);
                    if (contextoRAG) {
                      console.log(`[Webhook] 📚 contextoRAG tamanho: ${contextoRAG.length} chars`);
                      console.log(`[Webhook] 📚 contextoRAG preview: ${contextoRAG.substring(0, 300)}...`);
                    } else {
                      console.log(`[Webhook] ⚠️ contextoRAG está VAZIO/UNDEFINED!`);
                      console.log(`[Webhook] ⚠️ partesRAG.length: ${partesRAG.length}`);
                      console.log(`[Webhook] ⚠️ campanha.briefingCompleto existe? ${!!contatoProspeccao.campanha?.briefingCompleto}`);
                    }

                    // Passar o contatoId para o SDR
                    const idParaSDR = contatoProspeccao.virouLead && contatoProspeccao.leadId
                      ? contatoProspeccao.leadId
                      : contatoProspeccao.id;

                    console.log(`[Webhook] Passando para SDR - ID: ${idParaSDR}`);

                    const resposta = await sdrWorker.processar(
                      mensagensSDR,
                      idParaSDR,
                      configSDR,
                      contextoRAG
                    );

                    console.log(`[Webhook] SDR respondeu: ${resposta?.substring(0, 100)}...`);

                    // Enviar resposta via WhatsApp
                    if (resposta) {
                      try {
                        // Enviar usando o serviço da instância correta
                        const whatsappService = getWhatsAppService(instanceName);
                        await whatsappService.enviarMensagemTexto(telefone, resposta);
                        console.log(`[Webhook] ✅ Resposta enviada para ${telefone}`);

                        // 🛡️ Registrar que respondemos (para cooldown)
                        registrarResposta(contatoId);

                        // Salvar mensagem de SAÍDA no histórico
                        await salvarMensagemProspeccao({
                          contatoId: contatoProspeccao.id,
                          direcao: 'SAIDA',
                          conteudo: resposta,
                          tipo: 'TEXTO',
                          telefone: telefone
                        });

                      } catch (envioError) {
                        console.error('[Webhook] Erro ao enviar resposta:', envioError);
                      }
                    }

                  } catch (sdrError) {
                    console.error('[Debounce] Erro ao processar com SDR:', sdrError);
                  } finally {
                    // 🔒 MUTEX: Liberar sempre
                    processandoContato.delete(contatoId);
                    console.log(`[Debounce] 🔓 MUTEX liberado para ${contatoId}`);
                  }
                };

                // Adicionar à fila de debounce
                const filaExistente = filasDebounce.has(contatoId);
                console.log(`[Debounce] Fila existente para ${contatoId}? ${filaExistente}`);

                adicionarAFilaDebounce(
                  contatoId,
                  {
                    conteudo: conteudoMsgEntrada,
                    tipo: isImage ? 'IMAGEM' : isAudio ? 'AUDIO' : 'TEXTO',
                    messageId: message.key?.id,
                    timestamp: Date.now()
                  },
                  contatoProspeccao,
                  telefone,
                  processarAposDebounce
                );

                // Não processa imediatamente - o debounce vai cuidar
                continue;
              }

              // ====================================
              // FLUXO NORMAL: LEAD INBOUND
              // ====================================

              // 1. Buscar Lead pelo telefone (tenta formatos variados)
              const ultimosDigitos = telefone.slice(-8);

              const lead = await prisma.lead.findFirst({
                where: {
                  telefone: {
                    contains: ultimosDigitos
                  }
                }
              });

              let leadId = lead?.id;

              // Se não encontrar o lead, cria um novo automaticamente
              if (!lead) {
                console.log(`[Webhook] Lead não encontrado. Criando novo lead para ${telefone}...`);

                // Busca tenant padrão (primeiro encontrado)
                const tenant = await prisma.tenant.findFirst();
                if (!tenant) {
                  console.error('[Webhook] ERRO: Nenhum tenant encontrado para vincular o lead.');
                  continue; // Pula para a próxima mensagem
                }

                const novoLead = await prisma.lead.create({
                  data: {
                    nome: message.pushName || `Lead WhatsApp ${telefone}`,
                    telefone: telefone,
                    status: 'NOVO',
                    temperatura: 'FRIO',
                    origem: 'WHATSAPP_INBOUND',
                    tenantId: tenant.id,
                    // cpf é opcional agora
                  }
                });
                leadId = novoLead.id;
                console.log(`[Webhook] Novo lead criado: ${novoLead.nome} (${novoLead.id})`);
              }

              if (leadId) {
                console.log(`[Webhook] Processando mensagem para lead ${leadId}`);

                // 2. Buscar ou Criar Conversa Ativa
                let conversa = await prisma.conversa.findFirst({
                  where: {
                    leadId: leadId,
                    canal: 'WHATSAPP',
                    estadoConversa: 'ativa'
                  }
                });

                if (!conversa) {
                  conversa = await prisma.conversa.create({
                    data: {
                      leadId: leadId,
                      canal: 'WHATSAPP',
                      numeroOrigem: remoteJid.replace('@s.whatsapp.net', ''),
                      estadoConversa: 'ativa',
                      contexto: {}
                    }
                  });
                }

                // 3. Identificar Tipo de Mensagem e Conteúdo
                let tipoMensagem = 'TEXTO';
                let conteudoMensagem = texto || '';
                let urlMidia = null;

                if (isMedia) {
                  tipoMensagem = isImage ? 'IMAGEM' : 'AUDIO';

                  // Tenta pegar o Base64 (Evolution manda se webhookBase64: true)
                  // A estrutura pode variar, vamos tentar achar o base64
                  // Log mostra que está em message.message.base64
                  const base64 = data.base64 || message.base64 || message.message?.base64 || message.message?.imageMessage?.jpegThumbnail;

                  if (base64) {
                    const mime = isImage ? 'image/jpeg' : 'audio/ogg';
                    urlMidia = `data:${mime};base64,${base64}`;
                    conteudoMensagem = isImage ? (message.message?.imageMessage?.caption || '') : '';

                    // SE FOR ÁUDIO: Transcrever
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

                // 4. Salvar Mensagem
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

                // Atualizar última interação do lead
                try {
                  await prisma.lead.update({
                    where: { id: leadId },
                    data: { ultimaInteracao: new Date() }
                  });
                } catch (e) {
                  console.warn('[Webhook] Aviso: Não foi possível atualizar ultimaInteracao');
                }

                console.log(`[Webhook] Mensagem salva para o lead ${leadId}`);

                // 5. Acionar Agente Mestre
                // Fire-and-forget para não travar o webhook (ou await se quisermos garantir)
                // Vamos usar await por enquanto para debug
                await elyonCore.processarMensagem(leadId, conteudoMensagem, tipoMensagem as any);
              }
            }
          }
        } catch (msgError) {
          console.error('[Webhook] Erro ao processar mensagem individual:', msgError);
          // Continua para a próxima mensagem
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
