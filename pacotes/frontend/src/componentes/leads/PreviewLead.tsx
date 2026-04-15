/**
 * Preview inline do lead — Design Premium v2.0
 * Painel lateral com informação hierarquizada e visual forte.
 * Corrige bug valor "R$ NaN".
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Phone,
  Mail,
  ExternalLink,
  Home,
  Bot,
  Calendar,
  MessageSquare,
  Activity,
  Copy,
  Check,
  Flame,
  Zap,
  Snowflake,
  AlertCircle,
} from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import type { LeadPriorizado } from '../../ganchos/useLeadsPriorizados';
import { toast } from 'sonner';

type AbaPreview = 'resumo' | 'chat' | 'imovel';

interface PreviewLeadProps {
  lead: LeadPriorizado;
  onFechar: () => void;
}

function getStatusConfig(status: string) {
  const mapa: Record<string, { label: string; cor: string }> = {
    NOVO: { label: 'Novo', cor: 'bg-indigo-100 text-indigo-700' },
    QUALIFICADO: { label: 'Qualificado', cor: 'bg-indigo-100 text-indigo-700' },
    TENTATIVA_AGENDAMENTO: { label: 'Tentando Agendar', cor: 'bg-amber-100 text-amber-700' },
    VISITA_AGENDADA: { label: 'Visita Agendada', cor: 'bg-amber-100 text-amber-700' },
    CONTATANDO: { label: 'Contatando', cor: 'bg-amber-100 text-amber-700' },
    AVALIACAO_EM_ANDAMENTO: { label: 'Avaliação', cor: 'bg-violet-100 text-violet-700' },
    DOCUMENTACAO: { label: 'Documentação', cor: 'bg-violet-100 text-violet-700' },
    EM_NEGOCIACAO: { label: 'Negociação', cor: 'bg-violet-100 text-violet-700' },
    ONBOARDING: { label: 'Onboarding', cor: 'bg-emerald-100 text-emerald-700' },
    CAPTADO: { label: 'Captado ✓', cor: 'bg-emerald-100 text-emerald-700' },
    PERDIDO: { label: 'Perdido', cor: 'bg-red-100 text-red-700' },
    ARQUIVADO: { label: 'Arquivado', cor: 'bg-slate-100 text-slate-600' },
  };
  return mapa[status] || { label: status, cor: 'bg-slate-100 text-slate-600' };
}

function TemperaturaIcon({ temp }: { temp: string | null }) {
  if (temp === 'QUENTE') return <Flame className="w-4 h-4 text-red-500" />;
  if (temp === 'MORNO') return <Zap className="w-4 h-4 text-amber-500" />;
  return <Snowflake className="w-4 h-4 text-blue-400" />;
}

function formatarValor(val: number | string | null | undefined): string {
  if (!val) return '—';
  if (typeof val === 'string') {
    // Já formatado (ex: "R$ 650.000" ou "entre 600-700k")
    return val.trim() || '—';
  }
  if (isNaN(val)) return '—';
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
}

function formatarData(data: string | null | undefined): string {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function PreviewLead({ lead, onFechar }: PreviewLeadProps) {
  const navigate = useNavigate();
  const [aba, setAba] = useState<AbaPreview>('resumo');
  const [copiado, setCopiado] = useState(false);
  const statusCfg = getStatusConfig(lead.status);

  const copiarTelefone = () => {
    if (lead.telefone) {
      navigator.clipboard.writeText(lead.telefone);
      setCopiado(true);
      toast.success('Telefone copiado!');
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">

      {/* ══ HEADER ══ */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        {/* Nome + fechar */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900 leading-tight truncate">
              {lead.nome || 'Sem nome'}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full ${statusCfg.cor}`}>
                {statusCfg.label}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <TemperaturaIcon temp={lead.temperatura} />
                {lead.temperatura === 'QUENTE' ? 'Quente' : lead.temperatura === 'MORNO' ? 'Morno' : 'Frio'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir
            </button>
            <button
              onClick={onFechar}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors ml-1"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Contatos */}
        <div className="flex flex-col gap-1.5">
          {lead.telefone && (
            <button
              onClick={copiarTelefone}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 group w-fit"
            >
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium">{lead.telefone}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                {copiado
                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <Copy className="w-3.5 h-3.5 text-slate-400" />
                }
              </span>
            </button>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ SCORE DE URGÊNCIA ══ */}
      <div className="mx-5 mt-4 mb-2">
        <div className={`
          flex items-center gap-4 p-3 rounded-2xl border
          ${lead.urgencia >= 50
            ? 'bg-red-50 border-red-200'
            : lead.urgencia >= 25
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'
          }
        `}>
          {/* Score */}
          <div className={`
            w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 font-bold
            ${lead.urgencia >= 50 ? 'bg-red-500 text-white' : lead.urgencia >= 25 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-white'}
          `}>
            <span className="text-lg leading-none">{lead.urgencia}</span>
            <span className="text-[9px] leading-none opacity-80">pts</span>
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-bold mb-0.5 ${lead.urgencia >= 50 ? 'text-red-700' : lead.urgencia >= 25 ? 'text-amber-700' : 'text-slate-600'}`}>
              {lead.urgencia >= 50 ? '🚨 Urgência alta' : lead.urgencia >= 25 ? '⚠️ Atenção necessária' : '✓ Em acompanhamento'}
            </p>
            <p className="text-xs text-slate-500 truncate">{lead.motivoUrgencia}</p>
          </div>
        </div>
      </div>

      {/* ══ TABS ══ */}
      <div className="flex border-b border-slate-100 mx-2 mt-2">
        {[
          { id: 'resumo' as const, label: 'Resumo IA', icone: Bot },
          { id: 'chat' as const, label: 'Chat', icone: MessageSquare },
          { id: 'imovel' as const, label: 'Imóvel', icone: Home },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all
              ${aba === tab.id
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
              }
            `}
          >
            <tab.icone className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ CONTEÚDO DAS ABAS ══ */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {aba === 'resumo' && <AbaResumo lead={lead} />}
        {aba === 'chat' && (
          <div className="h-full" style={{ minHeight: '300px' }}>
            <ChatPanel
              leadId={lead.id}
              leadNome={lead.nome || 'Lead'}
              leadTelefone={lead.telefone}
            />
          </div>
        )}
        {aba === 'imovel' && <AbaImovel lead={lead} formatarValor={formatarValor} formatarData={formatarData} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ABA RESUMO
// ══════════════════════════════════════
function AbaResumo({ lead }: { lead: LeadPriorizado }) {
  return (
    <div className="p-5 space-y-4">
      {/* Resumo IA */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Resumo IA</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{lead.resumoIA}</p>
        {lead.ultimaAcaoIA && (
          <div className="mt-2 pt-2 border-t border-indigo-100">
            <p className="text-[11px] text-indigo-500 font-medium">
              Última ação: {lead.ultimaAcaoIA}
            </p>
          </div>
        )}
      </div>

      {/* Dores identificadas */}
      {lead.doresIdentificadas.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Dores identificadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lead.doresIdentificadas.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200 font-medium"
              >
                <AlertCircle className="w-3 h-3 text-amber-500" />
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Objeções */}
      {lead.objecoes.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Objeções
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lead.objecoes.map((o, i) => (
              <span key={i} className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-200 font-medium">
                {o}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Próxima atividade */}
      {lead.proximaAtividade && (
        <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-800">Próxima atividade</p>
            <p className="text-sm text-emerald-900 font-medium mt-0.5">{lead.proximaAtividade.titulo}</p>
            {lead.proximaAtividade.agendadoPara && (
              <p className="text-xs text-emerald-600 mt-0.5">
                {new Date(lead.proximaAtividade.agendadoPara).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Histórico mínimo */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          {lead.totalMensagens} mensagens trocadas
        </span>
        <span>
          Lead criado {new Date(lead.criadoEm).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// ABA IMÓVEL
// ══════════════════════════════════════
function AbaImovel({
  lead,
  formatarValor,
}: {
  lead: LeadPriorizado;
  formatarValor: (v: number | string | null | undefined) => string;
  formatarData: (d: string | null | undefined) => string;
}) {
  const temDados = lead.enderecoImovel || lead.tipoImovel || lead.valorPretendido || lead.interesseEm;

  if (!temDados) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Home className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Sem dados do imóvel</p>
        <p className="text-xs text-slate-400 mt-1 text-center">
          O agente ainda não coletou informações sobre o imóvel nesta conversa.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Valor pretendido — destaque principal */}
      {lead.valorPretendido && (
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-4 text-white shadow-md shadow-emerald-200">
          <p className="text-xs font-medium text-emerald-200 mb-1">Valor pretendido</p>
          <p className="text-2xl font-bold">{formatarValor(lead.valorPretendido)}</p>
        </div>
      )}

      {/* Grid de dados */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Tipo de interesse', valor: lead.interesseEm },
          { label: 'Tipo de imóvel', valor: lead.tipoImovel ? lead.tipoImovel.charAt(0).toUpperCase() + lead.tipoImovel.slice(1) : null },
        ].filter((i) => i.valor).map((item) => (
          <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{item.label}</p>
            <p className="text-sm font-semibold text-slate-800">{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Endereço */}
      {lead.enderecoImovel && (
        <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
          <Home className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Endereço</p>
            <p className="text-sm text-slate-800">{lead.enderecoImovel}</p>
          </div>
        </div>
      )}
    </div>
  );
}
