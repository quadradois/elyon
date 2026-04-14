import {
  camposCriticosFaltantes,
  extrairFieldSources,
  obterLastSourceUpdateAt,
} from '../governanca-qualificacao';

describe('governanca-qualificacao helpers', () => {
  it('calcula campos críticos faltantes corretamente', () => {
    const faltantes = camposCriticosFaltantes({
      interesseEm: 'vender',
      tipoImovel: 'apartamento',
      areaImovel: null,
      ocupacaoImovel: 'ocupado',
      valorPretendido: 'R$ 350.000',
      doresIdentificadas: ['poucas visitas'],
      situacaoAtual: '',
      motivacaoVenda: 'mudança',
      consequencias: null,
      custosAtuais: null,
    });

    expect(faltantes).toEqual(
      expect.arrayContaining(['areaImovel', 'situacaoAtual', 'implicacao'])
    );
  });

  it('extrai e ordena trilha de source_of_truth do schemaState', () => {
    const sources = extrairFieldSources({
      fieldSources: {
        valorPretendido: {
          source: 'tool_confirmada',
          value: 'R$ 350.000',
          updatedAt: '2026-04-13T10:00:00.000Z',
        },
        tipoImovel: {
          source: 'briefing',
          value: 'apartamento',
          updatedAt: '2026-04-13T09:00:00.000Z',
          evidence: 'fallback de dados do contato',
        },
      },
      lastSourceUpdateAt: '2026-04-13T10:00:00.000Z',
    });

    expect(sources).toHaveLength(2);
    expect(sources[0].campo).toBe('valorPretendido');
    expect(sources[1].campo).toBe('tipoImovel');
    expect(sources[1].evidence).toBe('fallback de dados do contato');
  });

  it('retorna null quando lastSourceUpdateAt não existir', () => {
    expect(obterLastSourceUpdateAt({})).toBeNull();
    expect(obterLastSourceUpdateAt(null)).toBeNull();
  });
});

