function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function isAgentCockpitEnabled(): boolean {
  return parseFlag(process.env.AGENT_COCKPIT_ENABLED, true);
}

export function isLearningBankEnabled(): boolean {
  return parseFlag(process.env.LEARNING_BANK_ENABLED, false);
}

export function isTemporalFactsEnabled(): boolean {
  return parseFlag(process.env.TEMPORAL_FACTS_ENABLED, false);
}

export function isPaolShadowEnabled(): boolean {
  return parseFlag(process.env.PAOL_SHADOW_ENABLED, false);
}

export function isPaolAbEnabled(): boolean {
  return parseFlag(process.env.PAOL_AB_ENABLED, false);
}

export function isMcpServerEnabled(): boolean {
  return parseFlag(process.env.MCP_SERVER_ENABLED, false);
}

export function isExperienceReplayEnabled(): boolean {
  return parseFlag(process.env.EXPERIENCE_REPLAY_ENABLED, false);
}

export function getPaolAbTrafficPercent(): number {
  const raw = Number(process.env.PAOL_AB_TRAFFIC_PERCENT ?? '10');
  if (!Number.isFinite(raw)) return 10;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function getPaolEmaAlpha(): number {
  const raw = Number(process.env.PAOL_EMA_ALPHA ?? '0.2');
  if (!Number.isFinite(raw)) return 0.2;
  return Math.min(1, Math.max(0.01, raw));
}

export function getPaolExplorationBonus(): number {
  const raw = Number(process.env.PAOL_EXPLORATION_BONUS ?? '0.05');
  if (!Number.isFinite(raw)) return 0.05;
  return Math.min(0.5, Math.max(0, raw));
}

export function listarFlagsAgente() {
  return {
    agent_cockpit_enabled: isAgentCockpitEnabled(),
    learning_bank_enabled: isLearningBankEnabled(),
    temporal_facts_enabled: isTemporalFactsEnabled(),
    paol_shadow_enabled: isPaolShadowEnabled(),
    paol_ab_enabled: isPaolAbEnabled(),
    mcp_server_enabled: isMcpServerEnabled(),
    experience_replay_enabled: isExperienceReplayEnabled(),
    paol_ab_traffic_percent: getPaolAbTrafficPercent(),
    paol_ema_alpha: getPaolEmaAlpha(),
    paol_exploration_bonus: getPaolExplorationBonus(),
  };
}
