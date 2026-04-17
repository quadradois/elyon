/**
 * ChatPanel — WhatsApp Business v3.0
 *
 * Toolbar de Gestão substituindo Quick Replies:
 *   📅 Follow-up   — agenda mensagem customizada na data/hora escolhida
 *   📄 Contrato    — condicional: gera + envia link se não assinado; oculto se assinado
 *   👤 Assumir     — pausa IA (ela monitora e cria contexto); devolve IA quando pronto
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, Loader2, MessageSquare, Maximize2,
  Bot, User, Copy, Check,
  Calendar, FileText, UserCheck, Play, Pause,
  Clock, ExternalLink,
} from 'lucide-react';
import { api } from '../../servicos/api';
import { toast } from 'sonner';

// ─── Tipos ────────────────────────────────────────

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
type Ferramenta = 'followup' | 'contrato' | 'assumir' | null;
type ModoAtendimento = 'IA' | 'HUMANO' | 'PAUSADO';

interface ChatPanelProps {
  leadId: string;
  leadNome: string;
  leadTelefone: string | null;
  leadTemperatura?: string | null;
  leadStatus?: string | null;
  onExpandir?: () => void;
}

// ─── Helpers ──────────────────────────────────────

function classificarRemetente(remetente: string): TipoRemetente {
  const r = (remetente || '').toLowerCase();
  if (r === 'assistente' || r === 'assistant') return 'ia';
  if (r === 'sistema' || r === 'system') return 'sistema';
  if (r === 'usuario' || r === 'user') return 'humano';
  return 'cliente';
}

function formatarHora(data: string): string {
  return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarDataSeparador(data: string): string {
  const d = new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

// ─── Configs visuais ──────────────────────────────

const REMETENTE_CONFIG: Record<TipoRemetente, {
  bolha: string; texto: string; metaTexto: string;
  label: string; icone: typeof Bot | typeof User | null;
  lado: 'esquerda' | 'direita' | 'centro';
}> = {
  ia:      { bolha: 'bg-indigo-600 text-white', texto: 'text-white', metaTexto: 'text-indigo-200', label: '🤖 IA', icone: Bot, lado: 'direita' },
  humano:  { bolha: 'bg-emerald-700 text-white', texto: 'text-white', metaTexto: 'text-emerald-200', label: '👤 Você', icone: User, lado: 'direita' },
  cliente: { bolha: 'bg-white border border-slate-200 text-slate-800', texto: 'text-slate-800', metaTexto: 'text-slate-400', label: '', icone: null, lado: 'esquerda' },
  sistema: { bolha: '', texto: 'text-slate-500 italic', metaTexto: 'text-slate-400', label: '', icone: null, lado: 'centro' },
};

const TEMP_CONFIG: Record<string, { label: string; cor: string }> = {
  QUENTE: { label: '🔥 Quente', cor: 'bg-red-100 text-red-700 border-red-200' },
  MORNO:  { label: '⚡ Morno',  cor: 'bg-amber-100 text-amber-700 border-amber-200' },
  FRIO:   { label: '❄️ Frio',   cor: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo', QUALIFICADO: 'Qualificado', CONTATANDO: 'Contatando',
  TENTATIVA_AGENDAMENTO: 'Ag. visita', VISITA_AGENDADA: 'Visita agendada',
  DOCUMENTACAO: 'Documentação', EM_NEGOCIACAO: 'Em negociação', ONBOARDING: 'Onboarding',
};

// ─── Bolha de Mensagem ────────────────────────────

function BolhaMensagem({ msg }: { msg: Mensagem }) {
  const [copiado, setCopiado] = useState(false);
  const tipo = classificarRemetente(msg.remetente);
  const cfg = REMETENTE_CONFIG[tipo];

  const copiar = useCallback(() => {
    navigator.clipboard.writeText(msg.conteudo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }, [msg.conteudo]);

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
        {cfg.label && (
          <span className={`text-[9px] font-bold mb-0.5 block ${isDireita ? 'text-right' : 'text-left'} ${tipo === 'ia' ? 'text-indigo-400' : 'text-emerald-500'}`}>
            {cfg.label}
          </span>
        )}
        <div className={`relative rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${cfg.bolha} ${isDireita ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
          {msg.tipo === 'image' ? (
            <>
              <img src={msg.conteudo} alt="Imagem" className="max-w-full rounded-lg max-h-[180px] object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.conteudo, '_blank')} />
              {msg.legenda && <p className={`mt-1.5 text-xs ${cfg.texto}`}>{msg.legenda}</p>}
            </>
          ) : msg.tipo === 'audio' ? (
            <audio controls className="w-full h-8"><source src={msg.conteudo} type="audio/ogg" /></audio>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
          )}
          <div className={`flex items-center justify-end gap-1 mt-1 ${cfg.metaTexto}`}>
            <span className="text-[9px]">{formatarHora(msg.enviadaEm)}</span>
            {isDireita && (
              <span className="text-[9px]">
                {msg.lidaEm ? <span className="text-blue-300">✓✓</span> : <span>✓✓</span>}
              </span>
            )}
          </div>
          {msg.tipo !== 'image' && msg.tipo !== 'audio' && (
            <button onClick={copiar} className={`absolute -top-2 ${isDireita ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center`} title="Copiar">
              {copiado ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────

export function ChatPanel({ leadId, leadNome, leadTelefone, leadTemperatura, leadStatus, onExpandir }: ChatPanelProps) {
  const [mensagens, setMensagens]         = useState<Mensagem[]>([]);
  const [carregando, setCarregando]       = useState(true);
  const [novoTexto, setNovoTexto]         = useState('');
  const [enviando, setEnviando]           = useState(false);
  const containerRef                       = useRef<HTMLDivElement>(null);
  const textareaRef                        = useRef<HTMLTextAreaElement>(null);

  // ── Toolbar de gestão ──
  const [ferramentaAtiva, setFerramentaAtiva] = useState<Ferramenta>(null);

  // Follow-up
  const [followupMensagem, setFollowupMensagem] = useState('');
  const [followupData, setFollowupData]         = useState('');
  const [agendando, setAgendando]               = useState(false);

  // Contrato
  const [contrato, setContrato]     = useState<{ id?: string; status?: string; linkAceite?: string; aceiteEm?: string | null } | null>(null);
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [gerandoContrato, setGerandoContrato] = useState(false);

  // Modo atendimento (IA / HUMANO / PAUSADO)
  const [modo, setModo]       = useState<ModoAtendimento>('IA');
  const [salvandoModo, setSalvandoModo] = useState(false);

  // ── Carregar mensagens ──
  const carregarMensagens = useCallback(async () => {
    try {
      const resp = await api.get(`/leads/${leadId}/chat`);
      setMensagens(resp.data.mensagens || []);
    } catch {
      /* silencioso */
    } finally {
      setCarregando(false);
    }
  }, [leadId]);

  useEffect(() => { carregarMensagens(); }, [carregarMensagens]);

  // Polling 8s
  useEffect(() => {
    const id = setInterval(carregarMensagens, 8000);
    return () => clearInterval(id);
  }, [carregarMensagens]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [mensagens]);

  // ── Carregar modo ao abrir ──
  useEffect(() => {
    api.get(`/leads/${leadId}/modo`)
      .then(r => setModo(r.data.modo || 'IA'))
      .catch(() => {});
  }, [leadId]);

  // ── Carregar contrato ao abrir aba contrato ──
  useEffect(() => {
    if (ferramentaAtiva !== 'contrato') return;
    setLoadingContrato(true);
    api.get(`/contratos/lead/${leadId}`)
      .then(r => {
        const lista = r.data || [];
        // Priorizar assinado, depois mais recente
        const assinado = lista.find((c: any) => c.aceiteEm);
        setContrato(assinado || lista[0] || null);
      })
      .catch(() => setContrato(null))
      .finally(() => setLoadingContrato(false));
  }, [ferramentaAtiva, leadId]);

  // ── Enviar mensagem ──
  const enviarMensagem = useCallback(async (texto?: string) => {
    const msg = texto || novoTexto.trim();
    if (!msg || !leadTelefone) return;
    setEnviando(true);
    try {
      await api.post(`/leads/${leadId}/chat`, { mensagem: msg, telefone: leadTelefone });
      if (!texto) setNovoTexto('');
      if (textareaRef.current) { textareaRef.current.style.height = '36px'; }
      await carregarMensagens();
    } catch {
      toast.error('Falha ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  }, [novoTexto, leadTelefone, leadId, carregarMensagens]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); }
  }, [enviarMensagem]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNovoTexto(e.target.value);
    const el = e.target;
    el.style.height = '36px';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ── Agendar follow-up ──
  const agendarFollowup = async () => {
    if (!followupMensagem.trim() || !followupData) {
      toast.error('Preencha a mensagem e a data/hora');
      return;
    }
    setAgendando(true);
    try {
      await api.post(`/leads/${leadId}/followup`, {
        mensagem: followupMensagem.trim(),
        dataEnvio: new Date(followupData).toISOString(),
      });
      toast.success('Follow-up agendado! ✅');
      setFollowupMensagem('');
      setFollowupData('');
      setFerramentaAtiva(null);
    } catch {
      toast.error('Erro ao agendar follow-up');
    } finally {
      setAgendando(false);
    }
  };

  // ── Gerar e enviar contrato ──
  const gerarEEnviarContrato = async () => {
    setGerandoContrato(true);
    try {
      const resp = await api.post('/contratos/gerar', { leadId, tipoContrato: 'CAPTACAO' });
      const link = resp.data.contrato?.linkAceite;
      if (link) {
        // Envia o link direto na conversa
        await enviarMensagem(
          `📄 *Contrato de Captação*\n\nOlá ${leadNome}! Segue o link para você visualizar e assinar nosso contrato digitalmente:\n\n${link}\n\nQualquer dúvida, é só chamar! 😊`
        );
        toast.success('Contrato gerado e enviado na conversa!');
        setContrato({ linkAceite: link, status: 'PENDENTE' });
      }
    } catch {
      toast.error('Erro ao gerar contrato');
    } finally {
      setGerandoContrato(false);
    }
  };

  // ── Alternar modo atendimento ──
  const alternarModo = async (novoModo: ModoAtendimento) => {
    setSalvandoModo(true);
    try {
      await api.post(`/leads/${leadId}/controle-modo`, { modo: novoModo });
      setModo(novoModo);
      toast.success(
        novoModo === 'HUMANO'
          ? '👤 Você assumiu a conversa. A IA está monitorando e aprendendo.'
          : '🤖 IA reativada. Ela retoma com contexto completo.'
      );
    } catch {
      toast.error('Erro ao alterar modo');
    } finally {
      setSalvandoModo(false);
    }
  };

  // ── Memos ──
  const gruposPorData = useMemo(() => agruparPorData(mensagens), [mensagens]);
  const ultimaMsgIA   = mensagens.filter(m => classificarRemetente(m.remetente) === 'ia').at(-1);
  const iaAtiva       = ultimaMsgIA ? (Date.now() - new Date(ultimaMsgIA.enviadaEm).getTime()) < 5 * 60 * 1000 : false;
  const msgsClienteNaoLidas = mensagens.filter(m => classificarRemetente(m.remetente) === 'cliente' && !m.lidaEm).length;
  const tempCfg   = TEMP_CONFIG[leadTemperatura || ''] || null;
  const statusLabel = STATUS_LABEL[leadStatus || ''] || leadStatus || null;

  // Contrato ativo = assinado
  const contratoAssinado = contrato?.aceiteEm != null;

  // Min datetime para followup = agora
  const minDatetime = new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16);

  const toggleFerramenta = (f: Ferramenta) =>
    setFerramentaAtiva(prev => (prev === f ? null : f));

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ══ HEADER — Widgets de gestão ══ */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 flex-1 flex-wrap min-w-0">
          {tempCfg && (
            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${tempCfg.cor}`}>
              {tempCfg.label}
            </span>
          )}
          {statusLabel && (
            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
              {statusLabel}
            </span>
          )}
          {iaAtiva && modo === 'IA' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
              </span>
              IA ativa
            </span>
          )}
          {modo === 'HUMANO' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              👤 Você no controle
            </span>
          )}
          <span className="text-[10px] text-slate-400 ml-auto">{mensagens.length} msgs</span>
          {msgsClienteNaoLidas > 0 && (
            <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
              {msgsClienteNaoLidas}
            </span>
          )}
        </div>
        {onExpandir && (
          <button onClick={onExpandir} className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0" title="Expandir">
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* ══ ÁREA DE MENSAGENS ══ */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
        style={{ overscrollBehavior: 'contain', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'300\' height=\'300\' viewBox=\'0 0 300 300\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23d1d5db\' fill-opacity=\'0.05\'%3E%3Ccircle cx=\'150\' cy=\'150\' r=\'2\'/%3E%3C/g%3E%3C/svg%3E")' }}
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
              <div className="flex items-center justify-center my-3">
                <span className="text-[10px] font-semibold text-slate-500 bg-white/90 backdrop-blur-sm shadow-sm px-3 py-1 rounded-lg">
                  {formatarDataSeparador(msgs[0].enviadaEm)}
                </span>
              </div>
              {msgs.map(msg => <BolhaMensagem key={msg.id} msg={msg} />)}
            </div>
          ))
        )}
      </div>

      {/* ══ TOOLBAR DE GESTÃO ══ */}
      <div className="bg-white border-t border-slate-100">

        {/* Botões da toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100">
          {/* Follow-up */}
          <button
            onClick={() => toggleFerramenta('followup')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              ferramentaAtiva === 'followup'
                ? 'bg-violet-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title="Agendar Follow-up"
          >
            <Calendar className="w-3.5 h-3.5" />
            Follow-up
          </button>

          {/* Contrato — só exibe se não assinado */}
          {!contratoAssinado && (
            <button
              onClick={() => toggleFerramenta('contrato')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                ferramentaAtiva === 'contrato'
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title="Contrato de Captação"
            >
              <FileText className="w-3.5 h-3.5" />
              Contrato
            </button>
          )}

          {/* Assumir / Devolver IA */}
          <button
            onClick={() => toggleFerramenta('assumir')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              ferramentaAtiva === 'assumir'
                ? 'bg-emerald-600 text-white'
                : modo === 'HUMANO'
                  ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title="Assumir conversa / Devolver IA"
          >
            <UserCheck className="w-3.5 h-3.5" />
            {modo === 'HUMANO' ? 'No controle' : 'Assumir'}
          </button>
        </div>

        {/* ── Painel Follow-up ── */}
        {ferramentaAtiva === 'followup' && (
          <div className="px-3 py-3 bg-violet-50 border-b border-violet-100 space-y-2">
            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" /> Agendar mensagem automática
            </p>
            <textarea
              value={followupMensagem}
              onChange={e => setFollowupMensagem(e.target.value)}
              placeholder="Digite a mensagem que será enviada ao cliente..."
              rows={3}
              className="w-full resize-none rounded-lg text-xs text-slate-700 bg-white border border-violet-200 px-2.5 py-2 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={followupData}
                min={minDatetime}
                onChange={e => setFollowupData(e.target.value)}
                className="flex-1 rounded-lg text-xs text-slate-700 bg-white border border-violet-200 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
              <button
                onClick={agendarFollowup}
                disabled={agendando || !followupMensagem.trim() || !followupData}
                className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
              >
                {agendando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Agendar
              </button>
            </div>
          </div>
        )}

        {/* ── Painel Contrato ── */}
        {ferramentaAtiva === 'contrato' && (
          <div className="px-3 py-3 bg-amber-50 border-b border-amber-100">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1 mb-2">
              <FileText className="w-3 h-3" /> Contrato de Captação
            </p>
            {loadingContrato ? (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
              </div>
            ) : contrato?.linkAceite ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-700">⏳ Contrato aguardando assinatura.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(contrato.linkAceite, '_blank')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver contrato
                  </button>
                  <button
                    onClick={() => enviarMensagem(`📄 Reenvio do link do contrato:\n\n${contrato.linkAceite}`)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg"
                  >
                    <Send className="w-3 h-3" /> Reenviar no chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-xs text-amber-700 flex-1">Gere o contrato e envie o link direto na conversa.</p>
                <button
                  onClick={gerarEEnviarContrato}
                  disabled={gerandoContrato}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {gerandoContrato ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                  Gerar e Enviar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Painel Assumir ── */}
        {ferramentaAtiva === 'assumir' && (
          <div className="px-3 py-3 bg-emerald-50 border-b border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1 mb-2">
              <UserCheck className="w-3 h-3" /> Controle de Atendimento
            </p>
            {modo === 'IA' ? (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-800">🤖 IA está respondendo</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Ao assumir, a IA para de responder mas continua lendo e criando contexto para quando voltar.</p>
                </div>
                <button
                  onClick={() => alternarModo('HUMANO')}
                  disabled={salvandoModo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-40"
                >
                  {salvandoModo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                  Assumir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-emerald-800">👤 Você está no controle</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">A IA monitorou toda a conversa e retomará com contexto completo.</p>
                </div>
                <button
                  onClick={() => alternarModo('IA')}
                  disabled={salvandoModo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-40"
                >
                  {salvandoModo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Devolver IA
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Input ── */}
        <div className="px-3 py-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={novoTexto}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={leadTelefone ? 'Mensagem...' : 'Sem telefone — envio desabilitado'}
                disabled={enviando || !leadTelefone}
                rows={1}
                className="w-full resize-none rounded-xl bg-slate-100 text-slate-800 text-sm px-3 py-2 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '36px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => enviarMensagem()}
              disabled={enviando || !novoTexto.trim() || !leadTelefone}
              className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 mt-1 text-center">Enter envia · Shift+Enter nova linha</p>
        </div>
      </div>
    </div>
  );
}
