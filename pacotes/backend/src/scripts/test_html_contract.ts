
import { prisma } from '../lib/db';

async function main() {
    console.log('🧪 Testando recuperação de HTML do contrato...');

    // Token da Ivonet (use var de ambiente em relatórios)
    const token = process.env.TEST_TOKEN || 'fallback_apenas_para_dev_local';

    // Simular lógica do endpoint GET /:token/html
    // buscarContratoPorToken está em contrato-service, vou simular query direta
    const contrato = await (prisma as any).contrato.findFirst({
        where: { tokenAceite: token }
    });

    if (!contrato) {
        console.error('❌ Contrato não encontrado pelo token.');
        return;
    }

    console.log(`✅ Contrato encontrado: ID ${contrato.id}`);
    console.log(`Status: ${contrato.status}`);
    console.log(`HTML Length: ${contrato.html ? contrato.html.length : 0} chars`);

    if (contrato.html) {
        console.log('Preview do HTML:', contrato.html.substring(0, 100));
    }
}

main().finally(() => prisma.$disconnect());
