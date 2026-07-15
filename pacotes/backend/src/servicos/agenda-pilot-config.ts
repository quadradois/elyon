export type AgendaPilotGateReason =
  | 'FLAG_DISABLED'
  | 'ENABLED'
  | 'TENANT_ID_MISSING'
  | 'TENANT_ID_INVALID'
  | 'EFFECTS_REQUIRED'
  | 'GRACE_PERIOD_MISSING'
  | 'GRACE_PERIOD_INVALID';

export interface AgendaPilotFeatureGate {
  requested: boolean;
  enabled: boolean;
  reason: AgendaPilotGateReason;
}

export interface AgendaPilotConfig {
  tenantIds: readonly string[];
  effects: AgendaPilotFeatureGate;
  noShow: AgendaPilotFeatureGate;
  noShowGraceMinutes?: number;
}

type AgendaPilotEnv = Partial<Record<
  'AGENDA_EFFECTS_ENABLED'
  | 'AGENDA_NO_SHOW_ENABLED'
  | 'AGENDA_PILOT_TENANT_ID'
  | 'AGENDA_NO_SHOW_GRACE_MINUTES', string | undefined>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_GRACE_MINUTES = 1;
const MAX_GRACE_MINUTES = 24 * 60;

function disabled(requested: boolean, reason: AgendaPilotGateReason): AgendaPilotFeatureGate {
  return { requested, enabled: false, reason };
}

export function resolverAgendaPilotConfig(env: AgendaPilotEnv = process.env): AgendaPilotConfig {
  const effectsRequested = env.AGENDA_EFFECTS_ENABLED === 'true';
  const noShowRequested = env.AGENDA_NO_SHOW_ENABLED === 'true';
  const tenantId = env.AGENDA_PILOT_TENANT_ID?.trim();
  const tenantReason: AgendaPilotGateReason | undefined = !tenantId
    ? 'TENANT_ID_MISSING'
    : UUID_PATTERN.test(tenantId) ? undefined : 'TENANT_ID_INVALID';
  const tenantIds = tenantReason ? [] : [tenantId!];

  const effects = !effectsRequested
    ? disabled(false, 'FLAG_DISABLED')
    : tenantReason
      ? disabled(true, tenantReason)
      : { requested: true, enabled: true, reason: 'ENABLED' as const };

  let noShow: AgendaPilotFeatureGate;
  let noShowGraceMinutes: number | undefined;
  if (!noShowRequested) {
    noShow = disabled(false, 'FLAG_DISABLED');
  } else if (!effects.enabled) {
    noShow = disabled(true, 'EFFECTS_REQUIRED');
  } else if (env.AGENDA_NO_SHOW_GRACE_MINUTES === undefined
    || env.AGENDA_NO_SHOW_GRACE_MINUTES.trim() === '') {
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

  return { tenantIds, effects, noShow, noShowGraceMinutes };
}
