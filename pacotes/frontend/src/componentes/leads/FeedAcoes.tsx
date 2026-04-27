/**
 * Feed de ações — Design Premium v2.0
 * Grupos claros, contagem visível, scroll suave.
 */

import { EstadoCarregandoLeads, EstadoErroLeads, EstadoVazioLeads } from './EstadoListaLeads';
import { CardLeadPriorizado } from './CardLeadPriorizado';
import { MiniPipeline } from './MiniPipeline';
import type { LeadPriorizado, PipelineResumo } from '../../ganchos/useLeadsPriorizados';

interface FeedAcoesProps {
  leads: LeadPriorizado[];
  pipeline: PipelineResumo;
  carregando: boolean;
  erro: string;
  leadSelecionadoId: string | null;
  onSelecionarLead: (lead: LeadPriorizado) => void;
  fasePipeline: string | null;
  onFasePipelineChange: (fase: string | null) => void;
}

const STATUS_POR_FASE: Record<string, string[]> = {
  qualificacao: ['NOVO'],
  apresentacao: ['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA'],
  documentacao: ['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO'],
  onboarding: ['ONBOARDING'],
};

const GRUPOS = [
  {
    categoria: 'URGENTE' as const,
    titulo: 'Ação urgente',
    emoji: '🔴',
    descricao: 'Requerem atenção imediata',
    corFundo: 'bg-red-50',
    corBorda: 'border-red-200',
    corTitulo: 'text-red-700',
    corBadge: 'bg-red-100 text-red-700',
  },
  {
    categoria: 'ATENCAO' as const,
    titulo: 'Atenção',
    emoji: '🟡',
    descricao: 'Acompanhar em breve',
    corFundo: 'bg-amber-50',
    corBorda: 'border-amber-200',
    corTitulo: 'text-amber-700',
    corBadge: 'bg-amber-100 text-amber-700',
  },
  {
    categoria: 'IA_ATIVA' as const,
    titulo: 'IA trabalhando',
    emoji: '🤖',
    descricao: 'Sendo processados pela IA',
    corFundo: 'bg-indigo-50',
    corBorda: 'border-indigo-200',
    corTitulo: 'text-indigo-700',
    corBadge: 'bg-indigo-100 text-indigo-700',
  },
  {
    categoria: 'SEM_ACAO' as const,
    titulo: 'Em espera',
    emoji: '⚪',
    descricao: 'Sem ação pendente',
    corFundo: 'bg-slate-50',
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
}

function GrupoLeads({ grupo, leads, leadSelecionadoId, onSelecionarLead }: GrupoLeadsProps) {
  if (leads.length === 0) return null;
  return (
    <div className={`rounded-xl border overflow-hidden ${grupo.corBorda}`}>
      {/* Header do grupo */}
      <div className={`flex items-center justify-between px-3 py-2 ${grupo.corFundo} border-b ${grupo.corBorda}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{grupo.emoji}</span>
          <div>
            <p className={`text-xs font-bold ${grupo.corTitulo}`}>{grupo.titulo}</p>
            <p className="text-[11px] text-slate-400">{grupo.descricao}</p>
          </div>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${grupo.corBadge}`}>
          {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
        </span>
      </div>
      {/* Cards do grupo */}
      <div className="divide-y divide-slate-100/70 bg-white">
        {leads.map((lead) => (
          <div key={lead.id} className="p-2">
            <CardLeadPriorizado
              lead={lead}
              selecionado={lead.id === leadSelecionadoId}
              onSelecionar={onSelecionarLead}
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
  erro,
  leadSelecionadoId,
  onSelecionarLead,
  fasePipeline,
  onFasePipelineChange,
}: FeedAcoesProps) {
  const leadsFiltrados = fasePipeline
    ? leads.filter((lead) => STATUS_POR_FASE[fasePipeline]?.includes(lead.status))
    : leads;

  if (carregando) {
    return <EstadoCarregandoLeads />;
  }

  if (erro) {
    return <EstadoErroLeads mensagem={erro} />;
  }

  if (leadsFiltrados.length === 0) {
    return <EstadoVazioLeads />;
  }

  return (
    <div className="space-y-3">
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
        />
      ))}
    </div>
  );
}
