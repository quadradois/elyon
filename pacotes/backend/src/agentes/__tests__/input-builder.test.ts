import { construirInputSdk } from '../input-builder';
import type { EstadoConversa } from '../conversation-state';

describe('construirInputSdk', () => {
  const estadoBase: EstadoConversa = {
    intencao: 'vender',
    metragem: 92,
    ocupacao: 'ocupado',
    valorPretendido: 'R$ 750.000',
    jaRespondeuDecisao: true,
    estaAnunciando: false,
    timeline: null,
    perguntasJaFeitas: {
      prioridade: true,
      decisaoVenda: true,
      valor: false,
    },
  };

  it('monta input de primeiro turno com system + histórico em formato da Responses API', () => {
    const mensagens = [
      { role: 'user' as const, content: 'Quero vender meu apartamento.' },
      { role: 'assistant' as const, content: 'Perfeito, me conta mais um pouco.' },
      { role: 'user' as const, content: 'Tem 92m2 e está ocupado.' },
    ];

    const result = construirInputSdk({
      mensagens,
      estadoConversaAtual: estadoBase,
      config: {
        comissaoPadrao: '5%',
        prazoContrato: 120,
        diferenciais: ['Fotos Pro', 'Tour 360'],
      },
      contexto: {
        leadId: 'lead-123',
        statusLead: 'NOVO',
      },
    });

    expect(result.origem).toBe('primeiro_turno');
    expect(result.inputSDK).toHaveLength(4);
    expect((result.inputSDK[0] as any).role).toBe('system');
    expect((result.inputSDK[0] as any).content).toContain('CONTEXTO DO LEAD');
    expect((result.inputSDK[0] as any).content).toContain('NOSSO MÉTODO DE TRABALHO');
    expect((result.inputSDK[0] as any).content).toContain('comissão segue a política comercial vigente');

    expect(result.inputSDK[1]).toEqual({
      role: 'user',
      content: [{ type: 'input_text', text: 'Quero vender meu apartamento.' }],
    });

    expect(result.inputSDK[2]).toEqual({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Perfeito, me conta mais um pouco.' }],
      status: 'completed',
    });
  });

  it('usa ramo de cache e anexa resumo + última mensagem do usuário', () => {
    const mensagens = [
      { role: 'assistant' as const, content: 'Vamos continuar.' },
      { role: 'user' as const, content: 'Pode seguir com a avaliação.' },
    ];

    const cachedHistory = [{ role: 'system', content: 'history-item' }] as any;

    const result = construirInputSdk({
      mensagens,
      cachedHistory,
      estadoConversaAtual: estadoBase,
      config: {},
      contexto: {},
    });

    expect(result.origem).toBe('cache');
    expect(result.cachedHistoryLength).toBe(1);
    expect(result.inputSDK).toHaveLength(3);
    expect(result.inputSDK[0]).toEqual({ role: 'system', content: 'history-item' });
    expect((result.inputSDK[1] as any).role).toBe('system');
    expect((result.inputSDK[1] as any).content).toContain('ESTADO RESUMIDO');
    expect(result.inputSDK[2]).toEqual({ role: 'user', content: 'Pode seguir com a avaliação.' });
  });

  it('inclui resumo de schemaState quando informado', () => {
    const result = construirInputSdk({
      mensagens: [{ role: 'user', content: 'Olá' }],
      estadoConversaAtual: estadoBase,
      schemaState: { intencao: 'vender', metragem: 92, ocupacao: 'ocupado' } as any,
      config: {},
      contexto: {},
    });

    expect((result.inputSDK[0] as any).content).toContain('HISTÓRICO DE COLETA');
    expect((result.inputSDK[0] as any).content).toContain('intencao');
  });

  it('inclui leadRecord quando presente', () => {
    const leadRec = { nome: 'João', telefone: '99999' };
    const result = construirInputSdk({
      mensagens: [{ role: 'user', content: 'Olá' }],
      estadoConversaAtual: estadoBase,
      config: {},
      contexto: { leadRecord: leadRec } as any,
    });
    expect((result.inputSDK[0] as any).content).toContain('DADOS EXISTENTES NO LEAD');
    expect((result.inputSDK[0] as any).content).toContain('nome: João');
  });

  it('não trata valor monetário em areaImovel como área conhecida no prompt', () => {
    const leadRec = { areaImovel: 'R$ 350.000', valorPretendido: 'R$ 350.000' };
    const result = construirInputSdk({
      mensagens: [{ role: 'user', content: 'Olá' }],
      estadoConversaAtual: estadoBase,
      config: {},
      contexto: { leadRecord: leadRec } as any,
    });

    const systemPrompt = (result.inputSDK[0] as any).content as string;
    expect(systemPrompt).not.toContain('• areaImovel: R$ 350.000');
  });

  it('prioriza ragPerfilTexto e adiciona briefing do empreendimento no primeiro turno', () => {
    const result = construirInputSdk({
      mensagens: [{ role: 'user', content: 'Olá' }],
      estadoConversaAtual: estadoBase,
      config: {
        ragPerfilTexto: 'Somos especialistas no bairro X.',
        briefingEmpreendimento: 'Torre única com lazer completo.',
      },
      contexto: {
        empreendimento: 'Residencial Jardim',
      },
    });

    expect(result.origem).toBe('primeiro_turno');
    expect((result.inputSDK[0] as any).content).toContain('PERFIL COMPLETO DA IMOBILIÁRIA');
    expect((result.inputSDK[0] as any).content).toContain('Somos especialistas no bairro X.');
    expect((result.inputSDK[0] as any).content).toContain('CONHECIMENTO DO EMPREENDIMENTO: Residencial Jardim');
    expect((result.inputSDK[0] as any).content).toContain('Torre única com lazer completo.');
  });
});
