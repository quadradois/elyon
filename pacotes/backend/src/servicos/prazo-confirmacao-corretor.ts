const PRAZO_PADRAO_MINUTOS = 60;
const LEMBRETE_PADRAO_ANTECEDENCIA_MINUTOS = 15;

function inteiroLimitado(value: string | undefined, fallback: number, minimo: number, maximo: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimo, Math.min(maximo, parsed));
}

export function obterPrazoConfirmacaoCorretorMinutos(): number {
  return inteiroLimitado(process.env.CORRETOR_CONFIRMACAO_PRAZO_MINUTOS, PRAZO_PADRAO_MINUTOS, 5, 24 * 60);
}

export function obterAntecedenciaLembreteCorretorMinutos(): number {
  const prazo = obterPrazoConfirmacaoCorretorMinutos();
  return inteiroLimitado(
    process.env.CORRETOR_CONFIRMACAO_LEMBRETE_ANTECEDENCIA_MINUTOS,
    LEMBRETE_PADRAO_ANTECEDENCIA_MINUTOS,
    1,
    Math.max(1, prazo - 1),
  );
}

export function calcularPrazoConfirmacaoCorretor(atividade: {
  agendadoPara?: Date | null;
  confirmacaoCorretorSolicitadaEm?: Date | null;
}): Date | null {
  if (!atividade.agendadoPara || !atividade.confirmacaoCorretorSolicitadaEm) return null;
  const agendadoPara = new Date(atividade.agendadoPara);
  const solicitadoEm = new Date(atividade.confirmacaoCorretorSolicitadaEm);
  const prazoPorSla = new Date(solicitadoEm.getTime() + obterPrazoConfirmacaoCorretorMinutos() * 60 * 1000);
  return prazoPorSla < agendadoPara ? prazoPorSla : agendadoPara;
}
