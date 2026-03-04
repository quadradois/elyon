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
        findFirst: jest.fn().mockResolvedValue(null),
    },
    contato: {
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

import { buscarConfiguracaoTenant, buscarContextoConversa } from '../orchestrator-queries';

beforeEach(() => {
    jest.clearAllMocks();
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
        expect(result!.comissaoPadrao).toBe('5%'); // default
        expect(result!.prazoContrato).toBe(180); // default
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
    });

    it('busca contato quando lead não encontrado', async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.contato.findFirst.mockResolvedValue({ id: 'contato-001' });

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBeUndefined();
        expect(result.contatoId).toBe('contato-001');
    });

    it('retorna apenas telefone se nem lead nem contato encontrado', async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.contato.findFirst.mockResolvedValue(null);

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBeUndefined();
        expect(result.contatoId).toBeUndefined();
    });

    it('retorna apenas telefone em caso de erro', async () => {
        mockPrisma.lead.findFirst.mockRejectedValue(new Error('DB offline'));

        const result = await buscarContextoConversa('5511999990001', 'tenant-001');
        expect(result.telefone).toBe('5511999990001');
        expect(result.leadId).toBeUndefined();
    });
});
