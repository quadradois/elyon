// @deprecated — substituído por Proprietarios.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Card, CardContent } from "../componentes/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../componentes/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../componentes/ui/dropdown-menu";
import {
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  MessageSquare,
  AlertCircle,
  Send,
  Eye,
  X,
  RefreshCw,
  Users,
  Flame,
  Calendar,
  TrendingUp,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { NovoLeadDialog } from "../componentes/NovoLeadDialog";
import { ChatModal } from "../componentes/ChatModal";
import { KanbanLeads } from "../componentes/KanbanLeads";
import { api } from "../servicos/api";
import { PageHeader } from "../componentes/ui/page-header";
import { SkeletonTable } from "../componentes/ui/skeleton";
import { EmptyState } from "../componentes/ui/empty-state";

// Tipos
interface Lead {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  status: string;
  temperatura: string | null;
  observacoes: string | null;
  dataCriacao: string;
  dataUltimaInteracao: string | null;
  contato?: {
    nome: string | null;
    telefone: string | null;
    email: string | null;
  };
  proximaAtividade?: {
    tipo: string;
    dataAgendada: string;
    descricao: string | null;
  } | null;
}

interface Estatisticas {
  total: number;
  quentes: number;
  agendamentosHoje: number;
  novosHoje: number;
}

// Constantes
const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "NOVO", label: "Novos" },
  { value: "TENTATIVA_AGENDAMENTO", label: "Tentando Agendar" },
  { value: "VISITA_AGENDADA", label: "Visita Agendada" },
  { value: "AVALIACAO_EM_ANDAMENTO", label: "Avaliação/Fotos" },
  { value: "DOCUMENTACAO", label: "Documentação" },
  { value: "CAPTADO", label: "Captado" },
  { value: "PERDIDO", label: "Perdido" },
  { value: "ARQUIVADO", label: "Arquivado" },
];

const TEMPERATURA_OPTIONS = [
  { value: "", label: "Todas temperaturas" },
  { value: "QUENTE", label: "🔥 Quente" },
  { value: "MORNO", label: "⚡ Morno" },
  { value: "FRIO", label: "❄️ Frio" },
];

// Helpers
function formatarData(data: string | null): string {
  if (!data) return "-";
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getStatusBadge(status: string): { label: string; className: string } {
  const badges: Record<string, { label: string; className: string }> = {
    NOVO: { label: "Novo", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    TENTATIVA_AGENDAMENTO: { label: "Tentando Agendar", className: "bg-sky-100 text-sky-700 border-sky-200" },
    VISITA_AGENDADA: { label: "Visita Marcada", className: "bg-amber-100 text-amber-700 border-amber-200" },
    AVALIACAO_EM_ANDAMENTO: { label: "Avaliação/Fotos", className: "bg-violet-100 text-violet-700 border-violet-200" },
    DOCUMENTACAO: { label: "Documentação", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    CAPTADO: { label: "Captado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    PERDIDO: { label: "Perdido", className: "bg-red-100 text-red-700 border-red-200" },
    ARQUIVADO: { label: "Arquivado", className: "bg-slate-100 text-slate-700 border-slate-200" },
  };
  return badges[status] || { label: status, className: "bg-slate-100 text-slate-700" };
}

function getTemperaturaBadge(temp: string | null): { label: string; className: string } {
  const badges: Record<string, { label: string; className: string }> = {
    QUENTE: { label: "🔥 Quente", className: "bg-red-50 text-red-600 border-red-200" },
    MORNO: { label: "⚡ Morno", className: "bg-amber-50 text-amber-600 border-amber-200" },
    FRIO: { label: "❄️ Frio", className: "bg-indigo-50 text-brand border-indigo-200" },
  };
  return badges[temp || ""] || { label: "-", className: "" };
}

export function Leads() {
  const navigate = useNavigate();

  // States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    total: 0,
    quentes: 0,
    agendamentosHoje: 0,
    novosHoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Filtros
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTemperatura, setFiltroTemperatura] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");

  // Paginação Server-side
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  // Modal
  const [chatOpen, setChatOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  // Debounce da busca digitada
  useEffect(() => {
    setPaginaAtual(1);
    const delay = setTimeout(() => {
      carregarDados();
    }, 500);
    return () => clearTimeout(delay);
  }, [termoBusca, filtroStatus, filtroTemperatura, viewMode]);

  useEffect(() => {
    carregarDados();
  }, [paginaAtual]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro("");

      const limit = viewMode === "kanban" ? 500 : 50;
      const params = new URLSearchParams({
        page: paginaAtual.toString(),
        limit: limit.toString()
      });

      if (termoBusca) params.append('busca', termoBusca);
      if (filtroStatus) params.append('status', filtroStatus);
      if (filtroTemperatura) params.append('temperatura', filtroTemperatura);

      const [resLeads, resStats] = await Promise.all([
        api.get(`/leads?${params.toString()}`),
        api.get("/leads/estatisticas").catch(() => ({ data: null })),
      ]);

      if (resLeads.data?.metadata) {
        setLeads(resLeads.data.data);
        setTotalPaginas(resLeads.data.metadata.totalPaginas || 1);
        setTotalLeads(resLeads.data.metadata.total || 0);
      } else {
        setLeads(Array.isArray(resLeads.data) ? resLeads.data : []);
        setTotalPaginas(1);
        setTotalLeads(Array.isArray(resLeads.data) ? resLeads.data.length : 0);
      }

      if (resStats.data) {
        setEstatisticas(resStats.data);
      }
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
      setErro("Não foi possível carregar os leads.");
    } finally {
      setLoading(false);
    }
  };

  // Filtro no backend
  const leadsFiltrados = leads;

  const temFiltrosAtivos = termoBusca || filtroStatus || filtroTemperatura;

  const limparFiltros = () => {
    setTermoBusca("");
    setFiltroStatus("");
    setFiltroTemperatura("");
  };

  const handleAbrirChat = (lead: Lead) => {
    setActiveLead(lead);
    setChatOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Meus Leads"
        description="Proprietários de imóveis interessados em vender ou alugar — qualificados pelo agente."
        icon={<Users className="w-5 h-5" />}
        actions={(
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={carregarDados}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <NovoLeadDialog onLeadCreated={carregarDados} />
          </div>
        )}
      />

      {/* Tabs de Visualização */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
        <button
          onClick={() => setViewMode('kanban')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'kanban'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Kanban
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <LayoutList className="w-4 h-4" />
          Lista
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total de Leads</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-brand" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Leads Quentes</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.quentes}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <Flame className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Agendamentos Hoje</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.agendamentosHoje}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Novos Hoje</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.novosHoje}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Linha principal */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome, telefone ou email..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMostrarFiltros(!mostrarFiltros)}
                  className={mostrarFiltros ? "bg-slate-100" : ""}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {temFiltrosAtivos && (
                    <span className="ml-2 h-2 w-2 rounded-full bg-brand" />
                  )}
                </Button>

                {temFiltrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {/* Filtros expandidos */}
            {mostrarFiltros && (
              <div className="flex flex-wrap gap-3 pt-3 border-t">
                <div className="w-48">
                  <label htmlFor="filtro-status" className="text-xs font-medium text-slate-500 mb-1 block">
                    Status
                  </label>
                  <select
                    id="filtro-status"
                    title="Filtrar por status"
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-48">
                  <label htmlFor="filtro-temperatura" className="text-xs font-medium text-slate-500 mb-1 block">
                    Temperatura
                  </label>
                  <select
                    id="filtro-temperatura"
                    title="Filtrar por temperatura"
                    value={filtroTemperatura}
                    onChange={(e) => setFiltroTemperatura(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm"
                  >
                    {TEMPERATURA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {/* Tabela ou Kanban */}
      {viewMode === 'kanban' ? (
        <div className="overflow-hidden">
          {loading ? (
            <div className="p-2">
              <SkeletonTable rows={6} columns={4} />
            </div>
          ) : (
            <KanbanLeads leads={leadsFiltrados} onLeadUpdate={carregarDados} />
          )}
        </div>
      ) : (
        <Card>
          {loading ? (
            <CardContent className="p-4">
              <SkeletonTable rows={8} columns={7} />
            </CardContent>
          ) : leadsFiltrados.length === 0 ? (
            <CardContent className="p-8">
              <EmptyState
                tipo={temFiltrosAtivos ? "busca-sem-resultado" : "nenhum-lead"}
                titulo={temFiltrosAtivos ? "Nenhum lead encontrado" : "Nenhum lead cadastrado"}
                descricao={temFiltrosAtivos ? "Tente ajustar os filtros de busca." : "Comece adicionando seu primeiro lead."}
                acao={temFiltrosAtivos
                  ? { texto: "Limpar filtros", onClick: limparFiltros }
                  : undefined}
              />
            </CardContent>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Lead</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Temperatura</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsFiltrados.map((lead) => {
                    const nome = lead.nome || lead.contato?.nome || "Sem nome";
                    const telefone = lead.telefone || lead.contato?.telefone;
                    const email = lead.email || lead.contato?.email;
                    const statusBadge = getStatusBadge(lead.status);
                    const tempBadge = getTemperaturaBadge(lead.temperatura);

                    return (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/dashboard/proprietarios/${lead.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium text-slate-900">{nome}</div>
                          {lead.proximaAtividade && (
                            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {lead.proximaAtividade.tipo} - {formatarData(lead.proximaAtividade.dataAgendada)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {telefone && (
                              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                <Phone className="h-3 w-3" />
                                {telefone}
                              </div>
                            )}
                            {email && (
                              <div className="text-xs text-slate-400 truncate max-w-[180px]">
                                {email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          {lead.temperatura && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tempBadge.className}`}>
                              {tempBadge.label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">
                            {lead.origem || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">
                            {formatarData(lead.dataCriacao)}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/proprietarios/${lead.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAbrirChat(lead)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Abrir chat
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {telefone && (
                                <>
                                  <DropdownMenuItem onClick={() => {
                                    const numero = telefone.replace(/\D/g, "");
                                    window.open(`https://wa.me/55${numero}`, "_blank");
                                  }}>
                                    <Send className="h-4 w-4 mr-2" />
                                    WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => window.open(`tel:${telefone.replace(/\D/g, "")}`, "_self")}
                                  >
                                    <Phone className="h-4 w-4 mr-2" />
                                    Ligar
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Footer da tabela */}
              <div className="px-4 py-3 border-t bg-slate-50 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Mostrando {leads.length} de {totalLeads} leads
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1 || loading}
                  >
                    Anterior
                  </Button>
                  <div className="flex items-center text-sm font-medium px-2">
                    {paginaAtual} / {totalPaginas}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual >= totalPaginas || loading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      <ChatModal
        lead={activeLead ? {
          id: activeLead.id,
          nome: activeLead.nome || activeLead.contato?.nome || "Lead",
          telefone: activeLead.telefone || activeLead.contato?.telefone || null
        } : null}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />
    </div>
  );
}
