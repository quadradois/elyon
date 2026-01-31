import SiteLayout from '@/components/layout/SiteLayout';
import Hero from '@/components/home/Hero';
import PropertyCard from '@/components/properties/PropertyCard';
import LaunchCard from '@/components/lancamentos/LaunchCard';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTenantLancamentos, getTenantProperties, getDomainFromHeaders, getTenantPage } from '@/lib/tenant';
import PageRenderer from '@/components/page-builder/PageRenderer';
import { ComponentItem } from '@/components/page-builder/types';
import { DEFAULT_SITE_CONFIG } from '@/lib/constants';
import { Property, Lancamento } from '@/lib/api';
import PreviewBanner from '@/components/PreviewBanner';
import { ResolvedSiteConfig } from '@/lib/types/customization';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';

// Forçar renderização dinâmica (SSR) para sempre buscar dados atualizados
export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function HomePage({ searchParams }: { searchParams: { preview?: string; draft?: string } }) {
    // Detectar modo preview/draft
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    // Buscar dados do tenant pelo domínio
    const domain = getDomainFromHeaders();

    // Busca configuração completa com fallback
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    // Tenta buscar página 'home' construída no editor (apenas se tiver tenant válido)
    const shouldFetchPage = config.tenant_id !== undefined && config.tenant_id !== null;

    console.log(`[HomePage] Domain: ${domain}, TenantID: ${config.tenant_id}, Fetching Page? ${shouldFetchPage}`);

    const pageData = shouldFetchPage
        ? await getTenantPage(domain, 'home')
        : null;

    console.log(`[HomePage] PageData received: ${!!pageData}`);

    // Se tiver página 'home' personalizada, renderiza ela dentro do SiteLayout
    if (pageData) {
        console.log('[HomePage] Rendering CUSTOM page builder content');
        const { page } = pageData;

        // Verifica se o primeiro componente é um Hero para deixar o header transparente
        const hasHero = page.components && page.components.length > 0 && page.components[0].type === 'hero';

        return (
            <>
                {isPreview && <PreviewBanner />}
                <SiteLayout config={config} transparentHeader={hasHero}>
                    <PageRenderer
                        components={page.components as ComponentItem[]}
                        tenantId={config.tenant_id}
                    />
                </SiteLayout>
            </>
        );
    }

    // Se não encontrar página personalizada, renderiza home padrão

    // Buscar dados adicionais (lançamentos, imóveis)
    const [lancamentosData, propertiesData] = await Promise.all([
        config.tenant_id ? getTenantLancamentos(config.tenant_id) : [],
        config.tenant_id ? getTenantProperties(domain, { limit: 6 }) : { items: [] },
    ]);

    const properties = propertiesData.items || [];
    const lancamentos = lancamentosData || [];

    // Helper para extrair config
    const getConfigValue = (section: string, field: string) => {
        if (config.customizacoes && config.customizacoes[section] && config.customizacoes[section][field]) {
            return config.customizacoes[section][field];
        }
        return null;
    };

    // Construir objeto compatível com SiteConfig a partir de resolvedConfig
    const heroConfig = {
        ...DEFAULT_SITE_CONFIG,
        hero_title: getConfigValue('hero', 'titulo') || DEFAULT_SITE_CONFIG.hero_title,
        hero_subtitle: getConfigValue('hero', 'subtitulo') || DEFAULT_SITE_CONFIG.hero_subtitle,
        hero_image_url: getConfigValue('hero', 'imagem_fundo') || DEFAULT_SITE_CONFIG.hero_image_url,
        hero_cta_text: getConfigValue('hero', 'texto_botao') || DEFAULT_SITE_CONFIG.hero_cta_text,
        hero_cta_link: getConfigValue('hero', 'link_botao') || DEFAULT_SITE_CONFIG.hero_cta_link,
    };

    return (
        <>
            {isPreview && <PreviewBanner />}
            <SiteLayout config={config}>
                {/* Hero Section */}
                {/* Hero Section */}
                <Hero config={heroConfig} branding={config.branding} />

                {/* Featured Properties Section */}
                {properties.length > 0 && (
                    <section className="py-16 md:py-24 bg-gray-50">
                        <div className="container-site">
                            <div className="flex items-end justify-between mb-10">
                                <div>
                                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                                        Imóveis em Destaque
                                    </h2>
                                    <p className="text-gray-600">
                                        Selecionados especialmente para você
                                    </p>
                                </div>
                                <Link
                                    href="/imoveis"
                                    className="hidden md:flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all"
                                    style={{ color: config.branding.primary_color }}
                                >
                                    Ver todos <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {properties.slice(0, 6).map((property: Property) => (
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

                            <div className="mt-8 text-center md:hidden">
                                <Link
                                    href="/imoveis"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white"
                                    style={{ backgroundColor: config.branding.primary_color }}
                                >
                                    Ver todos os imóveis <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    </section>
                )}

                {/* Launches Section */}
                {lancamentos.length > 0 && (
                    <section className="py-16 md:py-24">
                        <div className="container-site">
                            <div className="flex items-end justify-between mb-10">
                                <div>
                                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                                        Lançamentos
                                    </h2>
                                    <p className="text-gray-600">
                                        Conheça os novos empreendimentos
                                    </p>
                                </div>
                                <Link
                                    href="/lancamentos"
                                    className="hidden md:flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all"
                                    style={{ color: config.branding.primary_color }}
                                >
                                    Ver todos <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {lancamentos.slice(0, 3).map((launch: Lancamento) => (
                                    <LaunchCard
                                        key={launch.id}
                                        launch={launch}
                                        primaryColor={config.branding.primary_color}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* CTA Section */}
                <section
                    className="py-16 md:py-24"
                    style={{ backgroundColor: config.branding.primary_color }}
                >
                    <div className="container-site text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Não encontrou o que procura?
                        </h2>
                        <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
                            Entre em contato conosco e nossa equipe irá ajudá-lo a encontrar o imóvel ideal para você.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/contato"
                                className="px-8 py-4 bg-white rounded-lg font-semibold hover:shadow-lg transition-shadow"
                                style={{ color: config.branding.primary_color }}
                            >
                                Fale Conosco
                            </Link>
                            {config.branding.whatsapp && (
                                <a
                                    href={`https://wa.me/55${config.branding.whatsapp.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-8 py-4 bg-white/10 border-2 border-white/30 rounded-lg font-semibold text-white hover:bg-white/20 transition-colors"
                                >
                                    WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                </section>
            </SiteLayout>
        </>
    );
}
