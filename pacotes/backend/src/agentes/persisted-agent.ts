import type { TipoAgente } from './agent-chain';
import { logger } from '../lib/logger';

const MAPA_AGENTE_PERSISTIDO: Record<string, TipoAgente> = {
  OPENER: 'OPENER',
  PRESENTER: 'PRESENTER',
  ADMIN: 'ADMIN',
  CLOSER: 'PRESENTER',
  opener_agent_v11: 'OPENER',
  presenter_agent_v4: 'PRESENTER',
  closer_agent_v5: 'PRESENTER',
  admin_agent_v4: 'ADMIN',
};

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
      logger.debug('[ORCHESTRATOR] ♻️ Agente legado CLOSER encontrado no cache. Migrando para PRESENTER.');
    }

    atualizarUltimoAgente(contatoId, agenteNormalizado);
    return agenteNormalizado;
  }

  return undefined;
}