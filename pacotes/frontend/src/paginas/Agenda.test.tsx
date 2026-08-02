import { describe, expect, it } from 'vitest';
import type { EventoAgenda } from '../servicos/apiAgenda';
import { acaoAgendaPermitida, ordenarPendenciasVencidas } from './agenda-actions';

function event(allowedActions: NonNullable<EventoAgenda['extendedProps']>['allowedActions']): EventoAgenda {
  return {
    id: 'atividade-1', title: 'Atendimento', start: new Date(), end: new Date(), allDay: false,
    extendedProps: {
      tipo: 'REUNIAO', status: 'CONFIRMADO', leadId: 'lead-1', leadNome: 'Lead', leadTelefone: '', versao: 1,
      allowedActions,
    },
  };
}

describe('acoes visiveis da Agenda', () => {
  it('mostra cancelar e reagendar quando autorizados pelo servidor', () => {
    const future = event(['CANCELAR', 'REAGENDAR']);
    expect(acaoAgendaPermitida(future, 'CANCELAR')).toBe(true);
    expect(acaoAgendaPermitida(future, 'REAGENDAR')).toBe(true);
  });
  it('nao mostra cancelar ou reagendar depois do inicio', () => {
    const started = event(['REALIZAR', 'NAO_COMPARECEU']);
    expect(acaoAgendaPermitida(started, 'CANCELAR')).toBe(false);
    expect(acaoAgendaPermitida(started, 'REAGENDAR')).toBe(false);
  });
  it('prioriza o vencido mais antigo e mantém ações de desfecho', () => {
    const queue = ordenarPendenciasVencidas([
      { id: 'recente', pendingAgeMinutes: 15, allowedActions: ['REALIZAR'] },
      { id: 'antigo', pendingAgeMinutes: 120, allowedActions: ['REALIZAR', 'NAO_COMPARECEU'] },
    ]);
    expect(queue[0]).toMatchObject({ id: 'antigo', allowedActions: ['REALIZAR', 'NAO_COMPARECEU'] });
  });
});
