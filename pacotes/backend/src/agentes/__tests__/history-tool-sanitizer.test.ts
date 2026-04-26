import { sanitizeHistoryForToolProtocol } from '../history-tool-sanitizer';

describe('sanitizeHistoryForToolProtocol', () => {
  it('remove role=tool órfão sem tool_call_id', () => {
    const history = [
      { role: 'system', content: 'ctx' },
      { role: 'tool', content: 'resultado sem id' },
      { role: 'user', content: 'Oi' },
    ] as any;

    const result = sanitizeHistoryForToolProtocol(history, 'teste');

    expect(result).toEqual([
      { role: 'system', content: 'ctx' },
      { role: 'user', content: 'Oi' },
    ]);
  });

  it('remove tool output órfão quando tool_call_id não foi visto antes', () => {
    const history = [
      { role: 'assistant', content: 'Resposta normal' },
      { role: 'tool', tool_call_id: 'call_123', content: 'output órfão' },
    ] as any;

    const result = sanitizeHistoryForToolProtocol(history, 'teste');
    expect(result).toEqual([{ role: 'assistant', content: 'Resposta normal' }]);
  });

  it('preserva tool output quando há tool call correspondente', () => {
    const history = [
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_ok', type: 'function', function: { name: 'foo', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'call_ok', content: '{"ok":true}' },
    ] as any;

    const result = sanitizeHistoryForToolProtocol(history, 'teste');
    expect(result).toEqual(history);
  });
});

