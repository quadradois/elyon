/**
 * Scheduler de Reconciliação de Instâncias WhatsApp (Evolution GO)
 *
 * Executa diariamente às 03:00 (horário de SP) para remover instâncias ÓRFÃS
 * do Elyon no Evolution GO — instâncias com prefixo `elyon_` que existem no
 * servidor mas não têm sessão correspondente no banco do Elyon.
 *
 * Rede de segurança contra acúmulo de instâncias desativadas: mesmo que uma
 * exclusão pelo app falhe no meio do caminho, esta faxina recolhe o lixo.
 *
 * O servidor Evolution GO é COMPARTILHADO com outros projetos (ex.: QuadraDois,
 * que usa o prefixo `tenant_*`). Por isso a varredura SÓ toca instâncias `elyon_`.
 */

import { prisma } from '../lib/db';
import {
  listarInstanciasEvolution,
  deletarInstanciaEvolutionPorId,
  limparCacheWhatsApp,
} from './whatsapp';
import { runWithJobLogContext } from '../lib/log-context';

const PREFIXO_ELYON = 'elyon_';
const CHECK_INTERVAL_MS = 60 * 1000; // verifica a cada minuto

class SchedulerReconciliacaoWhatsapp {
  private timer: NodeJS.Timeout | null = null;
  private ultimaDataExecucao = '';

  iniciar() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      runWithJobLogContext('scheduler-whatsapp-reconciliation', () => this.verificarJanelaExecucao()).catch((err) => {
        console.error('[ReconciliacaoWA] Erro no ciclo de verificação:', err);
      });
    }, CHECK_INTERVAL_MS);

    console.log('[ReconciliacaoWA] Agendador de reconciliação WhatsApp iniciado (diário às 03:00 America/Sao_Paulo).');
  }

  parar() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getDataHoraSaoPaulo() {
    const agora = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(agora);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    return {
      data: `${get('year')}-${get('month')}-${get('day')}`,
      hora: Number(get('hour')),
      minuto: Number(get('minute')),
    };
  }

  private async verificarJanelaExecucao() {
    const agoraSp = this.getDataHoraSaoPaulo();

    // Executa apenas às 03:00
    if (agoraSp.hora !== 3 || agoraSp.minuto !== 0) return;

    // Executa apenas uma vez por dia
    if (this.ultimaDataExecucao === agoraSp.data) return;

    this.ultimaDataExecucao = agoraSp.data;
    await this.executarReconciliacao();
  }

  /**
   * Varre o Evolution GO e remove instâncias órfãs do Elyon.
   * Retorna o número de instâncias removidas (útil para chamada manual/testes).
   */
  async executarReconciliacao(): Promise<number> {
    console.log('[ReconciliacaoWA] 🧹 Iniciando reconciliação de instâncias WhatsApp...');

    try {
      const [instancias, sessoes] = await Promise.all([
        listarInstanciasEvolution(),
        prisma.sessaoWhatsapp.findMany({
          select: { instanceName: true, evolutionInstanceId: true },
        }),
      ]);

      const nomesBanco = new Set(sessoes.map((s) => s.instanceName));
      const idsBanco = new Set(sessoes.map((s) => s.evolutionInstanceId).filter(Boolean));

      const orfas = instancias.filter(
        (i: any) =>
          typeof i?.name === 'string' &&
          i.name.startsWith(PREFIXO_ELYON) &&
          !nomesBanco.has(i.name) &&
          !idsBanco.has(i.id),
      );

      if (orfas.length === 0) {
        console.log('[ReconciliacaoWA] ✅ Nenhuma instância órfã encontrada.');
        return 0;
      }

      let removidas = 0;
      for (const orfa of orfas) {
        try {
          await deletarInstanciaEvolutionPorId(orfa.id);
          limparCacheWhatsApp(orfa.name);
          removidas++;
          console.log(`[ReconciliacaoWA] 🧹 Órfã removida: ${orfa.name} (id=${orfa.id})`);
        } catch (e: any) {
          console.error(`[ReconciliacaoWA] ❌ Falha ao remover órfã ${orfa.name}:`, e?.message);
        }
      }

      console.log(`[ReconciliacaoWA] ✅ Reconciliação concluída: ${removidas}/${orfas.length} órfã(s) removida(s).`);
      return removidas;
    } catch (err) {
      console.error('[ReconciliacaoWA] ❌ Erro na reconciliação:', err);
      return 0;
    }
  }
}

export const schedulerReconciliacaoWhatsapp = new SchedulerReconciliacaoWhatsapp();
