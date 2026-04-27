import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Search, LayoutGrid, LayoutList, UserPlus } from 'lucide-react';
import { api } from '../servicos/api';
import { Button } from '../componentes/ui/button';
import { Input } from '../componentes/ui/input';
import { Card, CardContent } from '../componentes/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../componentes/ui/table';
import { useProprietarios, type EstagioProprietario, type ProprietarioItem } from '../ganchos/useProprietarios';
import { NovoLeadDialog } from '../componentes/NovoLeadDialog';

const ESTAGIOS: Array<EstagioProprietario | 'Todos'> = ['Todos', 'Em Prospecção', 'Respondeu', 'Qualificado', 'Em Negociação', 'Captado'];

type ViewMode = 'kanban' | 'lista';

function tempoRelativo(data?: string) {
  if (!data) return '-';
  const dt = new Date(data);
  const diffMin = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffHora = Math.floor(diffMin / 60);
  if (diffHora < 24) return `${diffHora}h`;
  const diffDia = Math.floor(diffHora / 24);
  return `${diffDia}d`;
}

function iconeTemperatura(temp?: string | null) {
  if (temp === 'QUENTE') return '🔥';
  if (temp === 'MORNO') return '⚡';
  return '❄️';
}

export function Proprietarios() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [campanhaId, setCampanhaId] = useState('');
  const [estagio, setEstagio] = useState<EstagioProprietario | 'Todos'>('Todos');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [campanhas, setCampanhas] = useState<Array<{ id: string; nome: string }>>([]);

  const hookLista = useProprietarios({ busca: buscaDebounced, campanhaId, estagio, page: 1, limit: 50 });

  const [kanbanCols, setKanbanCols] = useState<Record<EstagioProprietario, ProprietarioItem[]>>({
    'Em Prospecção': [],
    'Respondeu': [],
    'Qualificado': [],
    'Em Negociação': [],
    'Captado': [],
  });
  const [kanbanPaginas, setKanbanPaginas] = useState<Record<EstagioProprietario, number>>({
    'Em Prospecção': 1,
    'Respondeu': 1,
    'Qualificado': 1,
    'Em Negociação': 1,
    'Captado': 1,
  });
  const [kanbanFim, setKanbanFim] = useState<Record<EstagioProprietario, boolean>>({
    'Em Prospecção': false,
    'Respondeu': false,
    'Qualificado': false,
    'Em Negociação': false,
    'Captado': false,
  });
  const [carregandoColuna, setCarregandoColuna] = useState<Partial<Record<EstagioProprietario, boolean>>>({});

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    const carregarCampanhas = async () => {
      try {
        const res = await api.get('/campanhas');
        setCampanhas(res.data?.campanhas || []);
      } catch {
        setCampanhas([]);
      }
    };
    carregarCampanhas();
  }, []);

  const carregarColuna = async (col: EstagioProprietario, reset = false) => {
    if (carregandoColuna[col]) return;
    const page = reset ? 1 : kanbanPaginas[col];

    try {
      setCarregandoColuna((prev) => ({ ...prev, [col]: true }));
      const query = new URLSearchParams();
      query.set('estagio', col);
      query.set('page', String(page));
      query.set('limit', '20');
      if (campanhaId) query.set('campanhaId', campanhaId);
      if (buscaDebounced) query.set('busca', buscaDebounced);

      const res = await api.get(`/proprietarios?${query.toString()}`);
      const data = res.data?.data || [];
      const totalPaginas = res.data?.metadata?.totalPaginas || 1;

      setKanbanCols((prev) => ({
        ...prev,
        [col]: reset ? data : [...prev[col], ...data],
      }));
      setKanbanPaginas((prev) => ({ ...prev, [col]: page + 1 }));
      setKanbanFim((prev) => ({ ...prev, [col]: page >= totalPaginas }));
    } catch (error) {
      console.error('[Proprietarios] erro ao carregar coluna', col, error);
    } finally {
      setCarregandoColuna((prev) => ({ ...prev, [col]: false }));
    }
  };

  useEffect(() => {
    (['Em Prospecção', 'Respondeu', 'Qualificado', 'Em Negociação', 'Captado'] as EstagioProprietario[]).forEach((col) => {
      carregarColuna(col, true);
    });
  }, [campanhaId, buscaDebounced]);

  const chips = useMemo(() => {
    return {
      total: hookLista.metadata.total,
      prospeccao: hookLista.contagemPorEstagio['Em Prospecção'],
      respondeu: hookLista.contagemPorEstagio['Respondeu'],
      qualificado: hookLista.contagemPorEstagio['Qualificado'] + hookLista.contagemPorEstagio['Em Negociação'],
      captado: hookLista.contagemPorEstagio['Captado'],
    };
  }, [hookLista.metadata.total, hookLista.contagemPorEstagio]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proprietários</h1>
          <p className="text-slate-500">Visão unificada de prospecção e qualificação de proprietários.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={hookLista.recarregar}>
            <RefreshCw className={`w-4 h-4 mr-2 ${hookLista.carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <NovoLeadDialog onLeadCreated={hookLista.recarregar} />
          <Button onClick={() => navigate('/dashboard/proprietarios')}>
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Proprietário
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold">{chips.total}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Em Prospecção</p><p className="text-2xl font-bold">{chips.prospeccao}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Respondeu</p><p className="text-2xl font-bold">{chips.respondeu}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Qualificados</p><p className="text-2xl font-bold">{chips.qualificado}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Captados</p><p className="text-2xl font-bold">{chips.captado}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {ESTAGIOS.map((item) => (
            <button
              key={item}
              onClick={() => setEstagio(item)}
              className={`px-3 py-1.5 rounded-full text-sm border ${estagio === item ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" placeholder="Buscar por nome, telefone ou CPF" />
          </div>
          <select
            value={campanhaId}
            onChange={(e) => setCampanhaId(e.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="">Todas as campanhas</option>
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <div className="flex bg-slate-100 p-1 rounded-md">
            <button className={`px-3 py-1.5 rounded ${viewMode === 'kanban' ? 'bg-white' : ''}`} onClick={() => setViewMode('kanban')}><LayoutGrid className="w-4 h-4" /></button>
            <button className={`px-3 py-1.5 rounded ${viewMode === 'lista' ? 'bg-white' : ''}`} onClick={() => setViewMode('lista')}><LayoutList className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {hookLista.carregando && viewMode === 'lista' ? (
        <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : viewMode === 'lista' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Temperatura</TableHead>
                  <TableHead>Última interação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hookLista.dados.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/dashboard/proprietarios/${item.id}`)}>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.campanhaNome || '-'}</TableCell>
                    <TableCell>{item.estagio}</TableCell>
                    <TableCell>{iconeTemperatura(item.temperatura)}</TableCell>
                    <TableCell>{tempoRelativo(item.ultimaInteracao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {(Object.keys(kanbanCols) as EstagioProprietario[]).map((col) => (
            <Card key={col} className="h-[70vh] flex flex-col">
              <CardContent className="p-3 flex items-center justify-between border-b">
                <h3 className="text-sm font-semibold">{col}</h3>
                <span className="text-xs text-slate-500">{kanbanCols[col].length}</span>
              </CardContent>
              <div className="flex-1 overflow-auto p-2 space-y-2">
                {kanbanCols[col].map((item) => (
                  <button
                    key={`${col}-${item.id}`}
                    onClick={() => navigate(`/dashboard/proprietarios/${item.id}`)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300"
                  >
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{item.campanhaNome || 'Sem campanha'}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{iconeTemperatura(item.temperatura)}</span>
                      <span>{tempoRelativo(item.ultimaInteracao)}</span>
                    </div>
                  </button>
                ))}
                {carregandoColuna[col] && <div className="py-3 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-slate-400" /></div>}
                {!kanbanFim[col] && !carregandoColuna[col] && (
                  <Button variant="outline" className="w-full" onClick={() => carregarColuna(col)}>Carregar mais</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
