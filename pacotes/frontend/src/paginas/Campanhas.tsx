import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../componentes/ui/dialog";
import {
  Search,
  Plus,
  TrendingUp,
  Users,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Info,
} from "lucide-react";
import { api } from "../servicos/api";

interface Campanha {
  id: string;
  nome: string;
  empreendimento: string | null;
  status: string;
  totalContatos: number;
  totalLeads: number;
  temBriefing: boolean;
  confiabilidade: number | null;
  criadoEm: string;
}

export function Campanhas() {
  const navigate = useNavigate();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    nomeEmpreendimento: "",
    localizacao: "",
    cep: "",
    tipoImovel: "Apartamento",
    perfilImovel: "Economico",
  });

  useEffect(() => {
    carregarCampanhas();
  }, []);

  const carregarCampanhas = async () => {
    try {
      setLoading(true);
      const response = await api.get("/campanhas");
      setCampanhas(response.data.campanhas || []);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
      setErro("Não foi possível carregar as campanhas.");
    } finally {
      setLoading(false);
    }
  };

  const criarCampanha = async () => {
    if (
      !formData.nome ||
      !formData.nomeEmpreendimento ||
      !formData.localizacao
    ) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }

    try {
      setCriandoCampanha(true);
      const response = await api.post(
        "/campanhas/criar-com-pesquisa",
        formData
      );

      console.log("Campanha criada:", response.data);
      alert("✅ Campanha criada e empreendimento pesquisado com sucesso!");

      setDialogOpen(false);
      setFormData({
        nome: "",
        nomeEmpreendimento: "",
        localizacao: "",
        cep: "",
        tipoImovel: "Apartamento",
        perfilImovel: "Economico",
      });

      carregarCampanhas();
    } catch (error: any) {
      console.error("Erro ao criar campanha:", error);
      alert(`Erro: ${error.response?.data?.erro || error.message}`);
    } finally {
      setCriandoCampanha(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATIVA":
        return "bg-green-100 text-green-700";
      case "PAUSADA":
        return "bg-yellow-100 text-yellow-700";
      case "FINALIZADA":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getConfiabilidadeIcon = (confiabilidade: number | null) => {
    if (!confiabilidade) return null;

    const titulo = `${Math.round(confiabilidade * 100)}% confiável`;

    if (confiabilidade >= 0.8) {
      return (
        <span title={titulo}>
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        </span>
      );
    } else if (confiabilidade >= 0.5) {
      return (
        <span title={titulo}>
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
        </span>
      );
    } else {
      return (
        <span title={titulo}>
          <AlertCircle className="w-4 h-4 text-red-600" />
        </span>
      );
    }
  };

  const campanhasFiltradas = campanhas.filter(
    (c) =>
      c.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      c.empreendimento?.toLowerCase().includes(termoBusca.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campanhas</h1>
          <p className="text-slate-500">
            Gerencie suas campanhas de prospecção com inteligência automática.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>
                O sistema pesquisará automaticamente informações sobre o
                empreendimento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">
                  Nome da Campanha *
                </label>
                <Input
                  placeholder="Ex: Prospecção Reserva Buriti - Dez/2025"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">
                    Nome do Empreendimento *
                  </label>
                  <Input
                    placeholder="Ex: Reserva Buriti"
                    value={formData.nomeEmpreendimento}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nomeEmpreendimento: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    CEP (Recomendado)
                  </label>
                  <Input
                    placeholder="Ex: 74425-050"
                    value={formData.cep}
                    onChange={(e) =>
                      setFormData({ ...formData, cep: e.target.value })
                    }
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    CEP garante maior precisão na pesquisa
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Localização Completa *
                </label>
                <Input
                  placeholder="Ex: Avenida Vitória, 51, Vila Rosa, Goiânia"
                  value={formData.localizacao}
                  onChange={(e) =>
                    setFormData({ ...formData, localizacao: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium" htmlFor="tipoImovel">Tipo de Imóvel</label>
                  <select
                    id="tipoImovel"
                    className="w-full border border-slate-200 rounded-md p-2 text-sm"
                    value={formData.tipoImovel}
                    onChange={(e) =>
                      setFormData({ ...formData, tipoImovel: e.target.value })
                    }
                  >
                    <option>Apartamento</option>
                    <option>Casa</option>
                    <option>Lote</option>
                    <option>Comercial</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium" htmlFor="perfilImovel">Perfil</label>
                  <select
                    id="perfilImovel"
                    className="w-full border border-slate-200 rounded-md p-2 text-sm"
                    value={formData.perfilImovel}
                    onChange={(e) =>
                      setFormData({ ...formData, perfilImovel: e.target.value })
                    }
                  >
                    <option value="Economico">Econômico</option>
                    <option value="Medio">Médio Padrão</option>
                    <option value="Alto">Alto Padrão</option>
                    <option value="Luxo">Luxo</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex gap-2">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <strong>Pesquisa Automática:</strong> Ao criar a campanha, o
                    sistema usará Google + GPT-4 para coletar dados reais sobre
                    preços, características e diferenciais do empreendimento.
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={criandoCampanha}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={criarCampanha}
                  disabled={criandoCampanha}
                  className="gap-2"
                >
                  {criandoCampanha ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Pesquisando...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      Criar e Pesquisar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total de Campanhas</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {campanhas.length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total de Contatos</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {campanhas.reduce((acc, c) => acc + c.totalContatos, 0)}
              </p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Leads Qualificados</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {campanhas.reduce((acc, c) => acc + c.totalLeads, 0)}
              </p>
            </div>
            <Target className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou empreendimento..."
            className="pl-10"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {erro && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Empreendimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contatos</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Precisão</TableHead>
                <TableHead className="text-right">Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center h-32 text-slate-500"
                  >
                    Nenhuma campanha encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                campanhasFiltradas.map((campanha) => (
                  <TableRow
                    key={campanha.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() =>
                      navigate(`/dashboard/campanhas/${campanha.id}`)
                    }
                  >
                    <TableCell className="font-medium text-slate-900">
                      {campanha.nome}
                    </TableCell>
                    <TableCell>
                      {campanha.empreendimento ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {campanha.empreendimento}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campanha.status)}`}
                      >
                        {campanha.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {campanha.totalContatos}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {campanha.totalLeads}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {campanha.temBriefing ? (
                          <>
                            {getConfiabilidadeIcon(campanha.confiabilidade)}
                            <span className="text-sm text-slate-600">
                              {campanha.confiabilidade
                                ? `${Math.round(campanha.confiabilidade * 100)}%`
                                : "-"}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-sm">
                            Sem briefing
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-500">
                      {new Date(campanha.criadoEm).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
