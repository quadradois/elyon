import { Router } from 'express';
import { prisma } from '../lib/db';
import { getWhatsAppService } from '../servicos/whatsapp';
import { normalizarTelefone } from '../utils/telefone';
// 🆕 Orquestrador dos 4 Agentes de Captação
import {
  processarMensagemOrquestrada,
  buscarConfiguracaoTenant,
  buscarContextoConversa
} from '../agentes/orchestrator';
import { ragConversasService } from '../servicos/rag-conversas';
import { ConverterParaLeadUseCase } from '../casos-de-uso/agentes/converter-para-lead.usecase';

const router = Router();
const MODO_OUTBOUND_ONLY = process.env.MODO_OUTBOUND_ONLY !== 'false';
const DESATIVAR_INBOUND = process.env.DESATIVAR_INBOUND !== 'false';
const converterParaLeadUseCase = new ConverterParaLeadUseCase();

type DeteccaoInteresse = {
  tipoInteresse: 'VENDA' | 'LOCACAO' | 'AMBOS';
  temperatura: 'MORNO' | 'QUENTE';
  timeline: string;
};

function detectarInteresseVendaLocacao(texto: string): DeteccaoInteresse | null {
  const normalizado = (texto || '').toLowerCase().trim();
  if (!normalizado) return null;

  const padraoNegacao = /\b(n[aã]o|nao)\s+(quero|pretendo|tenho\s+interesse\s+em|vou)?\s*(vender|alugar|locar|loca[cç][aã]o|venda|aluguel)\b/i;
  if (padraoNegacao.test(normalizado)) return null;

  const mencionaVenda = /\b(vender|venda|vendo|dispon[ií]vel\s+pra\s+venda|dispon[ií]vel\s+para\s+venda)\b/i.test(normalizado);
  const mencionaLocacao = /\b(alugar|aluguel|loca[cç][aã]o|locar|dispon[ií]vel\s+pra\s+alugar|dispon[ií]vel\s+para\s+alugar)\b/i.test(normalizado);
  const mencionaInteresse = /\b(tenho\s+interesse|quero|pretendo|tenho\s+apartamento|tenho\s+im[oó]vel|tenho\s+uma\s+casa|sim)\b/i.test(normalizado);

  if ((!mencionaVenda && !mencionaLocacao) || !mencionaInteresse) {
    return null;
  }

  const urgenciaAlta = /\b(urgente|urg[êe]ncia|imediat|agora|o\s+quanto\s+antes|essa\s+semana|este\s+m[eê]s)\b/i.test(normalizado);

  return {
    tipoInteresse: mencionaVenda && mencionaLocacao ? 'AMBOS' : mencionaVenda ? 'VENDA' : 'LOCACAO',
    temperatura: urgenciaAlta ? 'QUENTE' : 'MORNO',
    timeline: urgenciaAlta ? 'urgente' : 'não informado'
  };
}

async function garantirConversaoAutomaticaSeElegivel(params: {
  contatoId: string;
  textoConversa: string;
}) {
  const deteccao = detectarInteresseVendaLocacao(params.textoConversa);
  if (!deteccao) return;

  const contatoAtual = await prisma.contato.findUnique({
    where: { id: params.contatoId },
    select: { id: true, virouLead: true, leadId: true }
  });

  if (!contatoAtual || contatoAtual.virouLead || contatoAtual.leadId) {
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
    console.log(
      `[Webhook] ✅ Auto-conversão aplicada para contato ${params.contatoId} | tipo=${deteccao.tipoInteresse} | temp=${deteccao.temperatura}`
    );
    return;
  }

  const erro = (resultadoConversao.error || '').toLowerCase();
  if (erro.includes('já é lead') || erro.includes('ja e lead')) {
    return;
  }

  console.warn(
    `[Webhook] ⚠️ Auto-conversão não concluída para contato ${params.contatoId}: ${resultadoConversao.error || 'erro desconhecido'}`
  );
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

// ====================================
// 🧯 DEDUPE DE EVENTOS (EVOLUTION / WEBHOOK)
// ====================================

const TTL_DEDUPE_MSG_MS = 10 * 60 * 1000; // 10 minutos
const mensagensJaVistas = new Map<string, number>();

function marcarMensagemComoVista(chave: string): void {
  const agora = Date.now();
  mensagensJaVistas.set(chave, agora);

  for (const [k, ts] of mensagensJaVistas.entries()) {
    if (agora - ts > TTL_DEDUPE_MSG_MS) mensagensJaVistas.delete(k);
  }
}

function jaVimosMensagem(chave: string): boolean {
  const ts = mensagensJaVistas.get(chave);
  if (!ts) return false;
  return Date.now() - ts <= TTL_DEDUPE_MSG_MS;
}

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

// Registro de quando respondemos por último a cada contato
const ultimaRespostaPorContato = new Map<string, number>();

// 🔒 MUTEX: Controle de processamento em andamento por contato
const processandoContato = new Map<string, boolean>();

function registrarIgnorado(telefone: string, motivo: string, contatoId?: string) {
  const contatoInfo = contatoId ? `contato=${contatoId}` : 'contato=N/A';
  console.log(`[Webhook] ⛔ Ignorado (${motivo}) telefone=${telefone} ${contatoInfo}`);
}

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
      telefone,
      reagendado: false
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
  fila.reagendado = false;
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
      return res.status(400).json({ erro: 'Instância não especificada' });
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
                  registrarIgnorado(telefone, 'blacklist', contatoProspeccao.id);
                  continue;
                }

                const chaveMsgProsp = messageId
                  ? `prosp:${instanceName}:${messageId}`
                  : `prosp:${instanceName}:${telefone}:${(texto || '').slice(0, 120)}:${message.messageTimestamp || ''}`;
                if (jaVimosMensagem(chaveMsgProsp)) {
                  console.log(`[Webhook] ⚠️ Prospecção duplicada detectada, ignorando: ${chaveMsgProsp}`);
                  continue;
                }
                marcarMensagemComoVista(chaveMsgProsp);

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

                const processarAposDebounce = async () => {
                  console.log(`[Debounce] 🚀 PROCESSANDO AGORA: ${contatoProspeccao.nome}`);
                  
                  // 🔍 VERIFICAR COOLDOWN ANTES DE PROCESSAR
                  if (!podeMosResponder(contatoProspeccao.id)) {
                    registrarIgnorado(telefone, 'cooldown', contatoProspeccao.id);
                    processandoContato.delete(contatoProspeccao.id);
                    return;
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
                      setTimeout(() => processarAposDebounce(), 2000 - tempoDesdeUltimaMensagem);
                    }
                    processandoContato.delete(contatoProspeccao.id);
                    return;
                  }
                  
                  processandoContato.set(contatoProspeccao.id, true);

                  try {
                    // Consolidar mensagens
                    const dadosDebounce = obterMensagensConsolidadas(contatoProspeccao.id);
                    const mensagensAcumuladas = dadosDebounce?.mensagens || [mensagemPendente];
                    const textoConsolidado = mensagensAcumuladas.map(m => m.conteudo).join('\n').trim();

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

                    // Trava técnica: garantir conversão para lead ao detectar intenção de vender/alugar
                    await garantirConversaoAutomaticaSeElegivel({
                      contatoId: contatoProspeccao.id,
                      textoConversa: textoConsolidado
                    });

                    // Carregar Histórico
                    const historicoMensagens = await carregarHistoricoMensagens(contatoProspeccao.id, 20);

                    // Configuração do Agente e Processamento
                    const tenantId = contatoProspeccao.campanha?.tenantId;
                    const agenteConfig = await buscarConfiguracaoAgentePorInstancia(instanceName, tenantId);
                    if (!agenteConfig || !agenteConfig.estaAtivo || agenteConfig.status !== 'ATIVO') {
                      registrarIgnorado(telefone, 'agente_pausado', contatoProspeccao.id);
                      return;
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

                    const USAR_ORQUESTRADOR = process.env.USAR_ORQUESTRADOR_4_AGENTES === 'true';
                    let resposta: string | undefined;

                    if (!USAR_ORQUESTRADOR) {
                      registrarIgnorado(telefone, 'outbound_only:orchestrator_desativado', contatoProspeccao.id);
                      return;
                    }

                    const configOrq = await buscarConfiguracaoTenant(tenantId || '');
                    const contextoOrq = await buscarContextoConversa(telefone, tenantId || '');

                    if (!configOrq) {
                      registrarIgnorado(telefone, 'outbound_only:config_orchestrator_nao_encontrada', contatoProspeccao.id);
                      return;
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
                    if (resultado.sucesso) resposta = resultado.resposta;

                    // Enviar Resposta
                    if (resposta) {
                      registrarResposta(contatoProspeccao.id);
                      
                      const whatsappService = getWhatsAppService(instanceName);
                      await whatsappService.enviarMensagemTexto(telefone, resposta);
                      await salvarMensagemProspeccao({ contatoId: contatoProspeccao.id, direcao: 'SAIDA', conteudo: resposta, tipo: 'TEXTO', telefone });
                    }

                  } catch (err) {
                    console.error('[Debounce] Erro processamento:', err);
                  } finally {
                    processandoContato.delete(contatoProspeccao.id);
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

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Erro webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
