
import { prisma } from '../lib/db';

async function main() {
    console.log('🔎 Verificando contrato da Ivonet (campos internos)...');

    // Token da Ivonet
    const token = '4e42c52005fdb692de229ca6b0f14b426da6f1e7bdf7f43f488e123be8845450';

    const contrato = await (prisma as any).contrato.findFirst({
        where: { tokenAceite: token }
    });

    if (!contrato) {
        console.error('❌ Contrato não encontrado.');
        return;
    }

    console.log(`ID: ${contrato.id}`);
    console.log(`Status: ${contrato.status}`);
    console.log(`htmlConteudo Length: ${contrato.htmlConteudo ? contrato.htmlConteudo.length : 0} chars`);
    console.log(`dadosSnapshot Length: ${contrato.dadosSnapshot ? contrato.dadosSnapshot.length : 0} chars`);

    if (contrato.dadosSnapshot) {
        console.log('Snapshot existe! Podemos regenerar o HTML.');
    } else {
        console.log('⚠️ Snapshot também está vazio/nulo.');
    }
}

main().finally(() => prisma.$disconnect());
