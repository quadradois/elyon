import { construirElyonContext, gerarTextoUltimaInteracao } from '../context-builder';

describe('context-builder', () => {
  it('gera texto de última interação quando há agente em cache', () => {
    const texto = gerarTextoUltimaInteracao('PRESENTER');

    expect(texto).toContain('transferido automaticamente para você (PRESENTER)');
    expect(texto).toContain('NÃO SE APRESENTE NOVAMENTE');
  });

  it('retorna undefined para última interação quando não há agente em cache', () => {
    expect(gerarTextoUltimaInteracao(undefined)).toBeUndefined();
  });

  it('constrói ElyonContext com mapeamento completo e prisma injetado', () => {
    const prismaFake = { __fake: true } as any;

    const result = construirElyonContext({
      config: {
        tenantId: 'tenant-1',
        nomeAgente: 'Elyon',
        genero: 'masculino',
        nomeImobiliaria: 'Quadradois',
        cidade: 'Maringá',
        diferenciais: ['Tour 360'],
        comissaoPadrao: '6%',
        prazoContrato: 180,
        ragPerfilTexto: 'Perfil resumido',
        briefingEmpreendimento: 'Briefing ABC',
      },
      contexto: {
        telefone: '5511999990001',
        contatoId: 'contato-1',
        leadId: 'lead-1',
        statusLead: 'NOVO',
        doresIdentificadas: ['urgência'],
        empreendimento: 'Residencial Jardim',
        situacaoAtual: 'sozinho',
        tipoAutorizacao: 'simples',
        comissaoAcordada: '5%',
        prazoTrabalho: 120,
      },
      agenteCache: 'ADMIN',
      prismaClient: prismaFake,
    });

    expect(result.tenantId).toBe('tenant-1');
    expect(result.telefone).toBe('5511999990001');
    expect(result.nomeImobiliaria).toBe('Quadradois');
    expect(result.ultimaInteracao).toContain('(ADMIN)');
    expect(result.prisma).toBe(prismaFake);
  });
});
