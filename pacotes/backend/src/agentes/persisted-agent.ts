import { TipoAgente, MAPA_NOMES_AGENTES } from './agent-chain';
import { logger } from '../lib/logger';

/** Mapa unificado — reutiliza a fonte de verdade de agent-chain */
const MAPA_AGENTE_PERSISTIDO = MAPA_NOMES_AGENTES;

interface ResolverAgentePersistidoParams {
  contatoId?: string;
  getLastAgentFn: (contatoId: string) => Promise<string | undefined>;
  atualizarUltimoAgente: (contatoId: string, agente: TipoAgente) => void;
}

export async function resolverAgentePersistido(
  params: ResolverAgentePersistidoParams
): Promise<TipoAgente | undefined> {
  const { contatoId, getLastAgentFn, atualizarUltimoAgente } = params;

  if (!contatoId) {
    return undefined;
  }

  const ultimoPersistido = await getLastAgentFn(contatoId);

  if (!ultimoPersistido) {
    return undefined;
  }

  const agenteNormalizado = MAPA_AGENTE_PERSISTIDO[ultimoPersistido];

  if (agenteNormalizado) {
    if (ultimoPersistido === 'CLOSER' || ultimoPersistido === 'closer_agent_v5') {
      logger.debug('[ORCHESTRATOR] ♻️ Agente legado CLOSER encontrado no cache. Migrando para SDR.');
    } else if (ultimoPersistido === 'OPENER' || ultimoPersistido === 'PRESENTER' || ultimoPersistido.startsWith('opener_') || ultimoPersistido.startsWith('presenter_')) {
      logger.debug(`[ORCHESTRATOR] ♻️ Agente legado ${ultimoPersistido} encontrado no cache. Migrando para SDR.`);
    }

    atualizarUltimoAgente(contatoId, agenteNormalizado);
    return agenteNormalizado;
  }

  return undefined;
}