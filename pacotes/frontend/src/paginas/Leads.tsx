import { useState, useEffect } from "react";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../componentes/ui/table";
import {
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  MessageSquare,
  Loader2,
  AlertCircle,
  Send,
} from "lucide-react";
import { NovoLeadDialog } from "../componentes/NovoLeadDialog";
import { ChatModal } from "../componentes/ChatModal";
import { api } from "../servicos/api";

interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: string;
  temperatura: string;
  ultimaInteracao: string;
}

export function Leads() {
  const [termoBusca, setTermoBusca] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  useEffect(() => {
    carregarLeads();
  }, []);

  const carregarLeads = async () => {
    try {
      setLoading(true);
      const response = await api.get("/leads");
      setLeads(response.data);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
      setErro("Não foi possível carregar os leads.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NOVO":
        return "bg-blue-100 text-blue-700";
      case "QUALIFICADO":
        return "bg-green-100 text-green-700";
      case "EM_NEGOCIACAO":
        return "bg-purple-100 text-purple-700";
      case "CONTATANDO":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getTemperaturaIcon = (temp: string) => {
    switch (temp) {
      case "QUENTE":
        return "🔥";
      case "MORNO":
        return "🌤️";
      case "FRIO":
        return "❄️";
      default:
        return "";
    }
  };

  const leadsFiltrados = leads.filter(
    (lead) =>
      lead.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      lead.email?.toLowerCase().includes(termoBusca.toLowerCase()) ||
      lead.telefone?.includes(termoBusca)
  );

  const handleEnviarTeste = async (lead: Lead) => {
    if (!lead.telefone) {
      alert("Este lead não possui telefone cadastrado.");
      return;
    }

    const mensagem = window.prompt(
      `Digite a mensagem para ${lead.nome}:`,
      `Olá ${lead.nome}, isso é um teste do sistema Elyon!`
    );
    if (!mensagem) return;

    try {
      await api.post("/whatsapp/enviar", {
        telefone: lead.telefone,
        mensagem: mensagem,
      });
      alert("Mensagem enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem. Verifique se o WhatsApp está conectado.");
    }
  };

  const handleAbrirChat = (lead: Lead) => {
    setActiveLead(lead);
    setChatOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus Leads</h1>
          <p className="text-slate-500">
            Gerencie os contatos captados e qualificados pelo seu agente.
          </p>
        </div>
        <NovoLeadDialog onLeadCreated={carregarLeads} />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-10"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Última Interação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center h-32 text-slate-500"
                  >
                    Nenhum lead encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                leadsFiltrados.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-900">
                      {lead.nome}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-slate-500">
                        {lead.telefone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {lead.telefone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" /> {lead.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}
                      >
                        {lead.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-lg" title={lead.temperatura}>
                        {getTemperaturaIcon(lead.temperatura)}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        {lead.ultimaInteracao || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Abrir Chat"
                          onClick={() => handleAbrirChat(lead)}
                        >
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Enviar Teste WhatsApp"
                          onClick={() => handleEnviarTeste(lead)}
                        >
                          <Send className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <ChatModal lead={activeLead} open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
