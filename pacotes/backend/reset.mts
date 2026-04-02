import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Resetar contato para novo teste
await prisma.contato.update({
  where: { id: '4c19ddcb-7dd5-4bc9-a31a-3821b5479502' },
  data: {
    statusProspeccao: 'AGUARDANDO',
    tentativasContato: 0,
    ultimaTentativa: null,
    respondeu: false,
    primeiraResposta: null,
    manifestouInteresse: false,
    virouLead: false,
    leadId: null,
    virouLeadEm: null,
    modoAtendimento: 'IA'
  }
});

// Limpar mensagens anteriores
await prisma.mensagemProspeccao.deleteMany({
  where: { contatoId: '4c19ddcb-7dd5-4bc9-a31a-3821b5479502' }
});

console.log('Contato resetado para novo teste!');
await prisma.$disconnect();
