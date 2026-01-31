/**
 * About Page (Hybrid Strategy)
 * Tenta carregar do CMS (slug 'sobre'). Se não existir, renderiza layout Premium Default.
 */
import SiteLayout from '@/components/layout/SiteLayout';
import { getTenantPage, getDomainFromHeaders } from '@/lib/tenant';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';
import PreviewBanner from '@/components/PreviewBanner';
import PageRenderer from '@/components/page-builder/PageRenderer';
import { ComponentItem } from '@/components/page-builder/types';
import TeamGrid from '@/components/page-builder/components/TeamGrid';
import Features from '@/components/page-builder/components/Features';
import Stats from '@/components/page-builder/components/Stats';
import Hero from '@/components/page-builder/components/Hero';
import TextBlock from '@/components/page-builder/components/TextBlock';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AboutPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';
    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    // 1. CMS CHECK
    // Tenta buscar página 'sobre' ou 'quem-somos' no CMS
    let pageData = null;
    if (config.tenant_id) {
        pageData = await getTenantPage(domain, 'sobre');
        if (!pageData) {
            pageData = await getTenantPage(domain, 'quem-somos');
        }
    }

    // Se houver config no CMS, usa ela
    if (pageData && pageData.page) {
        console.log('[AboutPage] Rendering CMS content');
        const hasHero = pageData.page.components?.[0]?.type === 'hero';
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

    // 2. FALLBACK PREMIUM DESIGN (Composed via Page Builder Components)
    // Este é o TEMPLATE PADRÃO DO SISTEMA. 
    // Qualquer tenant que não tiver uma página 'sobre' configurada verá este layout com suas cores/infos.
    const companyName = config.branding.company_name || 'Nossa Imobiliária';

    return (
        <>
            {isPreview && <PreviewBanner />}
            <SiteLayout config={config} transparentHeader={true}>
                <div className="flex flex-col w-full">
                    {/* Hero Institucional */}
                    <Hero
                        title={`A história da ${companyName}`}
                        subtitle="Conectando pessoas a lares extraordinários com transparência, tecnologia e atendimento humanizado."
                        background_image="https://images.unsplash.com/photo-1497366216548-37526070297c?bold=true&fit=crop&q=80"
                        height="medium"
                        alignment="center"
                        show_search={false}
                        overlay_opacity={60}
                        cta_text=""
                    />

                    {/* Stats - Autoridade */}
                    <div className="-mt-20 relative z-20">
                        <Stats
                            items={[
                                { label: 'Anos de Mercado', value: '10', suffix: '+' },
                                { label: 'Imóveis Vendidos', value: '5', suffix: 'k+' },
                                { label: 'Clientes Satisfeitos', value: '98', suffix: '%' },
                                { label: 'Atendimento', value: '24', suffix: 'h' }
                            ]}
                            background_color="bg-transparent"
                        />
                    </div>

                    {/* História - TextBlock */}
                    <TextBlock
                        title={`Mais que uma imobiliária, somos a ${companyName}.`}
                        content={`
                            <p class="text-xl text-gray-600 leading-relaxed mb-6">
                                Nossa jornada começou com uma missão simples: descomplicar o mercado imobiliário. Acreditamos que comprar ou alugar um imóvel não deve ser um processo estressante, mas sim o início de um novo capítulo emocionante.
                            </p>
                            <p class="text-lg text-gray-500 leading-relaxed">
                                Com uma equipe de especialistas apaixonados e tecnologia de ponta, oferecemos uma curadoria de imóveis que atendem aos mais altos padrões de qualidade e design.
                            </p>
                        `}
                        alignment="center"
                        padding_y="large"
                        background_color="#f9fafb" // gray-50
                    />

                    {/* Diferenciais */}
                    <Features
                        title="Por que nos escolher?"
                        subtitle="Diferenciais que tornam sua experiência única"
                    />

                    {/* Time */}
                    <TeamGrid
                        title="Conheça nossos Experts"
                        subtitle="Profissionais dedicados a encontrar o melhor negócio para você"
                    />

                    {/* CTA Final */}
                    <Hero
                        title="Pronto para começar?"
                        subtitle="Agende uma visita hoje mesmo ou converse com um de nossos consultores online."
                        height="small"
                        background_image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80"
                        overlay_opacity={85}
                        cta_text="Falar com Consultor"
                        cta_link="/contato"
                        show_search={false}
                    />
                </div>
            </SiteLayout>
        </>
    );
}
