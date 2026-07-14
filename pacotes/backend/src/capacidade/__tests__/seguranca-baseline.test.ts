import { validarAlvoBaseline, validarBancoBaseline } from '../seguranca-baseline';

describe('proteções do baseline', () => {
  it.each(['https://elyon.ia.br', 'https://api.elyon.ia.br', 'http://86.48.0.157'])('recusa produção: %s', (alvo) => {
    expect(() => validarAlvoBaseline(alvo, true)).toThrow('ambiente de produção');
  });

  it('aceita loopback e banco dedicado', () => {
    expect(validarAlvoBaseline('http://127.0.0.1:3109').port).toBe('3109');
    expect(validarBancoBaseline('postgresql://user:pass@localhost:55439/elyon_baseline').pathname).toBe('/elyon_baseline');
  });

  it('recusa banco com nome não dedicado', () => {
    expect(() => validarBancoBaseline('postgresql://user:pass@localhost/elyon')).toThrow('Banco recusado');
  });
});
