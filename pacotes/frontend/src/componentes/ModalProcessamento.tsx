import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Progress } from "./ui/progress";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { api } from "../servicos/api";

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
}

type Etapa =
  | "AGUARDANDO"
  | "SCRAPER"
  | "REVISAO_SCRAPER"
  | "ENRIQUECIMENTO"
  | "SALVANDO"
  | "CONCLUIDO"
  | "ERRO";

export function ModalProcessamento({
  isOpen,
  onClose,
  imoveis,
  onConcluido,
}: ModalProcessamentoProps) {
  const [etapa, setEtapa] = useState<Etapa>("AGUARDANDO");
  const [progresso, setProgresso] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [proprietariosEncontrados, setProprietariosEncontrados] = useState<
    any[]
  >([]);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  useEffect(() => {
    if (isOpen && etapa === "AGUARDANDO") {
      executarScraper();
    }
  }, [isOpen]);

  const executarScraper = async () => {
    setEtapa("SCRAPER");
    setProgresso(10);
    setLogs([]);
    setErro("");
    addLog("Iniciando mineração...");
    addLog(`🔍 Consultando Prefeitura para ${imoveis.length} imóveis...`);

    try {
      setProgresso(30);
      const responseScraper = await api.post(
        "/mineracao/identificar-proprietarios",
        { imoveis }
      );
      const proprietarios = responseScraper.data;

      setProprietariosEncontrados(proprietarios);
      addLog(`✅ ${proprietarios.length} proprietários identificados.`);
      setProgresso(50);

      // Pausa para revisão do usuário
      setEtapa("REVISAO_SCRAPER");
      addLog("⏸️ Aguardando confirmação para enriquecimento...");
    } catch (error: any) {
      console.error(error);
      setEtapa("ERRO");
      setErro(error.response?.data?.erro || "Erro na etapa de Scraper.");
      addLog("❌ Falha ao consultar Prefeitura.");
    }
  };

  const executarEnriquecimento = async () => {
    setEtapa("ENRIQUECIMENTO");
    addLog("🕵️ Buscando contatos na Assertiva...");
    setProgresso(70);

    try {
      const responseConfirmacao = await api.post("/mineracao/confirmar-leads", {
        proprietarios: proprietariosEncontrados,
      });
      const { total, sucesso } = responseConfirmacao.data;

      addLog(`💾 Salvando ${total} registros no banco...`);
      setProgresso(100);
      setEtapa("CONCLUIDO");
      addLog(`🎉 Processo finalizado! ${sucesso} leads qualificados.`);
    } catch (error: any) {
      console.error(error);
      setEtapa("ERRO");
      setErro(error.response?.data?.erro || "Erro na etapa de Enriquecimento.");
      addLog("❌ Falha ao enriquecer dados.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mineração em Andamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Barra de Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span>Progresso</span>
              <span>{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>

          {/* Status Visual das Etapas */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div
              className={`p-2 rounded-lg border ${etapa === "SCRAPER" || etapa === "REVISAO_SCRAPER" || etapa === "ENRIQUECIMENTO" || etapa === "CONCLUIDO" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}
            >
              1. Prefeitura
              {etapa === "REVISAO_SCRAPER" && (
                <span className="block text-[10px] font-bold text-orange-500">
                  (Revisão)
                </span>
              )}
            </div>
            <div
              className={`p-2 rounded-lg border ${etapa === "ENRIQUECIMENTO" || etapa === "CONCLUIDO" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}
            >
              2. Assertiva
            </div>
            <div
              className={`p-2 rounded-lg border ${etapa === "CONCLUIDO" ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-100 text-slate-400"}`}
            >
              3. Conclusão
            </div>
          </div>

          {/* Logs */}
          <div className="bg-slate-950 text-slate-300 p-4 rounded-lg h-40 overflow-y-auto font-mono text-xs space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-slate-500">
                  [{new Date().toLocaleTimeString()}]
                </span>
                <span>{log}</span>
              </div>
            ))}
            {etapa === "SCRAPER" || etapa === "ENRIQUECIMENTO" ? (
              <div className="flex items-center gap-2 animate-pulse text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processando...
              </div>
            ) : null}
          </div>

          {/* Mensagem de Erro */}
          {etapa === "ERRO" && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {erro}
            </div>
          )}

          {/* Botão de Revisão (Pausa entre Scraper e Enriquecimento) */}
          {etapa === "REVISAO_SCRAPER" && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-full text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {proprietariosEncontrados.length} proprietários identificados
              </div>

              {/* Preview dos Dados */}
              <div className="w-full bg-slate-50 rounded-lg border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="p-2">Nome</th>
                      <th className="p-2">CPF</th>
                      <th className="p-2">Endereço</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {proprietariosEncontrados.slice(0, 10).map((p, i) => (
                      <tr key={i} className="hover:bg-white">
                        <td
                          className="p-2 font-medium text-slate-700 truncate max-w-[120px]"
                          title={p.nome}
                        >
                          {p.nome || "Não identificado"}
                        </td>
                        <td className="p-2 text-slate-500 font-mono">
                          {p.cpf || "---"}
                        </td>
                        <td
                          className="p-2 text-slate-500 truncate max-w-[150px]"
                          title={p.endereco_correspondencia}
                        >
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
                onClick={executarEnriquecimento}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Buscar Contatos (Assertiva)
              </button>
            </div>
          )}

          {/* Botão de Sucesso Final */}
          {etapa === "CONCLUIDO" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-full">
                <CheckCircle2 className="w-5 h-5" />
                Mineração Concluída com Sucesso!
              </div>

              <button
                onClick={onConcluido}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
