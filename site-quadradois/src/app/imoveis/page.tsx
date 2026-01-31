import SiteLayout from '@/components/layout/SiteLayout';
import PropertyCard from '@/components/properties/PropertyCard';
import { getTenantProperties, getDomainFromHeaders, getTenantPage } from '@/lib/tenant';
import { Property } from '@/lib/api';
import PreviewBanner from '@/components/PreviewBanner';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';
import PropertyFilterBar from '@/components/page-builder/components/PropertyFilterBar';
import PageRenderer from '@/components/page-builder/PageRenderer';
import { ComponentItem } from '@/components/page-builder/types';

// Forçar renderização dinâmica
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImoveisPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    // Detectar modo preview/draft
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    // 1. Tentar buscar página customizada no Page Builder (slug: 'imoveis')
    const shouldFetchPage = config.tenant_id !== undefined && config.tenant_id !== null;
    let pageData = null;

    if (shouldFetchPage) {
        pageData = await getTenantPage(domain, 'imoveis');
    }

    // Se tiver página 'imoveis' personalizada, renderiza ela com o PageRenderer
    if (pageData && pageData.page && pageData.page.components && pageData.page.components.length > 0) {
        console.log('[ImoveisPage] Rendering CUSTOM page builder content for properties');

        // Verifica transparência do header se o primeiro componente for Hero
        const hasHero = pageData.page.components[0].type === 'hero';

        return (
            <>
                {isPreview && <PreviewBanner />}
                <SiteLayout config={config} transparentHeader={hasHero}>
                    <PageRenderer
                        components={pageData.page.components as ComponentItem[]}
                        tenantId={config.tenant_id}
                    />
                </SiteLayout>
            </>
        );
    }

    // --- FALLBACK (DEFAULT REDESIGN) ---
    // Se não houver configuração no CMS, renderiza o layout padrão "Liquid Glass"

    // Preparar filtros da URL para a API
    const filters: any = {
        limit: 12,
        purpose: searchParams.type || searchParams.finalidade,
        type: searchParams.property_type,
        neighborhood: searchParams.neighborhood,
        city: searchParams.city,
        bedrooms: searchParams.bedrooms,
        parking_spaces: searchParams.parking_spaces,
        max_price: searchParams.max_price
    };

    if (searchParams.page) filters.page = Number(searchParams.page);

    // Remove params internos
    delete filters.preview;
    delete filters.draft;

    const propertiesData = config.tenant_id ? await getTenantProperties(domain, filters) : { items: [], total: 0 };
    const properties = propertiesData.items || [];

    return (
        <>
            {isPreview && <PreviewBanner />}
            <SiteLayout config={config}>
                {/* Liquid Header */}
                <div className="relative h-[300px] md:h-[400px] bg-gray-900 flex items-center justify-center overflow-hidden">
                    {/* Background Image */}
                    <div className="absolute inset-0 z-0">
                        <img
                            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop"
                            alt="Background"
                            className="w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 text-center px-4 mt-8">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg tracking-tight">
                            Descubra seu novo lar
                        </h1>
                        <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto font-light">
                            Explore nossa seleção exclusiva de imóveis e encontre o lugar perfeito para viver seus melhores momentos.
                        </p>
                    </div>
                </div>

                {/* Main Content & Filters */}
                <main className="pb-12 md:pb-24 bg-gray-50 min-h-screen">
                    <div className="container-site relative z-20">
                        {/* Smart Filter Bar (Overlap) */}
                        <div className="-mt-8 md:-mt-10 mb-12">
                            <PropertyFilterBar />
                        </div>

                        {/* Results Count */}
                        <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-2">
                            <h2 className="text-xl font-semibold text-gray-800">
                                {propertiesData.total || properties.length} <span className="text-gray-500 font-normal">imóveis encontrados</span>
                            </h2>
                        </div>

                        {/* Property Grid */}
                        {properties.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                                {properties.map((property: Property) => (
                                    <PropertyCard
                                        key={property.id}
                                        property={{
                                            id: property.id,
                                            codigo: property.property_code ?? String(property.id),
                                            titulo: property.title ?? '',
                                            descricao: property.description ?? null,
                                            tipo: 'Imóvel',
                                            finalidade: property.sale_price ? 'Venda' : 'Aluguel',
                                            valor: property.sale_price ?? property.rent_price ?? null,
                                            area_total: property.area ?? null,
                                            quartos: property.bedrooms ?? null,
                                            banheiros: property.bathrooms ?? null,
                                            vagas: property.parking_spots ?? null,
                                            endereco: '',
                                            bairro: property.address_neighborhood ?? null,
                                            cidade: property.address_city ?? null,
                                            estado: '',
                                            imagem_principal: property.image_urls?.[0] ?? null,
                                            fotos: property.image_urls ?? [],
                                            destaque: false,
                                        }}
                                        primaryColor={config.branding.primary_color}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                <div className="text-6xl mb-4">🏠</div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum imóvel encontrado</h3>
                                <p className="text-gray-500 max-w-md mx-auto">
                                    Tente ajustar os filtros ou buscar por outra localização para encontrar o que você procura.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </SiteLayout>
        </>
    );
}
