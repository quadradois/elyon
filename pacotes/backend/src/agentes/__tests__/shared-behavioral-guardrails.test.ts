import { getSharedBehavioralRules } from '../shared-behavioral-guardrails';

describe('getSharedBehavioralRules', () => {
  it('retorna string markdown não vazia com regras universais', () => {
    const rules = getSharedBehavioralRules();

    expect(typeof rules).toBe('string');
    expect(rules.length).toBeGreaterThan(100);
    expect(rules).toContain('REGRAS UNIVERSAIS');
  });

  it('inclui seções críticas de handoff invisível e resposta obrigatória', () => {
    const rules = getSharedBehavioralRules();

    expect(rules).toContain('HANDOFF INVISÍVEL');
    expect(rules).toContain('RESPOSTA OBRIGATÓRIA A PERGUNTAS DIRETAS');
    expect(rules).toContain('ESPELHAMENTO DE LINGUAGEM');
  });
});
