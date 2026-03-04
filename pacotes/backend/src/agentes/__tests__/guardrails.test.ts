/**
 * Testes: guardrails.ts
 *
 * Cobre:
 * - detectarComprador: gatilhos de compra/locação
 * - detectarOptout: gatilhos de opt-out
 * - verificarSpam: anti-flood (rate limit)
 * - verificarBlacklist: consulta BD (mock Prisma)
 * - verificarHorarioComercial: lógica de horário (mock Prisma)
 * - executarGuardrails: pipeline completo
 */

// Mock do Prisma
const mockPrisma = {
    tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
    },
    telefoneBlacklist: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
};

jest.mock('../../lib/db', () => ({
    prisma: mockPrisma,
}));

import {
    detectarComprador,
    detectarOptout,
    verificarSpam,
    verificarBlacklist,
    verificarHorarioComercial,
    executarGuardrails,
    MensagemContext,
} from '../guardrails';

// Helper: cria contexto de mensagem
function ctx(overrides: Partial<MensagemContext> = {}): MensagemContext {
    return {
        telefone: '5511999990001',
        conteudo: 'Oi, tudo bem?',
        tenantId: 'tenant-test-001',
        timestamp: new Date(),
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.telefoneBlacklist.findFirst.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
});

// ====================================
// DETECTAR COMPRADOR
// ====================================

describe('detectarComprador', () => {
    it('detecta "quero comprar" como comprador', () => {
        expect(detectarComprador('Oi, quero comprar um apartamento')).toBe(true);
    });

    it('detecta "procuro um imóvel"', () => {
        expect(detectarComprador('Procuro um imóvel na região')).toBe(true);
    });

    it('detecta "preciso alugar"', () => {
        expect(detectarComprador('Preciso alugar um apartamento')).toBe(true);
    });

    it('detecta "tenho interesse em comprar"', () => {
        expect(detectarComprador('Tenho interesse em comprar')).toBe(true);
    });

    it('NÃO detecta mensagem de proprietário', () => {
        expect(detectarComprador('Quero vender meu apartamento')).toBe(false);
    });

    it('NÃO detecta mensagem neutra', () => {
        expect(detectarComprador('Oi, tudo bem?')).toBe(false);
    });

    it('case insensitive', () => {
        expect(detectarComprador('QUERO COMPRAR UM APTO')).toBe(true);
    });
});

// ====================================
// DETECTAR OPT-OUT
// ====================================

describe('detectarOptout', () => {
    it('detecta "não me ligue mais"', () => {
        expect(detectarOptout('não me ligue mais por favor')).toBe(true);
    });

    it('detecta "pare de me mandar"', () => {
        expect(detectarOptout('Pare de me mandar mensagem')).toBe(true);
    });

    it('detecta "para de mandar"', () => {
        expect(detectarOptout('Para de mandar')).toBe(true);
    });

    it('detecta "denunciar spam"', () => {
        expect(detectarOptout('Vou denunciar spam')).toBe(true);
    });

    it('detecta "saia da minha lista"', () => {
        expect(detectarOptout('Saia da minha lista de contatos')).toBe(true);
    });

    it('NÃO detecta mensagem normal', () => {
        expect(detectarOptout('Quero vender meu apto')).toBe(false);
    });

    it('case insensitive', () => {
        expect(detectarOptout('NÃO QUERO MAIS MENSAGEM')).toBe(true);
    });
});

// ====================================
// VERIFICAR SPAM
// ====================================

describe('verificarSpam', () => {
    it('NÃO detecta spam na primeira mensagem', () => {
        const tel = `55119${Date.now()}`; // telefone único
        expect(verificarSpam(tel)).toBe(false);
    });

    it('NÃO detecta spam com 3 mensagens seguidas', () => {
        const tel = `55118${Date.now()}`;
        verificarSpam(tel);
        verificarSpam(tel);
        expect(verificarSpam(tel)).toBe(false);
    });

    it('DETECTA spam com 4+ mensagens no intervalo', () => {
        const tel = `55117${Date.now()}`;
        verificarSpam(tel);
        verificarSpam(tel);
        verificarSpam(tel);
        verificarSpam(tel);
        // 5ª mensagem — há 4 mensagens no intervalo anterior
        expect(verificarSpam(tel)).toBe(true);
    });
});

// ====================================
// VERIFICAR BLACKLIST
// ====================================

describe('verificarBlacklist', () => {
    it('retorna false se telefone NÃO está na blacklist', async () => {
        mockPrisma.telefoneBlacklist.findFirst.mockResolvedValue(null);
        const result = await verificarBlacklist('5511999990001', 'tenant-001');
        expect(result).toBe(false);
    });

    it('retorna true se telefone ESTÁ na blacklist', async () => {
        mockPrisma.telefoneBlacklist.findFirst.mockResolvedValue({ id: 'bl-1', telefone: '11999990001' });
        const result = await verificarBlacklist('5511999990001', 'tenant-001');
        expect(result).toBe(true);
    });

    it('retorna false se Prisma falhar (seguro)', async () => {
        mockPrisma.telefoneBlacklist.findFirst.mockRejectedValue(new Error('DB offline'));
        const result = await verificarBlacklist('5511999990001', 'tenant-001');
        expect(result).toBe(false);
    });
});

// ====================================
// VERIFICAR HORÁRIO COMERCIAL
// ====================================

describe('verificarHorarioComercial', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('permite se tenant não encontrado (fallback seguro)', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue(null);
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    it('permite se horário simples cobre horário atual', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: null,
            horarioAtendimento: '00:00 às 23:59',
            atendeFinalDeSemana: true,
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    it('permite em caso de erro de BD (fallback seguro)', async () => {
        mockPrisma.tenant.findUnique.mockRejectedValue(new Error('DB offline'));
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    // ---------- EXPEDIENTE SEMANAL ----------

    it('bloqueia dia inativo no expedienteSemanal', async () => {
        // Terça-feira 10h (dia 2)
        jest.useFakeTimers({ now: new Date(2026, 2, 3, 10, 0) }); // Ter, 03/Mar/2026 10:00
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [
                    { diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' },
                    { diaSemana: 2, ativo: false }, // Terça inativa
                ],
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('amanhã às 8h');
    });

    it('permite dentro do expedienteSemanal', async () => {
        // Segunda-feira 10h (dia 1)
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 10, 0) }); // Seg, 02/Mar/2026 10:00
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [
                    { diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' },
                ],
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    it('bloqueia antes do horário de início no expedienteSemanal', async () => {
        // Segunda 06:30 → antes das 08:00
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 6, 30) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [{ diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' }],
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('às 08:00');
    });

    it('bloqueia após o horário de fim no expedienteSemanal', async () => {
        // Segunda 19:00 → depois das 18:00
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 19, 0) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [{ diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' }],
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('amanhã às 8h');
    });

    it('bloqueia durante horário de almoço', async () => {
        // Segunda 12:30 → almoço 12:00-13:00
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 12, 30) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [{ diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' }],
                almocoInicio: '12:00',
                almocoFim: '13:00',
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('às 13:00');
    });

    it('permite fora do almoço no expedienteSemanal', async () => {
        // Segunda 14:00 → depois do almoço
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 14, 0) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [{ diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' }],
                almocoInicio: '12:00',
                almocoFim: '13:00',
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    // ---------- HORÁRIO SIMPLES ----------

    it('bloqueia fim de semana se atendeFinalDeSemana=false', async () => {
        // Sábado 10:00
        jest.useFakeTimers({ now: new Date(2026, 2, 7, 10, 0) }); // Sáb, 07/Mar/2026
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: null,
            horarioAtendimento: '08:00 às 18:00',
            atendeFinalDeSemana: false,
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('segunda-feira às 8h');
    });

    it('bloqueia antes do horário simples', async () => {
        // Segunda 06:00 → horário inicia às 09:00
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 6, 0) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: null,
            horarioAtendimento: '09:00 às 18:00',
            atendeFinalDeSemana: true,
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('às 09:00');
    });

    it('bloqueia depois do horário simples', async () => {
        // Segunda 20:00 → horário termina às 18:00
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 20, 0) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: null,
            horarioAtendimento: '08:00 às 18:00',
            atendeFinalDeSemana: true,
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('amanhã às 8h');
    });

    it('permite se não há horarioAtendimento configurado (usa default 08-18)', async () => {
        // Segunda 10:00 → sempre dentro do default
        jest.useFakeTimers({ now: new Date(2026, 2, 2, 10, 0) });
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: null,
            horarioAtendimento: null,
            atendeFinalDeSemana: true,
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    it('bloqueia dia sem configuração no expedienteSemanal (dias array vazio)', async () => {
        // Quarta-feira 10h (dia 3) — não está na lista de dias
        jest.useFakeTimers({ now: new Date(2026, 2, 4, 10, 0) }); // Qua, 04/Mar/2026
        mockPrisma.tenant.findUnique.mockResolvedValue({
            expedienteSemanal: {
                dias: [{ diaSemana: 1, ativo: true, inicio: '08:00', fim: '18:00' }],
            },
        });
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(false);
        expect(result.horarioRetorno).toBe('amanhã às 8h');
    });
});

// ====================================
// PIPELINE COMPLETO: executarGuardrails
// ====================================

describe('executarGuardrails', () => {
    it('permite mensagem normal de proprietário', async () => {
        const result = await executarGuardrails(ctx({ conteudo: 'Quero vender meu apto' }));
        expect(result.permitido).toBe(true);
    });

    it('bloqueia mensagem de comprador', async () => {
        const result = await executarGuardrails(ctx({ conteudo: 'Quero comprar um apartamento' }));
        expect(result.permitido).toBe(false);
        expect(result.tipo).toBe('COMPRADOR');
        expect(result.acao).toBe('ENCAMINHAR_CORRETOR');
        expect(result.mensagemFallback).toContain('comprar');
    });

    it('bloqueia opt-out e retorna mensagem', async () => {
        const result = await executarGuardrails(ctx({ conteudo: 'Não me ligue mais' }));
        expect(result.permitido).toBe(false);
        expect(result.tipo).toBe('OPTOUT');
        expect(result.acao).toBe('REGISTRAR_OPTOUT');
        expect(result.mensagemFallback).toBeDefined();
    });

    it('bloqueia telefone na blacklist', async () => {
        mockPrisma.telefoneBlacklist.findFirst.mockResolvedValue({ id: 'bl-1' });
        const result = await executarGuardrails(ctx());
        expect(result.permitido).toBe(false);
        expect(result.tipo).toBe('BLOQUEADO');
        expect(result.acao).toBe('IGNORAR');
    });

    it('blacklist tem prioridade sobre opt-out', async () => {
        mockPrisma.telefoneBlacklist.findFirst.mockResolvedValue({ id: 'bl-1' });
        const result = await executarGuardrails(ctx({ conteudo: 'Não me ligue mais' }));
        // Blacklist é verificado primeiro
        expect(result.tipo).toBe('BLOQUEADO');
    });

    it('spam tem prioridade sobre opt-out', async () => {
        const tel = `55116${Date.now()}`;
        // Gerar 4 mensagens de spam primeiro
        for (let i = 0; i < 4; i++) {
            verificarSpam(tel);
        }
        const result = await executarGuardrails(ctx({ telefone: tel, conteudo: 'Não me ligue mais' }));
        // Spam é verificado antes do opt-out
        expect(result.tipo).toBe('SPAM');
    });
});
