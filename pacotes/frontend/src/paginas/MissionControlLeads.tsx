/**
 * Mission Control de Leads — Página principal.
 * Substitui a página antiga de lista/kanban por um centro de comando
 * com feed priorizado por IA, preview inline e chat integrado.
 */

import { useState, useCallback, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BarraComando, type ViewMode } from '../componentes/leads/BarraComando';
import { FeedAcoes } from '../componentes/leads/FeedAcoes';
import { PreviewLead } from '../componentes/leads/PreviewLead';
import { useLeadsPriorizados, type LeadPriorizado } from '../ganchos/useLeadsPriorizados';

// Lazy load dos componentes legados (Kanban/Lista)
const KanbanLeads = lazy(() =>
  import('../componentes/KanbanLeads').then((m) => ({ default: m.KanbanLeads }))
);
const LeadsLegadoLista = lazy(() =>
  import('./Leads').then((m) => ({ default: m.Leads }))
);

// Chat modal para expandir
const ChatModal = lazy(() =>
  import('../componentes/ChatModal').then((m) => ({ default: m.ChatModal }))
);

export function MissionControlLeads() {
  // States de UI
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTemperatura, setFiltroTemperatura] = useState('');
  const [leadSelecionado, setLeadSelecionado] = useState<LeadPriorizado | null>(null);
  const [fasePipeline, setFasePipeline] = useState<string | null>(null);
  const [chatExpandido, setChatExpandido] = useState(false);

  // Hook de dados priorizados
  const { leads, estatisticas, pipeline, carregando, recarregar } = useLeadsPriorizados({
    temperatura: filtroTemperatura || undefined,
    busca: termoBusca || undefined,
  });

  const handleSelecionarLead = useCallback((lead: LeadPriorizado) => {
    setLeadSelecionado(lead);
  }, []);

  const handleAbrirChat = useCallback((lead: LeadPriorizado) => {
    setLeadSelecionado(lead);
    setChatExpandido(true);
  }, []);

  const handleFecharPreview = useCallback(() => {
    setLeadSelecionado(null);
  }, []);

  return (
    <div className="p-6 space-y-6 h-full">
      {/* BARRA DE COMANDO */}
      <BarraComando
        estatisticas={estatisticas}
        termoBusca={termoBusca}
        onBuscaChange={setTermoBusca}
        filtroTemperatura={filtroTemperatura}
        onFiltroTemperaturaChange={setFiltroTemperatura}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        carregando={carregando}
        onRecarregar={recarregar}
        onLeadCriado={recarregar}
      />

      {/* CONTEÚDO PRINCIPAL */}
      {viewMode === 'feed' ? (
        <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 350px)' }}>
          {/* FEED (esquerda) */}
          <div className={`${leadSelecionado ? 'w-[58%]' : 'w-full'} transition-all duration-300`}>
            <FeedAcoes
              leads={leads}
              pipeline={pipeline}
              carregando={carregando}
              leadSelecionadoId={leadSelecionado?.id ?? null}
              onSelecionarLead={handleSelecionarLead}
              onAbrirChat={handleAbrirChat}
              fasePipeline={fasePipeline}
              onFasePipelineChange={setFasePipeline}
            />
          </div>

          {/* PREVIEW (direita) */}
          {leadSelecionado && (
            <div className="w-[42%] transition-all duration-300 animate-in slide-in-from-right-4">
              <div className="sticky top-6" style={{ height: 'calc(100vh - 350px)' }}>
                <PreviewLead
                  lead={leadSelecionado}
                  onFechar={handleFecharPreview}
                />
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <Suspense fallback={
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        }>
          <KanbanLeads leads={leads as any} onLeadUpdate={recarregar} />
        </Suspense>
      ) : (
        <Suspense fallback={
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        }>
          <LeadsLegadoLista />
        </Suspense>
      )}

      {/* CHAT EXPANDIDO (Modal) */}
      {leadSelecionado && (
        <Suspense fallback={null}>
          <ChatModal
            lead={{
              id: leadSelecionado.id,
              nome: leadSelecionado.nome || 'Lead',
              telefone: leadSelecionado.telefone,
            }}
            open={chatExpandido}
            onOpenChange={setChatExpandido}
          />
        </Suspense>
      )}
    </div>
  );
}
