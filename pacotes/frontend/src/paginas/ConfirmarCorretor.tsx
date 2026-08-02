import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, UserRound, XCircle } from "lucide-react";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";

type Acao = "confirmar" | "recusar" | "ausencia";

type Dados = {
  leadNome: string;
  horario: string;
  statusConfirmacaoCorretor: string;
  mensagem?: string;
  sucesso?: boolean;
};

const STATUS_FINAIS = new Set(["CONFIRMADO", "RECUSADO", "REMANEJADO", "EXPIRADO"]);

function formatarHorario(horario: string): string {
  return new Date(horario).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function ResultadoAcao({ dados, acao }: { dados: Dados; acao: Acao | null }) {
  const confirmado = dados.statusConfirmacaoCorretor === "CONFIRMADO";
  const recusado = dados.statusConfirmacaoCorretor === "RECUSADO" || acao === "recusar";
  const titulo = confirmado
    ? "Atendimento confirmado"
    : acao === "ausencia"
      ? "Ausência registrada"
      : recusado
        ? "Recusa registrada"
        : dados.statusConfirmacaoCorretor === "EXPIRADO"
          ? "Prazo encerrado"
          : "Ação registrada";
  const mensagem = dados.mensagem || (confirmado
    ? "O lead será avisado da sua confirmação."
    : "O Elyon dará continuidade ao fluxo de atendimento.");
  const Icone = confirmado ? CheckCircle2 : recusado ? XCircle : AlertCircle;
  const cores = confirmado
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : recusado
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-xl border p-5 text-center ${cores}`} role="status" aria-live="polite">
      <Icone className="mx-auto mb-3 h-10 w-10" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="mt-2 text-sm leading-6">{mensagem}</p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide">
        Você já pode fechar esta página
      </p>
    </div>
  );
}

export default function ConfirmarCorretor() {
  const { atividadeId, token } = useParams();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [acaoEmProcessamento, setAcaoEmProcessamento] = useState<Acao | null>(null);
  const [acaoConcluida, setAcaoConcluida] = useState<Acao | null>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/leads/confirmar-corretor/${atividadeId}/${token}`);
        if (ativo) setDados(data);
      } catch (e: any) {
        if (ativo) setErro(e?.response?.data?.erro || "Link inválido ou expirado.");
      } finally {
        if (ativo) setLoading(false);
      }
    };
    void carregar();
    return () => { ativo = false; };
  }, [atividadeId, token]);

  const acionar = async (acao: Acao) => {
    if (acaoEmProcessamento || acaoConcluida) return;
    try {
      setAcaoEmProcessamento(acao);
      setErro("");
      const { data } = await api.post(`/leads/confirmar-corretor/${atividadeId}/${token}`, { acao });
      setDados((prev) => ({
        ...(prev || { leadNome: "", horario: "", statusConfirmacaoCorretor: "" }),
        ...data,
      }));
      setAcaoConcluida(acao);
    } catch (e: any) {
      setErro(e?.response?.data?.erro || "Não foi possível processar. Tente novamente.");
    } finally {
      setAcaoEmProcessamento(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" role="status">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Carregando atendimento...
        </div>
      </div>
    );
  }

  const finalizado = Boolean(acaoConcluida || (dados && STATUS_FINAIS.has(dados.statusConfirmacaoCorretor)));

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-busy={Boolean(acaoEmProcessamento)}>
        <div className="mb-6">
          <p className="text-sm font-medium text-indigo-600">Elyon</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Confirmação de atendimento</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Informe sua disponibilidade para que o lead receba a confirmação.
          </p>
        </div>

        {erro && (
          <div className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{erro}</span>
          </div>
        )}

        {dados && (
          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>Lead: <strong className="text-slate-950">{dados.leadNome}</strong></span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>Horário: <strong className="text-slate-950">{formatarHorario(dados.horario)}</strong></span>
              </div>
            </div>

            {finalizado ? (
              <ResultadoAcao dados={dados} acao={acaoConcluida} />
            ) : (
              <div>
                <p className="mb-3 text-sm font-medium text-slate-800">Você poderá atender neste horário?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button onClick={() => acionar("confirmar")} disabled={Boolean(acaoEmProcessamento)}>
                    {acaoEmProcessamento === "confirmar" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {acaoEmProcessamento === "confirmar" ? "Confirmando" : "Confirmar"}
                  </Button>
                  <Button variant="outline" onClick={() => acionar("recusar")} disabled={Boolean(acaoEmProcessamento)}>
                    {acaoEmProcessamento === "recusar" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {acaoEmProcessamento === "recusar" ? "Registrando" : "Recusar"}
                  </Button>
                  <Button variant="outline" onClick={() => acionar("ausencia")} disabled={Boolean(acaoEmProcessamento)}>
                    {acaoEmProcessamento === "ausencia" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {acaoEmProcessamento === "ausencia" ? "Registrando" : "Ausência"}
                  </Button>
                </div>
                {acaoEmProcessamento && (
                  <p className="mt-3 text-center text-xs text-slate-500" aria-live="polite">
                    Aguarde, estamos registrando sua resposta...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
