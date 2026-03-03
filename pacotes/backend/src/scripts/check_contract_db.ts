
import { prisma } from '../lib/db';

async function main() {
    console.log('🔎 Verificando contrato da Ivonet (campos internos)...');

    // Token da Ivonet (use via env vars para não subir hardcoded)
    const token = process.env.TEST_TOKEN || 'fallback_apenas_para_dev_local';

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
