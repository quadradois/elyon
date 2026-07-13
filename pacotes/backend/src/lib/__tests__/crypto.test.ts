import crypto from 'crypto';
import {
  criptografar,
  descriptografar,
  estaCriptografado,
  estaNaChaveAtiva,
  obterMetadadosCriptografia,
  validarConfiguracaoCriptografia
} from '../crypto';

const VARIAVEIS = [
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEY_ID',
  'ENCRYPTION_KEY_PREVIOUS',
  'ENCRYPTION_KEY_PREVIOUS_ID',
  'ENCRYPTION_KEY_LEGACY'
] as const;

const ambienteOriginal = Object.fromEntries(VARIAVEIS.map((nome) => [nome, process.env[nome]]));
const chaveAtiva = Buffer.alloc(32, 1).toString('base64');
const chaveAnterior = Buffer.alloc(32, 2).toString('base64');

function configurarAtiva(): void {
  process.env.ENCRYPTION_KEY = chaveAtiva;
  process.env.ENCRYPTION_KEY_ID = 'test-v2';
}

function cifrarLegado(texto: string, segredoLegado: string): string {
  const key = Buffer.from(segredoLegado.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

describe('crypto versionado', () => {
  beforeEach(() => {
    for (const nome of VARIAVEIS) delete process.env[nome];
    configurarAtiva();
  });

  afterAll(() => {
    for (const nome of VARIAVEIS) {
      const valor = ambienteOriginal[nome];
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  });

  it('cifra e decifra com envelope v2 e chave ativa', () => {
    const cifra = criptografar('credencial-secreta');

    expect(cifra).toMatch(/^v2:test-v2:/);
    expect(descriptografar(cifra)).toBe('credencial-secreta');
    expect(estaCriptografado(cifra)).toBe(true);
    expect(estaNaChaveAtiva(cifra)).toBe(true);
    expect(obterMetadadosCriptografia(cifra)).toEqual({ versao: 'v2', chaveId: 'test-v2' });
  });

  it('falha sem chave ativa ou com chave de tamanho inválido', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => validarConfiguracaoCriptografia()).toThrow('ENCRYPTION_KEY não configurada');

    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
    expect(() => validarConfiguracaoCriptografia()).toThrow('32 bytes');
  });

  it('rejeita envelope adulterado sem expor detalhes criptográficos', () => {
    const cifra = criptografar('credencial-secreta');
    const ultimoByte = cifra.slice(-2) === '00' ? '01' : '00';
    const adulterada = `${cifra.slice(0, -2)}${ultimoByte}`;

    expect(() => descriptografar(adulterada)).toThrow('Falha ao descriptografar dados');
  });

  it('lê cifra legada somente quando a chave legada é explicitamente autorizada', () => {
    const segredoLegado = 'segredo-legado-de-migracao';
    const cifra = cifrarLegado('valor-antigo', segredoLegado);

    expect(obterMetadadosCriptografia(cifra)).toEqual({ versao: 'legacy' });
    expect(() => descriptografar(cifra)).toThrow('Falha ao descriptografar dados');

    process.env.ENCRYPTION_KEY_LEGACY = segredoLegado;
    expect(descriptografar(cifra)).toBe('valor-antigo');
    expect(estaNaChaveAtiva(cifra)).toBe(false);
  });

  it('lê envelope da chave anterior durante uma rotação', () => {
    process.env.ENCRYPTION_KEY = chaveAnterior;
    process.env.ENCRYPTION_KEY_ID = 'test-v1';
    const cifraAnterior = criptografar('valor-anterior');

    configurarAtiva();
    process.env.ENCRYPTION_KEY_PREVIOUS = chaveAnterior;
    process.env.ENCRYPTION_KEY_PREVIOUS_ID = 'test-v1';

    expect(descriptografar(cifraAnterior)).toBe('valor-anterior');
    expect(estaNaChaveAtiva(cifraAnterior)).toBe(false);
  });

  it('exige o par completo para uma chave anterior', () => {
    process.env.ENCRYPTION_KEY_PREVIOUS = chaveAnterior;
    expect(() => validarConfiguracaoCriptografia()).toThrow('devem ser configuradas juntas');
  });
});
