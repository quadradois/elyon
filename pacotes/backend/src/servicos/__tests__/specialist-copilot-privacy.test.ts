import {
  extrairResumoAtendimentoEspecialista,
  montarIdentificacaoImovel,
  sanitizarContextoEspecialista,
} from '../specialist-copilot-privacy';

describe('specialist copilot privacy', () => {
  it('remove CPF, credencial e caracteres de controle', () => {
    const result = sanitizarContextoEspecialista('CPF 123.456.789-00\nAuthorization: Bearer segredo123456');
    expect(result).not.toContain('123.456.789-00');
    expect(result).not.toContain('segredo123456');
    expect(result).toContain('[CPF REMOVIDO]');
  });

  it('prioriza nome do edifício e limita a identificação', () => {
    expect(montarIdentificacaoImovel({ nomeEdificio: 'Gran Plaza', enderecoImovel: 'Rua X' })).toBe('Gran Plaza');
    expect(sanitizarContextoEspecialista('x'.repeat(900))).toHaveLength(600);
  });

  it('impede que diagnósticos internos sejam enviados ao especialista', () => {
    expect(sanitizarContextoEspecialista(
      'Fallback técnico: atualização automática por ausência de TOOL_EXEC no turno',
    )).toBe('');
  });

  it('prioriza o contexto humano da atividade sobre observação técnica contaminada', () => {
    expect(extrairResumoAtendimentoEspecialista({
      descricaoAtividade: 'Ligação | Contexto: Lead Ivonet quer vender o Reserva Buriti e precisa de avaliação.',
      briefingCloser: null,
      observacoesSpin: 'Fallback técnico: ausência de TOOL_EXEC no turno',
    })).toBe('Lead Ivonet quer vender o Reserva Buriti e precisa de avaliação.');
  });
});
