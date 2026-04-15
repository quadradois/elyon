/**
 * Mini pipeline compacto — barras horizontais com contagem por fase.
 * Clicável para filtrar o feed.
 */

import type { PipelineResumo } from '../../ganchos/useLeadsPriorizados';

interface MiniPipelineProps {
  pipeline: PipelineResumo;
  faseSelecionada?: string | null;
  onSelecionarFase: (fase: string | null) => void;
}

const FASES = [
  { chave: 'qualificacao' as const, label: 'Qualificação', cor: 'bg-indigo-500', corLight: 'bg-indigo-100' },
  { chave: 'apresentacao' as const, label: 'Apresentação', cor: 'bg-amber-500', corLight: 'bg-amber-100' },
  { chave: 'documentacao' as const, label: 'Documentação', cor: 'bg-violet-500', corLight: 'bg-violet-100' },
  { chave: 'onboarding' as const, label: 'Onboarding', cor: 'bg-emerald-500', corLight: 'bg-emerald-100' },
];

export function MiniPipeline({ pipeline, faseSelecionada, onSelecionarFase }: MiniPipelineProps) {
  const total = Object.values(pipeline).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Pipeline</h4>
        {faseSelecionada && (
          <button
            onClick={() => onSelecionarFase(null)}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Limpar filtro
          </button>
        )}
      </div>
      <div className="space-y-2">
        {FASES.map((fase) => {
          const qtd = pipeline[fase.chave];
          const percentual = total > 0 ? (qtd / total) * 100 : 0;
          const selecionada = faseSelecionada === fase.chave;

          return (
            <button
              key={fase.chave}
              onClick={() => onSelecionarFase(selecionada ? null : fase.chave)}
              className={`
                w-full flex items-center gap-3 group cursor-pointer
                rounded-lg px-2 py-1.5 transition-all
                ${selecionada
                  ? 'bg-slate-100 ring-1 ring-slate-300'
                  : 'hover:bg-slate-50'
                }
              `}
            >
              <span className="text-[11px] text-slate-600 w-24 text-left truncate font-medium">
                {fase.label}
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${fase.cor}`}
                  style={{ width: `${Math.max(percentual, 4)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-800 w-6 text-right">
                {qtd}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
