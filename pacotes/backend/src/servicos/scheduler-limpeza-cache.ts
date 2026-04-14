/**
 * Scheduler de Limpeza do Cache de CPFs
 *
 * Executa diariamente às 02:00 (horário de SP) para:
 * - Remover registros expirados do cache_cpf (não acessados há mais de 90 dias)
 *
 * Com o fix de sliding-window TTL no processamento.rotas.ts, qualquer CPF
 * consultado tem seu expiraEm renovado por mais 90 dias.
 * Portanto, registros expirados = CPFs genuinamente abandonados/irrelevantes.
 */

import { prisma } from '../lib/db';

const CHECK_INTERVAL_MS = 60 * 1000; // verifica a cada minuto

class SchedulerLimpezaCache {
  private timer: NodeJS.Timeout | null = null;
  private ultimaDataExecucao = '';

  iniciar() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.verificarJanelaExecucao().catch((err) => {
        console.error('[CacheCleanup] Erro no ciclo de verificação:', err);
      });
    }, CHECK_INTERVAL_MS);

    console.log('[CacheCleanup] Agendador de limpeza do cache iniciado (diário às 02:00 America/Sao_Paulo).');
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

    // Executa apenas às 02:00
    if (agoraSp.hora !== 2 || agoraSp.minuto !== 0) return;

    // Executa apenas uma vez por dia
    if (this.ultimaDataExecucao === agoraSp.data) return;

    this.ultimaDataExecucao = agoraSp.data;
    await this.executarLimpeza();
  }

  async executarLimpeza() {
    console.log('[CacheCleanup] 🧹 Iniciando limpeza de registros expirados...');

    try {
      const resultado = await prisma.cacheCpf.deleteMany({
        where: {
          expiraEm: { lt: new Date() },
        },
      });

      if (resultado.count > 0) {
        console.log(`[CacheCleanup] ✅ ${resultado.count} registros expirados removidos do cache_cpf.`);
      } else {
        console.log('[CacheCleanup] ✅ Nenhum registro expirado encontrado.');
      }
    } catch (err) {
      console.error('[CacheCleanup] ❌ Erro ao limpar cache:', err);
    }
  }
}

export const schedulerLimpezaCache = new SchedulerLimpezaCache();
