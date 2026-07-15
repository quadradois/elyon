import {
  concluirTentativa,
  EventoInbox,
  falharTentativa,
  processarEvento,
  ResultadoProcessamento,
  renovarLease,
  WORKER_OWNER,
} from './webhook-inbox';

export interface DependenciasExecutorWebhook {
  processar(evento: EventoInbox): Promise<ResultadoProcessamento>;
  concluir(evento: EventoInbox, owner: string): Promise<boolean>;
  falhar(evento: EventoInbox, erro: unknown, permanente: boolean, owner: string): Promise<'RETRY' | 'MORTO'>;
  renovar(evento: EventoInbox, owner: string): Promise<void>;
  registrarResultado?(evento: EventoInbox, resultado: 'concluido' | 'retry' | 'morto'): void;
  registrarErroHeartbeat?(evento: EventoInbox, erro: unknown): void;
  registrarErroProcessamento?(evento: EventoInbox, erro: unknown): void;
  heartbeatMs?: number;
}

const dependenciasPadrao: DependenciasExecutorWebhook = {
  processar: processarEvento,
  concluir: concluirTentativa,
  falhar: falharTentativa,
  renovar: renovarLease,
};

export async function executarEventoWebhook(
  evento: EventoInbox,
  owner = WORKER_OWNER,
  dependencias: DependenciasExecutorWebhook = dependenciasPadrao,
): Promise<'CONCLUIDO' | 'RETRY' | 'MORTO'> {
  const heartbeatMs = dependencias.heartbeatMs
    ?? Math.max(10_000, Number(process.env.WEBHOOK_WORKER_LEASE_SECONDS || 300) * 1_000 / 3);
  const heartbeat = setInterval(() => {
    void dependencias.renovar(evento, owner).catch((erro) => {
      try { dependencias.registrarErroHeartbeat?.(evento, erro); } catch { /* logger não pode derrubar o worker */ }
    });
  }, heartbeatMs);
  try {
    if (!evento.payload) throw new Error('Evento sem payload persistido');
    const resultado = await dependencias.processar(evento);
    if (resultado.statusCode >= 500) {
      const status = await dependencias.falhar(evento, `Handler retornou HTTP ${resultado.statusCode}`, false, owner);
      dependencias.registrarResultado?.(evento, status.toLowerCase() as 'retry' | 'morto');
      return status;
    }
    if (resultado.statusCode >= 400) {
      await dependencias.falhar(evento, `Payload rejeitado com HTTP ${resultado.statusCode}`, true, owner);
      dependencias.registrarResultado?.(evento, 'morto');
      return 'MORTO';
    }
    if (!(await dependencias.concluir(evento, owner))) throw new Error('Lease perdido antes da conclusao do evento');
    dependencias.registrarResultado?.(evento, 'concluido');
    return 'CONCLUIDO';
  } catch (erro) {
    try { dependencias.registrarErroProcessamento?.(evento, erro); } catch { /* preservar retry mesmo se logger falhar */ }
    const status = await dependencias.falhar(evento, erro, false, owner);
    dependencias.registrarResultado?.(evento, status.toLowerCase() as 'retry' | 'morto');
    return status;
  } finally {
    clearInterval(heartbeat);
  }
}
