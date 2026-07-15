import { getWhatsAppService } from './whatsapp';
import { FOLLOWUP_OWNER, processarFollowupReivindicado, reivindicarProximoFollowup, renovarLeaseFollowup } from './followup-outbound';
import { logger } from '../lib/logger';

export async function executarProximoFollowupOutbound(owner = FOLLOWUP_OWNER): Promise<boolean> {
  const item = await reivindicarProximoFollowup(owner);
  if (!item) return false;
  let leaseValido = true;
  const heartbeat = setInterval(() => {
    void renovarLeaseFollowup(item.id, owner, item.fencingToken).then((ok) => { leaseValido = leaseValido && ok; }).catch(() => {
      leaseValido = false;
      logger.error({ followupStatus: item.status }, '[FOLLOWUP] Falha no heartbeat');
    });
  }, 20_000);
  heartbeat.unref();
  try {
    await processarFollowupReivindicado(item, owner, {
      send: async (instanceName, phone, message, idempotencyKey) => {
        if (!leaseValido) throw new Error('FOLLOWUP_LEASE_LOST');
        const result = await getWhatsAppService(instanceName).enviarMensagemTexto(phone, message, idempotencyKey);
        return { providerId: result?.key?.id || result?.id };
      },
    });
  } catch (error) {
    logger.error({ reasonCode: error instanceof Error ? error.message.split(':')[0] : 'FOLLOWUP_FAILED' }, '[FOLLOWUP] Falha no processamento');
  } finally { clearInterval(heartbeat); }
  return true;
}
