import type { TipoAgente } from './agent-chain';

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

  if (ultimoPersistido === 'OPENER' || ultimoPersistido === 'PRESENTER' || ultimoPersistido === 'ADMIN') {
    atualizarUltimoAgente(contatoId, ultimoPersistido);
    return ultimoPersistido;
  }

  if (ultimoPersistido === 'CLOSER') {
    console.log('[ORCHESTRATOR] ♻️ Agente legado CLOSER encontrado no cache. Migrando para PRESENTER.');
    atualizarUltimoAgente(contatoId, 'PRESENTER');
    return 'PRESENTER';
  }

  return undefined;
}