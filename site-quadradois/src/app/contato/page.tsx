import { getDomainFromHeaders, getTenantPage } from '@/lib/tenant';
import { resolveConfigWithFallback } from '@/lib/utils/resolveConfigWithFallback';
import SiteLayout from '@/components/layout/SiteLayout';
import PreviewBanner from '@/components/PreviewBanner';
import PageRenderer from '@/components/page-builder/PageRenderer';
import { ComponentItem } from '@/components/page-builder/types';
import { notFound } from 'next/navigation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContatoPage({ searchParams }: { searchParams: { preview?: string; draft?: string } }) {
    // Detectar modo preview/draft
    const isPreview = searchParams.preview === 'true';
    const isDraft = searchParams.draft === 'true';

    const domain = getDomainFromHeaders();
    const config = await resolveConfigWithFallback(domain, { preview: isPreview, draft: isDraft });

    // Tenta buscar página 'contato' no CMS
    let pageData = null;
    if (config.tenant_id) {
        pageData = await getTenantPage(domain, 'contato');
        // Fallback para 'contact' se necessário (embora o slug padrão seja 'contato')
        if (!pageData) {
            pageData = await getTenantPage(domain, 'contact');
        }
    }

    if (!pageData || !pageData.page) {
        return notFound();
    }

    const hasHero =
        pageData.page.components?.[0]?.type === 'hero' ||
        pageData.page.components?.[0]?.type === 'hero_about';

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
