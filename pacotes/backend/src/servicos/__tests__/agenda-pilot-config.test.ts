import { resolverAgendaPilotConfig } from '../agenda-pilot-config';

const TENANT = '7fa1c55e-3148-4d6c-ae6e-9547374f6e09';

describe('agenda pilot tenant-safe config', () => {
  it('mantem ambos os recursos desabilitados por default', () => {
    expect(resolverAgendaPilotConfig({})).toEqual({
      tenantIds: [],
      effects: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
      noShow: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
      noShowGraceMinutes: undefined,
    });
  });

  it.each([undefined, '', 'tenant-autoafirmado', `${TENANT},${TENANT}`])(
    'recusa ativacao sem um unico UUID confiavel (%s)',
    (tenantId) => {
      const config = resolverAgendaPilotConfig({
        AGENDA_EFFECTS_ENABLED: 'true',
        AGENDA_PILOT_TENANT_ID: tenantId,
      });
      expect(config.effects.enabled).toBe(false);
      expect(config.effects.reason).toMatch(/^TENANT_ID_/);
      expect(config.tenantIds).toEqual([]);
    },
  );

  it('habilita efeitos somente para o tenant explicitamente configurado', () => {
    expect(resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true',
      AGENDA_PILOT_TENANT_ID: TENANT,
    })).toMatchObject({
      tenantIds: [TENANT],
      effects: { requested: true, enabled: true, reason: 'ENABLED' },
      noShow: { requested: false, enabled: false, reason: 'FLAG_DISABLED' },
    });
  });

  it('recusa no-show antes dos efeitos e sem grace period explicito', () => {
    expect(resolverAgendaPilotConfig({
      AGENDA_NO_SHOW_ENABLED: 'true',
      AGENDA_PILOT_TENANT_ID: TENANT,
      AGENDA_NO_SHOW_GRACE_MINUTES: '30',
    }).noShow.reason).toBe('EFFECTS_REQUIRED');

    expect(resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true',
      AGENDA_NO_SHOW_ENABLED: 'true',
      AGENDA_PILOT_TENANT_ID: TENANT,
    }).noShow.reason).toBe('GRACE_PERIOD_MISSING');
  });

  it.each(['0', '1.5', 'NaN', '1441'])(
    'recusa grace period invalido (%s)',
    (grace) => {
      const config = resolverAgendaPilotConfig({
        AGENDA_EFFECTS_ENABLED: 'true',
        AGENDA_NO_SHOW_ENABLED: 'true',
        AGENDA_PILOT_TENANT_ID: TENANT,
        AGENDA_NO_SHOW_GRACE_MINUTES: grace,
      });
      expect(config.noShow).toMatchObject({ enabled: false, reason: 'GRACE_PERIOD_INVALID' });
    },
  );

  it('habilita no-show apenas na segunda etapa com grace period explicito', () => {
    expect(resolverAgendaPilotConfig({
      AGENDA_EFFECTS_ENABLED: 'true',
      AGENDA_NO_SHOW_ENABLED: 'true',
      AGENDA_PILOT_TENANT_ID: TENANT,
      AGENDA_NO_SHOW_GRACE_MINUTES: '45',
    })).toEqual({
      tenantIds: [TENANT],
      effects: { requested: true, enabled: true, reason: 'ENABLED' },
      noShow: { requested: true, enabled: true, reason: 'ENABLED' },
      noShowGraceMinutes: 45,
    });
  });
});
