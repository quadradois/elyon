import {
  aplicarBooleanComEvidencia,
  normalizarPrazoEUrgencia,
  valorComEvidencia,
} from '../governanca-campos';

describe('governanca-campos', () => {
  it('normaliza prazo/urgência com timeline confiável', () => {
    const out = normalizarPrazoEUrgencia({ timeline: '3 meses' });
    expect(out.timelineEhConfiavel).toBe(true);
    expect(out.prazoDesejadoNormalizado).toBe('3 meses');
    expect(out.urgencia).toBe('MEDIA');
  });

  it('mantém prazo/urgência indefinidos com timeline não confiável', () => {
    const out = normalizarPrazoEUrgencia({ timeline: 'sem prazo definido' });
    expect(out.timelineEhConfiavel).toBe(false);
    expect(out.prazoDesejadoNormalizado).toBeUndefined();
    expect(out.urgencia).toBeUndefined();
  });

  it('valorComEvidencia só retorna valor com evidência textual', () => {
    expect(valorComEvidencia(true, 'confirmado pelo lead')).toBe(true);
    expect(valorComEvidencia(true, '')).toBeUndefined();
    expect(valorComEvidencia(false, undefined)).toBeUndefined();
  });

  it('aplicarBooleanComEvidencia escreve apenas quando há evidência', () => {
    const updateData: Record<string, unknown> = {};
    const camposAtualizados: string[] = [];

    const appliedSemEvidencia = aplicarBooleanComEvidencia({
      campo: 'temDividas',
      valor: false,
      evidencia: '',
      updateData,
      camposAtualizados,
      warningTag: 'TESTE',
    });
    expect(appliedSemEvidencia).toBe(false);
    expect(updateData.temDividas).toBeUndefined();
    expect(camposAtualizados).toEqual([]);

    const appliedComEvidencia = aplicarBooleanComEvidencia({
      campo: 'temDividas',
      valor: false,
      evidencia: 'Não tenho dívidas',
      updateData,
      camposAtualizados,
      warningTag: 'TESTE',
    });
    expect(appliedComEvidencia).toBe(true);
    expect(updateData.temDividas).toBe(false);
    expect(camposAtualizados).toEqual(['temDividas']);
  });
});
