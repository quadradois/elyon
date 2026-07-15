import { resolverAgendaPilotConfig } from '../agenda-pilot-config';

const TENANT = '7fa1c55e-3148-4d6c-ae6e-9547374f6e09';
const STARTED_AT = '2027-02-10T12:00:00Z';
const activeTenant = { findTenant: jest.fn(async () => ({ status: 'ATIVO' })) };

describe('agenda pilot tenant-safe config', () => {
  beforeEach(() => activeTenant.findTenant.mockClear());

  it('mantem ambos os recursos desabilitados por default sem consultar tenant', async () => {
    expect(await resolverAgendaPilotConfig({}, activeTenant)).toEqual({
      effects: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
      noShow: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
    });
    expect(activeTenant.findTenant).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'tenant-autoafirmado', `${TENANT},${TENANT}`])(
    'recusa antes do SQL quando nao ha exatamente um UUID (%s)',
    async (tenantId) => {
      const config = await resolverAgendaPilotConfig({
        AGENDA_EFFECTS_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: tenantId, AGENDA_PILOT_STARTED_AT: STARTED_AT,
      }, activeTenant);
      expect(config.effects.enabled).toBe(false);
      expect(config.effects.reason).toMatch(/^TENANT_ID_/);
      expect(config.scope).toBeUndefined();
      expect(activeTenant.findTenant).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, '', '2027-02-10', '2027-02-10T12:00:00-03:00', '2027-02-30T12:00:00Z'])(
    'exige cutoff UTC ISO-8601 valido (%s)',
    async (startedAt) => {
      const config = await resolverAgendaPilotConfig({
        AGENDA_EFFECTS_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: TENANT, AGENDA_PILOT_STARTED_AT: startedAt,
      }, activeTenant);
      expect(config.effects.reason).toMatch(/^STARTED_AT_/);
      expect(config.scope).toBeUndefined();
      expect(activeTenant.findTenant).not.toHaveBeenCalled();
    },
  );

  it('recusa tenant inexistente com reason code especifico', async () => {
    const config = await resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true', AGENDA_NO_SHOW_ENABLED: 'true',
      AGENDA_PILOT_TENANT_ID: TENANT, AGENDA_PILOT_STARTED_AT: STARTED_AT,
    }, { findTenant: async () => null });
    expect(config.effects.reason).toBe('TENANT_NOT_FOUND');
    expect(config.noShow.reason).toBe('TENANT_NOT_FOUND');
    expect(config.scope).toBeUndefined();
  });

  it('recusa tenant inativo com reason code especifico', async () => {
    const config = await resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: TENANT, AGENDA_PILOT_STARTED_AT: STARTED_AT,
    }, { findTenant: async () => ({ status: 'SUSPENSO' }) });
    expect(config.effects.reason).toBe('TENANT_INACTIVE');
    expect(config.scope).toBeUndefined();
  });

  it('habilita efeitos com scope singular autorizado e cutoff imutavel', async () => {
    const env = {
      AGENDA_EFFECTS_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: TENANT, AGENDA_PILOT_STARTED_AT: STARTED_AT,
    };
    const first = await resolverAgendaPilotConfig(env, activeTenant);
    const restarted = await resolverAgendaPilotConfig(env, activeTenant);
    expect(first).toMatchObject({
      scope: { tenantId: TENANT, startedAtUtc: new Date(STARTED_AT).toISOString() },
      effects: { requested: true, enabled: true, reason: 'ENABLED' },
    });
    expect(restarted.scope?.startedAtUtc).toBe(first.scope?.startedAtUtc);
  });

  it('recusa no-show antes dos efeitos e sem grace period explicito', async () => {
    expect((await resolverAgendaPilotConfig({
      AGENDA_NO_SHOW_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: TENANT,
      AGENDA_PILOT_STARTED_AT: STARTED_AT, AGENDA_NO_SHOW_GRACE_MINUTES: '30',
    }, activeTenant)).noShow.reason).toBe('EFFECTS_REQUIRED');

    expect((await resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true', AGENDA_NO_SHOW_ENABLED: 'true',
      AGENDA_PILOT_TENANT_ID: TENANT, AGENDA_PILOT_STARTED_AT: STARTED_AT,
    }, activeTenant)).noShow.reason).toBe('GRACE_PERIOD_MISSING');
  });

  it.each(['0', '1.5', 'NaN', '1441'])('recusa grace period invalido (%s)', async (grace) => {
    const config = await resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true', AGENDA_NO_SHOW_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: TENANT,
      AGENDA_PILOT_STARTED_AT: STARTED_AT, AGENDA_NO_SHOW_GRACE_MINUTES: grace,
    }, activeTenant);
    expect(config.noShow).toMatchObject({ enabled: false, reason: 'GRACE_PERIOD_INVALID' });
  });

  it('habilita no-show apenas na segunda etapa com grace period explicito', async () => {
    expect(await resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true', AGENDA_NO_SHOW_ENABLED: 'true', AGENDA_PILOT_TENANT_ID: TENANT,
      AGENDA_PILOT_STARTED_AT: STARTED_AT, AGENDA_NO_SHOW_GRACE_MINUTES: '45',
    }, activeTenant)).toEqual({
      scope: { tenantId: TENANT, startedAtUtc: new Date(STARTED_AT).toISOString() },
      effects: { requested: true, enabled: true, reason: 'ENABLED' },
      noShow: { requested: true, enabled: true, reason: 'ENABLED' },
      noShowGraceMinutes: 45,
    });
  });
});
