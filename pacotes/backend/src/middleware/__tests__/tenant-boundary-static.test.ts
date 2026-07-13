import fs from 'fs';
import path from 'path';

function listarTypeScript(diretorio: string): string[] {
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const destino = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) return listarTypeScript(destino);
    return entrada.isFile() && entrada.name.endsWith('.ts') ? [destino] : [];
  });
}

describe('fronteira estática de tenant', () => {
  it('não permite que handlers privados usem header/query/body como identidade', () => {
    const raizRotas = path.resolve(__dirname, '../../rotas');
    const excecoesAdministrativas = new Set(['admin-auditoria.ts', 'rotas-billing.ts']);
    const violacoes: string[] = [];

    for (const arquivo of listarTypeScript(raizRotas)) {
      if (excecoesAdministrativas.has(path.basename(arquivo))) continue;
      const fonte = fs.readFileSync(arquivo, 'utf8');
      const padroes = [
        /req\.headers\s*\[\s*['"]x-tenant-id['"]\s*\]/i,
        /req\.query\.tenantId(?![A-Za-z0-9_])/,
        /req\.body\??\.tenantId(?![A-Za-z0-9_])/,
        /\{[^}\n]*tenantId(?![A-Za-z0-9_])[^}\n]*\}\s*=\s*req\.(?:query|body)/
      ];
      if (padroes.some((padrao) => padrao.test(fonte))) {
        violacoes.push(path.relative(raizRotas, arquivo));
      }
    }

    expect(violacoes).toEqual([]);
  });

  it('frontend não envia tenant como header de autorização', () => {
    const apiFrontend = fs.readFileSync(
      path.resolve(__dirname, '../../../../frontend/src/servicos/api.ts'),
      'utf8'
    );
    expect(apiFrontend).not.toMatch(/X-Tenant-Id/i);
    expect(apiFrontend).not.toMatch(/X-Access-Token/i);
  });
});
