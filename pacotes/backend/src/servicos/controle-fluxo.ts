import { prisma } from '../lib/db';
import { getRedisClient } from '../lib/redis';

export interface MensagemPendente {
    conteudo: string;
    tipo: string;
    messageId?: string;
    timestamp: number;
}

interface FilaContato {
    mensagens: MensagemPendente[];
    timer: NodeJS.Timeout | null;
    contatoData: any;
    telefone: string;
}

const TEMPO_MAXIMO_MSG_MS = 48 * 60 * 60 * 1000;
const TEMPO_VERIFICAR_RESPOSTA_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 10000;
const COOLDOWN_RESPOSTA_MS = 10000;

export class ControleFluxoService {
    private filasDebounce = new Map<string, FilaContato>();
    // Redis substitui: ultimaRespostaPorContato e processandoContato

    constructor() {
        // Inicializar Redis se necessario (getRedisClient faz lazy load)
    }

    /* 
     * Verifica se já respondemos a mensagem específica (Idempotência)
     */
    async jaRespondemosMensagem(contatoId: string, timestampMensagem: Date): Promise<boolean> {
        try {
            const respostaPosterior = await prisma.mensagemProspeccao.findFirst({
                where: {
                    contatoId: contatoId,
                    direcao: 'SAIDA',
                    dataHora: { gt: timestampMensagem }
                },
                orderBy: { dataHora: 'asc' }
            });
            return respostaPosterior !== null;
        } catch (error) {
            console.error('[ControleFluxo] Erro ao verificar resposta:', error);
            return false;
        }
    }

    async deveProcessarMensagem(
        messageTimestamp: number | undefined,
        messageId: string | undefined,
        contatoId: string | null
    ): Promise<{ processar: boolean; motivo: string }> {
        const agora = Date.now();

        if (!messageTimestamp) {
            return { processar: true, motivo: 'Sem timestamp (assume nova)' };
        }

        const timestampMs = messageTimestamp > 9999999999 ? messageTimestamp : messageTimestamp * 1000;
        const idadeMensagem = agora - timestampMs;

        if (idadeMensagem > TEMPO_MAXIMO_MSG_MS) {
            const horas = Math.round(idadeMensagem / 1000 / 60 / 60);
            return { processar: false, motivo: `Mensagem muito antiga (${horas}h > 48h)` };
        }

        if (idadeMensagem < TEMPO_VERIFICAR_RESPOSTA_MS) {
            return { processar: true, motivo: 'Mensagem recente (< 5min)' };
        }

        if (contatoId) {
            const timestampDate = new Date(timestampMs);
            const jaRespondemos = await this.jaRespondemosMensagem(contatoId, timestampDate);

            if (jaRespondemos) {
                const minutos = Math.round(idadeMensagem / 1000 / 60);
                return { processar: false, motivo: `Mensagem de ${minutos}min atrás já foi respondida` };
            }
        }

        const minutos = Math.round(idadeMensagem / 1000 / 60);
        return { processar: true, motivo: `Mensagem de ${minutos}min atrás ainda não respondida` };
    }

    async podeResponder(contatoId: string): Promise<boolean> {
        const redis = await getRedisClient();
        const lastResponseStr = await redis.get(`sdr:cooldown:${contatoId}`);

        if (!lastResponseStr) return true;

        const lastResponse = parseInt(lastResponseStr);
        return (Date.now() - lastResponse) > COOLDOWN_RESPOSTA_MS;
    }

    async registrarResposta(contatoId: string): Promise<void> {
        const redis = await getRedisClient();
        const now = Date.now().toString();
        // Expira em 5 minutos (limpeza automática)
        await redis.set(`sdr:cooldown:${contatoId}`, now, { EX: 300 });
    }

    async setProcessando(contatoId: string, status: boolean): Promise<void> {
        const redis = await getRedisClient();
        const key = `sdr:lock:${contatoId}`;

        if (status) {
            // Lock de 60s (safety net para crash)
            await redis.set(key, '1', { EX: 60 });
        } else {
            await redis.del(key);
        }
    }

    async estaProcessando(contatoId: string): Promise<boolean> {
        const redis = await getRedisClient();
        const val = await redis.get(`sdr:lock:${contatoId}`);
        return val === '1';
    }

    adicionarAFilaDebounce(
        contatoId: string,
        mensagem: MensagemPendente,
        contatoData: any,
        telefone: string,
        processarCallback: () => Promise<void>
    ): boolean {
        let fila = this.filasDebounce.get(contatoId);

        if (!fila) {
            fila = {
                mensagens: [mensagem],
                timer: null,
                contatoData,
                telefone
            };
            this.filasDebounce.set(contatoId, fila);
            console.log(`[Debounce] 📥 Nova fila para ${contatoId} - Aguardando ${DEBOUNCE_MS / 1000}s...`);

            fila.timer = setTimeout(async () => {
                try {
                    await processarCallback();
                } catch (error) {
                    console.error(`[Debounce] Erro ao processar fila:`, error);
                } finally {
                    this.filasDebounce.delete(contatoId);
                }
            }, DEBOUNCE_MS);
            return true;
        }

        fila.mensagens.push(mensagem);
        console.log(`[Debounce] 📥 +1 mensagem na fila de ${contatoId} (total: ${fila.mensagens.length})`);

        if (fila.timer) clearTimeout(fila.timer);

        fila.timer = setTimeout(async () => {
            try {
                await processarCallback();
            } catch (error) {
                console.error(`[Debounce] Erro ao processar fila:`, error);
            } finally {
                this.filasDebounce.delete(contatoId);
            }
        }, DEBOUNCE_MS);

        return true;
    }

    obterMensagensConsolidadas(contatoId: string): { mensagens: MensagemPendente[]; textoConsolidado: string } | null {
        const fila = this.filasDebounce.get(contatoId);
        if (!fila || fila.mensagens.length === 0) return null;

        const textoConsolidado = fila.mensagens.map(m => m.conteudo).join('\n');
        console.log(`[Debounce] 📤 Consolidando ${fila.mensagens.length} mensagens de ${contatoId}`);

        return {
            mensagens: fila.mensagens,
            textoConsolidado
        };
    }
}

export const controleFluxoService = new ControleFluxoService();
