import { runWithJobLogContext } from '../lib/log-context';
import {
  executarConvitesConfirmacaoCorretor,
  executarCutoffRemanejamentoCorretor,
  executarLembretesConfirmacaoCorretor,
} from '../jobs/job-confirmacao-corretor';
import { executarLembretesProximidadeAgendamento } from '../jobs/job-lembretes-agendamento';

const INTERVALO_PADRAO_MS = 60_000;

export class SchedulerConfirmacaoCorretor {
  private timer: NodeJS.Timeout | null = null;
  private emExecucao = false;

  constructor(private readonly intervaloMs = INTERVALO_PADRAO_MS) {}

  iniciar(): void {
    if (this.timer) return;

    void this.executarCiclo();
    this.timer = setInterval(() => void this.executarCiclo(), this.intervaloMs);
    this.timer.unref();
    console.log(`[ConfirmacaoCorretor] Scheduler iniciado (intervalo=${this.intervaloMs}ms).`);
  }

  parar(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async executarCiclo(): Promise<void> {
    if (this.emExecucao) return;
    this.emExecucao = true;

    try {
      await runWithJobLogContext('scheduler-confirmacao-corretor', async () => {
        const convites = await executarConvitesConfirmacaoCorretor();
        const lembretes = await executarLembretesConfirmacaoCorretor();
        const cutoff = await executarCutoffRemanejamentoCorretor();
        const lembretesAtendimento = await executarLembretesProximidadeAgendamento();

        if (convites.processados || lembretes.processados || cutoff.processados || lembretesAtendimento.processados) {
          console.log('[ConfirmacaoCorretor] Ciclo concluído', { convites, lembretes, cutoff });
        }
      });
    } catch (error) {
      console.error('[ConfirmacaoCorretor] Erro no ciclo:', error);
    } finally {
      this.emExecucao = false;
    }
  }
}

export const schedulerConfirmacaoCorretor = new SchedulerConfirmacaoCorretor();
