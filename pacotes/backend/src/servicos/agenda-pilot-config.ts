import { prisma } from '../lib/db';

export type AgendaPilotGateReason =
  | 'FLAG_DISABLED'
  | 'ENABLED'
  | 'TENANT_ID_MISSING'
  | 'TENANT_ID_INVALID'
  | 'TENANT_NOT_FOUND'
  | 'TENANT_INACTIVE'
  | 'STARTED_AT_MISSING'
  | 'STARTED_AT_INVALID'
  | 'POLICY_REQUIRED'
  | 'EFFECTS_REQUIRED'
  | 'GRACE_PERIOD_MISSING'
  | 'GRACE_PERIOD_INVALID';

export interface AgendaPilotFeatureGate {
  requested: boolean;
  enabled: boolean;
  reason: AgendaPilotGateReason;
}

export interface AgendaPilotScope {
  readonly tenantId: string;
  readonly startedAtUtc: string;
}

export interface AgendaPilotConfig {
  scope?: AgendaPilotScope;
  lifecyclePolicy: AgendaPilotFeatureGate;
  lifecycleCommands: AgendaPilotFeatureGate;
  effects: AgendaPilotFeatureGate;
  noShow: AgendaPilotFeatureGate;
  noShowGraceMinutes?: number;
}

type AgendaPilotEnv = Partial<Record<
  'AGENDA_LIFECYCLE_POLICY_ENABLED'
  | 'AGENDA_LIFECYCLE_COMMANDS_ENABLED'
  | 'AGENDA_EFFECTS_ENABLED'
  | 'AGENDA_NO_SHOW_ENABLED'
  | 'AGENDA_PILOT_TENANT_ID'
  | 'AGENDA_PILOT_STARTED_AT'
  | 'AGENDA_NO_SHOW_GRACE_MINUTES', string | undefined>>;

interface AgendaPilotDependencies {
  findTenant: (tenantId: string) => Promise<{ status: string } | null>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MIN_GRACE_MINUTES = 1;
const MAX_GRACE_MINUTES = 24 * 60;

const defaultDependencies: AgendaPilotDependencies = {
  findTenant: (tenantId) => prisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } }),
};

function disabled(requested: boolean, reason: AgendaPilotGateReason): AgendaPilotFeatureGate {
  return { requested, enabled: false, reason };
}

function parseUtcInstant(value: string | undefined): { date?: Date; reason?: AgendaPilotGateReason } {
  if (!value?.trim()) return { reason: 'STARTED_AT_MISSING' };
  const normalized = value.trim();
  if (!UTC_INSTANT_PATTERN.test(normalized)) return { reason: 'STARTED_AT_INVALID' };
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return { reason: 'STARTED_AT_INVALID' };
  const canonical = date.toISOString();
  if (canonical !== normalized && canonical.replace('.000Z', 'Z') !== normalized) {
    return { reason: 'STARTED_AT_INVALID' };
  }
  return { date };
}

function commonFailure(
  lifecyclePolicyRequested: boolean,
  lifecycleCommandsRequested: boolean,
  effectsRequested: boolean,
  noShowRequested: boolean,
  reason: AgendaPilotGateReason,
): AgendaPilotConfig {
  return {
    lifecyclePolicy: lifecyclePolicyRequested ? disabled(true, reason) : disabled(false, 'FLAG_DISABLED'),
    lifecycleCommands: lifecycleCommandsRequested ? disabled(true, reason) : disabled(false, 'FLAG_DISABLED'),
    effects: effectsRequested ? disabled(true, reason) : disabled(false, 'FLAG_DISABLED'),
    noShow: noShowRequested ? disabled(true, reason) : disabled(false, 'FLAG_DISABLED'),
  };
}

export async function resolverAgendaPilotConfig(
  env: AgendaPilotEnv = process.env,
  dependencies: AgendaPilotDependencies = defaultDependencies,
): Promise<AgendaPilotConfig> {
  const lifecyclePolicyRequested = env.AGENDA_LIFECYCLE_POLICY_ENABLED === 'true';
  const lifecycleCommandsRequested = env.AGENDA_LIFECYCLE_COMMANDS_ENABLED === 'true';
  const effectsRequested = env.AGENDA_EFFECTS_ENABLED === 'true';
  const noShowRequested = env.AGENDA_NO_SHOW_ENABLED === 'true';
  if (!lifecyclePolicyRequested && !lifecycleCommandsRequested && !effectsRequested && !noShowRequested) {
    return {
      lifecyclePolicy: disabled(false, 'FLAG_DISABLED'),
      lifecycleCommands: disabled(false, 'FLAG_DISABLED'),
      effects: disabled(false, 'FLAG_DISABLED'),
      noShow: disabled(false, 'FLAG_DISABLED'),
    };
  }

  const tenantId = env.AGENDA_PILOT_TENANT_ID?.trim();
  if (!tenantId) return commonFailure(lifecyclePolicyRequested, lifecycleCommandsRequested, effectsRequested, noShowRequested, 'TENANT_ID_MISSING');
  if (!UUID_PATTERN.test(tenantId)) return commonFailure(lifecyclePolicyRequested, lifecycleCommandsRequested, effectsRequested, noShowRequested, 'TENANT_ID_INVALID');

  const startedAt = parseUtcInstant(env.AGENDA_PILOT_STARTED_AT);
  if (!startedAt.date) return commonFailure(lifecyclePolicyRequested, lifecycleCommandsRequested, effectsRequested, noShowRequested, startedAt.reason!);

  const tenant = await dependencies.findTenant(tenantId);
  if (!tenant) return commonFailure(lifecyclePolicyRequested, lifecycleCommandsRequested, effectsRequested, noShowRequested, 'TENANT_NOT_FOUND');
  if (tenant.status !== 'ATIVO') return commonFailure(lifecyclePolicyRequested, lifecycleCommandsRequested, effectsRequested, noShowRequested, 'TENANT_INACTIVE');

  const scope: AgendaPilotScope = Object.freeze({ tenantId, startedAtUtc: startedAt.date.toISOString() });
  const lifecyclePolicy = lifecyclePolicyRequested
    ? { requested: true, enabled: true, reason: 'ENABLED' as const }
    : disabled(false, 'FLAG_DISABLED');
  const lifecycleCommands = !lifecycleCommandsRequested
    ? disabled(false, 'FLAG_DISABLED')
    : lifecyclePolicy.enabled
      ? { requested: true, enabled: true, reason: 'ENABLED' as const }
      : disabled(true, 'POLICY_REQUIRED');
  const effects = effectsRequested
    ? { requested: true, enabled: true, reason: 'ENABLED' as const }
    : disabled(false, 'FLAG_DISABLED');

  let noShow: AgendaPilotFeatureGate;
  let noShowGraceMinutes: number | undefined;
  if (!noShowRequested) {
    noShow = disabled(false, 'FLAG_DISABLED');
  } else if (!effects.enabled) {
    noShow = disabled(true, 'EFFECTS_REQUIRED');
  } else if (!env.AGENDA_NO_SHOW_GRACE_MINUTES?.trim()) {
    noShow = disabled(true, 'GRACE_PERIOD_MISSING');
  } else {
    const parsed = Number(env.AGENDA_NO_SHOW_GRACE_MINUTES);
    if (!Number.isInteger(parsed) || parsed < MIN_GRACE_MINUTES || parsed > MAX_GRACE_MINUTES) {
      noShow = disabled(true, 'GRACE_PERIOD_INVALID');
    } else {
      noShowGraceMinutes = parsed;
      noShow = { requested: true, enabled: true, reason: 'ENABLED' };
    }
  }

  return { scope, lifecyclePolicy, lifecycleCommands, effects, noShow, noShowGraceMinutes };
}
