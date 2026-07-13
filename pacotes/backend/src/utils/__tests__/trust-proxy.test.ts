import { resolverTrustProxy } from '../trust-proxy';

describe('resolverTrustProxy', () => {
  it('confia em um salto por padrão em produção', () => {
    expect(resolverTrustProxy({ NODE_ENV: 'production' })).toBe(1);
  });

  it('não confia em proxy por padrão fora de produção', () => {
    expect(resolverTrustProxy({ NODE_ENV: 'test' })).toBe(false);
  });

  it('aceita configuração explícita', () => {
    expect(resolverTrustProxy({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '2' })).toBe(2);
    expect(resolverTrustProxy({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '0' })).toBe(false);
  });

  it.each(['-1', '11', 'abc', '1.5'])('rejeita valor inválido: %s', (valor) => {
    expect(() => resolverTrustProxy({
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: valor,
    })).toThrow('TRUST_PROXY_HOPS');
  });
});
