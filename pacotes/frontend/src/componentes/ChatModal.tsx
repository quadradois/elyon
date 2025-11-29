import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Send, Loader2, User, Bot, MessageSquare } from "lucide-react";
import { api } from "../servicos/api";

interface Mensagem {
  id: string;
  papel: "USUARIO" | "ASSISTENTE" | "SISTEMA";
  conteudo: string;
  enviadaEm: string;
  tipo?: "text" | "image" | "audio" | "video" | "document";
  legenda?: string;
}

interface ChatProps {
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatModal({ lead, open, onOpenChange }: ChatProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novoTexto, setNovoTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lead) {
      carregarMensagens();
      // Polling para novas mensagens a cada 3 segundos
      const interval = setInterval(carregarMensagens, 3000);
      return () => clearInterval(interval);
    }
  }, [open, lead]);

  useEffect(() => {
    // Scroll para o final quando mensagens mudarem
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagens]);

  const carregarMensagens = async () => {
    if (!lead) return;
    try {
      const response = await api.get(`/leads/${lead.id}/chat`);
      setMensagens(response.data.mensagens || []);
    } catch (error) {
      console.error("Erro ao carregar chat:", error);
    }
  };

  const enviarMensagem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!novoTexto.trim() || !lead?.telefone) return;

    try {
      setEnviando(true);

      // 1. Envia via WhatsApp (Evolution API)
      await api.post("/whatsapp/enviar", {
        telefone: lead.telefone,
        mensagem: novoTexto,
      });

      // 2. Atualiza lista (Otimista ou espera polling)
      // Vamos esperar o polling ou recarregar manual
      setNovoTexto("");
      await carregarMensagens();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat com {lead?.nome}
          </DialogTitle>
          <DialogDescription>
            Histórico de conversas via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden border rounded-md bg-slate-50 p-4 relative">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {mensagens.length === 0 ? (
                <div className="text-center text-slate-400 mt-20">
                  <p>Nenhuma mensagem ainda.</p>
                  <p className="text-xs">Envie a primeira mensagem abaixo.</p>
                </div>
              ) : (
                mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.papel === "ASSISTENTE" || msg.papel === "SISTEMA"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 text-sm ${
                        msg.papel === "ASSISTENTE" || msg.papel === "SISTEMA"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                      }`}
                    >
                      {/* Renderização Condicional por Tipo */}
                      {msg.tipo === "image" ? (
                        <div className="space-y-2">
                          <img
                            src={msg.conteudo}
                            alt="Imagem enviada"
                            className="max-w-full rounded-md max-h-[200px] object-cover cursor-pointer hover:opacity-90"
                            onClick={() => window.open(msg.conteudo, "_blank")}
                          />
                          {msg.legenda && <p>{msg.legenda}</p>}
                        </div>
                      ) : msg.tipo === "audio" ? (
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <audio controls className="w-full h-8">
                            <source src={msg.conteudo} type="audio/ogg" />
                            <source src={msg.conteudo} type="audio/mpeg" />
                            Seu navegador não suporta áudio.
                          </audio>
                        </div>
                      ) : (
                        <p>{msg.conteudo}</p>
                      )}

                      <span
                        className={`text-[10px] block mt-1 text-right ${
                          msg.papel === "ASSISTENTE"
                            ? "text-blue-100"
                            : "text-slate-400"
                        }`}
                      >
                        {new Date(msg.enviadaEm).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        <form onSubmit={enviarMensagem} className="flex gap-2 mt-2">
          <Input
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={enviando}
          />
          <Button type="submit" disabled={enviando || !novoTexto.trim()}>
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
