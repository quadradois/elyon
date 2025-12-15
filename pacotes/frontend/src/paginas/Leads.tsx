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
  Loader2,
  AlertCircle,
  Send,
  Eye,
  X,
  RefreshCw,
  Users,
  Flame,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { NovoLeadDialog } from "../componentes/NovoLeadDialog";
import { ChatModal } from "../componentes/ChatModal";
import { api } from "../servicos/api";

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
  { value: "NOVO", label: "Novo" },
  { value: "CONTATO_INICIAL", label: "Contato Inicial" },
  { value: "QUALIFICADO", label: "Qualificado" },
  { value: "APRESENTACAO", label: "Apresentação" },
  { value: "PROPOSTA", label: "Proposta" },
  { value: "NEGOCIACAO", label: "Negociação" },
  { value: "CAPTADO", label: "Captado" },
  { value: "PERDIDO", label: "Perdido" },
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
    NOVO: { label: "Novo", className: "bg-blue-100 text-blue-700 border-blue-200" },
    CONTATO_INICIAL: { label: "Contato", className: "bg-sky-100 text-sky-700 border-sky-200" },
    QUALIFICADO: { label: "Qualificado", className: "bg-purple-100 text-purple-700 border-purple-200" },
    APRESENTACAO: { label: "Apresentação", className: "bg-amber-100 text-amber-700 border-amber-200" },
    PROPOSTA: { label: "Proposta", className: "bg-orange-100 text-orange-700 border-orange-200" },
    NEGOCIACAO: { label: "Negociação", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
    CAPTADO: { label: "Captado", className: "bg-green-100 text-green-700 border-green-200" },
    PERDIDO: { label: "Perdido", className: "bg-red-100 text-red-700 border-red-200" },
    ARQUIVADO: { label: "Arquivado", className: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  return badges[status] || { label: status, className: "bg-gray-100 text-gray-700" };
}

function getTemperaturaBadge(temp: string | null): { label: string; className: string } {
  const badges: Record<string, { label: string; className: string }> = {
    QUENTE: { label: "🔥 Quente", className: "bg-red-50 text-red-600 border-red-200" },
    MORNO: { label: "⚡ Morno", className: "bg-yellow-50 text-yellow-600 border-yellow-200" },
    FRIO: { label: "❄️ Frio", className: "bg-blue-50 text-blue-600 border-blue-200" },
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

  // Modal
  const [chatOpen, setChatOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setErro("");

      const [resLeads, resStats] = await Promise.all([
        api.get("/leads"),
        api.get("/leads/estatisticas").catch(() => ({ data: null })),
      ]);

      setLeads(resLeads.data);

      if (resStats.data) {
        setEstatisticas(resStats.data);
      } else {
        // Calcular estatísticas localmente se endpoint não existir
        const leadsData = resLeads.data as Lead[];
        setEstatisticas({
          total: leadsData.length,
          quentes: leadsData.filter(l => l.temperatura === "QUENTE").length,
          agendamentosHoje: leadsData.filter(l => {
            if (!l.proximaAtividade?.dataAgendada) return false;
            const hoje = new Date().toDateString();
            return new Date(l.proximaAtividade.dataAgendada).toDateString() === hoje;
          }).length,
          novosHoje: leadsData.filter(l => {
            const hoje = new Date().toDateString();
            return new Date(l.dataCriacao).toDateString() === hoje;
          }).length,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
      setErro("Não foi possível carregar os leads.");
    } finally {
      setLoading(false);
    }
  };

  const leadsFiltrados = leads.filter((lead) => {
    const nome = lead.nome || lead.contato?.nome || "";
    const telefone = lead.telefone || lead.contato?.telefone || "";
    const email = lead.email || lead.contato?.email || "";

    const matchBusca = termoBusca === "" ||
      nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      telefone.includes(termoBusca) ||
      email.toLowerCase().includes(termoBusca.toLowerCase());

    const matchStatus = filtroStatus === "" || lead.status === filtroStatus;
    const matchTemp = filtroTemperatura === "" || lead.temperatura === filtroTemperatura;

    return matchBusca && matchStatus && matchTemp;
  });

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
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Leads</h1>
          <p className="text-slate-500">
            Proprietários de imóveis interessados em vender ou alugar — qualificados pelo agente.
          </p>
        </div>
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
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Leads Quentes</p>
                <p className="text-2xl font-bold text-gray-900">{estatisticas.quentes}</p>
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
                <p className="text-sm font-medium text-gray-500">Agendamentos Hoje</p>
                <p className="text-2xl font-bold text-gray-900">{estatisticas.agendamentosHoje}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Novos Hoje</p>
                <p className="text-2xl font-bold text-gray-900">{estatisticas.novosHoje}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                  className={mostrarFiltros ? "bg-gray-100" : ""}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  {temFiltrosAtivos && (
                    <span className="ml-2 h-2 w-2 rounded-full bg-blue-500" />
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
                  <label htmlFor="filtro-status" className="text-xs font-medium text-gray-500 mb-1 block">
                    Status
                  </label>
                  <select
                    id="filtro-status"
                    title="Filtrar por status"
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-48">
                  <label htmlFor="filtro-temperatura" className="text-xs font-medium text-gray-500 mb-1 block">
                    Temperatura
                  </label>
                  <select
                    id="filtro-temperatura"
                    title="Filtrar por temperatura"
                    value={filtroTemperatura}
                    onChange={(e) => setFiltroTemperatura(e.target.value)}
                    className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
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

      {/* Tabela */}
      <Card>
        {loading ? (
          <CardContent className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </CardContent>
        ) : leadsFiltrados.length === 0 ? (
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Users className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {temFiltrosAtivos ? "Nenhum lead encontrado" : "Nenhum lead cadastrado"}
            </h3>
            <p className="text-gray-500 mb-4">
              {temFiltrosAtivos
                ? "Tente ajustar os filtros de busca"
                : "Comece adicionando seu primeiro lead"
              }
            </p>
            {temFiltrosAtivos ? (
              <Button variant="outline" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            ) : (
              <NovoLeadDialog onLeadCreated={carregarDados} />
            )}
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
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium text-gray-900">{nome}</div>
                        {lead.proximaAtividade && (
                          <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {lead.proximaAtividade.tipo} - {formatarData(lead.proximaAtividade.dataAgendada)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {telefone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {telefone}
                            </div>
                          )}
                          {email && (
                            <div className="text-xs text-gray-400 truncate max-w-[180px]">
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
                        <span className="text-sm text-gray-500">
                          {lead.origem || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">
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
                            <DropdownMenuItem onClick={() => navigate(`/dashboard/leads/${lead.id}`)}>
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
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Mostrando {leadsFiltrados.length} de {leads.length} leads
              </p>
            </div>
          </>
        )}
      </Card>

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
