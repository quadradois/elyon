export type CidadeGeo360 = 'goiania' | 'aparecidadegoiania';

export type Geo360SearchItem = {
  inscricao_cartografica: string | number;
  id_imobiliario: string | number;
  id_lote?: string | number | null;
  numero_cadastro?: string | number | null;
  geom?: string | null;
};

export type Geo360TokensPublicos = {
  authToken: string;
  tnToken: string;
};

const CADASTRO_URL = process.env.GEO360_BASE_URL || 'https://cadastro.geo360.com.br';
const PLATAFORMA_URL = process.env.GEO360_PLATAFORMA_URL || 'https://plataforma.geo360.com.br';
const OPENREST_URL = process.env.GEO360_OPENREST_URL || 'https://openrest.geo360.com.br';
const TOKEN_TTL_MS = 45 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function normalizarListaGeo360<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];
  for (const chave of ['value', 'data', 'results']) {
    const valor = (payload as Record<string, unknown>)[chave];
    if (Array.isArray(valor)) return valor as T[];
  }
  return [];
}

function authUrlDaCidade(cidade: CidadeGeo360): string {
  const especifica = cidade === 'goiania'
    ? process.env.GEO360_AUTH_URL_GOIANIA
    : process.env.GEO360_AUTH_URL_APARECIDA;
  if (especifica) return especifica;

  const leitor = cidade === 'goiania' ? 'goiania' : 'aparecidadegoiania';
  return `${PLATAFORMA_URL}/ouv/?q=leitor_${leitor}@vm2info.com`;
}

export class Geo360Client {
  private tokens: Geo360TokensPublicos | null = null;
  private tokenObtidoEm = 0;

  constructor(readonly cidade: CidadeGeo360) {}

  private async autenticar(): Promise<Geo360TokensPublicos> {
    const response = await fetch(authUrlDaCidade(this.cidade), { headers: { 'no-token': 'true' } });
    if (!response.ok) throw new Error(`GEO360_AUTH_HTTP_${response.status}`);
    const data = await response.json() as Partial<Geo360TokensPublicos>;
    if (!data.authToken || !data.tnToken) throw new Error('GEO360_TOKENS_PUBLICOS_AUSENTES');
    this.tokens = { authToken: data.authToken, tnToken: data.tnToken };
    this.tokenObtidoEm = Date.now();
    return this.tokens;
  }

  private async obterTokens(): Promise<Geo360TokensPublicos> {
    if (!this.tokens || Date.now() - this.tokenObtidoEm >= TOKEN_TTL_MS) {
      return this.autenticar();
    }
    return this.tokens;
  }

  private async requestJson(
    url: string,
    headers: Record<string, string>,
    timeoutMs = 60_000,
  ): Promise<unknown> {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { headers, signal: controller.signal });
        if (response.status === 401) {
          this.tokens = null;
          if (tentativa < 4) {
            const renovado = await this.obterTokens();
            headers.Authorization = `Bearer ${renovado.authToken}`;
            headers['x-auth-token'] = renovado.authToken;
            headers['x-tn-token'] = renovado.tnToken;
            continue;
          }
        }
        if (response.status === 429 || response.status >= 500) {
          await sleep(500 * (2 ** tentativa));
          continue;
        }
        if (!response.ok) throw new Error(`GEO360_HTTP_${response.status}:${new URL(url).pathname}`);
        return response.json();
      } catch (error) {
        if (tentativa === 4) throw error;
        await sleep(500 * (2 ** tentativa));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error(`GEO360_RETRIES_EXCEDIDOS:${new URL(url).pathname}`);
  }

  private async requestCadastro(path: string, timeoutMs = 60_000): Promise<unknown> {
    const tokens = await this.obterTokens();
    return this.requestJson(`${CADASTRO_URL}${path}`, {
      Authorization: `Bearer ${tokens.authToken}`,
    }, timeoutMs);
  }

  async setores(): Promise<string[]> {
    const payload = await this.requestCadastro(`/${this.cidade}/setor/`);
    return [...new Set(normalizarListaGeo360<Record<string, unknown>>(payload)
      .map((item) => String(item.setor ?? item.codigo ?? '').trim())
      .filter(Boolean))].sort();
  }

  async pesquisar(prefixo: string): Promise<Geo360SearchItem[]> {
    const payload = await this.requestCadastro(
      `/search/${this.cidade}/imobiliario?inscricao_cartografica=${encodeURIComponent(prefixo)}`,
      120_000,
    );
    return normalizarListaGeo360<Geo360SearchItem>(payload);
  }

  async detalhe(idImobiliario: string | number): Promise<Record<string, unknown> | null> {
    const payload = await this.requestCadastro(
      `/${this.cidade}/lote/busca_imoveis_all/${idImobiliario}/`,
    );
    const data = normalizarListaGeo360<Record<string, unknown>>(payload);
    if (data.length) return data[0];
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  }

  async caracterizarLote(idLote: number, page = 1, pageSize = 1): Promise<Record<string, unknown>> {
    const tokens = await this.obterTokens();
    const parametroId = this.cidade === 'goiania' ? 'v_id_lote' : 'id_lote';
    const query = new URLSearchParams({
      [parametroId]: String(idLote),
      page: String(page),
      page_size: String(pageSize),
    });
    const payload = await this.requestJson(
      `${OPENREST_URL}/rest/rpc/portal_info_lote?${query}`,
      { Authorization: `Bearer ${tokens.authToken}` },
    );
    if (!payload || typeof payload !== 'object') throw new Error('GEO360_LOTE_RESPOSTA_INVALIDA');
    return payload as Record<string, unknown>;
  }

  async caracterizarLoteCompleto(idLote: number, pageSize = 500): Promise<Record<string, unknown>> {
    const primeira = await this.caracterizarLote(idLote, 1, pageSize);
    const unidades = primeira.Unidades ?? primeira.unidades;
    if (!unidades || typeof unidades !== 'object' || Array.isArray(unidades)) return primeira;
    const bloco = unidades as Record<string, unknown>;
    const total = Number(bloco.total ?? 0);
    const items = Array.isArray(bloco.items) ? [...bloco.items] : [];
    const paginas = Number.isFinite(total) ? Math.ceil(total / pageSize) : 1;
    for (let pagina = 2; pagina <= paginas; pagina++) {
      const payload = await this.caracterizarLote(idLote, pagina, pageSize);
      const unidadesPagina = payload.Unidades ?? payload.unidades;
      if (unidadesPagina && typeof unidadesPagina === 'object' && !Array.isArray(unidadesPagina)) {
        const novos = (unidadesPagina as Record<string, unknown>).items;
        if (Array.isArray(novos)) items.push(...novos);
      }
    }
    return { ...primeira, Unidades: { ...bloco, total, items } };
  }

  async listarMidiasLote(idLote: number): Promise<Record<string, unknown>[]> {
    const tokens = await this.obterTokens();
    const query = new URLSearchParams({
      id_origem__exact: String(idLote),
      nome_camada__exact: 'lote',
    });
    const payload = await this.requestJson(
      `${PLATAFORMA_URL}/django/municipio/midia/search2/params/?${query}`,
      {
        'x-auth-token': tokens.authToken,
        'x-tn-token': tokens.tnToken,
      },
    );
    return normalizarListaGeo360<Record<string, unknown>>(payload);
  }
}
