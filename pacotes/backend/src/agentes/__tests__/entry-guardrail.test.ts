import { executarGuardrailsEntrada } from '../entry-guardrail';

describe('executarGuardrailsEntrada', () => {
  it('não bloqueia quando não existe mensagem de usuário', async () => {
    const executarGuardrailsFn = jest.fn();

    const result = await executarGuardrailsEntrada({
      mensagens: [{ role: 'assistant', content: 'Olá' }],
      tenantId: 'tenant-1',
      telefone: '5511999990001',
      executarGuardrailsFn,
    });

    expect(result).toEqual({ bloqueado: false });
    expect(executarGuardrailsFn).not.toHaveBeenCalled();
  });

  it('bloqueia quando guardrail não permite mensagem', async () => {
    const executarGuardrailsFn = jest.fn().mockResolvedValue({
      permitido: false,
      tipo: 'OPT_OUT',
      mensagemFallback: 'Tudo bem, não enviarei mais mensagens.',
    });

    const result = await executarGuardrailsEntrada({
      mensagens: [{ role: 'user', content: 'Pare de me chamar' }],
      tenantId: 'tenant-1',
      telefone: '5511999990001',
      contatoId: 'contato-1',
      leadId: 'lead-1',
      executarGuardrailsFn,
    });

    expect(result.bloqueado).toBe(true);
    expect(result.guardrailResult?.tipo).toBe('OPT_OUT');
    expect(executarGuardrailsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        telefone: '5511999990001',
        conteudo: 'Pare de me chamar',
        tenantId: 'tenant-1',
        contatoId: 'contato-1',
        leadId: 'lead-1',
      })
    );
  });

  it('segue fluxo quando guardrail permite mensagem', async () => {
    const executarGuardrailsFn = jest.fn().mockResolvedValue({
      permitido: true,
      tipo: null,
    });

    const result = await executarGuardrailsEntrada({
      mensagens: [{ role: 'user', content: 'Quero vender meu imóvel' }],
      tenantId: 'tenant-1',
      telefone: '5511999990001',
      executarGuardrailsFn,
    });

    expect(result).toEqual({ bloqueado: false });
    expect(executarGuardrailsFn).toHaveBeenCalledTimes(1);
  });
});
