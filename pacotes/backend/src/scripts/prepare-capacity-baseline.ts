import { prisma } from '../lib/db';
import { CAPACITY_FIXTURE } from '../capacidade/fixture';
import { validarBancoBaseline } from '../capacidade/seguranca-baseline';
import { hashSenha } from '../utilitarios/senha';

async function limpar(): Promise<void> {
  await prisma.webhookEvento.deleteMany({ where: { tipo: 'capacity-baseline' } });
  await prisma.tenant.deleteMany({ where: { slug: CAPACITY_FIXTURE.tenantSlug } });
}

async function preparar(): Promise<void> {
  await limpar();
  const tenant = await prisma.tenant.create({
    data: {
      nome: CAPACITY_FIXTURE.tenantNome,
      slug: CAPACITY_FIXTURE.tenantSlug,
      status: 'ATIVO',
      plano: 'ENTERPRISE',
      quotaMensal: 10_000,
    },
  });
  await prisma.usuario.create({
    data: {
      tenantId: tenant.id,
      nome: 'Capacity Operator',
      email: CAPACITY_FIXTURE.email,
      senha: await hashSenha(CAPACITY_FIXTURE.senha),
      papel: 'ADMIN',
      estaAtivo: true,
    },
  });
  await prisma.sessaoWhatsapp.create({
    data: {
      tenantId: tenant.id,
      nome: 'Capacity Baseline',
      instanceName: CAPACITY_FIXTURE.instanceName,
      evolutionInstanceId: CAPACITY_FIXTURE.instanceId,
      evolutionToken: CAPACITY_FIXTURE.instanceToken,
    },
  });
  for (let inicio = 0; inicio < 1_500; inicio += 500) {
    await prisma.lead.createMany({
      data: Array.from({ length: 500 }, (_, indice) => {
        const sequencia = inicio + indice;
        return {
          tenantId: tenant.id,
          nome: `Lead Capacity ${String(sequencia).padStart(4, '0')}`,
          email: `lead-${sequencia}@baseline.local`,
          telefone: `55119${String(sequencia).padStart(8, '0')}`,
          origem: 'capacity-baseline',
          status: 'NOVO' as const,
          temperatura: sequencia % 3 === 0 ? 'QUENTE' as const : 'FRIO' as const,
        };
      }),
    });
  }
  console.log(JSON.stringify({ tenantId: tenant.id, leads: 1_500, fixture: CAPACITY_FIXTURE.tenantSlug }));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL é obrigatória');
  validarBancoBaseline(databaseUrl, process.env.CAPACITY_BASELINE_ALLOW_REMOTE === 'true');
  const acao = process.argv[2] || 'apply';
  if (acao === 'apply') await preparar();
  else if (acao === 'cleanup') await limpar();
  else throw new Error('Use apply ou cleanup');
}

main()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
