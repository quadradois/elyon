import { mapearCaracterizacaoLote, mapearMidiasLote, mapearUnidadesLote } from '../geo360-lotes';

describe('geo360 lotes helpers', () => {
  it('mapeia a resposta pública do Portal ICAD', () => {
    const resultado = mapearCaracterizacaoLote({
      Unidades: {
        total: 274,
        items: [{
          'Inscrição Imobiliária': { valor: 43918305000000, coluna: 'inscricao_cartografica' },
          Endereço: { valor: 'R MANACA , BAIRRO LOT ÁGUA AZUL', coluna: 'endereco_completo' },
          Ocupação: { valor: 'Edificado', coluna: 'ocupacao' },
          Condomínio: { valor: 'CONDOMÍNIO LAGO AZUL I', coluna: 'id_condominio' },
        }],
      },
      'Área Terreno': 13817.79,
      'Área Total Construída': 10507.24,
    });

    expect(resultado).toMatchObject({
      nomeCondominio: 'CONDOMÍNIO LAGO AZUL I',
      enderecoOficial: 'R MANACA , BAIRRO LOT ÁGUA AZUL',
      bairro: 'LOT ÁGUA AZUL',
      ocupacao: 'Edificado',
      totalUnidades: 274,
      areaTerreno: 13817.79,
      areaTotalConstruida: 10507.24,
    });
  });

  it('mapeia os dados oficiais de cada unidade pela inscrição', () => {
    const resultado = mapearUnidadesLote({
      Unidades: {
        total: 1,
        items: [{
          Endereço: { valor: 'R MANACA AP 101 BL 1 , BAIRRO LOT ÁGUA AZUL' },
          Ocupação: { valor: 'Edificado' },
          'Tipo Edificação': { valor: 'Apartamento' },
          'Inscrição Imobiliária': { valor: 43918305000010 },
          'Área Construída Unidade': { valor: 46.89 },
        }],
      },
    });

    expect(resultado).toEqual([{
      inscricao: '43918305000010',
      enderecoOficial: 'R MANACA AP 101 BL 1 , BAIRRO LOT ÁGUA AZUL',
      ocupacao: 'Edificado',
      tipoEdificacao: 'Apartamento',
      areaConstruida: 46.89,
    }]);
  });

  it('normaliza, deduplica e ordena metadados das fotos', () => {
    const resultado = mapearMidiasLote([
      {
        id: 468606,
        link: 'https://minio.exemplo/foto-2.jpeg',
        principal: 2,
        nome: 'Foto 2',
        nome_camada: 'lote',
      },
      {
        id: 468603,
        link: 'https://minio.exemplo/foto-1.jpeg',
        principal: 1,
        nome: 'Foto principal',
        data_panorama: '2026-01-29',
      },
      { id: 468603, link: 'https://minio.exemplo/foto-1.jpeg', principal: 1 },
      { id: 999 },
    ]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toMatchObject({
      idMidia: 468603,
      link: 'https://minio.exemplo/foto-1.jpeg',
      principal: 1,
    });
    expect(resultado[1].idMidia).toBe(468606);
  });
});
