/**
 * Script para corrigir campos com "[object Object]" e popular nomeEdificio da campanha
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Corrigindo contatos com dados inválidos...\n');

    // 1. Limpar enderecoImovel com [object Object]
    const resultLimpar = await prisma.contato.updateMany({
        where: { enderecoImovel: '[object Object]' },
        data: { enderecoImovel: null }
    });
    console.log(`✅ Limpados ${resultLimpar.count} campos enderecoImovel com "[object Object]"`);

    // 2. Para contatos sem nomeEdificio, pegar o nome do empreendimento da campanha
    const contatos = await prisma.contato.findMany({
        where: {
            nomeEdificio: null
        },
        select: {
            id: true,
            campanhaId: true
        }
    });

    console.log(`\n📋 Encontrados ${contatos.length} contatos sem nomeEdificio`);

    // Agrupar por campanha
    const campanhaIds = [...new Set(contatos.map(c => c.campanhaId))];
    console.log(`🏢 Campanhas envolvidas: ${campanhaIds.length}`);

    let atualizados = 0;
    for (const campanhaId of campanhaIds) {
        // Buscar nome do empreendimento da campanha
        const campanha = await prisma.campanha.findUnique({
            where: { id: campanhaId },
            select: {
                nome: true,
                nomeEmpreendimento: true,
                empreendimento: { select: { nome: true } }
            }
        });

        if (!campanha) continue;

        // Prioridade: empreendimento.nome > nomeEmpreendimento > campanha.nome
        const nomeEdificio = campanha.empreendimento?.nome || campanha.nomeEmpreendimento || campanha.nome;

        if (!nomeEdificio) continue;

        const contatosParaAtualizar = contatos.filter(c => c.campanhaId === campanhaId);

        if (contatosParaAtualizar.length > 0) {
            const result = await prisma.contato.updateMany({
                where: {
                    id: { in: contatosParaAtualizar.map(c => c.id) }
                },
                data: { nomeEdificio }
            });
            atualizados += result.count;
            console.log(`  → Campanha "${campanha.nome}": ${result.count} contatos → nomeEdificio = "${nomeEdificio}"`);
        }
    }

    console.log(`\n✅ Total de ${atualizados} contatos atualizados com nomeEdificio`);

    // 3. Corrigir bairroImovel que tem espaços extras
    const resultTrim = await prisma.$executeRaw`
    UPDATE contatos SET "bairroImovel" = TRIM("bairroImovel") 
    WHERE "bairroImovel" IS NOT NULL
  `;
    console.log(`\n✅ Removidos espaços extras de bairroImovel`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
