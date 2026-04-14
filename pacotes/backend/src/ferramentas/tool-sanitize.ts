/**
 * MÓDULO CENTRALIZADO DE SANITIZAÇÃO DE INPUTS LLM
 * 
 * Funções para sanitizar campos vindos de tool calls do LLM.
 * O modelo pode enviar "", null, "true", "3" em campos que Prisma
 * espera boolean, number, etc. Estas funções normalizam tudo.
 * 
 * @version 1.0
 * @date 11/04/2026
 */

/**
 * Sanitiza campos numéricos inteiros.
 * Trata: string numérica → number, string vazia/null/undefined → undefined,
 * number válido → number, NaN → undefined.
 */
export function sanitizeInt(valor: any): number | undefined {
    if (valor === null || valor === undefined || valor === '') return undefined;
    if (typeof valor === 'number') return isNaN(valor) ? undefined : Math.round(valor);
    if (typeof valor === 'string') {
        const parsed = parseInt(valor, 10);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

/**
 * Sanitiza campos numéricos float.
 * Trata: string numérica → number, string vazia/null/undefined → undefined.
 */
export function sanitizeFloat(valor: any): number | undefined {
    if (valor === null || valor === undefined || valor === '') return undefined;
    if (typeof valor === 'number') return isNaN(valor) ? undefined : valor;
    if (typeof valor === 'string') {
        const parsed = parseFloat(valor);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

/**
 * Sanitiza campos boolean.
 * Trata: null/undefined/"" → undefined, "true"/"false" string → boolean.
 */
export function sanitizeBool(valor: any): boolean | undefined {
    if (valor === null || valor === undefined || valor === '') return undefined;
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'string') {
        if (valor.toLowerCase() === 'true') return true;
        if (valor.toLowerCase() === 'false') return false;
    }
    return undefined;
}

/**
 * Sanitiza campos string.
 * Trata: null → undefined, string vazia → undefined.
 */
export function sanitizeStr(valor: any): string | undefined {
    if (valor === null || valor === undefined) return undefined;
    const texto = String(valor).trim();
    if (!texto) return undefined;

    const normalizado = texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    // Bloquear placeholders que não representam evidência real do lead.
    if (/^(nao informado|não informado|nao sei|não sei|indefinido|sem informacao|sem informacao definida|n\/a|na)$/i.test(normalizado)) {
        return undefined;
    }

    return texto;
}

/**
 * Verifica se um valor é uma string com conteúdo real.
 */
export function temTexto(valor?: string): boolean {
    return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * Sanitiza array de strings (LLM pode enviar strings vazias, nulls, etc.)
 */
export function sanitizeStringArray(valor: any): string[] | undefined {
    if (!Array.isArray(valor)) return undefined;
    const filtrado = valor.filter((item: any) => typeof item === 'string' && item.trim());
    return filtrado.length > 0 ? filtrado : undefined;
}

/**
 * Sanitiza campo enum — retorna undefined se o valor não estiver na lista permitida.
 */
export function sanitizeEnum<T extends string>(valor: any, valoresValidos: T[]): T | undefined {
    const str = sanitizeStr(valor);
    if (!str) return undefined;
    return valoresValidos.includes(str as T) ? (str as T) : undefined;
}
