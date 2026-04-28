import { useState, useEffect } from 'react';
import { api } from '../../servicos/api';
import { ShieldCheck, Search, Filter, Loader2, ArrowLeft, ArrowRight, User, Key, Building2, Terminal } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LogAuditoria {
  id: string;
  tenantId: string;
  usuarioId: string | null;
  acao: string;
  entidade: string | null;
  entidadeId: string | null;
  detalhes: any;
  ip: string | null;
  criadoEm: string;
  usuario?: { id: string; nome: string; email: string };
  tenant?: { id: string; nome: string };
}

export const AdminAuditoria = () => {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');

  const [acoes, setAcoes] = useState<string[]>([]);
  const [dados, setDados] = useState<LogAuditoria[]>([]);
  const [paginacao, setPaginacao] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
      setPagina(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    carregarAcoes();
  }, []);

  useEffect(() => {
    carregarLogs();
  }, [pagina, buscaDebounced, filtroAcao]);

  const carregarAcoes = async () => {
    try {
      const res = await api.get('/admin/auditoria/acoes');
      setAcoes(res.data);
    } catch (error) {
      console.error('Erro ao carregar acoes:', error);
    }
  };

  const carregarLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/auditoria', {
        params: { pagina, limite: 20, busca: buscaDebounced, acao: filtroAcao }
      });
      setDados(res.data.dados);
      setPaginacao(res.data.paginacao);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatarAcao = (acao: string) => {
    return acao.replace(/_/g, ' ');
  };

  const renderIconeAcao = (acao: string) => {
    if (acao.includes('LOGIN')) return <Key className="w-4 h-4 text-emerald-500" />;
    if (acao.includes('USUARIO')) return <User className="w-4 h-4 text-blue-500" />;
    if (acao.includes('TENANT') || acao.includes('EMPRESA')) return <Building2 className="w-4 h-4 text-purple-500" />;
    if (acao.includes('MINERACAO') || acao.includes('ASSERTIVA')) return <Search className="w-4 h-4 text-orange-500" />;
    return <Terminal className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            Auditoria de Sistema
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitoramento de ações críticas e segurança (Retenção de 60 dias)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, evento ou IP..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filtroAcao}
              onChange={(e) => {
                setFiltroAcao(e.target.value);
                setPagina(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none"
            >
              <option value="">Todas as Ações</option>
              {acoes?.map(a => (
                <option key={a} value={a}>{formatarAcao(a)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : dados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <ShieldCheck className="w-12 h-12 text-slate-300 mb-2" />
              <p>Nenhum registro encontrado para os filtros atuais.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Evento</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Detalhes</th>
                  <th className="px-6 py-4">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                      {format(new Date(log.criadoEm), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {renderIconeAcao(log.acao)}
                        <span className="font-medium text-slate-900 border border-slate-200 bg-white px-2 py-0.5 rounded-md text-xs">
                          {log.acao}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.usuario ? (
                        <div>
                          <p className="font-medium text-slate-900 truncate max-w-[150px]">{log.usuario.nome}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[150px]">{log.tenant?.nome || 'Global'}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sistema/Anon</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 bg-slate-50 rounded p-2 border border-slate-100 font-mono max-h-20 overflow-y-auto w-64 md:w-auto">
                        {JSON.stringify(log.detalhes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                      {log.ip || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {paginacao.totalPaginas > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Mostrando página <span className="font-medium text-slate-900">{paginacao.pagina}</span> de <span className="font-medium text-slate-900">{paginacao.totalPaginas}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagina(p => p + 1)}
                disabled={pagina >= paginacao.totalPaginas}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
