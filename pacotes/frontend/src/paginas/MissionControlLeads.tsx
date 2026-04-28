/**
 * Mission Control de Leads — v2.0
 * Layout em 2 zonas com fundo premium e scroll correto.
 */

import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { Loader2, Users } from 'lucide-react';
import { PageHeader } from '../componentes/ui/page-header';
import { BarraComando, type ViewMode } from '../componentes/leads/BarraComando';
import { FeedAcoes } from '../componentes/leads/FeedAcoes';
import { PreviewLead } from '../componentes/leads/PreviewLead';
import { useLeadsPriorizados, type LeadPriorizado } from '../ganchos/useLeadsPriorizados';

const KanbanLeads = lazy(() =>
  import('../componentes/KanbanLeads').then((m) => ({ default: m.KanbanLeads }))
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

  const { leads, estatisticas, pipeline, carregando, erro, recarregar } = useLeadsPriorizados({
    temperatura: filtroTemperatura || undefined,
    busca: termoBusca || undefined,
  });

  const handleSelecionarLead = useCallback((lead: LeadPriorizado) => {
    setLeadSelecionado((prev) => (prev?.id === lead.id ? null : lead));
  }, []);

  const handleFecharPreview = useCallback(() => {
    setLeadSelecionado(null);
  }, []);

  useEffect(() => {
    if (!leadSelecionado) return;
    const atualizado = leads.find((l) => l.id === leadSelecionado.id) || null;
    if (!atualizado) {
      setLeadSelecionado(null);
      return;
    }
    if (atualizado !== leadSelecionado) {
      setLeadSelecionado(atualizado);
    }
  }, [leads, leadSelecionado]);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <div className="max-w-[1640px] mx-auto p-4 lg:p-5 space-y-4">
        <PageHeader
          title="Proprietários"
          description="Acompanhe e priorize os leads proprietários em um único painel."
          icon={<Users className="w-5 h-5" />}
        />

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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            {/* FEED (esquerda) — scroll isolado para não ser afetado pelo chat */}
            <div
              className={`transition-all duration-300 ease-out ${
                leadSelecionado ? 'xl:w-[40%]' : 'w-full max-w-3xl mx-auto'
              }`}
              style={{
                height: 'calc(100vh - 150px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
              }}
            >
              <FeedAcoes
                leads={leads}
                pipeline={pipeline}
                carregando={carregando}
                erro={erro}
                leadSelecionadoId={leadSelecionado?.id ?? null}
                onSelecionarLead={handleSelecionarLead}
                fasePipeline={fasePipeline}
                onFasePipelineChange={setFasePipeline}
              />
            </div>

            {/* PREVIEW (direita) — sticky + scroll isolado */}
            {leadSelecionado && (
              <div
                className="w-full xl:w-[60%] xl:flex-shrink-0 xl:sticky xl:top-5"
                style={{
                  height: 'calc(100vh - 150px)',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                }}
              >
                <PreviewLead
                  lead={leadSelecionado}
                  onFechar={handleFecharPreview}
                  onLeadAtualizado={recarregar}
                />
              </div>
            )}
          </div>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <KanbanLeads leads={leads as any} onLeadUpdate={recarregar} />
          </Suspense>
        )}

      </div>
    </div>
  );
}
