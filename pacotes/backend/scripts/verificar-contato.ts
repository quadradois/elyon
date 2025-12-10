import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contato = await prisma.contato.findFirst({
    where: { cpf: '25323636149' },
    select: {
      nome: true,
      idade: true,
      sexo: true,
      signo: true,
      nomeMae: true,
      profissao: true,
      rendaEstimada: true,
      faixaSalarial: true,
      empresaAtual: true,
      scoreAssertiva: true,
      dataNascimento: true,
      endereco: true,
      cidade: true,
      estado: true,
      cep: true,
      fonteEnriquecimento: true,
      enriquecidoEm: true
    }
  });
  
  console.log('\n📊 DADOS DO CONTATO APÓS ATUALIZAÇÃO:\n');
  console.log(JSON.stringify(contato, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
