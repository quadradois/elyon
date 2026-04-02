import type { TipoAgente } from './agent-chain';
import { logger } from '../lib/logger';

interface ResolverAgenteFinalParams {
  nomeRealAgenteRespondeu?: string;
  tipoAgenteInicial: TipoAgente;
  mapaNomesAgentes: Record<string, TipoAgente>;
}

interface ResolverAgenteFinalResult {
  nomeAgenteResposta: string;
  agenteQueRespondeuFormatado: TipoAgente;
}

export function resolverAgenteFinal(params: ResolverAgenteFinalParams): ResolverAgenteFinalResult {
  const { nomeRealAgenteRespondeu, tipoAgenteInicial, mapaNomesAgentes } = params;

  const agenteQueRespondeuFormatado = nomeRealAgenteRespondeu
    ? (mapaNomesAgentes[nomeRealAgenteRespondeu] || 'OPENER')
    : tipoAgenteInicial;

  return {
    nomeAgenteResposta: nomeRealAgenteRespondeu || tipoAgenteInicial,
    agenteQueRespondeuFormatado,
  };
}

export function logAgenteResolvido(nomeAgenteResposta: string, agenteQueRespondeuFormatado: TipoAgente): void {
  logger.debug(`[ORCHESTRATOR] ✅ Resposta gerada por: ${nomeAgenteResposta} (Mapeado: ${agenteQueRespondeuFormatado})`);
}