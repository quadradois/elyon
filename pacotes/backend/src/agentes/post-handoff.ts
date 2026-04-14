import type { TipoAgente } from './agent-chain';
import { logger } from '../lib/logger';
import type { AgentInputItem } from '@openai/agents';

interface ProcessarPosHandoffParams {
  contatoId?: string;
  tipoAgente: TipoAgente;
  agenteQueRespondeuFormatado: TipoAgente;
  atualizarUltimoAgente: (contatoId: string, agente: TipoAgente) => void;
  getHistoryContato: (contatoId: string) => Promise<AgentInputItem[] | undefined>;
  setHistoryContato: (contatoId: string, history: AgentInputItem[], lastAgent: TipoAgente) => Promise<void>;
  gerarBriefing: (history: AgentInputItem[], agenteOrigem: TipoAgente, agenteDestino: TipoAgente) => Promise<AgentInputItem | null>;
}

interface ProcessarPosHandoffResult {
  houveHandoff: boolean;
}

export async function processarPosHandoff(
  params: ProcessarPosHandoffParams
): Promise<ProcessarPosHandoffResult> {
  const {
    contatoId,
    tipoAgente,
    agenteQueRespondeuFormatado,
    atualizarUltimoAgente,
    getHistoryContato,
    setHistoryContato,
    gerarBriefing,
  } = params;

  const houveHandoff = agenteQueRespondeuFormatado !== tipoAgente;

  if (!houveHandoff || !contatoId) {
    return { houveHandoff };
  }

  const novoTipo = agenteQueRespondeuFormatado;
  atualizarUltimoAgente(contatoId, novoTipo);
  logger.debug(`[ORCHESTRATOR] 🔄 Handoff detectado: ${tipoAgente} → ${novoTipo}. Salvo no cache para próxima mensagem.`);

  try {
    const cachedHist = await getHistoryContato(contatoId);
    if (cachedHist && cachedHist.length > 0) {
      const briefing = await gerarBriefing(cachedHist, tipoAgente, novoTipo);
      if (briefing) {
        await setHistoryContato(contatoId, [briefing, ...cachedHist], agenteQueRespondeuFormatado);
        logger.debug(`[ORCHESTRATOR] 🧠 Briefing LLM injetado no cache para ${novoTipo}`);
      }
    }
  } catch (briefErr) {
    logger.warn({ err: briefErr }, '[POST-HANDOFF] Erro ao processar briefing pós-handoff');
  }

  return { houveHandoff };
}