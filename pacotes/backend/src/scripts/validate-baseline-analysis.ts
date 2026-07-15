import fs from 'fs';

const path = process.argv[2];
if (!path) throw new Error('arquivo JSON obrigatório');
const raw = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
const value = JSON.parse(raw) as Record<string, any>;
for (const key of ['source', 'generatedAt', 'distributions', 'contradictions', 'quarantineCandidates', 'qualificationCoverage', 'readOnlyWriteRejected']) {
  if (!(key in value)) throw new Error(`campo ausente: ${key}`);
}
if (value.source !== 'authorized-read-only' || value.readOnlyWriteRejected !== true) throw new Error('contrato read-only inválido');
if ((value.distributions?.statusProspeccao?.LEAD || 0) < 1) throw new Error('seed sintético não foi analisado');
if (raw.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i) || /telefone|nome|mensagem|endereco/i.test(JSON.stringify(Object.keys(value)))) throw new Error('saída contém chave ou identificador proibido');
