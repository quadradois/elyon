/**
 * FASE 1 — Classificação de áreas públicas (Goiânia).
 *
 * Para cada imóvel de Goiânia SEM cpf_cnpj na base `imoveis_rancho`, consulta o
 * `propriedad` no Cadastro Imobiliário do MapaServer da Prefeitura (API pública) e
 * marca: 1=particular→CANDIDATO (scraper), 2/3/4=público→AREA_PUBLICA (pula scraper),
 * 0/5/não-encontrado→INDEFINIDO.
 *
 * Idempotente/resumível: só processa quem ainda tem propriedad_mapa NULL.
 * Usa SQL cru (não depende do Prisma Client conhecer as colunas novas).
 *
 * Rodar (dentro do container): node /app/scripts/classificar-areas-publicas.cjs
 */
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();
const FS_URL = 'https://portalmapa.goiania.go.gov.br/servicogyn/rest/services/MapaServer/Feature_BaseTeste/FeatureServer/3/query';
const LOTE = Number(process.env.LOTE || 50);
const PAUSA = Number(process.env.PAUSA || 250);

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MapaServer responde em latin1; só lemos nrinscr+propriedad (ascii/numérico) → decodifica seguro.
async function fsQuery(inscricoes, tentativa = 0) {
  const inList = inscricoes.map((i) => `'${i}'`).join(',');
  const params = new URLSearchParams({
    where: `nrinscr IN (${inList})`,
    outFields: 'nrinscr,propriedad',
    returnGeometry: 'false',
    f: 'json',
  });
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    const r = await fetch(`${FS_URL}?${params}`, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const d = JSON.parse(buf.toString('latin1'));
    if (d.error) throw new Error(`API error: ${JSON.stringify(d.error).slice(0, 120)}`);
    return d.features || [];
  } catch (e) {
    if (tentativa < 3) {
      await sleep(800 * 2 ** tentativa);
      return fsQuery(inscricoes, tentativa + 1);
    }
    throw e;
  }
}

function statusDePropriedad(prop) {
  if (prop === 1) return 'CANDIDATO';
  if (prop === 2 || prop === 3 || prop === 4) return 'AREA_PUBLICA';
  return 'INDEFINIDO'; // 0, 5
}

async function main() {
  log('==== FASE 1: classificar áreas públicas (Goiânia) ====', { LOTE, PAUSA });
  // garantir colunas (idempotente)
  await p.$executeRawUnsafe(`ALTER TABLE imoveis_rancho
    ADD COLUMN IF NOT EXISTS propriedad_mapa smallint,
    ADD COLUMN IF NOT EXISTS status_proprietario varchar,
    ADD COLUMN IF NOT EXISTS fonte_proprietario varchar,
    ADD COLUMN IF NOT EXISTS enriquecido_em timestamptz`);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_imrancho_status_prop ON imoveis_rancho (status_proprietario)`);

  const [{ pend }] = await p.$queryRawUnsafe(
    `SELECT count(*)::int pend FROM imoveis_rancho WHERE cidade='goiania' AND cpf_cnpj IS NULL AND propriedad_mapa IS NULL`
  );
  log(`Pendentes de classificar: ${pend}`);

  let processados = 0, classificados = 0, naoNaCamada = 0;
  while (true) {
    const linhas = await p.$queryRawUnsafe(
      `SELECT inscricao_cartografica insc FROM imoveis_rancho
       WHERE cidade='goiania' AND cpf_cnpj IS NULL AND propriedad_mapa IS NULL
       ORDER BY inscricao_cartografica LIMIT ${LOTE}`
    );
    if (linhas.length === 0) break;
    const inscs = linhas.map((l) => l.insc);

    let feats = [];
    try {
      feats = await fsQuery(inscs);
    } catch (e) {
      log(`Lote falhou após retries: ${e.message}. Pausando e seguindo.`);
      await sleep(3000);
      continue;
    }
    const mapa = new Map(feats.map((f) => [String(f.attributes.nrinscr).trim(), f.attributes.propriedad]));

    for (const insc of inscs) {
      const prop = mapa.has(insc) ? mapa.get(insc) : null;
      const propVal = prop == null ? -1 : prop;              // -1 = não está na camada
      const status = prop == null ? 'INDEFINIDO' : statusDePropriedad(prop);
      if (prop == null) naoNaCamada++; else classificados++;
      await p.$executeRawUnsafe(
        `UPDATE imoveis_rancho SET propriedad_mapa=$1::smallint, status_proprietario=$2 WHERE inscricao_cartografica=$3`,
        String(propVal), status, insc
      );
    }
    processados += inscs.length;
    if (processados % 1000 < LOTE) log(`progresso: ${processados}/${pend} (classificados=${classificados} fora_da_camada=${naoNaCamada})`);
    await sleep(PAUSA);
  }

  log('==== FASE 1 concluída ====');
  const dist = await p.$queryRawUnsafe(
    `SELECT status_proprietario, count(*)::int n FROM imoveis_rancho
     WHERE cidade='goiania' AND cpf_cnpj IS NULL GROUP BY 1 ORDER BY 2 DESC`
  );
  for (const d of dist) log(`  ${d.status_proprietario}: ${d.n}`);
  await p.$disconnect();
}
main().catch(async (e) => { log('FATAL', e.message); await p.$disconnect(); process.exit(1); });
