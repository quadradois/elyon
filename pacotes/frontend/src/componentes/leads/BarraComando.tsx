/**
 * Barra de comando — Design Premium v2.0
 * Limpa, objetiva e visualmente forte.
 */

import {
  Search,
  Flame,
  Zap,
  Snowflake,
  LayoutGrid,
  LayoutList,
  Radio,
  Calendar,
  TrendingUp,
  Users,
  RefreshCw,
  X,
} from 'lucide-react';
import { Input } from '../ui/input';
import { NovoLeadDialog } from '../NovoLeadDialog';
import type { EstatisticasPriorizadas } from '../../ganchos/useLeadsPriorizados';

export type ViewMode = 'feed' | 'kanban' | 'lista';

interface BarraComandoProps {
  estatisticas: EstatisticasPriorizadas;
  termoBusca: string;
  onBuscaChange: (valor: string) => void;
  filtroTemperatura: string;
  onFiltroTemperaturaChange: (valor: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (modo: ViewMode) => void;
  carregando: boolean;
  onRecarregar: () => void;
  onLeadCriado: () => void;
}

interface MetricChipProps {
  icone: React.ReactNode;
  valor: number | string;
  label: string;
  cor: string;
}

function MetricChip({ icone, valor, label, cor }: MetricChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
      <span className={`flex h-6 w-6 items-center justify-center rounded-md ${cor}`}>
        {icone}
      </span>
      <span className="text-sm font-bold leading-none text-slate-900">{valor}</span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

export function BarraComando({
  estatisticas,
  termoBusca,
  onBuscaChange,
  filtroTemperatura,
  onFiltroTemperaturaChange,
  viewMode,
  onViewModeChange,
  carregando,
  onRecarregar,
  onLeadCriado,
}: BarraComandoProps) {
  return (
    <div className="space-y-3">
      {/* Linha 1: título, métricas compactas e ações */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mission Control</h1>
              <p className="text-sm text-slate-500">Feed priorizado por urgência operacional</p>
            </div>
          </div>

          <div className="hidden h-8 w-px bg-slate-200 lg:block" />

          <div className="flex flex-wrap items-center gap-2">
            <MetricChip
              icone={<Users className="h-3.5 w-3.5 text-slate-600" />}
              valor={estatisticas.total}
              label="ativos"
              cor="bg-slate-100"
            />
            <MetricChip
              icone={<Flame className="h-3.5 w-3.5 text-red-500" />}
              valor={estatisticas.quentes}
              label="quentes"
              cor="bg-red-100"
            />
            <MetricChip
              icone={<Calendar className="h-3.5 w-3.5 text-emerald-600" />}
              valor={estatisticas.agendamentosHoje}
              label="hoje"
              cor="bg-emerald-100"
            />
            <MetricChip
              icone={<TrendingUp className="h-3.5 w-3.5 text-violet-600" />}
              valor={estatisticas.novosHoje}
              label="novos"
              cor="bg-violet-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 xl:justify-end">
          <button
            onClick={onRecarregar}
            disabled={carregando}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-all hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <NovoLeadDialog onLeadCreated={onLeadCriado} />
        </div>
      </div>

      {/* Linha 2: Busca + Filtros + Toggle views */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:flex-row lg:items-center">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={termoBusca}
            onChange={(e) => onBuscaChange(e.target.value)}
            className="pl-10 h-10 border-0 bg-slate-50 focus:bg-white rounded-lg text-sm"
          />
          {termoBusca && (
            <button onClick={() => onBuscaChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
            </button>
          )}
        </div>

        {/* Separador */}
        <div className="hidden h-8 w-px bg-slate-200 lg:block" />

        {/* Chips de temperatura */}
        <div className="flex items-center gap-1.5">
          {[
            { key: 'QUENTE', icon: <Flame className="w-3.5 h-3.5" />, label: `${estatisticas.quentes}`, activeClass: 'bg-red-500 text-white shadow-sm shadow-red-200' },
            { key: 'MORNO', icon: <Zap className="w-3.5 h-3.5" />, label: `${estatisticas.mornos}`, activeClass: 'bg-amber-500 text-white shadow-sm shadow-amber-200' },
            { key: 'FRIO', icon: <Snowflake className="w-3.5 h-3.5" />, label: `${estatisticas.frios}`, activeClass: 'bg-blue-500 text-white shadow-sm shadow-blue-200' },
          ].map((chip) => (
            <button
              key={chip.key}
              onClick={() => onFiltroTemperaturaChange(filtroTemperatura === chip.key ? '' : chip.key)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all
                ${filtroTemperatura === chip.key
                  ? chip.activeClass
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }
              `}
            >
              {chip.icon}
              {chip.label}
            </button>
          ))}
        </div>

        {/* Separador */}
        <div className="hidden h-8 w-px bg-slate-200 lg:block" />

        {/* Toggle views */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {[
            { key: 'feed' as const, icon: <Radio className="w-4 h-4" />, label: 'Feed' },
            { key: 'kanban' as const, icon: <LayoutGrid className="w-4 h-4" />, label: 'Kanban' },
            { key: 'lista' as const, icon: <LayoutList className="w-4 h-4" />, label: 'Lista' },
          ].map((view) => (
            <button
              key={view.key}
              onClick={() => onViewModeChange(view.key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                ${viewMode === view.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }
              `}
            >
              {view.icon}
              {view.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
