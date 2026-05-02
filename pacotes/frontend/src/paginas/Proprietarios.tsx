import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Search, LayoutGrid, LayoutList, UserPlus, AlertCircle } from 'lucide-react';
import { api } from '../servicos/api';
import { Button } from '../componentes/ui/button';
import { Input } from '../componentes/ui/input';
import { Card, CardContent } from '../componentes/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../componentes/ui/table';
import { useProprietarios, type EstagioProprietario, type ProprietarioItem } from '../ganchos/useProprietarios';
import { useCampanhas } from '../ganchos/useCampanhas';
import { NovoLeadDialog } from '../componentes/NovoLeadDialog';
import { PageHeader } from '../componentes/ui/page-header';
import { tempoRelativo, iconeTemperatura } from '../lib/formatters';

// BUG-FIX: 'Descartado' adicionado ao funil de estágios
const ESTAGIOS: Array<EstagioProprietario | 'Todos'> = [
  'Todos', 'Em Prospecção', 'Respondeu', 'Qualificado', 'Em Negociação', 'Captado', 'Descartado',
];

const TODAS_COLUNAS: EstagioProprietario[] = [
  'Em Prospecção', 'Respondeu', 'Qualificado', 'Em Negociação', 'Captado', 'Descartado',
];

type ViewMode = 'kanban' | 'lista';

export function Proprietarios() {
  const navigate = useNavigate();
  const [busca, setBusca]                 = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [campanhaId, setCampanhaId]       = useState('');
  const [estagio, setEstagio]             = useState<EstagioProprietario | 'Todos'>('Todos');
  const [viewMode, setViewMode]           = useState<ViewMode>('kanban');

  // DUP-FIX: campanhas via hook compartilhado (removido useEffect inline)
  const { campanhas } = useCampanhas();

  // DEAD-CODE-FIX: hookLista só faz fetch em modo lista (skip=true em modo kanban)
  const hookLista = useProprietarios({
    busca: buscaDebounced, campanhaId, estagio,
    page: 1, limit: 50,
    skip: viewMode === 'kanban',
  });

  // Estado Kanban por coluna
  const kanbanColsInicial = (): Record<EstagioProprietario, ProprietarioItem[]> =>
    ({ 'Em Prospecção': [], 'Respondeu': [], 'Qualificado': [], 'Em Negociação': [], 'Captado': [], 'Descartado': [] });
  const kanbanNumerosInicial = (v: number): Record<EstagioProprietario, number> =>
    ({ 'Em Prospecção': v, 'Respondeu': v, 'Qualificado': v, 'Em Negociação': v, 'Captado': v, 'Descartado': v });
  const kanbanBoolInicial = (v: boolean): Record<EstagioProprietario, boolean> =>
    ({ 'Em Prospecção': v, 'Respondeu': v, 'Qualificado': v, 'Em Negociação': v, 'Captado': v, 'Descartado': v });

  const [kanbanCols, setKanbanCols]       = useState<Record<EstagioProprietario, ProprietarioItem[]>>(kanbanColsInicial);
  const [kanbanTotais, setKanbanTotais]   = useState<Record<EstagioProprietario, number>>(kanbanNumerosInicial(0));
  const [kanbanPaginas, setKanbanPaginas] = useState<Record<EstagioProprietario, number>>(kanbanNumerosInicial(1));
  const [kanbanFim, setKanbanFim]         = useState<Record<EstagioProprietario, boolean>>(kanbanBoolInicial(false));
  const [kanbanErros, setKanbanErros] = useState<Partial<Record<EstagioProprietario, boolean>>>({});
  const [carregandoColuna, setCarregandoColuna] = useState<Partial<Record<EstagioProprietario, boolean>>>({});

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  const carregarColuna = async (col: EstagioProprietario, reset = false) => {
    if (carregandoColuna[col]) return;
    const page = reset ? 1 : kanbanPaginas[col];

    try {
      setCarregandoColuna((prev) => ({ ...prev, [col]: true }));
      setKanbanErros((prev) => ({ ...prev, [col]: false }));

      const query = new URLSearchParams({
        estagio: col,
        page:    String(page),
        limit:   '20',
      });
      if (campanhaId)    query.set('campanhaId', campanhaId);
      if (buscaDebounced) query.set('busca',     buscaDebounced);

      const res = await api.get(`/proprietarios?${query.toString()}`);
      const data         = res.data?.data         || [];
      const totalPaginas = res.data?.metadata?.totalPaginas || 1;
      // BUG-FIX: armazenar o total real da coluna (não apenas os carregados)
      const totalReal    = res.data?.metadata?.total || 0;

      setKanbanCols((prev) => ({
        ...prev,
        [col]: reset ? data : [...prev[col], ...data],
      }));
      setKanbanTotais((prev) => ({ ...prev, [col]: totalReal }));
      setKanbanPaginas((prev) => ({ ...prev, [col]: page + 1 }));
      setKanbanFim((prev)     => ({ ...prev, [col]: page >= totalPaginas }));
    } catch (error) {
      console.error('[Proprietarios] erro ao carregar coluna', col, error);
      setKanbanErros((prev) => ({ ...prev, [col]: true }));
    } finally {
      setCarregandoColuna((prev) => ({ ...prev, [col]: false }));
    }
  };

  // Recarrega todas as colunas quando filtros mudam
  useEffect(() => {
    if (viewMode !== 'kanban') return;
    TODAS_COLUNAS.forEach((col) => carregarColuna(col, true));
  }, [campanhaId, buscaDebounced, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chips: BUG-FIX — usa countsByEstagio da API em vez de contar dos dados da página
  const chips = {
    total:      hookLista.metadata.total || kanbanTotais['Em Prospecção'] + kanbanTotais['Respondeu'] + kanbanTotais['Qualificado'] + kanbanTotais['Em Negociação'] + kanbanTotais['Captado'] + kanbanTotais['Descartado'],
    prospeccao: viewMode === 'kanban' ? kanbanTotais['Em Prospecção'] : hookLista.metadata.countsByEstagio['Em Prospecção'],
    respondeu:  viewMode === 'kanban' ? kanbanTotais['Respondeu']     : hookLista.metadata.countsByEstagio['Respondeu'],
    qualificado: viewMode === 'kanban'
      ? kanbanTotais['Qualificado'] + kanbanTotais['Em Negociação']
      : hookLista.metadata.countsByEstagio['Qualificado'] + hookLista.metadata.countsByEstagio['Em Negociação'],
    captado:     viewMode === 'kanban' ? kanbanTotais['Captado']    : hookLista.metadata.countsByEstagio['Captado'],
    descartado:  viewMode === 'kanban' ? kanbanTotais['Descartado'] : hookLista.metadata.countsByEstagio['Descartado'],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proprietários"
        description="Visão unificada de prospecção e qualificação de proprietários."
        icon={<UserPlus className="w-5 h-5" />}
        actions={(
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => viewMode === 'kanban'
                ? TODAS_COLUNAS.forEach((c) => carregarColuna(c, true))
                : hookLista.recarregar()
              }
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${hookLista.carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {/* BUG-FIX: removido botão "Novo Proprietário" duplicado que navegava para si mesmo */}
            <NovoLeadDialog onLeadCreated={() => {
              hookLista.recarregar();
              TODAS_COLUNAS.forEach((c) => carregarColuna(c, true));
            }} />
          </div>
        )}
      />

      {/* Chips de contagem — BUG-FIX: totais reais por estágio */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold">{chips.total}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Em Prospecção</p><p className="text-2xl font-bold">{chips.prospeccao}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Respondeu</p><p className="text-2xl font-bold">{chips.respondeu}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Qualificados</p><p className="text-2xl font-bold">{chips.qualificado}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Captados</p><p className="text-2xl font-bold">{chips.captado}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Descartados</p><p className="text-2xl font-bold">{chips.descartado}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {ESTAGIOS.map((item) => (
            <button
              key={item}
              onClick={() => setEstagio(item)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                estagio === item
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
              placeholder="Buscar por nome, telefone ou CPF"
            />
          </div>
          {/* DUP-FIX: campanhas via useCampanhas (removido useEffect inline) */}
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
            <button
              className={`px-3 py-1.5 rounded ${viewMode === 'kanban' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Visão Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-1.5 rounded ${viewMode === 'lista' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setViewMode('lista')}
              title="Visão Lista"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Visão Lista */}
      {viewMode === 'lista' && (
        hookLista.carregando ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
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
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/dashboard/proprietarios/${item.id}`)}
                    >
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell>{item.campanhaNome || '-'}</TableCell>
                      <TableCell>{item.estagio}</TableCell>
                      <TableCell>{iconeTemperatura(item.temperatura)}</TableCell>
                      <TableCell className="text-slate-500">{tempoRelativo(item.ultimaInteracao)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* GAP-FIX: estado vazio */}
              {!hookLista.carregando && hookLista.dados.length === 0 && (
                <div className="py-16 text-center text-slate-400">
                  <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum proprietário encontrado para os filtros selecionados.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* Visão Kanban */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          {TODAS_COLUNAS.map((col) => (
            <Card key={col} className="h-[70vh] flex flex-col">
              <CardContent className="p-3 flex items-center justify-between border-b flex-shrink-0">
                <h3 className="text-sm font-semibold truncate">{col}</h3>
                {/* BUG-FIX: mostra total real da coluna (não apenas carregados) */}
                <span className="text-xs text-slate-500 ml-1 flex-shrink-0">
                  {kanbanCols[col].length}{kanbanTotais[col] > kanbanCols[col].length ? `/${kanbanTotais[col]}` : ''}
                </span>
              </CardContent>
              <div className="flex-1 overflow-auto p-2 space-y-2">
                {kanbanCols[col].map((item) => (
                  <button
                    key={`${col}-${item.id}`}
                    onClick={() => navigate(`/dashboard/proprietarios/${item.id}`)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{item.campanhaNome || 'Sem campanha'}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{iconeTemperatura(item.temperatura)}</span>
                      <span>{tempoRelativo(item.ultimaInteracao)}</span>
                    </div>
                  </button>
                ))}

                {carregandoColuna[col] && (
                  <div className="py-3 text-center">
                    <Loader2 className="w-4 h-4 animate-spin inline text-slate-400" />
                  </div>
                )}

                {/* GAP-FIX: estado de erro por coluna */}
                {kanbanErros[col] && !carregandoColuna[col] && (
                  <div className="py-3 text-center space-y-2">
                    <AlertCircle className="w-5 h-5 text-red-400 mx-auto" />
                    <p className="text-xs text-red-500">Falha ao carregar</p>
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => carregarColuna(col, true)}>
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {/* GAP-FIX: estado vazio da coluna */}
                {!carregandoColuna[col] && !kanbanErros[col] && kanbanCols[col].length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">Sem registros</p>
                )}

                {!kanbanFim[col] && !carregandoColuna[col] && !kanbanErros[col] && kanbanCols[col].length > 0 && (
                  <Button variant="outline" className="w-full text-xs" onClick={() => carregarColuna(col)}>
                    Carregar mais
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
