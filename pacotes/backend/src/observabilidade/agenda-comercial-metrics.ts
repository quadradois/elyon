import { Counter, Gauge } from 'prom-client';
import { metricsRegistry } from './metricas';
import type { AgendaPilotConfig } from '../servicos/agenda-pilot-config';

export const agendaComercialEventos = new Counter({
  name: 'elyon_agenda_commercial_commands_total',
  help: 'Resultados agregados dos comandos atomicos de agenda e estado comercial.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});

export const agendaEfeitosEventos = new Counter({
  name: 'elyon_agenda_commercial_effects_total',
  help: 'Resultados agregados do outbox de notificacoes de agenda.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});

export const agendaNoShowEventos = new Counter({
  name: 'elyon_agenda_no_show_worker_total',
  help: 'Resultados agregados do claimer duravel de no-show.',
  labelNames: ['resultado'] as const,
  registers: [metricsRegistry],
});

export const specialistCopilotEventos = new Counter({
  name: 'elyon_specialist_copilot_events_total',
  help: 'Eventos agregados do Copilot do especialista, sem telefone, tenant ou conteudo.',
  labelNames: ['intencao', 'resultado'] as const,
  registers: [metricsRegistry],
});

export function registrarSpecialistCopilotEvento(intencao: string, resultado: string): void {
  const safe = (value: string) => /^[A-Z0-9_]{1,64}$/.test(value) ? value.toLowerCase() : 'unknown';
  specialistCopilotEventos.inc({ intencao: safe(intencao), resultado: safe(resultado) });
}

export const agendaLifecycleDecisions = new Counter({
  name: 'elyon_agenda_lifecycle_decisions_total',
  help: 'Decisoes agregadas da politica de ciclo de vida, sem identidade ou PII.',
  labelNames: ['resultado', 'reason_code', 'fase'] as const,
  registers: [metricsRegistry],
});

export const agendaLifecycleExpiredPending = new Gauge({
  name: 'elyon_agenda_lifecycle_expired_pending',
  help: 'Quantidade agregada de compromissos vencidos ainda sem desfecho.',
  registers: [metricsRegistry],
});

export const agendaLifecycleOperationalQueueAgeSeconds = new Gauge({
  name: 'elyon_agenda_lifecycle_operational_queue_age_seconds',
  help: 'Idade em segundos do item mais antigo na fila operacional.',
  registers: [metricsRegistry],
});

export function registrarAgendaLifecycleDecision(input: {
  resultado: 'aceito' | 'rejeitado' | 'conflito' | 'replay';
  reasonCode: string;
  fase?: 'FUTURO' | 'INICIADO' | 'ENCERRADO' | 'NAO_APLICAVEL';
}): void {
  const safeReason = /^[A-Z0-9_]{1,64}$/.test(input.reasonCode) ? input.reasonCode.toLowerCase() : 'unknown';
  agendaLifecycleDecisions.inc({
    resultado: input.resultado,
    reason_code: safeReason,
    fase: (input.fase || 'NAO_APLICAVEL').toLowerCase(),
  });
}

export const agendaPilotGate = new Gauge({
  name: 'elyon_agenda_pilot_gate',
  help: 'Estado fail-closed dos recursos do piloto, sem identidade do tenant.',
  labelNames: ['recurso', 'status', 'reason_code'] as const,
  registers: [metricsRegistry],
});

export const agendaPilotTenantScope = new Gauge({
  name: 'elyon_agenda_pilot_tenant_scope_count',
  help: 'Quantidade de tenants no escopo do piloto; nunca expoe suas identidades.',
  registers: [metricsRegistry],
});

export const agendaPilotCutoffConfigured = new Gauge({
  name: 'elyon_agenda_pilot_cutoff_configured',
  help: 'Indica apenas se o cutoff temporal do piloto foi autorizado, sem expor seu valor.',
  registers: [metricsRegistry],
});

export function registrarAgendaPilotConfig(config: AgendaPilotConfig): void {
  agendaPilotGate.reset();
  agendaPilotTenantScope.set(config.scope ? 1 : 0);
  agendaPilotCutoffConfigured.set(config.scope?.startedAtUtc ? 1 : 0);
  agendaPilotGate.set({
    recurso: 'lifecycle_policy',
    status: config.lifecyclePolicy.enabled ? 'enabled' : 'disabled',
    reason_code: config.lifecyclePolicy.reason.toLowerCase(),
  }, 1);
  agendaPilotGate.set({
    recurso: 'lifecycle_commands',
    status: config.lifecycleCommands.enabled ? 'enabled' : 'disabled',
    reason_code: config.lifecycleCommands.reason.toLowerCase(),
  }, 1);
  agendaPilotGate.set({
    recurso: 'effects',
    status: config.effects.enabled ? 'enabled' : 'disabled',
    reason_code: config.effects.reason.toLowerCase(),
  }, 1);
  agendaPilotGate.set({
    recurso: 'no_show',
    status: config.noShow.enabled ? 'enabled' : 'disabled',
    reason_code: config.noShow.reason.toLowerCase(),
  }, 1);
  agendaPilotGate.set({
    recurso: 'specialist_copilot',
    status: config.specialistCopilot?.enabled ? 'enabled' : 'disabled',
    reason_code: (config.specialistCopilot?.reason || 'FLAG_DISABLED').toLowerCase(),
  }, 1);
}
