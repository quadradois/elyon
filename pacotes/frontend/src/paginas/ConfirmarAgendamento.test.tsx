import { describe, expect, it } from 'vitest';
import { acaoPublicaPermitida, mensagemRejeicaoPublica } from './confirmar-agendamento-policy';

describe('contrato do link público da Agenda', () => {
  it('respeita as ações fornecidas pela visão canônica', () => {
    expect(acaoPublicaPermitida(['ACEITAR', 'CANCELAR'], 'ACEITAR')).toBe(true);
    expect(acaoPublicaPermitida([], 'CANCELAR')).toBe(false);
  });

  it('explica rejeição temporal e conflito de versão', () => {
    expect(mensagemRejeicaoPublica('APPOINTMENT_STARTED')).toContain('já iniciou');
    expect(mensagemRejeicaoPublica('STALE_EVENT')).toContain('Recarregue');
  });
});
