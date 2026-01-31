import SiteLayout from '@/components/layout/SiteLayout';
import LaunchHero from '@/components/lancamentos/LaunchHero';
import LaunchGallery from '@/components/lancamentos/LaunchGallery';
import TypologiesShowcase from '@/components/lancamentos/TypologiesShowcase';
import VirtualTourEmbed from '@/components/lancamentos/VirtualTourEmbed';
import LocationMap from '@/components/lancamentos/LocationMap';
import PriceSection from '@/components/lancamentos/PriceSection';
import StickyPriceBar from '@/components/lancamentos/StickyPriceBar';
import FloorPlanSelector from '@/components/lancamentos/FloorPlanSelector';
import AmenitiesGrid from '@/components/lancamentos/AmenitiesGrid';
import CTAReceiveBook from '@/components/lancamentos/CTAReceiveBook';
import FloatingWhatsApp from '@/components/lancamentos/FloatingWhatsApp';
import AboutSection from '@/components/lancamentos/AboutSection';
import { getTenantLancamento, getDomainFromHeaders } from '@/lib/tenant';
import { notFound } from 'next/navigation';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';
import type { Metadata, ResolvingMetadata } from 'next';

interface PageProps {
    params: { slug: string };
    searchParams: { preview?: string; draft?: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata(
    { params, searchParams }: PageProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });
    const launch = config.tenant_id ? await getTenantLancamento(config.tenant_id, params.slug) : null;

    if (!launch) {
        return { title: 'Lançamento não encontrado' };
    }

    const { branding } = config;

    // Get hero image for OG
    const heroImage = launch.imagem_capa || launch.galeria?.[0] || branding.logo_url;

    // Calculate min price for description
    const prices = launch.tipologias?.filter((t: any) => t.preco_de).map((t: any) => t.preco_de) || [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const priceText = minPrice
        ? `A partir de ${minPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}`
        : '';

    const description = launch.headline || launch.descricao?.slice(0, 160) || `${launch.nome} - ${priceText}`;

    return {
        title: `${launch.nome} | ${branding.company_name || 'Lançamento'}`,
        description,
        keywords: [launch.nome, launch.bairro, launch.cidade, 'apartamento', 'lançamento', 'imóvel'].filter(Boolean).join(', '),
        openGraph: {
            title: launch.nome,
            description,
            type: 'website',
            locale: 'pt_BR',
            images: heroImage ? [
                {
                    url: heroImage,
                    width: 1200,
                    height: 630,
                    alt: launch.nome,
                }
            ] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title: launch.nome,
            description,
            images: heroImage ? [heroImage] : [],
        },
    };
}


export default async function LancamentoDetailPage({ params, searchParams }: PageProps) {
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    const launch = config.tenant_id ? await getTenantLancamento(config.tenant_id, params.slug) : null;

    if (!launch) {
        notFound();
    }

    const { branding } = config;

    // Calculate min/max prices from tipologias
    const prices = launch.tipologias
        ?.filter((t: any) => t.preco_de)
        .map((t: any) => t.preco_de) || [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 1 ? Math.max(...prices) : undefined;

    // Prepare amenities from diferenciais
    const amenities = launch.diferenciais?.map((d: any) => ({
        nome: d.titulo,
        descricao: d.descricao,
        icone: d.icone,
    })) || [];

    return (
        <SiteLayout config={config}>
            <main>
                {/* 1. Hero Premium */}
                <LaunchHero
                    title={launch.nome}
                    subtitle={launch.headline || launch.subheadline}
                    image={launch.imagem_hero || launch.imagem_capa || ''}
                    video={launch.video_url}
                    status={launch.status}
                    primaryColor={branding.primary_color}
                    whatsapp={branding.whatsapp || undefined}
                    launchName={launch.nome}
                    unidadesDisponiveis={launch.stats?.disponiveis}
                />

                {/* 2. Sticky Price Bar (appears on scroll) */}
                {minPrice > 0 && (
                    <StickyPriceBar
                        price={minPrice}
                        launchName={launch.nome}
                        primaryColor={branding.primary_color}
                        whatsapp={branding.whatsapp || undefined}
                    />
                )}

                {/* 3. Breadcrumb + Info Section */}
                <section className="py-8 bg-gray-50 border-b border-gray-200">
                    <div className="container-site">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="space-y-1">
                                <p className="text-sm text-gray-500">
                                    {launch.cidade && launch.bairro && (
                                        <>{launch.cidade} • {launch.bairro}</>
                                    )}
                                </p>
                                <h1 className="text-2xl font-bold text-gray-900">{launch.nome}</h1>
                            </div>
                            {launch.previsao_entrega && (
                                <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-200">
                                    <span className="text-sm font-semibold text-gray-700">
                                        🏗️ Entrega: {launch.previsao_entrega}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 4. About Section with Video */}
                {launch.descricao && (
                    <AboutSection
                        description={launch.descricao}
                        videoUrl={launch.video_url}
                        launchName={launch.nome}
                        primaryColor={branding.primary_color}
                    />
                )}

                {/* 5. Floor Plan Selector */}
                {launch.tipologias && launch.tipologias.length > 0 && (
                    <FloorPlanSelector
                        tipologias={launch.tipologias}
                        primaryColor={branding.primary_color}
                        whatsapp={branding.whatsapp || undefined}
                        launchName={launch.nome}
                    />
                )}

                {/* 6. Price Section */}
                {minPrice > 0 && launch.tipologias && launch.tipologias.length > 0 && (
                    <PriceSection
                        minPrice={minPrice}
                        maxPrice={maxPrice}
                        tipologias={launch.tipologias}
                        primaryColor={branding.primary_color}
                        launchName={launch.nome}
                        whatsapp={branding.whatsapp || undefined}
                    />
                )}

                {/* 7. Gallery */}
                {launch.galeria && launch.galeria.length > 0 && (
                    <LaunchGallery
                        images={launch.galeria}
                        title="Galeria do Empreendimento"
                        subtitle="Conheça cada detalhe do projeto em imagens exclusivas"
                        primaryColor={branding.primary_color}
                    />
                )}

                {/* 8. CTA Receive Book */}
                <CTAReceiveBook
                    launchName={launch.nome}
                    logoUrl={launch.logo_empreendimento}
                    primaryColor={branding.primary_color}
                    whatsapp={branding.whatsapp || undefined}
                />

                {/* 9. Decorated Gallery */}
                {launch.galeria_decorado && launch.galeria_decorado.length > 0 && (
                    <LaunchGallery
                        images={launch.galeria_decorado}
                        title="Apartamento Decorado"
                        subtitle="Inspire-se com o acabamento premium e o design de interiores"
                        primaryColor={branding.primary_color}
                        variant="decorado"
                    />
                )}

                {/* 10. Tipologies Showcase (if needed for detail) */}
                {launch.tipologias && launch.tipologias.length > 0 && (
                    <TypologiesShowcase
                        tipologias={launch.tipologias}
                        primaryColor={branding.primary_color}
                        whatsapp={branding.whatsapp || undefined}
                        launchName={launch.nome}
                    />
                )}

                {/* 11. Video Section - Moved to AboutSection */}

                {/* 12. Amenities Grid */}
                {amenities.length > 0 && (
                    <AmenitiesGrid
                        amenities={amenities}
                        primaryColor={branding.primary_color}
                    />
                )}

                {/* 13. Virtual Tour */}
                <VirtualTourEmbed tourUrl={launch.tour_360_url} />

                {/* 14. Location Map */}
                {(
                    <LocationMap
                        address={launch.localizacao?.endereco || launch.localizacao?.logradouro || launch.endereco || ''}
                        city={launch.localizacao?.cidade || launch.cidade || ''}
                        neighborhood={launch.localizacao?.bairro || launch.bairro}
                        latitude={launch.localizacao?.latitude ?? launch.latitude ?? undefined}
                        longitude={launch.localizacao?.longitude ?? launch.longitude ?? undefined}
                        primaryColor={branding.primary_color}
                        nearbyPlaces={launch.localizacao?.pontos_interesse || []}
                    />
                )}

                {/* 15. Final CTA */}
                <section
                    className="py-20 text-white text-center"
                    style={{
                        background: `linear-gradient(135deg, ${branding.primary_color} 0%, ${branding.secondary_color || '#000'} 100%)`
                    }}
                >
                    <div className="container-site max-w-3xl">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Reserve sua visita exclusiva
                        </h2>
                        <p className="text-lg text-white/90 mb-4">
                            Agende um horário privativo com nosso especialista e conheça cada detalhe do {launch.nome}
                        </p>
                        <p className="text-sm text-white/70 mb-8">
                            ⏰ Resposta em até 5 minutos
                        </p>
                        {branding.whatsapp && (
                            <a
                                href={`https://wa.me/55${branding.whatsapp.replace(/\D/g, '')}?text=Olá! Tenho interesse no ${launch.nome}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-10 py-4 bg-white rounded-full font-bold text-lg shadow-2xl hover:shadow-3xl hover:scale-105 transition-all"
                                style={{ color: branding.primary_color }}
                            >
                                Falar no WhatsApp
                            </a>
                        )}
                    </div>
                </section>

                {/* Floating WhatsApp Button */}
                {branding.whatsapp && (
                    <FloatingWhatsApp
                        whatsapp={branding.whatsapp}
                        launchName={launch.nome}
                        primaryColor={branding.primary_color}
                    />
                )}
            </main>
        </SiteLayout>
    );
}
