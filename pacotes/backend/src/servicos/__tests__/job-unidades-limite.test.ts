import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Redis em memoria: o job guarda e le o proprio estado por aqui.
const store = new Map<string, string>();
const redisFake = {
  set: jest.fn<any>(async (chave: string, valor: string) => {
    store.set(chave, valor);
    return 'OK';
  }),
  get: jest.fn<any>(async (chave: string) => store.get(chave) ?? null)
};

jest.mock('../../lib/redis', () => ({
  getRedisClient: jest.fn<any>(async () => redisFake)
}));

const count = jest.fn<any>();
const findMany = jest.fn<any>();

jest.mock('../../lib/db', () => ({
  prisma: {
    imovel: {
      count: (...args: unknown[]) => count(...args),
      findMany: (...args: unknown[]) => findMany(...args)
    }
  }
}));

jest.mock('../mapa', () => ({
  mapaService: {
    buscarUnidadesPorEdificio: jest.fn<any>(),
    buscarUnidadesPorLoteGeo360: jest.fn<any>()
  }
}));

jest.mock('../../lib/log-context', () => ({
  runWithJobLogContext: (_id: string, fn: () => Promise<void>) => fn()
}));

import { criarJobUnidades, obterStatusJobUnidades } from '../job-unidades';

async function jobFinalizado(jobId: string) {
  for (let i = 0; i < 50; i++) {
    const job = await obterStatusJobUnidades(jobId);
    if (job && (job.status === 'concluido' || job.status === 'erro')) return job;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('job nao finalizou');
}

describe('job de unidades — teto de seguranca', () => {
  beforeEach(() => {
    store.clear();
    count.mockReset();
    findMany.mockReset();
  });

  // O cruzamento por NOME usa startsWith sobre texto livre: "s a" casaria todo
  // bairro iniciado por "s". Sem teto, o loop pagina ate esgotar a base.
  it('recusa selecao ampla demais antes de varrer a base', async () => {
    count.mockResolvedValue(250000);

    const jobId = await criarJobUnidades(1, 'condominio', 's a');
    const job = await jobFinalizado(jobId);

    expect(job.status).toBe('erro');
    expect(job.mensagem).toContain('ampla demais');
    expect(job.total).toBe(250000);
    // O que protege o servidor: nenhuma pagina foi buscada.
    expect(findMany).not.toHaveBeenCalled();
  });

  it('processa normalmente um condominio de tamanho real', async () => {
    count.mockResolvedValue(189);
    findMany.mockResolvedValue([
      {
        inscricaoIptu: '33700113880010',
        nomeEdificio: 'CONDOMÍNIO RESERVA SAN MARINO',
        complemento: 'CASA 01',
        logradouro: 'R 2',
        bairro: 'CH ANHANGÜERA',
        areaEdificada: 92.77,
        areaTerreno: null,
        quadra: null,
        lote: null
      }
    ]);

    const jobId = await criarJobUnidades(1, 'condominio', 'RESERVA SAN MARINO');
    const job = await jobFinalizado(jobId);

    expect(job.status).toBe('concluido');
    expect(findMany).toHaveBeenCalled();
    expect(job.unidades.length).toBeGreaterThan(0);
  });
});
