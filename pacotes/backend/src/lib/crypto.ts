/**
 * Serviço de Criptografia
 * 
 * Usa AES-256-GCM para criptografar/descriptografar dados sensíveis
 * como API Keys de integrações.
 * 
 * @version 1.0
 * @date 22/12/2025
 */

import crypto from 'crypto';

// Chave de criptografia (deve vir do ambiente)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-dev-only!';

// Garante que a chave tenha 32 bytes
const getKey = (): Buffer => {
    const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
    return Buffer.from(key);
};

/**
 * Criptografa uma string usando AES-256-GCM
 */
export function criptografar(texto: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

    let encrypted = cipher.update(texto, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Formato: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa uma string criptografada com AES-256-GCM
 */
export function descriptografar(textoCriptografado: string): string {
    try {
        const [ivHex, authTagHex, encrypted] = textoCriptografado.split(':');

        if (!ivHex || !authTagHex || !encrypted) {
            throw new Error('Formato inválido de dados criptografados');
        }

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('[CRYPTO] Erro ao descriptografar:', error);
        throw new Error('Falha ao descriptografar dados');
    }
}

/**
 * Verifica se uma string está criptografada no formato esperado
 */
export function estaCriptografado(texto: string): boolean {
    if (!texto) return false;
    const parts = texto.split(':');
    return parts.length === 3 && parts[0].length === 32; // IV tem 16 bytes = 32 hex chars
}

export default {
    criptografar,
    descriptografar,
    estaCriptografado
};
