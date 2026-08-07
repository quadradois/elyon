import {
  calcularPrazoConfirmacaoCorretor,
  obterAntecedenciaLembreteCorretorMinutos,
  obterPrazoConfirmacaoCorretorMinutos,
} from '../prazo-confirmacao-corretor';

describe('prazo de confirmação do especialista', () => {
  const envOriginal = process.env;

  beforeEach(() => {
    process.env = { ...envOriginal };
    delete process.env.CORRETOR_CONFIRMACAO_PRAZO_MINUTOS;
    delete process.env.CORRETOR_CONFIRMACAO_LEMBRETE_ANTECEDENCIA_MINUTOS;
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it('vence uma hora depois do envio do convite, independentemente da data da reunião', () => {
    expect(calcularPrazoConfirmacaoCorretor({
      confirmacaoCorretorSolicitadaEm: new Date('2026-08-02T12:00:00Z'),
      agendadoPara: new Date('2026-08-03T12:00:00Z'),
    })?.toISOString()).toBe('2026-08-02T13:00:00.000Z');
  });

  it('nunca permite confirmação depois do início da reunião', () => {
    expect(calcularPrazoConfirmacaoCorretor({
      confirmacaoCorretorSolicitadaEm: new Date('2026-08-02T12:00:00Z'),
      agendadoPara: new Date('2026-08-02T12:30:00Z'),
    })?.toISOString()).toBe('2026-08-02T12:30:00.000Z');
  });

  it('usa SLA de 60 minutos e lembrete 15 minutos antes por padrão', () => {
    expect(obterPrazoConfirmacaoCorretorMinutos()).toBe(60);
    expect(obterAntecedenciaLembreteCorretorMinutos()).toBe(15);
  });
});
