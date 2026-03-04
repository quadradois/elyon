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
    it('permite se tenant não encontrado (fallback seguro)', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue(null);
        const result = await verificarHorarioComercial('tenant-001');
        expect(result.permitido).toBe(true);
    });

    it('permite se horário simples cobre horário atual', async () => {
        const hora = new Date().getHours();
        // Configura horário que cobre as 24h
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
