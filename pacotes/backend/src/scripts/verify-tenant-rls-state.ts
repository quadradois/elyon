import { prisma } from '../lib/db';

interface EstadoRls {
  role_exists: boolean;
  tables_enabled: bigint;
  policies: bigint;
}

async function main(): Promise<void> {
  const esperado = process.argv[2];
  if (!['enabled', 'disabled'].includes(esperado)) {
    throw new Error('uso: verify-tenant-rls-state <enabled|disabled>');
  }

  const [estado] = await prisma.$queryRaw<EstadoRls[]>`
    SELECT
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'elyon_tenant_access') AS role_exists,
      (
        SELECT count(*)
        FROM pg_class
        WHERE oid IN (
          'public.leads'::regclass,
          'public.campanhas'::regclass,
          'public.convites_especialista_agenda'::regclass,
          'public.interacoes_especialista_agenda'::regclass,
          'public.contrapropostas_agenda'::regclass
        )
          AND relrowsecurity
      ) AS tables_enabled,
      (
        SELECT count(*)
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'leads',
            'campanhas',
            'convites_especialista_agenda',
            'interacoes_especialista_agenda',
            'contrapropostas_agenda'
          )
          AND policyname = 'elyon_tenant_isolation'
      ) AS policies
  `;

  const habilitado = estado.role_exists && estado.tables_enabled === 5n && estado.policies === 5n;
  const desabilitado = !estado.role_exists && estado.tables_enabled === 0n && estado.policies === 0n;
  const valido = esperado === 'enabled' ? habilitado : desabilitado;

  console.log(JSON.stringify({
    expected: esperado,
    roleExists: estado.role_exists,
    tablesEnabled: Number(estado.tables_enabled),
    policies: Number(estado.policies),
  }));

  if (!valido) throw new Error(`estado RLS inesperado: ${esperado}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
