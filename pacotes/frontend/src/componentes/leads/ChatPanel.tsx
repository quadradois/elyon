/**
 * ChatPanel — Redesign WhatsApp Business v2.0
 *
 * 3 tipos de remetente, cada um com cor e badge:
 *   🤖 assistente/sistema → índigo (IA)
 *   👤 usuario           → verde-escuro (humano)
 *   ⚪ cliente            → branco (lead)
 *
 * Features: separadores de data, status de leitura, copiar msg,
 * header com avatar + ações, input multiline, quick replies.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send,
  Loader2,
  MessageSquare,
  Maximize2,
  Bot,
  User,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../servicos/api';
import { toast } from 'sonner';

// ─── Tipos ───────────────────────────────────────

interface Mensagem {
  id: string;
  remetente: string;
  conteudo: string;
  enviadaEm: string;
  lidaEm?: string | null;
  tipo?: string;
  legenda?: string;
}

type TipoRemetente = 'ia' | 'humano' | 'cliente' | 'sistema';

interface ChatPanelProps {
  leadId: string;
  leadNome: string;
  leadTelefone: string | null;
  onExpandir?: () => void;
}

// ─── Helpers ─────────────────────────────────────

function classificarRemetente(remetente: string): TipoRemetente {
  const r = (remetente || '').toLowerCase();
  if (r === 'assistente' || r === 'assistant') return 'ia';
  if (r === 'sistema' || r === 'system') return 'sistema';
  if (r === 'usuario' || r === 'user') return 'humano';
  return 'cliente'; // 'cliente', 'customer', ou qualquer outro
}

function formatarHora(data: string): string {
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDataSeparador(data: string): string {
  const d = new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function agruparPorData(mensagens: Mensagem[]): Map<string, Mensagem[]> {
  const grupos = new Map<string, Mensagem[]>();
  for (const msg of mensagens) {
    const chave = new Date(msg.enviadaEm).toDateString();
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(msg);
  }
  return grupos;
}

// ─── Configs visuais ─────────────────────────────

const REMETENTE_CONFIG: Record<TipoRemetente, {
  bolha: string;
  texto: string;
  metaTexto: string;
  label: string;
  icone: typeof Bot | typeof User | null;
  lado: 'esquerda' | 'direita' | 'centro';
}> = {
  ia: {
    bolha: 'bg-indigo-600 text-white',
    texto: 'text-white',
    metaTexto: 'text-indigo-200',
    label: '🤖 IA',
    icone: Bot,
    lado: 'direita',
  },
  humano: {
    bolha: 'bg-emerald-700 text-white',
    texto: 'text-white',
    metaTexto: 'text-emerald-200',
    label: '👤 Você',
    icone: User,
    lado: 'direita',
  },
  cliente: {
    bolha: 'bg-white border border-slate-200 text-slate-800',
    texto: 'text-slate-800',
    metaTexto: 'text-slate-400',
    label: '',
    icone: null,
    lado: 'esquerda',
  },
  sistema: {
    bolha: '',
    texto: 'text-slate-500 italic',
    metaTexto: 'text-slate-400',
    label: '',
    icone: null,
    lado: 'centro',
  },
};

// Quick replies para o corretor
const QUICK_REPLIES = [
  { emoji: '📅', label: 'Agendar visita', texto: 'Olá! Gostaria de agendar uma visita ao imóvel. Qual o melhor horário para você?' },
  { emoji: '📞', label: 'Ligar', texto: '' }, // ação especial: abre WhatsApp
  { emoji: '📋', label: 'Documentos', texto: 'Para dar continuidade, preciso dos seguintes documentos: RG, CPF e comprovante de residência. Pode me enviar?' },
];

// ─── Componente Bolha ────────────────────────────

function BolhaMensagem({ msg }: { msg: Mensagem }) {
  const [copiado, setCopiado] = useState(false);
  const tipo = classificarRemetente(msg.remetente);
  const cfg = REMETENTE_CONFIG[tipo];

  const copiar = useCallback(() => {
    navigator.clipboard.writeText(msg.conteudo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }, [msg.conteudo]);

  // Mensagem de sistema → linha centralizada
  if (tipo === 'sistema') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-slate-400 italic bg-slate-100 px-3 py-1 rounded-full max-w-[80%] text-center truncate">
          {msg.conteudo}
        </span>
      </div>
    );
  }

  const isDireita = cfg.lado === 'direita';

  return (
    <div className={`group flex ${isDireita ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className="relative max-w-[82%]">
        {/* Badge remetente */}
        {cfg.label && (
          <span className={`text-[9px] font-bold mb-0.5 block ${isDireita ? 'text-right' : 'text-left'} ${
            tipo === 'ia' ? 'text-indigo-400' : 'text-emerald-500'
          }`}>
            {cfg.label}
          </span>
        )}

        {/* Bolha */}
        <div
          className={`
            relative rounded-2xl px-3 py-2 text-[13px] leading-relaxed
            ${cfg.bolha}
            ${isDireita ? 'rounded-br-sm' : 'rounded-bl-sm'}
          `}
        >
          {/* Conteúdo */}
          {msg.tipo === 'image' ? (
            <>
              <img
                src={msg.conteudo}
                alt="Imagem"
                className="max-w-full rounded-lg max-h-[180px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(msg.conteudo, '_blank')}
              />
              {msg.legenda && (
                <p className={`mt-1.5 text-xs ${cfg.texto}`}>{msg.legenda}</p>
              )}
            </>
          ) : msg.tipo === 'audio' ? (
            <audio controls className="w-full h-8">
              <source src={msg.conteudo} type="audio/ogg" />
            </audio>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
          )}

          {/* Footer: hora + status leitura */}
          <div className={`flex items-center justify-end gap-1 mt-1 ${cfg.metaTexto}`}>
            <span className="text-[9px]">{formatarHora(msg.enviadaEm)}</span>
            {isDireita && (
              <span className="text-[9px]">
                {msg.lidaEm ? (
                  <span className="text-blue-300">✓✓</span>
                ) : (
                  <span>✓✓</span>
                )}
              </span>
            )}
          </div>

          {/* Botão copiar — hover only */}
          {msg.tipo !== 'image' && msg.tipo !== 'audio' && (
            <button
              onClick={copiar}
              className={`
                absolute -top-2 ${isDireita ? '-left-8' : '-right-8'}
                opacity-0 group-hover:opacity-100 transition-opacity
                w-6 h-6 rounded-full bg-white shadow-md border border-slate-200
                flex items-center justify-center
              `}
              title="Copiar"
            >
              {copiado ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────

export function ChatPanel({ leadId, leadNome, leadTelefone, onExpandir }: ChatPanelProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novoTexto, setNovoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mostrarQuickReplies, setMostrarQuickReplies] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Data fetching ───
  const carregarMensagens = useCallback(async () => {
    try {
      const response = await api.get(`/leads/${leadId}/chat`);
      setMensagens(response.data.mensagens || []);
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  }, [leadId]);

  useEffect(() => {
    setCarregando(true);
    carregarMensagens();
    const interval = setInterval(carregarMensagens, 5000);
    return () => clearInterval(interval);
  }, [leadId, carregarMensagens]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [mensagens]);

  // ─── Enviar mensagem ───
  const enviarMensagem = async (textoOverride?: string) => {
    const texto = textoOverride || novoTexto;
    if (!texto.trim() || !leadTelefone) return;

    try {
      setEnviando(true);
      await api.post('/whatsapp/enviar', {
        telefone: leadTelefone,
        mensagem: texto,
      });
      setNovoTexto('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '36px';
      }
      await carregarMensagens();
    } catch {
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  // Handle key press — Enter envia, Shift+Enter nova linha
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNovoTexto(e.target.value);
    const el = e.target;
    el.style.height = '36px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ─── Agrupar mensagens por data ───
  const gruposPorData = useMemo(() => agruparPorData(mensagens), [mensagens]);

  // Avatar: inicial + cor por última IA ativa (< 5min)
  const ultimaMsgIA = mensagens.filter(m => classificarRemetente(m.remetente) === 'ia').at(-1);
  const iaAtiva = ultimaMsgIA
    ? (Date.now() - new Date(ultimaMsgIA.enviadaEm).getTime()) < 5 * 60 * 1000
    : false;

  // ─── Contagem de msgs não lidas do cliente ───
  const msgsClienteNaoLidas = mensagens.filter(
    m => classificarRemetente(m.remetente) === 'cliente' && !m.lidaEm
  ).length;

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      {/* ══ HEADER ══ */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[#202c33] text-white shadow-sm">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {(leadNome || '?')[0].toUpperCase()}
        </div>

        {/* Nome + status */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold truncate">{leadNome || 'Sem nome'}</h4>
          <div className="flex items-center gap-1.5">
            {iaAtiva && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                IA ativa
              </span>
            )}
            <span className="text-[10px] text-slate-400">{mensagens.length} msgs</span>
            {msgsClienteNaoLidas > 0 && (
              <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                {msgsClienteNaoLidas}
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {leadTelefone && (
            <button
              onClick={() => window.open(`https://wa.me/55${leadTelefone.replace(/\D/g, '')}`, '_blank')}
              className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              title="Abrir no WhatsApp"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
            </button>
          )}
          {onExpandir && (
            <button
              onClick={onExpandir}
              className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              title="Expandir"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
            </button>
          )}
        </div>
      </div>

      {/* ══ ÁREA DE MENSAGENS ══ */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
        style={{
          overscrollBehavior: 'contain',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'300\' height=\'300\' viewBox=\'0 0 300 300\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23d1d5db\' fill-opacity=\'0.05\'%3E%3Ccircle cx=\'150\' cy=\'150\' r=\'2\'/%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        {carregando ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">Nenhuma mensagem</p>
            <p className="text-xs text-slate-400 mt-1">A conversa aparecerá aqui quando houver interação.</p>
          </div>
        ) : (
          Array.from(gruposPorData.entries()).map(([chaveData, msgs]) => (
            <div key={chaveData}>
              {/* Separador de data */}
              <div className="flex items-center justify-center my-3">
                <span className="text-[10px] font-semibold text-slate-500 bg-white/90 backdrop-blur-sm shadow-sm px-3 py-1 rounded-lg">
                  {formatarDataSeparador(msgs[0].enviadaEm)}
                </span>
              </div>

              {/* Mensagens do dia */}
              {msgs.map((msg) => (
                <BolhaMensagem key={msg.id} msg={msg} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* ══ QUICK REPLIES ══ */}
      {mostrarQuickReplies && (
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-slate-200 overflow-x-auto">
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr.label}
              onClick={() => {
                if (qr.label === 'Ligar' && leadTelefone) {
                  window.open(`https://wa.me/55${leadTelefone.replace(/\D/g, '')}`, '_blank');
                } else if (qr.texto) {
                  enviarMensagem(qr.texto);
                }
                setMostrarQuickReplies(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 whitespace-nowrap transition-colors"
            >
              <span>{qr.emoji}</span>
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {/* ══ INPUT ══ */}
      <div className="bg-[#202c33] px-3 py-2">
        <div className="flex items-end gap-2">
          {/* Botão quick replies toggle */}
          <button
            onClick={() => setMostrarQuickReplies(!mostrarQuickReplies)}
            className={`
              w-8 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0
              ${mostrarQuickReplies ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}
            `}
            title="Respostas rápidas"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${mostrarQuickReplies ? 'rotate-180' : ''}`} />
          </button>

          {/* Textarea multiline */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={novoTexto}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={leadTelefone ? 'Mensagem...' : 'Sem telefone — envio desabilitado'}
              disabled={enviando || !leadTelefone}
              rows={1}
              className="w-full resize-none rounded-xl bg-[#2a3942] text-white text-sm px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '36px', maxHeight: '120px' }}
            />
          </div>

          {/* Botão enviar */}
          <button
            onClick={() => enviarMensagem()}
            disabled={enviando || !novoTexto.trim() || !leadTelefone}
            className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Hint: Shift+Enter */}
        <p className="text-[9px] text-slate-600 mt-1 text-center">
          Enter envia · Shift+Enter nova linha
        </p>
      </div>
    </div>
  );
}
