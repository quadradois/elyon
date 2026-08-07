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

  if (/^BOX(?:\b|[-_/])/.test(valor)) return "BOX";
  if (/^(?:ESC|ESCANINHO)(?:\b|[-_/])/.test(valor)) return "ESCANINHO";
  if (/^(?:ARM|ARMARIO)(?:\b|[-_/])/.test(valor)) return "ARMÁRIO";
  if (/^(?:GAR|GARAGEM)(?:\b|[-_/])/.test(valor)) return "GARAGEM";
  if (/^VAGA(?:\b|[-_/])/.test(valor)) return "VAGA";

  return null;
}

export function ehUnidadeAcessoria(complemento?: string | null): boolean {
  return obterTipoUnidadeAcessoria(complemento) !== null;
}

