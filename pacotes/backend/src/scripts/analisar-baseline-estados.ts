import { Prisma, PrismaClient } from '@prisma/client';

type CountMap = Record<string, number>;
interface AggregateBaseline {
  source: 'synthetic' | 'authorized-read-only';
  generatedAt: string;
  distributions: Record<string, CountMap>;
  contradictions: CountMap;
  quarantineCandidates: CountMap;
  qualificationCoverage: CountMap;
  readOnlyWriteRejected: boolean;
}

const KNOWN_OUTREACH = new Set(['AGUARDANDO', 'CONTATANDO', 'RESPONDEU', 'SEM_INTERESSE', 'INTERESSADO', 'LEAD', 'OPTOUT', 'OPT_OUT', 'FALHA', 'MORNO_FUTURO', 'FRIO', 'NAO_RESPONDEU']);
const KNOWN_MODES = new Set(['IA', 'HUMANO', 'PAUSADO']);
const KNOWN_SPIN = new Set(['SAUDACAO', 'SITUACAO', 'PROBLEMA', 'IMPLICACAO', 'NECESSIDADE', 'SOLUCAO', 'QUALIFICADO']);

function normalizedDistribution(rows: Array<{ value: string | null; count: number }>, known?: Set<string>): CountMap {
  return rows.reduce<CountMap>((acc, row) => {
    const bucket = row.value === null ? '__NULL__' : known && !known.has(row.value) ? '__UNKNOWN__' : row.value;
    acc[bucket] = (acc[bucket] || 0) + row.count;
    return acc;
  }, {});
}

function syntheticBaseline(): AggregateBaseline {
  return {
    source: 'synthetic', generatedAt: new Date().toISOString(),
    distributions: {
      statusLead: { NOVO: 4, VISITA_AGENDADA: 2, PERDIDO: 1 },
      statusProspeccao: { AGUARDANDO: 2, CONTATANDO: 2, OPTOUT: 1, __NULL__: 1, __UNKNOWN__: 1 },
      modoAtendimento: { IA: 5, HUMANO: 1, PAUSADO: 1 },
      faseSPIN: { SITUACAO: 2, PROBLEMA: 1, QUALIFICADO: 1, __NULL__: 3 },
    },
    contradictions: { optOutWithLaterActivity: 1, aiActivityDuringHumanMode: 1, invalidFollowUp: 2, invalidAppointment: 1 },
    quarantineCandidates: { ambiguousNullOutreach: 1, unknownOutreach: 1, legacyQualifiedWithoutPolicyEvidence: 1, negotiationWithoutDeterministicEvidence: 1, warmFutureWithoutValidFollowUp: 1 },
    qualificationCoverage: { candidatePopulation: 4, hasSituation: 3, hasMotivation: 2, hasProblemEvidence: 2, hasImplication: 1, hasCandidatePolicyEvidence: 1 },
    readOnlyWriteRejected: true,
  };
}

async function grouped(db: Prisma.TransactionClient, table: 'leads' | 'conversas', column: string): Promise<Array<{ value: string | null; count: number }>> {
  const allowed = table === 'leads'
    ? new Set(['status', 'statusProspeccao', 'modoAtendimento'])
    : new Set(['faseSPIN']);
  if (!allowed.has(column)) throw new Error('coluna agregada não autorizada');
  return db.$queryRawUnsafe<Array<{ value: string | null; count: number }>>(
    `SELECT "${column}"::text AS value, COUNT(*)::int AS count FROM "${table}" GROUP BY "${column}" ORDER BY count DESC`,
  );
}

async function scalar(db: Prisma.TransactionClient, sql: Prisma.Sql): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: number }>>(sql);
  return rows[0]?.count || 0;
}

async function authorizedBaseline(db: PrismaClient): Promise<AggregateBaseline> {
  const baseline: AggregateBaseline = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const [statusLead, outreach, modes, spin] = await Promise.all([
      grouped(tx, 'leads', 'status'), grouped(tx, 'leads', 'statusProspeccao'),
      grouped(tx, 'leads', 'modoAtendimento'), grouped(tx, 'conversas', 'faseSPIN'),
    ]);
    const contradictions = {
      optOutWithLaterActivity: await scalar(tx, Prisma.sql`SELECT COUNT(DISTINCT l.id)::int AS count FROM leads l JOIN atividades a ON a."leadId" = l.id WHERE l."statusProspeccao" IN ('OPTOUT','OPT_OUT') AND a."criadoEm" > l."atualizadoEm"`),
      aiActivityDuringHumanMode: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "modoAtendimento" IN ('HUMANO','PAUSADO') AND "ultimaAcaoIAEm" IS NOT NULL AND ("pausadoEm" IS NULL OR "ultimaAcaoIAEm" > "pausadoEm")`),
      invalidFollowUp: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "statusProspeccao" = 'MORNO_FUTURO' AND ("dataRecontato" IS NULL OR "motivoRecontato" IS NULL OR BTRIM("motivoRecontato") = '')`),
      invalidAppointment: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM atividades WHERE tipo = 'AVALIACAO' AND ("agendadoPara" IS NULL OR "statusAgendamento" IS NULL)`),
    };
    const quarantineCandidates = {
      ambiguousNullOutreach: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "statusProspeccao" IS NULL`),
      unknownOutreach: Object.entries(normalizedDistribution(outreach, KNOWN_OUTREACH)).find(([key]) => key === '__UNKNOWN__')?.[1] || 0,
      legacyQualifiedWithoutPolicyEvidence: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "statusProspeccao" = 'LEAD' AND ("schemaState" IS NULL OR NOT ("schemaState" ? 'qualificationPolicyVersion'))`),
      negotiationWithoutDeterministicEvidence: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE estagio = 'EM_NEGOCIACAO' AND "comissaoAcordada" IS NULL AND "tipoAutorizacao" IS NULL`),
      warmFutureWithoutValidFollowUp: contradictions.invalidFollowUp,
    };
    const qualificationCoverage = {
      candidatePopulation: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "statusProspeccao" IN ('RESPONDEU','INTERESSADO','LEAD')`),
      hasSituation: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "situacaoAtual" IS NOT NULL AND BTRIM("situacaoAtual") <> ''`),
      hasMotivation: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "motivacaoVenda" IS NOT NULL AND BTRIM("motivacaoVenda") <> ''`),
      hasProblemEvidence: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE COALESCE(array_length("doresIdentificadas", 1), 0) > 0`),
      hasImplication: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "consequencias" IS NOT NULL OR "custosAtuais" IS NOT NULL OR "pressaoTempo" IS NOT NULL`),
      hasCandidatePolicyEvidence: await scalar(tx, Prisma.sql`SELECT COUNT(*)::int AS count FROM leads WHERE "schemaState" ? 'qualificationPolicyVersion' AND "schemaState" ? 'evidence'`),
    };
    return {
      source: 'authorized-read-only', generatedAt: new Date().toISOString(),
      distributions: {
        statusLead: normalizedDistribution(statusLead),
        statusProspeccao: normalizedDistribution(outreach, KNOWN_OUTREACH),
        modoAtendimento: normalizedDistribution(modes, KNOWN_MODES),
        faseSPIN: normalizedDistribution(spin, KNOWN_SPIN),
      }, contradictions, quarantineCandidates, qualificationCoverage, readOnlyWriteRejected: false,
    };
  }, { timeout: 60_000 });
  let writeRejected = false;
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRaw`INSERT INTO webhook_eventos (id, provedor, "eventoId", tipo, "payloadHash", status, tentativas, "maxTentativas", "proximaTentativaEm", "recebidoEm", "atualizadoEm") VALUES (gen_random_uuid()::text, 'EVOLUTION', 'read-only-probe', 'PROBE', 'probe', 'PENDENTE', 0, 1, NOW(), NOW(), NOW())`;
    });
  } catch {
    writeRejected = true;
  }
  if (!writeRejected) throw new Error('transação read-only aceitou escrita de verificação');
  return { ...baseline, readOnlyWriteRejected: true };
}

async function main(): Promise<void> {
  const synthetic = process.argv.includes('--synthetic');
  if (synthetic) { process.stdout.write(`${JSON.stringify(syntheticBaseline(), null, 2)}\n`); return; }
  if (process.env.BASELINE_ANALYSIS_AUTHORIZED !== 'true') throw new Error('fail-closed: defina BASELINE_ANALYSIS_AUTHORIZED=true somente em sessão read-only aprovada');
  if (!process.env.DATABASE_URL) throw new Error('fail-closed: DATABASE_URL ausente');
  const db = new PrismaClient();
  try { process.stdout.write(`${JSON.stringify(await authorizedBaseline(db), null, 2)}\n`); }
  finally { await db.$disconnect(); }
}

void main().catch((error) => { process.stderr.write(`baseline analyzer failed: ${error instanceof Error ? error.message : 'unknown error'}\n`); process.exitCode = 1; });
