export type TipoUnidadeAcessoria =
  | "BOX"
  | "ESCANINHO"
  | "ARMÁRIO"
  | "GARAGEM"
  | "VAGA";

export function obterTipoUnidadeAcessoria(
  complemento?: string | null
): TipoUnidadeAcessoria | null {
  const valor = (complemento || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  // Lookahead em vez de `\b`: na base territorial o número vem COLADO no tipo
  // ("BOX01.PAV3 SS"), e não existe fronteira de palavra entre "X" e "0".
  // Mesma TÉCNICA do backend (servicos/geo360-endereco.ts) — critérios
  // próximos, não idênticos: lá o marcador é buscado no meio do endereço.
  // O `|$` cobre o tipo sem número ("BOX", "GARAGEM"), que também é acessória.
  if (/^BOX(?:E)?(?=\s*[-._/]?\s*(?:[A-Z0-9]|$))/.test(valor)) return "BOX";
  if (/^(?:ESCANINHO|ESC)(?=\s*[-._/]?\s*(?:\d|$))/.test(valor)) return "ESCANINHO";
  if (/^(?:ARMARIO|ARM)(?=\s*[-._/]?\s*(?:\d|$))/.test(valor)) return "ARMÁRIO";
  if (/^(?:GARAGEM|GAR)(?=\s*[-._/]?\s*(?:\d|$))/.test(valor)) return "GARAGEM";
  if (/^VAGA(?=\s*[-._/]?\s*(?:\d|$))/.test(valor)) return "VAGA";

  return null;
}

export function ehUnidadeAcessoria(complemento?: string | null): boolean {
  return obterTipoUnidadeAcessoria(complemento) !== null;
}

