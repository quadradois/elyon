import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Progress } from "./ui/progress";
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Zap, 
  Clock,
  DollarSign,
  Users,
  FolderPlus,
  ChevronDown,
  Check
} from "lucide-react";
import { api } from "../servicos/api";
import { toast } from "sonner";
import { ModalCreditosInsuficientes } from "./ModalCreditosInsuficientes";

interface Campanha {
  id: string;
  nome: string;
  status: string;
  totalContatos: number;
}

interface ImovelResultado {
  nrinscr: string;
  nmedificio: string;
  incompl: string;
  nmlogradou: string;
  nmbairro: string;
}

interface ModalProcessamentoProps {
  isOpen: boolean;
  onClose: () => void;
  imoveis: ImovelResultado[];
  onConcluido: () => void;
  modoTurbo?: boolean; // Novo: executa tudo automaticamente
}

type Etapa =
  | "AGUARDANDO"
  | "SCRAPER"
  | "REVISAO_SCRAPER"
  | "ENRIQUECIMENTO"
  | "SALVANDO"
  | "CONCLUIDO"
  | "ERRO";

interface EstatisticasProcessamento {
  proprietariosEncontrados: number;
  leadsQualificados: number;
  cpfsDoCache: number;
  economiaCacheReais: number;
  tempoTotal: number;
}

interface LeadMinerado {
  nome: string;
  cpf?: string;
  telefones?: { numero: string; tipo: 'CELULAR' | 'FIXO'; whatsapp?: boolean }[];
  emails?: string[];
  inscricaoIptu?: string;
  enderecoImovel?: string;
  bairroImovel?: string;
  areaTerreno?: number;
  areaConstruida?: number;
  tipoImovel?: string;
  valorVenal?: number;
  score?: number;
  dataNascimento?: string;
  idade?: number;
  sexo?: string;
  signo?: string;
  situacaoCadastral?: string;
  obitoProvavel?: boolean;
  nomeMae?: string;
  ppe?: boolean;
  rendaEstimada?: number;
  faixaSalarial?: string;
  profissao?: string;
  setor?: string;
  empresaAtual?: string;
  cnpjEmpresa?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  participacoesEmpresas?: { cnpj: string; razaoSocial: string; participacao: string }[];
  redesSociais?: { rede: string; url: string }[];
}

export function ModalProcessamento({
  isOpen,
  onClose,
  imoveis,
  onConcluido,
  modoTurbo = false,
}: ModalProcessamentoProps) {
  const [etapa, setEtapa] = useState<Etapa>("AGUARDANDO");
  const [progresso, setProgresso] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [proprietariosEncontrados, setProprietariosEncontrados] = useState<any[]>([]);
  const [leadsFinais, setLeadsFinais] = useState<LeadMinerado[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasProcessamento>({
    proprietariosEncontrados: 0,
    leadsQualificados: 0,
    cpfsDoCache: 0,
    economiaCacheReais: 0,
    tempoTotal: 0,
  });
  const [tempoInicio, setTempoInicio] = useState<number>(0);
  
  // Estados para seleção de campanha
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<string>("");
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [vinculandoCampanha, setVinculandoCampanha] = useState(false);
  const [_jobId, setJobId] = useState<string | null>(null);

  // Estado para modal de créditos
  const [modalCreditosOpen, setModalCreditosOpen] = useState(false);
  const [creditosNecessarios, setCreditosNecessarios] = useState(0);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && etapa === "AGUARDANDO") {
      setTempoInicio(Date.now());
      executarScraper();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const executarScraper = async () => {
    setEtapa("SCRAPER");
    setProgresso(5);
    setLogs([]);
    setErro("");
    addLog("🚀 Iniciando mineração assíncrona...");
    addLog(`🔍 Enviando ${imoveis.length} imóveis para processamento...`);

    try {
      // 1. Iniciar job assíncrono
      const responseJob = await api.post("/mineracao/jobs/iniciar", { imoveis });
      const { jobId: novoJobId, total } = responseJob.data;
      
      setJobId(novoJobId);
      addLog(`✅ Job criado: ${novoJobId}`);
      addLog(`⏳ Processando ${total} imóveis em background...`);
      setProgresso(10);

      // 2. Polling para acompanhar progresso
      let concluido = false;
      let ultimoProcessados = 0;
      
      while (!concluido) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s
        
        const statusResponse = await api.get(`/mineracao/jobs/${novoJobId}/status`);
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
      const resultadoResponse = await api.get(`/mineracao/jobs/${novoJobId}/resultado`);
      console.log('[DEBUG-FRONT] Response do Job:', resultadoResponse.data);
      const { proprietarios, creditos, estatisticas: _stats } = resultadoResponse.data;
      console.log('[DEBUG-FRONT] Proprietarios extraidos:', proprietarios);
      console.log('[DEBUG-FRONT] Tipo proprietarios:', Array.isArray(proprietarios) ? 'Array' : typeof proprietarios);

      setProprietariosEncontrados(proprietarios);
      setEstatisticas(prev => ({
        ...prev,
        proprietariosEncontrados: proprietarios.length
      }));
      addLog(`✅ ${proprietarios.length} proprietários identificados.`);
      addLog(`💰 Créditos consumidos: ${creditos?.consumidos || 0}`);
      setProgresso(50);

      // Se modo turbo, continua automaticamente
      if (modoTurbo) {
        addLog("⚡ Modo Turbo ativo - continuando automaticamente...");
        await executarEnriquecimento(proprietarios);
      } else {
        setEtapa("REVISAO_SCRAPER");
        addLog("⏸️ Aguardando confirmação para enriquecimento...");
      }
    } catch (error: any) {
      console.error(error);
      setEtapa("ERRO");
      
      const msgErro = error.response?.data?.erro || error.message || "Erro na etapa de identificação.";
      setErro(msgErro);
      addLog("❌ Falha ao identificar proprietários.");

      // Verificar se é erro de crédito
      console.log('[DEBUG] Analisando erro:', msgErro);
      if (msgErro.toLowerCase().includes("créditos insuficientes") || msgErro.toLowerCase().includes("creditos insuficientes")) {
        console.log('[DEBUG] Detectado erro de crédito!');
        const match = msgErro.match(/(\d+) necessários/);
        if (match && match[1]) {
          const necessarios = parseInt(match[1]);
          console.log('[DEBUG] Créditos necessários:', necessarios);
          setCreditosNecessarios(necessarios);
          setModalCreditosOpen(true);
        } else {
            console.log('[DEBUG] Não foi possível extrair a quantidade necessária via regex.');
            // Fallback: tenta abrir mesmo sem quantidade definida (modal vai usar default)
            setModalCreditosOpen(true);
        }
      }

      toast.error("Erro na mineração", {
        description: msgErro,
      });
    }
  };

  const executarEnriquecimento = async (proprietariosParam?: any[] | any) => {
    // Proteção: se proprietariosParam for objeto com proprietarios, desembrulha
    let dadosProprietarios = proprietariosParam || proprietariosEncontrados;
    if (dadosProprietarios && !Array.isArray(dadosProprietarios) && dadosProprietarios.proprietarios) {
      console.warn('[DEBUG] proprietariosParam estava encapsulado, desembrulhando...');
      dadosProprietarios = dadosProprietarios.proprietarios;
    }
    if (!Array.isArray(dadosProprietarios)) {
      console.error('[DEBUG] dadosProprietarios não é array:', dadosProprietarios);
      dadosProprietarios = [];
    }
    
    setEtapa("ENRIQUECIMENTO");
    addLog("🕵️ Analisando dados dos proprietários...");
    setProgresso(60);

    try {
      // Primeiro, verificar cache (deduplição)
      const cpfList = dadosProprietarios.map((p: any) => p.cpf).filter(Boolean);
      
      addLog(`📊 Processando ${cpfList.length} proprietários...`);
      setProgresso(70);
      
      addLog("🔗 Buscando informações de contato...");
      
      const responseConfirmacao = await api.post("/mineracao/confirmar-leads", {
        proprietarios: dadosProprietarios,
      });
      
      const { total, sucesso, doCache, economia, dados } = responseConfirmacao.data;
      
      // Salvar leads para vinculação posterior
      if (dados && Array.isArray(dados)) {
        setLeadsFinais(dados.map((d: any) => ({
          nome: d.nome,
          cpf: d.cpf,
          telefones: d.telefones,
          emails: d.emails,
          inscricaoIptu: d.nrinscr,
          enderecoImovel: d.endereco_correspondencia,
          bairroImovel: d.nmbairro,
          // Dados do Imóvel (do scraper IPTU)
          nomeEdificio: d.nomeEdificio || d.nmedificio,
          apartamento: d.apartamento,
          bloco: d.bloco,
          unidade: d.unidade,
          box: d.box,
          quadra: d.quadra,
          lote: d.lote,
          tipoImovel: d.tipoImovel,
          score: d.score,
          // Dados extras da Assertiva
          dataNascimento: d.dataNascimento,
          idade: d.idade,
          sexo: d.sexo,
          signo: d.signo,
          situacaoCadastral: d.situacaoCadastral,
          obitoProvavel: d.obitoProvavel,
          nomeMae: d.nomeMae,
          ppe: d.ppe,
          rendaEstimada: d.rendaEstimada,
          faixaSalarial: d.faixaSalarial,
          profissao: d.profissao,
          setor: d.setor,
          empresaAtual: d.empresaAtual,
          cnpjEmpresa: d.cnpjEmpresa,
          endereco: d.endereco,
          participacoesEmpresas: d.participacoesEmpresas,
          redesSociais: d.redesSociais,
        })));
      } else {
        // Se a API não retornar dados, usar os proprietários enriquecidos
        setLeadsFinais(dadosProprietarios.map((p: any) => ({
          nome: p.nome,
          cpf: p.cpf,
          telefones: p.telefones,
          emails: p.emails,
          inscricaoIptu: p.nrinscr,
          enderecoImovel: p.endereco_correspondencia,
          bairroImovel: p.bairro,
          // Dados do Imóvel (do scraper IPTU)
          nomeEdificio: p.nomeEdificio || p.nmedificio,
          apartamento: p.apartamento,
          bloco: p.bloco,
          unidade: p.unidade,
          box: p.box,
          quadra: p.quadra,
          lote: p.lote,
          tipoImovel: p.tipoImovel,
          score: p.score,
        })));
      }
      
      const tempoTotal = Math.round((Date.now() - tempoInicio) / 1000);
      
      setEstatisticas(prev => ({
        ...prev,
        leadsQualificados: sucesso || total,
        cpfsDoCache: doCache || 0,
        economiaCacheReais: economia || 0,
        tempoTotal,
      }));

      addLog(`💾 Salvando ${total} registros no banco...`);
      setProgresso(90);
      
      // Notificação de economia se houve cache
      if (doCache > 0) {
        addLog(`💰 ${doCache} CPFs recuperados do cache (economia: R$ ${(economia || doCache * 2).toFixed(2)})`);
      }

      // Carregar campanhas disponíveis para vinculação
      await carregarCampanhas();

      setProgresso(100);
      setEtapa("CONCLUIDO");
      addLog(`🎉 Processo finalizado! ${sucesso || total} leads qualificados em ${tempoTotal}s.`);
      
      // Toast de sucesso
      toast.success(`🎉 ${sucesso || total} leads minerados com sucesso!`, {
        description: `Tempo total: ${tempoTotal} segundos. Selecione uma campanha para vincular os leads.`,
        duration: 8000,
      });

    } catch (error: any) {
      console.error(error);
      setEtapa("ERRO");
      setErro(error.response?.data?.erro || "Erro na etapa de Enriquecimento.");
      addLog("❌ Falha ao enriquecer dados.");
      toast.error("Erro no enriquecimento", {
        description: error.response?.data?.erro || "Falha ao buscar contatos na Assertiva",
      });
    }
  };

  // Carregar campanhas disponíveis
  const carregarCampanhas = async () => {
    try {
      const response = await api.get("/campanhas");
      const arrayCampanhas = response.data?.campanhas || (Array.isArray(response.data) ? response.data : []);
      const campanhasAtivas = arrayCampanhas.filter(
        (c: Campanha) => c.status === 'ativa' || c.status === 'pausada' || c.status === 'ATIVA' || c.status === 'PAUSADA'
      );
      setCampanhas(campanhasAtivas);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
    }
  };

  // Vincular leads à campanha selecionada
  const vincularLeadsACampanha = async () => {
    if (!campanhaSelecionada || leadsFinais.length === 0) return;
    
    setVinculandoCampanha(true);
    
    try {
      const response = await api.post(`/campanhas/${campanhaSelecionada}/vincular-leads-minerados`, {
        leads: leadsFinais
      });
      
      const { vinculados } = response.data;
      
      toast.success(`🎯 ${vinculados} leads vinculados à campanha!`, {
        description: "Os contatos foram adicionados com sucesso.",
        duration: 5000,
      });
      
      addLog(`📎 ${vinculados} leads vinculados à campanha com sucesso!`);
      
      // Fechar e navegar
      onConcluido();
      
    } catch (error: any) {
      console.error("Erro ao vincular leads:", error);
      toast.error("Erro ao vincular leads", {
        description: error.response?.data?.erro || "Falha ao vincular leads à campanha",
      });
    } finally {
      setVinculandoCampanha(false);
    }
  };

  const nomeEmpreendimento = imoveis[0]?.nmedificio || imoveis[0]?.nmbairro || "Imóveis";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modoTurbo && <Zap className="w-5 h-5 text-amber-500" />}
            Mineração: {nomeEmpreendimento}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span className="flex items-center gap-2">
                {modoTurbo && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Modo Turbo
                  </span>
                )}
                Progresso
              </span>
              <span>{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>

          {/* Status Visual das Etapas - Stepper */}
          <div className="flex items-center justify-between">
            {/* Etapa 1 */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                etapa === "SCRAPER" 
                  ? "bg-brand text-white animate-pulse" 
                  : progresso >= 50 
                    ? "bg-success text-white" 
                    : "bg-slate-200 text-slate-500"
              }`}>
                {progresso >= 50 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </div>
              <span className="text-xs mt-1 text-slate-600">Prefeitura</span>
            </div>
            
            {/* Linha conectora */}
            <div className={`flex-1 h-1 mx-2 rounded ${progresso >= 50 ? "bg-emerald-300" : "bg-slate-200"}`} />
            
            {/* Etapa 2 */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                etapa === "ENRIQUECIMENTO" 
                  ? "bg-brand text-white animate-pulse" 
                  : progresso >= 90 
                    ? "bg-success text-white" 
                    : "bg-slate-200 text-slate-500"
              }`}>
                {progresso >= 90 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
              </div>
              <span className="text-xs mt-1 text-slate-600">Assertiva</span>
            </div>
            
            {/* Linha conectora */}
            <div className={`flex-1 h-1 mx-2 rounded ${progresso >= 90 ? "bg-emerald-300" : "bg-slate-200"}`} />
            
            {/* Etapa 3 */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                etapa === "CONCLUIDO" 
                  ? "bg-success text-white" 
                  : "bg-slate-200 text-slate-500"
              }`}>
                {etapa === "CONCLUIDO" ? <CheckCircle2 className="w-5 h-5" /> : "3"}
              </div>
              <span className="text-xs mt-1 text-slate-600">Conclusão</span>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-slate-950 text-slate-300 p-4 rounded-lg h-32 overflow-y-auto font-mono text-xs space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">
                  [{new Date().toLocaleTimeString()}]
                </span>
                <span>{log}</span>
              </div>
            ))}
            {(etapa === "SCRAPER" || etapa === "ENRIQUECIMENTO") && (
              <div className="flex items-center gap-2 animate-pulse text-brand">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processando...
              </div>
            )}
          </div>

          {/* Mensagem de Erro */}
          {etapa === "ERRO" && (
            <div className="space-y-4">
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Erro no processamento</p>
                  <p className="text-red-500 text-xs">{erro}</p>
                </div>
              </div>

              {/* Botão de Comprar Créditos se for erro de saldo */}
              {erro.includes("Créditos insuficientes") && (
                <button
                  onClick={() => setModalCreditosOpen(true)}
                  className="w-full bg-success hover:bg-success-dark text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-2"
                >
                  <DollarSign className="w-4 h-4" />
                  Comprar Créditos Agora
                </button>
              )}

              {/* Botão Tentar Novamente (Mantém o estado do que já foi raspado) */}
              <button
                onClick={() => {
                  if (proprietariosEncontrados.length > 0) {
                     addLog("🔄 Retomando enriquecimento de onde parou...");
                     executarEnriquecimento();
                  } else {
                     addLog("🔄 Recomeçando scraper do zero...");
                     executarScraper();
                  }
                }}
                className="w-full bg-brand hover:bg-brand-dark text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {proprietariosEncontrados.length > 0 ? "Tentar Enriquecer Novamente" : "Tentar Mineracão Novamente"}
              </button>
            </div>
          )}

          {/* Botão de Revisão (só aparece se NÃO for modo turbo) */}
          {etapa === "REVISAO_SCRAPER" && !modoTurbo && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-2 text-brand font-medium bg-indigo-50 px-4 py-2 rounded-full text-sm">
                <Users className="w-4 h-4" />
                {proprietariosEncontrados.length} proprietários identificados
              </div>

              {/* Preview dos Dados */}
              <div className="w-full bg-slate-50 rounded-lg border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-medium sticky top-0">
                    <tr>
                      <th className="p-2">Nome</th>
                      <th className="p-2">CPF</th>
                      <th className="p-2">Endereço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {proprietariosEncontrados.slice(0, 10).map((p, i) => (
                      <tr key={i} className="hover:bg-white">
                        <td className="p-2 font-medium text-slate-700 truncate max-w-[120px]" title={p.nome}>
                          {p.nome || "Não identificado"}
                        </td>
                        <td className="p-2 text-slate-500 font-mono">
                          {p.cpf || "---"}
                        </td>
                        <td className="p-2 text-slate-500 truncate max-w-[150px]" title={p.endereco_correspondencia}>
                          {p.endereco_correspondencia || "---"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {proprietariosEncontrados.length > 10 && (
                  <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-200">
                    E mais {proprietariosEncontrados.length - 10} registros...
                  </div>
                )}
              </div>

              <button
                onClick={() => executarEnriquecimento()}
                className="w-full bg-brand hover:bg-brand-dark text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Buscar Contatos (Assertiva)
              </button>
            </div>
          )}

          {/* Card de Estatísticas - Conclusão */}
          {etapa === "CONCLUIDO" && (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <Users className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-emerald-700">
                    {estatisticas.leadsQualificados}
                  </div>
                  <div className="text-xs text-emerald-600">Leads</div>
                </div>
                
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 text-brand mx-auto mb-1" />
                  <div className="text-2xl font-bold text-indigo-700">
                    {estatisticas.tempoTotal}s
                  </div>
                  <div className="text-xs text-brand">Tempo</div>
                </div>
                
                {estatisticas.cpfsDoCache > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <DollarSign className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-amber-700">
                      R$ {estatisticas.economiaCacheReais.toFixed(0)}
                    </div>
                    <div className="text-xs text-amber-600">Economia</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-emerald-600 font-medium bg-emerald-50 px-4 py-3 rounded-lg justify-center">
                <CheckCircle2 className="w-5 h-5" />
                Mineração Concluída com Sucesso!
              </div>

              {/* Seletor de Campanha */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FolderPlus className="w-4 h-4" />
                  Vincular a uma Campanha
                </label>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownAberto(!dropdownAberto)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-slate-200 rounded-lg hover:border-indigo-400 focus:border-brand focus:outline-none transition-colors"
                  >
                    <span className={campanhaSelecionada ? "text-slate-900" : "text-slate-400"}>
                      {campanhaSelecionada 
                        ? campanhas.find(c => c.id === campanhaSelecionada)?.nome || "Campanha selecionada"
                        : "Selecione uma campanha..."
                      }
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${dropdownAberto ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {dropdownAberto && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {campanhas.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          Nenhuma campanha disponível
                        </div>
                      ) : (
                        campanhas.map((campanha) => (
                          <button
                            key={campanha.id}
                            type="button"
                            onClick={() => {
                              setCampanhaSelecionada(campanha.id);
                              setDropdownAberto(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-indigo-50 transition-colors ${
                              campanhaSelecionada === campanha.id ? 'bg-indigo-50' : ''
                            }`}
                          >
                            <div>
                              <div className="font-medium text-slate-900">{campanha.nome}</div>
                              <div className="text-xs text-slate-500">
                                {campanha.totalContatos} contatos • {campanha.status}
                              </div>
                            </div>
                            {campanhaSelecionada === campanha.id && (
                              <Check className="w-5 h-5 text-brand" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3">
                <button
                  onClick={onConcluido}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Apenas Ver Leads
                </button>
                
                <button
                  onClick={vincularLeadsACampanha}
                  disabled={!campanhaSelecionada || vinculandoCampanha}
                  className={`flex-1 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    campanhaSelecionada && !vinculandoCampanha
                      ? 'bg-brand hover:bg-brand-dark text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {vinculandoCampanha ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-4 h-4" />
                      Vincular à Campanha
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      </Dialog>

      <ModalCreditosInsuficientes
        isOpen={modalCreditosOpen}
        onClose={() => setModalCreditosOpen(false)}
        creditosNecessarios={creditosNecessarios}
        operacao="realizar esta mineração"
      />
    </>
  );
}
