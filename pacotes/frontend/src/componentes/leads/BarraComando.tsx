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
import { Button } from '../ui/button';
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

interface StatCardProps {
  icone: React.ReactNode;
  valor: number | string;
  label: string;
  cor: string;
  destaque?: boolean;
}

function StatCard({ icone, valor, label, cor, destaque }: StatCardProps) {
  return (
    <div className={`
      flex flex-col justify-between p-4 rounded-2xl border transition-all
      ${destaque
        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500 shadow-lg shadow-indigo-200 text-white'
        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }
    `}>
      <div className={`
        w-9 h-9 rounded-xl flex items-center justify-center mb-3
        ${destaque ? 'bg-white/20' : cor}
      `}>
        {icone}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-none mb-0.5 ${destaque ? 'text-white' : 'text-slate-900'}`}>
          {valor}
        </p>
        <p className={`text-[11px] font-medium ${destaque ? 'text-indigo-200' : 'text-slate-500'}`}>
          {label}
        </p>
      </div>
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
    <div className="space-y-5">
      {/* Linha 1: Título + Ações */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-200">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mission Control</h1>
              <p className="text-sm text-slate-500">Feed priorizado por urgência operacional</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRecarregar}
            disabled={carregando}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <NovoLeadDialog onLeadCreated={onLeadCriado} />
        </div>
      </div>

      {/* Linha 2: Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          icone={<Users className="w-5 h-5 text-slate-600" />}
          valor={estatisticas.total}
          label="Leads ativos"
          cor="bg-slate-100"
          destaque={false}
        />
        <StatCard
          icone={<Flame className="w-5 h-5 text-red-500" />}
          valor={estatisticas.quentes}
          label="Leads quentes"
          cor="bg-red-100"
          destaque={estatisticas.quentes > 0}
        />
        <StatCard
          icone={<Calendar className="w-5 h-5 text-emerald-600" />}
          valor={estatisticas.agendamentosHoje}
          label="Agendados hoje"
          cor="bg-emerald-100"
          destaque={false}
        />
        <StatCard
          icone={<TrendingUp className="w-5 h-5 text-violet-600" />}
          valor={estatisticas.novosHoje}
          label="Novos hoje"
          cor="bg-violet-100"
          destaque={false}
        />
      </div>

      {/* Linha 3: Busca + Filtros + Toggle views */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={termoBusca}
            onChange={(e) => onBuscaChange(e.target.value)}
            className="pl-10 h-10 border-0 bg-slate-50 focus:bg-white rounded-xl text-sm"
          />
          {termoBusca && (
            <button onClick={() => onBuscaChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
            </button>
          )}
        </div>

        {/* Separador */}
        <div className="h-8 w-px bg-slate-200" />

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
                flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all
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
        <div className="h-8 w-px bg-slate-200" />

        {/* Toggle views */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { key: 'feed' as const, icon: <Radio className="w-4 h-4" />, label: 'Feed' },
            { key: 'kanban' as const, icon: <LayoutGrid className="w-4 h-4" />, label: 'Kanban' },
            { key: 'lista' as const, icon: <LayoutList className="w-4 h-4" />, label: 'Lista' },
          ].map((view) => (
            <button
              key={view.key}
              onClick={() => onViewModeChange(view.key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
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
