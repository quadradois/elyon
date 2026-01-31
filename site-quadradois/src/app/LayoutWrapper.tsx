import { getTenantConfig, getDomainFromHeaders } from '@/lib/tenant';
import TrackingScripts, { GTMNoScript } from '@/components/TrackingScripts';

export default async function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const domain = getDomainFromHeaders();
    const tenant = await getTenantConfig(domain);
    const config = tenant?.config;

    return (
        <>
            {config && (
                <TrackingScripts
                    googleAnalyticsId={config.google_analytics_id}
                    googleTagManagerId={config.google_tag_manager_id}
                    facebookPixelId={config.facebook_pixel_id}
                    tiktokPixelId={config.tiktok_pixel_id}
                    linkedinInsightTag={config.linkedin_insight_tag}
                    microsoftClarityId={config.microsoft_clarity_id}
                    hotjarId={config.hotjar_id}
                    googleSiteVerification={config.google_site_verification}
                    allowIndexing={config.allow_indexing}
                />
            )}
            {children}
            {config?.google_tag_manager_id && (
                <GTMNoScript googleTagManagerId={config.google_tag_manager_id} />
            )}
        </>
    );
}
