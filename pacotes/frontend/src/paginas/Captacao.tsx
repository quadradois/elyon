import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../componentes/ui/tabs";
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
  Home,
  Filter,
  X,
  Brain,
  Phone,
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
  const [locaisSelecionados, setLocaisSelecionados] = useState<ResultadoBusca[]>([]);
  // Estado para aba de busca (local ou iptu)
  const [modoBusca, setModoBusca] = useState<"local" | "codigo" | "iptu">("local");
  const [iptuBusca, setIptuBusca] = useState("");
  const [codigoBusca, setCodigoBusca] = useState("");

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
  const [_logsProcesso, setLogsProcesso] = useState<string[]>([]);
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

  const buscarPorCodigo = async () => {
    const codigoLimpo = codigoBusca.trim();

    if (!/^\d+$/.test(codigoLimpo) || codigoLimpo.length < 3) {
      toast.info("Informe um código válido (apenas números, mínimo 3 dígitos)");
      return;
    }

    try {
      setLoading(true);
      setErro("");
      const response = await api.get(
        `/mineracao/buscar-imoveis?codigo=${encodeURIComponent(codigoLimpo)}`
      );

      const resultados = response.data.resultados || [];
      setResultadosBusca(resultados);

      const total = resultados.length;
      const qtdEdificios = response.data.edificios?.length || 0;
      const qtdCondominios = response.data.condominios?.length || 0;

      if (total === 0) {
        const tentarPorNome = window.confirm(
          `Código "${codigoLimpo}" não encontrado. Deseja tentar por nome do empreendimento?`
        );

        if (tentarPorNome) {
          setModoBusca("local");
          setTermoBusca("");
          toast.info("Digite um nome para buscar empreendimentos");
        }
      } else {
        const descricao = [
          qtdEdificios > 0 ? `${qtdEdificios} edifício(s)` : "",
          qtdCondominios > 0 ? `${qtdCondominios} condomínio(s)` : "",
        ]
          .filter(Boolean)
          .join(" + ");

        toast.success(`${total} resultado(s) encontrado(s)`, {
          description: descricao || "Busca por código concluída",
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar por código:", error);
      const mensagemErro =
        error?.response?.data?.erro || "Erro ao buscar por código";
      setErro(mensagemErro);
      toast.error(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  // Toggle seleção de local (para seleção múltipla)
  const toggleLocalSelecionado = (local: ResultadoBusca) => {
    setLocaisSelecionados(prev => {
      const jaExiste = prev.some(l => l.codigo === local.codigo && l.tipo === local.tipo);
      if (jaExiste) {
        return prev.filter(l => !(l.codigo === local.codigo && l.tipo === local.tipo));
      } else {
        return [...prev, local];
      }
    });
  };

  // Verificar se local está selecionado
  const isLocalSelecionado = (local: ResultadoBusca) => {
    return locaisSelecionados.some(l => l.codigo === local.codigo && l.tipo === local.tipo);
  };

  // Processar múltiplos locais selecionados
  const processarLocaisSelecionados = async () => {
    if (locaisSelecionados.length === 0) {
      toast.error("Selecione pelo menos um local");
      return;
    }

    // Usar primeiro local como referência
    const primeiroLocal = locaisSelecionados[0];
    setLocalSelecionado(primeiroLocal);

    // Nome da lista baseado nos locais selecionados
    if (locaisSelecionados.length === 1) {
      setNomeLista(`Mineração ${primeiroLocal.nome}`);
    } else {
      setNomeLista(`Mineração ${locaisSelecionados.length} locais`);
    }

    // Limpar filtros anteriores
    setFiltroUnidade("");
    setFiltroQuadra("");
    setFiltroLote("");

    try {
      setLoading(true);
      const toastId = toast.loading(`Carregando unidades de ${locaisSelecionados.length} local(is)...`);

      let todasUnidades: Unidade[] = [];

      // Processar cada local selecionado
      for (const local of locaisSelecionados) {
        toast.loading(`Carregando: ${local.nome}...`, { id: toastId });

        // 1. Iniciar Job
        const { data: jobData } = await api.post('/mineracao/unidades/jobs/iniciar', {
          cdedificio: local.codigo,
          tipo: local.tipo,
          nomeEdificio: local.nome
        });
        const jobId = jobData.jobId;

        // 2. Polling
        let jobConcluido = false;
        let tentativas = 0;

        while (!jobConcluido && tentativas < 120) {
          await new Promise(r => setTimeout(r, 2000));
          const { data: status } = await api.get(`/mineracao/unidades/jobs/${jobId}/status`);

          if (status.status === 'concluido') {
            jobConcluido = true;
            const { data: resultado } = await api.get(`/mineracao/unidades/jobs/${jobId}/resultado`);
            todasUnidades = [...todasUnidades, ...resultado.unidades];
          } else if (status.status === 'erro') {
            throw new Error(`Erro em ${local.nome}: ${status.mensagem}`);
          } else {
            const progresso = status.total > 0 ? Math.round((status.processados / status.total) * 100) : 0;
            toast.loading(`${local.nome}: ${status.processados} unidades (${progresso}%)...`, { id: toastId });
          }
          tentativas++;
        }

        if (!jobConcluido) throw new Error(`Timeout ao carregar ${local.nome}`);
      }

      toast.dismiss(toastId);

      setUnidades(todasUnidades);
      setSelecionados(todasUnidades.map((u: Unidade) => u.nrinscr) || []);
      setEtapa(2);

      const tipoLabel = primeiroLocal.tipo === "edificio" ? "unidades" : "imóveis";
      toast.success(`${todasUnidades.length} ${tipoLabel} carregadas de ${locaisSelecionados.length} local(is)`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao carregar imóveis");
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
      const toastId = toast.loading("Iniciando busca de unidades...");

      // 1. Iniciar Job
      const { data: jobData } = await api.post('/mineracao/unidades/jobs/iniciar', {
        cdedificio: local.codigo,
        tipo: local.tipo,
        nomeEdificio: local.nome
      });
      const jobId = jobData.jobId;

      // 2. Polling
      let jobConcluido = false;
      let tentativas = 0;
      let unidadesCarregadas: Unidade[] = [];

      while (!jobConcluido && tentativas < 120) { // 4 minutos max (para condomínios grandes)
        await new Promise(r => setTimeout(r, 2000));
        const { data: status } = await api.get(`/mineracao/unidades/jobs/${jobId}/status`);

        if (status.status === 'concluido') {
          jobConcluido = true;
          const { data: resultado } = await api.get(`/mineracao/unidades/jobs/${jobId}/resultado`);
          unidadesCarregadas = resultado.unidades;
        } else if (status.status === 'erro') {
          throw new Error(status.mensagem);
        } else {
          // Atualizar mensagem de progresso
          const progresso = status.total > 0 ? Math.round((status.processados / status.total) * 100) : 0;
          toast.loading(`Carregando: ${status.processados} unidades (${progresso}%)...`, { id: toastId });
        }
        tentativas++;
      }

      if (!jobConcluido) throw new Error("Timeout ao carregar unidades. Tente novamente.");

      toast.dismiss(toastId);

      setUnidades(unidadesCarregadas);
      setSelecionados(unidadesCarregadas.map((u: Unidade) => u.nrinscr) || []);
      setEtapa(2);

      const tipoLabel = local.tipo === "edificio" ? "unidades" : "casas";
      toast.success(`${unidadesCarregadas.length} ${tipoLabel} carregadas`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao carregar imóveis");
    } finally {
      setLoading(false);
    }
  };

  // Busca unitária por IPTU (Simula encontrar uma unidade para passar para o wizard)
  const buscarPorIptu = async () => {
    if (!iptuBusca || iptuBusca.length < 5) {
      toast.info("Digite um IPTU válido");
      return;
    }

    try {
      setLoading(true);
      setErro("");
      const toastId = toast.loading("Verificando IPTU...");

      // Verificar se o IPTU existe (usando endpoint de busca unitária leve ou job)
      // Como queremos integrar no fluxo do Wizard (que usa Job na etapa 3), 
      // aqui apenas validamos se o IPTU "existe" ou formatamos ele para a próxima etapa.

      // Vamos criar uma unidade "virtual" com esse IPTU
      const unidadeVirtual: Unidade = {
        nrinscr: iptuBusca,
        nmedificio: "Imóvel Avulso",
        incompl: "Busca por IPTU",
        nmlogradou: "Endereço será carregado",
        nmbairro: "Goiânia",
        tipo: "casa" // Padrão
      };

      toast.dismiss(toastId);

      // Configurar estado para avançar
      setUnidades([unidadeVirtual]);
      setSelecionados([unidadeVirtual.nrinscr]);
      setNomeLista(`Prospecção IPTU ${iptuBusca}`);

      // Avançar para Etapa 2 (Seleção)
      setEtapa(2);
      toast.success("IPTU configurado para prospecção");

    } catch (error) {
      console.error(error);
      toast.error("Erro ao validar IPTU");
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
      `🚀 Iniciando mineração assíncrona de ${imoveisSelecionados.length} unidades...`
    );

    try {
      // Etapa 3.1: Identificar Proprietários (Via Job Assíncrono)
      setProgresso(5);
      addLog("🔍 Iniciando job de identificação...");

      // 1. Iniciar job
      const responseJob = await api.post("/mineracao/jobs/iniciar", { imoveis: imoveisSelecionados });
      const { jobId, total } = responseJob.data;

      addLog(`✅ Job criado: ${jobId}`);
      addLog(`⏳ Processando ${total} imóveis em background...`);
      setProgresso(10);

      // 2. Polling
      let concluido = false;
      let ultimoProcessados = 0;

      while (!concluido) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s

        const statusResponse = await api.get(`/mineracao/jobs/${jobId}/status`);
        const { job } = statusResponse.data;

        if (job.processados > ultimoProcessados) {
          addLog(`📊 Progresso: ${job.processados}/${job.total} imóveis processados`);
          ultimoProcessados = job.processados;
        }

        // Calcular progresso visual (10% a 50%)
        const progressoVisual = 10 + Math.round((job.processados / job.total) * 40);
        setProgresso(progressoVisual);

        if (job.status === 'concluido') {
          concluido = true;
          addLog(`✅ Processamento concluído!`);
        } else if (job.status === 'erro') {
          throw new Error(job.mensagem || 'Erro no processamento');
        } else if (job.status === 'cancelado') {
          throw new Error('Job cancelado');
        }
      }

      // 3. Buscar resultado final
      const resultadoResponse = await api.get(`/mineracao/jobs/${jobId}/resultado`);
      const { proprietarios, creditos } = resultadoResponse.data;

      setProgresso(50);
      addLog(`✅ ${proprietarios.length} proprietários identificados`);
      addLog(`💰 Créditos consumidos: ${creditos?.consumidos || 0}`);

      // Etapa 3.2: Enriquecer com Assertiva (com deduplição!)
      addLog("📞 Buscando informações de contato...");
      setProgresso(60);

      const responseEnriquecimento = await api.post(
        "/mineracao/confirmar-leads",
        {
          proprietarios,
        }
      );

      setProgresso(90);

      const { total: totalLeads, sucesso, doCache, dados } = responseEnriquecimento.data;

      if (doCache > 0) {
        addLog(`✨ ${doCache} contatos localizados rapidamente`);
      }

      addLog(`✅ ${sucesso} leads qualificados salvos no banco`);

      const tempoTotal = Math.round((Date.now() - tempoInicio) / 1000);

      setLeadsGerados(dados || []);
      setEstatisticas({
        total: totalLeads,
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

      const msgErro = error.response?.data?.erro || error.message || "Falha no processamento";

      // Tratamento específico para créditos insuficientes
      if (error.response?.status === 402 || msgErro.toLowerCase().includes("créditos insuficientes") || msgErro.toLowerCase().includes("creditos insuficientes")) {
        addLog(`❌ Créditos insuficientes para esta operação`);

        // Tentar extrair quantidade
        const match = msgErro.match(/(\d+) necessários/);
        const necessarios = match ? parseInt(match[1]) : selecionados.length;

        setCreditosNecessarios(necessarios);
        setMostrarModalCreditos(true);
      } else {
        addLog(`❌ Erro: ${msgErro}`);
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

            {/* Abas de Modo de Busca */}
            <Tabs
              value={modoBusca}
              onValueChange={(v) => {
                setModoBusca(v as "local" | "codigo" | "iptu");
                setErro("");
                setResultadosBusca([]);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 mb-6 max-w-lg mx-auto">
                <TabsTrigger value="local">Empreendimentos</TabsTrigger>
                <TabsTrigger value="codigo">Por código</TabsTrigger>
                <TabsTrigger value="iptu">Por IPTU</TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-6">
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
              </TabsContent>

              <TabsContent value="codigo" className="space-y-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-slate-500">
                    Busque por código do empreendimento (`cdedificio`) ou do bairro (`cdbairro`).
                  </p>
                </div>
                <div className="flex gap-2 max-w-lg mx-auto">
                  <Input
                    placeholder="Ex: 12345"
                    value={codigoBusca}
                    onChange={(e) => setCodigoBusca(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && buscarPorCodigo()}
                    className="flex-1 font-mono"
                  />
                  <Button onClick={buscarPorCodigo} disabled={loading}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Buscar
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="iptu" className="space-y-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-slate-500">
                    Digite o número da inscrição imobiliária (IPTU) para prospectar um imóvel específico.
                  </p>
                </div>
                <div className="flex gap-2 max-w-lg mx-auto">
                  <Input
                    placeholder="Ex: 32313702960010"
                    value={iptuBusca}
                    onChange={(e) => setIptuBusca(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarPorIptu()}
                    className="flex-1 font-mono"
                  />
                  <Button onClick={buscarPorIptu} disabled={loading}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Avançar
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

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
              ((modoBusca === "local" && termoBusca) ||
                (modoBusca === "codigo" && codigoBusca)) &&
              resultadosBusca.length === 0 &&
              !erro && (
                <EmptyState
                  tipo="busca-sem-resultado"
                  titulo="Nenhum imóvel encontrado"
                  descricao={`Não encontramos resultados para "${
                    modoBusca === "codigo" ? codigoBusca : termoBusca
                  }". ${modoBusca === "codigo" ? "Você pode tentar por nome." : "Tente outro termo."}`}
                />
              )}

            {resultadosBusca.length > 0 && (
              <div className="space-y-3">
                {/* Header com contador de seleção */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-slate-500">
                    {resultadosBusca.length} resultado(s) encontrado(s)
                  </p>
                  {locaisSelecionados.length > 0 && (
                    <span className="text-sm font-medium text-blue-600">
                      {locaisSelecionados.length} selecionado(s)
                    </span>
                  )}
                </div>

                {/* Lista com checkboxes */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                  {resultadosBusca.map((resultado) => {
                    const selecionado = isLocalSelecionado(resultado);
                    return (
                      <div
                        key={`${resultado.tipo}-${resultado.codigo}`}
                        className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${selecionado
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                          }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleLocalSelecionado(resultado)}
                          className="shrink-0"
                        >
                          {selecionado ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                          )}
                        </button>

                        {/* Conteúdo clicável para seleção rápida (processa só este) */}
                        <button
                          onClick={() => selecionarLocal(resultado)}
                          className="flex-1 flex items-center gap-4 text-left group"
                        >
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${resultado.tipo === "edificio"
                              ? "bg-blue-100"
                              : "bg-green-100"
                              }`}
                          >
                            {resultado.tipo === "edificio" ? (
                              <Building2 className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Home className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 truncate">
                                {resultado.nome}
                              </p>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${resultado.tipo === "edificio"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                                  }`}
                              >
                                {resultado.tipo === "edificio"
                                  ? "Edifício"
                                  : "Condomínio"}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {resultado.bairro}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Botão de processar selecionados */}
                {locaisSelecionados.length > 0 && (
                  <div className="sticky bottom-0 pt-3 border-t border-slate-200 bg-white">
                    <Button
                      onClick={processarLocaisSelecionados}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Processar {locaisSelecionados.length} local(is) selecionado(s)
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-xs text-slate-500 text-center mt-2">
                      Ou clique na seta → para processar apenas um local
                    </p>
                  </div>
                )}
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
                    className={`relative w-9 h-5 rounded-full transition-colors ${modoTurbo ? "bg-yellow-500" : "bg-slate-300"
                      }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform flex items-center justify-center ${modoTurbo ? "translate-x-4" : ""
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

        {/* ETAPA 3: PROCESSAMENTO - REDESIGN PREMIUM */}
        {etapa === 3 && (
          <div className="space-y-8 animate-in fade-in-50 duration-500">

            {/* Header com status dinâmico */}
            <div className="text-center">
              {processando ? (
                <>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando em segundo plano...
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Minerando Leads
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Identificando proprietários e buscando informações de contato
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-4">
                    <CheckCircle2 className="w-4 h-4" />
                    Mineração concluída com sucesso!
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    🎉 {estatisticas.sucesso} Leads Encontrados!
                  </h2>
                </>
              )}
            </div>

            {/* Progresso Circular Premium */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-100"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * progresso) / 100}
                    className="transition-all duration-500 ease-out"
                    style={{
                      filter: processando ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none'
                    }}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-slate-900">{progresso}%</span>
                  {processando && (
                    <span className="text-xs text-slate-500 mt-1">
                      {progresso < 50 ? "Identificando..." : progresso < 80 ? "Buscando contatos..." : "Finalizando..."}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Cards de Métricas em Tempo Real */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Card: Imóveis */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Imóveis</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{selecionados.length}</p>
                <p className="text-xs text-blue-500">analisados</p>
              </div>

              {/* Card: Proprietários */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/50 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">Proprietários</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {processando ? Math.round(selecionados.length * progresso / 100) : estatisticas.total}
                </p>
                <p className="text-xs text-purple-500">identificados</p>
              </div>

              {/* Card: Com Contato */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-4 border border-emerald-200/50 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Phone className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Com Telefone</span>
                </div>
                <p className="text-2xl font-bold text-emerald-900">
                  {processando ? "..." : estatisticas.sucesso}
                </p>
                <p className="text-xs text-emerald-500">localizados</p>
              </div>

              {/* Card: Leads Qualificados */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-100/50 rounded-xl p-4 border border-amber-200/50 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Target className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Leads</span>
                </div>
                <p className="text-2xl font-bold text-amber-900">
                  {processando ? "..." : estatisticas.sucesso}
                </p>
                <p className="text-xs text-amber-500">qualificados</p>
              </div>
            </div>

            {/* Timeline Visual de Etapas */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="space-y-4">
                {/* Passo 1 */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${progresso >= 10
                    ? "bg-green-500 text-white"
                    : "bg-slate-200 text-slate-400"
                    }`}>
                    {progresso >= 10 ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-medium">1</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${progresso >= 10 ? "text-green-700" : "text-slate-500"}`}>
                      Iniciando mineração
                    </p>
                    <p className="text-xs text-slate-400">Preparando processamento das unidades</p>
                  </div>
                  {progresso >= 10 && progresso < 50 && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  )}
                </div>

                {/* Linha conectora */}
                <div className="ml-4 w-0.5 h-6 bg-gradient-to-b from-green-500 to-slate-200" />

                {/* Passo 2 */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${progresso >= 50
                    ? "bg-green-500 text-white"
                    : progresso >= 10
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-slate-200 text-slate-400"
                    }`}>
                    {progresso >= 50 ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-medium">2</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${progresso >= 50 ? "text-green-700" : progresso >= 10 ? "text-blue-700" : "text-slate-500"}`}>
                      Identificando proprietários
                    </p>
                    <p className="text-xs text-slate-400">Consultando base de dados do IPTU</p>
                  </div>
                  {progresso >= 10 && progresso < 50 && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  )}
                </div>

                {/* Linha conectora */}
                <div className={`ml-4 w-0.5 h-6 ${progresso >= 50 ? "bg-gradient-to-b from-green-500 to-slate-200" : "bg-slate-200"}`} />

                {/* Passo 3 */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${progresso >= 90
                    ? "bg-green-500 text-white"
                    : progresso >= 50
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-slate-200 text-slate-400"
                    }`}>
                    {progresso >= 90 ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-medium">3</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${progresso >= 90 ? "text-green-700" : progresso >= 50 ? "text-blue-700" : "text-slate-500"}`}>
                      Buscando informações de contato
                    </p>
                    <p className="text-xs text-slate-400">Telefones, WhatsApp e e-mails</p>
                  </div>
                  {progresso >= 50 && progresso < 90 && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  )}
                </div>

                {/* Linha conectora */}
                <div className={`ml-4 w-0.5 h-6 ${progresso >= 90 ? "bg-gradient-to-b from-green-500 to-green-500" : "bg-slate-200"}`} />

                {/* Passo 4 */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${progresso === 100
                    ? "bg-green-500 text-white"
                    : progresso >= 90
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-slate-200 text-slate-400"
                    }`}>
                    {progresso === 100 ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-medium">4</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${progresso === 100 ? "text-green-700" : progresso >= 90 ? "text-blue-700" : "text-slate-500"}`}>
                      Salvando leads qualificados
                    </p>
                    <p className="text-xs text-slate-400">Armazenando no banco de dados</p>
                  </div>
                  {progresso >= 90 && progresso < 100 && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Botão de ação (após conclusão) */}
            {!processando && progresso === 100 && (
              <div className="text-center animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                <div className="inline-flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-800">
                      {estatisticas.sucesso} leads prontos para campanha!
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Tempo de processamento: {estatisticas.tempoTotal}s
                      {estatisticas.doCache > 0 && ` • ${estatisticas.doCache} do cache`}
                    </p>
                  </div>
                  <Button
                    onClick={() => setEtapa(4)}
                    size="lg"
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25"
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Salvar Lista de Contatos
                    <ArrowRight className="w-5 h-5 ml-2" />
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
                  setCodigoBusca("");
                  setIptuBusca("");
                  setModoBusca("local");
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
