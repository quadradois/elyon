export function calcularEsperaCooldownInbound(
  cooldownRestanteMs: number,
  limiteEsperaMs: number,
): number {
  if (!Number.isFinite(cooldownRestanteMs) || cooldownRestanteMs <= 0) return 0;
  if (!Number.isFinite(limiteEsperaMs) || limiteEsperaMs <= 0) return 0;
  return Math.min(Math.ceil(cooldownRestanteMs), Math.ceil(limiteEsperaMs));
}

export async function aguardarCooldownInbound(params: {
  cooldownRestanteMs: number;
  limiteEsperaMs: number;
  esperar?: (ms: number) => Promise<void>;
}): Promise<number> {
  const esperaMs = calcularEsperaCooldownInbound(
    params.cooldownRestanteMs,
    params.limiteEsperaMs,
  );
  if (esperaMs <= 0) return 0;

  const esperar = params.esperar || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  await esperar(esperaMs);
  return esperaMs;
}
