const mockPrisma = {
  atividade: { findUnique: jest.fn() },
};
const mockResolver = jest.fn();
const mockExecutarComando = jest.fn();
const mockAuditoria = { registrar: jest.fn() };

jest.mock('../../lib/db', () => ({ prisma: mockPrisma }));
jest.mock('../resolucao-especialista-campanha', () => ({
  resolverEspecialistaCampanha: (...args: any[]) => mockResolver(...args),
}));
jest.mock('../servico-auditoria', () => ({ ServicoAuditoria: mockAuditoria }));
jest.mock('../coerencia-agenda-estado', () => ({
  AGENDA_COMMERCIAL_POLICY_VERSION: 'agenda-commercial-v1',
  executarComandoAgenda: (...args: any[]) => mockExecutarComando(...args),
}));

import { remanejarCorretorAtividade } from '../remanejamento-corretor';

describe('remanejarCorretorAtividade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.atividade.findUnique.mockResolvedValue({
      id: 'a1',
      tipo: 'REUNIAO',
      versao: 3,
      agendadoPara: new Date('2026-08-03T13:00:00Z'),
      statusAgendamento: 'SOLICITADO',
      statusConfirmacaoCorretor: 'RECUSADO',
      corretorOriginalId: 'u1',
      corretorAtualId: 'u1',
      lead: {
        id: 'l1', nome: 'Ivonet', telefone: '62999999999', tenantId: 't1', campanhaOrigemId: 'c1',
      },
    });
    mockExecutarComando.mockResolvedValue({ success: true, reasonCode: 'REQUESTED' });
    mockResolver.mockResolvedValue({
      nome: 'Eloisa', telefone: '62988888888', usuarioId: 'u2', origem: 'POOL_TENANT', cargo: 'Corretor Especialista',
    });
  });

  it('exclui o recusante, gera novo ciclo pendente e preserva o horário', async () => {
    const resultado = await remanejarCorretorAtividade({ atividadeId: 'a1', origem: 'RECUSA_EXPLICITA' });

    expect(resultado).toMatchObject({ sucesso: true, motivo: 'REMANEJADO', especialistaId: 'u2' });
    expect(mockResolver).toHaveBeenCalledWith(expect.objectContaining({ excluirUsuarioIds: ['u1'] }));
    expect(mockExecutarComando).toHaveBeenCalledWith(expect.objectContaining({
      operacao: 'SOLICITAR', atividadeId: 'a1', expectedVersion: 3,
      responsavelId: 'u2', tokenConfirmacaoCorretor: expect.any(String),
      notificacoes: expect.arrayContaining([
        expect.objectContaining({ destinatarioTipo: 'USUARIO', usuarioDestinoId: 'u2' }),
        expect.objectContaining({ destinatarioTipo: 'LEAD' }),
      ]),
    }));
  });

  it('não recoloca o recusante quando não existe substituto', async () => {
    mockResolver.mockResolvedValue(null);

    const resultado = await remanejarCorretorAtividade({ atividadeId: 'a1', origem: 'RECUSA_EXPLICITA' });

    expect(resultado).toEqual({ sucesso: false, motivo: 'SEM_SUBSTITUTO' });
    expect(mockExecutarComando).not.toHaveBeenCalled();
  });
});
