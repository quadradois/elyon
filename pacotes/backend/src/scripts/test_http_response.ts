
import axios from 'axios';
import { prisma } from '../lib/db';

async function main() {
    console.log('🧪 Testando resposta REAL da API via HTTP...');

    // 1. Pegar um tenant válido
    const tenantId = '3b5f4a6a-6f10-472c-8774-6406b106dcb4'; // Tenant da Ivonet

    try {
        // Como estou rodando dentro do container/rede, posso tentar acessar o localhost:3000 
        // Mas o script roda em outro container.
        // Vou usar o nome do serviço 'elyon_backend' se estiver na rede, ou localhost se estiver no backend.
        // O script roda via 'docker run ... -w /root/elyon/backend', então localhost aponta para o container do script.
        // Preciso apontar para o container do backend. 
        // O docker run usa --network elyon_network, então posso acessar 'elyon-backend:3000' ou 'elyon_backend:3000'.

        const url = 'http://elyon_backend:3000/api/clientes';
        console.log(`Request para ${url}`);

        const res = await axios.get(url, {
            headers: { 'x-tenant-id': tenantId }
        });

        console.log(`Status: ${res.status}`);
        console.log('Dados recebidos (primeiro item):');
        if (res.data.length > 0) {
            console.log(JSON.stringify(res.data[0], null, 2));

            // Verificar explicitamente o campo
            const ivonet = res.data.find((c: any) => c.nome.includes('Ivonet'));
            if (ivonet) {
                console.log('--- IVONET ---');
                console.log(`ID: ${ivonet.id}`);
                console.log(`OrigemLeadId: ${ivonet.origemLeadId}`); // É isso que importa
            }
        } else {
            console.log('Nenhum cliente retornado.');
        }

    } catch (error: any) {
        console.error('Erro na requisição:', error.message);
        if (error.response) {
            console.error('Dados:', error.response.data);
        }
    }
}

main();
