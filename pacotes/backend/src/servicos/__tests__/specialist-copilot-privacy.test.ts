import { montarIdentificacaoImovel, sanitizarContextoEspecialista } from '../specialist-copilot-privacy';

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
});
