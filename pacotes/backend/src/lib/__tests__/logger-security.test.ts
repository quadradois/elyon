import { createSecureLogger, REDACTED, redactSensitiveText } from '../logger';
import { scanSensitiveLog } from '../sensitive-log-scanner';
import { runWithLogContext } from '../log-context';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'scripts' || entry.name.includes('bak_')) return [];
      return productionTypeScriptFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

describe('secure logger', () => {
  it('redacts tokens, headers and known PII before writing the log', () => {
    let output = '';
    const logger = createSecureLogger({ write: (chunk: string) => { output += chunk; } });

    runWithLogContext(
      { correlationId: 'req-security-1234', channel: 'webhook' },
      () => logger.error(
        {
          headers: { authorization: 'Bearer header-secret', cookie: 'sid=cookie-secret' },
          payload: { telefone: '+55 62 99999-1234', email: 'lead@example.com', mensagem: 'quero vender' },
          args: { interesse: 'vender imóvel', situacaoAtual: 'dados privados' },
          err: new Error('Falha para lead@example.com com token=secret-value-123'),
        },
        'Mensagem de +55 62 99999-1234: "conteudo privado"',
      ),
    );

    const record = JSON.parse(output);
    expect(record.correlationId).toBe('req-security-1234');
    expect(record.channel).toBe('webhook');
    expect(record.headers).toEqual({ authorization: REDACTED, cookie: REDACTED });
    expect(record.payload).toBe(REDACTED);
    expect(record.args).toBe(REDACTED);
    expect(record.msg).not.toContain('99999-1234');
    expect(record.err.message).not.toContain('lead@example.com');
    expect(record.err.message).not.toContain('secret-value-123');
    expect(record.err.message).toContain('Falha para');
    expect(scanSensitiveLog(output)).toEqual([]);
  });

  it('redacts sensitive values embedded in legacy console-style strings', () => {
    const raw = 'nome=Maria email=maria@example.com telefone=62999991234 senha=abc123';
    const safe = redactSensitiveText(raw);

    expect(safe).not.toContain('Maria');
    expect(safe).not.toContain('maria@example.com');
    expect(safe).not.toContain('62999991234');
    expect(safe).not.toContain('abc123');
    expect(scanSensitiveLog(safe)).toEqual([]);
  });

  it('rejects direct logging of contact identity and raw structured payloads', () => {
    const sourceRoot = resolve(__dirname, '../..');
    const forbidden = /(console|logger)\.(?:log|info|warn|error|debug|trace|fatal).*?(?:\$\{(?:contato|contatoProspeccao|contexto|ctx)\.(?:nome|telefone)\}|JSON\.stringify\((?:req\.body|resultado|payload)|\$\{conteudoEntrada)/;
    const violations = productionTypeScriptFiles(sourceRoot).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => ({ file, line: index + 1, source: line.trim() }))
        .filter(({ source }) => forbidden.test(source)),
    );

    expect(violations).toEqual([]);
  });
});
