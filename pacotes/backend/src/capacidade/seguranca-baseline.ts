const HOSTS_PRODUCAO = new Set(['elyon.ia.br', 'api.elyon.ia.br', 'crm.elyon.ia.br', '86.48.0.157']);
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', 'backend', 'elyon_baseline_backend']);

export function validarAlvoBaseline(valor: string, permitirRemoto = false): URL {
  const alvo = new URL(valor);
  const host = alvo.hostname.toLowerCase();
  if (HOSTS_PRODUCAO.has(host) || host.endsWith('.elyon.ia.br')) {
    throw new Error(`Carga recusada: ${host} é ambiente de produção`);
  }
  if (!HOSTS_LOCAIS.has(host) && !permitirRemoto) {
    throw new Error(`Carga remota exige CAPACITY_BASELINE_ALLOW_REMOTE=true: ${host}`);
  }
  return alvo;
}

export function validarBancoBaseline(databaseUrl: string, permitirRemoto = false): URL {
  const banco = new URL(databaseUrl);
  const nome = banco.pathname.replace(/^\//, '').toLowerCase();
  if (!/(baseline|integration|test)/.test(nome)) {
    throw new Error(`Banco recusado: o nome deve conter baseline, integration ou test (${nome})`);
  }
  validarAlvoBaseline(`http://${banco.hostname}`, permitirRemoto);
  return banco;
}
