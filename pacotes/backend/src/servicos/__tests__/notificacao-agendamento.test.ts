const mockPrisma = {
  sessaoWhatsapp: { findFirst: jest.fn() },
  mensagemProspeccao: { create: jest.fn() },
};
const mockEnviarMensagemTexto = jest.fn();

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../whatsapp', () => ({
  getWhatsAppService: () => ({ enviarMensagemTexto: mockEnviarMensagemTexto }),
}));

import {
  enviarWhatsappAgendamento,
  formatarDataHoraAgenda,
  montarMensagemLigacaoConfirmada,
  montarMensagemSolicitacaoLigacao,
} from '../notificacao-agendamento';

describe('mensagens de agendamento por ligação', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.sessaoWhatsapp.findFirst.mockResolvedValue({ instanceName: 'elyon_tenant' });
    mockPrisma.mensagemProspeccao.create.mockResolvedValue({ id: 'mensagem-1' });
    mockEnviarMensagemTexto.mockResolvedValue({ key: { id: 'wa-123' } });
  });

  it('registra solicitação sem afirmar confirmação antecipada', () => {
    const mensagem = montarMensagemSolicitacaoLigacao({
      dataHora: '03/08/2026 08:01',
      especialistaNome: 'Guilherme',
    });

    expect(mensagem).toContain('registrei a solicitação');
    expect(mensagem).toContain('Assim que o especialista confirmar');
    expect(mensagem).not.toContain('está confirmado');
  });

  it('confirma ligação telefônica sem chamar de visita ou avaliação', () => {
    const mensagem = montarMensagemLigacaoConfirmada({
      leadNome: 'Ivonet',
      agendadoPara: new Date('2026-08-03T11:01:00.000Z'),
      especialistaNome: 'Guilherme',
    });

    expect(mensagem).toContain('Ligação confirmada');
    expect(mensagem).toContain('Guilherme confirmou seu atendimento por telefone');
    expect(mensagem).toContain('08:01');
    expect(mensagem).toContain('ligará para você');
    expect(mensagem).not.toMatch(/visita|avaliação/i);
  });

  it('formata o horário no fuso de Brasília', () => {
    expect(formatarDataHoraAgenda(new Date('2026-08-03T11:01:00.000Z'))).toContain('08:01');
  });

  it('registra no histórico somente depois que o WhatsApp aceita o envio', async () => {
    const resultado = await enviarWhatsappAgendamento({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      telefone: '5562999999999',
      mensagem: 'Ligação confirmada com Julia',
    });

    expect(resultado).toEqual({ enviado: true, registradoNoHistorico: true, messageId: 'wa-123' });
    expect(mockPrisma.mensagemProspeccao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-1',
        direcao: 'SAIDA',
        conteudo: 'Ligação confirmada com Julia',
        messageId: 'wa-123',
      }),
    });
    expect(mockEnviarMensagemTexto.mock.invocationCallOrder[0])
      .toBeLessThan(mockPrisma.mensagemProspeccao.create.mock.invocationCallOrder[0]);
  });

  it('não grava mensagem nem afirma envio quando o WhatsApp falha', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockEnviarMensagemTexto.mockRejectedValue(new Error('indisponível'));

    const resultado = await enviarWhatsappAgendamento({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      telefone: '5562999999999',
      mensagem: 'teste',
    });

    expect(resultado.enviado).toBe(false);
    expect(resultado.registradoNoHistorico).toBe(false);
    expect(mockPrisma.mensagemProspeccao.create).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('distingue envio aceito de falha ao persistir o histórico', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPrisma.mensagemProspeccao.create.mockRejectedValue(new Error('banco indisponível'));

    const resultado = await enviarWhatsappAgendamento({
      tenantId: 'tenant-1',
      leadId: 'lead-1',
      telefone: '5562999999999',
      mensagem: 'teste',
    });

    expect(resultado).toEqual({ enviado: true, registradoNoHistorico: false, messageId: 'wa-123' });
    consoleError.mockRestore();
  });
});
