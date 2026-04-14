import { obterAtrasoMinimoFollowupHoras } from '../disparo-campanha';

describe('DisparoCampanha - cadência de follow-up', () => {
  it('retorna 2h para primeiro follow-up (apos tentativa 1)', () => {
    expect(obterAtrasoMinimoFollowupHoras(1)).toBe(2);
  });

  it('retorna 24h para segundo follow-up (apos tentativa 2)', () => {
    expect(obterAtrasoMinimoFollowupHoras(2)).toBe(24);
  });

  it('retorna janela em dias (48h) para tentativas posteriores', () => {
    expect(obterAtrasoMinimoFollowupHoras(3)).toBe(48);
    expect(obterAtrasoMinimoFollowupHoras(4)).toBe(48);
  });
});

