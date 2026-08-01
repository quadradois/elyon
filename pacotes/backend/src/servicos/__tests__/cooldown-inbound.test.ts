import {
  aguardarCooldownInbound,
  calcularEsperaCooldownInbound,
} from '../cooldown-inbound';

describe('cooldown de mensagens inbound', () => {
  it('não descarta mensagem: calcula somente a espera restante', () => {
    expect(calcularEsperaCooldownInbound(7_500, 10_000)).toBe(7_500);
  });

  it('limita a espera para não prender o processamento indefinidamente', () => {
    expect(calcularEsperaCooldownInbound(60_000, 10_000)).toBe(10_000);
  });

  it('processa imediatamente quando não existe cooldown', async () => {
    const esperar = jest.fn(async () => undefined);
    const esperaMs = await aguardarCooldownInbound({
      cooldownRestanteMs: 0,
      limiteEsperaMs: 10_000,
      esperar,
    });

    expect(esperaMs).toBe(0);
    expect(esperar).not.toHaveBeenCalled();
  });

  it('aguarda sem converter a mensagem em evento ignorado', async () => {
    const esperar = jest.fn(async () => undefined);
    const esperaMs = await aguardarCooldownInbound({
      cooldownRestanteMs: 8_250,
      limiteEsperaMs: 10_000,
      esperar,
    });

    expect(esperaMs).toBe(8_250);
    expect(esperar).toHaveBeenCalledWith(8_250);
  });
});
