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
  MapPin,
  FileEdit,
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
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Form state com campos separados de endereço
  const [formData, setFormData] = useState({
    nome: "",
    nomeEmpreendimento: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "GO",
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

  // Consulta CEP via ViaCEP
  const consultarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    
    try {
      setBuscandoCep(true);
      const response = await api.get(`/campanhas/cep/${cepLimpo}`);
      
      if (response.data.sucesso && response.data.dados) {
        const dados = response.data.dados;
        setFormData(prev => ({
          ...prev,
          logradouro: dados.logradouro || prev.logradouro,
          bairro: dados.bairro || prev.bairro,
          cidade: dados.cidade || prev.cidade,
          estado: dados.estado || prev.estado,
        }));
      }
    } catch (error) {
      console.error("Erro ao consultar CEP:", error);
    } finally {
      setBuscandoCep(false);
    }
  };

  const criarCampanha = async () => {
    if (
      !formData.nome ||
      !formData.nomeEmpreendimento ||
      !formData.bairro ||
      !formData.cidade
    ) {
      alert("Preencha todos os campos obrigatórios (Nome, Empreendimento, Bairro e Cidade)!");
      return;
    }

    try {
      setCriandoCampanha(true);
      const response = await api.post("/campanhas", formData);

      console.log("Campanha criada:", response.data);
      
      // Redirecionar para a página de detalhes para preencher o briefing
      setDialogOpen(false);
      setFormData({
        nome: "",
        nomeEmpreendimento: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "GO",
        tipoImovel: "Apartamento",
        perfilImovel: "Economico",
      });
      
      // Navegar para a campanha criada para preencher o briefing
      navigate(`/dashboard/campanhas/${response.data.campanha.id}?aba=empreendimento`);
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
        return "bg-emerald-100 text-emerald-700";
      case "PAUSADA":
        return "bg-amber-100 text-amber-700";
      case "FINALIZADA":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-indigo-100 text-indigo-700";
    }
  };

  const getConfiabilidadeIcon = (confiabilidade: number | null) => {
    if (!confiabilidade) return null;

    const titulo = `${Math.round(confiabilidade * 100)}% confiável`;

    if (confiabilidade >= 0.8) {
      return (
        <span title={titulo}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </span>
      );
    } else if (confiabilidade >= 0.5) {
      return (
        <span title={titulo}>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>
                Preencha os dados básicos. Você poderá adicionar o briefing do empreendimento na próxima etapa.
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

              {/* Seção de Endereço com CEP */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Endereço do Empreendimento</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">CEP</label>
                    <div className="relative">
                      <Input
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={(e) => {
                          const valor = e.target.value;
                          setFormData({ ...formData, cep: valor });
                          // Auto-consulta ao digitar 8 dígitos
                          if (valor.replace(/\D/g, '').length === 8) {
                            consultarCep(valor);
                          }
                        }}
                      />
                      {buscandoCep && (
                        <Loader2 className="w-4 h-4 absolute right-2 top-2.5 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600">Logradouro</label>
                    <Input
                      placeholder="Rua/Avenida"
                      value={formData.logradouro}
                      onChange={(e) =>
                        setFormData({ ...formData, logradouro: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Número</label>
                    <Input
                      placeholder="123"
                      value={formData.numero}
                      onChange={(e) =>
                        setFormData({ ...formData, numero: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Complemento</label>
                    <Input
                      placeholder="Bloco A"
                      value={formData.complemento}
                      onChange={(e) =>
                        setFormData({ ...formData, complemento: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600">Bairro *</label>
                    <Input
                      placeholder="Vila Rosa"
                      value={formData.bairro}
                      onChange={(e) =>
                        setFormData({ ...formData, bairro: e.target.value })
                      }
                      className={!formData.bairro ? "border-orange-300" : ""}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600">Cidade *</label>
                    <Input
                      placeholder="Goiânia"
                      value={formData.cidade}
                      onChange={(e) =>
                        setFormData({ ...formData, cidade: e.target.value })
                      }
                      className={!formData.cidade ? "border-orange-300" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600" htmlFor="estado">Estado</label>
                    <select
                      id="estado"
                      className="w-full border border-slate-200 rounded-md p-2 text-sm h-10"
                      value={formData.estado}
                      onChange={(e) =>
                        setFormData({ ...formData, estado: e.target.value })
                      }
                    >
                      <option value="GO">GO</option>
                      <option value="DF">DF</option>
                      <option value="TO">TO</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="SP">SP</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  💡 Digite o CEP para preencher automaticamente
                </p>
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

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex gap-2">
                  <FileEdit className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <strong>Próximo passo:</strong> Após criar a campanha, você
                    será direcionado para preencher o briefing do empreendimento
                    manualmente com todas as informações que o agente de IA usará.
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
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Criar Campanha
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
            <TrendingUp className="w-8 h-8 text-brand" />
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
            <Users className="w-8 h-8 text-emerald-600" />
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
            <Target className="w-8 h-8 text-violet-600" />
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
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
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
