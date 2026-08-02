import { resolverAgendaPilotConfig, type AgendaPilotConfig } from './agenda-pilot-config';

export type AgendaLifecycleRolloutReason =
  | 'ENABLED'
  | 'FLAG_DISABLED'
  | 'SCOPE_UNAVAILABLE'
  | 'TENANT_OUT_OF_SCOPE'
  | 'BEFORE_CUTOFF';

export interface AgendaLifecycleRollout {
  policyEnabled: boolean;
  commandsEnabled: boolean;
  policyReason: AgendaLifecycleRolloutReason;
  commandsReason: AgendaLifecycleRolloutReason;
}

export interface AgendaEffectsRollout {
  effectsEnabled: boolean;
  effectsReason: AgendaLifecycleRolloutReason;
}

let configPromise: Promise<AgendaPilotConfig> | undefined;

export function avaliarAgendaLifecycleRollout(
  config: AgendaPilotConfig,
  tenantId: string,
  instant: Date,
): AgendaLifecycleRollout {
  if (!config.scope) {
    return {
      policyEnabled: false,
      commandsEnabled: false,
      policyReason: config.lifecyclePolicy.requested ? 'SCOPE_UNAVAILABLE' : 'FLAG_DISABLED',
      commandsReason: config.lifecycleCommands.requested ? 'SCOPE_UNAVAILABLE' : 'FLAG_DISABLED',
    };
  }
  if (config.scope.tenantId !== tenantId) {
    return {
      policyEnabled: false,
      commandsEnabled: false,
      policyReason: 'TENANT_OUT_OF_SCOPE',
      commandsReason: 'TENANT_OUT_OF_SCOPE',
    };
  }
  if (instant.getTime() < new Date(config.scope.startedAtUtc).getTime()) {
    return {
      policyEnabled: false,
      commandsEnabled: false,
      policyReason: 'BEFORE_CUTOFF',
      commandsReason: 'BEFORE_CUTOFF',
    };
  }
  return {
    policyEnabled: config.lifecyclePolicy.enabled,
    commandsEnabled: config.lifecycleCommands.enabled,
    policyReason: config.lifecyclePolicy.enabled ? 'ENABLED' : 'FLAG_DISABLED',
    commandsReason: config.lifecycleCommands.enabled ? 'ENABLED' : 'FLAG_DISABLED',
  };
}

export function avaliarAgendaEffectsRollout(
  config: AgendaPilotConfig,
  tenantId: string,
  instant: Date,
): AgendaEffectsRollout {
  if (!config.scope) {
    return {
      effectsEnabled: false,
      effectsReason: config.effects.requested ? 'SCOPE_UNAVAILABLE' : 'FLAG_DISABLED',
    };
  }
  if (config.scope.tenantId !== tenantId) {
    return { effectsEnabled: false, effectsReason: 'TENANT_OUT_OF_SCOPE' };
  }
  if (instant.getTime() < new Date(config.scope.startedAtUtc).getTime()) {
    return { effectsEnabled: false, effectsReason: 'BEFORE_CUTOFF' };
  }
  return {
    effectsEnabled: config.effects.enabled,
    effectsReason: config.effects.enabled ? 'ENABLED' : 'FLAG_DISABLED',
  };
}

export async function obterAgendaLifecycleRollout(
  tenantId: string,
  instant = new Date(),
): Promise<AgendaLifecycleRollout> {
  configPromise ??= resolverAgendaPilotConfig();
  return avaliarAgendaLifecycleRollout(await configPromise, tenantId, instant);
}

export async function obterAgendaEffectsRollout(
  tenantId: string,
  instant = new Date(),
): Promise<AgendaEffectsRollout> {
  configPromise ??= resolverAgendaPilotConfig();
  return avaliarAgendaEffectsRollout(await configPromise, tenantId, instant);
}

export function resetAgendaLifecycleRolloutCacheForTests(): void {
  configPromise = undefined;
}
