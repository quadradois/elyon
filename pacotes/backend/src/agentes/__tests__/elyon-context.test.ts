jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation((config: any) => ({ __clientConfig: config })),
}));

jest.mock('@openai/agents-openai', () => ({
  OpenAIChatCompletionsModel: jest.fn().mockImplementation((client: any, model: string) => ({
    __type: 'OpenAIChatCompletionsModel',
    client,
    model,
  })),
}));

jest.mock('../byok-resolver', () => ({
  MODELO_PADRAO_PRINCIPAL: 'gpt-4.1',
  MODELO_PADRAO_AUXILIAR: 'gpt-4.1-mini',
}));

import { criarModeloBYOK } from '../elyon-context';
import { OpenAI } from 'openai';
import { OpenAIChatCompletionsModel } from '@openai/agents-openai';

describe('criarModeloBYOK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna model default quando config não define model nem apiKey', () => {
    const result = criarModeloBYOK({}, 'gpt-4.1');

    expect(result).toBe('gpt-4.1');
    expect(OpenAI).not.toHaveBeenCalled();
    expect(OpenAIChatCompletionsModel).not.toHaveBeenCalled();
  });

  it('retorna model explícito sem criar client quando não há apiKey', () => {
    const result = criarModeloBYOK({ model: 'gpt-4.1-mini' }, 'gpt-4.1');

    expect(result).toBe('gpt-4.1-mini');
    expect(OpenAI).not.toHaveBeenCalled();
    expect(OpenAIChatCompletionsModel).not.toHaveBeenCalled();
  });

  it('cria OpenAI client + OpenAIChatCompletionsModel quando apiKey é fornecida', () => {
    const result = criarModeloBYOK(
      {
        model: 'deepseek-chat',
        apiKey: 'sk-test-123',
        baseUrl: 'https://api.deepseek.com/v1',
      },
      'gpt-4.1'
    ) as any;

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test-123',
      baseURL: 'https://api.deepseek.com/v1',
    });

    expect(OpenAIChatCompletionsModel).toHaveBeenCalledWith(
      expect.any(Object),
      'deepseek-chat'
    );

    expect(result.__type).toBe('OpenAIChatCompletionsModel');
    expect(result.model).toBe('deepseek-chat');
  });
});
