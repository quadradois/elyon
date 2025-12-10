/**
 * Utilitário para normalização de telefones brasileiros
 * 
 * Formatos aceitos:
 * - (62) 9371-5693
 * - 62 9371-5693
 * - 6293715693
 * - +55 62 9371-5693
 * - 556293715693
 * 
 * Formato de saída padrão: 6293715693 (apenas dígitos, sem DDI)
 */

/**
 * Remove todos os caracteres não numéricos de um telefone
 */
export function limparTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '';
  return telefone.replace(/\D/g, '');
}

/**
 * Remove DDI 55 do telefone se presente
 */
export function removerDDI(telefone: string): string {
  const limpo = limparTelefone(telefone);
  
  // Se começa com 55 e tem mais de 11 dígitos, remove DDI
  if (limpo.startsWith('55') && limpo.length > 11) {
    return limpo.slice(2);
  }
  
  return limpo;
}

/**
 * Normaliza telefone para formato padrão do sistema
 * 
 * Entrada: qualquer formato
 * Saída: apenas dígitos, sem DDI (ex: 6293715693 ou 62993715693)
 * 
 * @param telefone Telefone em qualquer formato
 * @returns Telefone normalizado ou string vazia se inválido
 */
export function normalizarTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '';
  
  const limpo = removerDDI(telefone);
  
  // Validar: telefone brasileiro deve ter 10 ou 11 dígitos
  if (limpo.length < 10 || limpo.length > 11) {
    console.warn(`[Telefone] Telefone inválido: ${telefone} → ${limpo} (${limpo.length} dígitos)`);
    return limpo; // Retorna mesmo assim, mas loga warning
  }
  
  return limpo;
}

/**
 * Formata telefone para exibição amigável
 * 
 * Entrada: 6293715693 ou 62993715693
 * Saída: (62) 9371-5693 ou (62) 99371-5693
 */
export function formatarTelefoneExibicao(telefone: string | null | undefined): string {
  const limpo = normalizarTelefone(telefone);
  
  if (!limpo) return '';
  
  // 10 dígitos: (XX) XXXX-XXXX
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  
  // 11 dígitos: (XX) XXXXX-XXXX
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  
  // Outros: retorna como está
  return limpo;
}

/**
 * Extrai os últimos N dígitos do telefone (para comparação)
 */
export function ultimosDigitos(telefone: string | null | undefined, n: number = 8): string {
  const limpo = limparTelefone(telefone);
  return limpo.slice(-n);
}

/**
 * Verifica se dois telefones são equivalentes
 * Compara últimos 8 dígitos após normalização
 */
export function telefonesSaoIguais(tel1: string | null | undefined, tel2: string | null | undefined): boolean {
  const ult1 = ultimosDigitos(tel1, 8);
  const ult2 = ultimosDigitos(tel2, 8);
  
  if (!ult1 || !ult2) return false;
  
  return ult1 === ult2;
}

/**
 * Normaliza múltiplos telefones de um objeto de contato
 * Útil para usar antes de salvar no banco
 */
export function normalizarTelefonesContato(dados: {
  telefone?: string | null;
  telefone2?: string | null;
  telefone3?: string | null;
  telefone4?: string | null;
  telefone5?: string | null;
}): {
  telefone?: string;
  telefone2?: string;
  telefone3?: string;
  telefone4?: string;
  telefone5?: string;
} {
  return {
    telefone: dados.telefone ? normalizarTelefone(dados.telefone) : undefined,
    telefone2: dados.telefone2 ? normalizarTelefone(dados.telefone2) : undefined,
    telefone3: dados.telefone3 ? normalizarTelefone(dados.telefone3) : undefined,
    telefone4: dados.telefone4 ? normalizarTelefone(dados.telefone4) : undefined,
    telefone5: dados.telefone5 ? normalizarTelefone(dados.telefone5) : undefined,
  };
}
