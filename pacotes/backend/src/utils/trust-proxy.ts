type AmbienteTrustProxy = {
  NODE_ENV?: string;
  TRUST_PROXY_HOPS?: string;
};

/**
 * Resolve quantos proxies controlados existem entre o cliente e o Express.
 * Produção usa um Traefik; desenvolvimento e testes não confiam em proxy.
 */
export function resolverTrustProxy(
  ambiente: AmbienteTrustProxy = process.env
): number | false {
  const valor = ambiente.TRUST_PROXY_HOPS?.trim();

  if (!valor) {
    return ambiente.NODE_ENV === 'production' ? 1 : false;
  }

  if (!/^\d+$/.test(valor)) {
    throw new Error('TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10');
  }

  const saltos = Number.parseInt(valor, 10);
  if (saltos < 0 || saltos > 10) {
    throw new Error('TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10');
  }

  return saltos === 0 ? false : saltos;
}
