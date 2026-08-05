import {
  filtrarAcoesAgendaPorAcesso,
  obterEscopoLeituraAgenda,
  podeExecutarComandoAgenda,
} from '../agenda-access-policy';

describe('agenda access policy', () => {
  it.each(['ADMIN', 'SUPER_ADMIN'])('%s administra os compromissos do tenant', (papel) => {
    expect(obterEscopoLeituraAgenda({ papel, usuarioId: 'gestor-1' })).toEqual({ tipo: 'TENANT' });
    expect(podeExecutarComandoAgenda({
      papel, usuarioId: 'gestor-1', responsavelId: 'corretor-1', command: 'CANCELAR',
    })).toBe(true);
  });

  it('corretor consulta somente a própria agenda e não cancela o compromisso do lead', () => {
    expect(obterEscopoLeituraAgenda({ papel: 'CORRETOR', usuarioId: 'corretor-1' }))
      .toEqual({ tipo: 'PROPRIA', responsavelId: 'corretor-1' });
    expect(podeExecutarComandoAgenda({
      papel: 'CORRETOR', usuarioId: 'corretor-1', responsavelId: 'corretor-1', command: 'RECUSAR',
    })).toBe(true);
    expect(podeExecutarComandoAgenda({
      papel: 'CORRETOR', usuarioId: 'corretor-1', responsavelId: 'corretor-1', command: 'CANCELAR',
    })).toBe(false);
    expect(podeExecutarComandoAgenda({
      papel: 'CORRETOR', usuarioId: 'corretor-1', responsavelId: 'corretor-2', command: 'RECUSAR',
    })).toBe(false);
  });

  it('visualizador pode consultar o tenant, mas nunca recebe nem executa ações mutáveis', () => {
    expect(obterEscopoLeituraAgenda({ papel: 'VISUALIZADOR', usuarioId: 'viewer-1' })).toEqual({ tipo: 'TENANT' });
    expect(filtrarAcoesAgendaPorAcesso(['CANCELAR', 'REALIZAR'], {
      papel: 'VISUALIZADOR', usuarioId: 'viewer-1', responsavelId: 'corretor-1',
    })).toEqual([]);
    expect(podeExecutarComandoAgenda({
      papel: 'VISUALIZADOR', usuarioId: 'viewer-1', responsavelId: 'corretor-1', command: 'REALIZAR',
    })).toBe(false);
  });

  it('filtra as ações do corretor para participação e desfecho do próprio compromisso', () => {
    expect(filtrarAcoesAgendaPorAcesso(
      ['CANCELAR', 'REAGENDAR', 'PROPOR', 'CONFIRMAR_ATRIBUICAO', 'RECUSAR', 'REALIZAR', 'NAO_COMPARECEU'],
      { papel: 'CORRETOR', usuarioId: 'corretor-1', responsavelId: 'corretor-1' },
    )).toEqual(['PROPOR', 'CONFIRMAR_ATRIBUICAO', 'RECUSAR', 'REALIZAR', 'NAO_COMPARECEU']);
  });
});
