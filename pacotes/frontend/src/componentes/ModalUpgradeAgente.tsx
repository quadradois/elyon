import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { api } from "../servicos/api";
import { Bot, Crown, Check, Loader2, X, Sparkles, Rocket } from "lucide-react";
import { toast } from "sonner";

interface ModalUpgradeAgenteProps {
  isOpen: boolean;
  onClose: () => void;
  limiteAtual: number;
}

export function ModalUpgradeAgente({
  isOpen,
  onClose,
  limiteAtual,
}: ModalUpgradeAgenteProps) {
  const [comprando, setComprando] = useState(false);

  const contratarAgenteExtra = async () => {
    try {
      setComprando(true);
      const response = await api.post("/billing/contratar-agente-extra");

      if (response.data.sucesso) {
        toast.success("🎉 Agente Extra Contratado!", {
          description:
            "Seu limite foi aumentado. Você já pode criar seu novo agente.",
          duration: 5000,
        });
        onClose();
        // Recarregar a página para atualizar o estado global se necessário
        // ou apenas deixar o usuário tentar de novo (o backend já vai permitir)
      }
    } catch (e: any) {
      console.error("Erro na contratação:", e);
      toast.error(e.response?.data?.erro || "Erro ao processar contratação");
    } finally {
      setComprando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
        <DialogTitle className="sr-only">
          Limite de Agentes Atingido
        </DialogTitle>

        {/* Header Premium */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white relative overflow-hidden">
          {/* Efeitos de fundo */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-violet-300 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-lg ring-1 ring-white/30">
              <Bot className="w-10 h-10 text-white" />
              <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3" />
                PRO
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1">
              Limite de Agentes Atingido
            </h2>
            <p className="text-violet-100 text-sm max-w-[80%]">
              Você já está usando seus {limiteAtual} agentes disponíveis.
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 bg-white">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-violet-600" />
              Expanda sua Operação
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="mt-1 bg-emerald-100 p-1 rounded-full">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    Agente IA Adicional
                  </p>
                  <p className="text-xs text-slate-500">
                    SDR, Atendente ou Especialista
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="mt-1 bg-emerald-100 p-1 rounded-full">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    Sessão WhatsApp Dedicada
                  </p>
                  <p className="text-xs text-slate-500">
                    Conecte um novo número exclusivo
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Oferta */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-violet-100 p-4 mb-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-violet-900">
                Assinatura Mensal
              </span>
              <span className="text-2xl font-bold text-violet-700">
                R$ 99,00
              </span>
            </div>
            <p className="text-xs text-violet-600 text-right">
              Cobrado mensalmente no seu cartão
            </p>
          </div>

          <Button
            onClick={contratarAgenteExtra}
            disabled={comprando}
            className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold shadow-lg shadow-purple-200 transition-all hover:scale-[1.02]"
          >
            {comprando ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2" />
            )}
            Contratar Agente Extra
          </Button>

          <p className="text-center text-xs text-slate-400 mt-4">
            Cancelamento disponível a qualquer momento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
