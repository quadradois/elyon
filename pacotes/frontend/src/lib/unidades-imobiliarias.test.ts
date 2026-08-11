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

  // A base territorial de Goiânia grava o número COLADO no tipo. Estes são
  // complementos reais do edifício ABSOLUT BUSINESS STYLE (SET BUENO).
  it.each([
    ["BOX01.PAV3 SS", "BOX"],
    ["BOX40 PAV3SS", "BOX"],
    ["BOX09 PAV3SS", "BOX"],
    ["GAR01", "GARAGEM"],
    ["VAGA02", "VAGA"],
    ["ESC7", "ESCANINHO"],
  ])("classifica o formato colado da base real: %s → %s", (complemento, esperado) => {
    expect(obterTipoUnidadeAcessoria(complemento)).toBe(esperado);
  });

  // Tipo sem número: em produção o `.includes('BOX')` já os desmarcava.
  it.each([
    ["BOX", "BOX"],
    ["GARAGEM", "GARAGEM"],
    ["VAGA", "VAGA"],
  ])("classifica o tipo sem número: %s → %s", (complemento, esperado) => {
    expect(obterTipoUnidadeAcessoria(complemento)).toBe(esperado);
  });

  it.each(["AP1202A 12PAV A", "APT 101", "SALA 12", "", undefined])(
    "mantém unidade principal selecionável: %s",
    (complemento) => {
      expect(ehUnidadeAcessoria(complemento)).toBe(false);
    }
  );

  // Falso positivo aqui esconde imóvel abordável do corretor — o pior caso.
  it.each([
    "CASA 01",
    "APTO 806",
    "LOJA02",
    "SALA.A11 PAV1",
    "AP301A 3PAV A",
    "ARMANDO 5",
  ])("nunca classifica como acessória: %s", (complemento) => {
    expect(ehUnidadeAcessoria(complemento)).toBe(false);
  });
});

