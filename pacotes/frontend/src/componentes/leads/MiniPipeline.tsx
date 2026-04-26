/**
 * Mini pipeline — Design Premium v2.0
 * Horizontal compacto com barras de progresso e clicável.
 */

import type { PipelineResumo } from '../../ganchos/useLeadsPriorizados';

interface MiniPipelineProps {
  pipeline: PipelineResumo;
  faseSelecionada?: string | null;
  onSelecionarFase: (fase: string | null) => void;
}

const FASES = [
  {
    chave: 'qualificacao' as const,
    label: 'Qualificação',
    abrev: 'Qual.',
    cor: 'bg-indigo-500',
    corText: 'text-indigo-700',
    corLight: 'bg-indigo-50',
    corBorder: 'border-indigo-200',
    corActive: 'bg-indigo-600 text-white border-indigo-600',
  },
  {
    chave: 'apresentacao' as const,
    label: 'Apresentação',
    abrev: 'Apres.',
    cor: 'bg-amber-500',
    corText: 'text-amber-700',
    corLight: 'bg-amber-50',
    corBorder: 'border-amber-200',
    corActive: 'bg-amber-600 text-white border-amber-600',
  },
  {
    chave: 'documentacao' as const,
    label: 'Documentação',
    abrev: 'Doc.',
    cor: 'bg-violet-500',
    corText: 'text-violet-700',
    corLight: 'bg-violet-50',
    corBorder: 'border-violet-200',
    corActive: 'bg-violet-600 text-white border-violet-600',
  },
  {
    chave: 'onboarding' as const,
    label: 'Onboarding',
    abrev: 'Onb.',
    cor: 'bg-emerald-500',
    corText: 'text-emerald-700',
    corLight: 'bg-emerald-50',
    corBorder: 'border-emerald-200',
    corActive: 'bg-emerald-600 text-white border-emerald-600',
  },
];

export function MiniPipeline({ pipeline, faseSelecionada, onSelecionarFase }: MiniPipelineProps) {
  const total = Object.values(pipeline).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-bold text-slate-800">Pipeline</h4>
          <p className="text-[11px] text-slate-400">Clique para filtrar por fase</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-base font-bold text-slate-900">{total}</div>
          <span className="text-xs text-slate-400">leads</span>
        </div>
      </div>

      {/* Barra total de progresso */}
      {total > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden mb-2.5 gap-0.5">
          {FASES.map((fase) => {
            const qtd = pipeline[fase.chave];
            if (qtd === 0) return null;
            return (
              <div
                key={fase.chave}
                className={`${fase.cor} transition-all duration-500`}
                style={{ flex: qtd }}
              />
            );
          })}
        </div>
      )}

      {/* Chips clicáveis */}
      <div className="flex flex-wrap gap-1.5">
        {FASES.map((fase) => {
          const qtd = pipeline[fase.chave];
          const selecionada = faseSelecionada === fase.chave;

          return (
            <button
              key={fase.chave}
              onClick={() => onSelecionarFase(selecionada ? null : fase.chave)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all
                ${selecionada
                  ? fase.corActive
                  : `${fase.corLight} ${fase.corText} ${fase.corBorder} hover:opacity-80`
                }
              `}
            >
              <span>{fase.abrev}</span>
              <span className={`
                px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none
                ${selecionada ? 'bg-white/25' : 'bg-white/70'}
              `}>
                {qtd}
              </span>
            </button>
          );
        })}

        {faseSelecionada && (
          <button
            onClick={() => onSelecionarFase(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-500 hover:bg-slate-50 transition-all"
          >
            ✕ Limpar filtro
          </button>
        )}
      </div>
    </div>
  );
}
