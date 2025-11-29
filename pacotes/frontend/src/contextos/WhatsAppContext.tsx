import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api } from "../servicos/api";

type StatusWhatsApp =
  | "CONECTADO"
  | "DESCONECTADO"
  | "CONECTANDO"
  | "CARREGANDO";

interface WhatsAppContextData {
  status: StatusWhatsApp;
  verificarStatus: () => Promise<void>;
}

const WhatsAppContext = createContext<WhatsAppContextData>(
  {} as WhatsAppContextData
);

export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusWhatsApp>("CARREGANDO");

  const verificarStatus = async () => {
    try {
      const response = await api.get("/whatsapp/status");
      setStatus(response.data.status);
    } catch (error) {
      console.error("Erro ao verificar status do WhatsApp:", error);
      setStatus("DESCONECTADO");
    }
  };

  useEffect(() => {
    verificarStatus();
    const intervalo = setInterval(verificarStatus, 30000); // Polling a cada 30s
    return () => clearInterval(intervalo);
  }, []);

  return (
    <WhatsAppContext.Provider value={{ status, verificarStatus }}>
      {children}
    </WhatsAppContext.Provider>
  );
}

export function useWhatsAppStatus() {
  const context = useContext(WhatsAppContext);
  if (!context) {
    throw new Error(
      "useWhatsAppStatus deve ser usado dentro de um WhatsAppProvider"
    );
  }
  return context;
}
