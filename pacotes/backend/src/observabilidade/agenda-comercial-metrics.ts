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

export function registrarAgendaPilotConfig(config: AgendaPilotConfig): void {
  agendaPilotGate.reset();
  agendaPilotTenantScope.set(config.tenantIds.length);
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
}
