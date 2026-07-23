import { describe, expect, it } from '@jest/globals';
import { formatarEnderecoEmpreendimento } from '../geo360-endereco';

describe('formatação do endereço de empreendimento GEO360', () => {
  it.each([
    [
      'R DA DIVISA AP 402-BL03 , BAIRRO S MORADA DO SOL',
      'S MORADA DO SOL',
      'R DA DIVISA, BAIRRO S MORADA DO SOL'
    ],
    [
      'R T54 S/N AP1202A 12PAV A , BAIRRO S BUENO',
      'S BUENO',
      'R T54 S/N, BAIRRO S BUENO'
    ],
    [
      'AV PERIMETRAL NORTE APT101.T01 , BAIRRO JD NOVA ESPERANÇA',
      'JD NOVA ESPERANÇA',
      'AV PERIMETRAL NORTE, BAIRRO JD NOVA ESPERANÇA'
    ],
    [
      'AV DEPUTADO JAMEL CECILIO 2690 LOJA1 , BAIRRO JD GOIÁS',
      'JD GOIÁS',
      'AV DEPUTADO JAMEL CECILIO 2690, BAIRRO JD GOIÁS'
    ],
    [
      'R MANACA , BAIRRO LOT ÁGUA AZUL',
      'LOT ÁGUA AZUL',
      'R MANACA, BAIRRO LOT ÁGUA AZUL'
    ],
    [
      'R T29 S/N , BAIRRO S BUENO',
      'S BUENO',
      'R T29 S/N, BAIRRO S BUENO'
    ]
  ])('remove somente o complemento da unidade em %s', (entrada, bairro, esperado) => {
    expect(formatarEnderecoEmpreendimento(entrada, bairro)).toBe(esperado);
  });

  it('mantém um endereço que não segue o formato do portal', () => {
    expect(formatarEnderecoEmpreendimento('R T-53, SETOR BUENO')).toBe('R T-53, SETOR BUENO');
  });

  it('retorna vazio quando não há endereço nem bairro', () => {
    expect(formatarEnderecoEmpreendimento(null, null)).toBe('');
  });
});
