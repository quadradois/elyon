import { Registry } from 'prom-client';
import { createBackupMetrics, parseBackupStatus } from '../backup-metrics';

describe('métricas de backup off-host', () => {
  it('converte o arquivo de status sem aceitar valores inválidos', () => {
    expect(parseBackupStatus([
      'last_run_timestamp=100',
      'last_run_success=1',
      'last_success_timestamp=90',
      'last_duration_seconds=12',
      'last_dump_bytes=2048',
      'last_restore_success_timestamp=80',
      'last_restore_duration_seconds=30',
      'ignored=value',
    ].join('\n'))).toEqual({
      lastRunTimestamp: 100,
      lastRunSuccess: 1,
      lastSuccessTimestamp: 90,
      lastDurationSeconds: 12,
      lastDumpBytes: 2048,
      lastRestoreSuccessTimestamp: 80,
      lastRestoreDurationSeconds: 30,
    });
    expect(parseBackupStatus('last_run_success=2\nlast_dump_bytes=-1').lastRunSuccess).toBe(0);
  });

  it('publica zeros quando o arquivo ainda não existe', async () => {
    process.env.ELYON_BACKUP_STATUS_FILE = '/missing/elyon-backup-status';
    const registry = new Registry();
    const metrics = createBackupMetrics(registry);
    metrics.refresh();

    const exposition = await registry.metrics();
    expect(exposition).toContain('elyon_offhost_backup_last_run_success 0');
    expect(exposition).toContain('elyon_offhost_restore_last_success_timestamp_seconds 0');
    delete process.env.ELYON_BACKUP_STATUS_FILE;
  });
});
