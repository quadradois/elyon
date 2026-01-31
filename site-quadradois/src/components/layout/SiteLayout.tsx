import Head from 'next/head';
import Header from './Header';
import Footer from './Footer';
import WhatsAppButton from './WhatsAppButton';
import FontLoader from './FontLoader';
import { ResolvedSiteConfig } from '@/lib/types/customization';
import { renderService } from '@/lib/services/RenderService';

interface SiteLayoutProps {
    config: ResolvedSiteConfig;
    children: React.ReactNode;
    transparentHeader?: boolean;
}

export default function SiteLayout({ config, children, transparentHeader = false }: SiteLayoutProps) {
    const cssVariables = renderService.generateCssVariables(config);
    const headingFont = config.branding.font_family_heading || 'Inter';
    const bodyFont = config.branding.font_family_body || 'Inter';

    return (
        <>
            <Head>
                <FontLoader heading={headingFont} body={bodyFont} />
            </Head>
            <div style={cssVariables}>
                <Header
                    branding={config.branding}
                    menu={config.menu}
                    transparent={transparentHeader}
                />
                <main>{children}</main>
                <Footer branding={config.branding} />
                {config.branding.whatsapp && (
                    <WhatsAppButton phone={config.branding.whatsapp} />
                )}
            </div>
        </>
    );
}
