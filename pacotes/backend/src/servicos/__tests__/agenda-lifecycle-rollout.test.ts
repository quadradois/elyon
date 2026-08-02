import { avaliarAgendaLifecycleRollout } from '../agenda-lifecycle-rollout';
import type { AgendaPilotConfig } from '../agenda-pilot-config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const CUTOFF = '2026-08-02T12:00:00.000Z';

function config(policy: boolean, commands: boolean): AgendaPilotConfig {
  return {
    scope: { tenantId: TENANT, startedAtUtc: CUTOFF },
    lifecyclePolicy: { requested: policy, enabled: policy, reason: policy ? 'ENABLED' : 'FLAG_DISABLED' },
    lifecycleCommands: { requested: commands, enabled: commands, reason: commands ? 'ENABLED' : 'FLAG_DISABLED' },
    effects: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
    noShow: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
  };
}

describe('Agenda lifecycle rollout', () => {
  it('habilita somente a politica na Onda 0', () => {
    expect(avaliarAgendaLifecycleRollout(config(true, false), TENANT, new Date(CUTOFF))).toEqual({
      policyEnabled: true,
      commandsEnabled: false,
      policyReason: 'ENABLED',
      commandsReason: 'FLAG_DISABLED',
    });
  });

  it('habilita os comandos somente na Onda 1', () => {
    expect(avaliarAgendaLifecycleRollout(config(true, true), TENANT, new Date(CUTOFF))).toMatchObject({
      policyEnabled: true,
      commandsEnabled: true,
    });
  });

  it('mantem outro tenant fora do piloto', () => {
    expect(avaliarAgendaLifecycleRollout(config(true, true), OTHER_TENANT, new Date(CUTOFF))).toEqual({
      policyEnabled: false,
      commandsEnabled: false,
      policyReason: 'TENANT_OUT_OF_SCOPE',
      commandsReason: 'TENANT_OUT_OF_SCOPE',
    });
  });

  it('nao ativa antes do corte aprovado', () => {
    expect(avaliarAgendaLifecycleRollout(
      config(true, true), TENANT, new Date('2026-08-02T11:59:59.999Z'),
    )).toMatchObject({
      policyEnabled: false,
      commandsEnabled: false,
      policyReason: 'BEFORE_CUTOFF',
    });
  });

  it('falha fechado sem escopo valido', () => {
    const withoutScope = { ...config(true, true), scope: undefined };
    expect(avaliarAgendaLifecycleRollout(withoutScope, TENANT, new Date(CUTOFF))).toMatchObject({
      policyEnabled: false,
      commandsEnabled: false,
      policyReason: 'SCOPE_UNAVAILABLE',
      commandsReason: 'SCOPE_UNAVAILABLE',
    });
  });

  it('injeta as flags no backend e no worker do Compose', () => {
    const compose = readFileSync(resolve(process.cwd(), '../../docker-compose.yml'), 'utf8');
    for (const key of [
      'AGENDA_LIFECYCLE_POLICY_ENABLED',
      'AGENDA_LIFECYCLE_COMMANDS_ENABLED',
      'AGENDA_PILOT_TENANT_ID',
      'AGENDA_PILOT_STARTED_AT',
    ]) {
      expect(compose.match(new RegExp(`^\\s+${key}:`, 'gm'))).toHaveLength(2);
    }
  });
});
