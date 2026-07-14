import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const BASELINE_MIGRATION = '20260714000000_baseline';
const LEGACY_MANIFEST = path.resolve(
  process.cwd(),
  'prisma/legacy-baseline-migrations.txt',
);
const LEGACY_ROLLED_BACK_MANIFEST = path.resolve(
  process.cwd(),
  'prisma/legacy-baseline-rolled-back-migrations.txt',
);

type DatabaseState = {
  user_tables: number;
  migration_table_exists: boolean;
};

type MigrationState = {
  migration_name: string;
  finished: boolean;
  rolled_back: boolean;
};

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const expectedLegacy = (await readFile(LEGACY_MANIFEST, 'utf8'))
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .sort();
    const expectedRolledBack = (await readFile(LEGACY_ROLLED_BACK_MANIFEST, 'utf8'))
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .sort();

    const [database] = await prisma.$queryRaw<DatabaseState[]>`
      SELECT
        (
          SELECT count(*)::integer
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            AND table_name <> '_prisma_migrations'
        ) AS user_tables,
        to_regclass('public._prisma_migrations') IS NOT NULL AS migration_table_exists
    `;

    if (!database) {
      throw new Error('nao foi possivel inspecionar o estado do banco');
    }

    let migrations: MigrationState[] = [];
    if (database.migration_table_exists) {
      migrations = await prisma.$queryRawUnsafe<MigrationState[]>(`
        SELECT
          migration_name,
          finished_at IS NOT NULL AS finished,
          rolled_back_at IS NOT NULL AS rolled_back
        FROM public._prisma_migrations
        ORDER BY migration_name
      `);
    }

    const unfinished = migrations.filter((migration) => !migration.finished && !migration.rolled_back);
    if (unfinished.length > 0) {
      throw new Error(`existem migrations incompletas: ${unfinished.map((item) => item.migration_name).join(',')}`);
    }

    const baseline = migrations.find((migration) => migration.migration_name === BASELINE_MIGRATION);
    if (baseline?.finished) {
      process.stdout.write('BASELINE_APPLIED\n');
      return;
    }

    if (database.user_tables === 0 && migrations.length === 0) {
      process.stdout.write('EMPTY\n');
      return;
    }

    if (!database.migration_table_exists || database.user_tables === 0) {
      throw new Error('banco nao vazio/legado em estado incompativel com adocao automatica');
    }

    const finishedLegacy = migrations
      .filter((migration) => migration.finished && migration.migration_name !== BASELINE_MIGRATION)
      .map((migration) => migration.migration_name)
      .sort();
    const rolledBackLegacy = migrations
      .filter((migration) => migration.rolled_back)
      .map((migration) => migration.migration_name)
      .sort();

    if (
      !sameValues(finishedLegacy, expectedLegacy)
      || !sameValues(rolledBackLegacy, expectedRolledBack)
    ) {
      throw new Error(
        `historico legado divergente: concluidas=${finishedLegacy.length} revertidas=${rolledBackLegacy.length}`,
      );
    }

    process.stdout.write('LEGACY_READY\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`BASELINE_STATE_ERROR: ${message}\n`);
  process.exitCode = 1;
});
