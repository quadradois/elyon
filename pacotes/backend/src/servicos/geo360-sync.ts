import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import {
  Geo360Client,
  type CidadeGeo360,
  type Geo360SearchItem as SearchItem,
} from './geo360-client';

export type { CidadeGeo360 } from './geo360-client';

export type OpcoesGeo360Sync = {
  cidade: CidadeGeo360;
  prefixos?: string[];
  promover?: boolean;
  concorrencia?: number;
  pausaMs?: number;
  limiteDetalhes?: number;
  deadlineMs?: number;
  reutilizarStage?: boolean;
};

export type Geo360StageRow = {
  inscricao: string;
  id_imobiliario: number | null;
  id_lote: number | null;
  numero_cadastro: number | null;
  latitude: number | null;
  longitude: number | null;
  cpf_cnpj: string | null;
  nome_pessoa: string | null;
  tipo_pessoa: number | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  complemento: string | null;
  logradouro: string | null;
  area_construida: number | null;
  area_terreno: number | null;
  tipo_edificacao: number | null;
  nr_lote: string | null;
  id_bairro: number | null;
  id_quadra: number | null;
  id_setor: number | null;
  raw: Record<string, unknown>;
};

const DETAIL_VERSION = 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const asText = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value).trim() || null;
const normalizarInscricao = (value: unknown, cidade: CidadeGeo360) => {
  const tamanho = cidade === 'aparecidadegoiania' ? 17 : 14;
  return String(value ?? '').replace(/\D/g, '').padStart(tamanho, '0');
};

export { normalizarListaGeo360 } from './geo360-client';

export function centroideWkt(wkt: unknown): [number | null, number | null] {
  if (typeof wkt !== 'string') return [null, null];
  const match = wkt.match(/\(\(([^)]+)\)/);
  if (!match) return [null, null];
  const pontos = match[1].split(',')
    .map((par) => par.trim().split(/\s+/).map(Number) as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (pontos.length < 3) return [null, null];
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  if (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1]) pontos.push([...primeiro]);

  let areaDobrada = 0;
  let somaLongitude = 0;
  let somaLatitude = 0;
  for (let indice = 0; indice < pontos.length - 1; indice++) {
    const [lngAtual, latAtual] = pontos[indice];
    const [lngProximo, latProximo] = pontos[indice + 1];
    const cruzado = lngAtual * latProximo - lngProximo * latAtual;
    areaDobrada += cruzado;
    somaLongitude += (lngAtual + lngProximo) * cruzado;
    somaLatitude += (latAtual + latProximo) * cruzado;
  }
  if (Math.abs(areaDobrada) < Number.EPSILON) {
    const semFechamento = pontos.slice(0, -1);
    const longitude = semFechamento.reduce((total, [lng]) => total + lng, 0) / semFechamento.length;
    const latitude = semFechamento.reduce((total, [, lat]) => total + lat, 0) / semFechamento.length;
    return [latitude, longitude];
  }
  return [somaLatitude / (3 * areaDobrada), somaLongitude / (3 * areaDobrada)];
}

async function gravarLotesDescobertos(cidade: CidadeGeo360, items: SearchItem[]) {
  const lotes = new Map<number, { id_lote: number; geometria_wkt: string | null; latitude: number | null; longitude: number | null }>();
  for (const item of items) {
    const idLote = asNumber(item.id_lote);
    if (idLote === null || !Number.isSafeInteger(idLote) || lotes.has(idLote)) continue;
    const geometriaWkt = asText(item.geom);
    const [latitude, longitude] = centroideWkt(geometriaWkt);
    lotes.set(idLote, { id_lote: idLote, geometria_wkt: geometriaWkt, latitude, longitude });
  }
  if (!lotes.size) return;
  await prisma.$executeRawUnsafe(`
    WITH dados AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        id_lote integer,geometria_wkt text,latitude double precision,longitude double precision
      )
    )
    INSERT INTO geo360_lotes
      (cidade,id_lote,geometria_wkt,latitude,longitude,status,atualizado_em)
    SELECT $2,id_lote,geometria_wkt,latitude,longitude,'PENDENTE',now() FROM dados
    ON CONFLICT (cidade,id_lote) DO UPDATE SET
      geometria_wkt=COALESCE(EXCLUDED.geometria_wkt,geo360_lotes.geometria_wkt),
      latitude=COALESCE(EXCLUDED.latitude,geo360_lotes.latitude),
      longitude=COALESCE(EXCLUDED.longitude,geo360_lotes.longitude),
      atualizado_em=now()`,
  JSON.stringify([...lotes.values()]), cidade);
}

async function prepararEstrutura() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS geo360_sync_runs (
      id uuid PRIMARY KEY, cidade text NOT NULL, status text NOT NULL,
      promover boolean NOT NULL DEFAULT false, iniciado_em timestamptz NOT NULL DEFAULT now(),
      concluido_em timestamptz, prefixos_total integer NOT NULL DEFAULT 0,
      prefixos_concluidos integer NOT NULL DEFAULT 0, encontrados integer NOT NULL DEFAULT 0,
      detalhes_ok integer NOT NULL DEFAULT 0, erros integer NOT NULL DEFAULT 0, mensagem text
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS geo360_prefix_progress (
      cidade text NOT NULL, prefixo text NOT NULL, status text NOT NULL,
      run_id uuid NOT NULL, total_search integer NOT NULL DEFAULT 0,
      detalhes_ok integer NOT NULL DEFAULT 0, sem_ficha integer NOT NULL DEFAULT 0,
      erros integer NOT NULL DEFAULT 0, atualizado_em timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (cidade, prefixo)
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS geo360_imoveis_stage (
      cidade text NOT NULL, inscricao text NOT NULL, id_imobiliario bigint,
      id_lote bigint, numero_cadastro bigint, latitude double precision, longitude double precision,
      cpf_cnpj text, nome_pessoa text, tipo_pessoa integer, endereco text, bairro text,
      cep text, complemento text, logradouro text, area_construida double precision,
      area_terreno double precision, tipo_edificacao integer, nr_lote text,
      id_bairro integer, id_quadra integer, id_setor integer, raw jsonb,
      detalhe_versao integer NOT NULL DEFAULT 0, detalhe_em timestamptz,
      visto_em timestamptz NOT NULL DEFAULT now(), run_id uuid NOT NULL, ativo boolean NOT NULL DEFAULT true,
      PRIMARY KEY (cidade, inscricao)
    )`);
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS geo360_stage_run_idx ON geo360_imoveis_stage (run_id)');
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS geo360_stage_id_imobiliario_idx ON geo360_imoveis_stage (cidade,id_imobiliario)');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS geo360_sync_failures (
      cidade text NOT NULL, prefixo text NOT NULL, inscricao text NOT NULL,
      id_imobiliario bigint, etapa text NOT NULL, codigo text, mensagem text NOT NULL,
      tentativas integer NOT NULL DEFAULT 1, primeira_em timestamptz NOT NULL DEFAULT now(),
      ultima_em timestamptz NOT NULL DEFAULT now(), resolvido_em timestamptz, run_id uuid NOT NULL,
      PRIMARY KEY (cidade, inscricao, etapa)
    )`);
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS geo360_failures_abertas_idx ON geo360_sync_failures (cidade,prefixo,resolvido_em)');
}

export function mapearDetalheGeo360(
  item: SearchItem,
  detail: Record<string, unknown>,
  cidade: CidadeGeo360 = 'goiania',
): Geo360StageRow {
  const inscricao = normalizarInscricao(
    detail.inscricao_cartografica___imobiliario ?? item.inscricao_cartografica, cidade);
  const tamanhoEsperado = cidade === 'aparecidadegoiania' ? 17 : 14;
  if (!new RegExp(`^\\d{${tamanhoEsperado}}$`).test(inscricao)) {
    throw new Error('INSCRICAO_INVALIDA');
  }
  const [latitude, longitude] = centroideWkt(item.geom);
  return {
    inscricao,
    id_imobiliario: asNumber(item.id_imobiliario),
    id_lote: asNumber(item.id_lote),
    numero_cadastro: asNumber(item.numero_cadastro ?? detail.numero_cadastro___imobiliario),
    latitude,
    longitude,
    cpf_cnpj: asText(detail.cpf_cnpj),
    nome_pessoa: asText(detail.nome___pessoa),
    tipo_pessoa: asNumber(detail.tipo___pessoa),
    endereco: asText(detail.endereco_completo),
    bairro: asText(detail.nome___bairro),
    cep: asText(detail.cep_inicial),
    complemento: asText(detail.complemento),
    logradouro: asText(detail.nome___logradouro),
    area_construida: asNumber(
      detail.area_construida_privativa___imobiliario ?? detail.area_construida_privativa),
    area_terreno: asNumber(detail.area_terreno_privativa),
    tipo_edificacao: asNumber(detail.tipo_edificacao),
    nr_lote: asText(detail.nr_lote),
    id_bairro: asNumber(detail.id_bairro),
    id_quadra: asNumber(detail.id_quadra),
    id_setor: asNumber(detail.id_setor),
    raw: detail,
  };
}

async function gravarLote(
  runId: string,
  cidade: CidadeGeo360,
  rows: Geo360StageRow[],
) {
  if (!rows.length) return;
  await prisma.$executeRawUnsafe(`
    WITH dados AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
        inscricao text,id_imobiliario bigint,id_lote bigint,numero_cadastro bigint,
        latitude double precision,longitude double precision,cpf_cnpj text,nome_pessoa text,
        tipo_pessoa integer,endereco text,bairro text,cep text,complemento text,logradouro text,
        area_construida double precision,area_terreno double precision,tipo_edificacao integer,
        nr_lote text,id_bairro integer,id_quadra integer,id_setor integer,raw jsonb
      )
    )
    INSERT INTO geo360_imoveis_stage (
      cidade,inscricao,id_imobiliario,id_lote,numero_cadastro,latitude,longitude,
      cpf_cnpj,nome_pessoa,tipo_pessoa,endereco,bairro,cep,complemento,logradouro,
      area_construida,area_terreno,tipo_edificacao,nr_lote,id_bairro,id_quadra,id_setor,
      raw,detalhe_versao,detalhe_em,visto_em,run_id,ativo)
    SELECT $2,inscricao,id_imobiliario,id_lote,numero_cadastro,latitude,longitude,
      cpf_cnpj,nome_pessoa,tipo_pessoa,endereco,bairro,cep,complemento,logradouro,
      area_construida,area_terreno,tipo_edificacao,nr_lote,id_bairro,id_quadra,id_setor,
      raw,$3,now(),now(),$4::uuid,true
    FROM dados
    ON CONFLICT (cidade,inscricao) DO UPDATE SET
      id_imobiliario=EXCLUDED.id_imobiliario,id_lote=EXCLUDED.id_lote,
      numero_cadastro=EXCLUDED.numero_cadastro,latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude,cpf_cnpj=EXCLUDED.cpf_cnpj,nome_pessoa=EXCLUDED.nome_pessoa,
      tipo_pessoa=EXCLUDED.tipo_pessoa,endereco=EXCLUDED.endereco,bairro=EXCLUDED.bairro,
      cep=EXCLUDED.cep,complemento=EXCLUDED.complemento,logradouro=EXCLUDED.logradouro,
      area_construida=EXCLUDED.area_construida,area_terreno=EXCLUDED.area_terreno,
      tipo_edificacao=EXCLUDED.tipo_edificacao,nr_lote=EXCLUDED.nr_lote,
      id_bairro=EXCLUDED.id_bairro,id_quadra=EXCLUDED.id_quadra,id_setor=EXCLUDED.id_setor,
      raw=EXCLUDED.raw,detalhe_versao=EXCLUDED.detalhe_versao,detalhe_em=now(),
      visto_em=now(),run_id=EXCLUDED.run_id,ativo=true`,
  JSON.stringify(rows), cidade, DETAIL_VERSION, runId);
  await prisma.$executeRawUnsafe(`
    UPDATE geo360_sync_failures SET resolvido_em=now(),ultima_em=now(),run_id=$3::uuid
    WHERE cidade=$1 AND etapa='DETALHE_OU_GRAVACAO' AND inscricao IN (
      SELECT value FROM jsonb_array_elements_text($2::jsonb) AS t(value)
    )`,
  cidade, JSON.stringify(rows.map((row) => row.inscricao)), runId);
}

async function registrarFalha(
  runId: string,
  cidade: CidadeGeo360,
  prefixo: string,
  item: SearchItem,
  error: unknown,
) {
  const inscricao = normalizarInscricao(item.inscricao_cartografica, cidade);
  const mensagem = error instanceof Error ? error.message : String(error);
  const codigo = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code ?? '') || null
    : null;
  await prisma.$executeRawUnsafe(`
    INSERT INTO geo360_sync_failures
      (cidade,prefixo,inscricao,id_imobiliario,etapa,codigo,mensagem,run_id)
    VALUES ($1,$2,$3,$4::bigint,'DETALHE_OU_GRAVACAO',$5,$6,$7::uuid)
    ON CONFLICT (cidade,inscricao,etapa) DO UPDATE SET
      prefixo=EXCLUDED.prefixo,id_imobiliario=EXCLUDED.id_imobiliario,
      codigo=EXCLUDED.codigo,mensagem=EXCLUDED.mensagem,
      tentativas=geo360_sync_failures.tentativas+1,ultima_em=now(),
      resolvido_em=NULL,run_id=EXCLUDED.run_id`,
  cidade, prefixo, inscricao, String(item.id_imobiliario), codigo, mensagem, runId);
}

async function gravarLoteIsolandoFalhas(
  runId: string,
  cidade: CidadeGeo360,
  prefixo: string,
  entradas: Array<{ item: SearchItem; row: Geo360StageRow }>,
): Promise<{ ok: number; erros: number }> {
  if (!entradas.length) return { ok: 0, erros: 0 };
  try {
    await gravarLote(runId, cidade, entradas.map(({ row }) => row));
    return { ok: entradas.length, erros: 0 };
  } catch (error) {
    if (entradas.length > 1) {
      const meio = Math.ceil(entradas.length / 2);
      const esquerda = await gravarLoteIsolandoFalhas(
        runId, cidade, prefixo, entradas.slice(0, meio));
      const direita = await gravarLoteIsolandoFalhas(
        runId, cidade, prefixo, entradas.slice(meio));
      return { ok: esquerda.ok + direita.ok, erros: esquerda.erros + direita.erros };
    }
    await registrarFalha(runId, cidade, prefixo, entradas[0].item, error);
    return { ok: 0, erros: 1 };
  }
}

async function reutilizarStageExistente(
  runId: string,
  cidade: CidadeGeo360,
  items: SearchItem[],
): Promise<Set<string>> {
  if (!items.length) return new Set();
  const ids = items.map((item) => String(item.id_imobiliario));
  const existentes = await prisma.$queryRawUnsafe<Array<{ id_imobiliario: bigint }>>(`
    UPDATE geo360_imoveis_stage SET run_id=$3::uuid,visto_em=now()
    WHERE cidade=$1 AND detalhe_versao >= $4 AND id_imobiliario IN (
      SELECT value::bigint FROM jsonb_array_elements_text($2::jsonb) AS t(value)
    )
    RETURNING id_imobiliario`,
  cidade, JSON.stringify(ids), runId, DETAIL_VERSION);
  return new Set(existentes.map((row) => String(row.id_imobiliario)));
}

async function promoverItens(runId: string, cidade: CidadeGeo360, items: SearchItem[]) {
  if (!items.length) return;
  const ids = items.map((item) => String(item.id_imobiliario));
  await prisma.$executeRawUnsafe(`
    INSERT INTO imoveis_rancho (
      id,cidade,inscricao_cartografica,id_lote,numero_cadastro,cpf_cnpj,nome_pessoa,
      tipo_pessoa,endereco,bairro,cep,latitude,longitude,sincronizado_em,atualizado_em,
      complemento,logradouro,area_construida,area_terreno,tipo_edificacao,nr_lote,
      id_bairro,id_quadra,id_setor,raw,versao_enriquecimento,detalhe_em)
    SELECT 'geo360:'||cidade||':'||inscricao,cidade,inscricao,
      id_lote::integer,numero_cadastro::integer,cpf_cnpj,nome_pessoa,tipo_pessoa,endereco,
      bairro,cep,latitude,longitude,now(),now(),complemento,logradouro,area_construida,
      area_terreno,tipo_edificacao,nr_lote,id_bairro,id_quadra,id_setor,raw,detalhe_versao,detalhe_em
    FROM geo360_imoveis_stage
    WHERE run_id=$1::uuid AND cidade=$2 AND id_imobiliario IN (
      SELECT value::bigint FROM jsonb_array_elements_text($3::jsonb) AS t(value)
    )
    ON CONFLICT (inscricao_cartografica) DO UPDATE SET
      cidade=EXCLUDED.cidade,id_lote=EXCLUDED.id_lote,numero_cadastro=EXCLUDED.numero_cadastro,
      cpf_cnpj=EXCLUDED.cpf_cnpj,nome_pessoa=EXCLUDED.nome_pessoa,tipo_pessoa=EXCLUDED.tipo_pessoa,
      endereco=EXCLUDED.endereco,bairro=EXCLUDED.bairro,cep=EXCLUDED.cep,
      latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,sincronizado_em=now(),
      atualizado_em=now(),complemento=EXCLUDED.complemento,logradouro=EXCLUDED.logradouro,
      area_construida=EXCLUDED.area_construida,area_terreno=EXCLUDED.area_terreno,
      tipo_edificacao=EXCLUDED.tipo_edificacao,nr_lote=EXCLUDED.nr_lote,
      id_bairro=EXCLUDED.id_bairro,id_quadra=EXCLUDED.id_quadra,id_setor=EXCLUDED.id_setor,
      raw=EXCLUDED.raw,versao_enriquecimento=EXCLUDED.versao_enriquecimento,
      detalhe_em=EXCLUDED.detalhe_em`,
  runId, cidade, JSON.stringify(ids));
}

export async function sincronizarGeo360(opcoes: OpcoesGeo360Sync) {
  await prepararEstrutura();
  const client = new Geo360Client(opcoes.cidade);
  const runId = randomUUID();
  const concorrencia = Math.max(1, Math.min(opcoes.concorrencia ?? 10, 20));
  const pausaMs = Math.max(50, opcoes.pausaMs ?? 150);
  const prefixos = opcoes.prefixos?.length ? opcoes.prefixos : await client.setores();
  await prisma.$executeRawUnsafe(
    `INSERT INTO geo360_sync_runs (id,cidade,status,promover,prefixos_total)
     VALUES ($1::uuid,$2,'EM_ANDAMENTO',$3,$4)`,
    runId, opcoes.cidade, Boolean(opcoes.promover), prefixos.length);
  let encontrados = 0;
  let detalhesOk = 0;
  let erros = 0;
  let processados = 0;
  let prefixosConcluidos = 0;
  try {
    for (const prefixo of prefixos) {
      if (opcoes.deadlineMs && Date.now() >= opcoes.deadlineMs) break;
      let items: SearchItem[];
      try {
        items = [...new Map((await client.pesquisar(prefixo))
          .map((item) => [String(item.id_imobiliario), item])).values()];
      } catch (error) {
        erros++;
        await prisma.$executeRawUnsafe(`
          INSERT INTO geo360_prefix_progress
            (cidade,prefixo,status,run_id,erros,atualizado_em)
          VALUES ($1,$2,'ERRO_SEARCH',$3::uuid,1,now())
          ON CONFLICT (cidade,prefixo) DO UPDATE SET status='ERRO_SEARCH',
            run_id=EXCLUDED.run_id,erros=geo360_prefix_progress.erros+1,atualizado_em=now()`,
        opcoes.cidade, prefixo, runId);
        await prisma.$executeRawUnsafe(
          `UPDATE geo360_sync_runs SET erros=$2,mensagem=$3 WHERE id=$1::uuid`,
          runId, erros, error instanceof Error ? error.message : String(error));
        continue;
      }
      encontrados += items.length;
      await gravarLotesDescobertos(opcoes.cidade, items);
      const idsReutilizados = opcoes.reutilizarStage
        ? await reutilizarStageExistente(runId, opcoes.cidade, items)
        : new Set<string>();
      const pendentes = items.filter(
        (item) => !idsReutilizados.has(String(item.id_imobiliario)));
      let okPrefixo = idsReutilizados.size;
      let errosPrefixo = 0;
      let semFicha = 0;
      for (let offset = 0; offset < pendentes.length; offset += concorrencia) {
        if (opcoes.limiteDetalhes && processados >= opcoes.limiteDetalhes) break;
        const lote = pendentes.slice(offset, offset + concorrencia).slice(
          0, opcoes.limiteDetalhes ? opcoes.limiteDetalhes - processados : undefined);
        const resultados = await Promise.allSettled(lote.map(async (item) => {
          const detail = await client.detalhe(item.id_imobiliario);
          if (!detail?.inscricao_cartografica___imobiliario) return null;
          return { item, row: mapearDetalheGeo360(item, detail, opcoes.cidade) };
        }));
        const entradas: Array<{ item: SearchItem; row: Geo360StageRow }> = [];
        for (let indice = 0; indice < resultados.length; indice++) {
          const resultado = resultados[indice];
          processados++;
          if (resultado.status === 'fulfilled' && resultado.value) entradas.push(resultado.value);
          else if (resultado.status === 'fulfilled') semFicha++;
          else {
            errosPrefixo++;
            await registrarFalha(
              runId, opcoes.cidade, prefixo, lote[indice], resultado.reason);
          }
        }
        const gravacao = await gravarLoteIsolandoFalhas(
          runId, opcoes.cidade, prefixo, entradas);
        okPrefixo += gravacao.ok;
        errosPrefixo += gravacao.erros;
        await sleep(pausaMs);
      }
      const completo = okPrefixo + semFicha + errosPrefixo === items.length && errosPrefixo === 0;
      if (completo && opcoes.promover) await promoverItens(runId, opcoes.cidade, items);
      await prisma.$executeRawUnsafe(`
        INSERT INTO geo360_prefix_progress
          (cidade,prefixo,status,run_id,total_search,detalhes_ok,sem_ficha,erros,atualizado_em)
        VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8,now())
        ON CONFLICT (cidade,prefixo) DO UPDATE SET status=EXCLUDED.status,run_id=EXCLUDED.run_id,
          total_search=EXCLUDED.total_search,detalhes_ok=EXCLUDED.detalhes_ok,
          sem_ficha=EXCLUDED.sem_ficha,erros=EXCLUDED.erros,atualizado_em=now()`,
      opcoes.cidade, prefixo, completo ? 'CONCLUIDO' : 'PARCIAL', runId,
      items.length, okPrefixo, semFicha, errosPrefixo);
      detalhesOk += okPrefixo;
      erros += errosPrefixo;
      if (completo) prefixosConcluidos++;
      await prisma.$executeRawUnsafe(`
        UPDATE geo360_sync_runs SET prefixos_concluidos=$2,
          encontrados=$3,detalhes_ok=$4,erros=$5 WHERE id=$1::uuid`,
      runId, prefixosConcluidos, encontrados, detalhesOk, erros);
    }
    const status = erros === 0 && prefixosConcluidos === prefixos.length ? 'SUCESSO' : 'PARCIAL';
    await prisma.$executeRawUnsafe(
      `UPDATE geo360_sync_runs SET status=$2,concluido_em=now(),mensagem=$3 WHERE id=$1::uuid`,
      runId, status, `${detalhesOk}/${encontrados} detalhes processados`);
    return { runId, status, cidade: opcoes.cidade, prefixos: prefixos.length, encontrados, detalhesOk, erros };
  } catch (error) {
    await prisma.$executeRawUnsafe(
      `UPDATE geo360_sync_runs SET status='ERRO',concluido_em=now(),mensagem=$2 WHERE id=$1::uuid`,
      runId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
