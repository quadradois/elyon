import { useState, useEffect } from "react";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
  Coins,
  CreditCard,
  Sparkles,
  TrendingUp,
  Check,
  ArrowRight,
  Loader2,
  RefreshCw,
  Crown,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TIPOS
// ============================================

interface Saldo {
  mensais: number;
  prepagos: number;
  bonus: number;
  total: number;
}

interface PlanoInfo {
  nome: string;
  valorMensal: number;
  creditosMensais: number;
  custoPorCredito: number;
}

interface CalculoUpgrade {
  planoAtual: PlanoInfo;
  novoPlano: PlanoInfo;
  calculo: {
    diasRestantes: number;
    valorUpgradeProRata: number;
  };
  beneficios: {
    creditosImediatos: number;
    economiaPorCredito: number;
    mensagem: string;
  };
}

// ============================================
// CONFIGURAÇÕES DE PLANOS (espelho do backend)
// ============================================

const PLANOS = {
  STARTER: {
    nome: "Starter",
    valorMensal: 199,
    creditosMensais: 0,
    custoPorCredito: 2.0,
  },
  GROWTH: {
    nome: "Growth",
    valorMensal: 299,
    creditosMensais: 100,
    custoPorCredito: 1.5,
  },
  PRO: {
    nome: "Pro",
    valorMensal: 499,
    creditosMensais: 250,
    custoPorCredito: 1.0,
  },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function Creditos() {


  // Estado
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [planoAtual, setPlanoAtual] = useState<string>("STARTER");
  const [dataRenovacao, setDataRenovacao] = useState<string | null>(null);

  // Compra de créditos
  const [quantidade, setQuantidade] = useState<number>(50);
  const [comprando, setComprando] = useState(false);

  // Upgrade
  const [calculoUpgrade, setCalculoUpgrade] = useState<CalculoUpgrade | null>(
    null
  );
  const [carregandoUpgrade, setCarregandoUpgrade] = useState(false);
  const [executandoUpgrade, setExecutandoUpgrade] = useState(false);

  // ============================================
  // EFEITOS
  // ============================================

  useEffect(() => {
    carregarSaldo();
  }, []);

  useEffect(() => {
    // Só calcular upgrade após carregar dados e se não for PRO
    if (!loading && planoAtual !== "PRO" && quantidade >= 10) {
      calcularUpgrade();
    }
  }, [quantidade, planoAtual, loading]);

  // ============================================
  // FUNÇÕES
  // ============================================

  const carregarSaldo = async () => {
    try {
      setLoading(true);
      const response = await api.get("/billing/saldo");

      if (response.data?.saldo) {
        setSaldo(response.data.saldo);
      }
      setPlanoAtual(response.data?.plano || "STARTER");
      setDataRenovacao(response.data?.dataRenovacao);
    } catch (error) {
      console.error("Erro ao carregar saldo:", error);
      toast.error("Erro ao carregar saldo");
    } finally {
      setLoading(false);
    }
  };

  const calcularUpgrade = async () => {
    if (planoAtual === "PRO") return;

    try {
      console.log(carregandoUpgrade); // Silence unused var warning
      setCarregandoUpgrade(true);
      const response = await api.get("/billing/calcular-upgrade?novoPlano=PRO");
      setCalculoUpgrade(response.data);
    } catch (error) {
      console.error("Erro ao calcular upgrade:", error);
    } finally {
      setCarregandoUpgrade(false);
    }
  };

  const comprarCreditos = async () => {
    if (quantidade < 10) {
      toast.error("Quantidade mínima: 10 créditos");
      return;
    }

    try {
      setComprando(true);
      const response = await api.post("/billing/comprar-creditos", {
        quantidade,
      });

      if (response.data.sucesso) {
        // Se retornou PIX, abrir página de pagamento
        if (response.data.pagamento?.invoiceUrl) {
          toast.success("PIX gerado com sucesso!", {
            description: "Abrindo página de pagamento...",
          });
          // Abrir página de pagamento do Asaas
          window.open(response.data.pagamento.invoiceUrl, "_blank");
        } else {
          toast.info("Compra registrada!", {
            description: `${quantidade} créditos por R$ ${valorTotal.toFixed(2)}`,
          });
        }
      }
    } catch (error: any) {
      console.error("Erro ao comprar:", error);
      toast.error(error.response?.data?.erro || "Erro ao processar compra");
    } finally {
      setComprando(false);
    }
  };

  const executarUpgrade = async (novoPlano: string) => {
    try {
      setExecutandoUpgrade(true);
      const response = await api.post("/billing/upgrade", { novoPlano });

      if (response.data.sucesso) {
        toast.success(`🎉 Upgrade para ${novoPlano} realizado!`, {
          description: response.data.mensagem,
        });
        carregarSaldo();
        setCalculoUpgrade(null);
      }
    } catch (error) {
      console.error("Erro no upgrade:", error);
      toast.error("Erro ao processar upgrade");
    } finally {
      setExecutandoUpgrade(false);
    }
  };

  // ============================================
  // CÁLCULOS
  // ============================================

  const configPlano =
    PLANOS[planoAtual as keyof typeof PLANOS] || PLANOS.STARTER;
  const valorTotal = quantidade * configPlano.custoPorCredito;
  const valorSeFossePro = quantidade * PLANOS.PRO.custoPorCredito;
  const economiaProCompra = valorTotal - valorSeFossePro;

  const diasParaRenovacao = dataRenovacao
    ? Math.max(
        0,
        Math.ceil(
          (new Date(dataRenovacao).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Coins className="w-7 h-7 text-amber-500" />
          Meus Créditos
        </h1>
        <p className="text-slate-500 mt-1">
          Gerencie seus créditos e recarregue quando precisar
        </p>
      </div>

      {/* Saldo Atual */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Saldo Atual</h2>
          <button
            onClick={carregarSaldo}
            className="text-slate-400 hover:text-brand transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-indigo-50 rounded-lg p-4 text-center">
            <p className="text-sm text-brand font-medium">Mensais</p>
            <p className="text-3xl font-bold text-indigo-700">
              {saldo?.mensais || 0}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <p className="text-sm text-emerald-600 font-medium">Pré-pagos</p>
            <p className="text-3xl font-bold text-emerald-700">
              {saldo?.prepagos || 0}
            </p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 text-center">
            <p className="text-sm text-violet-600 font-medium">Bônus</p>
            <p className="text-3xl font-bold text-violet-700">
              {saldo?.bonus || 0}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center border-2 border-amber-300">
            <p className="text-sm text-amber-600 font-medium">TOTAL</p>
            <p className="text-3xl font-bold text-amber-700">
              {saldo?.total || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                planoAtual === "PRO"
                  ? "bg-violet-100 text-violet-700"
                  : planoAtual === "GROWTH"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {planoAtual}
            </span>
            <span className="text-sm text-slate-500">
              R$ {configPlano.custoPorCredito.toFixed(2)}/crédito
            </span>
          </div>
          {diasParaRenovacao > 0 && (
            <span className="text-sm text-slate-500">
              Renovação em {diasParaRenovacao} dias
            </span>
          )}
        </div>
      </div>

      {/* Comprar Créditos */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          Comprar Créditos
        </h2>

        <div className="space-y-4">
          {/* Input de quantidade */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quantos créditos você precisa?
            </label>
            <Input
              type="number"
              min={10}
              max={10000}
              value={quantidade}
              onChange={(e) =>
                setQuantidade(Math.max(10, parseInt(e.target.value) || 10))
              }
              className="text-2xl font-bold text-center h-16"
              placeholder="50"
            />
            <p className="text-xs text-slate-500 mt-1">Mínimo: 10 créditos</p>
          </div>

          {/* Atalhos */}
          <div className="flex gap-2 flex-wrap">
            {[25, 50, 100, 200, 500].map((qtd) => (
              <button
                key={qtd}
                onClick={() => setQuantidade(qtd)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  quantidade === qtd
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {qtd}
              </button>
            ))}
          </div>

          {/* Cálculo */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-lg">
              <span className="text-slate-600">
                {quantidade} créditos × R${" "}
                {configPlano.custoPorCredito.toFixed(2)}
              </span>
              <span className="font-bold text-slate-900">
                R$ {valorTotal.toFixed(2)}
              </span>
            </div>

            {/* Comparador PRO */}
            {planoAtual !== "PRO" && economiaProCompra > 0 && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mt-3">
                <div className="flex items-start gap-2">
                  <Crown className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-violet-700 font-medium">
                      Se fosse PRO, pagaria R$ {valorSeFossePro.toFixed(2)}
                    </p>
                    <p className="text-violet-600 text-sm">
                      Economia de{" "}
                      <span className="font-bold">
                        R$ {economiaProCompra.toFixed(2)}
                      </span>{" "}
                      só nesta compra!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botão Comprar */}
          <Button
            onClick={comprarCreditos}
            disabled={comprando || quantidade < 10}
            className="w-full h-14 text-lg bg-success hover:bg-success-dark"
          >
            {comprando ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pagar R$ {valorTotal.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Upgrade de Plano (se não for PRO) */}
      {planoAtual !== "PRO" && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-violet-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            Fazer Upgrade
          </h2>
          <p className="text-slate-600 text-sm mb-4">
            Economize em cada crédito e ganhe créditos mensais inclusos!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Growth (se for Starter) */}
            {planoAtual === "STARTER" && (
              <div className="bg-white rounded-lg p-4 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-brand" />
                  <span className="font-bold text-indigo-700">GROWTH</span>
                </div>
                <ul className="space-y-1 text-sm text-slate-600 mb-4">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    100 créditos/mês inclusos
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    R$ 1,50 por crédito extra
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Economize R$ 0,50/crédito
                  </li>
                </ul>
                <Button
                  onClick={() => executarUpgrade("GROWTH")}
                  disabled={executandoUpgrade}
                  variant="outline"
                  className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                >
                  Upgrade para Growth
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Card PRO */}
            <div className="bg-white rounded-lg p-4 border-2 border-purple-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-violet-600 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                RECOMENDADO
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-violet-600" />
                <span className="font-bold text-violet-700">PRO</span>
              </div>
              <ul className="space-y-1 text-sm text-slate-600 mb-4">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <strong>250 créditos/mês</strong> inclusos
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <strong>R$ 1,00</strong> por crédito extra
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Economize até <strong>R$ 1,00/crédito</strong>
                </li>
              </ul>

              {calculoUpgrade && (
                <div className="bg-violet-50 rounded-lg p-3 mb-3 text-sm">
                  <p className="text-violet-700">
                    <strong>Pague hoje:</strong> R${" "}
                    {calculoUpgrade.calculo.valorUpgradeProRata.toFixed(2)}
                  </p>
                  <p className="text-violet-600 text-xs mt-1">
                    (proporcional a {calculoUpgrade.calculo.diasRestantes} dias
                    restantes)
                  </p>
                  <p className="text-violet-700 mt-2">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Ganhe{" "}
                    <strong>
                      {calculoUpgrade.beneficios.creditosImediatos} créditos
                    </strong>{" "}
                    agora!
                  </p>
                </div>
              )}

              <Button
                onClick={() => executarUpgrade("PRO")}
                disabled={executandoUpgrade}
                className="w-full bg-violet-600 hover:bg-violet-700"
              >
                {executandoUpgrade ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Ser PRO agora!
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Badge PRO (se já for) */}
      {planoAtual === "PRO" && (
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white text-center">
          <Crown className="w-12 h-12 mx-auto mb-2" />
          <h3 className="text-xl font-bold">Você é PRO! 🎉</h3>
          <p className="text-violet-100 mt-1">
            250 créditos mensais + R$ 1,00 por crédito extra
          </p>
        </div>
      )}
    </div>
  );
}
