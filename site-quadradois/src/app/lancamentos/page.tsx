import SiteLayout from '@/components/layout/SiteLayout';
import LaunchCard from '@/components/lancamentos/LaunchCard';
import { getTenantLancamentos, getDomainFromHeaders } from '@/lib/tenant';
import { Lancamento } from '@/lib/api';
import PreviewBanner from '@/components/PreviewBanner';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';

export default async function LancamentosPage({ searchParams }: { searchParams: { preview?: string; draft?: string } }) {
    // Detectar modo preview/draft
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    const lancamentos = config.tenant_id ? await getTenantLancamentos(config.tenant_id) : [];

    return (
        <>
            {isPreview && <PreviewBanner />}
            <SiteLayout config={config}>
                <main className="py-12 md:py-16 bg-gray-50 min-h-screen">
                    <div className="container-site">
                        {/* Page Header */}
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                                Lançamentos
                            </h1>
                            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                                Conheça os melhores empreendimentos em lançamento e pré-lançamento da região
                            </p>
                        </div>

                        {/* Launches Grid */}
                        {lancamentos.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {lancamentos.map((launch: Lancamento) => (
                                    <LaunchCard
                                        key={launch.id}
                                        launch={launch}
                                        primaryColor={config.branding.primary_color}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-gray-500 text-lg">
                                    Nenhum lançamento disponível no momento.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </SiteLayout>
        </>
    );
}
