/**
 * Testes: google-calendar.ts (Serviço Google Calendar)
 *
 * Cobertura:
 * - Configuração e inicialização
 * - consultarSlotsLivres
 * - verificarDisponibilidade
 * - criarEventoComMeet
 * - gerarLinkAgendamento
 * - formatarSlotsParaWhatsApp
 * - healthCheck
 * - Fallback quando não configurado
 *
 * @version 1.0
 * @date 10/04/2026
 */

// ====================================
// MOCKS
// ====================================

const mockEventsInsert = jest.fn();
const mockEventsList = jest.fn();
const mockFreebusyQuery = jest.fn();

jest.mock('googleapis', () => ({
    google: {
        auth: {
            JWT: jest.fn().mockImplementation(() => ({}))
        },
        calendar: jest.fn().mockImplementation(() => ({
            events: {
                insert: mockEventsInsert,
                list: mockEventsList,
            },
            freebusy: {
                query: mockFreebusyQuery,
            },
        })),
    },
}));

jest.mock('../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import {
    googleCalendarService,
    resetCalendarClient,
    consultarSlotsLivres,
    verificarDisponibilidade,
    criarEventoComMeet,
    gerarLinkAgendamento,
    formatarSlotsParaWhatsApp,
    type SlotLivre,
} from '../../servicos/google-calendar';

// ====================================
// HELPERS
// ====================================

function setEnv(overrides: Record<string, string> = {}) {
    process.env.GOOGLE_CALENDAR_CLIENT_EMAIL = overrides.email || 'test@test.iam.gserviceaccount.com';
    process.env.GOOGLE_CALENDAR_PRIVATE_KEY = overrides.key || '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
    process.env.GOOGLE_CALENDAR_ID = overrides.calendarId || 'primary';
    process.env.GOOGLE_CALENDAR_CLOSER_EMAIL = overrides.closerEmail || 'closer@test.com';
}

function clearEnv() {
    delete process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
    delete process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_CALENDAR_CLOSER_EMAIL;
}

function proximoDiaUtil(base = new Date()): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
}

// ====================================
// SUÍTES
// ====================================

describe('Google Calendar Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetCalendarClient();
        clearEnv();
    });

    afterAll(() => {
        clearEnv();
    });

    // --------------------------------
    // Configuração
    // --------------------------------
    describe('isConfigurado()', () => {
        it('retorna false quando variáveis de ambiente não estão definidas', () => {
            expect(googleCalendarService.isConfigurado()).toBe(false);
        });

        it('retorna true quando variáveis estão definidas', () => {
            setEnv();
            expect(googleCalendarService.isConfigurado()).toBe(true);
        });

        it('retorna false se apenas CLIENT_EMAIL está definido', () => {
            process.env.GOOGLE_CALENDAR_CLIENT_EMAIL = 'test@test.com';
            expect(googleCalendarService.isConfigurado()).toBe(false);
        });
    });

    // --------------------------------
    // verificarDisponibilidade
    // --------------------------------
    describe('verificarDisponibilidade()', () => {
        beforeEach(() => setEnv());

        it('retorna disponivel=true quando sem conflitos', async () => {
            mockFreebusyQuery.mockResolvedValue({
                data: {
                    calendars: {
                        primary: { busy: [] }
                    }
                }
            });

            const resultado = await verificarDisponibilidade(new Date('2026-04-15T10:00:00'));
            expect(resultado.disponivel).toBe(true);
            expect(resultado.conflito).toBeUndefined();
        });

        it('retorna disponivel=false quando há conflito', async () => {
            mockFreebusyQuery.mockResolvedValue({
                data: {
                    calendars: {
                        primary: {
                            busy: [
                                { start: '2026-04-15T09:30:00Z', end: '2026-04-15T10:30:00Z' }
                            ]
                        }
                    }
                }
            });

            const resultado = await verificarDisponibilidade(new Date('2026-04-15T10:00:00'));
            expect(resultado.disponivel).toBe(false);
            expect(resultado.conflito).toContain('ocupado');
        });

        it('retorna disponivel=true como fallback em caso de erro da API', async () => {
            mockFreebusyQuery.mockRejectedValue(new Error('API Error'));

            const resultado = await verificarDisponibilidade(new Date('2026-04-15T10:00:00'));
            expect(resultado.disponivel).toBe(true);
        });
    });

    // --------------------------------
    // consultarSlotsLivres
    // --------------------------------
    describe('consultarSlotsLivres()', () => {
        beforeEach(() => setEnv());

        it('retorna slots livres dentro do horário comercial', async () => {
            mockFreebusyQuery.mockResolvedValue({
                data: {
                    calendars: { primary: { busy: [] } }
                }
            });

            // Consultar 1 dia útil futuro para não depender da data atual da execução
            const dia = proximoDiaUtil();
            const inicio = new Date(dia);
            inicio.setHours(8, 0, 0, 0);
            const fim = new Date(dia);
            fim.setHours(18, 0, 0, 0);

            const slots = await consultarSlotsLivres({ dataInicio: inicio, dataFim: fim });

            expect(slots.length).toBeGreaterThan(0);
            // Todos os slots devem ter 30 minutos de duração
            slots.forEach(s => expect(s.duracaoMin).toBe(30));
            // Nenhum slot fora do horário comercial
            slots.forEach(s => {
                const hora = new Date(s.inicio).getHours();
                expect(hora).toBeGreaterThanOrEqual(8);
                expect(hora).toBeLessThan(18);
            });
        });

        it('exclui slots que colidem com eventos ocupados', async () => {
            // Usar dia útil futuro para evitar flakiness por data passada
            const dia = proximoDiaUtil();
            const busyStart = new Date(dia);
            busyStart.setHours(10, 0, 0, 0);
            const busyEnd = new Date(dia);
            busyEnd.setHours(11, 0, 0, 0);

            mockFreebusyQuery.mockResolvedValue({
                data: {
                    calendars: {
                        primary: {
                            busy: [
                                { start: busyStart.toISOString(), end: busyEnd.toISOString() }
                            ]
                        }
                    }
                }
            });

            const inicio = new Date(dia);
            inicio.setHours(9, 0, 0, 0);
            const fim = new Date(dia);
            fim.setHours(12, 0, 0, 0);

            const slots = await consultarSlotsLivres({ dataInicio: inicio, dataFim: fim });

            // Nenhum slot deve começar durante o período ocupado (10:00-11:00)
            const slotsNoConflito = slots.filter(s => {
                const d = new Date(s.inicio);
                return d >= busyStart && d < busyEnd;
            });
            expect(slotsNoConflito.length).toBe(0);

            // Devemos ter slots fora do período (9:00, 9:30, 11:00, 11:30)
            expect(slots.length).toBeGreaterThan(0);
        });

        it('propaga erro da API', async () => {
            mockFreebusyQuery.mockRejectedValue(new Error('Quota exceeded'));

            await expect(consultarSlotsLivres()).rejects.toThrow('Quota exceeded');
        });
    });

    // --------------------------------
    // criarEventoComMeet
    // --------------------------------
    describe('criarEventoComMeet()', () => {
        beforeEach(() => setEnv());

        it('cria evento e retorna link do Google Meet', async () => {
            mockEventsInsert.mockResolvedValue({
                data: {
                    id: 'evento-123',
                    htmlLink: 'https://calendar.google.com/event/123',
                    summary: 'Reunião com Lead — Elyon',
                    start: { dateTime: '2026-04-15T10:00:00-03:00' },
                    end: { dateTime: '2026-04-15T10:30:00-03:00' },
                    conferenceData: {
                        entryPoints: [
                            { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }
                        ]
                    }
                }
            });

            const resultado = await criarEventoComMeet({
                titulo: 'Reunião com Lead — Elyon',
                dataHoraInicio: new Date('2026-04-15T10:00:00'),
                participantes: ['lead@test.com'],
                observacoesCloser: 'Lead interessado, dor financeira alta',
                leadNome: 'João',
                contatoId: 'contato-1',
                leadId: 'lead-1',
            });

            expect(resultado.eventoId).toBe('evento-123');
            expect(resultado.linkMeet).toBe('https://meet.google.com/abc-defg-hij');
            expect(resultado.linkEvento).toContain('calendar.google.com');

            // Verificar que conferenceDataVersion=1 foi passado
            expect(mockEventsInsert).toHaveBeenCalledWith(
                expect.objectContaining({ conferenceDataVersion: 1 })
            );

            // Verificar participantes — inclui closer + lead
            const callArgs = mockEventsInsert.mock.calls[0][0];
            const attendees = callArgs.requestBody.attendees;
            expect(attendees).toContainEqual({ email: 'lead@test.com' });
            expect(attendees).toContainEqual({ email: 'closer@test.com' });
        });

        it('retorna linkMeet null se Conference Data não gerada', async () => {
            mockEventsInsert.mockResolvedValue({
                data: {
                    id: 'evento-456',
                    htmlLink: 'https://calendar.google.com/event/456',
                    summary: 'Reunião',
                    start: { dateTime: '2026-04-15T10:00:00-03:00' },
                    end: { dateTime: '2026-04-15T10:30:00-03:00' },
                    conferenceData: null,
                }
            });

            const resultado = await criarEventoComMeet({
                titulo: 'Reunião',
                dataHoraInicio: new Date('2026-04-15T10:00:00'),
            });

            expect(resultado.eventoId).toBe('evento-456');
            expect(resultado.linkMeet).toBeNull();
        });

        it('propaga erro da API', async () => {
            mockEventsInsert.mockRejectedValue(new Error('Calendar API Error'));

            await expect(criarEventoComMeet({
                titulo: 'Reunião',
                dataHoraInicio: new Date(),
            })).rejects.toThrow('Calendar API Error');
        });

        it('inclui observacoesCloser na descrição do evento', async () => {
            mockEventsInsert.mockResolvedValue({
                data: { id: 'evt', htmlLink: '', summary: '', start: {}, end: {}, conferenceData: null }
            });

            await criarEventoComMeet({
                titulo: 'Reunião',
                dataHoraInicio: new Date(),
                observacoesCloser: 'Dor financeira alta, cansado de gerenciar',
                leadNome: 'Maria',
            });

            const descricao = mockEventsInsert.mock.calls[0][0].requestBody.description;
            expect(descricao).toContain('Dor financeira alta');
            expect(descricao).toContain('Maria');
        });
    });

    // --------------------------------
    // gerarLinkAgendamento
    // --------------------------------
    describe('gerarLinkAgendamento()', () => {
        it('gera URL válida do Google Calendar', () => {
            const link = gerarLinkAgendamento({ titulo: 'Reunião Elyon' });

            expect(link).toContain('calendar.google.com/calendar/render');
            expect(link).toContain('action=TEMPLATE');
            expect(link).toContain('Reuni');
        });

        it('inclui emailCloser se configurado', () => {
            setEnv();
            const link = gerarLinkAgendamento({ titulo: 'Reunião' });
            expect(link).toContain('closer%40test.com');
        });

        it('funciona sem configuração de closer', () => {
            const link = gerarLinkAgendamento({ titulo: 'Reunião' });
            expect(link).toContain('calendar.google.com');
            expect(link).not.toContain('add=');
        });
    });

    // --------------------------------
    // formatarSlotsParaWhatsApp
    // --------------------------------
    describe('formatarSlotsParaWhatsApp()', () => {
        it('formata slots agrupados por dia', () => {
            const slots: SlotLivre[] = [
                { inicio: '2026-04-13T10:00:00.000Z', fim: '2026-04-13T10:30:00.000Z', duracaoMin: 30 },
                { inicio: '2026-04-13T11:00:00.000Z', fim: '2026-04-13T11:30:00.000Z', duracaoMin: 30 },
                { inicio: '2026-04-14T09:00:00.000Z', fim: '2026-04-14T09:30:00.000Z', duracaoMin: 30 },
            ];

            const texto = formatarSlotsParaWhatsApp(slots);
            expect(texto).toContain('📅');
            // Deve ter 2 linhas (2 dias diferentes)
            const linhas = texto.split('\n').filter(l => l.includes('📅'));
            expect(linhas.length).toBe(2);
        });

        it('respeita maxSlots', () => {
            const slots: SlotLivre[] = Array.from({ length: 20 }, (_, i) => ({
                inicio: new Date(2026, 3, 13 + i, 10, 0).toISOString(),
                fim: new Date(2026, 3, 13 + i, 10, 30).toISOString(),
                duracaoMin: 30,
            }));

            const texto = formatarSlotsParaWhatsApp(slots, 3);
            const linhas = texto.split('\n').filter(l => l.includes('📅'));
            expect(linhas.length).toBeLessThanOrEqual(3);
        });

        it('retorna string vazia para array vazio', () => {
            expect(formatarSlotsParaWhatsApp([])).toBe('');
        });
    });

    // --------------------------------
    // healthCheck
    // --------------------------------
    describe('healthCheck()', () => {
        it('retorna configurado=false quando sem credenciais', async () => {
            const status = await googleCalendarService.healthCheck();
            expect(status.configurado).toBe(false);
            expect(status.conectado).toBe(false);
            expect(status.erro).toContain('não configuradas');
        });

        it('retorna conectado=true quando API responde', async () => {
            setEnv();
            mockEventsList.mockResolvedValue({ data: { items: [] } });

            const status = await googleCalendarService.healthCheck();
            expect(status.configurado).toBe(true);
            expect(status.conectado).toBe(true);
        });

        it('retorna conectado=false quando API falha', async () => {
            setEnv();
            mockEventsList.mockRejectedValue(new Error('Auth failed'));

            const status = await googleCalendarService.healthCheck();
            expect(status.configurado).toBe(true);
            expect(status.conectado).toBe(false);
            expect(status.erro).toContain('Auth failed');
        });
    });

    // --------------------------------
    // CALENDAR_CONFIG
    // --------------------------------
    describe('CALENDAR_CONFIG', () => {
        it('define horário comercial padrão 8-18', () => {
            expect(googleCalendarService.CALENDAR_CONFIG.HORA_INICIO).toBe(8);
            expect(googleCalendarService.CALENDAR_CONFIG.HORA_FIM).toBe(18);
        });

        it('define dias úteis seg-sex', () => {
            expect(googleCalendarService.CALENDAR_CONFIG.DIAS_UTEIS).toEqual([1, 2, 3, 4, 5]);
        });

        it('define duração padrão de 30 minutos', () => {
            expect(googleCalendarService.CALENDAR_CONFIG.DURACAO_PADRAO_MINUTOS).toBe(30);
        });

        it('define timezone São Paulo', () => {
            expect(googleCalendarService.CALENDAR_CONFIG.TIMEZONE).toBe('America/Sao_Paulo');
        });
    });
});
