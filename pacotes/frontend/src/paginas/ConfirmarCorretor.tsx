import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";

type Dados = {
  leadNome: string;
  horario: string;
  statusConfirmacaoCorretor: string;
  mensagem?: string;
};

export default function ConfirmarCorretor() {
  const { atividadeId, token } = useParams();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/leads/confirmar-corretor/${atividadeId}/${token}`);
      setDados(data);
    } catch (e: any) {
      setErro(e?.response?.data?.erro || "Link inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [atividadeId, token]);

  const acionar = async (acao: "confirmar" | "recusar" | "ausencia") => {
    try {
      setProcessando(true);
      const { data } = await api.post(`/leads/confirmar-corretor/${atividadeId}/${token}`, { acao });
      setDados((prev) => ({ ...(prev || { leadNome: "", horario: "", statusConfirmacaoCorretor: "" }), ...data }));
      setErro("");
    } catch (e: any) {
      setErro(e?.response?.data?.erro || "Não foi possível processar.");
    } finally {
      setProcessando(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Confirmação de reunião</h1>
        {erro && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{erro}</div>}
        {dados && (
          <>
            <p className="text-sm text-slate-600">Lead: <strong>{dados.leadNome}</strong></p>
            <p className="text-sm text-slate-600">Horário: <strong>{new Date(dados.horario).toLocaleString("pt-BR")}</strong></p>
            <p className="text-sm text-slate-600">Status atual: <strong>{dados.statusConfirmacaoCorretor}</strong></p>
            {dados.mensagem && <p className="text-sm text-slate-700">{dados.mensagem}</p>}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => acionar("confirmar")} disabled={processando}>Confirmar</Button>
              <Button variant="outline" onClick={() => acionar("recusar")} disabled={processando}>Recusar</Button>
              <Button variant="outline" onClick={() => acionar("ausencia")} disabled={processando}>Ausência</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
