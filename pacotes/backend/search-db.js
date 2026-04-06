const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
  for (const m of models) {
    if (typeof prisma[m]?.findMany === 'function') {
      try {
        const records = await prisma[m].findMany();
        for (const r of records) {
          const text = JSON.stringify(r);
          if (text.includes('dois modelos') || text.includes('180 dias') || text.includes('marketing')) {
            if (text.includes('Exclusiva')) {
                console.log(`Found in Model [${m}]: ID ${r.id}`);
                console.log(text.substring(0, 300));
            }
          }
        }
      } catch (e) {
          // Ignore
      }
    }
  }
  console.log("Busca concluída!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
