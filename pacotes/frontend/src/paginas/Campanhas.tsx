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
import { PageHeader } from "../componentes/ui/page-header";
import { SkeletonTable } from "../componentes/ui/skeleton";
import { EmptyState } from "../componentes/ui/empty-state";
import { servicoUsuarios, Usuario } from "../servicos/servico-usuarios";

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
  responsavelCorretorId?: string | null;
  fallbackCorretorId?: string | null;
  responsavelCorretor?: { id: string; nome: string; estaAtivo: boolean } | null;
  fallbackCorretor?: { id: string; nome: string; estaAtivo: boolean } | null;
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
  const [corretores, setCorretores] = useState<Usuario[]>([]);
  const [carregandoCorretores, setCarregandoCorretores] = useState(false);
  const [campanhaEditando, setCampanhaEditando] = useState<Campanha | null>(null);
  const [salvandoResponsaveis, setSalvandoResponsaveis] = useState(false);
  const [responsaveisForm, setResponsaveisForm] = useState({
    responsavelCorretorId: "",
    fallbackCorretorId: "",
  });

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
    responsavelCorretorId: "",
    fallbackCorretorId: "",
  });

  useEffect(() => {
    carregarCampanhas();
    carregarCorretores();
  }, []);

  const telefoneValidoWhatsapp = (telefone?: string) => {
    if (!telefone) return false;
    const digitos = telefone.replace(/\D/g, "");
    return digitos.length >= 10;
  };

  const carregarCorretores = async () => {
    try {
      setCarregandoCorretores(true);
      const response = await servicoUsuarios.listar({ pagina: 1 });
      const equipe = response?.dados || [];
      setCorretores(equipe.filter((u) => u.papel === "CORRETOR"));
    } catch (error) {
      console.error("Erro ao carregar corretores:", error);
      setCorretores([]);
    } finally {
      setCarregandoCorretores(false);
    }
  };

  const corretoresElegiveis = corretores.filter(
    (u) => u.estaAtivo && telefoneValidoWhatsapp(u.telefone)
  );

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
      !formData.cidade ||
      !formData.responsavelCorretorId ||
      !formData.fallbackCorretorId
    ) {
      alert("Preencha todos os campos obrigatórios, incluindo responsável e fallback.");
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
        responsavelCorretorId: "",
        fallbackCorretorId: "",
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

  const abrirEdicaoResponsaveis = (campanha: Campanha) => {
    setCampanhaEditando(campanha);
    setResponsaveisForm({
      responsavelCorretorId: campanha.responsavelCorretorId || "",
      fallbackCorretorId: campanha.fallbackCorretorId || "",
    });
  };

  const salvarResponsaveis = async () => {
    if (!campanhaEditando) return;
    if (!responsaveisForm.responsavelCorretorId || !responsaveisForm.fallbackCorretorId) {
      alert("Selecione o responsável principal e o fallback.");
      return;
    }
    if (responsaveisForm.responsavelCorretorId === responsaveisForm.fallbackCorretorId) {
      alert("Responsável principal e fallback devem ser pessoas diferentes.");
      return;
    }

    try {
      setSalvandoResponsaveis(true);
      const response = await api.patch(
        `/campanhas/${campanhaEditando.id}/responsaveis`,
        responsaveisForm
      );
      const atualizada = response.data.campanha;
      setCampanhas((atuais) => atuais.map((campanha) =>
        campanha.id === campanhaEditando.id
          ? { ...campanha, ...atualizada }
          : campanha
      ));
      setCampanhaEditando(null);
    } catch (error: any) {
      console.error("Erro ao atualizar responsáveis:", error);
      alert(error.response?.data?.erro || "Não foi possível atualizar os responsáveis.");
    } finally {
      setSalvandoResponsaveis(false);
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
      <PageHeader
        title="Campanhas"
        description="Gerencie suas campanhas de prospecção com inteligência automática."
        icon={<TrendingUp className="w-5 h-5" />}
        actions={(
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
                <label htmlFor="nome-campanha" className="text-sm font-medium">
                  Nome da Campanha *
                </label>
                <Input
                  id="nome-campanha"
                  placeholder="Ex: Prospecção Reserva Buriti - Dez/2025"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                />
              </div>

              <div>
                <label htmlFor="nome-empreendimento" className="text-sm font-medium">
                  Nome do Empreendimento *
                </label>
                <Input
                  id="nome-empreendimento"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="cep-empreendimento" className="text-xs font-medium text-slate-600">CEP</label>
                    <div className="relative">
                      <Input
                        id="cep-empreendimento"
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
                    <label htmlFor="logradouro-empreendimento" className="text-xs font-medium text-slate-600">Logradouro</label>
                    <Input
                      id="logradouro-empreendimento"
                      placeholder="Rua/Avenida"
                      value={formData.logradouro}
                      onChange={(e) =>
                        setFormData({ ...formData, logradouro: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label htmlFor="numero-empreendimento" className="text-xs font-medium text-slate-600">Número</label>
                    <Input
                      id="numero-empreendimento"
                      placeholder="123"
                      value={formData.numero}
                      onChange={(e) =>
                        setFormData({ ...formData, numero: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="complemento-empreendimento" className="text-xs font-medium text-slate-600">Complemento</label>
                    <Input
                      id="complemento-empreendimento"
                      placeholder="Bloco A"
                      value={formData.complemento}
                      onChange={(e) =>
                        setFormData({ ...formData, complemento: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="bairro-empreendimento" className="text-xs font-medium text-slate-600">Bairro *</label>
                    <Input
                      id="bairro-empreendimento"
                      placeholder="Vila Rosa"
                      value={formData.bairro}
                      onChange={(e) =>
                        setFormData({ ...formData, bairro: e.target.value })
                      }
                      className={!formData.bairro ? "border-orange-300" : ""}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div className="col-span-2">
                    <label htmlFor="cidade-empreendimento" className="text-xs font-medium text-slate-600">Cidade *</label>
                    <Input
                      id="cidade-empreendimento"
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

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="text-sm font-medium text-slate-700">
                  Responsável de Handoff *
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="responsavelCorretorId" className="text-xs font-medium text-slate-600">
                      Corretor responsável
                    </label>
                    <select
                      id="responsavelCorretorId"
                      className="w-full border border-slate-200 rounded-md p-2 text-sm h-10"
                      value={formData.responsavelCorretorId}
                      onChange={(e) => setFormData({ ...formData, responsavelCorretorId: e.target.value })}
                    >
                      <option value="">{carregandoCorretores ? "Carregando..." : "Selecione"}</option>
                      {corretoresElegiveis.map((corretor) => (
                        <option key={corretor.id} value={corretor.id}>
                          {corretor.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="fallbackCorretorId" className="text-xs font-medium text-slate-600">
                      Corretor fallback
                    </label>
                    <select
                      id="fallbackCorretorId"
                      className="w-full border border-slate-200 rounded-md p-2 text-sm h-10"
                      value={formData.fallbackCorretorId}
                      onChange={(e) => setFormData({ ...formData, fallbackCorretorId: e.target.value })}
                    >
                      <option value="">{carregandoCorretores ? "Carregando..." : "Selecione"}</option>
                      {corretoresElegiveis.map((corretor) => (
                        <option key={corretor.id} value={corretor.id}>
                          {corretor.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Apenas corretores ativos e com WhatsApp válido aparecem para evitar handoff inválido.
                </p>
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
        )}
      />

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

      <Dialog
        open={Boolean(campanhaEditando)}
        onOpenChange={(open) => !open && setCampanhaEditando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar responsáveis</DialogTitle>
            <DialogDescription>
              Defina quem recebe os atendimentos da campanha {campanhaEditando?.nome} e quem assume quando houver recusa ou indisponibilidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="editarResponsavelCorretorId" className="text-sm font-medium text-slate-700">
                Responsável principal
              </label>
              <select
                id="editarResponsavelCorretorId"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={responsaveisForm.responsavelCorretorId}
                onChange={(e) => setResponsaveisForm((atual) => ({ ...atual, responsavelCorretorId: e.target.value }))}
                disabled={salvandoResponsaveis || carregandoCorretores}
              >
                <option value="">Selecione o responsável</option>
                {corretoresElegiveis.map((corretor) => (
                  <option key={corretor.id} value={corretor.id}>{corretor.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="editarFallbackCorretorId" className="text-sm font-medium text-slate-700">
                Responsável fallback
              </label>
              <select
                id="editarFallbackCorretorId"
                className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={responsaveisForm.fallbackCorretorId}
                onChange={(e) => setResponsaveisForm((atual) => ({ ...atual, fallbackCorretorId: e.target.value }))}
                disabled={salvandoResponsaveis || carregandoCorretores}
              >
                <option value="">Selecione o fallback</option>
                {corretoresElegiveis
                  .filter((corretor) => corretor.id !== responsaveisForm.responsavelCorretorId)
                  .map((corretor) => (
                    <option key={corretor.id} value={corretor.id}>{corretor.nome}</option>
                  ))}
              </select>
              <p className="text-xs text-slate-500">
                O fallback é usado quando o responsável principal recusa ou não confirma no prazo.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCampanhaEditando(null)} disabled={salvandoResponsaveis}>
                Cancelar
              </Button>
              <Button onClick={salvarResponsaveis} disabled={salvandoResponsaveis || carregandoCorretores}>
                {salvandoResponsaveis && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar responsáveis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={7} />
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
                <TableHead>Responsável</TableHead>
                <TableHead>Fallback</TableHead>
                <TableHead className="text-right">Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8">
                    <EmptyState
                      tipo="nenhuma-campanha"
                      titulo="Nenhuma campanha encontrada"
                      descricao="Crie uma nova campanha para começar os disparos."
                    />
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
                    <TableCell className="text-sm text-slate-600">
                      {campanha.responsavelCorretor?.nome || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {campanha.fallbackCorretor?.nome || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-500">
                      {new Date(campanha.criadoEm).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          abrirEdicaoResponsaveis(campanha);
                        }}
                        aria-label={`Editar responsáveis da campanha ${campanha.nome}`}
                      >
                        <FileEdit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
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
