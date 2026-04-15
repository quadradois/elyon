/**
 * Painel de chat WhatsApp inline (não modal).
 * Reutiliza a lógica do ChatModal mas renderiza como painel fixo.
 */

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, MessageSquare, Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../servicos/api';

interface Mensagem {
  id: string;
  remetente: string;
  conteudo: string;
  enviadaEm: string;
  tipo?: string;
  legenda?: string;
}

interface ChatPanelProps {
  leadId: string;
  leadNome: string;
  leadTelefone: string | null;
  onExpandir?: () => void;
}

export function ChatPanel({ leadId, leadTelefone, onExpandir }: ChatPanelProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarMensagens();
    const interval = setInterval(carregarMensagens, 5000);
    return () => clearInterval(interval);
  }, [leadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens]);

  const carregarMensagens = async () => {
    try {
      const response = await api.get(`/leads/${leadId}/chat`);
      setMensagens(response.data.mensagens || []);
    } catch (error) {
      // Silencioso — chat pode não existir ainda
    } finally {
      setCarregando(false);
    }
  };

  const enviarMensagem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!novoTexto.trim() || !leadTelefone) return;

    try {
      setEnviando(true);
      await api.post('/whatsapp/enviar', {
        telefone: leadTelefone,
        mensagem: novoTexto,
      });
      setNovoTexto('');
      await carregarMensagens();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header do chat */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700">Chat WhatsApp</span>
          <span className="text-[10px] text-slate-400">{mensagens.length} msgs</span>
        </div>
        {onExpandir && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onExpandir}>
            <Maximize2 className="w-3 h-3 text-slate-400" />
          </Button>
        )}
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30 min-h-0">
        {carregando ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            <p className="text-xs">Nenhuma mensagem</p>
          </div>
        ) : (
          mensagens.map((msg) => {
            const enviadaPeloAgente = ['ASSISTENTE', 'SISTEMA', 'assistente', 'sistema'].includes(msg.remetente);
            return (
              <div key={msg.id} className={`flex ${enviadaPeloAgente ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    enviadaPeloAgente
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  {msg.tipo === 'image' ? (
                    <img
                      src={msg.conteudo}
                      alt="Imagem"
                      className="max-w-full rounded-md max-h-[120px] object-cover cursor-pointer"
                      onClick={() => window.open(msg.conteudo, '_blank')}
                    />
                  ) : msg.tipo === 'audio' ? (
                    <audio controls className="w-full h-7">
                      <source src={msg.conteudo} type="audio/ogg" />
                    </audio>
                  ) : (
                    <p>{msg.conteudo}</p>
                  )}
                  <span className={`text-[9px] block mt-1 text-right ${
                    enviadaPeloAgente ? 'text-indigo-200' : 'text-slate-400'
                  }`}>
                    {new Date(msg.enviadaEm).toLocaleTimeString('pt-BR', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={enviarMensagem} className="flex gap-2 p-2 border-t bg-white">
        <Input
          value={novoTexto}
          onChange={(e) => setNovoTexto(e.target.value)}
          placeholder={leadTelefone ? 'Enviar mensagem...' : 'Sem telefone'}
          disabled={enviando || !leadTelefone}
          className="h-8 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          disabled={enviando || !novoTexto.trim() || !leadTelefone}
          className="h-8 w-8 p-0"
        >
          {enviando ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </form>
    </div>
  );
}
