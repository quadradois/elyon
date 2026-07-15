import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const slug = 'ci-baseline-analysis-synthetic';

function assertSafe(): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('seed agregado permitido apenas em NODE_ENV=test');
  if (!/elyon_integration(?:\?|$)/.test(process.env.DATABASE_URL || '')) throw new Error('seed agregado exige elyon_integration');
}

async function cleanup(): Promise<void> {
  await db.tenant.deleteMany({ where: { slug } });
}

async function apply(): Promise<void> {
  await cleanup();
  const tenant = await db.tenant.create({ data: { nome: 'CI aggregate synthetic', slug } });
  const common = { tenantId: tenant.id, doresIdentificadas: [], objecoes: [], imovelCaracteristicas: [], imovelFotos: [] };
  await db.lead.createMany({ data: [
    { ...common, nome: 'Synthetic aggregate 1', statusProspeccao: 'LEAD', modoAtendimento: 'IA', schemaState: { qualificationPolicyVersion: 'spin-candidate-v1', evidence: { situation: true } } },
    { ...common, nome: 'Synthetic aggregate 2', statusProspeccao: 'MORNO_FUTURO', modoAtendimento: 'HUMANO' },
    { ...common, nome: 'Synthetic aggregate 3', statusProspeccao: 'VALOR_DESCONHECIDO', modoAtendimento: 'PAUSADO' },
  ] });
}

async function main(): Promise<void> {
  assertSafe();
  if (process.argv[2] === 'apply') await apply();
  else if (process.argv[2] === 'cleanup') await cleanup();
  else throw new Error('uso: prepare-baseline-analysis.ts apply|cleanup');
}

void main().finally(() => db.$disconnect());
