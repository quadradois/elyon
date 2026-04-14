/**
 * SERVIÇO GOOGLE CALENDAR — Integração nativa com Google Calendar API
 *
 * Responsabilidades:
 * 1. Autenticação via Service Account (JWT)
 * 2. Consultar slots livres do closer
 * 3. Criar eventos reais com Google Meet automático
 * 4. Gerar link público de agendamento (página nativa — fallback)
 *
 * Padrão: Singleton lazy (mesmo padrão do s3.ts e openai.ts)
 *
 * @version 1.0
 * @date 10/04/2026
 */

import { google, calendar_v3 } from 'googleapis';
import { logger } from '../lib/logger';

// ====================================
// TIPOS
// ====================================

export interface SlotLivre {
  inicio: string;   // ISO 8601
  fim: string;       // ISO 8601
  duracaoMin: number;
}

export interface EventoCriado {
  eventoId: string;
  linkMeet: string | null;
  linkEvento: string;
  inicio: string;
  fim: string;
  resumo: string;
}

export interface CriarEventoParams {
  titulo: string;
  descricao?: string;
  dataHoraInicio: Date;
  duracaoMinutos?: number;
  participantes?: string[];       // emails
  observacoesCloser?: string;
  leadNome?: string;
  contatoId?: string;
  leadId?: string;
}

// ====================================
// CONFIGURAÇÃO
// ====================================

const CALENDAR_CONFIG = {
  /** Duração padrão de reunião com closer (minutos) */
  DURACAO_PADRAO_MINUTOS: 30,

  /** Horário comercial */
  HORA_INICIO: 8,
  HORA_FIM: 18,

  /** Dias da semana (0=dom, 6=sab) — apenas seg-sex */
  DIAS_UTEIS: [1, 2, 3, 4, 5],

  /** Quantos dias à frente consultar para slots livres */
  DIAS_CONSULTA: 14,

  /** Timezone padrão */
  TIMEZONE: 'America/Sao_Paulo',

  /** Intervalo entre slots (minutos) */
  INTERVALO_SLOTS: 30,
};

// ====================================
// SINGLETON LAZY DO CALENDAR CLIENT
// ====================================

let _calendarClient: calendar_v3.Calendar | null = null;
let _configValida = false;

function getConfig() {
  return {
    clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || '',
    privateKey: (process.env.GOOGLE_CALENDAR_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    closerEmail: process.env.GOOGLE_CALENDAR_CLOSER_EMAIL || '',
  };
}

function isConfigurado(): boolean {
  const cfg = getConfig();
  return !!(cfg.clientEmail && cfg.privateKey);
}

function getCalendarClient(): calendar_v3.Calendar {
  if (_calendarClient && _configValida) return _calendarClient;

  const cfg = getConfig();

  if (!cfg.clientEmail || !cfg.privateKey) {
    throw new Error(
      '[GoogleCalendar] Credenciais não configuradas. Defina GOOGLE_CALENDAR_CLIENT_EMAIL e GOOGLE_CALENDAR_PRIVATE_KEY.'
    );
  }

  const auth = new google.auth.JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    // NOTA: "subject" só funciona com Domain-Wide Delegation habilitada
    // no Google Workspace Admin Console. Para uso sem DWD, o calendário
    // deve ser compartilhado diretamente com a Service Account.
    // Ative com: GOOGLE_CALENDAR_USE_DWD=true
    ...(process.env.GOOGLE_CALENDAR_USE_DWD === 'true' && cfg.closerEmail
      ? { subject: cfg.closerEmail }
      : {}),
  });

  _calendarClient = google.calendar({ version: 'v3', auth });
  _configValida = true;

  logger.info('[GoogleCalendar] Client inicializado com sucesso');
  return _calendarClient;
}

/** Reseta o client (útil para testes) */
export function resetCalendarClient(): void {
  _calendarClient = null;
  _configValida = false;
}

// ====================================
// CONSULTAR SLOTS LIVRES (FreeBusy)
// ====================================

/**
 * Consulta os horários livres do closer nos próximos N dias.
 * Usa a API FreeBusy para verificar conflitos.
 */
export async function consultarSlotsLivres(params?: {
  dataInicio?: Date;
  dataFim?: Date;
  duracaoMinutos?: number;
}): Promise<SlotLivre[]> {
  const calendar = getCalendarClient();
  const cfg = getConfig();
  const duracao = params?.duracaoMinutos || CALENDAR_CONFIG.DURACAO_PADRAO_MINUTOS;

  const agora = new Date();
  const inicio = params?.dataInicio || agora;
  const fim = params?.dataFim || new Date(agora.getTime() + CALENDAR_CONFIG.DIAS_CONSULTA * 24 * 60 * 60 * 1000);

  try {
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: inicio.toISOString(),
        timeMax: fim.toISOString(),
        timeZone: CALENDAR_CONFIG.TIMEZONE,
        items: [{ id: cfg.calendarId }],
      },
    });

    const ocupados = freeBusy.data.calendars?.[cfg.calendarId]?.busy || [];

    // Gerar todos os slots possíveis dentro do horário comercial
    const slots: SlotLivre[] = [];
    const cursor = new Date(inicio);

    // Avançar para o próximo slot válido
    cursor.setMinutes(0, 0, 0);
    if (cursor < agora) {
      cursor.setTime(agora.getTime());
      // Arredondar para próximo intervalo
      const mins = cursor.getMinutes();
      const nextSlot = Math.ceil(mins / CALENDAR_CONFIG.INTERVALO_SLOTS) * CALENDAR_CONFIG.INTERVALO_SLOTS;
      cursor.setMinutes(nextSlot, 0, 0);
    }

    while (cursor < fim) {
      const diaSemana = cursor.getDay();
      const hora = cursor.getHours();

      // Pular dias não úteis
      if (!CALENDAR_CONFIG.DIAS_UTEIS.includes(diaSemana)) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(CALENDAR_CONFIG.HORA_INICIO, 0, 0, 0);
        continue;
      }

      // Pular fora do horário comercial
      if (hora < CALENDAR_CONFIG.HORA_INICIO) {
        cursor.setHours(CALENDAR_CONFIG.HORA_INICIO, 0, 0, 0);
        continue;
      }
      if (hora >= CALENDAR_CONFIG.HORA_FIM) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(CALENDAR_CONFIG.HORA_INICIO, 0, 0, 0);
        continue;
      }

      const slotInicio = new Date(cursor);
      const slotFim = new Date(cursor.getTime() + duracao * 60 * 1000);

      // Verificar se não colide com eventos ocupados
      const temConflito = ocupados.some((busy) => {
        const busyStart = new Date(busy.start!);
        const busyEnd = new Date(busy.end!);
        return slotInicio < busyEnd && slotFim > busyStart;
      });

      if (!temConflito && slotFim.getHours() <= CALENDAR_CONFIG.HORA_FIM) {
        slots.push({
          inicio: slotInicio.toISOString(),
          fim: slotFim.toISOString(),
          duracaoMin: duracao,
        });
      }

      cursor.setMinutes(cursor.getMinutes() + CALENDAR_CONFIG.INTERVALO_SLOTS);
    }

    logger.info(`[GoogleCalendar] ${slots.length} slots livres encontrados (${inicio.toISOString()} → ${fim.toISOString()})`);
    return slots;

  } catch (error: any) {
    logger.error(`[GoogleCalendar] Erro ao consultar FreeBusy: ${error.message}`);
    throw error;
  }
}

// ====================================
// VERIFICAR SE HORÁRIO ESTÁ LIVRE
// ====================================

/**
 * Verifica se um horário específico está disponível.
 * Retorna true se livre, false se ocupado.
 */
export async function verificarDisponibilidade(
  dataHora: Date,
  duracaoMinutos?: number
): Promise<{ disponivel: boolean; conflito?: string }> {
  const calendar = getCalendarClient();
  const cfg = getConfig();
  const duracao = duracaoMinutos || CALENDAR_CONFIG.DURACAO_PADRAO_MINUTOS;

  const inicio = dataHora;
  const fim = new Date(dataHora.getTime() + duracao * 60 * 1000);

  try {
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: inicio.toISOString(),
        timeMax: fim.toISOString(),
        timeZone: CALENDAR_CONFIG.TIMEZONE,
        items: [{ id: cfg.calendarId }],
      },
    });

    const ocupados = freeBusy.data.calendars?.[cfg.calendarId]?.busy || [];

    if (ocupados.length > 0) {
      return {
        disponivel: false,
        conflito: `Horário ocupado: ${ocupados[0].start} → ${ocupados[0].end}`,
      };
    }

    return { disponivel: true };

  } catch (error: any) {
    logger.error(`[GoogleCalendar] Erro ao verificar disponibilidade: ${error.message}`);
    // Em caso de erro na API, retornar como disponível para não bloquear o fluxo
    return { disponivel: true };
  }
}

// ====================================
// CRIAR EVENTO COM GOOGLE MEET
// ====================================

/**
 * Cria um evento real no Google Calendar com link Google Meet automático.
 */
export async function criarEventoComMeet(params: CriarEventoParams): Promise<EventoCriado> {
  const calendar = getCalendarClient();
  const cfg = getConfig();
  const duracao = params.duracaoMinutos || CALENDAR_CONFIG.DURACAO_PADRAO_MINUTOS;

  const inicio = params.dataHoraInicio;
  const fim = new Date(inicio.getTime() + duracao * 60 * 1000);

  const descricaoFull = [
    params.descricao || '',
    params.observacoesCloser ? `\n📋 Contexto da conversa (IA):\n${params.observacoesCloser}` : '',
    params.leadNome ? `\n👤 Lead: ${params.leadNome}` : '',
    params.contatoId ? `\n🆔 Contato: ${params.contatoId}` : '',
    params.leadId ? `\n🆔 Lead ID: ${params.leadId}` : '',
  ].filter(Boolean).join('\n');

  const attendees = (params.participantes || []).map(email => ({ email }));

  // Adicionar closer como participante se configurado
  if (cfg.closerEmail && !attendees.some(a => a.email === cfg.closerEmail)) {
    attendees.push({ email: cfg.closerEmail });
  }

  try {
    const response = await calendar.events.insert({
      calendarId: cfg.calendarId,
      conferenceDataVersion: 1,  // Necessário para gerar Google Meet
      requestBody: {
        summary: params.titulo,
        description: descricaoFull,
        start: {
          dateTime: inicio.toISOString(),
          timeZone: CALENDAR_CONFIG.TIMEZONE,
        },
        end: {
          dateTime: fim.toISOString(),
          timeZone: CALENDAR_CONFIG.TIMEZONE,
        },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `elyon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 },
          ],
        },
        // Cor verde (sinal de reunião confirmada)
        colorId: '10',
      },
    });

    const evento = response.data;
    const linkMeet = evento.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri || null;

    const resultado: EventoCriado = {
      eventoId: evento.id || '',
      linkMeet,
      linkEvento: evento.htmlLink || '',
      inicio: evento.start?.dateTime || inicio.toISOString(),
      fim: evento.end?.dateTime || fim.toISOString(),
      resumo: evento.summary || params.titulo,
    };

    logger.info(`[GoogleCalendar] ✅ Evento criado: ${resultado.eventoId} | Meet: ${linkMeet}`);
    return resultado;

  } catch (error: any) {
    logger.error(`[GoogleCalendar] Erro ao criar evento: ${error.message}`);
    throw error;
  }
}

// ====================================
// GERAR LINK DE AGENDAMENTO NATIVO
// ====================================

/**
 * Gera um link de pré-agendamento do Google Calendar.
 * O lead pode clicar e agendar diretamente, sem ferramentas terceiras.
 *
 * Formato: https://calendar.google.com/calendar/render?action=TEMPLATE&...
 * Funciona sem necessidade de autenticação do lead.
 */
export function gerarLinkAgendamento(params: {
  titulo: string;
  descricao?: string;
  duracaoMinutos?: number;
  emailCloser?: string;
}): string {
  const cfg = getConfig();
  const duracao = params.duracaoMinutos || CALENDAR_CONFIG.DURACAO_PADRAO_MINUTOS;
  const emailCloser = params.emailCloser || cfg.closerEmail;

  // O lead escolhe o horário — link sem data fixa
  // Formato: YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
  // Para link sem data fixa, usamos "próximo dia útil às 10h" como sugestão
  const sugestao = proximoDiaUtil(new Date());
  sugestao.setHours(10, 0, 0, 0);
  const fimSugestao = new Date(sugestao.getTime() + duracao * 60 * 1000);

  const formatGCal = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const queryParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.titulo,
    details: params.descricao || 'Reunião agendada pelo sistema Elyon',
    dates: `${formatGCal(sugestao)}/${formatGCal(fimSugestao)}`,
    ...(emailCloser ? { add: emailCloser } : {}),
    // Habilitar Google Meet automaticamente
    crm: 'AVAILABLE',
  });

  return `https://calendar.google.com/calendar/render?${queryParams.toString()}`;
}

// ====================================
// UTILITÁRIOS
// ====================================

function proximoDiaUtil(a_partir_de: Date): Date {
  const d = new Date(a_partir_de);
  d.setDate(d.getDate() + 1);
  while (!CALENDAR_CONFIG.DIAS_UTEIS.includes(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Formata slots para exibição textual no WhatsApp.
 * Ex: "Seg 14/04 às 10:00, 10:30, 11:00"
 */
export function formatarSlotsParaWhatsApp(slots: SlotLivre[], maxSlots = 6): string {
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Agrupar por dia
  const porDia = new Map<string, string[]>();
  for (const slot of slots.slice(0, maxSlots * 3)) {
    const d = new Date(slot.inicio);
    const chave = `${diasSemana[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave)!.push(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  }

  // Formatar: máximo N dias
  const linhas: string[] = [];
  let count = 0;
  for (const [dia, horarios] of porDia) {
    if (count >= maxSlots) break;
    linhas.push(`📅 ${dia} — ${horarios.slice(0, 4).join(', ')}`);
    count++;
  }

  return linhas.join('\n');
}

// ====================================
// HEALTH CHECK
// ====================================

/**
 * Verifica se a integração Google Calendar está operacional.
 * Usado no dashboard de configuração.
 */
export async function healthCheck(): Promise<{
  configurado: boolean;
  conectado: boolean;
  calendarId: string;
  erro?: string;
}> {
  const cfg = getConfig();

  if (!isConfigurado()) {
    return {
      configurado: false,
      conectado: false,
      calendarId: cfg.calendarId,
      erro: 'Credenciais não configuradas (GOOGLE_CALENDAR_CLIENT_EMAIL / GOOGLE_CALENDAR_PRIVATE_KEY)',
    };
  }

  try {
    const calendar = getCalendarClient();
    // Tentar listar 1 evento para validar a conexão
    await calendar.events.list({
      calendarId: cfg.calendarId,
      maxResults: 1,
      timeMin: new Date().toISOString(),
    });

    return {
      configurado: true,
      conectado: true,
      calendarId: cfg.calendarId,
    };
  } catch (error: any) {
    return {
      configurado: true,
      conectado: false,
      calendarId: cfg.calendarId,
      erro: error.message,
    };
  }
}

// ====================================
// EXPORT AGREGADO
// ====================================

export const googleCalendarService = {
  isConfigurado,
  healthCheck,
  consultarSlotsLivres,
  verificarDisponibilidade,
  criarEventoComMeet,
  gerarLinkAgendamento,
  formatarSlotsParaWhatsApp,
  resetCalendarClient,
  CALENDAR_CONFIG,
};

export default googleCalendarService;
