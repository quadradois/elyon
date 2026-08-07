import { centroideWkt, mapearDetalheGeo360, normalizarListaGeo360 } from '../geo360-sync';

describe('geo360 sync helpers', () => {
  it('aceita resposta array e resposta encapsulada em value', () => {
    expect(normalizarListaGeo360([1, 2])).toEqual([1, 2]);
    expect(normalizarListaGeo360({ value: [3, 4] })).toEqual([3, 4]);
    expect(normalizarListaGeo360({ data: [] })).toEqual([]);
  });

  it('calcula centroide aproximado de WKT e rejeita formato desconhecido', () => {
    expect(centroideWkt('POLYGON((-49 -16,-47 -16,-47 -14,-49 -14,-49 -16))'))
      .toEqual([-15.2, -48.2]);
    expect(centroideWkt('01030000')).toEqual([null, null]);
  });

  it('mapeia detalhe para tipos nativos serializáveis antes da gravação JSONB', () => {
    const row = mapearDetalheGeo360({
      inscricao_cartografica: '10206001890030',
      id_imobiliario: '922364',
      id_lote: '283959',
      geom: 'POLYGON((-49 -16,-47 -16,-47 -14,-49 -14,-49 -16))',
    }, {
      inscricao_cartografica___imobiliario: '10206001890030',
      area_construida_privativa___imobiliario: '32',
      area_terreno_privativa: 531,
      tipo_edificacao: '4',
      nome___pessoa: ' Pessoa Teste ',
    });

    expect(row).toMatchObject({
      inscricao: '10206001890030',
      id_imobiliario: 922364,
      id_lote: 283959,
      area_construida: 32,
      area_terreno: 531,
      tipo_edificacao: 4,
      nome_pessoa: 'Pessoa Teste',
    });
    expect(() => JSON.stringify([row])).not.toThrow();
  });

  it('preserva a inscricao de 17 digitos de Aparecida de Goiania', () => {
    const row = mapearDetalheGeo360({
      inscricao_cartografica: '12010000700010168',
      id_imobiliario: '209911',
    }, {
      inscricao_cartografica___imobiliario: '12010000700010168',
    }, 'aparecidadegoiania');

    expect(row.inscricao).toBe('12010000700010168');
  });
});
