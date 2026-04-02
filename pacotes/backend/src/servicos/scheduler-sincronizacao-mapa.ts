import { randomUUID } from 'crypto';
import { getRedisClient } from '../lib/redis';
import { sincronizacaoService } from './sincronizacao-mapa';

const LOCK_KEY = 'elyon:sync_mapa:lock';
const LOCK_TTL_SECONDS = 60 * 60 * 6;
const CHECK_INTERVAL_MS = 60 * 1000;

class SchedulerSincronizacaoMapa {
    private timer: NodeJS.Timeout | null = null;
    private ultimaDataExecucao = '';
    private instanceId = randomUUID();

    iniciar() {
        const habilitado = process.env.AGENDAR_SYNC_MAPA !== 'false';
        if (!habilitado) {
            console.log('[SyncScheduler] Agendamento desabilitado (AGENDAR_SYNC_MAPA=false)');
            return;
        }

        if (this.timer) return;

        this.timer = setInterval(() => {
            this.verificarJanelaExecucao().catch((error) => {
                console.error('[SyncScheduler] Erro no ciclo de verificação:', error);
            });
        }, CHECK_INTERVAL_MS);

        console.log('[SyncScheduler] Agendador de sincronização iniciado (diário às 03:00 America/Sao_Paulo).');

        this.verificarJanelaExecucao().catch((error) => {
            console.error('[SyncScheduler] Erro na verificação inicial:', error);
        });
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
            second: '2-digit',
            hourCycle: 'h23'
        });

        const parts = formatter.formatToParts(agora);
        const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

        return {
            data: `${get('year')}-${get('month')}-${get('day')}`,
            hora: Number(get('hour')),
            minuto: Number(get('minute'))
        };
    }

    private async verificarJanelaExecucao() {
        const agoraSp = this.getDataHoraSaoPaulo();

        if (agoraSp.hora !== 3 || agoraSp.minuto !== 0) {
            return;
        }

        if (this.ultimaDataExecucao === agoraSp.data) {
            return;
        }

        const lock = await this.adquirirLock();
        if (!lock) {
            console.log('[SyncScheduler] Execução ignorada: lock já ativo em outra instância.');
            return;
        }

        try {
            console.log('[SyncScheduler] Iniciando sincronização diária automática (03:00).');
            await sincronizacaoService.sincronizarTudo('agendado');
            this.ultimaDataExecucao = agoraSp.data;
            console.log('[SyncScheduler] Sincronização diária concluída com sucesso.');
        } catch (error) {
            console.error('[SyncScheduler] Falha na sincronização diária:', error);
        } finally {
            await this.liberarLock();
        }
    }

    private async adquirirLock(): Promise<boolean> {
        try {
            const redis = await getRedisClient();
            const result = await redis.set(LOCK_KEY, this.instanceId, {
                NX: true,
                EX: LOCK_TTL_SECONDS
            });

            return result === 'OK';
        } catch (error) {
            console.error('[SyncScheduler] Erro ao adquirir lock Redis:', error);
            return false;
        }
    }

    private async liberarLock() {
        try {
            const redis = await getRedisClient();
            const valor = await redis.get(LOCK_KEY);

            if (valor === this.instanceId) {
                await redis.del(LOCK_KEY);
            }
        } catch (error) {
            console.error('[SyncScheduler] Erro ao liberar lock Redis:', error);
        }
    }
}

export const schedulerSincronizacaoMapa = new SchedulerSincronizacaoMapa();
