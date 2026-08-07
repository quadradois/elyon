import { classificarEfeitoTool, wrapToolExecute } from '../tool-wrapper';

describe('classificacao de efeitos das tools', () => {
  it('mantem catalogo explicito para PostgreSQL, read-only e externo', () => {
    expect(classificarEfeitoTool('qualificar_lead')).toBe('POSTGRES_MUTATION');
    expect(classificarEfeitoTool('consultar_preco_mercado')).toBe('READ_ONLY');
    expect(classificarEfeitoTool('consultar_horarios_disponiveis')).toBe('READ_ONLY');
    expect(classificarEfeitoTool('consultar_status_agendamento')).toBe('READ_ONLY');
    expect(classificarEfeitoTool('enviar_para_crm')).toBe('EXTERNAL_EFFECT');
    expect(classificarEfeitoTool('agendar_reuniao_closer')).toBe('EXTERNAL_EFFECT');
    expect(classificarEfeitoTool('cancelar_agendamento')).toBe('POSTGRES_MUTATION');
    expect(() => classificarEfeitoTool('tool_sem_classificacao')).toThrow('TOOL_EFFECT_CLASSIFICATION_MISSING');
  });

  it('executa mutacao PostgreSQL exclusivamente pelo executor fenced', async () => {
    const original = jest.fn(async () => JSON.stringify({ success: true }));
    const fenced = jest.fn(async (command: () => Promise<string>) => command());
    const external = jest.fn();
    const wrapped = wrapToolExecute('teste_pg', original, 'POSTGRES_MUTATION');
    await wrapped({}, { context: { withFencedTransaction: fenced, executeExternalEffect: external } });
    expect(fenced).toHaveBeenCalledTimes(1);
    expect(external).not.toHaveBeenCalled();
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('executa read-only sem abrir transacao fenced ou intencao externa', async () => {
    const original = jest.fn(async () => JSON.stringify({ success: true }));
    const fenced = jest.fn(); const external = jest.fn();
    const wrapped = wrapToolExecute('teste_read', original, 'READ_ONLY');
    await wrapped({}, { context: { withFencedTransaction: fenced, executeExternalEffect: external } });
    expect(original).toHaveBeenCalledTimes(1);
    expect(fenced).not.toHaveBeenCalled();
    expect(external).not.toHaveBeenCalled();
  });

  it('executa efeito externo fora da transacao e por intencao propria', async () => {
    const original = jest.fn(async () => JSON.stringify({ success: true }));
    const fenced = jest.fn();
    const external = jest.fn(async (_name: string, command: () => Promise<string>) => command());
    const wrapped = wrapToolExecute('teste_external', original, 'EXTERNAL_EFFECT');
    await wrapped({}, { context: { withFencedTransaction: fenced, executeExternalEffect: external } });
    expect(external).toHaveBeenCalledTimes(1);
    expect(fenced).not.toHaveBeenCalled();
    expect(original).toHaveBeenCalledTimes(1);
  });
});
