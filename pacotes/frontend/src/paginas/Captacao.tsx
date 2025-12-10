import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Progress } from "../componentes/ui/progress";
import { Stepper, StepperEtapa } from "../componentes/ui/stepper";
import {
  SkeletonResultadoBusca,
  SkeletonTable,
} from "../componentes/ui/skeleton";
import { EmptyState } from "../componentes/ui/empty-state";
import { BotaoPesquisaManus } from "../componentes/campanhas/PesquisaManus";
import { ModalCreditosInsuficientes } from "../componentes/ModalCreditosInsuficientes";
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
  Building2,
  MapPin,
  CheckSquare,
  Square,
  Loader2,
  Zap,
  Users,
  Target,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  Home,
  Filter,
  X,
  Brain,
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TIPOS
// ============================================

interface ResultadoBusca {
  codigo: number;
  nome: string;
  bairro: string;
  tipo: "edificio" | "condominio";
  icone: string;
  totalUnidades?: number;
}

interface Unidade {
  nrinscr: string;
  nmedificio: string;
  incompl: string;
  nmlogradou: string;
  nmbairro: string;
  areaterre?: number;
  areaedifi?: number;
  tipo?: string;
  // Campos extras para casas
  nrquadra?: string;
  nrlote?: string;
}

type EtapaWizard = 1 | 2 | 3 | 4 | 5;

const ETAPAS_WIZARD: StepperEtapa[] = [
  { id: "local", titulo: "Local" },
  { id: "selecionar", titulo: "Selecionar" },
  { id: "processar", titulo: "Processar" },
  { id: "salvar", titulo: "Salvar" },
  { id: "concluir", titulo: "Concluir" },
];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function Captacao() {
  const navigate = useNavigate();

  // Wizard
  const [etapa, setEtapa] = useState<EtapaWizard>(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Etapa 1: Local
  const [termoBusca, setTermoBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca[]>([]);
  const [localSelecionado, setLocalSelecionado] =
    useState<ResultadoBusca | null>(null);

  // Etapa 2: Seleção
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [modoTurbo, setModoTurbo] = useState(false);

  // Filtros de busca específica
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroQuadra, setFiltroQuadra] = useState("");
  const [filtroLote, setFiltroLote] = useState("");

  // Etapa 3: Processamento
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [logsProcesso, setLogsProcesso] = useState<string[]>([]);
  const [leadsGerados, setLeadsGerados] = useState<any[]>([]);
  const [estatisticas, setEstatisticas] = useState({
    total: 0,
    sucesso: 0,
    doCache: 0,
    tempoTotal: 0,
  });

  // Etapa 4: Salvar Lista
  const [nomeLista, setNomeLista] = useState("");
  const [salvandoLista, setSalvandoLista] = useState(false);
  const [listaId, setListaId] = useState<string | null>(null);

  // Modal de créditos insuficientes
  const [mostrarModalCreditos, setMostrarModalCreditos] = useState(false);
  const [creditosNecessarios, setCreditosNecessarios] = useState(0);

  // ============================================
  // FUNÇÕES: Etapa 1 - Local
  // ============================================

  const buscarImoveis = async () => {
    if (termoBusca.length < 2) {
      toast.info("Digite pelo menos 2 caracteres");
      return;
    }

    try {
      setLoading(true);
      setErro("");
      // Usar nova rota unificada que busca edifícios E condomínios
      const response = await api.get(
        `/mineracao/buscar-imoveis?termo=${encodeURIComponent(termoBusca)}`
      );
      setResultadosBusca(response.data.resultados || []);

      const total = response.data.resultados?.length || 0;
      const qtdEdificios = response.data.edificios?.length || 0;
      const qtdCondominios = response.data.condominios?.length || 0;

      if (total === 0) {
        toast.info("Nenhum resultado encontrado", {
          description: "Tente outro termo de busca",
        });
      } else {
        const descricao = [
          qtdEdificios > 0 ? `${qtdEdificios} edifício(s)` : "",
          qtdCondominios > 0 ? `${qtdCondominios} condomínio(s)` : "",
        ]
          .filter(Boolean)
          .join(" + ");

        toast.success(`${total} resultado(s) encontrado(s)`, {
          description: descricao,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar:", error);
      setErro("Erro ao buscar imóveis");
      toast.error("Erro na busca");
    } finally {
      setLoading(false);
    }
  };

  const selecionarLocal = async (local: ResultadoBusca) => {
    setLocalSelecionado(local);
    setNomeLista(`Mineração ${local.nome}`);

    // Limpar filtros anteriores
    setFiltroUnidade("");
    setFiltroQuadra("");
    setFiltroLote("");

    try {
      setLoading(true);

      let unidadesCarregadas: Unidade[] = [];

      if (local.tipo === "edificio") {
        // Buscar unidades do edifício vertical
        // Incluir nome do edifício para fallback de cache quando API falhar
        const nomeEncoded = encodeURIComponent(local.nome);
        const response = await api.get(
          `/mineracao/unidades/${local.codigo}?nome=${nomeEncoded}`
        );
        unidadesCarregadas = response.data.unidades || [];
      } else {
        // Buscar casas do condomínio horizontal
        const response = await api.get(`/mineracao/casas/${local.codigo}`);
        unidadesCarregadas = response.data.casas || [];
      }

      setUnidades(unidadesCarregadas);
      setSelecionados(unidadesCarregadas.map((u: Unidade) => u.nrinscr) || []);
      setEtapa(2);

      const tipoLabel = local.tipo === "edificio" ? "unidades" : "casas";
      toast.success(`${unidadesCarregadas.length} ${tipoLabel} carregadas`);
    } catch (error) {
      toast.error("Erro ao carregar imóveis");
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FUNÇÕES: Etapa 2 - Seleção
  // ============================================

  // Filtrar unidades com base nos filtros ativos
  const unidadesFiltradas = unidades.filter((item) => {
    if (localSelecionado?.tipo === "condominio") {
      // Filtro para condomínios: quadra e lote
      const matchQuadra =
        !filtroQuadra ||
        item.nrquadra?.toLowerCase().includes(filtroQuadra.toLowerCase());
      const matchLote =
        !filtroLote ||
        item.nrlote?.toLowerCase().includes(filtroLote.toLowerCase());
      return matchQuadra && matchLote;
    } else {
      // Filtro para edifícios: unidade (apartamento)
      const matchUnidade =
        !filtroUnidade ||
        item.incompl?.toLowerCase().includes(filtroUnidade.toLowerCase());
      return matchUnidade;
    }
  });

  const limparFiltros = () => {
    setFiltroUnidade("");
    setFiltroQuadra("");
    setFiltroLote("");
  };

  const temFiltroAtivo = filtroUnidade || filtroQuadra || filtroLote;

  const toggleSelecao = (nrinscr: string) => {
    if (selecionados.includes(nrinscr)) {
      setSelecionados(selecionados.filter((item) => item !== nrinscr));
    } else {
      setSelecionados([...selecionados, nrinscr]);
    }
  };

  const toggleTodos = () => {
    // Seleciona/deseleciona apenas as unidades filtradas
    const nrinscsFiltrados = unidadesFiltradas.map((u) => u.nrinscr);
    const todosFiltradosSelecionados = nrinscsFiltrados.every((nr) =>
      selecionados.includes(nr)
    );

    if (todosFiltradosSelecionados) {
      // Remove apenas os filtrados da seleção
      setSelecionados(
        selecionados.filter((s) => !nrinscsFiltrados.includes(s))
      );
    } else {
      // Adiciona os filtrados à seleção existente
      const novosSelecionados = [
        ...new Set([...selecionados, ...nrinscsFiltrados]),
      ];
      setSelecionados(novosSelecionados);
    }
  };

  // ============================================
  // FUNÇÕES: Etapa 3 - Processamento
  // ============================================

  const iniciarProcessamento = async () => {
    if (selecionados.length === 0) {
      toast.error("Selecione pelo menos uma unidade");
      return;
    }

    setEtapa(3);
    setProcessando(true);
    setProgresso(0);
    setLogsProcesso([]);
    const tempoInicio = Date.now();

    const imoveisSelecionados = unidades.filter((u) =>
      selecionados.includes(u.nrinscr)
    );
    addLog(
      `🚀 Iniciando mineração de ${imoveisSelecionados.length} unidades...`
    );

    try {
      // Etapa 3.1: Identificar Proprietários
      setProgresso(20);
      addLog("🔍 Identificando proprietários dos imóveis...");

      const responseProprietarios = await api.post(
        "/mineracao/identificar-proprietarios",
        {
          imoveis: imoveisSelecionados,
        }
      );
      const proprietarios = responseProprietarios.data;

      setProgresso(50);
      addLog(`✅ ${proprietarios.length} proprietários identificados`);

      // Etapa 3.2: Enriquecer com Assertiva (com deduplição!)
      addLog("📞 Buscando informações de contato...");

      const responseEnriquecimento = await api.post(
        "/mineracao/confirmar-leads",
        {
          proprietarios,
        }
      );

      setProgresso(90);

      const { total, sucesso, doCache, dados } = responseEnriquecimento.data;

      if (doCache > 0) {
        addLog(`✨ ${doCache} contatos localizados rapidamente`);
      }

      addLog(`✅ ${sucesso} leads qualificados salvos no banco`);

      const tempoTotal = Math.round((Date.now() - tempoInicio) / 1000);

      setLeadsGerados(dados || []);
      setEstatisticas({
        total,
        sucesso,
        doCache: doCache || 0,
        tempoTotal,
      });

      setProgresso(100);
      addLog(`🎉 Mineração concluída em ${tempoTotal}s!`);
      setProcessando(false);

      toast.success(`${sucesso} leads minerados com sucesso!`, {
        description: `Tempo: ${tempoTotal}s`,
      });

      // Se modo turbo, avança automaticamente
      if (modoTurbo) {
        addLog("⚡ Modo Turbo: Avançando para criação de campanha...");
        setTimeout(() => setEtapa(4), 1500);
      }
    } catch (error: any) {
      console.error("Erro no processamento:", error);
      setProcessando(false);

      // Tratamento específico para créditos insuficientes
      if (error.response?.status === 402) {
        addLog(`❌ Créditos insuficientes para esta operação`);
        setCreditosNecessarios(selecionados.length);
        setMostrarModalCreditos(true);
      } else {
        addLog(
          `❌ Erro: ${error.response?.data?.erro || "Falha no processamento"}`
        );
        toast.error("Erro no processamento");
      }
    }
  };

  const addLog = (msg: string) => {
    setLogsProcesso((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  };

  // ============================================
  // FUNÇÕES: Etapa 4 - Salvar Lista
  // ============================================

  const salvarLista = async () => {
    if (!nomeLista.trim()) {
      toast.error("Digite um nome para a lista");
      return;
    }

    try {
      setSalvandoLista(true);

      // Preparar contatos para salvar na lista
      const contatosParaSalvar = leadsGerados.map((lead) => {
        // Garantir que nome nunca é vazio
        let nome =
          lead.nome ||
          lead.nmproprietario ||
          lead.proprietario ||
          "Proprietário";
        if (!nome || nome.trim() === "") {
          nome = "Proprietário";
        }

        // Extrair números de telefone (podem vir como objetos ou strings)
        const extrairTelefone = (tel: any): string | null => {
          if (!tel) return null;
          if (typeof tel === "string") return tel;
          if (typeof tel === "object" && tel.numero) return tel.numero;
          return null;
        };

        // Telefones podem estar em lead.telefones (array) ou lead.telefone (string/objeto)
        const telefones = lead.telefones || [];
        const tel1 =
          extrairTelefone(lead.telefone) || extrairTelefone(telefones[0]);
        const tel2 = extrairTelefone(telefones[1]);
        const tel3 = extrairTelefone(telefones[2]);
        const tel4 = extrairTelefone(telefones[3]);
        const tel5 = extrairTelefone(telefones[4]);

        // Contar quantos têm WhatsApp
        const qtdWhatsapp = telefones.filter(
          (t: any) => t?.whatsapp === true
        ).length;

        return {
          nome: nome.trim(),
          cpf: lead.cpf || lead.nrcpf || null,
          inscricaoIptu: lead.inscricaoIptu || lead.nrinscr || null,
          unidade: lead.unidade || lead.incompl || null,
          box: lead.box || null,
          enderecoImovel: lead.enderecoImovel || lead.endereco || null,
          bairroImovel:
            lead.bairroImovel ||
            lead.bairro ||
            localSelecionado?.bairro ||
            null,
          telefone: tel1,
          telefone2: tel2,
          telefone3: tel3,
          telefone4: tel4,
          telefone5: tel5,
          telefonesJson:
            telefones.length > 0 ? JSON.stringify(telefones) : null,
          email: lead.email || lead.emails?.[0] || null,
          email2: lead.emails?.[1] || null,
          email3: lead.emails?.[2] || null,
          email4: lead.emails?.[3] || null,
          email5: lead.emails?.[4] || null,
          emailsJson: lead.emails ? JSON.stringify(lead.emails) : null,
          temWhatsapp: qtdWhatsapp > 0 || lead.temWhatsapp || false,
          quantidadeWhatsapp: qtdWhatsapp || lead.quantidadeWhatsapp || 0,
        };
      });

      console.log(
        "[Wizard] Salvando lista com",
        contatosParaSalvar.length,
        "contatos"
      );
      console.log("[Wizard] Primeiro contato exemplo:", contatosParaSalvar[0]);

      // Criar lista com contatos
      const response = await api.post("/listas", {
        nome: nomeLista,
        nomeEdificio: localSelecionado?.nome || nomeLista,
        localizacao: localSelecionado?.bairro || "Goiânia, GO",
        contatos: contatosParaSalvar,
      });

      const lista = response.data;
      setListaId(lista.id);

      toast.success("Lista salva com sucesso!", {
        description: `${lista.totalContatos} contatos salvos`,
      });

      // Avançar para conclusão
      setEtapa(5);
    } catch (error: any) {
      console.error("Erro ao salvar lista:", error);
      console.error("Resposta do servidor:", error.response?.data);
      toast.error("Erro ao salvar lista");
    } finally {
      setSalvandoLista(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500" />
          Wizard de Captação
        </h1>
        <p className="text-slate-500">
          Mineração + Campanha em um único fluxo guiado
        </p>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <Stepper etapas={ETAPAS_WIZARD} etapaAtual={etapa - 1} />
      </div>

      {/* Conteúdo das Etapas */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* ETAPA 1: LOCAL */}
        {etapa === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                Onde você quer captar?
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Digite o nome do edifício, condomínio horizontal ou bairro
              </p>
            </div>

            <div className="flex gap-2 max-w-lg mx-auto">
              <Input
                placeholder="Ex: Reserva do Parque, Jardins Florença, Alphaville..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarImoveis()}
                className="flex-1"
              />
              <Button onClick={buscarImoveis} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Buscar
              </Button>
            </div>

            {/* Lista de Resultados */}
            {erro && (
              <div className="text-center py-4 text-red-600 text-sm">
                {erro}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="space-y-2 animate-in fade-in-50 duration-300">
                <SkeletonResultadoBusca />
                <SkeletonResultadoBusca />
                <SkeletonResultadoBusca />
              </div>
            )}

            {/* Empty State */}
            {!loading &&
              termoBusca &&
              resultadosBusca.length === 0 &&
              !erro && (
                <EmptyState
                  tipo="busca-sem-resultado"
                  titulo="Nenhum imóvel encontrado"
                  descricao={`Não encontramos resultados para "${termoBusca}". Tente outro termo.`}
                />
              )}

            {resultadosBusca.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                {resultadosBusca.map((resultado) => (
                  <button
                    key={`${resultado.tipo}-${resultado.codigo}`}
                    onClick={() => selecionarLocal(resultado)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                        resultado.tipo === "edificio"
                          ? "bg-blue-100"
                          : "bg-green-100"
                      }`}
                    >
                      {resultado.tipo === "edificio" ? (
                        <Building2 className="w-6 h-6 text-blue-600" />
                      ) : (
                        <Home className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {resultado.nome}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            resultado.tipo === "edificio"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {resultado.tipo === "edificio"
                            ? "🏢 Edifício"
                            : "🏠 Condomínio"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {resultado.bairro}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ETAPA 2: SELEÇÃO */}
        {etapa === 2 && (
          <div className="space-y-4 animate-in fade-in-50 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {localSelecionado?.tipo === "condominio"
                    ? "Selecione as casas"
                    : "Selecione as unidades"}
                </h2>
                <p className="text-slate-500 text-sm">
                  {localSelecionado?.nome} •{" "}
                  {loading
                    ? "Carregando..."
                    : `${unidades.length} ${localSelecionado?.tipo === "condominio" ? "casas" : "unidades"}`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Toggle Modo Turbo */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <span
                    className={`text-xs font-medium ${modoTurbo ? "text-yellow-700" : "text-slate-500"}`}
                  >
                    Modo Turbo
                  </span>
                  <button
                    type="button"
                    onClick={() => setModoTurbo(!modoTurbo)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      modoTurbo ? "bg-yellow-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform flex items-center justify-center ${
                        modoTurbo ? "translate-x-4" : ""
                      }`}
                    >
                      {modoTurbo && (
                        <Zap className="w-2.5 h-2.5 text-yellow-500" />
                      )}
                    </span>
                  </button>
                </label>
              </div>
            </div>

            {/* Filtros de Busca Específica */}
            {!loading && unidades.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 animate-in fade-in-50 duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">
                    Buscar unidade específica
                  </span>
                  {temFiltroAtivo && (
                    <button
                      onClick={limparFiltros}
                      className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Limpar filtros
                    </button>
                  )}
                </div>

                {localSelecionado?.tipo === "condominio" ? (
                  // Filtros para Condomínio Horizontal
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">
                        Quadra
                      </label>
                      <Input
                        placeholder="Ex: 5, A, B..."
                        value={filtroQuadra}
                        onChange={(e) => setFiltroQuadra(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">
                        Lote
                      </label>
                      <Input
                        placeholder="Ex: 12, 15..."
                        value={filtroLote}
                        onChange={(e) => setFiltroLote(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  // Filtro para Edifício
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Apartamento / Unidade
                    </label>
                    <Input
                      placeholder="Ex: 1008B, 501, Cobertura..."
                      value={filtroUnidade}
                      onChange={(e) => setFiltroUnidade(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                )}

                {temFiltroAtivo && (
                  <p className="text-xs text-slate-500 mt-2">
                    {unidadesFiltradas.length === 0 ? (
                      <span className="text-amber-600">
                        Nenhuma unidade encontrada com esses filtros
                      </span>
                    ) : (
                      <>
                        Mostrando{" "}
                        <span className="font-semibold text-blue-600">
                          {unidadesFiltradas.length}
                        </span>{" "}
                        de {unidades.length}{" "}
                        {localSelecionado?.tipo === "condominio"
                          ? "casas"
                          : "unidades"}
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Loading Skeleton */}
            {loading && (
              <SkeletonTable
                rows={8}
                columns={localSelecionado?.tipo === "condominio" ? 5 : 4}
              />
            )}

            {/* Empty State */}
            {!loading && unidades.length === 0 && (
              <EmptyState
                tipo="nenhum-imovel"
                titulo="Nenhuma unidade encontrada"
                descricao="Não foi possível carregar as unidades deste local."
                acao={{
                  texto: "Voltar para busca",
                  onClick: () => setEtapa(1),
                }}
              />
            )}

            {/* Tabela */}
            {!loading && unidades.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto animate-in fade-in-50 duration-300">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <button
                          onClick={toggleTodos}
                          title={`Selecionar todas ${unidadesFiltradas.length} unidades visíveis`}
                        >
                          {unidadesFiltradas.length > 0 &&
                          unidadesFiltradas.every((u) =>
                            selecionados.includes(u.nrinscr)
                          ) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </TableHead>
                      {localSelecionado?.tipo === "condominio" ? (
                        <>
                          <TableHead>Quadra</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Rua</TableHead>
                          <TableHead>IPTU</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Endereço</TableHead>
                          <TableHead>IPTU</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unidadesFiltradas.length === 0 && temFiltroAtivo ? (
                      <TableRow>
                        <TableCell
                          colSpan={
                            localSelecionado?.tipo === "condominio" ? 5 : 4
                          }
                          className="text-center py-8 text-slate-500"
                        >
                          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>Nenhuma unidade corresponde ao filtro</p>
                          <button
                            onClick={limparFiltros}
                            className="text-blue-600 hover:underline text-sm mt-1"
                          >
                            Limpar filtros
                          </button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      unidadesFiltradas.map((item, index) => {
                        const isSelected = selecionados.includes(item.nrinscr);
                        return (
                          <TableRow
                            key={`${item.nrinscr}-${index}`}
                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}
                            onClick={() => toggleSelecao(item.nrinscr)}
                          >
                            <TableCell>
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </TableCell>
                            {localSelecionado?.tipo === "condominio" ? (
                              <>
                                <TableCell className="font-medium">
                                  {item.nrquadra || "—"}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {item.nrlote || "—"}
                                </TableCell>
                                <TableCell className="text-slate-500">
                                  {item.nmlogradou || "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {item.nrinscr}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="font-medium">
                                  {item.incompl || "—"}
                                </TableCell>
                                <TableCell className="text-slate-500">
                                  {item.nmlogradou}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {item.nrinscr}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setEtapa(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">
                  {selecionados.length} de {unidades.length} selecionadas
                </span>
                <Button
                  onClick={iniciarProcessamento}
                  disabled={selecionados.length === 0}
                  className={
                    modoTurbo ? "bg-yellow-500 hover:bg-yellow-600" : ""
                  }
                >
                  {modoTurbo && <Zap className="w-4 h-4 mr-2" />}
                  Minerar Leads ({selecionados.length})
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 3: PROCESSAMENTO */}
        {etapa === 3 && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                {processando ? "Minerando Leads..." : "Mineração Concluída!"}
              </h2>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Progresso</span>
                <span>{progresso}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>

            {/* Logs */}
            <div className="bg-slate-950 text-slate-300 p-4 rounded-lg h-40 overflow-y-auto font-mono text-xs space-y-1">
              {logsProcesso.map((log, i) => (
                <div
                  key={i}
                  className="animate-in fade-in-50 slide-in-from-left-4 duration-200"
                >
                  {log}
                </div>
              ))}
              {processando && (
                <div className="flex items-center gap-2 animate-pulse text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processando...
                </div>
              )}
            </div>

            {/* Estatísticas (após conclusão) */}
            {!processando && progresso === 100 && (
              <div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center transition-transform hover:scale-105">
                    <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-700">
                      {estatisticas.sucesso}
                    </div>
                    <div className="text-xs text-green-600">Leads Gerados</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center transition-transform hover:scale-105">
                    <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-700">
                      {estatisticas.tempoTotal}s
                    </div>
                    <div className="text-xs text-blue-600">Tempo Total</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center transition-transform hover:scale-105">
                    <CheckCircle2 className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-700">
                      {estatisticas.sucesso}
                    </div>
                    <div className="text-xs text-purple-600">Com Contato</div>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setEtapa(4)}
                    size="lg"
                    className="gap-2"
                  >
                    <Target className="w-4 h-4" />
                    Salvar Lista de Contatos
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 4: SALVAR LISTA */}
        {etapa === 4 && (
          <div className="space-y-6 animate-in fade-in-50 duration-300">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900">
                Salvar Lista de Contatos
              </h2>
              <p className="text-slate-500 text-sm">
                Salve os contatos minerados para usar em campanhas futuras
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Nome da Lista
                </label>
                <Input
                  value={nomeLista}
                  onChange={(e) => setNomeLista(e.target.value)}
                  placeholder="Ex: Mineração Reserva do Parque"
                  className="mt-1"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                <p className="font-medium">📊 Esta lista terá:</p>
                <ul className="mt-2 space-y-1">
                  <li>• {estatisticas.sucesso} contatos minerados</li>
                  <li>• Dados de telefone e email enriquecidos</li>
                  <li>• Pronta para adicionar a campanhas</li>
                </ul>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg text-sm text-amber-800">
                <p className="font-medium">💡 Próximo passo:</p>
                <p className="mt-1">
                  Após salvar, vá em <strong>Campanhas</strong> para criar uma
                  campanha e adicionar contatos desta lista.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setEtapa(3)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <Button onClick={salvarLista} disabled={salvandoLista}>
                {salvandoLista ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Salvar Lista
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ETAPA 5: CONCLUSÃO */}
        {etapa === 5 && (
          <div className="space-y-6 text-center animate-in fade-in-50 zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-in zoom-in-50 duration-700">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            <div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold text-slate-900">
                Mineração Concluída! 🎉
              </h2>
              <p className="text-slate-500 mt-2">
                Seus contatos foram minerados e salvos com sucesso.
              </p>
            </div>

            {/* Resumo */}
            <div className="bg-slate-50 rounded-lg p-6 max-w-md mx-auto text-left animate-in fade-in-50 slide-in-from-bottom-6 duration-700">
              <h3 className="font-semibold text-slate-900 mb-3">Resumo:</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {leadsGerados.length > 0
                    ? leadsGerados.length
                    : estatisticas.sucesso}{" "}
                  contatos minerados
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Lista "{nomeLista}" salva
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Pronto para usar em campanhas
                </li>
              </ul>
            </div>

            {/* Pesquisar informações do empreendimento via IA */}
            <div className="bg-purple-50 rounded-lg p-6 max-w-md mx-auto animate-in fade-in-50 slide-in-from-bottom-7 duration-800">
              <div className="flex items-center gap-3 mb-3">
                <Brain className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">
                  Pesquisa Inteligente
                </h3>
              </div>
              <p className="text-sm text-purple-700 mb-4">
                Quer que a IA pesquise informações detalhadas sobre o
                empreendimento? Isso irá criar um briefing completo para usar
                nas conversas.
              </p>
              <BotaoPesquisaManus
                dadosIniciais={{
                  nomeEmpreendimento: localSelecionado?.nome || "",
                  bairro: localSelecionado?.bairro || "",
                  cidade: "Goiânia",
                  estado: "GO",
                }}
                variant="default"
              />
            </div>

            {/* Ações */}
            <div className="flex items-center justify-center gap-4 pt-4 animate-in fade-in-50 slide-in-from-bottom-8 duration-900">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/campanhas")}
              >
                Ir para Campanhas
              </Button>
              {listaId && (
                <Button
                  onClick={() => navigate(`/dashboard/listas/${listaId}`)}
                  className="gap-2"
                >
                  Ver Lista
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  setEtapa(1);
                  setLocalSelecionado(null);
                  setResultadosBusca([]);
                  setUnidades([]);
                  setSelecionados([]);
                  setTermoBusca("");
                  setLeadsGerados([]);
                  setListaId(null);
                }}
                className="text-blue-600 hover:underline text-sm transition-colors"
              >
                Iniciar Nova Mineração
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Premium de Créditos Insuficientes */}
      <ModalCreditosInsuficientes
        isOpen={mostrarModalCreditos}
        onClose={() => setMostrarModalCreditos(false)}
        creditosNecessarios={creditosNecessarios}
        operacao={`minerar ${localSelecionado?.nome || "este empreendimento"}`}
      />
    </div>
  );
}
