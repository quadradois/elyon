import { paraEstadoCanonico, paraEstadoPersistido } from '../agenda-state-compat';

describe('compatibilidade de estados da Agenda', () => {
  it('interpreta PENDENTE legado como SOLICITADO canonico', () => {
    expect(paraEstadoCanonico('PENDENTE')).toBe('SOLICITADO');
  });
  it('preserva estados canonicos novos e terminais', () => {
    expect(paraEstadoCanonico('SOLICITADO')).toBe('SOLICITADO');
    expect(paraEstadoCanonico('CONFIRMADO')).toBe('CONFIRMADO');
    expect(paraEstadoCanonico('REALIZADO')).toBe('REALIZADO');
  });
  it('traduz SOLICITADO para PENDENTE somente para escritor legado', () => {
    expect(paraEstadoPersistido('SOLICITADO', { escritorLegado: true })).toBe('PENDENTE');
    expect(paraEstadoPersistido('SOLICITADO', { escritorLegado: false })).toBe('SOLICITADO');
  });
  it('falha fechado para estado desconhecido', () => {
    expect(() => paraEstadoCanonico('INVENTADO')).toThrow('AGENDA_STATE_UNKNOWN');
  });
});
