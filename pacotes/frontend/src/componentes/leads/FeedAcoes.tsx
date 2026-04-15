/**
 * Feed de ações priorizadas — lista de cards agrupados por urgência.
 */

import { Loader2, Users } from 'lucide-react';
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
  // Filtrar por fase do pipeline se selecionada
  const leadsFiltrados = fasePipeline
    ? leads.filter((lead) => {
        if (fasePipeline === 'qualificacao') return ['NOVO', 'QUALIFICADO'].includes(lead.status);
        if (fasePipeline === 'apresentacao') return ['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'CONTATANDO'].includes(lead.status);
        if (fasePipeline === 'documentacao') return ['AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'EM_NEGOCIACAO'].includes(lead.status);
        if (fasePipeline === 'onboarding') return ['ONBOARDING'].includes(lead.status);
        return true;
      })
    : leads;

  // Agrupar por categoria
  const urgentes = leadsFiltrados.filter((l) => l.categoriaUrgencia === 'URGENTE');
  const atencao = leadsFiltrados.filter((l) => l.categoriaUrgencia === 'ATENCAO');
  const iaAtiva = leadsFiltrados.filter((l) => l.categoriaUrgencia === 'IA_ATIVA');
  const semAcao = leadsFiltrados.filter((l) => l.categoriaUrgencia === 'SEM_ACAO');

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (leadsFiltrados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Users className="w-12 h-12 mb-3 text-slate-300" />
        <p className="text-sm font-medium">Nenhum lead encontrado</p>
        <p className="text-xs mt-1">Ajuste os filtros ou adicione novos leads</p>
      </div>
    );
  }

  const renderGrupo = (titulo: string, grupo: LeadPriorizado[], emoji: string) => {
    if (grupo.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 pt-2">
          <span className="text-xs">{emoji}</span>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {titulo}
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
            {grupo.length}
          </span>
        </div>
        {grupo.map((lead) => (
          <CardLeadPriorizado
            key={lead.id}
            lead={lead}
            selecionado={lead.id === leadSelecionadoId}
            onSelecionar={onSelecionarLead}
            onAbrirChat={onAbrirChat}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
      {/* Feed agrupado */}
      <div className="space-y-4">
        {renderGrupo('Ação urgente', urgentes, '🔴')}
        {renderGrupo('Atenção', atencao, '🟡')}
        {renderGrupo('IA trabalhando', iaAtiva, '🟢')}
        {renderGrupo('Em espera', semAcao, '⚪')}
      </div>

      {/* Mini pipeline no footer */}
      <MiniPipeline
        pipeline={pipeline}
        faseSelecionada={fasePipeline}
        onSelecionarFase={onFasePipelineChange}
      />
    </div>
  );
}
