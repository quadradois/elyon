import { useState, useEffect } from "react";
import { api } from "../servicos/api";
import {
  Bot,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Pause,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../componentes/ui/card";
import { Badge } from "../componentes/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../componentes/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../componentes/ui/page-header";
import { EmptyState } from "../componentes/ui/empty-state";

interface Agente {
  id: string;
  nome: string;
  tipoAgente: string;
  status: string;
  estaAtivo: boolean;
  sessaoWhatsapp?: {
    nome: string;
    numeroWhatsapp: string | null;
  };
}

export function MeusAgentes() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    carregarAgentes();
  }, []);

  const carregarAgentes = async () => {
    try {
      setLoading(true);
      // TODO: Backend needs to support listing multiple agents.
      // Currently GET /api/agentes returns { agente: ... } (single).
      // We might need to update backend to return { agentes: [...] } or create a new endpoint.
      // For now, assuming the backend will be updated to return a list or we handle the single one.

      const response = await api.get("/agentes");

      // Handle both single object (legacy) and array (future)
      if (response.data.agentes) {
        setAgentes(response.data.agentes);
      } else if (response.data.agente) {
        setAgentes([response.data.agente]);
      } else {
        setAgentes([]);
      }
    } catch (error) {
      console.error("Erro ao carregar agentes:", error);
      // Don't show error if 404 (just means no agents)
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, atualAtivo: boolean) => {
    try {
      const endpoint = atualAtivo ? "pausar" : "ativar";
      await api.patch(`/agentes/${id}/${endpoint}`);
      toast.success(`Agente ${atualAtivo ? "pausado" : "ativado"} com sucesso`);
      carregarAgentes();
    } catch (error: any) {
      toast.error("Erro ao alterar status", {
        description: error.response?.data?.erro || "Tente novamente",
      });
    }
  };

  const excluirAgente = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agente?")) return;

    try {
      await api.delete(`/agentes/${id}`);
      toast.success("Agente excluído");
      carregarAgentes();
    } catch (error) {
      toast.error("Erro ao excluir agente");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Agentes"
        description="Gerencie seus assistentes virtuais"
        icon={<Bot className="w-5 h-5" />}
        actions={(
          <Button
            onClick={() => navigate("/dashboard/agente/novo")}
            className="bg-brand hover:bg-brand-dark"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Agente
          </Button>
        )}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
        </div>
      ) : agentes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10">
            <EmptyState
              tipo="generico"
              titulo="Nenhum agente encontrado"
              descricao="Crie seu primeiro agente para começar a atender leads automaticamente."
              acao={{ texto: "Criar Primeiro Agente", onClick: () => navigate("/dashboard/agente/novo") }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agentes.map((agente) => (
            <Card
              key={agente.id}
              interactive
              className="overflow-hidden card-premium"
            >
              <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {agente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900">
                        {agente.nome}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {agente.tipoAgente.replace("_", " ")}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={agente.estaAtivo ? "default" : "secondary"}
                    className={agente.estaAtivo ? "bg-success" : ""}
                  >
                    {agente.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Sessão WhatsApp
                    </span>
                    <span className="font-medium text-slate-900">
                      {agente.sessaoWhatsapp?.nome || "Não vinculada"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/dashboard/agente/${agente.id}`)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Mais opções do agente">
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          toggleStatus(agente.id, agente.estaAtivo)
                        }
                      >
                        {agente.estaAtivo ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-700 focus:bg-red-50"
                        onClick={() => excluirAgente(agente.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
