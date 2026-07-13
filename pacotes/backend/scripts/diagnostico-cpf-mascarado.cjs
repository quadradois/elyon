/**
 * DIAGNÓSTICO — padrão de CPF mascarado no scraper da Prefeitura (Goiânia).
 *
 * Pega uma amostra ALEATÓRIA de imóveis sem CPF (status CANDIDATO/INDEFINIDO),
 * roda o scraper e separa: CPF/CNPJ válido vs MASCARADO vs NÃO ENCONTRADO vs ERRO.
 * Diferente do backfill de produção, AQUI capturamos o CPF cru retornado (inclusive
 * o mascarado, que o scraper-iptu.ts descarta) + a contagem de unidades no mesmo lote
 * (chave = 10 primeiros dígitos da inscrição), para investigar o padrão por lote.
 *
 * NÃO altera imoveis_rancho (status_proprietario/enriquecido_em). Grava em tabela
 * isolada geo360_diag_cpf (descartável). Repetível.
 *
 * Rodar (container): docker exec -e AMOSTRA=400 elyon_backend node /app/diagnostico-cpf-mascarado.cjs
 */
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();
const AMOSTRA = Number(process.env.AMOSTRA || 400);
const CONC = Number(process.env.SCRAPER_CONC || 3);
const PAUSA = Number(process.env.BATCH_PAUSE || 1000);

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const soDigitos = (v) => (v || '').replace(/\D/g, '');
const limparHtml = (v) => String(v || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

// --- validação de dígito (copiado de backfill-scraper-cpf.cjs) ---
function cpfValido(c) {
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s1 = 0; for (let i = 0; i < 9; i++) s1 += +c[i] * (10 - i);
  let d1 = (s1 * 10) % 11; if (d1 === 10) d1 = 0; if (d1 !== +c[9]) return false;
  let s2 = 0; for (let i = 0; i < 10; i++) s2 += +c[i] * (11 - i);
  let d2 = (s2 * 10) % 11; if (d2 === 10) d2 = 0; return d2 === +c[10];
}
function cnpjValido(c) {
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base, pesos) => { let s0 = 0; for (let i = 0; i < pesos.length; i++) s0 += +base[i] * pesos[i]; const r = s0 % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = calc(c, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(c, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === +c[12] && d2 === +c[13];
}
const docValido = (c) => (c.length === 11 ? cpfValido(c) : c.length === 14 ? cnpjValido(c) : false);

// --- scrape fiel ao scraper-iptu.ts, MAS mantendo o cpf cru ---
const DIRECT_URL = 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp';

async function raspar(nrinscr) {
  const params = new URLSearchParams();
  params.append('txt_nr_iptu', nrinscr);
  params.append('txt_captcha', '');
  const response = await axios.post(DIRECT_URL, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201f0.asp',
    },
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  const html = response.data.toString('latin1');
  const nomeMatch = html.match(/NOME<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const cpfMatch = html.match(/CPF\/CNPJ<\/td>\s*<td[^>]*>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  return {
    nome: nomeMatch ? limparHtml(nomeMatch[1]) : null,
    cpfRaw: cpfMatch ? limparHtml(cpfMatch[1]) : null,
  };
}

// classifica o retorno e o motivo da máscara
function classificar(nome, cpfRaw) {
  if (!nome) return { classificacao: 'NAO_ENCONTRADO', motivo: null, doc: null };
  const dig = soDigitos(cpfRaw);
  if (cpfRaw && docValido(dig)) {
    return dig.length === 14
      ? { classificacao: 'CNPJ_VALIDO', motivo: null, doc: 'CNPJ' }
      : { classificacao: 'CPF_VALIDO', motivo: null, doc: 'CPF' };
  }
  // tem nome mas CPF não válido → mascarado/bloqueado
  let motivo = 'outro';
  if (!cpfRaw) motivo = 'sem_campo';
  else if (cpfRaw.includes('*')) motivo = 'asteriscos';
  else if (/DESATUALIZADO|ENCAMINHAR|SECRETARIA/i.test(cpfRaw)) motivo = 'texto_erro';
  else if (dig.length && /^(0+|9+)$/.test(dig)) motivo = 'placeholder';
  else if (dig.length && /^(\d)\1+$/.test(dig)) motivo = 'placeholder';
  else if (dig.length < 11) motivo = 'curto';
  return { classificacao: 'MASCARADO', motivo, doc: null };
}

async function main() {
  log('==== DIAGNÓSTICO CPF mascarado ====', { AMOSTRA, CONC, PAUSA });

  await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS geo360_diag_cpf (
    inscricao varchar(20) PRIMARY KEY,
    lote varchar(10),
    nome text,
    cpf_raw text,
    cpf_digits varchar(20),
    doc_tipo varchar(8),
    classificacao varchar(24),
    motivo_mascara varchar(24),
    unidades_no_lote int,
    unidades_com_cpf int,
    scraped_em timestamptz DEFAULT now()
  )`);
  await p.$executeRawUnsafe(`TRUNCATE geo360_diag_cpf`);

  const amostra = await p.$queryRawUnsafe(
    `SELECT inscricao_cartografica AS insc FROM imoveis_rancho
     WHERE cidade='goiania' AND cpf_cnpj IS NULL
       AND status_proprietario IN ('CANDIDATO','INDEFINIDO')
     ORDER BY random() LIMIT ${AMOSTRA}`);
  log(`Amostra sorteada: ${amostra.length}`);

  // contagem de unidades por lote (base inteira de Goiânia) só p/ os lotes da amostra
  const lotes = [...new Set(amostra.map((r) => r.insc.slice(0, 10)))];
  const cont = await p.$queryRawUnsafe(
    `SELECT left(inscricao_cartografica,10) AS lote, count(*)::int AS n, count(cpf_cnpj)::int AS n_cpf
     FROM imoveis_rancho WHERE cidade='goiania' AND left(inscricao_cartografica,10) = ANY($1::text[])
     GROUP BY 1`, lotes);
  const mapaLote = new Map(cont.map((r) => [r.lote, r]));

  const tally = {};
  let feito = 0;

  async function processar(insc) {
    const lote = insc.slice(0, 10);
    const lc = mapaLote.get(lote) || { n: 1, n_cpf: 0 };
    let nome = null, cpfRaw = null, cls;
    try {
      const r = await raspar(insc);
      nome = r.nome; cpfRaw = r.cpfRaw;
      cls = classificar(nome, cpfRaw);
    } catch (e) {
      cls = { classificacao: 'ERRO', motivo: (e && e.message || 'erro').slice(0, 20), doc: null };
    }
    const dig = soDigitos(cpfRaw);
    await p.$executeRawUnsafe(
      `INSERT INTO geo360_diag_cpf
        (inscricao, lote, nome, cpf_raw, cpf_digits, doc_tipo, classificacao, motivo_mascara, unidades_no_lote, unidades_com_cpf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::int,$10::int)
       ON CONFLICT (inscricao) DO UPDATE SET
         nome=excluded.nome, cpf_raw=excluded.cpf_raw, cpf_digits=excluded.cpf_digits,
         doc_tipo=excluded.doc_tipo, classificacao=excluded.classificacao,
         motivo_mascara=excluded.motivo_mascara, unidades_no_lote=excluded.unidades_no_lote,
         unidades_com_cpf=excluded.unidades_com_cpf, scraped_em=now()`,
      insc, lote, nome, cpfRaw, dig || null, cls.doc,
      cls.classificacao, cls.motivo, String(lc.n), String(lc.n_cpf));
    tally[cls.classificacao] = (tally[cls.classificacao] || 0) + 1;
    feito++;
  }

  for (let i = 0; i < amostra.length; i += CONC) {
    const bloco = amostra.slice(i, i + CONC);
    await Promise.all(bloco.map((r) => processar(r.insc)));
    if (feito % 30 < CONC) log(`progresso: ${feito}/${amostra.length}`, tally);
    await sleep(PAUSA);
  }

  log('==== RESUMO: contagem por classificação ====', tally);

  const crosstab = await p.$queryRawUnsafe(
    `SELECT classificacao,
            CASE WHEN unidades_no_lote=1 THEN '1 unidade'
                 WHEN unidades_no_lote BETWEEN 2 AND 4 THEN '2-4'
                 ELSE '5+' END AS bucket_lote,
            count(*)::int AS n
     FROM geo360_diag_cpf GROUP BY 1,2 ORDER BY 1,2`);
  log('==== CROSS-TAB classificação x tamanho do lote ====');
  for (const row of crosstab) log(`  ${row.classificacao.padEnd(16)} ${row.bucket_lote.padEnd(10)} ${row.n}`);

  await p.$disconnect();
  log('FIM.');
}

main().catch((e) => { console.error(e); process.exit(1); });
