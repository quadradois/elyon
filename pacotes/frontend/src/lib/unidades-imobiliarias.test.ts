import { describe, expect, it } from "vitest";
import {
  ehUnidadeAcessoria,
  obterTipoUnidadeAcessoria,
} from "./unidades-imobiliarias";

describe("unidades imobiliárias acessórias", () => {
  it.each([
    ["BOX 101", "BOX"],
    ["ESC 42", "ESCANINHO"],
    ["ESCANINHO-7", "ESCANINHO"],
    ["ARM 12", "ARMÁRIO"],
    ["ARMÁRIO 9", "ARMÁRIO"],
    ["GAR 01", "GARAGEM"],
    ["GARAGEM/12", "GARAGEM"],
    ["VAGA 88", "VAGA"],
  ])("classifica %s como %s", (complemento, esperado) => {
    expect(obterTipoUnidadeAcessoria(complemento)).toBe(esperado);
  });

  it.each(["AP1202A 12PAV A", "APT 101", "SALA 12", "", undefined])(
    "mantém unidade principal selecionável: %s",
    (complemento) => {
      expect(ehUnidadeAcessoria(complemento)).toBe(false);
    }
  );
});

