import { useEffect, useState } from "react";
import { Coins, AlertTriangle } from "lucide-react";
import { api } from "../servicos/api";
import { cn } from "../lib/utils";

interface SaldoCreditos {
  mensais: number;
  prepagos: number;
  bonus: number;
  total: number;
  plano: string;
}

export function CreditosIndicador() {
  const [saldo, setSaldo] = useState<SaldoCreditos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const carregarSaldo = async () => {
    try {
      setCarregando(true);
      setErro(false);
      const response = await api.get("/billing/saldo");
      // API retorna { sucesso, saldo: { mensais, prepagos, bonus, total }, plano }
      if (response.data?.saldo) {
        setSaldo({
          ...response.data.saldo,
          plano: response.data.plano || "STARTER",
        });
      } else {
        setSaldo(response.data);
      }
    } catch (e) {
      console.error("Erro ao carregar saldo de créditos:", e);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarSaldo();

    // Atualizar a cada 60 segundos
    const interval = setInterval(carregarSaldo, 60000);
    return () => clearInterval(interval);
  }, []);

  // Ouvir evento de créditos consumidos
  useEffect(() => {
    const handleCreditosConsumidos = () => {
      carregarSaldo();
    };

    window.addEventListener("creditos-consumidos", handleCreditosConsumidos);
    return () => {
      window.removeEventListener(
        "creditos-consumidos",
        handleCreditosConsumidos
      );
    };
  }, []);

  if (carregando && !saldo) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg animate-pulse">
        <Coins className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-400">...</span>
      </div>
    );
  }

  if (erro || !saldo) {
    return (
      <button
        onClick={carregarSaldo}
        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
        title="Clique para tentar novamente"
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">Erro</span>
      </button>
    );
  }

  const isBaixo = saldo.total <= 10;
  const isCritico = saldo.total <= 3;

  return (
    <button
      onClick={carregarSaldo}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-105",
        isCritico
          ? "bg-red-100 text-red-700 border border-red-200"
          : isBaixo
            ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
            : "bg-green-50 text-green-700 border border-green-200"
      )}
      title={`Mensais: ${saldo.mensais} | Pré-pagos: ${saldo.prepagos} | Bônus: ${saldo.bonus}`}
    >
      <Coins
        className={cn(
          "w-4 h-4",
          isCritico
            ? "text-red-500"
            : isBaixo
              ? "text-yellow-500"
              : "text-green-500"
        )}
      />
      <span className="text-sm font-semibold">{saldo.total}</span>
      <span className="text-xs text-slate-500">créditos</span>
      {isBaixo && (
        <AlertTriangle
          className={cn(
            "w-3.5 h-3.5 ml-1",
            isCritico ? "text-red-500" : "text-yellow-500"
          )}
        />
      )}
    </button>
  );
}
