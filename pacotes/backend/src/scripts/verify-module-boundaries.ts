import * as path from 'path';
import { verificarDiretorioDeModulos } from '../arquitetura/dependency-guard';

const violacoes = verificarDiretorioDeModulos(path.resolve(__dirname, '..', 'modulos'));
if (violacoes.length > 0) {
  console.error('Dependências proibidas encontradas:');
  for (const violacao of violacoes) console.error(`- ${violacao.arquivo}: ${violacao.importacao} (${violacao.regra})`);
  process.exit(1);
}
console.log('Fronteiras dos módulos verificadas sem dependências proibidas.');
