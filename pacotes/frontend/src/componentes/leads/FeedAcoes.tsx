/**
 * Feed de ações — Design Premium v2.0
 * Grupos claros, contagem visível, scroll suave.
 */

import { Loader2, Users, Inbox } from 'lucide-react';
import { CardLeadPriorizado } from './CardLeadPriorizado';
import { MiniPipeline } from './MiniPipeline';
import type { LeadPriorizado, PipelineResumo } from '../../ganchos/useLeadsPriorizados';

interface FeedAcoesProps {
  leads: LeadPriorizado[];
  pipeline: PipelineResumo;
  carregando: boolean;
  leadSelecionadoId: string | null;
  onSelecionarLead: (lead: LeadPriorizado) => void;
  onAbrirChat: (lead: LeadPriorizado) => void;
  fasePipeline: string | null;
  onFasePipelineChange: (fase: string | null) => void;
}

const STATUS_POR_FASE: Record<string, string[]> = {
  qualificacao: ['NOVO', 'QUALIFICADO'],
  apresentacao: ['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'CONTATANDO'],
  documentacao: ['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'EM_NEGOCIACAO'],
  onboarding: ['ONBOARDING'],
};

const GRUPOS = [
  {
    categoria: 'URGENTE' as const,
    titulo: 'Ação urgente',
    emoji: '🔴',
    descricao: 'Requerem atenção imediata',
    corFundo: 'bg-red-50/50',
    corBorda: 'border-red-200',
    corTitulo: 'text-red-700',
    corBadge: 'bg-red-100 text-red-700',
  },
  {
    categoria: 'ATENCAO' as const,
    titulo: 'Atenção',
    emoji: '🟡',
    descricao: 'Acompanhar em breve',
    corFundo: 'bg-amber-50/50',
    corBorda: 'border-amber-200',
    corTitulo: 'text-amber-700',
    corBadge: 'bg-amber-100 text-amber-700',
  },
  {
    categoria: 'IA_ATIVA' as const,
    titulo: 'IA trabalhando',
    emoji: '🤖',
    descricao: 'Sendo processados pela IA',
    corFundo: 'bg-indigo-50/50',
    corBorda: 'border-indigo-200',
    corTitulo: 'text-indigo-700',
    corBadge: 'bg-indigo-100 text-indigo-700',
  },
  {
    categoria: 'SEM_ACAO' as const,
    titulo: 'Em espera',
    emoji: '⚪',
    descricao: 'Sem ação pendente',
    corFundo: 'bg-slate-50/30',
    corBorda: 'border-slate-200',
    corTitulo: 'text-slate-600',
    corBadge: 'bg-slate-100 text-slate-600',
  },
];

interface GrupoLeadsProps {
  grupo: typeof GRUPOS[0];
  leads: LeadPriorizado[];
  leadSelecionadoId: string | null;
  onSelecionarLead: (lead: LeadPriorizado) => void;
  onAbrirChat: (lead: LeadPriorizado) => void;
}

function GrupoLeads({ grupo, leads, leadSelecionadoId, onSelecionarLead, onAbrirChat }: GrupoLeadsProps) {
  if (leads.length === 0) return null;
  return (
    <div className={`rounded-2xl border overflow-hidden ${grupo.corBorda}`}>
      {/* Header do grupo */}
      <div className={`flex items-center justify-between px-4 py-3 ${grupo.corFundo} border-b ${grupo.corBorda}`}>
        <div className="flex items-center gap-2.5">
          <span className="text-base">{grupo.emoji}</span>
          <div>
            <p className={`text-sm font-bold ${grupo.corTitulo}`}>{grupo.titulo}</p>
            <p className="text-[11px] text-slate-400">{grupo.descricao}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${grupo.corBadge}`}>
          {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
        </span>
      </div>
      {/* Cards do grupo */}
      <div className="divide-y divide-slate-100/70 bg-white">
        {leads.map((lead) => (
          <div key={lead.id} className="p-3">
            <CardLeadPriorizado
              lead={lead}
              selecionado={lead.id === leadSelecionadoId}
              onSelecionar={onSelecionarLead}
              onAbrirChat={onAbrirChat}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeedAcoes({
  leads,
  pipeline,
  carregando,
  leadSelecionadoId,
  onSelecionarLead,
  onAbrirChat,
  fasePipeline,
  onFasePipelineChange,
}: FeedAcoesProps) {
  const leadsFiltrados = fasePipeline
    ? leads.filter((lead) => STATUS_POR_FASE[fasePipeline]?.includes(lead.status))
    : leads;

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center h-72 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm text-slate-500 font-medium">Carregando leads...</p>
      </div>
    );
  }

  if (leadsFiltrados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 bg-white rounded-2xl border border-dashed border-slate-300">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Inbox className="w-7 h-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Nenhum lead encontrado</p>
        <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou adicione novos leads</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline compacto no topo */}
      <MiniPipeline
        pipeline={pipeline}
        faseSelecionada={fasePipeline}
        onSelecionarFase={onFasePipelineChange}
      />

      {/* Grupos de leads */}
      {GRUPOS.map((grupo) => (
        <GrupoLeads
          key={grupo.categoria}
          grupo={grupo}
          leads={leadsFiltrados.filter((l) => l.categoriaUrgencia === grupo.categoria)}
          leadSelecionadoId={leadSelecionadoId}
          onSelecionarLead={onSelecionarLead}
          onAbrirChat={onAbrirChat}
        />
      ))}
    </div>
  );
}
