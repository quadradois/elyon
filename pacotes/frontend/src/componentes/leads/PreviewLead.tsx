/**
 * Preview inline do lead — v3.0
 * 4 abas completas: Resumo IA · Chat · Imóvel · Timeline
 * Exibe TODOS os dados disponíveis no lead.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Phone, Mail, ExternalLink, Home, Bot, Calendar,
  MessageSquare, Activity, Copy, Check, Flame, Zap,
  Snowflake, AlertCircle, Clock, UserCheck, Building2,
  TrendingUp, FileText, BadgeCheck, Users, MapPin,
  DoorOpen, Layers, Car, Maximize2, Loader2, ShieldAlert,
  ShieldCheck, Plus,
} from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { AbaDocumentos } from './AbaDocumentos';
import { AbaContato } from './AbaContato';
import type { LeadPriorizado, AtividadePriorizado } from '../../ganchos/useLeadsPriorizados';
import { toast } from 'sonner';
import { api } from '../../servicos/api';
import { getStatusLeadUI, getTemperaturaLeadUI } from './lead-ui';

type AbaPreview = 'resumo' | 'chat' | 'imovel' | 'timeline' | 'docs' | 'contato';

interface PreviewLeadProps {
  lead: LeadPriorizado;
  onFechar: () => void;
  onLeadAtualizado?: () => Promise<void> | void;
}

type CockpitEvento = {
  id: string;
  acao: string;
  detalhes?: Record<string, any>;
  criadoEm: string;
  usuario?: { id: string; nome?: string | null; email?: string | null } | null;
};

type GovernancaLead = {
  prontidaoQualificacao: 'COMPLETA' | 'PARCIAL' | string;
  camposCriticos: {
    total: number;
    preenchidos: number;
    faltantes: string[];
  };
  sourceOfTruth: {
    lastSourceUpdateAt: string | null;
    totalCamposRastreados: number;
    fields: Array<{
      field: string;
      source: string;
      updatedAt?: string | null;
    }>;
  };
};

// ─── helpers ────────────────────────────────────────────────────────────────
function TemperaturaIcon({ temp }: { temp: string | null }) {
  if (temp === 'QUENTE') return <Flame className="w-3.5 h-3.5 text-red-500" />;
  if (temp === 'MORNO') return <Zap className="w-3.5 h-3.5 text-amber-500" />;
  return <Snowflake className="w-3.5 h-3.5 text-blue-400" />;
}




function Campo({ label, valor, icone }: { label: string; valor: string | number | boolean | null | undefined; icone?: React.ReactNode }) {
  const texto =
    valor === null || valor === undefined || valor === ''
      ? null
      : typeof valor === 'boolean'
      ? valor ? 'Sim' : 'Não'
      : String(valor);

  if (!texto) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
        {icone}
        {label}
      </p>
      <p className="text-sm text-slate-800 font-medium">{texto}</p>
    </div>
  );
}

function SecaoCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{titulo}</p>
      </div>
      <div className="p-3 grid grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function PreviewLead({ lead, onFechar, onLeadAtualizado }: PreviewLeadProps) {
  const navigate = useNavigate();
  const [aba, setAba] = useState<AbaPreview>('chat');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [eventosCockpit, setEventosCockpit] = useState<CockpitEvento[]>([]);
  const [governanca, setGovernanca] = useState<GovernancaLead | null>(null);

  const [atividades, setAtividades] = useState<AtividadePriorizado[]>(lead.atividades || []);
  const [criandoAtividade, setCriandoAtividade] = useState(false);
  const [atividadeNova, setAtividadeNova] = useState({
    tipo: 'TAREFA',
    titulo: '',
    descricao: '',
    agendadoPara: '',
  });
  const [atividadeAcaoId, setAtividadeAcaoId] = useState<string | null>(null);
  const statusCfg = getStatusLeadUI(lead.status);
  const tempUi = getTemperaturaLeadUI(lead.temperatura);

  useEffect(() => {
    setAtividades(lead.atividades || []);
  }, [lead.id, lead.atividades]);

  const carregarOperacao = async () => {
    try {
      const [adminRes, eventosRes, leadRes] = await Promise.all([
        api.get(`/leads/${lead.id}/cockpit-admin`),
        api.get(`/leads/${lead.id}/cockpit-eventos?limite=20`),
        api.get(`/leads/${lead.id}`),
      ]);
      void adminRes;
      setEventosCockpit(eventosRes.data?.eventos || []);
      setGovernanca(leadRes.data?.governanca || null);
    } catch (error) {
      console.error('Erro ao carregar operação do lead:', error);
      toast.error('Erro ao carregar dados operacionais do lead');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    carregarOperacao();
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const registrarEventoCockpit = async (acao: string, detalhes?: Record<string, any>) => {
    try {
      await api.post(`/leads/${lead.id}/cockpit-evento`, { acao, detalhes });
    } catch (error) {
      console.error('Erro ao registrar evento do cockpit:', error);
    }
  };

  const atualizarAtividadesLocal = async () => {
    try {
      const res = await api.get(`/leads/${lead.id}`);
      setAtividades(res.data?.atividades || []);
      if (onLeadAtualizado) await onLeadAtualizado();
    } catch (error) {
      console.error('Erro ao atualizar atividades:', error);
    }
  };

  const acionarAtividade = async (atividadeId: string, acao: 'completar' | 'cancelar' | 'reagendar') => {
    try {
      setAtividadeAcaoId(atividadeId);
      const payload: Record<string, any> = { acao };

      if (acao === 'cancelar') {
        const obs = window.prompt('Motivo do cancelamento (opcional):', '') || '';
        payload.observacao = obs;
      }

      if (acao === 'reagendar') {
        const novaData = window.prompt('Nova data/hora (YYYY-MM-DDTHH:mm):', '');
        if (!novaData) return;
        payload.novaData = novaData;
      }

      await api.patch(`/leads/${lead.id}/atividades/${atividadeId}`, payload);
      await registrarEventoCockpit('DECISAO_RESULTADO', { tipo: `atividade_${acao}`, sucesso: true, atividadeId });
      toast.success('Atividade atualizada');
      await atualizarAtividadesLocal();
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
      await registrarEventoCockpit('DECISAO_RESULTADO', { tipo: `atividade_${acao}`, sucesso: false, atividadeId });
      toast.error('Erro ao atualizar atividade');
    } finally {
      setAtividadeAcaoId(null);
    }
  };

  const criarAtividade = async () => {
    if (!atividadeNova.titulo.trim()) {
      toast.error('Título da atividade é obrigatório');
      return;
    }
    try {
      setCriandoAtividade(true);
      await api.post(`/leads/${lead.id}/atividades`, {
        tipo: atividadeNova.tipo,
        titulo: atividadeNova.titulo.trim(),
        descricao: atividadeNova.descricao.trim() || undefined,
        agendadoPara: atividadeNova.agendadoPara || undefined,
      });
      await registrarEventoCockpit('DECISAO_RESULTADO', { tipo: 'atividade_criada', sucesso: true });
      toast.success('Atividade criada');
      setAtividadeNova({ tipo: 'TAREFA', titulo: '', descricao: '', agendadoPara: '' });
      await atualizarAtividadesLocal();
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      await registrarEventoCockpit('DECISAO_RESULTADO', { tipo: 'atividade_criada', sucesso: false });
      toast.error('Erro ao criar atividade');
    } finally {
      setCriandoAtividade(false);
    }
  };

  const pendentesCriticos = useMemo(
    () => governanca?.camposCriticos?.faltantes || [],
    [governanca]
  );

  const copiar = (texto: string, chave: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(chave);
    toast.success('Copiado!');
    setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">

      {/* ══ HEADER ══ */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-start justify-between mb-1.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-slate-900 leading-tight truncate">
              {lead.nome || 'Sem nome'}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <TemperaturaIcon temp={lead.temperatura} />
                {tempUi.label}
              </span>
              {lead.faseSPIN && (
                <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                  SPIN: {lead.faseSPIN}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button
              onClick={() => navigate(`/dashboard/proprietarios/${lead.id}`)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              Abrir
            </button>
            <button
              onClick={onFechar}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Contexto do lead + score em faixa única */}
        <div className={`
          mt-2 flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg border
          ${lead.scoreComposto >= 60 ? 'bg-emerald-50 border-emerald-200' : lead.scoreComposto >= 35 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}
        `}>
          <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
            {lead.telefone && (
              <button
                onClick={() => copiar(lead.telefone!, 'tel')}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 group w-fit"
              >
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium">{lead.telefone}</span>
                {copiado === 'tel'
                  ? <Check className="w-3 h-3 text-emerald-500" />
                  : <Copy className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />
                }
              </button>
            )}
            {lead.campanhaOrigem && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Users className="w-3 h-3" />
                <span className="truncate">{lead.campanhaOrigem.nome}</span>
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Mail className="w-3 h-3 text-slate-400" />
                <span className="truncate">{lead.email}</span>
              </span>
            )}
            {lead.cpf && (
              <button
                onClick={() => copiar(lead.cpf!, 'cpf')}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 group w-fit"
              >
                <BadgeCheck className="w-3 h-3" />
                <span className="font-mono">
                  {lead.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.***.**$4')}
                </span>
                {copiado === 'cpf'
                  ? <Check className="w-3 h-3 text-emerald-500" />
                  : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60" />
                }
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`
              w-8 h-8 rounded-lg flex flex-col items-center justify-center font-bold
              ${lead.scoreComposto >= 60 ? 'bg-emerald-500 text-white' : lead.scoreComposto >= 35 ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'}
            `}>
              <span className="text-xs leading-none">{lead.scoreComposto}</span>
              <span className="text-[8px] leading-none opacity-80">pts</span>
            </div>
            <div className="text-right">
              <p className={`text-[11px] font-bold ${lead.scoreComposto >= 60 ? 'text-emerald-700' : lead.scoreComposto >= 35 ? 'text-amber-700' : 'text-slate-600'}`}>
                {lead.scoreComposto >= 60 ? 'Alto potencial' : lead.scoreComposto >= 35 ? 'Em evolução' : 'Em qualificação'}
              </p>
              <p className="text-[10px] text-slate-400">
                Qualif: <strong>{lead.scoreQualificacao}</strong> · Urg: <strong>{lead.urgencia}</strong> · {lead.totalMensagens} msgs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="flex border-b border-slate-100 flex-shrink-0 overflow-x-auto">
        {[
          { id: 'resumo' as const,   label: 'IA',      icone: Bot },
          { id: 'contato' as const,  label: 'Contato',  icone: Phone },
          { id: 'imovel' as const,   label: 'Imóvel',  icone: Home },
          { id: 'timeline' as const, label: 'Timeline', icone: Activity },
          { id: 'chat' as const,     label: 'Chat',     icone: MessageSquare },
          { id: 'docs' as const,     label: 'Docs',     icone: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold border-b-2 whitespace-nowrap transition-all flex-shrink-0
              ${aba === tab.id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}
            `}
          >
            <tab.icone className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ CONTEÚDO ══ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {aba === 'resumo'   && (
          <AbaResumo
            lead={lead}
            governanca={governanca}
            eventosCockpit={eventosCockpit}
            pendentesCriticos={pendentesCriticos}
          />
        )}
        {aba === 'contato'  && <AbaContato lead={lead} />}
        {aba === 'imovel'   && <AbaImovel lead={lead} />}
        {aba === 'timeline' && (
          <AbaTimeline
            leadId={lead.id}
            leadNome={lead.nome || 'Lead'}
            atividades={atividades}
            criandoAtividade={criandoAtividade}
            atividadeNova={atividadeNova}
            atividadeAcaoId={atividadeAcaoId}
            onAtividadeNovaChange={setAtividadeNova}
            onCriarAtividade={criarAtividade}
            onAcionarAtividade={acionarAtividade}
          />
        )}
        {aba === 'docs' && (
          <AbaDocumentos leadId={lead.id} leadNome={lead.nome || 'Lead'} />
        )}
        {aba === 'chat' && (
          <div className="h-full" style={{ minHeight: '300px' }}>
            <ChatPanel
              leadId={lead.id}
              leadNome={lead.nome || 'Lead'}
              leadTelefone={lead.telefone}
              leadTemperatura={lead.temperatura}
              leadStatus={lead.status}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ABA RESUMO IA — SPIN completo + dores + ações
// ══════════════════════════════════════════════════
function AbaResumo({
  lead,
  governanca,
  eventosCockpit,
  pendentesCriticos,
}: {
  lead: LeadPriorizado;
  governanca: GovernancaLead | null;
  eventosCockpit: CockpitEvento[];
  pendentesCriticos: string[];
}) {
  const temSpin = lead.situacaoAtual || lead.motivacaoVenda || lead.prazoDesejado ||
    lead.consequencias || lead.custosAtuais || lead.expectativaServico;

  return (
    <div className="p-3 space-y-3">
      {/* Governança */}
      <div className={`
        rounded-xl border overflow-hidden
        ${governanca?.prontidaoQualificacao === 'COMPLETA'
          ? 'border-emerald-200'
          : 'border-amber-200'}
      `}>
        <div className={`
          px-3 py-2 border-b flex items-center justify-between
          ${governanca?.prontidaoQualificacao === 'COMPLETA'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'}
        `}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${governanca?.prontidaoQualificacao === 'COMPLETA' ? 'text-emerald-700' : 'text-amber-700'}`}>
            Governança da Qualificação
          </p>
          <span className={`text-[11px] font-semibold ${governanca?.prontidaoQualificacao === 'COMPLETA' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {governanca?.prontidaoQualificacao || 'PARCIAL'}
          </span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {governanca?.prontidaoQualificacao === 'COMPLETA'
              ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
              : <ShieldAlert className="w-4 h-4 text-amber-600" />
            }
            <span className="text-slate-600">
              Criticidade: {governanca?.camposCriticos?.preenchidos ?? 0}/{governanca?.camposCriticos?.total ?? 0} campos críticos preenchidos
            </span>
          </div>
          {pendentesCriticos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendentesCriticos.map((campo) => (
                <span key={campo} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Falta: {campo}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Última atualização de fonte:
            {' '}
            <span className="font-medium text-slate-700">
              {governanca?.sourceOfTruth?.lastSourceUpdateAt
                ? new Date(governanca.sourceOfTruth.lastSourceUpdateAt).toLocaleString('pt-BR')
                : 'Sem atualização registrada'}
            </span>
          </p>
        </div>
      </div>

      {/* Resumo IA */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Bot className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">Resumo IA</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{lead.resumoIA}</p>
        {lead.ultimaAcaoIA && (
          <p className="text-[11px] text-indigo-500 font-medium mt-2 pt-2 border-t border-indigo-100">
            Última ação IA: {lead.ultimaAcaoIA}
          </p>
        )}
      </div>

      {/* Próxima atividade em destaque */}
      {lead.proximaAtividade && (
        <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-800">Próxima atividade</p>
            <p className="text-sm text-emerald-900 font-semibold mt-0.5 truncate">{lead.proximaAtividade.titulo}</p>
            {lead.proximaAtividade.agendadoPara && (
              <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(lead.proximaAtividade.agendadoPara).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
            {lead.proximaAtividade.statusAgendamento && (
              <span className="mt-1 inline-block text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                {lead.proximaAtividade.statusAgendamento}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dores */}
      {lead.doresIdentificadas.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Dores identificadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lead.doresIdentificadas.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Objeções */}
      {lead.objecoes.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Objeções</p>
          <div className="flex flex-wrap gap-1.5">
            {lead.objecoes.map((o, i) => (
              <span key={i} className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-200 font-medium">
                {o}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SPIN completo */}
      {temSpin && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">SPIN — Qualificação</p>
          </div>
          <div className="p-3 space-y-2.5">
            {lead.situacaoAtual && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Situação atual</p>
                <p className="text-sm text-slate-700">{lead.situacaoAtual}</p>
              </div>
            )}
            {lead.motivacaoVenda && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Motivação da venda</p>
                <p className="text-sm text-slate-700">{lead.motivacaoVenda}</p>
              </div>
            )}
            {lead.prazoDesejado && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Prazo desejado</p>
                <p className="text-sm text-slate-700">{lead.prazoDesejado}</p>
              </div>
            )}
            {lead.consequencias && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Consequências</p>
                <p className="text-sm text-slate-700">{lead.consequencias}</p>
              </div>
            )}
            {lead.custosAtuais && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Custos atuais</p>
                <p className="text-sm text-slate-700">{lead.custosAtuais}</p>
              </div>
            )}
            {lead.expectativaServico && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Expectativa de serviço</p>
                <p className="text-sm text-slate-700">{lead.expectativaServico}</p>
              </div>
            )}
            {lead.tentativasAnteriores && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Tentativas anteriores</p>
                <p className="text-sm text-slate-700">{lead.tentativasAnteriores}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {lead.urgenciaEnum && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  lead.urgenciaEnum === 'ALTA' ? 'bg-red-100 text-red-700' :
                  lead.urgenciaEnum === 'MEDIA' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  Urgência {lead.urgenciaEnum}
                </span>
              )}
              {lead.pressaoTempo === true && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  ⏱ Com pressão de tempo
                </span>
              )}
              {lead.comCorretorAtualmente === true && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Já tem corretor
                </span>
              )}
              {lead.interesseAvaliacao === true && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  ✓ Aceitou avaliação
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Negociação comercial */}
      {(lead.comissaoAcordada || lead.tipoAutorizacao || lead.autorizouAnuncio !== null) && (
        <SecaoCard titulo="Negociação comercial">
          <Campo label="Comissão acordada" valor={lead.comissaoAcordada} icone={<BadgeCheck className="w-3 h-3" />} />
          <Campo label="Tipo autorização" valor={lead.tipoAutorizacao} icone={<FileText className="w-3 h-3" />} />
          <Campo label="Prazo do contrato" valor={lead.prazoTrabalho ? `${lead.prazoTrabalho} dias` : null} />
          <Campo label="Autorizou anúncio" valor={lead.autorizouAnuncio} />
        </SecaoCard>
      )}

      {/* Dados pessoais */}
      {(lead.profissao || lead.empresaAtual || lead.rendaEstimada || lead.faixaSalarial || lead.scoreAssertiva) && (
        <SecaoCard titulo="Perfil do proprietário">
          <Campo label="Profissão" valor={lead.profissao} icone={<UserCheck className="w-3 h-3" />} />
          <Campo label="Empresa" valor={lead.empresaAtual} icone={<Building2 className="w-3 h-3" />} />
          <Campo label="Renda estimada" valor={lead.rendaEstimada} />
          <Campo label="Faixa salarial" valor={lead.faixaSalarial} />
          {lead.scoreAssertiva && (
            <div className="col-span-2 flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, lead.scoreAssertiva)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-600">Score {lead.scoreAssertiva}</span>
            </div>
          )}
        </SecaoCard>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {lead.totalMensagens} mensagens
        </span>
        <span>Criado {new Date(lead.criadoEm).toLocaleDateString('pt-BR')}</span>
      </div>

      {/* Telemetria recente */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Telemetria Operacional</p>
        </div>
        <div className="p-3 space-y-2">
          {eventosCockpit.length === 0 ? (
            <p className="text-xs text-slate-400">Sem eventos recentes</p>
          ) : (
            eventosCockpit.slice(0, 6).map((ev) => (
              <div key={ev.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[11px] font-semibold text-slate-700">{ev.acao.replace('COCKPIT_', '')}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {new Date(ev.criadoEm).toLocaleString('pt-BR')} · {ev.usuario?.nome || 'Sistema'}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ABA IMÓVEL — Completa com todos os campos
// ══════════════════════════════════════════════════
function AbaImovel({ lead }: { lead: LeadPriorizado }) {
  // Dados do agente (pré-contrato) — coletados na conversa
  const temDadosAgente = lead.enderecoImovel || lead.tipoImovel || lead.valorPretendido ||
    lead.interesseEm || lead.areaImovel || lead.bairroImovel || lead.nomeEdificio;

  // Dados do wizard (pós-contrato) — coletados pelo Admin agente
  const temDadosWizard = lead.imovelAreaTotal || lead.imovelSuites != null ||
    lead.imovelBanheiros != null || lead.imovelAndar != null ||
    lead.imovelDescricao || lead.imovelCaracteristicas?.length > 0 ||
    lead.imovelFotos?.length > 0 || lead.imovelValorLocacao ||
    lead.imovelValorCondominio || lead.imovelValorIPTU;

  if (!temDadosAgente && !temDadosWizard) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Home className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Sem dados do imóvel</p>
        <p className="text-xs text-slate-400 mt-1 text-center">
          O agente ainda não coletou informações sobre o imóvel.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">

      {/* ══ BLOCO 1: DADOS DO AGENTE (pré-contrato) ══ */}
      {temDadosAgente && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados coletados pelo Agente</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* Valor — destaque */}
          {lead.valorPretendido && (
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-4 text-white">
              <p className="text-xs font-medium text-emerald-200 mb-0.5">Valor pretendido</p>
              <p className="text-2xl font-bold">{lead.valorPretendido}</p>
              {lead.interesseEm && (
                <span className="mt-2 inline-block text-[11px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full capitalize">
                  {lead.interesseEm}
                </span>
              )}
            </div>
          )}

          {/* Endereço */}
          {(lead.enderecoImovel || lead.bairroImovel || lead.nomeEdificio) && (
            <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                {lead.enderecoImovel && <p className="text-sm font-semibold text-slate-800">{lead.enderecoImovel}</p>}
                {lead.bairroImovel && <p className="text-xs text-slate-500 mt-0.5">{lead.bairroImovel}</p>}
                {lead.nomeEdificio && <p className="text-xs text-indigo-600 font-medium mt-0.5">{lead.nomeEdificio}</p>}
              </div>
            </div>
          )}

          {/* Grid de características do agente */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icone: <Home className="w-3.5 h-3.5" />, label: 'Tipo', valor: lead.tipoImovel ? lead.tipoImovel.charAt(0).toUpperCase() + lead.tipoImovel.slice(1) : null },
              { icone: <Maximize2 className="w-3.5 h-3.5" />, label: 'Área', valor: lead.areaImovel },
              { icone: <DoorOpen className="w-3.5 h-3.5" />, label: 'Quartos', valor: lead.quartosImovel },
              { icone: <Car className="w-3.5 h-3.5" />, label: 'Vagas', valor: lead.vagasImovel },
              { icone: <Layers className="w-3.5 h-3.5" />, label: 'Ocupação', valor: lead.ocupacaoImovel },
              { icone: <BadgeCheck className="w-3.5 h-3.5" />, label: 'Conservação', valor: lead.estadoConservacao },
            ].filter((i) => i.valor !== null && i.valor !== undefined).map((item) => (
              <div key={item.label} className="bg-white rounded-xl p-3 border border-slate-200 flex items-center gap-2">
                <span className="text-slate-400">{item.icone}</span>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-800">{String(item.valor)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Situação financeira */}
          {(lead.situacaoFinanceira || lead.temDividas !== null || lead.valorVenal || lead.inscricaoIptu) && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Situação financeira</p>
              </div>
              <div className="p-3 grid grid-cols-2 gap-3">
                <Campo label="Situação" valor={lead.situacaoFinanceira} />
                <Campo label="Tem dívidas" valor={lead.temDividas} />
                <Campo label="Valor venal (IPTU)" valor={lead.valorVenal} />
                <Campo label="Inscrição IPTU" valor={lead.inscricaoIptu} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ BLOCO 2: IMÓVEIS IDENTIFICADOS (tabela Imovel — wizard de captação) ══ */}
      {lead.imoveisCaptacao?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-indigo-100" />
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
              📋 Imóveis Identificados ({lead.imoveisCaptacao.length})
            </span>
            <div className="h-px flex-1 bg-indigo-100" />
          </div>

          {lead.imoveisCaptacao.map((im, idx) => (
            <div key={im.id} className="rounded-xl border border-indigo-100 overflow-hidden">
              {/* Header do card */}
              <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Imóvel {idx + 1}{im.tipoImovel ? ` — ${im.tipoImovel}` : ''}
                </p>
                {im.statusCaptacao && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    im.statusCaptacao === 'CAPTADO' ? 'bg-emerald-100 text-emerald-700' :
                    im.statusCaptacao === 'DOCUMENTACAO' ? 'bg-amber-100 text-amber-700' :
                    'bg-indigo-100 text-indigo-600'
                  }`}>
                    {im.statusCaptacao}
                  </span>
                )}
              </div>

              <div className="p-3 space-y-3">
                {/* Endereço */}
                {(im.logradouro || im.bairro) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      {im.logradouro && (
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {im.logradouro}{im.numero ? `, ${im.numero}` : ''}
                          {im.complemento ? ` — ${im.complemento}` : ''}
                        </p>
                      )}
                      {im.apartamento && (
                        <p className="text-xs text-slate-500">
                          Apto {im.apartamento}{im.bloco ? ` · Bloco ${im.bloco}` : ''}
                        </p>
                      )}
                      {im.bairro && <p className="text-xs text-slate-500">{im.bairro}</p>}
                      {im.nomeEdificio && <p className="text-xs text-indigo-600 font-medium">{im.nomeEdificio}</p>}
                    </div>
                  </div>
                )}

                {/* Grid de métricas */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icone: <Maximize2 className="w-3 h-3" />, label: 'Área terreno', valor: im.areaTerreno ? `${im.areaTerreno} m²` : null },
                    { icone: <Maximize2 className="w-3 h-3" />, label: 'Área edificada', valor: im.areaEdificada ? `${im.areaEdificada} m²` : null },
                    { icone: <Layers className="w-3 h-3" />, label: 'Pavimentos', valor: im.numeroPavimentos },
                    { icone: <Car className="w-3 h-3" />, label: 'Vagas cobertas', valor: im.vagasCobertas },
                    { icone: <Car className="w-3 h-3" />, label: 'Vagas desc.', valor: im.vagasDescobertas },
                  ].filter(i => i.valor !== null && i.valor !== undefined).map(item => (
                    <div key={item.label} className="bg-slate-50 rounded-lg p-2 flex items-center gap-1.5">
                      <span className="text-slate-400">{item.icone}</span>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{item.label}</p>
                        <p className="text-xs font-semibold text-slate-800">{String(item.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inscrição IPTU */}
                {im.inscricaoIptu && (
                  <p className="text-[10px] text-slate-400">
                    IPTU: <span className="font-mono text-slate-600">{im.inscricaoIptu}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// ABA TIMELINE — Histórico real de atividades
// ══════════════════════════════════════════════════
const TIPO_ATIVIDADE_CFG: Record<string, { emoji: string; cor: string }> = {
  LIGACAO: { emoji: '📞', cor: 'bg-blue-100 text-blue-700' },
  EMAIL: { emoji: '✉️', cor: 'bg-violet-100 text-violet-700' },
  WHATSAPP: { emoji: '💬', cor: 'bg-emerald-100 text-emerald-700' },
  REUNIAO: { emoji: '🤝', cor: 'bg-amber-100 text-amber-700' },
  NOTA: { emoji: '📝', cor: 'bg-slate-100 text-slate-700' },
  TAREFA: { emoji: '✅', cor: 'bg-indigo-100 text-indigo-700' },
  AVALIACAO: { emoji: '🏠', cor: 'bg-orange-100 text-orange-700' },
  FOLLOW_UP: { emoji: '🔄', cor: 'bg-teal-100 text-teal-700' },
};

const STATUS_AGENDAMENTO_CFG: Record<string, { label: string; cor: string }> = {
  PENDENTE: { label: '⏳ Pendente', cor: 'text-amber-600' },
  CONFIRMADO: { label: '✅ Confirmado', cor: 'text-emerald-600' },
  CANCELADO: { label: '❌ Cancelado', cor: 'text-red-500' },
  REALIZADO: { label: '✓ Realizado', cor: 'text-slate-600' },
  NAO_COMPARECEU: { label: '👻 No-show', cor: 'text-red-400' },
};

function CardAtividade({
  atividade,
  destaque,
  loading,
  onCompletar,
  onCancelar,
  onReagendar,
}: {
  atividade: AtividadePriorizado;
  destaque?: boolean;
  loading?: boolean;
  onCompletar?: () => void;
  onCancelar?: () => void;
  onReagendar?: () => void;
}) {
  const cfg = TIPO_ATIVIDADE_CFG[atividade.tipo] || { emoji: '📌', cor: 'bg-slate-100 text-slate-700' };
  const statusCfg = atividade.statusAgendamento
    ? STATUS_AGENDAMENTO_CFG[atividade.statusAgendamento]
    : null;
  const concluida = !!atividade.completadoEm;

  return (
    <div className={`
      flex gap-3 p-3 rounded-xl border transition-all
      ${destaque && !concluida
        ? 'border-emerald-200 bg-emerald-50'
        : concluida
        ? 'border-slate-100 bg-slate-50 opacity-70'
        : 'border-slate-200 bg-white'
      }
    `}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${cfg.cor}`}>
        {cfg.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">{atividade.titulo}</p>
          {concluida && <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />}
        </div>
        {atividade.descricao && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{atividade.descricao}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {atividade.agendadoPara && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="w-3 h-3" />
              {new Date(atividade.agendadoPara).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
          {statusCfg && (
            <span className={`text-[11px] font-semibold ${statusCfg.cor}`}>
              {statusCfg.label}
            </span>
          )}
        </div>
        {atividade.completadoEm && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            Concluída: {new Date(atividade.completadoEm).toLocaleDateString('pt-BR')}
          </p>
        )}
        {!concluida && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button
              disabled={loading}
              onClick={onCompletar}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
            >
              Concluir
            </button>
            <button
              disabled={loading}
              onClick={onReagendar}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50"
            >
              Reagendar
            </button>
            <button
              disabled={loading}
              onClick={onCancelar}
              className="px-2 py-1 rounded-md text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AbaTimeline({
  leadId,
  leadNome,
  atividades,
  criandoAtividade,
  atividadeNova,
  atividadeAcaoId,
  onAtividadeNovaChange,
  onCriarAtividade,
  onAcionarAtividade,
}: {
  leadId: string;
  leadNome: string;
  atividades: AtividadePriorizado[];
  criandoAtividade: boolean;
  atividadeNova: {
    tipo: string;
    titulo: string;
    descricao: string;
    agendadoPara: string;
  };
  atividadeAcaoId: string | null;
  onAtividadeNovaChange: (v: { tipo: string; titulo: string; descricao: string; agendadoPara: string; }) => void;
  onCriarAtividade: () => Promise<void>;
  onAcionarAtividade: (atividadeId: string, acao: 'completar' | 'cancelar' | 'reagendar') => Promise<void>;
}) {
  const pendentes = atividades.filter((a) => !a.completadoEm);
  const concluidas = atividades.filter((a) => !!a.completadoEm);

  if (atividades.length === 0) {
    return (
      <div className="p-3 space-y-3">
        <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-2">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nova atividade — {leadNome}</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={atividadeNova.tipo}
              onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, tipo: e.target.value })}
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
              title="Tipo de atividade"
            >
              <option value="TAREFA">Tarefa</option>
              <option value="AVALIACAO">Avaliação</option>
              <option value="REUNIAO">Reunião</option>
              <option value="LIGACAO">Ligação</option>
              <option value="FOLLOW_UP">Follow-up</option>
            </select>
            <input
              value={atividadeNova.agendadoPara}
              onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, agendadoPara: e.target.value })}
              type="datetime-local"
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
            />
          </div>
          <input
            value={atividadeNova.titulo}
            onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, titulo: e.target.value })}
            placeholder="Título da atividade"
            className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs"
          />
          <textarea
            value={atividadeNova.descricao}
            onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, descricao: e.target.value })}
            placeholder="Descrição (opcional)"
            className="w-full min-h-[70px] rounded-lg border border-slate-200 px-2 py-2 text-xs"
          />
          <button
            onClick={onCriarAtividade}
            disabled={criandoAtividade}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
          >
            {criandoAtividade ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Criar atividade
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-10 px-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Activity className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Sem atividades registradas</p>
          <p className="text-xs text-slate-400 mt-1">
            Crie a primeira atividade direto por aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-2">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nova atividade — {leadNome}</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={atividadeNova.tipo}
            onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, tipo: e.target.value })}
            className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
            title="Tipo de atividade"
          >
            <option value="TAREFA">Tarefa</option>
            <option value="AVALIACAO">Avaliação</option>
            <option value="REUNIAO">Reunião</option>
            <option value="LIGACAO">Ligação</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
          <input
            value={atividadeNova.agendadoPara}
            onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, agendadoPara: e.target.value })}
            type="datetime-local"
            className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
          />
        </div>
        <input
          value={atividadeNova.titulo}
          onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, titulo: e.target.value })}
          placeholder="Título da atividade"
          className="w-full h-9 rounded-lg border border-slate-200 px-2 text-xs"
        />
        <textarea
          value={atividadeNova.descricao}
          onChange={(e) => onAtividadeNovaChange({ ...atividadeNova, descricao: e.target.value })}
          placeholder="Descrição (opcional)"
          className="w-full min-h-[70px] rounded-lg border border-slate-200 px-2 py-2 text-xs"
        />
        <button
          onClick={onCriarAtividade}
          disabled={criandoAtividade}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
        >
          {criandoAtividade ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Criar atividade
        </button>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Pendentes ({pendentes.length})
          </p>
          <div className="space-y-2">
            {pendentes.map((a, i) => (
              <CardAtividade
                key={a.id}
                atividade={a}
                destaque={i === 0}
                loading={atividadeAcaoId === a.id}
                onCompletar={() => onAcionarAtividade(a.id, 'completar')}
                onCancelar={() => onAcionarAtividade(a.id, 'cancelar')}
                onReagendar={() => onAcionarAtividade(a.id, 'reagendar')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Concluídas */}
      {concluidas.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Concluídas ({concluidas.length})
          </p>
          <div className="space-y-2">
            {concluidas.map((a) => (
              <CardAtividade key={a.id} atividade={a} />
            ))}
          </div>
        </div>
      )}

      {atividades.length === 5 && (
        <p className="text-center text-xs text-slate-400 pt-1">
          Mostrando as últimas 5 atividades •{' '}
          <button
            className="text-indigo-500 hover:underline font-medium"
            onClick={() => window.open(`/dashboard/proprietarios/${leadId}`, '_blank')}
          >
            Ver todas
          </button>
        </p>
      )}
    </div>
  );
}
