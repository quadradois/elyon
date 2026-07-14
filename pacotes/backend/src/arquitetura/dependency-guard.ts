import * as fs from 'fs';
import * as path from 'path';

export interface ArquivoFonte { caminho: string; conteudo: string }
export interface ViolacaoDependencia { arquivo: string; importacao: string; regra: string }

const IMPORTACAO_RE = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const PACOTES_INFRAESTRUTURA = new Set(['express', '@prisma/client']);
const normalizar = (caminho: string): string => caminho.replace(/\\/g, '/').replace(/^\.\//, '');

function destinoRelativo(arquivo: string, importacao: string): string {
  if (!importacao.startsWith('.')) return importacao;
  return path.posix.normalize(path.posix.join(path.posix.dirname(normalizar(arquivo)), importacao));
}

function extrairImportacoes(conteudo: string): string[] {
  const importacoes: string[] = [];
  IMPORTACAO_RE.lastIndex = 0;
  let resultado: RegExpExecArray | null;
  while ((resultado = IMPORTACAO_RE.exec(conteudo)) !== null) importacoes.push(resultado[1]);
  return importacoes;
}

export function analisarDependenciasModulo(arquivos: ArquivoFonte[]): ViolacaoDependencia[] {
  const violacoes: ViolacaoDependencia[] = [];
  for (const arquivo of arquivos) {
    const caminho = normalizar(arquivo.caminho);
    const ehDominio = caminho.includes('/dominio/');
    const ehAplicacao = caminho.includes('/aplicacao/');
    const ehAdapter = caminho.includes('/adapters/');
    for (const importacao of extrairImportacoes(arquivo.conteudo)) {
      const destino = destinoRelativo(caminho, importacao);
      const importaRota = destino.includes('/rotas/') || destino.startsWith('rotas/');
      if (importaRota) {
        violacoes.push({ arquivo: caminho, importacao, regra: 'módulos não podem depender de rotas' });
        continue;
      }
      if (ehDominio && (PACOTES_INFRAESTRUTURA.has(importacao) || (destino.includes('/lib/') || destino.startsWith('lib/')) || (destino.includes('/servicos/') || destino.startsWith('servicos/')) || destino.includes('/aplicacao/') || destino.includes('/adapters/'))) {
        violacoes.push({ arquivo: caminho, importacao, regra: 'domínio deve permanecer puro' });
      }
      if (ehAplicacao && (PACOTES_INFRAESTRUTURA.has(importacao) || (destino.includes('/lib/') || destino.startsWith('lib/')) || (destino.includes('/servicos/') || destino.startsWith('servicos/')) || destino.includes('/adapters/'))) {
        violacoes.push({ arquivo: caminho, importacao, regra: 'aplicação depende apenas do domínio e de portas' });
      }
      if (ehAdapter && destino.includes('/aplicacao/')) {
        violacoes.push({ arquivo: caminho, importacao, regra: 'adapters não dependem de casos de uso' });
      }
    }
  }
  return violacoes;
}

function listarFontes(diretorio: string, raiz = diretorio): ArquivoFonte[] {
  if (!fs.existsSync(diretorio)) return [];
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) return listarFontes(caminho, raiz);
    if (!entrada.isFile() || !entrada.name.endsWith('.ts')) return [];
    return [{ caminho: normalizar(path.relative(path.dirname(raiz), caminho)), conteudo: fs.readFileSync(caminho, 'utf8') }];
  });
}

export function verificarDiretorioDeModulos(diretorio: string): ViolacaoDependencia[] {
  return analisarDependenciasModulo(listarFontes(diretorio));
}
