import { avaliarAgendaPolicy, type AgendaPolicyAction, type AgendaPolicyActor } from '../../src/servicos/agenda-policy';

type Scenario = [string, string, AgendaPolicyActor, AgendaPolicyAction, boolean];
const scenarios: Scenario[] = [
  ['FUTURO', 'PENDENTE', 'OPERADOR', 'CANCELAR', true],
  ['FUTURO', 'PENDENTE', 'OPERADOR', 'REAGENDAR', true],
  ['FUTURO', 'PENDENTE', 'OPERADOR', 'PROPOR', true],
  ['FUTURO', 'PENDENTE', 'OPERADOR', 'REALIZAR', false],
  ['FUTURO', 'PENDENTE', 'OPERADOR', 'NAO_COMPARECEU', false],
  ['FUTURO', 'PROPOSTO', 'PUBLICO', 'ACEITAR', true],
  ['FUTURO', 'PROPOSTO', 'PUBLICO', 'CANCELAR', true],
  ['FUTURO', 'PROPOSTO', 'PUBLICO', 'REAGENDAR', false],
  ['FUTURO', 'SOLICITADO', 'PUBLICO', 'ACEITAR', false],
  ['FUTURO', 'SOLICITADO', 'PUBLICO', 'CANCELAR', true],
  ['FUTURO', 'SOLICITADO', 'OPERADOR', 'CONFIRMAR_ATRIBUICAO', true],
  ['FUTURO', 'SOLICITADO', 'OPERADOR', 'RECUSAR', true],
  ['FUTURO', 'CONFIRMADO', 'OPERADOR', 'CANCELAR', true],
  ['FUTURO', 'CONFIRMADO', 'OPERADOR', 'REAGENDAR', true],
  ['FUTURO', 'CONFIRMADO', 'SISTEMA', 'CANCELAR', false],
  ['INICIADO', 'CONFIRMADO', 'OPERADOR', 'CANCELAR', false],
  ['INICIADO', 'CONFIRMADO', 'OPERADOR', 'REAGENDAR', false],
  ['INICIADO', 'CONFIRMADO', 'OPERADOR', 'REALIZAR', true],
  ['INICIADO', 'CONFIRMADO', 'OPERADOR', 'NAO_COMPARECEU', true],
  ['INICIADO', 'CONFIRMADO', 'PUBLICO', 'CANCELAR', false],
  ['INICIADO', 'SOLICITADO', 'SISTEMA', 'NAO_COMPARECEU', true],
  ['INICIADO', 'SOLICITADO', 'SISTEMA', 'REALIZAR', false],
  ['INICIADO', 'PENDENTE', 'ADMIN', 'REALIZAR', true],
  ['INICIADO', 'PENDENTE', 'ADMIN', 'NAO_COMPARECEU', true],
  ['INICIADO', 'PENDENTE', 'ADMIN', 'CORRIGIR', false],
  ['ENCERRADO', 'CONFIRMADO', 'OPERADOR', 'REALIZAR', true],
  ['ENCERRADO', 'CONFIRMADO', 'OPERADOR', 'NAO_COMPARECEU', true],
  ['ENCERRADO', 'CONFIRMADO', 'OPERADOR', 'CANCELAR', false],
  ['ENCERRADO', 'CONFIRMADO', 'OPERADOR', 'REAGENDAR', false],
  ['ENCERRADO', 'CONFIRMADO', 'SISTEMA', 'NAO_COMPARECEU', true],
  ['ENCERRADO', 'CONFIRMADO', 'PUBLICO', 'CANCELAR', false],
  ['ENCERRADO', 'CANCELADO', 'ADMIN', 'CORRIGIR', true],
  ['ENCERRADO', 'REALIZADO', 'ADMIN', 'CORRIGIR', true],
  ['ENCERRADO', 'NAO_COMPARECEU', 'ADMIN', 'CORRIGIR', true],
  ['ENCERRADO', 'SUBSTITUIDO', 'ADMIN', 'CORRIGIR', true],
  ['ENCERRADO', 'CANCELADO', 'OPERADOR', 'CORRIGIR', false],
  ['ENCERRADO', 'REALIZADO', 'OPERADOR', 'REALIZAR', false],
  ['ENCERRADO', 'NAO_COMPARECEU', 'SISTEMA', 'NAO_COMPARECEU', false],
  ['FUTURO', 'CANCELADO', 'ADMIN', 'CORRIGIR', true],
  ['FUTURO', 'CANCELADO', 'PUBLICO', 'CANCELAR', false],
];

describe('matriz holística dos 40 cenários da Agenda', () => {
  it.each(scenarios)('%s × %s × %s × %s => allowed=%s', (phase, status, ator, acao, allowed) => {
    const start = new Date('2026-08-01T10:00:00Z');
    const agora = phase === 'FUTURO' ? new Date('2026-08-01T09:59:59Z')
      : phase === 'INICIADO' ? new Date('2026-08-01T10:30:00Z') : new Date('2026-08-01T11:00:00Z');
    expect(avaliarAgendaPolicy({ status, agendadoPara: start, duracaoMinutos: 60, agora, ator, acao }).allowed).toBe(allowed);
  });

  it('mantém exatamente quarenta cenários rastreáveis', () => {
    expect(scenarios).toHaveLength(40);
  });
});
