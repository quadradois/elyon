import { describe, expect, it } from "vitest";
import { formatarStatusProspeccao, obterStatusProspeccaoExibicao } from "./status-prospeccao";

describe("status de prospecção exibido", () => {
  it("preserva o status da campanha quando ele existe", () => {
    expect(obterStatusProspeccaoExibicao({
      statusProspeccao: "SEM_INTERESSE",
      virouLead: false,
    })).toBe("SEM_INTERESSE");
  });

  it("exibe LEAD para contato convertido cujo status foi limpo", () => {
    expect(obterStatusProspeccaoExibicao({
      statusProspeccao: null,
      virouLead: true,
    })).toBe("LEAD");
  });

  it("exibe AGUARDANDO para contato não convertido sem status", () => {
    expect(obterStatusProspeccaoExibicao({
      statusProspeccao: null,
      virouLead: false,
    })).toBe("AGUARDANDO");
  });

  it("formata status compostos sem depender de valor anulável", () => {
    expect(formatarStatusProspeccao("SEM_INTERESSE")).toBe("SEM INTERESSE");
  });
});
