import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../../servicos/api';
import { EstadoErroLeads } from './EstadoListaLeads';

type PeriodoFiltro = '7d' | '30d' | '90d';

type MetricasExecutivas = {
  periodoDias: number;
  taxaSucesso: number;
  funil: {
    cliquesDecisao: number;
    acoesCrm: number;
    resultadosDecisao: number;
    resultadosCrm: number;
    sucessosDecisao: number;
    sucessosCrm: number;
  };
  rankingAcoes: Array<{
    acao: string;
    totalAcoes: number;
    totalResultados: number;
    totalSucessos: number;
    taxaSucesso: number;
  }>;
};

const PERIODOS: Array<{ id: PeriodoFiltro; label: string; dias: number }> = [
  { id: '7d', label: '7d', dias: 7 },
  { id: '30d', label: '30d', dias: 30 },
  { id: '90d', label: '90d', dias: 90 },
];

export function PainelExecutivoCockpit() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('30d');
  const [dados, setDados] = useState<MetricasExecutivas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const periodoDias = useMemo(
    () => PERIODOS.find((p) => p.id === periodo)?.dias || 30,
    [periodo]
  );

  const carregar = async () => {
    try {
      setErro('');
      setCarregando(true);
      const response = await api.get(`/leads/cockpit-metricas?periodoDias=${periodoDias}`);
      if (response.data?.sucesso) {
        setDados(response.data as MetricasExecutivas);
      } else {
        setErro('Não foi possível carregar as métricas executivas.');
      }
    } catch (error) {
      console.error('Erro ao carregar painel executivo do cockpit:', error);
      setErro('Não foi possível carregar as métricas executivas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [periodoDias]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) {
    return <EstadoErroLeads mensagem={erro} />;
  }

  if (carregando || !dados) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-center h-28">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  const topAcoes = dados.rankingAcoes.slice(0, 5);
  const maxResultados = Math.max(1, ...topAcoes.map((a) => a.totalResultados || 0));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Painel Executivo do Cockpit</h3>
            <p className="text-xs text-slate-500">Visão de desempenho operacional por período</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  periodo === p.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={carregar}
            className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
            title="Atualizar métricas"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] text-emerald-700 font-bold uppercase">Taxa de sucesso</p>
          <p className="text-2xl font-bold text-emerald-800">{dados.taxaSucesso}%</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-[11px] text-indigo-700 font-bold uppercase">Funil decisões</p>
          <p className="text-sm font-semibold text-indigo-800">
            {dados.funil.sucessosDecisao}/{dados.funil.resultadosDecisao} sucessos
          </p>
          <p className="text-[11px] text-indigo-600 mt-0.5">{dados.funil.cliquesDecisao} cliques</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] text-amber-700 font-bold uppercase">Funil CRM</p>
          <p className="text-sm font-semibold text-amber-800">
            {dados.funil.sucessosCrm}/{dados.funil.resultadosCrm} sucessos
          </p>
          <p className="text-[11px] text-amber-600 mt-0.5">{dados.funil.acoesCrm} ações</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Ranking de ações</p>
        <div className="space-y-2">
          {topAcoes.length === 0 && (
            <p className="text-xs text-slate-400">Sem dados suficientes no período selecionado.</p>
          )}
          {topAcoes.map((acao) => (
            <div key={acao.acao} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700 truncate">{acao.acao}</p>
                <p className="text-[11px] text-slate-500">{acao.taxaSucesso}%</p>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-indigo-500 rounded-full"
                  style={{ width: `${Math.max(6, (acao.totalResultados / maxResultados) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
