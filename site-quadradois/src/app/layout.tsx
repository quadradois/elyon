import type { Metadata } from 'next'
import { Inter, Poppins, Montserrat } from 'next/font/google'
import './globals.css'
import LayoutWrapper from './LayoutWrapper'

// Fontes padrão - serão sobrescritas dinamicamente
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({
    weight: ['400', '500', '600', '700'],
    subsets: ['latin'],
    variable: '--font-poppins'
})
const montserrat = Montserrat({
    subsets: ['latin'],
    variable: '--font-montserrat'
})

import { getTenantConfig } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
    const tenant = await getTenantConfig()

    return {
        title: {
            default: tenant?.config.site_title || tenant?.branding.company_name || 'Site Imobiliário',
            template: `%s | ${tenant?.branding.company_name || 'Site Imobiliário'}`
        },
        description: tenant?.config.site_description || 'Encontre seu imóvel ideal',
        icons: {
            icon: tenant?.branding.favicon_url || '/favicon.ico',
            shortcut: tenant?.branding.favicon_url || '/favicon.ico',
            apple: tenant?.branding.favicon_url || '/apple-touch-icon.png',
        },
        openGraph: {
            title: tenant?.config.og_title || tenant?.config.site_title || 'Site Imobiliário',
            description: tenant?.config.og_description || tenant?.config.site_description || 'Encontre seu imóvel ideal',
            images: tenant?.config.og_image_url ? [tenant.config.og_image_url] : (tenant?.branding.logo_url ? [tenant.branding.logo_url] : []),
        }
    }
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR">
            <body className={`${inter.variable} ${poppins.variable} ${montserrat.variable} font-sans antialiased`}>
                <LayoutWrapper>
                    {children}
                </LayoutWrapper>
            </body>
        </html>
    )
}
