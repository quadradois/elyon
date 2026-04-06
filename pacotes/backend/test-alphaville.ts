import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for Alphaville in Bairro...");
    const bairros = await prisma.bairro.findMany({
        where: { nome: { contains: 'ALPHAVILLE', mode: 'insensitive' } }
    });
    console.log(bairros);

    for (const b of bairros) {
        const count = await prisma.imovel.count({ where: { codigoBairro: b.codigo } });
        console.log(`Imoveis in Bairro ${b.nome} (${b.codigo}): ${count}`);

        const countHorizontal = await prisma.imovel.count({ 
            where: { 
                codigoBairro: b.codigo,
                OR: [
                    { codigoEdificio: null },
                    { nomeEdificio: null },
                    { nomeEdificio: '' }
                ]
            } 
        });
        console.log(`Imoveis Horizontal in Bairro ${b.nome} (${b.codigo}): ${countHorizontal}`);

        // Try checking if they are mistakenly associated with an Edificio
        if (count > 0 && countHorizontal === 0) {
            const sample = await prisma.imovel.findFirst({ where: { codigoBairro: b.codigo } });
            console.log(`Sample Ex: codigoEdificio: ${sample?.codigoEdificio}, nomeEdificio: ${sample?.nomeEdificio}`);
        }
    }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  });
