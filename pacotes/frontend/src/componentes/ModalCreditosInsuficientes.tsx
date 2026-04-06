import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { api } from "../servicos/api";
import {
  Coins,
  AlertTriangle,
  Crown,
  Zap,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ModalCreditosInsuficientesProps {
  isOpen: boolean;
  onClose: () => void;
  creditosNecessarios: number;
  operacao?: string;
}

// Configurações de planos (espelho do backend)
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

export function ModalCreditosInsuficientes({
  isOpen,
  onClose,
  creditosNecessarios,
  operacao = "esta operação",
}: ModalCreditosInsuficientesProps) {
  const navigate = useNavigate();

  const [planoAtual, setPlanoAtual] = useState<string>("STARTER");
  const [saldoAtual, setSaldoAtual] = useState<number>(0);
  const [quantidade, setQuantidade] = useState(creditosNecessarios);
  const [comprando, setComprando] = useState(false);
  const [carregandoUpgrade, setCarregandoUpgrade] = useState(false);
  const [valorUpgrade, setValorUpgrade] = useState<number>(0);
  const [diasRestantes, setDiasRestantes] = useState<number>(0);

  // Carregar dados do usuário
  useEffect(() => {
    if (isOpen) {
      console.log('[DEBUG] ModalCreditosInsuficientes ABERTO. Necessários:', creditosNecessarios);
      carregarDados();
      // Mínimo de 10 créditos (exigência da API)
      setQuantidade(Math.max(10, creditosNecessarios));
    }
  }, [isOpen, creditosNecessarios]);

  const carregarDados = async () => {
    try {
      const response = await api.get("/billing/saldo");
      setPlanoAtual(response.data?.plano || "STARTER");
      setSaldoAtual(response.data?.saldo?.total || 0);

      // Calcular upgrade se não for PRO
      if (response.data?.plano !== "PRO") {
        calcularUpgrade();
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  };

  const calcularUpgrade = async () => {
    try {
      setCarregandoUpgrade(true);
      const response = await api.get("/billing/calcular-upgrade?novoPlano=PRO");
      setValorUpgrade(response.data?.calculo?.valorUpgradeProRata || 0);
      setDiasRestantes(response.data?.calculo?.diasRestantes || 0);
    } catch (e) {
      console.error("Erro ao calcular upgrade:", e);
    } finally {
      setCarregandoUpgrade(false);
    }
  };

  const comprarCreditos = async () => {
    try {
      setComprando(true);
      const response = await api.post("/billing/comprar-creditos", {
        quantidade,
      });

      if (response.data.sucesso) {
        // Se retornou PIX, mostrar QR Code
        if (response.data.pagamento?.pixQrCode) {
          toast.success("PIX gerado!", {
            description: "Escaneie o QR Code para pagar",
          });

          // Abrir link do PIX em nova janela (temporário - ideal seria modal)
          if (response.data.pagamento.invoiceUrl) {
            window.open(response.data.pagamento.invoiceUrl, "_blank");
          }
        } else {
          toast.info("Compra registrada!", {
            description: "Aguardando configuração de pagamento.",
          });
        }

        onClose();
        window.dispatchEvent(new Event("creditos-atualizados"));
      }
    } catch (e: any) {
      console.error("Erro na compra:", e);
      toast.error(e.response?.data?.erro || "Erro ao processar compra");
    } finally {
      setComprando(false);
    }
  };

  const fazerUpgrade = async () => {
    try {
      setComprando(true);
      const response = await api.post("/billing/upgrade", { novoPlano: "PRO" });

      if (response.data.sucesso) {
        toast.success("🎉 Upgrade realizado!", {
          description: "Você agora é PRO com 250 créditos!",
        });
        onClose();
        window.dispatchEvent(new Event("creditos-atualizados"));
      }
    } catch (e) {
      toast.error("Erro ao fazer upgrade");
    } finally {
      setComprando(false);
    }
  };

  const irParaPaginaCreditos = () => {
    onClose();
    navigate("/dashboard/creditos");
  };

  // Cálculos
  const config = PLANOS[planoAtual as keyof typeof PLANOS] || PLANOS.STARTER;
  // Mínimo de 10 créditos (exigência da API)
  const creditosFaltando = Math.max(10, creditosNecessarios - saldoAtual);
  const valorCompra = quantidade * config.custoPorCredito;
  const valorSeFossePro = quantidade * PLANOS.PRO.custoPorCredito;
  const economiaCompra = valorCompra - valorSeFossePro;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-0 shadow-2xl">
        {/* Título para acessibilidade (visualmente oculto) */}
        <DialogTitle className="sr-only">Créditos Insuficientes</DialogTitle>

        {/* Header Premium */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-6 text-white relative overflow-hidden">
          {/* Padrão de fundo */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full translate-x-24 translate-y-24" />
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex items-start gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                Ops! Créditos Insuficientes
              </h2>
              <p className="text-white/90 mt-1">
                Você precisa de{" "}
                <span className="font-bold text-amber-200">
                  {creditosNecessarios} créditos
                </span>{" "}
                para {operacao}
              </p>
              <div className="flex items-center gap-2 mt-3 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 w-fit">
                <Coins className="w-4 h-4" />
                <span className="text-sm">
                  Saldo atual: <strong>{saldoAtual}</strong> créditos
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6">
          {/* Opção 1: Compra Rápida */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-emerald-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-emerald-800">Compra Rápida</h3>
            </div>

            <div className="flex gap-3 items-center mb-4">
              <Input
                type="number"
                min={creditosFaltando}
                value={quantidade}
                onChange={(e) =>
                  setQuantidade(
                    Math.max(
                      creditosFaltando,
                      parseInt(e.target.value) || creditosFaltando
                    )
                  )
                }
                className="text-xl font-bold text-center h-12 w-32 border-emerald-300 focus:ring-green-500"
              />
              <div className="flex-1">
                <p className="text-sm text-emerald-700">créditos</p>
                <p className="text-xs text-emerald-600">
                  Mínimo: {creditosFaltando} (o que falta)
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-700">
                  R$ {valorCompra.toFixed(2)}
                </p>
                <p className="text-xs text-emerald-600">
                  {config.custoPorCredito.toFixed(2)}/crédito
                </p>
              </div>
            </div>

            <Button
              onClick={comprarCreditos}
              disabled={comprando}
              className="w-full h-12 bg-success hover:bg-success-dark text-white font-semibold"
            >
              {comprando ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-5 h-5 mr-2" />
              )}
              Comprar {quantidade} Créditos - R$ {valorCompra.toFixed(2)}
            </Button>
          </div>

          {/* Comparador PRO (se não for PRO) */}
          {planoAtual !== "PRO" && (
            <>
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-sm text-slate-500 font-medium">
                    OU ECONOMIZE PARA SEMPRE
                  </span>
                </div>
              </div>

              {/* Opção 2: Upgrade PRO */}
              <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 rounded-xl border-2 border-purple-300 p-5 relative">
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  RECOMENDADO
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-5 h-5 text-violet-600" />
                  <h3 className="font-semibold text-violet-800">Seja PRO</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/60 rounded-lg p-3 text-center">
                    <p className="text-3xl font-bold text-violet-700">250</p>
                    <p className="text-xs text-violet-600">créditos/mês</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3 text-center">
                    <p className="text-3xl font-bold text-violet-700">
                      R$ 1,00
                    </p>
                    <p className="text-xs text-violet-600">por crédito extra</p>
                  </div>
                </div>

                {/* Economia nesta compra */}
                <div className="bg-violet-100 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-violet-700">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">
                      Só nesta compra você economizaria{" "}
                      <strong>R$ {economiaCompra.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>

                {/* Valor do upgrade */}
                <div className="flex items-center justify-between mb-4 px-2">
                  <div>
                    <p className="text-sm text-violet-600">
                      Pague hoje (proporcional):
                    </p>
                    <p className="text-2xl font-bold text-violet-700">
                      {carregandoUpgrade
                        ? "..."
                        : `R$ ${valorUpgrade.toFixed(2)}`}
                    </p>
                    <p className="text-xs text-violet-500">
                      {diasRestantes} dias restantes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-violet-600">E ganhe:</p>
                    <p className="text-xl font-bold text-violet-700">
                      250 créditos
                    </p>
                    <p className="text-xs text-violet-500">imediatamente!</p>
                  </div>
                </div>

                <Button
                  onClick={fazerUpgrade}
                  disabled={comprando || carregandoUpgrade}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold"
                >
                  {comprando ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Crown className="w-5 h-5 mr-2" />
                  )}
                  Quero ser PRO! 🚀
                </Button>
              </div>
            </>
          )}

          {/* Link para mais opções */}
          <button
            onClick={irParaPaginaCreditos}
            className="w-full text-center text-sm text-slate-500 hover:text-brand transition-colors py-2 flex items-center justify-center gap-1"
          >
            Ver mais opções de recarga
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
