/**
 * Barra de comando (topo fixo) — busca, filtros rápidos e score ring.
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

function ChipFiltro({
  ativo,
  onClick,
  icone,
  label,
  valor,
  cor,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-200 border
        ${ativo
          ? `${cor} shadow-sm scale-105`
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }
      `}
    >
      {icone}
      <span>{label}</span>
      <span className={`
        px-1.5 py-0.5 rounded-full text-[10px] font-bold
        ${ativo ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-700'}
      `}>
        {valor}
      </span>
    </button>
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
    <div className="space-y-4">
      {/* Linha 1: Título + Ações */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mission Control</h1>
          <p className="text-sm text-slate-500">
            Leads priorizados por urgência operacional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRecarregar}
            disabled={carregando}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <NovoLeadDialog onLeadCreated={onLeadCriado} />
        </div>
      </div>

      {/* Linha 2: Busca + Filtros + Views */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        {/* Busca */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={termoBusca}
            onChange={(e) => onBuscaChange(e.target.value)}
            className="pl-10 h-9"
          />
          {termoBusca && (
            <button
              onClick={() => onBuscaChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Chips de temperatura */}
        <div className="flex items-center gap-2 flex-wrap">
          <ChipFiltro
            ativo={filtroTemperatura === 'QUENTE'}
            onClick={() => onFiltroTemperaturaChange(filtroTemperatura === 'QUENTE' ? '' : 'QUENTE')}
            icone={<Flame className="w-3.5 h-3.5" />}
            label="Quente"
            valor={estatisticas.quentes}
            cor="bg-red-500 text-white border-red-500"
          />
          <ChipFiltro
            ativo={filtroTemperatura === 'MORNO'}
            onClick={() => onFiltroTemperaturaChange(filtroTemperatura === 'MORNO' ? '' : 'MORNO')}
            icone={<Zap className="w-3.5 h-3.5" />}
            label="Morno"
            valor={estatisticas.mornos}
            cor="bg-amber-500 text-white border-amber-500"
          />
          <ChipFiltro
            ativo={filtroTemperatura === 'FRIO'}
            onClick={() => onFiltroTemperaturaChange(filtroTemperatura === 'FRIO' ? '' : 'FRIO')}
            icone={<Snowflake className="w-3.5 h-3.5" />}
            label="Frio"
            valor={estatisticas.frios}
            cor="bg-blue-500 text-white border-blue-500"
          />
        </div>

        {/* Separador */}
        <div className="hidden lg:block w-px h-6 bg-slate-200" />

        {/* Toggle de views */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => onViewModeChange('feed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'feed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Feed
          </button>
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'kanban'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => onViewModeChange('lista')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === 'lista'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            Lista
          </button>
        </div>
      </div>

      {/* Linha 3: Score Ring compacto */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{estatisticas.total}</p>
            <p className="text-[11px] text-slate-500">Leads ativos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <Flame className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{estatisticas.quentes}</p>
            <p className="text-[11px] text-slate-500">Quentes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{estatisticas.agendamentosHoje}</p>
            <p className="text-[11px] text-slate-500">Agendados hoje</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{estatisticas.novosHoje}</p>
            <p className="text-[11px] text-slate-500">Novos hoje</p>
          </div>
        </div>
        {estatisticas.iaAtiva > 0 && (
          <div className="flex items-center gap-3 bg-indigo-50 rounded-xl border border-indigo-200 px-4 py-3">
            <div className="relative h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Radio className="h-5 w-5 text-indigo-600" />
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
              </span>
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-900">{estatisticas.iaAtiva}</p>
              <p className="text-[11px] text-indigo-600">IA ativa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
