/**
 * Testes: orchestrator-queries.ts
 *
 * Cobre:
 * - buscarConfiguracaoTenant: retorno completo, tenant não encontrado, BYOK, erro BD
 * - buscarContextoConversa: lead existente, lead não encontrado, erro BD
 */

// Mock do Prisma
const mockPrisma = {
    tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
    },
    lead: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
    },
};

jest.mock('../../lib/db', () => ({
    prisma: mockPrisma,
}));

// Mock do crypto
jest.mock('../../lib/crypto', () => ({
    descriptografar: jest.fn((val: string) => `decrypted_${val}`),
}));

// Mock types do orchestrator
jest.mock('@openai/agents', () => ({}));

import { buscarConfiguracaoTenant, buscarContextoConversa, resolverLeadIdCanonico } from '../orchestrator-queries';

beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findMany.mockResolvedValue([]);
    mockPrisma.lead.findFirst.mockResolvedValue(null);
});

describe('resolverLeadIdCanonico', () => {
    it('preserva o Lead do tenant independentemente de statusProspeccao', async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: 'lead-canonico' }]);

        await expect(resolverLeadIdCanonico('(62) 99999-0001', 'tenant-001'))
            .resolves.toBe('lead-canonico');
        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith({
            where: {
                tenantId: 'tenant-001',
                OR: expect.arrayContaining([
                    { telefone: { contains: '62999990001' } },
                    { telefone: { contains: '6299990001' } },
                    { telefone5: { contains: '62999990001' } },
                    { telefone5: { contains: '6299990001' } },
                ]),
            },
            select: { id: true },
        });
    });

    it.each([
        ['telefone nacional de 10 digitos', '6233334444', ['6233334444', '62933334444']],
        ['telefone nacional de 11 digitos', '62933334444', ['62933334444', '6233334444']],
        ['DDI com telefone de 10 digitos', '556233334444', ['6233334444', '62933334444']],
        ['DDI com telefone de 11 digitos', '+55 (62) 93333-4444', ['62933334444', '6233334444']],
    ])('resolve %s usando variantes seguras em todos os campos', async (_cenario, entrada, esperados) => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: 'lead-canonico' }]);

        await expect(resolverLeadIdCanonico(entrada, 'tenant-001')).resolves.toBe('lead-canonico');

        const chamada = mockPrisma.lead.findMany.mock.calls[0][0];
        expect(chamada.where.tenantId).toBe('tenant-001');
        for (const campo of ['telefone', 'telefone2', 'telefone3', 'telefone4', 'telefone5']) {
            for (const numero of esperados) {
                expect(chamada.where.OR).toContainEqual({ [campo]: { contains: numero } });
            }
        }
    });

    it('falha fechada sem consultar o banco quando o telefone e invalido', async () => {
        await expect(resolverLeadIdCanonico('12345', 'tenant-001')).resolves.toBeNull();
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });

    it('falha fechada quando não existe Lead no tenant', async () => {
        mockPrisma.lead.findMany.mockResolvedValue([]);
        await expect(resolverLeadIdCanonico('62999990001', 'tenant-001')).resolves.toBeNull();
    });

    it('falha fechada quando o telefone é ambíguo no tenant', async () => {
        mockPrisma.lead.findMany.mockResolvedValue([{ id: 'lead-a' }, { id: 'lead-b' }]);
        await expect(resolverLeadIdCanonico('62999990001', 'tenant-001')).resolves.toBeNull();
    });
});

// ====================================
// BUSCAR CONFIGURAÇÃO TENANT
// ====================================

describe('buscarConfiguracaoTenant', () => {
    it('retorna null se tenant não encontrado', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue(null);
        const result = await buscarConfiguracaoTenant('tenant-inexistente');
        expect(result).toBeNull();
    });

    it('retorna configuração completa do tenant', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-001',
            nome: 'Imobiliária Teste',
            cidade: 'São Paulo',
            diferenciais: ['Fotos Profissionais', 'Tour 360'],
            perfilVenda: { comissaoPadrao: 6, prazoContrato: 180 },
            agentes: [{
                nome: 'Ana',
                genero: 'feminino',
                estaAtivo: true,
            }],
        });

        const result = await buscarConfiguracaoTenant('tenant-001');
        expect(result).not.toBeNull();
        expect(result!.nomeAgente).toBe('Ana');
        expect(result!.genero).toBe('feminino');
        expect(result!.nomeImobiliaria).toBe('Imobiliária Teste');
        expect(result!.cidade).toBe('São Paulo');
        expect(result!.comissaoPadrao).toBe('6%');
        expect(result!.prazoContrato).toBe(180);
        expect(result!.diferenciais).toEqual(['Fotos Profissionais', 'Tour 360']);
        expect(result!.configVersionToken).toBeDefined();
    });

    it('usa defaults quando agente não configurado', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-002',
            nome: 'Imob Sem Agente',
            diferenciais: [],
            perfilVenda: {},
            agentes: [],
        });

        const result = await buscarConfiguracaoTenant('tenant-002');
        expect(result).not.toBeNull();
        expect(result!.nomeAgente).toBe('Sofia'); // default
        expect(result!.genero).toBe('feminino'); // default
        expect(result!.comissaoPadrao).toBeUndefined(); // sem fallback global
        expect(result!.prazoContrato).toBe(180); // default
        expect(result!.diferenciais).toEqual([
            'Avaliação com dados de mercado',
            'Material Profissional',
            'Rede de Parceiros'
        ]);
    });

    it('descriptografa llmApiKey BYOK quando disponível', async () => {
        mockPrisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-003',
            nome: 'Imob BYOK',
            diferenciais: [],
            perfilVenda: {},
            agentes: [{ nome: 'Bot', genero: 'neutro', estaAtivo: true }],
            llmApiKeyCriptografada: 'encrypted_key_123',
            llmModelo: 'deepseek-chat',
            llmBaseUrl: 'https://api.deepseek.com/v1',
        });

        const result = await buscarConfiguracaoTenant('tenant-003');
        expect(result).not.toBeNull();
        expect(result!.llmApiKey).toBe('decrypted_encrypted_key_123');
        expect(result!.llmModelo).toBe('deepseek-chat');
        expect(result!.llmBaseUrl).toBe('https://api.deepseek.com/v1');
    });

    it('retorna null em caso de erro de BD', async () => {
        mockPrisma.tenant.findUnique.mockRejectedValue(new Error('DB offline'));
        const result = await buscarConfiguracaoTenant('tenant-001');
        expect(result).toBeNull();
    });
});

// ====================================
// BUSCAR CONTEXTO CONVERSA
// ====================================

describe('buscarContextoConversa', () => {
    it('valida tenant ao reutilizar o Lead já resolvido', async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({
            id: 'lead-001',
            status: 'QUALIFICADO',
            doresIdentificadas: [],
            campanhaOrigem: null,
        });

        const result = await buscarContextoConversa('62999990001', 'tenant-001', 'lead-001');
        expect(result.leadId).toBe('lead-001');
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'lead-001', tenantId: 'tenant-001' },
        }));
    });
    it('retorna contexto com lead existente', async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({
            id: 'lead-001',
            status: 'QUALIFICADO',
            doresIdentificadas: ['preço alto', 'demora'],
            tipoAutorizacao: 'exclusiva',
            comissaoAcordada: '6%',
            prazoTrabalho: 90,
            campanhaOrigem: { nomeEmpreendimento: 'Ed. Solar' },
        });

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBe('lead-001');
        expect(result.statusLead).toBe('QUALIFICADO');
        expect(result.doresIdentificadas).toEqual(['preço alto', 'demora']);
        expect(result.empreendimento).toBe('Ed. Solar');
        expect(result.tipoAutorizacao).toBe('exclusiva');
        expect(result.comissaoAcordada).toBe('6%');
        expect(result.prazoTrabalho).toBe(90);
    });

    it('busca lead de prospecção quando lead CRM não encontrado', async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'contato-001' });

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBeUndefined();
        expect(result.contatoId).toBe('contato-001');
    });

    it('retorna apenas telefone se nem lead CRM nem lead de prospecção for encontrado', async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBeUndefined();
        expect(result.contatoId).toBeUndefined();
    });

    it('distingue lead CRM de lead em prospecção pelos filtros', async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'prospeccao-001' });

        await buscarContextoConversa('5511999990001', 'tenant-001');

        expect(mockPrisma.lead.findFirst).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({ statusProspeccao: null }),
            })
        );
        expect(mockPrisma.lead.findFirst).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                where: expect.objectContaining({
                    statusProspeccao: { not: null },
                }),
            })
        );
    });

    it('retorna apenas telefone em caso de erro', async () => {
        mockPrisma.lead.findFirst.mockRejectedValue(new Error('DB offline'));

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBeUndefined();
    });
});
