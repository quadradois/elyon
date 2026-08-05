import { describe, expect, it } from 'vitest';
import type { EventoAgenda } from '../servicos/apiAgenda';
import {
  acaoAgendaPermitida,
  corEventoPorStatus,
  descricaoEstadoDrawerAgenda,
  obterEstadoDrawerAgenda,
  ordenarPendenciasVencidas,
  pendenciaPermiteAcao,
  rotuloStatusAgenda,
} from './agenda-actions';

function event(
  allowedActions: NonNullable<EventoAgenda['extendedProps']>['allowedActions'],
  status = 'CONFIRMADO',
  faseTemporal: NonNullable<EventoAgenda['extendedProps']>['faseTemporal'] = 'FUTURO',
): EventoAgenda {
  return {
    id: 'atividade-1', title: 'Atendimento', start: new Date(), end: new Date(), allDay: false,
    extendedProps: {
      tipo: 'REUNIAO', status, leadId: 'lead-1', leadNome: 'Lead', leadTelefone: '', versao: 1,
      allowedActions, faseTemporal,
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
    expect(pendenciaPermiteAcao(queue[0] as { allowedActions: Array<'REALIZAR' | 'NAO_COMPARECEU'> }, 'REALIZAR')).toBe(true);
    expect(pendenciaPermiteAcao(queue[0] as { allowedActions: Array<'REALIZAR' | 'NAO_COMPARECEU'> }, 'NAO_COMPARECEU')).toBe(true);
  });
  it('orienta o drawer pelo ciclo de vida em vez de exibir todos os formulários', () => {
    expect(obterEstadoDrawerAgenda(event(['CANCELAR', 'REAGENDAR']))).toBe('FUTURO');
    expect(obterEstadoDrawerAgenda(event(['REALIZAR', 'NAO_COMPARECEU'], 'CONFIRMADO', 'ENCERRADO')))
      .toBe('VENCIDO_SEM_DESFECHO');
    expect(obterEstadoDrawerAgenda(event(['CORRIGIR'], 'NAO_COMPARECEU', 'ENCERRADO'))).toBe('CONCLUIDO');
    expect(obterEstadoDrawerAgenda(event([], 'CANCELADO', 'ENCERRADO'))).toBe('CANCELADO');
  });
  it('traduz status técnicos e usa cor semântica para ausência', () => {
    const noShow = event(['CORRIGIR'], 'NAO_COMPARECEU', 'ENCERRADO');
    expect(rotuloStatusAgenda('NAO_COMPARECEU')).toBe('Não compareceu');
    expect(corEventoPorStatus(noShow)).toBe('#be123c');
    expect(descricaoEstadoDrawerAgenda('CONCLUIDO')).toContain('resultado registrado');
  });
});
