const mockConvites = jest.fn();
const mockLembretes = jest.fn();
const mockCutoff = jest.fn();

jest.mock('../../jobs/job-confirmacao-corretor', () => ({
  executarConvitesConfirmacaoCorretor: (...args: any[]) => mockConvites(...args),
  executarLembretesConfirmacaoCorretor: (...args: any[]) => mockLembretes(...args),
  executarCutoffRemanejamentoCorretor: (...args: any[]) => mockCutoff(...args),
}));
jest.mock('../../lib/log-context', () => ({
  runWithJobLogContext: (_nome: string, callback: () => Promise<unknown>) => callback(),
}));

import { SchedulerConfirmacaoCorretor } from '../scheduler-confirmacao-corretor';

describe('SchedulerConfirmacaoCorretor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConvites.mockResolvedValue({ processados: 0, enviados: 0, erros: 0 });
    mockLembretes.mockResolvedValue({ processados: 0, enviados: 0, erros: 0 });
    mockCutoff.mockResolvedValue({ processados: 0, remanejados: 0, expirados: 0, erros: 0 });
  });

  it('executa convite, lembrete e cutoff em ordem', async () => {
    const scheduler = new SchedulerConfirmacaoCorretor();

    await scheduler.executarCiclo();

    expect(mockConvites).toHaveBeenCalledTimes(1);
    expect(mockLembretes).toHaveBeenCalledTimes(1);
    expect(mockCutoff).toHaveBeenCalledTimes(1);
    expect(mockConvites.mock.invocationCallOrder[0]).toBeLessThan(mockLembretes.mock.invocationCallOrder[0]);
    expect(mockLembretes.mock.invocationCallOrder[0]).toBeLessThan(mockCutoff.mock.invocationCallOrder[0]);
  });

  it('não sobrepõe ciclos ainda em execução', async () => {
    let liberar!: () => void;
    mockConvites.mockImplementation(() => new Promise<void>((resolve) => { liberar = resolve; }));
    const scheduler = new SchedulerConfirmacaoCorretor();

    const primeiro = scheduler.executarCiclo();
    const segundo = scheduler.executarCiclo();
    await segundo;
    expect(mockConvites).toHaveBeenCalledTimes(1);

    liberar();
    await primeiro;
  });
});
