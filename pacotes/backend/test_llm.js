const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tenant.findUnique({ where: { slug: 'quadradois' } });
  if (!t.llmApiKeyCriptografada) { console.log('Sem API KEY'); return; }
  
  // decrypt assuming standard elyon logic, but wait, I don't know the decryption key.
  // let's just use the orchestrator function.
}
main();
