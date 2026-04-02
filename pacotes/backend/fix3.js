const fs = require('fs');

const BAD = `logger.({ details:  instanceof Error ? .message :  }, )`;

const files = [
  'src/agentes/elyon-core.ts',
  'src/agentes/guardrails.ts',
  'src/agentes/handoff-filters.ts',
  'src/agentes/history-persistence.ts',
  'src/agentes/knowledge-agent.ts',
  'src/agentes/orchestrator-queries.ts',
  'src/agentes/orchestrator.ts',
  'src/agentes/post-handoff.ts',
  'src/rotas/campanhas/contatos.rotas.ts',
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes(BAD)) {
    // Count occurrences
    const count = content.split(BAD).length - 1;
    // Fix: usar logger.warn com mensagem genérica
    content = content.replaceAll(BAD, 'logger.warn("[erro capturado no catch]")');
    fs.writeFileSync(f, content);
    console.log(`Fixed ${count} occurrence(s) in: ${f}`);
  }
}
console.log('Done!');
