import { useEffect, useState } from "react";
import { PageHeader } from "../componentes/ui/page-header";
import { Card, CardContent } from "../componentes/ui/card";
import { Button } from "../componentes/ui/button";
import { api } from "../servicos/api";
import { Loader2, CheckCircle2, RefreshCw } from "lucide-react";

type ItemPainel = {
  atividadeId: string;
  leadNome: string;
  campanhaNome: string | null;
  corretorAtualNome: string | null;
  agendadoPara: string;
  statusConfirmacaoCorretor: "PENDENTE" | "CONFIRMADO" | "EXPIRADO" | "REMANEJADO" | "RECUSADO";
  cutoffEm: string | null;
};

type PainelResponse = {
  kpis: {
    taxaConfirmacaoNoPrazo: number;
    taxaRemanejamento: number;
    tempoMedioConfirmacaoMin: number | null;
  };
  totais: {
    pendente: number;
    confirmado: number;
    expirado: number;
    remanejado: number;
    recusado: number;
    total: number;
  };
  itens: ItemPainel[];
};

const statusCor: Record<string, string> = {
  PENDENTE: "#f59e0b",
  CONFIRMADO: "#16a34a",
  EXPIRADO: "#dc2626",
  REMANEJADO: "#2563eb",
  RECUSADO: "#7c3aed",
};

export function PainelConfirmacaoCorretor() {
  const [dados, setDados] = useState<PainelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    try {
      setLoading(true);
      setErro("");
      const { data } = await api.get("/leads/confirmacao-corretor/painel");
      setDados(data);
    } catch (error: any) {
      setErro(error?.response?.data?.erro || "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirmações de Corretores"
        description="Acompanhe convites, confirmações, expirações e remanejamentos antes do cutoff T-60."
        icon={<CheckCircle2 className="w-5 h-5" />}
        actions={(
          <Button variant="outline" onClick={carregar} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        )}
      />

      {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando painel...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Taxa confirmação no prazo</p><p className="text-2xl font-bold">{Math.round((dados?.kpis.taxaConfirmacaoNoPrazo || 0) * 100)}%</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Taxa remanejamento</p><p className="text-2xl font-bold">{Math.round((dados?.kpis.taxaRemanejamento || 0) * 100)}%</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Tempo médio confirmação</p><p className="text-2xl font-bold">{dados?.kpis.tempoMedioConfirmacaoMin ?? "-"} min</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-3">Lead</th>
                    <th className="text-left p-3">Campanha</th>
                    <th className="text-left p-3">Responsável</th>
                    <th className="text-left p-3">Reunião</th>
                    <th className="text-left p-3">Cutoff</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dados?.itens || []).map((item) => (
                    <tr key={item.atividadeId} className="border-b border-slate-100">
                      <td className="p-3">{item.leadNome}</td>
                      <td className="p-3">{item.campanhaNome || "-"}</td>
                      <td className="p-3">{item.corretorAtualNome || "Não atribuído"}</td>
                      <td className="p-3">{new Date(item.agendadoPara).toLocaleString("pt-BR")}</td>
                      <td className="p-3">{item.cutoffEm ? new Date(item.cutoffEm).toLocaleString("pt-BR") : "-"}</td>
                      <td className="p-3">
                        <span style={{ color: statusCor[item.statusConfirmacaoCorretor], fontWeight: 700 }}>
                          {item.statusConfirmacaoCorretor}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
