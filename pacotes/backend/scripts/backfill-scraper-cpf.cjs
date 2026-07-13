/**
 * FASE 2 — Backfill de proprietário via scraper da Prefeitura (Goiânia).
 *
 * Para imóveis ainda sem CPF que NÃO sejam área pública (status CANDIDATO ou INDEFINIDO —
 * inclui os não classificados no MapaServer), consulta o scraper da Prefeitura e grava o
 * proprietário na base `imoveis_rancho`. Pula AREA_PUBLICA (propriedad 2/3/4). Classifica:
 *   ENRIQUECIDO (CPF válido) | CERTIDAO_BLOQUEADA (nome sem CPF: dívida/máscara)
 *   NAO_ENCONTRADO (sem ficha) | ERRO (falha técnica → reprocessa).
 *
 * Resumível/idempotente (enriquecido_em). Para sozinho em DEADLINE_UTC.
 * Concorrência baixa + pausa: site público da Prefeitura, não martelar.
 * SQL cru nos updates (não depende do Prisma Client conhecer as colunas novas).
 *
 * Rodar (container): docker exec -d -e DEADLINE_UTC=<ms> elyon_backend node /app/backfill-scraper-cpf.cjs
 */
const { PrismaClient } = require('@prisma/client');
const { scraperIPTU } = require('/app/dist/servicos/scraper-iptu');

const p = new PrismaClient();
const CONC = Number(process.env.SCRAPER_CONC || 3);
const PAUSA = Number(process.env.BATCH_PAUSE || 800);
const DEADLINE = Number(process.env.DEADLINE_UTC || 0);
const MAX = Number(process.env.MAX || 0); // 0 = sem limite (p/ teste)

const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pastDeadline = () => DEADLINE && Date.now() >= DEADLINE;
const soDigitos = (v) => (v || '').replace(/\D/g, '');
const s = (v) => (v == null ? null : String(v));

// Validação de dígito verificador — o scraper devolve placeholders (999.../000...) quando a
// certidão está mascarada/bloqueada por dívida; precisam ser rejeitados (não são CPF real).
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

async function processar(insc) {
  let r;
  try {
    r = await scraperIPTU.consultarProprietario(insc);
  } catch (e) {
    const msg = e?.message || '';
    if (/não encontrad|nao encontrad|Dados não/i.test(msg)) {
      await marcar(insc, 'NAO_ENCONTRADO');
      return 'nao_encontrado';
    }
    // falha técnica (timeout/5xx) — NÃO marca enriquecido_em → reprocessa depois
    await p.$executeRawUnsafe(
      `UPDATE imoveis_rancho SET status_proprietario='ERRO' WHERE inscricao_cartografica=$1`, insc);
    return 'erro';
  }

  const cpf = soDigitos(r.cpf);
  if (cpf && docValido(cpf)) {
    const tipoPessoa = cpf.length === 14 ? 2 : 1;
    await p.$executeRawUnsafe(
      `UPDATE imoveis_rancho SET
         cpf_cnpj=$1,
         nome_pessoa=COALESCE(nome_pessoa,$2),
         tipo_pessoa=COALESCE(tipo_pessoa,$3::int),
         complemento=COALESCE(NULLIF(complemento,''),$4),
         logradouro=COALESCE(NULLIF(logradouro,''),$5),
         area_construida=COALESCE(area_construida,$6::double precision),
         area_terreno=COALESCE(area_terreno,$7::double precision),
         fonte_proprietario='SCRAPER_WEB',
         status_proprietario='ENRIQUECIDO',
         enriquecido_em=now(), atualizado_em=now()
       WHERE inscricao_cartografica=$8`,
      cpf, r.nome || null, s(tipoPessoa), r.complemento || r.unidade || null,
      r.logradouro || null, s(r.areaConstruida), s(r.areaTerreno), insc);
    return 'enriquecido';
  }

  // veio nome mas CPF ausente/inválido (placeholder 999.../000... = certidão bloqueada por dívida/máscara LGPD)
  // → grava o nome, NÃO grava o CPF-lixo
  await p.$executeRawUnsafe(
    `UPDATE imoveis_rancho SET nome_pessoa=COALESCE(nome_pessoa,$1),
       status_proprietario='CERTIDAO_BLOQUEADA', enriquecido_em=now(), atualizado_em=now()
     WHERE inscricao_cartografica=$2`, r.nome || null, insc);
  return 'bloqueada';
}

async function marcar(insc, status) {
  await p.$executeRawUnsafe(
    `UPDATE imoveis_rancho SET status_proprietario=$1, enriquecido_em=now() WHERE inscricao_cartografica=$2`,
    status, insc);
}

async function main() {
  log('==== FASE 2: scraper backfill (Goiânia) ====',
    { CONC, PAUSA, DEADLINE: DEADLINE ? new Date(DEADLINE).toISOString() : 'nenhum', MAX });

  const [{ fila }] = await p.$queryRawUnsafe(
    `SELECT count(*)::int fila FROM imoveis_rancho
     WHERE cidade='goiania' AND cpf_cnpj IS NULL AND status_proprietario IN ('CANDIDATO','INDEFINIDO') AND enriquecido_em IS NULL`);
  log(`Fila de candidatos: ${fila}`);

  const cont = { enriquecido: 0, bloqueada: 0, nao_encontrado: 0, erro: 0 };
  let total = 0;
  while (!pastDeadline()) {
    const linhas = await p.$queryRawUnsafe(
      `SELECT inscricao_cartografica insc FROM imoveis_rancho
       WHERE cidade='goiania' AND cpf_cnpj IS NULL AND status_proprietario IN ('CANDIDATO','INDEFINIDO') AND enriquecido_em IS NULL
       ORDER BY random() LIMIT ${CONC}`);
    if (linhas.length === 0) { log('Fila vazia — fim.'); break; }

    const res = await Promise.all(linhas.map((l) => processar(l.insc)));
    for (const x of res) cont[x]++;
    total += res.length;
    if (total % 200 < CONC) log(`progresso: ${total} (ok=${cont.enriquecido} bloq=${cont.bloqueada} nf=${cont.nao_encontrado} err=${cont.erro})`);
    if (MAX && total >= MAX) { log(`MAX=${MAX} atingido (teste).`); break; }
    await sleep(PAUSA);
  }
  if (pastDeadline()) log('⏰ deadline atingido — parando.');

  log('==== FASE 2 parcial/concluída ====', cont);
  await p.$disconnect();
}
main().catch(async (e) => { log('FATAL', e.message); await p.$disconnect(); process.exit(1); });
