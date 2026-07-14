import * as fs from 'fs';
import { Gauge, Registry } from 'prom-client';

export interface BackupStatus {
  lastRunTimestamp: number;
  lastRunSuccess: number;
  lastSuccessTimestamp: number;
  lastDurationSeconds: number;
  lastDumpBytes: number;
  lastRestoreSuccessTimestamp: number;
  lastRestoreDurationSeconds: number;
}

const defaults: BackupStatus = {
  lastRunTimestamp: 0,
  lastRunSuccess: 0,
  lastSuccessTimestamp: 0,
  lastDurationSeconds: 0,
  lastDumpBytes: 0,
  lastRestoreSuccessTimestamp: 0,
  lastRestoreDurationSeconds: 0,
};

function numberValue(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseBackupStatus(content: string): BackupStatus {
  const values = Object.fromEntries(content.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf('=');
    return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1)]] : [];
  }));
  return {
    lastRunTimestamp: numberValue(values.last_run_timestamp),
    lastRunSuccess: numberValue(values.last_run_success) === 1 ? 1 : 0,
    lastSuccessTimestamp: numberValue(values.last_success_timestamp),
    lastDurationSeconds: numberValue(values.last_duration_seconds),
    lastDumpBytes: numberValue(values.last_dump_bytes),
    lastRestoreSuccessTimestamp: numberValue(values.last_restore_success_timestamp),
    lastRestoreDurationSeconds: numberValue(values.last_restore_duration_seconds),
  };
}

export function createBackupMetrics(registry: Registry): { refresh: () => void } {
  const gauges = {
    lastRunTimestamp: new Gauge({
      name: 'elyon_offhost_backup_last_run_timestamp_seconds',
      help: 'Unix timestamp da última tentativa de backup off-host.',
      registers: [registry],
    }),
    lastRunSuccess: new Gauge({
      name: 'elyon_offhost_backup_last_run_success',
      help: 'Resultado da última tentativa de backup off-host: 1 sucesso, 0 falha ou ausente.',
      registers: [registry],
    }),
    lastSuccessTimestamp: new Gauge({
      name: 'elyon_offhost_backup_last_success_timestamp_seconds',
      help: 'Unix timestamp do último backup off-host concluído.',
      registers: [registry],
    }),
    lastDurationSeconds: new Gauge({
      name: 'elyon_offhost_backup_last_duration_seconds',
      help: 'Duração da última tentativa de backup off-host.',
      registers: [registry],
    }),
    lastDumpBytes: new Gauge({
      name: 'elyon_offhost_backup_last_dump_bytes',
      help: 'Tamanho comprimido do último dump enviado ao destino off-host.',
      registers: [registry],
    }),
    lastRestoreSuccessTimestamp: new Gauge({
      name: 'elyon_offhost_restore_last_success_timestamp_seconds',
      help: 'Unix timestamp do último restore drill aprovado.',
      registers: [registry],
    }),
    lastRestoreDurationSeconds: new Gauge({
      name: 'elyon_offhost_restore_last_duration_seconds',
      help: 'Duração do último restore drill aprovado.',
      registers: [registry],
    }),
  };

  return {
    refresh: () => {
      const statusPath = process.env.ELYON_BACKUP_STATUS_FILE
        || '/var/lib/elyon-backup/offhost.env';
      let status = defaults;
      try {
        status = parseBackupStatus(fs.readFileSync(statusPath, 'utf8'));
      } catch {
        // Ausência também é um sinal: os gauges permanecem em zero e disparam alerta.
      }
      for (const [key, gauge] of Object.entries(gauges)) {
        gauge.set(status[key as keyof BackupStatus]);
      }
    },
  };
}
