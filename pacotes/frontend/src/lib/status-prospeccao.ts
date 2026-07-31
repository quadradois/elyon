interface ContatoComStatusProspeccao {
  statusProspeccao?: string | null;
  virouLead?: boolean | null;
}

export function obterStatusProspeccaoExibicao(contato: ContatoComStatusProspeccao): string {
  if (contato.statusProspeccao) return contato.statusProspeccao;
  return contato.virouLead ? "LEAD" : "AGUARDANDO";
}

export function formatarStatusProspeccao(status: string): string {
  return status.replace(/_/g, " ");
}
