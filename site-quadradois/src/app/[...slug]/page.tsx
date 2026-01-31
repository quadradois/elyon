/**
 * Dynamic Page Route
 * Rota para renderizar páginas criadas no Page Editor
 */
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTenantConfig, getTenantPage, getDomainFromHeaders } from '@/lib/tenant';
import PageRenderer from '@/components/page-builder/PageRenderer';
import { ComponentItem } from '@/components/page-builder/types';
import PreviewBanner from '@/components/PreviewBanner';
import SiteLayout from '@/components/layout/SiteLayout';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';

interface PageProps {
    params: {
        slug: string[];
    };
    searchParams: {
        preview?: string;
        draft?: string;
    };
}

// Gerar metadados dinâmicos
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const domain = getDomainFromHeaders();
    const slug = params.slug.join('/');
    const pageData = await getTenantPage(domain, slug);
    const tenant = await getTenantConfig(domain);

    if (!pageData) {
        return {
            title: 'Página não encontrada',
        };
    }

    const { page } = pageData;
    const siteTitle = tenant?.config.site_title || 'Site Imobiliário';

    return {
        title: `${page.title} | ${siteTitle}`,
        description: page.seo_description || tenant?.config.site_description,
        openGraph: {
            title: page.seo_title || page.title,
            description: page.seo_description || undefined,
            images: page.seo_image ? [page.seo_image] : undefined,
        },
    };
}

export default async function DynamicPage({ params, searchParams }: PageProps) {
    // Detectar modo preview/draft
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const slug = params.slug.join('/');

    // Resolver config
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    // Buscar página
    const pageData = config.tenant_id ? await getTenantPage(domain, slug) : null;

    if (!pageData) {
        notFound();
    }

    const { page } = pageData;

    return (
        <>
            {isPreview && <PreviewBanner />}
            <SiteLayout config={config}>
                <main className="min-h-screen">
                    <PageRenderer
                        components={page.components as ComponentItem[]}
                        tenantId={config.tenant_id}
                    />
                </main>
            </SiteLayout>
        </>
    );
}
