import { Counter } from 'prom-client';
import { metricsRegistry } from './metricas';
import type { RagDiscardReason, RagFactsSelection } from '../agentes/rag-facts-context';

const recovery = new Counter({ name: 'elyon_rag_facts_recovery_total', help: 'Recuperacoes de fatos RAG por resultado.', labelNames: ['result'] as const, registers: [metricsRegistry] });
const selected = new Counter({ name: 'elyon_rag_facts_selected_total', help: 'Fatos RAG selecionados.', registers: [metricsRegistry] });
const discarded = new Counter({ name: 'elyon_rag_facts_discarded_total', help: 'Fatos RAG descartados por reason code.', labelNames: ['reason'] as const, registers: [metricsRegistry] });
const truncated = new Counter({ name: 'elyon_rag_facts_truncated_total', help: 'Selecoes RAG truncadas pelos limites.', registers: [metricsRegistry] });

export function recordRagRecovery(result: 'success' | 'empty' | 'degraded'): void { recovery.inc({ result }); }
export function recordRagSelection(selection: RagFactsSelection): void {
  selected.inc(selection.facts.length);
  for (const [reason, count] of Object.entries(selection.discarded) as Array<[RagDiscardReason, number]>) {
    if (count) discarded.inc({ reason }, count);
  }
  if (selection.truncated) truncated.inc();
}
