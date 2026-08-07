import { prisma } from '../lib/db';
import { Geo360Client, type CidadeGeo360 } from './geo360-client';

type CaracterizacaoLote = {
  nomeCondominio: string | null;
  enderecoOficial: string | null;
  bairro: string | null;
  ocupacao: string | null;
  totalUnidades: number;
  areaTerreno: number | null;
  areaTotalConstruida: number | null;
  raw: Record<string, unknown>;
};

type MidiaLote = {
  idMidia: number;
  link: string;
  nome: string | null;
  principal: number;
  situacaoFoto: number | null;
  dataPanorama: string | null;
  nomeCamada: string | null;
  raw: Record<string, unknown>;
};

type UnidadeLote = {
  inscricao: string;
  enderecoOficial: string | null;
  ocupacao: string | null;
  tipoEdificacao: string | null;
  areaConstruida: number | null;
};

export type OpcoesSincronizacaoLotes = {
  cidade: CidadeGeo360;
  idLotes?: number[];
  somenteMultiplasUnidades?: boolean;
  incluirMidias?: boolean;
  limite?: number;
  concorrencia?: number;
  pausaMs?: number;
  deadlineMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const texto = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) return null;
  const normalizado = String(valor).trim();
  return normalizado || null;
};

const numero = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const normalizado = typeof valor === 'string' ? valor.replace(',', '.') : valor;
  const convertido = Number(normalizado);
  return Number.isFinite(convertido) ? convertido : null;
};

function valorCampo(valor: unknown): unknown {
  if (valor && typeof valor === 'object') {
    return 'valor' in valor ? (valor as { valor?: unknown }).valor : null;
  }
  return valor;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

function obterCampoDosItens(itens: Record<string, unknown>[], nomes: string[]): unknown {
  for (const item of itens) {
    for (const nome of nomes) {
      const valor = valorCampo(item[nome]);
      if (valor !== null && valor !== undefined && valor !== '') return valor;
    }
  }
  return null;
}

export function mapearCaracterizacaoLote(payload: Record<string, unknown>): CaracterizacaoLote {
  const unidades = objeto(payload.Unidades ?? payload.unidades);
  const agregados = { ...payload };
  delete agregados.Unidades;
  delete agregados.unidades;
  const itens = Array.isArray(unidades.items)
    ? unidades.items.map(objeto)
    : [];
  const endereco = texto(obterCampoDosItens(itens, ['Endereço', 'Endereco', 'endereco_completo']));
  const bairroDoEndereco = endereco?.match(/\bBAIRRO\s+(.+)$/i)?.[1]?.trim() || null;

  return {
    nomeCondominio: texto(obterCampoDosItens(itens, ['Condomínio', 'Condominio', 'id_condominio'])),
    enderecoOficial: endereco,
    bairro: bairroDoEndereco,
    ocupacao: texto(obterCampoDosItens(itens, ['Ocupação', 'Ocupacao', 'ocupacao'])),
    totalUnidades: numero(unidades.total) ?? itens.length,
    areaTerreno: numero(payload['Área Terreno'] ?? payload['Area Terreno'] ?? payload.area_terreno),
    areaTotalConstruida: numero(
      payload['Área Total Construída'] ?? payload['Area Total Construida'] ?? payload.area_total_construida,
    ),
    // Os detalhes das unidades são persistidos nas colunas próprias de
    // imoveis_rancho; não duplicamos centenas de registros dentro do JSON do lote.
    raw: { ...agregados, Unidades: { ...unidades, items: undefined } },
  };
}

export function mapearUnidadesLote(payload: Record<string, unknown>): UnidadeLote[] {
  const unidades = objeto(payload.Unidades ?? payload.unidades);
  const items = Array.isArray(unidades.items) ? unidades.items.map(objeto) : [];
  const unicas = new Map<string, UnidadeLote>();
  for (const item of items) {
    const inscricao = String(obterCampoDosItens([item], [
      'Inscrição Imobiliária', 'Inscricao Imobiliaria', 'inscricao_cartografica',
    ]) ?? '').replace(/\D/g, '');
    if (!inscricao) continue;
    unicas.set(inscricao, {
      inscricao,
      enderecoOficial: texto(obterCampoDosItens([item], ['Endereço', 'Endereco', 'endereco_completo'])),
      ocupacao: texto(obterCampoDosItens([item], ['Ocupação', 'Ocupacao', 'ocupacao'])),
      tipoEdificacao: texto(obterCampoDosItens([item], [
        'Tipo Edificação', 'Tipo Edificacao', 'tipo_edificacao',
      ])),
      areaConstruida: numero(obterCampoDosItens([item], [
        'Área Construída Unidade', 'Area Construida Unidade', 'area_construida_privativa',
      ])),
    });
  }
  return [...unicas.values()];
}

export function mapearMidiasLote(payload: Record<string, unknown>[]): MidiaLote[] {
  const unicas = new Map<number, MidiaLote>();
  for (const item of payload) {
    const idMidia = numero(item.id);
    const link = texto(item.link);
    if (idMidia === null || !Number.isSafeInteger(idMidia) || !link) continue;
    const dataPanorama = texto(item.data_panorama);
    unicas.set(idMidia, {
      idMidia,
      link,
      nome: texto(item.nome),
      principal: numero(item.principal) ?? 0,
      situacaoFoto: numero(item.situacao_foto),
      dataPanorama: dataPanorama && /^\d{4}-\d{2}-\d{2}$/.test(dataPanorama) ? dataPanorama : null,
      nomeCamada: texto(item.nome_camada),
      raw: item,
    });
  }
  return [...unicas.values()].sort((a, b) => a.principal - b.principal || a.idMidia - b.idMidia);
}

export async function prepararIndiceLotesGeo360(
  cidade: CidadeGeo360,
  idLotes?: number[],
): Promise<number> {
  const ids = idLotes?.filter((id) => Number.isSafeInteger(id));
  const filtroPiloto = ids?.length ? ' AND id_lote = ANY($2::integer[])' : '';
  return prisma.$executeRawUnsafe(`
    INSERT INTO geo360_lotes
      (cidade,id_lote,total_unidades,latitude,longitude,status,atualizado_em)
    SELECT cidade,id_lote,count(*)::integer,min(latitude),min(longitude),'PENDENTE',now()
    FROM imoveis_rancho
    WHERE cidade=$1 AND id_lote IS NOT NULL${filtroPiloto}
    GROUP BY cidade,id_lote
    ON CONFLICT (cidade,id_lote) DO UPDATE SET
      total_unidades=EXCLUDED.total_unidades,
      latitude=COALESCE(geo360_lotes.latitude,EXCLUDED.latitude),
      longitude=COALESCE(geo360_lotes.longitude,EXCLUDED.longitude),
      atualizado_em=now()`,
  cidade, ...(ids?.length ? [ids] : []));
}

export async function persistirCaracterizacao(
  cidade: CidadeGeo360,
  idLote: number,
  caracterizacao: CaracterizacaoLote,
) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO geo360_lotes (
      cidade,id_lote,nome_condominio,endereco_oficial,bairro,ocupacao,total_unidades,
      area_terreno,area_total_construida,raw_caracterizacao,status,tentativas,
      ultimo_erro,caracterizado_em,atualizado_em
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8::text::double precision,$9::text::double precision,
      $10::jsonb,'CARACTERIZADO',1,NULL,now(),now()
    )
    ON CONFLICT (cidade,id_lote) DO UPDATE SET
      nome_condominio=EXCLUDED.nome_condominio,endereco_oficial=EXCLUDED.endereco_oficial,
      bairro=COALESCE(EXCLUDED.bairro,geo360_lotes.bairro),ocupacao=EXCLUDED.ocupacao,
      total_unidades=EXCLUDED.total_unidades,area_terreno=EXCLUDED.area_terreno,
      area_total_construida=EXCLUDED.area_total_construida,
      raw_caracterizacao=EXCLUDED.raw_caracterizacao,status='CARACTERIZADO',
      tentativas=geo360_lotes.tentativas+1,ultimo_erro=NULL,
      caracterizado_em=now(),atualizado_em=now()`,
  cidade, idLote, caracterizacao.nomeCondominio, caracterizacao.enderecoOficial,
  caracterizacao.bairro, caracterizacao.ocupacao, caracterizacao.totalUnidades,
  caracterizacao.areaTerreno === null ? null : String(caracterizacao.areaTerreno),
  caracterizacao.areaTotalConstruida === null ? null : String(caracterizacao.areaTotalConstruida),
  JSON.stringify(caracterizacao.raw));
}

async function persistirUnidades(cidade: CidadeGeo360, idLote: number, unidades: UnidadeLote[]) {
  if (unidades.length) {
    await prisma.$executeRawUnsafe(`
      WITH dados AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
          inscricao text,endereco_oficial text,ocupacao text,tipo_edificacao text,
          area_construida double precision
        )
      )
      UPDATE imoveis_rancho i SET
        endereco_oficial_geo360=d.endereco_oficial,
        ocupacao_geo360=d.ocupacao,
        tipo_edificacao_geo360=d.tipo_edificacao,
        area_construida_geo360=d.area_construida,
        atualizado_em=now()
      FROM dados d
      WHERE i.cidade=$2 AND i.id_lote=$3 AND i.inscricao_cartografica=d.inscricao`,
    JSON.stringify(unidades.map((unidade) => ({
      inscricao: unidade.inscricao,
      endereco_oficial: unidade.enderecoOficial,
      ocupacao: unidade.ocupacao,
      tipo_edificacao: unidade.tipoEdificacao,
      area_construida: unidade.areaConstruida,
    }))), cidade, idLote);
  }
  await prisma.$executeRawUnsafe(`
    UPDATE geo360_lotes SET unidades_sincronizadas_em=now(),atualizado_em=now()
    WHERE cidade=$1 AND id_lote=$2`, cidade, idLote);
}

async function persistirMidias(cidade: CidadeGeo360, idLote: number, midias: MidiaLote[]) {
  if (midias.length) {
    await prisma.$executeRawUnsafe(`
      WITH dados AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
          id_midia bigint,link text,nome text,principal integer,situacao_foto integer,
          data_panorama date,nome_camada text,raw jsonb
        )
      )
      INSERT INTO geo360_midias_lote
        (cidade,id_midia,id_lote,link,nome,principal,situacao_foto,data_panorama,
         nome_camada,raw,sincronizado_em,atualizado_em)
      SELECT $2,id_midia,$3,link,nome,principal,situacao_foto,data_panorama,
        nome_camada,raw,now(),now() FROM dados
      ON CONFLICT (cidade,id_midia) DO UPDATE SET
        id_lote=EXCLUDED.id_lote,link=EXCLUDED.link,nome=EXCLUDED.nome,
        principal=EXCLUDED.principal,situacao_foto=EXCLUDED.situacao_foto,
        data_panorama=EXCLUDED.data_panorama,nome_camada=EXCLUDED.nome_camada,
        raw=EXCLUDED.raw,sincronizado_em=now(),atualizado_em=now()`,
    JSON.stringify(midias.map((midia) => ({
      id_midia: midia.idMidia,
      link: midia.link,
      nome: midia.nome,
      principal: midia.principal,
      situacao_foto: midia.situacaoFoto,
      data_panorama: midia.dataPanorama,
      nome_camada: midia.nomeCamada,
      raw: midia.raw,
    }))), cidade, idLote);
  }
  await prisma.$executeRawUnsafe(`
    DELETE FROM geo360_midias_lote
    WHERE cidade=$1 AND id_lote=$2
      AND NOT (id_midia = ANY($3::bigint[]))`,
  cidade, idLote, midias.map((midia) => String(midia.idMidia)));
  await prisma.$executeRawUnsafe(`
    UPDATE geo360_lotes SET status=$3,midias_sincronizadas_em=now(),atualizado_em=now()
    WHERE cidade=$1 AND id_lote=$2`,
  cidade, idLote, midias.length ? 'CONCLUIDO' : 'CONCLUIDO_SEM_MIDIA');
}

async function registrarErroMidia(cidade: CidadeGeo360, idLote: number, error: unknown) {
  const mensagem = `MIDIA: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1000);
  await prisma.$executeRawUnsafe(`
    UPDATE geo360_lotes SET status='CARACTERIZADO_MIDIA_ERRO',ultimo_erro=$3,atualizado_em=now()
    WHERE cidade=$1 AND id_lote=$2`,
  cidade, idLote, mensagem);
}

async function registrarErroLote(cidade: CidadeGeo360, idLote: number, error: unknown) {
  const mensagem = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  await prisma.$executeRawUnsafe(`
    INSERT INTO geo360_lotes
      (cidade,id_lote,status,tentativas,ultimo_erro,atualizado_em)
    VALUES ($1,$2,'ERRO',1,$3,now())
    ON CONFLICT (cidade,id_lote) DO UPDATE SET status='ERRO',
      tentativas=geo360_lotes.tentativas+1,ultimo_erro=EXCLUDED.ultimo_erro,atualizado_em=now()`,
  cidade, idLote, mensagem);
}

async function selecionarLotes(opcoes: OpcoesSincronizacaoLotes): Promise<number[]> {
  if (opcoes.idLotes?.length) return [...new Set(opcoes.idLotes)];
  const limite = Math.max(1, Math.min(opcoes.limite ?? 1000, 100_000));
  const multiplas = opcoes.somenteMultiplasUnidades !== false;
  const retomarCaracterizados = opcoes.incluirMidias ?? opcoes.cidade === 'goiania';
  const rows = await prisma.$queryRawUnsafe<Array<{ id_lote: number }>>(`
    SELECT id_lote FROM geo360_lotes
    WHERE cidade=$1
      AND (status IN ('PENDENTE','ERRO')
        OR ($4::boolean AND status IN ('CARACTERIZADO','CARACTERIZADO_MIDIA_ERRO')))
      AND ($2::boolean = false OR total_unidades > 1)
    ORDER BY CASE WHEN total_unidades > 1 THEN 0 ELSE 1 END,
      total_unidades DESC,id_lote
    LIMIT $3`,
  opcoes.cidade, multiplas, limite, retomarCaracterizados);
  return rows.map((row) => Number(row.id_lote));
}

export async function sincronizarLotesGeo360(opcoes: OpcoesSincronizacaoLotes) {
  const idsSolicitados = opcoes.idLotes
    ? [...new Set(opcoes.idLotes.filter((id) => Number.isSafeInteger(id)))]
    : undefined;
  if (opcoes.idLotes && !idsSolicitados?.length) {
    return {
      cidade: opcoes.cidade, selecionados: 0, concluidos: 0,
      semMidia: 0, errosMidia: 0, erros: 0,
    };
  }
  await prepararIndiceLotesGeo360(opcoes.cidade, idsSolicitados);
  const client = new Geo360Client(opcoes.cidade);
  const ids = await selecionarLotes({ ...opcoes, idLotes: idsSolicitados });
  const concorrencia = Math.max(1, Math.min(opcoes.concorrencia ?? 3, 10));
  const pausaMs = Math.max(50, opcoes.pausaMs ?? 250);
  let concluidos = 0;
  let semMidia = 0;
  let erros = 0;
  let errosMidia = 0;
  const incluirMidias = opcoes.incluirMidias ?? opcoes.cidade === 'goiania';

  for (let offset = 0; offset < ids.length; offset += concorrencia) {
    if (opcoes.deadlineMs && Date.now() >= opcoes.deadlineMs) break;
    const loteIds = ids.slice(offset, offset + concorrencia);
    const resultados = await Promise.all(loteIds.map(async (idLote) => {
      try {
        const payload = await client.caracterizarLoteCompleto(idLote);
        const caracterizacao = mapearCaracterizacaoLote(payload);
        await persistirCaracterizacao(opcoes.cidade, idLote, caracterizacao);
        await persistirUnidades(opcoes.cidade, idLote, mapearUnidadesLote(payload));
        if (incluirMidias) {
          try {
            const midias = mapearMidiasLote(await client.listarMidiasLote(idLote));
            await persistirMidias(opcoes.cidade, idLote, midias);
            return midias.length ? 'CONCLUIDO' : 'SEM_MIDIA';
          } catch (error) {
            // Dados cadastrais válidos nunca são descartados por indisponibilidade
            // do serviço separado de mídias.
            await registrarErroMidia(opcoes.cidade, idLote, error);
            return 'ERRO_MIDIA';
          }
        }
        return 'CARACTERIZADO';
      } catch (error) {
        await registrarErroLote(opcoes.cidade, idLote, error);
        return 'ERRO';
      }
    }));
    for (const resultado of resultados) {
      if (resultado === 'ERRO') erros++;
      else {
        concluidos++;
        if (resultado === 'SEM_MIDIA') semMidia++;
        if (resultado === 'ERRO_MIDIA') errosMidia++;
      }
    }
    await sleep(pausaMs);
  }

  return { cidade: opcoes.cidade, selecionados: ids.length, concluidos, semMidia, errosMidia, erros };
}
