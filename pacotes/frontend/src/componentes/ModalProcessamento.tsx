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
  Users
} from "lucide-react";
import { api } from "../servicos/api";
import { toast } from "sonner";

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
  const [estatisticas, setEstatisticas] = useState<EstatisticasProcessamento>({
    proprietariosEncontrados: 0,
    leadsQualificados: 0,
    cpfsDoCache: 0,
    economiaCacheReais: 0,
    tempoTotal: 0,
  });
  const [tempoInicio, setTempoInicio] = useState<number>(0);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  useEffect(() => {
    if (isOpen && etapa === "AGUARDANDO") {
      setTempoInicio(Date.now());
      executarScraper();
    }
  }, [isOpen]);

  const executarScraper = async () => {
    setEtapa("SCRAPER");
    setProgresso(10);
    setLogs([]);
    setErro("");
    addLog("🚀 Iniciando mineração...");
    addLog(`🔍 Consultando Prefeitura para ${imoveis.length} imóveis...`);

    try {
      setProgresso(30);
      const responseScraper = await api.post(
        "/mineracao/identificar-proprietarios",
        { imoveis }
      );
      const proprietarios = responseScraper.data;

      setProprietariosEncontrados(proprietarios);
      setEstatisticas(prev => ({
        ...prev,
        proprietariosEncontrados: proprietarios.length
      }));
      addLog(`✅ ${proprietarios.length} proprietários identificados.`);
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
      setErro(error.response?.data?.erro || "Erro na etapa de Scraper.");
      addLog("❌ Falha ao consultar Prefeitura.");
      toast.error("Erro na mineração", {
        description: error.response?.data?.erro || "Falha ao consultar dados da Prefeitura",
      });
    }
  };

  const executarEnriquecimento = async (proprietariosParam?: any[]) => {
    const dadosProprietarios = proprietariosParam || proprietariosEncontrados;
    
    setEtapa("ENRIQUECIMENTO");
    addLog("🕵️ Verificando cache de CPFs...");
    setProgresso(60);

    try {
      // Primeiro, verificar cache (deduplição)
      const cpfList = dadosProprietarios.map((p: any) => p.cpf).filter(Boolean);
      
      addLog(`📊 Verificando ${cpfList.length} CPFs...`);
      setProgresso(70);
      
      addLog("🔗 Buscando contatos na Assertiva...");
      
      const responseConfirmacao = await api.post("/mineracao/confirmar-leads", {
        proprietarios: dadosProprietarios,
      });
      
      const { total, sucesso, doCache, economia } = responseConfirmacao.data;
      
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

      setProgresso(100);
      setEtapa("CONCLUIDO");
      addLog(`🎉 Processo finalizado! ${sucesso || total} leads qualificados em ${tempoTotal}s.`);
      
      // Toast de sucesso
      toast.success(`🎉 ${sucesso || total} leads minerados com sucesso!`, {
        description: `Tempo total: ${tempoTotal} segundos`,
        duration: 8000,
        action: {
          label: "Ver Leads",
          onClick: () => onConcluido(),
        },
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

  const nomeEmpreendimento = imoveis[0]?.nmedificio || imoveis[0]?.nmbairro || "Imóveis";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modoTurbo && <Zap className="w-5 h-5 text-yellow-500" />}
            Mineração: {nomeEmpreendimento}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span className="flex items-center gap-2">
                {modoTurbo && (
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
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
                  ? "bg-blue-500 text-white animate-pulse" 
                  : progresso >= 50 
                    ? "bg-green-500 text-white" 
                    : "bg-slate-200 text-slate-500"
              }`}>
                {progresso >= 50 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </div>
              <span className="text-xs mt-1 text-slate-600">Prefeitura</span>
            </div>
            
            {/* Linha conectora */}
            <div className={`flex-1 h-1 mx-2 rounded ${progresso >= 50 ? "bg-green-300" : "bg-slate-200"}`} />
            
            {/* Etapa 2 */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                etapa === "ENRIQUECIMENTO" 
                  ? "bg-blue-500 text-white animate-pulse" 
                  : progresso >= 90 
                    ? "bg-green-500 text-white" 
                    : "bg-slate-200 text-slate-500"
              }`}>
                {progresso >= 90 ? <CheckCircle2 className="w-5 h-5" /> : "2"}
              </div>
              <span className="text-xs mt-1 text-slate-600">Assertiva</span>
            </div>
            
            {/* Linha conectora */}
            <div className={`flex-1 h-1 mx-2 rounded ${progresso >= 90 ? "bg-green-300" : "bg-slate-200"}`} />
            
            {/* Etapa 3 */}
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                etapa === "CONCLUIDO" 
                  ? "bg-green-500 text-white" 
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
              <div className="flex items-center gap-2 animate-pulse text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processando...
              </div>
            )}
          </div>

          {/* Mensagem de Erro */}
          {etapa === "ERRO" && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-medium">Erro no processamento</p>
                <p className="text-red-500 text-xs">{erro}</p>
              </div>
            </div>
          )}

          {/* Botão de Revisão (só aparece se NÃO for modo turbo) */}
          {etapa === "REVISAO_SCRAPER" && !modoTurbo && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-full text-sm">
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <Users className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-green-700">
                    {estatisticas.leadsQualificados}
                  </div>
                  <div className="text-xs text-green-600">Leads</div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-blue-700">
                    {estatisticas.tempoTotal}s
                  </div>
                  <div className="text-xs text-blue-600">Tempo</div>
                </div>
                
                {estatisticas.cpfsDoCache > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <DollarSign className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-yellow-700">
                      R$ {estatisticas.economiaCacheReais.toFixed(0)}
                    </div>
                    <div className="text-xs text-yellow-600">Economia</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-3 rounded-lg justify-center">
                <CheckCircle2 className="w-5 h-5" />
                Mineração Concluída com Sucesso!
              </div>

              <button
                onClick={onConcluido}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Ver Leads Gerados
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
