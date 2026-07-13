/**
 * Criptografia de credenciais com AES-256-GCM e envelope versionado.
 *
 * Novas cifras usam `v2:<keyId>:<iv>:<authTag>:<ciphertext>`. O formato
 * legado sem versão só pode ser lido quando ENCRYPTION_KEY_LEGACY é
 * fornecida explicitamente durante uma rotação controlada.
 */

import crypto from 'crypto';

const VERSAO_ATUAL = 'v2';
const ID_CHAVE_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BASE64_32_BYTES_REGEX = /^[A-Za-z0-9+/]{43}=$/;
const HEX_REGEX = /^[0-9a-f]+$/i;

interface ChaveVersionada {
    id: string;
    chave: Buffer;
}

interface Chaveiro {
    ativa: ChaveVersionada;
    anterior?: ChaveVersionada;
    legada?: Buffer;
}

export interface MetadadosCriptografia {
    versao: 'v2' | 'legacy' | 'invalido';
    chaveId?: string;
}

function lerVariavelObrigatoria(nome: string): string {
    const valor = process.env[nome]?.trim();
    if (!valor) {
        throw new Error(`[CRYPTO] ${nome} não configurada`);
    }
    return valor;
}

function validarIdChave(valor: string, nome: string): string {
    if (!ID_CHAVE_REGEX.test(valor)) {
        throw new Error(`[CRYPTO] ${nome} deve ter de 1 a 64 caracteres alfanuméricos, ponto, hífen ou sublinhado`);
    }
    return valor;
}

function decodificarChaveBase64(valor: string, nome: string): Buffer {
    if (!BASE64_32_BYTES_REGEX.test(valor)) {
        throw new Error(`[CRYPTO] ${nome} deve ser uma chave de 32 bytes codificada em Base64`);
    }

    const chave = Buffer.from(valor, 'base64');
    if (chave.length !== 32 || chave.toString('base64') !== valor) {
        throw new Error(`[CRYPTO] ${nome} deve ser uma chave de 32 bytes codificada em Base64`);
    }
    return chave;
}

function decodificarChaveLegada(valor: string): Buffer {
    // Reproduz exatamente o algoritmo histórico para permitir uma única migração.
    const chave = Buffer.from(valor.padEnd(32, '0').slice(0, 32));
    if (chave.length !== 32) {
        throw new Error('[CRYPTO] ENCRYPTION_KEY_LEGACY não gera uma chave AES-256 válida');
    }
    return chave;
}

function carregarChaveiro(): Chaveiro {
    const ativa: ChaveVersionada = {
        id: validarIdChave(lerVariavelObrigatoria('ENCRYPTION_KEY_ID'), 'ENCRYPTION_KEY_ID'),
        chave: decodificarChaveBase64(lerVariavelObrigatoria('ENCRYPTION_KEY'), 'ENCRYPTION_KEY')
    };

    const anteriorValor = process.env.ENCRYPTION_KEY_PREVIOUS?.trim();
    const anteriorId = process.env.ENCRYPTION_KEY_PREVIOUS_ID?.trim();
    if (Boolean(anteriorValor) !== Boolean(anteriorId)) {
        throw new Error('[CRYPTO] ENCRYPTION_KEY_PREVIOUS e ENCRYPTION_KEY_PREVIOUS_ID devem ser configuradas juntas');
    }

    let anterior: ChaveVersionada | undefined;
    if (anteriorValor && anteriorId) {
        const id = validarIdChave(anteriorId, 'ENCRYPTION_KEY_PREVIOUS_ID');
        if (id === ativa.id) {
            throw new Error('[CRYPTO] A chave anterior deve ter um ID diferente da chave ativa');
        }
        anterior = {
            id,
            chave: decodificarChaveBase64(anteriorValor, 'ENCRYPTION_KEY_PREVIOUS')
        };
    }

    const legadaValor = process.env.ENCRYPTION_KEY_LEGACY;
    return {
        ativa,
        anterior,
        legada: legadaValor ? decodificarChaveLegada(legadaValor) : undefined
    };
}

function validarHex(valor: string, bytes?: number): boolean {
    return Boolean(valor) && HEX_REGEX.test(valor) && valor.length % 2 === 0 && (!bytes || valor.length === bytes * 2);
}

function descriptografarGcm(ivHex: string, authTagHex: string, encryptedHex: string, chave: Buffer, ivBytes: number, aad?: Buffer): string {
    if (!validarHex(ivHex, ivBytes) || !validarHex(authTagHex, 16) || !validarHex(encryptedHex)) {
        throw new Error('Envelope criptográfico inválido');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(ivHex, 'hex'));
    if (aad) decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
}

/** Valida toda a configuração. Deve ser chamada antes de abrir a porta HTTP. */
export function validarConfiguracaoCriptografia(): void {
    carregarChaveiro();
}

/** Criptografa uma credencial sempre com a chave ativa e o envelope atual. */
export function criptografar(texto: string): string {
    if (!texto) throw new Error('[CRYPTO] Não é permitido criptografar um valor vazio');

    const { ativa } = carregarChaveiro();
    const iv = crypto.randomBytes(12);
    const aad = Buffer.from(`elyon:${VERSAO_ATUAL}:${ativa.id}`, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', ativa.chave, iv);
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${VERSAO_ATUAL}:${ativa.id}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Descriptografa envelopes atuais, anteriores ou legados autorizados. */
export function descriptografar(textoCriptografado: string): string {
    try {
        const chaveiro = carregarChaveiro();
        const partes = textoCriptografado.split(':');

        if (partes[0] === VERSAO_ATUAL && partes.length === 5) {
            const [, chaveId, ivHex, authTagHex, encryptedHex] = partes;
            const chave = [chaveiro.ativa, chaveiro.anterior]
                .find((item): item is ChaveVersionada => item !== undefined && item.id === chaveId);
            if (!chave) throw new Error('ID de chave não disponível');

            return descriptografarGcm(
                ivHex,
                authTagHex,
                encryptedHex,
                chave.chave,
                12,
                Buffer.from(`elyon:${VERSAO_ATUAL}:${chaveId}`, 'utf8')
            );
        }

        if (partes.length === 3) {
            if (!chaveiro.legada) throw new Error('Leitura legada desabilitada');
            return descriptografarGcm(partes[0], partes[1], partes[2], chaveiro.legada, 16);
        }

        throw new Error('Formato não suportado');
    } catch {
        // Não registra cifra, chave, plaintext nem detalhes do provedor criptográfico.
        throw new Error('Falha ao descriptografar dados');
    }
}

export function obterMetadadosCriptografia(texto: string): MetadadosCriptografia {
    if (!texto) return { versao: 'invalido' };
    const partes = texto.split(':');
    if (partes.length === 5 && partes[0] === VERSAO_ATUAL && ID_CHAVE_REGEX.test(partes[1])) {
        return { versao: 'v2', chaveId: partes[1] };
    }
    if (partes.length === 3 && validarHex(partes[0], 16) && validarHex(partes[1], 16) && validarHex(partes[2])) {
        return { versao: 'legacy' };
    }
    return { versao: 'invalido' };
}

export function estaCriptografado(texto: string): boolean {
    return obterMetadadosCriptografia(texto).versao !== 'invalido';
}

export function estaNaChaveAtiva(texto: string): boolean {
    const metadados = obterMetadadosCriptografia(texto);
    return metadados.versao === 'v2' && metadados.chaveId === carregarChaveiro().ativa.id;
}

export default {
    criptografar,
    descriptografar,
    estaCriptografado,
    estaNaChaveAtiva,
    obterMetadadosCriptografia,
    validarConfiguracaoCriptografia
};
