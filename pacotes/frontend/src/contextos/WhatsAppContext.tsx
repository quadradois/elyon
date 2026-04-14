import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api, isRequestCanceled } from "../servicos/api";

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

  const verificarStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      // Usa o novo endpoint de sessões
      const response = await api.get("/sessoes-whatsapp", { signal });
      const sessoes = response.data.sessoes || [];

      // Se tiver pelo menos uma sessão conectada, considera o sistema conectado
      const algumaConectada = sessoes.some(
        (s: any) => s.status === "CONECTADO"
      );
      const algumaConectando = sessoes.some(
        (s: any) => s.status === "CONECTANDO"
      );

      if (algumaConectada) {
        setStatus("CONECTADO");
      } else if (algumaConectando) {
        setStatus("CONECTANDO");
      } else {
        setStatus("DESCONECTADO");
      }
    } catch (error) {
      if (isRequestCanceled(error)) return;
      console.error("Erro ao verificar status do WhatsApp:", error);
      setStatus("DESCONECTADO");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    verificarStatus(controller.signal);
    const intervalo = setInterval(() => verificarStatus(), 30000); // Polling a cada 30s

    return () => {
      controller.abort();
      clearInterval(intervalo);
    };
  }, [verificarStatus]);

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
