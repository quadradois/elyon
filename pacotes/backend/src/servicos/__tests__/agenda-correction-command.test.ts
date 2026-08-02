import { randomUUID } from 'node:crypto';
import { AGENDA_COMMERCIAL_POLICY_VERSION, sanitizarJustificativaAgenda, validarComandoAgenda, type AgendaCommand } from '../coerencia-agenda-estado';
import { avaliarAgendaPolicy } from '../agenda-policy';

function correction(justificativa: string): AgendaCommand {
  return {
    operacao: 'CORRIGIR', tenantId: randomUUID(), leadId: randomUUID(), atividadeId: randomUUID(),
    requestIdentity: { source: 'MANUAL_API', id: randomUUID() }, ator: 'admin:test', origem: 'TESTE',
    motivo: 'Correção administrativa', policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
    ocorridoEm: new Date(), expectedVersion: 1, estadoCorrigido: 'REALIZADO', justificativa,
  };
}

describe('correção administrativa compensatória', () => {
  it('exige justificativa substantiva', () => {
    expect(validarComandoAgenda(correction('curta'))).toBe('JUSTIFICATION_REQUIRED');
    expect(validarComandoAgenda(correction('Correção validada pelo supervisor'))).toBeNull();
  });

  it('remove controles e delimitadores de marcação antes de auditar', () => {
    expect(sanitizarJustificativaAgenda('<script>ajuste\u0000 autorizado</script>')).toBe('scriptajuste autorizado/script');
  });

  it('é autorizada somente para administrador em estado terminal', () => {
    const base = {
      status: 'NAO_COMPARECEU', agendadoPara: new Date('2026-08-01T10:00:00Z'),
      agora: new Date('2026-08-01T12:00:00Z'), duracaoMinutos: 60, acao: 'CORRIGIR' as const,
    };
    expect(avaliarAgendaPolicy({ ...base, ator: 'ADMIN' })).toMatchObject({ allowed: true });
    expect(avaliarAgendaPolicy({ ...base, ator: 'OPERADOR' })).toMatchObject({ allowed: false });
  });
});
