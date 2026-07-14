export interface ResultadoOperacao {
  sucesso: boolean;
  status?: number;
  bytes?: number;
}

export interface ResultadoCenario {
  nome: string;
  duracaoSegundos: number;
  concorrencia: number;
  requisicoes: number;
  sucessos: number;
  erros: number;
  taxaErro: number;
  throughputPorSegundo: number;
  latenciaMs: { p50: number; p95: number; p99: number; max: number };
  bytesRecebidos: number;
  status: Record<string, number>;
}

function arredondar(valor: number, casas = 2): number {
  return Number(valor.toFixed(casas));
}

export function percentil(valores: number[], quantil: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(quantil * ordenados.length) - 1));
  return ordenados[indice];
}

async function executarJanela(
  operacao: (sequencia: number) => Promise<ResultadoOperacao>,
  duracaoMs: number,
  concorrencia: number,
  coletar: boolean,
): Promise<{ resultados: ResultadoOperacao[]; latencias: number[]; duracaoMs: number }> {
  const resultados: ResultadoOperacao[] = [];
  const latencias: number[] = [];
  const inicio = performance.now();
  const fim = inicio + duracaoMs;
  let sequencia = 0;

  await Promise.all(Array.from({ length: concorrencia }, async () => {
    while (performance.now() < fim) {
      const atual = sequencia++;
      const inicioOperacao = performance.now();
      try {
        const resultado = await operacao(atual);
        if (coletar) resultados.push(resultado);
      } catch {
        if (coletar) resultados.push({ sucesso: false });
      } finally {
        if (coletar) latencias.push(performance.now() - inicioOperacao);
      }
    }
  }));

  return { resultados, latencias, duracaoMs: performance.now() - inicio };
}

export async function executarCenario(params: {
  nome: string;
  duracaoMs: number;
  aquecimentoMs?: number;
  concorrencia: number;
  operacao: (sequencia: number) => Promise<ResultadoOperacao>;
}): Promise<ResultadoCenario> {
  if (params.concorrencia < 1 || params.duracaoMs < 100) throw new Error('Configuração de carga inválida');
  if ((params.aquecimentoMs || 0) > 0) {
    await executarJanela(params.operacao, params.aquecimentoMs!, params.concorrencia, false);
  }
  const janela = await executarJanela(params.operacao, params.duracaoMs, params.concorrencia, true);
  const sucessos = janela.resultados.filter((resultado) => resultado.sucesso).length;
  const erros = janela.resultados.length - sucessos;
  const status = janela.resultados.reduce<Record<string, number>>((acc, resultado) => {
    const chave = String(resultado.status ?? (resultado.sucesso ? 'ok' : 'erro'));
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, {});

  return {
    nome: params.nome,
    duracaoSegundos: arredondar(janela.duracaoMs / 1000),
    concorrencia: params.concorrencia,
    requisicoes: janela.resultados.length,
    sucessos,
    erros,
    taxaErro: arredondar(janela.resultados.length ? erros / janela.resultados.length : 0, 4),
    throughputPorSegundo: arredondar(janela.resultados.length / (janela.duracaoMs / 1000)),
    latenciaMs: {
      p50: arredondar(percentil(janela.latencias, 0.5)),
      p95: arredondar(percentil(janela.latencias, 0.95)),
      p99: arredondar(percentil(janela.latencias, 0.99)),
      max: arredondar(janela.latencias.reduce((maior, valor) => Math.max(maior, valor), 0)),
    },
    bytesRecebidos: janela.resultados.reduce((total, resultado) => total + (resultado.bytes || 0), 0),
    status,
  };
}
