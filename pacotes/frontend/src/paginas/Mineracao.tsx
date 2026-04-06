import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicos/api";
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
import { Combobox } from "../componentes/ui/combobox";
import {
  Search,
  Building2,
  MapPin,
  CheckSquare,
  Square,
  Loader2,
  Download,
  AlertCircle,
  ChevronRight,
  Home,
  ArrowLeft,
  Sparkles,
  Trees,
  Zap,
} from "lucide-react";

import { ModalProcessamento } from "../componentes/ModalProcessamento";
import { toast } from "sonner";

// Interfaces
interface Bairro {
  codigo: number;
  nome: string;
}

interface Edificio {
  codigo: number;
  nome: string;
  logradouro: string;
  totalUnidades?: number;
}

interface UnidadeImovel {
  nrinscr: string;
  nmedificio: string;
  incompl: string;
  nmlogradou: string;
  nmbairro: string;
  areaedif?: number;
  areaterr?: number;
  nrquadra?: string;
  nrlote?: string;
  nrimovel?: string;
  tipo?: 'casa' | 'apartamento';
}

// Tipo para controle de etapa
type EtapaBusca = "selecionar-modo" | "por-bairro" | "por-nome" | "por-iptu" | "por-endereco" | "condominio-horizontal" | "unidades";

export function Mineracao() {
  const navigate = useNavigate();

  // Estados de navegação
  const [etapa, setEtapa] = useState<EtapaBusca>("selecionar-modo");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Estados de dados
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [unidades, setUnidades] = useState<UnidadeImovel[]>([]);

  // Estados de seleção
  const [bairroSelecionado, setBairroSelecionado] = useState<Bairro | null>(null);
  const [edificioSelecionado, setEdificioSelecionado] = useState<Edificio | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // Estados para busca por nome/IPTU
  const [termoBusca, setTermoBusca] = useState("");
  const [edificiosBusca, setEdificiosBusca] = useState<Edificio[]>([]);
  const [iptuBusca, setIptuBusca] = useState("");

  // Estado para filtrar edifícios na lista
  const [filtroEdificio, setFiltroEdificio] = useState("");

  // Estados para condomínios horizontais
  const [termoCondominio, setTermoCondominio] = useState("");
  const [condominios, setCondominios] = useState<Bairro[]>([]);
  const [condominioSelecionado, setCondominioSelecionado] = useState<Bairro | null>(null);

  // Estados para busca por endereço
  const [enderecoBusca, setEnderecoBusca] = useState("");
  const [numeroBusca, setNumeroBusca] = useState("");
  const [enderecoAtual, setEnderecoAtual] = useState("");

  // Estados para paginação
  const [paginacao, setPaginacao] = useState({
    offset: 0,
    total: 0,
    hasMore: false,
    loading: false
  });

  // Modal e Modo Turbo
  const [modalOpen, setModalOpen] = useState(false);
  const [modoTurbo, setModoTurbo] = useState(false);

  // Carregar bairros ao montar
  useEffect(() => {
    carregarBairros();
  }, []);

  const carregarBairros = async () => {
    try {
      setLoading(true);
      const response = await api.get("/mineracao/bairros");
      setBairros(response.data.bairros || []);
    } catch (error) {
      console.error("Erro ao carregar bairros:", error);
      setErro("Não foi possível carregar a lista de bairros.");
      toast.error("Falha ao carregar bairros", {
        description: "Verifique sua conexão e tente novamente.",
        action: {
          label: "Tentar novamente",
          onClick: () => carregarBairros(),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarEdificiosPorBairro = async (cdbairro: number) => {
    try {
      setLoading(true);
      setErro("");
      const response = await api.get(`/mineracao/edificios/${cdbairro}`);
      setEdificios(response.data.edificios || []);
      
      if (response.data.edificios?.length === 0) {
        setErro("Nenhum edifício encontrado neste bairro.");
        toast.info("Nenhum edifício encontrado", {
          description: "Este bairro não possui edifícios cadastrados.",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar edifícios:", error);
      setErro("Erro ao carregar edifícios do bairro.");
      toast.error("Erro ao carregar edifícios", {
        description: "Não foi possível carregar os edifícios do bairro.",
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarUnidadesPorEdificio = async (cdedificio: number, append = false, nomeEdificio?: string) => {
    try {
      if (append) {
        setPaginacao(prev => ({ ...prev, loading: true }));
      } else {
        setLoading(true);
        setUnidades([]);
        setPaginacao({ offset: 0, total: 0, hasMore: false, loading: false });
      }
      setErro("");
      
      const currentOffset = append ? paginacao.offset + 500 : 0;
      // Incluir nome do edifício para fallback de cache quando API falhar
      const nomeParam = nomeEdificio ? `&nome=${encodeURIComponent(nomeEdificio)}` : '';
      const response = await api.get(`/mineracao/unidades/${cdedificio}?offset=${currentOffset}&limit=500${nomeParam}`);
      
      const novasUnidades = response.data.unidades || [];
      
      if (append) {
        setUnidades(prev => [...prev, ...novasUnidades]);
      } else {
        setUnidades(novasUnidades);
        setEtapa("unidades");
      }
      
      setPaginacao({
        offset: currentOffset,
        total: response.data.total || novasUnidades.length,
        hasMore: response.data.hasMore || false,
        loading: false
      });
      
      if (novasUnidades.length === 0 && !append) {
        setErro("Nenhuma unidade encontrada neste edifício.");
        toast.info("Nenhuma unidade encontrada", {
          description: "Este edifício não possui unidades cadastradas.",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar unidades:", error);
      setErro("Erro ao carregar unidades do edifício.");
      toast.error("Erro ao carregar unidades", {
        description: "Não foi possível carregar as unidades do edifício.",
      });
      setPaginacao(prev => ({ ...prev, loading: false }));
    } finally {
      setLoading(false);
    }
  };

  const buscarEdificiosPorNome = async () => {
    if (termoBusca.length < 2) return;
    
    try {
      setLoading(true);
      setErro("");
      const response = await api.get(`/mineracao/buscar-edificios?termo=${encodeURIComponent(termoBusca)}`);
      setEdificiosBusca(response.data.edificios || []);
      
      if (response.data.edificios?.length === 0) {
        setErro(`Nenhum edifício encontrado com "${termoBusca}".`);
        toast.info("Nenhum resultado", {
          description: `Não encontramos edifícios com "${termoBusca}". Tente outro termo.`,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar edifícios:", error);
      setErro("Erro ao buscar edifícios.");
      toast.error("Erro na busca", {
        description: "Não foi possível buscar edifícios. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const buscarPorIPTU = async () => {
    if (!iptuBusca) return;
    
    try {
      setLoading(true);
      setErro("");
      const response = await api.post("/mineracao/buscar", { nrinscr: iptuBusca });
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        setUnidades(response.data);
        setEtapa("unidades");
        toast.success("Imóvel encontrado!", {
          description: `${response.data.length} unidade(s) localizada(s).`,
        });
      } else {
        setErro("Nenhum imóvel encontrado com este IPTU.");
        toast.info("IPTU não encontrado", {
          description: "Verifique o número e tente novamente.",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar IPTU:", error);
      setErro("Erro ao buscar imóvel por IPTU.");
      toast.error("Erro na busca por IPTU", {
        description: "Não foi possível consultar. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Funções para Condomínios Horizontais
  const buscarCondominios = async () => {
    if (termoCondominio.length < 2) return;
    
    try {
      setLoading(true);
      setErro("");
      const response = await api.get(`/mineracao/condominios?termo=${encodeURIComponent(termoCondominio)}`);
      setCondominios(response.data.condominios || []);
      
      if (response.data.condominios?.length === 0) {
        setErro(`Nenhum condomínio encontrado com "${termoCondominio}".`);
        toast.info("Nenhum condomínio encontrado", {
          description: `Tente outro termo ou verifique a ortografia.`,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar condomínios:", error);
      setErro("Erro ao buscar condomínios.");
      toast.error("Erro na busca de condomínios", {
        description: "Não foi possível consultar. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para Busca por Endereço
  const buscarPorEndereco = async () => {
    if (enderecoBusca.length < 3) return;
    
    try {
      setLoading(true);
      setErro("");
      
      let url = `/mineracao/endereco?rua=${encodeURIComponent(enderecoBusca)}`;
      if (numeroBusca) {
        url += `&numero=${encodeURIComponent(numeroBusca)}`;
      }
      
      const response = await api.get(url);
      const imoveis = response.data.imoveis || [];
      
      if (imoveis.length === 0) {
        setErro(`Nenhum imóvel encontrado em "${enderecoBusca}"${numeroBusca ? ` nº ${numeroBusca}` : ''}.`);
        toast.info("Nenhum imóvel encontrado", {
          description: "Verifique o endereço e tente novamente.",
        });
        return;
      }
      
      setUnidades(imoveis);
      setEnderecoAtual(`${enderecoBusca}${numeroBusca ? `, ${numeroBusca}` : ''}`);
      setEtapa("unidades");
      toast.success(`${imoveis.length} imóvel(is) encontrado(s)`, {
        description: `Endereço: ${enderecoBusca}${numeroBusca ? ` nº ${numeroBusca}` : ''}`,
      });
      
    } catch (error) {
      console.error("Erro ao buscar por endereço:", error);
      setErro("Erro ao buscar por endereço.");
      toast.error("Erro na busca por endereço", {
        description: "Não foi possível consultar. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const carregarCasasPorCondominio = async (condominio: Bairro, append = false) => {
    try {
      if (append) {
        setPaginacao(prev => ({ ...prev, loading: true }));
      } else {
        setLoading(true);
        setUnidades([]);
        setPaginacao({ offset: 0, total: 0, hasMore: false, loading: false });
        setCondominioSelecionado(condominio);
      }
      setErro("");
      
      const currentOffset = append ? paginacao.offset + 500 : 0;
      const response = await api.get(`/mineracao/casas/${condominio.codigo}?offset=${currentOffset}&limit=500`);
      
      const novasCasas = response.data.casas || [];
      
      if (append) {
        setUnidades(prev => [...prev, ...novasCasas]);
      } else {
        setUnidades(novasCasas);
        setEtapa("unidades");
      }
      
      setPaginacao({
        offset: currentOffset,
        total: response.data.total || novasCasas.length,
        hasMore: response.data.hasMore || false,
        loading: false
      });
      
      if (novasCasas.length === 0 && !append) {
        setErro("Nenhuma casa encontrada neste condomínio.");
      }
    } catch (error) {
      console.error("Erro ao carregar casas:", error);
      setErro("Erro ao carregar casas do condomínio.");
      setPaginacao(prev => ({ ...prev, loading: false }));
    } finally {
      setLoading(false);
    }
  };

  const handleSelecionarBairro = (codigo: string) => {
    const bairro = bairros.find(b => b.codigo.toString() === codigo);
    if (bairro) {
      setBairroSelecionado(bairro);
      setFiltroEdificio(""); // Limpar filtro ao trocar de bairro
      carregarEdificiosPorBairro(bairro.codigo);
    }
  };

  const handleSelecionarEdificio = (edificio: Edificio) => {
    setEdificioSelecionado(edificio);
    carregarUnidadesPorEdificio(edificio.codigo, false, edificio.nome);
  };

  const carregarMaisUnidades = () => {
    if (edificioSelecionado) {
      carregarUnidadesPorEdificio(edificioSelecionado.codigo, true, edificioSelecionado.nome);
    } else if (condominioSelecionado) {
      carregarCasasPorCondominio(condominioSelecionado, true);
    }
  };

  const toggleSelecao = (nrinscr: string) => {
    if (selecionados.includes(nrinscr)) {
      setSelecionados(selecionados.filter((item) => item !== nrinscr));
    } else {
      setSelecionados([...selecionados, nrinscr]);
    }
  };

  const toggleTodos = () => {
    if (selecionados.length === unidades.length) {
      setSelecionados([]);
    } else {
      setSelecionados(unidades.map((u) => u.nrinscr));
    }
  };

  const handleProcessar = () => {
    if (selecionados.length === 0) return;
    setModalOpen(true);
  };

  const handleConclusao = () => {
    setModalOpen(false);
    setSelecionados([]);
    navigate("/dashboard/leads");
  };

  const voltarParaInicio = () => {
    setEtapa("selecionar-modo");
    setBairroSelecionado(null);
    setEdificioSelecionado(null);
    setEdificios([]);
    setUnidades([]);
    setSelecionados([]);
    setTermoBusca("");
    setEdificiosBusca([]);
    setIptuBusca("");
    setTermoCondominio("");
    setCondominios([]);
    setCondominioSelecionado(null);
    setEnderecoBusca("");
    setNumeroBusca("");
    setEnderecoAtual("");
    setErro("");
  };

  const imoveisSelecionados = unidades.filter((u) =>
    selecionados.includes(u.nrinscr)
  );

  // ============================================
  // RENDER: Seleção de Modo de Busca
  // ============================================
  if (etapa === "selecionar-modo") {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-brand" />
            Mineração de Leads
          </h1>
          <p className="text-slate-500 mt-1">
            Escolha como deseja buscar os imóveis para captação.
          </p>
        </div>

        {/* Cards de Opção */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Opção 1: Edifícios por Bairro */}
          <button
            onClick={() => setEtapa("por-bairro")}
            className="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-brand hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-brand transition-colors">
              <Building2 className="w-6 h-6 text-indigo-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Edifícios
            </h3>
            <p className="text-sm text-slate-500">
              Navegue pelos bairros e escolha edifícios para minerar apartamentos.
            </p>
            <div className="flex items-center gap-1 mt-4 text-brand font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              Recomendado
            </div>
          </button>

          {/* Opção 2: Por Nome */}
          <button
            onClick={() => setEtapa("por-nome")}
            className="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-brand hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-brand transition-colors">
              <Search className="w-6 h-6 text-slate-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Por Nome
            </h3>
            <p className="text-sm text-slate-500">
              Busque edifícios pelo nome (ex: "Reserva Buriti", "Manhattan").
            </p>
          </button>

          {/* Opção 3: Condomínios Horizontais */}
          <button
            onClick={() => setEtapa("condominio-horizontal")}
            className="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-success hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-success transition-colors">
              <Trees className="w-6 h-6 text-emerald-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Condomínios de Casas
            </h3>
            <p className="text-sm text-slate-500">
              Busque condomínios horizontais (ex: "Jardins Florença", "Alphaville").
            </p>
            <div className="flex items-center gap-1 mt-4 text-success font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              Novo!
            </div>
          </button>

          {/* Opção 4: Por IPTU */}
          <button
            onClick={() => setEtapa("por-iptu")}
            className="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-brand hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-brand transition-colors">
              <Home className="w-6 h-6 text-slate-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Por IPTU
            </h3>
            <p className="text-sm text-slate-500">
              Busque um imóvel específico pela inscrição de IPTU.
            </p>
          </button>

          {/* Opção 5: Por Endereço */}
          <button
            onClick={() => setEtapa("por-endereco")}
            className="bg-white p-6 rounded-xl border-2 border-slate-200 hover:border-orange-500 hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors">
              <MapPin className="w-6 h-6 text-orange-600 group-hover:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Por Endereço
            </h3>
            <p className="text-sm text-slate-500">
              Busque casas ou imóveis avulsos por rua e número.
            </p>
            <div className="flex items-center gap-1 mt-4 text-orange-600 font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              Novo!
            </div>
          </button>
        </div>

        {/* Estatísticas */}
        <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="w-4 h-4" />
            <span>
              <strong>{bairros.length}</strong> bairros disponíveis
            </span>
          </div>
          <div className="text-sm text-slate-500">
            Fonte: Cadastro Imobiliário Oficial de Goiânia
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Busca por Bairro
  // ============================================
  if (etapa === "por-bairro") {
    return (
      <div className="space-y-6">
        {/* Header com Voltar */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={voltarParaInicio}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="text-brand font-medium">1. Bairro</span>
            <ChevronRight className="w-4 h-4" />
            <span>2. Edifício</span>
            <ChevronRight className="w-4 h-4" />
            <span>3. Unidades</span>
          </div>
        </div>

        {/* Seletor de Bairro */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Selecione o Bairro
          </h2>
          
          <Combobox
            options={bairros.map((bairro) => ({
              value: bairro.codigo.toString(),
              label: bairro.nome,
            }))}
            value={bairroSelecionado?.codigo.toString()}
            onValueChange={handleSelecionarBairro}
            placeholder="Escolha um bairro..."
            searchPlaceholder="Digite para buscar (ex: Bue, Jar, Set)..."
            emptyMessage="Nenhum bairro encontrado."
            className="w-full md:w-96 h-12 text-lg"
          />
          
          <p className="text-sm text-slate-500 mt-3">
            💡 <strong>Dica:</strong> Digite parte do nome do bairro para filtrar (ex: "Bue" para Bueno, "Jar" para Jardim...)
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
            <span className="ml-3 text-slate-600">Carregando edifícios...</span>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 text-danger p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {erro}
          </div>
        )}

        {/* Lista de Edifícios */}
        {edificios.length > 0 && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Edifícios em {bairroSelecionado?.nome}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {edificios.length} edifícios encontrados. Clique em um para ver as unidades.
                  </p>
                </div>
              </div>
              
              {/* Campo de Filtro */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Filtrar edifícios (ex: Reserva, Manhattan)..."
                  className="pl-9 h-9 text-sm"
                  value={filtroEdificio}
                  onChange={(e) => setFiltroEdificio(e.target.value)}
                />
                {filtroEdificio && (
                  <span className="absolute right-3 top-2 text-xs text-slate-500">
                    {edificios.filter(e => 
                      e.nome.toLowerCase().includes(filtroEdificio.toLowerCase()) ||
                      e.logradouro.toLowerCase().includes(filtroEdificio.toLowerCase())
                    ).length} resultados
                  </span>
                )}
              </div>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {edificios
                .filter(edificio => 
                  !filtroEdificio || 
                  edificio.nome.toLowerCase().includes(filtroEdificio.toLowerCase()) ||
                  edificio.logradouro.toLowerCase().includes(filtroEdificio.toLowerCase())
                )
                .map((edificio) => (
                <button
                  key={edificio.codigo}
                  onClick={() => handleSelecionarEdificio(edificio)}
                  className="w-full p-4 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-slate-900 group-hover:text-brand">
                      {edificio.nome}
                    </div>
                    <div className="text-sm text-slate-500">
                      {edificio.logradouro}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {edificio.totalUnidades && (
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {edificio.totalUnidades} unid.
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand" />
                  </div>
                </button>
              ))}
              
              {/* Mensagem se filtro não encontrar nada */}
              {filtroEdificio && edificios.filter(e => 
                e.nome.toLowerCase().includes(filtroEdificio.toLowerCase()) ||
                e.logradouro.toLowerCase().includes(filtroEdificio.toLowerCase())
              ).length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum edifício encontrado com "<strong>{filtroEdificio}</strong>"</p>
                  <p className="text-sm mt-1">Tente outro termo de busca</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: Busca por Nome
  // ============================================
  if (etapa === "por-nome") {
    return (
      <div className="space-y-6">
        {/* Header com Voltar */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={voltarParaInicio}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        </div>

        {/* Busca */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Buscar Edifício por Nome
          </h2>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Digite o nome do edifício (ex: Reserva Buriti)..."
                className="pl-10 h-12 text-lg"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarEdificiosPorNome()}
              />
            </div>
            <Button 
              onClick={buscarEdificiosPorNome}
              disabled={loading || termoBusca.length < 2}
              className="h-12 px-6"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buscar"}
            </Button>
          </div>
          
          <p className="text-sm text-slate-500 mt-2">
            Digite pelo menos 2 caracteres para buscar.
          </p>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 text-danger p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {erro}
          </div>
        )}

        {/* Resultados da Busca */}
        {edificiosBusca.length > 0 && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-900">
                {edificiosBusca.length} edifícios encontrados
              </h3>
              <p className="text-sm text-slate-500">
                Clique em um para ver as unidades.
              </p>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {edificiosBusca.map((edificio) => (
                <button
                  key={edificio.codigo}
                  onClick={() => handleSelecionarEdificio(edificio)}
                  className="w-full p-4 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-slate-900 group-hover:text-brand">
                      {edificio.nome}
                    </div>
                    <div className="text-sm text-slate-500">
                      {edificio.logradouro}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: Busca por Condomínio Horizontal
  // ============================================
  if (etapa === "condominio-horizontal") {
    return (
      <div className="space-y-6">
        {/* Header com Voltar */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={voltarParaInicio}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        </div>

        {/* Busca */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Buscar Condomínio Horizontal
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Condomínios fechados de casas como Jardins Florença, Alphaville, Portal do Sol, etc.
          </p>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Trees className="absolute left-3 top-3 h-5 w-5 text-emerald-500" />
              <Input
                placeholder="Digite o nome do condomínio (ex: Jardins, Madri, Alphaville)..."
                className="pl-10 h-12 text-lg"
                value={termoCondominio}
                onChange={(e) => setTermoCondominio(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarCondominios()}
              />
            </div>
            <Button 
              onClick={buscarCondominios}
              disabled={loading || termoCondominio.length < 2}
              className="h-12 px-6 bg-success hover:bg-success-dark"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buscar"}
            </Button>
          </div>
          
          <p className="text-sm text-slate-500 mt-2">
            💡 <strong>Dica:</strong> Digite parte do nome. Ex: "Madri" encontra "JD MADRI", "Jardins" encontra todos os "RES JARDINS..."
          </p>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 text-danger p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {erro}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-success" />
            <span className="ml-3 text-slate-600">Buscando condomínios...</span>
          </div>
        )}

        {/* Resultados da Busca */}
        {condominios.length > 0 && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-emerald-50">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Trees className="w-5 h-5 text-emerald-600" />
                {condominios.length} condomínios encontrados
              </h3>
              <p className="text-sm text-slate-500">
                Clique em um para ver as casas disponíveis.
              </p>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {condominios.map((condominio) => (
                <button
                  key={condominio.codigo}
                  onClick={() => carregarCasasPorCondominio(condominio)}
                  className="w-full p-4 text-left hover:bg-emerald-50 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Trees className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 group-hover:text-success">
                        {condominio.nome}
                      </div>
                      <div className="text-xs text-slate-400">
                        Código: {condominio.codigo}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-success" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: Busca por Endereço
  // ============================================
  if (etapa === "por-endereco") {
    return (
      <div className="space-y-6">
        {/* Header com Voltar */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={voltarParaInicio}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        </div>

        {/* Busca */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Buscar por Endereço
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Encontre casas avulsas ou imóveis específicos pelo endereço.
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Nome da rua ou avenida (ex: Alameda dos Buritis, T-63, Rua 85)..."
                  className="pl-10 h-12"
                  value={enderecoBusca}
                  onChange={(e) => setEnderecoBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarPorEndereco()}
                />
              </div>
              <div className="w-32">
                <Input
                  placeholder="Número"
                  className="h-12 text-center"
                  value={numeroBusca}
                  onChange={(e) => setNumeroBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscarPorEndereco()}
                />
              </div>
              <Button 
                onClick={buscarPorEndereco}
                disabled={loading || enderecoBusca.length < 3}
                className="h-12 px-6 bg-orange-600 hover:bg-orange-700"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buscar"}
              </Button>
            </div>
            
            <div className="text-xs text-slate-400">
              💡 Dica: Você pode buscar por parte do nome (ex: "T-63" encontra "AVENIDA T-63")
            </div>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 text-danger p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {erro}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: Busca por IPTU
  // ============================================
  if (etapa === "por-iptu") {
    return (
      <div className="space-y-6">
        {/* Header com Voltar */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={voltarParaInicio}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        </div>

        {/* Busca */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Buscar por Inscrição IPTU
          </h2>
          
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Home className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Digite a inscrição IPTU (ex: 32313702960010)..."
                className="pl-10 h-12 text-lg font-mono"
                value={iptuBusca}
                onChange={(e) => setIptuBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarPorIPTU()}
              />
            </div>
            <Button 
              onClick={buscarPorIPTU}
              disabled={loading || !iptuBusca}
              className="h-12 px-6"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buscar"}
            </Button>
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div className="bg-red-100 text-danger p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {erro}
          </div>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: Lista de Unidades (Etapa Final)
  // ============================================
  return (
    <div className="space-y-6">
      {/* Modal de Processamento */}
      <ModalProcessamento
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        imoveis={imoveisSelecionados}
        onConcluido={handleConclusao}
        modoTurbo={modoTurbo}
      />

      {/* Header com Navegação */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={voltarParaInicio}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Nova Busca
        </Button>
        
        {edificioSelecionado && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">{bairroSelecionado?.nome || "Busca"}</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="text-brand font-medium">{edificioSelecionado.nome}</span>
          </div>
        )}
        
        {condominioSelecionado && (
          <div className="flex items-center gap-2 text-sm">
            <Trees className="w-4 h-4 text-emerald-600" />
            <span className="text-success font-medium">{condominioSelecionado.nome}</span>
          </div>
        )}
        
        {enderecoAtual && !edificioSelecionado && !condominioSelecionado && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-orange-600" />
            <span className="text-orange-600 font-medium">{enderecoAtual}</span>
          </div>
        )}
      </div>

      {/* Cabeçalho do Edifício/Condomínio/Endereço */}
      <div className={`${
        condominioSelecionado 
          ? 'bg-gradient-to-r from-green-600 to-green-700' 
          : enderecoAtual 
            ? 'bg-gradient-to-r from-orange-600 to-orange-700'
            : 'bg-gradient-to-r from-blue-600 to-blue-700'
      } text-white p-6 rounded-xl`}>
        <div className="flex items-center gap-3 mb-2">
          {condominioSelecionado ? (
            <Trees className="w-8 h-8" />
          ) : enderecoAtual ? (
            <MapPin className="w-8 h-8" />
          ) : (
            <Building2 className="w-8 h-8" />
          )}
          <h1 className="text-2xl font-bold">
            {condominioSelecionado?.nome || edificioSelecionado?.nome || enderecoAtual || unidades[0]?.nmedificio || "Imóveis Encontrados"}
          </h1>
        </div>
        <p className={`${enderecoAtual ? 'text-orange-100' : 'text-indigo-100'}`}>
          {enderecoAtual 
            ? `${unidades.filter(u => u.tipo === 'casa').length} casas e ${unidades.filter(u => u.tipo === 'apartamento').length} apartamentos encontrados`
            : `${unidades[0]?.nmlogradou}, ${unidades[0]?.nmbairro}`
          }
        </p>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-100 text-danger p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand" />
          <span className="ml-3 text-slate-600">Carregando unidades...</span>
        </div>
      )}

      {/* Tabela de Unidades */}
      {unidades.length > 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">
                {unidades.length} de {paginacao.total > 0 ? paginacao.total : unidades.length} unidades
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-brand font-medium">
                {selecionados.length} selecionadas
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Toggle Modo Turbo */}
              <label 
                className="flex items-center gap-2 cursor-pointer group"
                title="Pula a etapa de revisão e executa automaticamente"
              >
                <span className={`text-xs font-medium transition-colors ${modoTurbo ? 'text-amber-700' : 'text-slate-500'}`}>
                  Modo Turbo
                </span>
                <button
                  type="button"
                  onClick={() => setModoTurbo(!modoTurbo)}
                  className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 ${
                    modoTurbo 
                      ? 'bg-warning' 
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform flex items-center justify-center ${
                      modoTurbo ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  >
                    {modoTurbo && <Zap className="w-2.5 h-2.5 text-amber-500" />}
                  </span>
                </button>
              </label>

              <Button
                onClick={handleProcessar}
                disabled={selecionados.length === 0}
                className={modoTurbo 
                  ? "bg-warning hover:bg-amber-600 text-amber-900" 
                  : "bg-success hover:bg-success-dark"
                }
              >
                {modoTurbo && <Zap className="w-4 h-4 mr-2" />}
                <Download className="w-4 h-4 mr-2" />
                Minerar Leads ({selecionados.length})
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <button onClick={toggleTodos} className="hover:text-brand">
                    {selecionados.length === unidades.length && unidades.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-brand" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  {condominioSelecionado ? "Lote" : enderecoAtual ? "Nº / Unidade" : "Unidade"}
                </TableHead>
                <TableHead>
                  {condominioSelecionado ? "Quadra" : enderecoAtual ? "Tipo" : "Área (m²)"}
                </TableHead>
                <TableHead>
                  {condominioSelecionado ? "Área Terreno" : enderecoAtual ? "Bairro" : "Endereço"}
                </TableHead>
                <TableHead>Inscrição IPTU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unidades.map((item) => {
                const isSelected = selecionados.includes(item.nrinscr);
                const isCasa = item.tipo === 'casa' || !item.nmedificio;
                
                return (
                  <TableRow
                    key={item.nrinscr}
                    className={`hover:bg-indigo-50 cursor-pointer ${isSelected ? "bg-indigo-50/50" : ""}`}
                    onClick={() => toggleSelecao(item.nrinscr)}
                  >
                    <TableCell>
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-brand" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded font-medium ${
                        condominioSelecionado 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : enderecoAtual && isCasa
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {condominioSelecionado 
                          ? (item.nrlote || item.incompl || "N/A")
                          : enderecoAtual
                            ? (item.nrimovel ? `Nº ${item.nrimovel}` : item.incompl || "S/N")
                            : (item.incompl || "N/A")
                        }
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {condominioSelecionado 
                        ? (item.nrquadra || "-")
                        : enderecoAtual
                          ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              isCasa ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-brand'
                            }`}>
                              {isCasa ? '🏠 Casa' : '🏢 Apto'}
                            </span>
                          )
                          : (item.areaedif ? `${item.areaedif.toFixed(1)}` : "-")
                      }
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {condominioSelecionado 
                        ? (item.areaterr ? `${item.areaterr.toFixed(0)} m²` : "-")
                        : enderecoAtual
                          ? item.nmbairro
                          : item.nmlogradou
                      }
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {item.nrinscr}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {/* Botão Carregar Mais */}
          {paginacao.hasMore && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-center bg-slate-50">
              <Button
                onClick={carregarMaisUnidades}
                disabled={paginacao.loading}
                variant="outline"
                className="w-full max-w-md"
              >
                {paginacao.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Carregar Mais ({paginacao.total - unidades.length} restantes)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
