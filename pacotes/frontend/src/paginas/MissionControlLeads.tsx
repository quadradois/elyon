/**
 * Mission Control de Leads — v2.0
 * Layout em 2 zonas com fundo premium e scroll correto.
 */

import { useState, useCallback, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BarraComando, type ViewMode } from '../componentes/leads/BarraComando';
import { FeedAcoes } from '../componentes/leads/FeedAcoes';
import { PreviewLead } from '../componentes/leads/PreviewLead';
import { useLeadsPriorizados, type LeadPriorizado } from '../ganchos/useLeadsPriorizados';

const KanbanLeads = lazy(() =>
  import('../componentes/KanbanLeads').then((m) => ({ default: m.KanbanLeads }))
);
const LeadsLegadoLista = lazy(() =>
  import('./Leads').then((m) => ({ default: m.Leads }))
);
const ChatModal = lazy(() =>
  import('../componentes/ChatModal').then((m) => ({ default: m.ChatModal }))
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
    <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
  </div>
);

export function MissionControlLeads() {
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTemperatura, setFiltroTemperatura] = useState('');
  const [leadSelecionado, setLeadSelecionado] = useState<LeadPriorizado | null>(null);
  const [fasePipeline, setFasePipeline] = useState<string | null>(null);
  const [chatExpandido, setChatExpandido] = useState(false);

  const { leads, estatisticas, pipeline, carregando, recarregar } = useLeadsPriorizados({
    temperatura: filtroTemperatura || undefined,
    busca: termoBusca || undefined,
  });

  const handleSelecionarLead = useCallback((lead: LeadPriorizado) => {
    setLeadSelecionado((prev) => (prev?.id === lead.id ? null : lead));
  }, []);

  const handleAbrirChat = useCallback((lead: LeadPriorizado) => {
    setLeadSelecionado(lead);
    setChatExpandido(true);
  }, []);

  const handleFecharPreview = useCallback(() => {
    setLeadSelecionado(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* BARRA DE COMANDO */}
        <BarraComando
          estatisticas={estatisticas}
          termoBusca={termoBusca}
          onBuscaChange={setTermoBusca}
          filtroTemperatura={filtroTemperatura}
          onFiltroTemperaturaChange={setFiltroTemperatura}
          viewMode={viewMode}
          onViewModeChange={(modo) => {
            setViewMode(modo);
            if (modo !== 'feed') setLeadSelecionado(null);
          }}
          carregando={carregando}
          onRecarregar={recarregar}
          onLeadCriado={recarregar}
        />

        {/* CONTEÚDO PRINCIPAL */}
        {viewMode === 'feed' ? (
          <div className="flex gap-5 items-start">
            {/* FEED (esquerda) */}
            <div
              className={`transition-all duration-300 ease-out ${
                leadSelecionado ? 'w-[55%]' : 'w-full max-w-2xl mx-auto'
              }`}
            >
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
              <div
                className="w-[45%] flex-shrink-0 sticky top-6"
                style={{ height: 'calc(100vh - 200px)' }}
              >
                <PreviewLead
                  lead={leadSelecionado}
                  onFechar={handleFecharPreview}
                />
              </div>
            )}
          </div>
        ) : viewMode === 'kanban' ? (
          <Suspense fallback={<LoadingFallback />}>
            <KanbanLeads leads={leads as any} onLeadUpdate={recarregar} />
          </Suspense>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <LeadsLegadoLista />
          </Suspense>
        )}

        {/* CHAT EXPANDIDO */}
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
    </div>
  );
}
