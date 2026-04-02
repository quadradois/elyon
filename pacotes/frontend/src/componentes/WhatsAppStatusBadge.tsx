import { useWhatsAppStatus } from "../contextos/WhatsAppContext";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function WhatsAppStatusBadge() {
  const { status } = useWhatsAppStatus();

  return (
    <Link
      to="/dashboard/whatsapp"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
        status === "CONECTADO" &&
          "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
        status === "DESCONECTADO" &&
          "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
        (status === "CONECTANDO" || status === "CARREGANDO") &&
          "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
      )}
    >
      {status === "CONECTADO" && <CheckCircle2 className="w-3.5 h-3.5" />}
      {status === "DESCONECTADO" && <AlertCircle className="w-3.5 h-3.5" />}
      {(status === "CONECTANDO" || status === "CARREGANDO") && (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      )}

      <span>
        {status === "CONECTADO" && "WhatsApp Conectado"}
        {status === "DESCONECTADO" && "WhatsApp Desconectado"}
        {status === "CONECTANDO" && "Conectando..."}
        {status === "CARREGANDO" && "Verificando..."}
      </span>
    </Link>
  );
}
