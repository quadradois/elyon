import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  QrCode,
  Copy,
  CheckCircle,
  Loader2,
  ExternalLink,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface ModalPagamentoPIXProps {
  isOpen: boolean;
  onClose: () => void;
  pagamento: {
    id: string;
    pixQrCode: string;
    pixPayload: string;
    invoiceUrl?: string;
  } | null;
  valor: number;
  creditos: number;
}

export function ModalPagamentoPIX({
  isOpen,
  onClose,
  pagamento,
  valor,
  creditos,
}: ModalPagamentoPIXProps) {
  const [copiado, setCopiado] = useState(false);
  // const [verificando, setVerificando] = useState(false);

  const copiarPIX = async () => {
    if (!pagamento?.pixPayload) return;

    try {
      await navigator.clipboard.writeText(pagamento.pixPayload);
      setCopiado(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopiado(false), 3000);
    } catch (e) {
      toast.error("Erro ao copiar");
    }
  };

  // Simular verificação de pagamento (polling seria implementado aqui)
  useEffect(() => {
    if (!isOpen || !pagamento) return;

    // TODO: Implementar polling para verificar status do pagamento
    // const interval = setInterval(async () => { ... }, 5000);
    // return () => clearInterval(interval);
  }, [isOpen, pagamento]);

  if (!pagamento) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">Pagamento PIX</DialogTitle>
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-600">Gerando PIX...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-xl font-bold text-center">
          Pagamento PIX
        </DialogTitle>

        <div className="space-y-6 pt-4">
          {/* Valor */}
          <div className="text-center bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600">Valor a pagar</p>
            <p className="text-3xl font-bold text-green-700">
              R$ {valor.toFixed(2)}
            </p>
            <p className="text-sm text-green-600 mt-1">{creditos} créditos</p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center">
            {pagamento.pixQrCode ? (
              <img
                src={`data:image/png;base64,${pagamento.pixQrCode}`}
                alt="QR Code PIX"
                className="w-48 h-48 border rounded-lg"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center">
                <QrCode className="w-16 h-16 text-slate-400" />
              </div>
            )}
            <p className="text-sm text-slate-500 mt-2">
              Escaneie com o app do seu banco
            </p>
          </div>

          {/* Código copia e cola */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Ou copie o código PIX:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={pagamento.pixPayload || ""}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg border bg-slate-50 text-sm font-mono truncate"
              />
              <Button
                onClick={copiarPIX}
                variant={copiado ? "default" : "outline"}
                className={copiado ? "bg-green-600 hover:bg-green-600" : ""}
              >
                {copiado ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
            <Clock className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Aguardando pagamento... Os créditos serão adicionados
              automaticamente.
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            {pagamento.invoiceUrl && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(pagamento.invoiceUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver Fatura
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
