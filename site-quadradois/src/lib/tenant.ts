/**
 * Tenant Service
 * Resolve tenant pelo domínio e gerencia dados do site
 */

import { headers } from 'next/headers';
import { api, Branding } from './api';

export interface TenantConfig {
    tenant_id: number;
    branding: Branding;
    config: {
        template: string;
        hero_title: string | null;
        hero_subtitle: string | null;
        hero_image_url: string | null;
        hero_cta_text: string | null;
        hero_cta_link: string | null;
        // SEO
        site_title: string | null;
        site_description: string | null;
        og_title: string | null;
        og_description: string | null;
        og_image_url: string | null;
        // Tracking
        google_analytics_id: string | null;
        google_tag_manager_id: string | null;
        facebook_pixel_id: string | null;
        tiktok_pixel_id: string | null;
        linkedin_insight_tag: string | null;
        microsoft_clarity_id: string | null;
        hotjar_id: string | null;
        // Verification
        google_site_verification: string | null;
        bing_verification: string | null;
        facebook_domain_verification: string | null;
        // Indexação
        allow_indexing: boolean;
        // Feature flags
        show_pricing: boolean;
        show_map: boolean;
        show_whatsapp_button: boolean;
        show_contact_form: boolean;
    };
    menu: { label: string; href: string; order: number }[];
}

// Cache em memória
const tenantCache = new Map<string, { data: TenantConfig; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 segundos

/**
 * Extrai domínio do header Host
 */
export function getDomainFromHeaders(): string {
    const headersList = headers();
    const host = headersList.get('host') || 'localhost';

    // Remove porta se tiver
    const domain = host.split(':')[0];

    // Remove subdomínios de sistema (www, sites)
    const parts = domain.split('.');
    if (parts.length > 2 && ['www', 'sites'].includes(parts[0])) {
        return parts.slice(1).join('.');
    }

    return domain;
}

/**
 * Busca config do tenant - com cache
 */
export async function getTenantConfig(domain?: string): Promise<TenantConfig | null> {
    const resolvedDomain = domain || getDomainFromHeaders();

    // Verificar cache
    const cached = tenantCache.get(resolvedDomain);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;

        // Use internal URL if server-side, otherwise public
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const url = `${apiUrl}/api/public/site/${resolvedDomain}`;
        console.log(`[getTenantConfig] Fetching config for domain: ${resolvedDomain} from ${url}`);

        const response = await fetch(
            url,
            {
                headers: {
                    'Accept': 'application/json',
                },
                cache: 'no-store', // Disable caching completely
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) {
            console.error(`[getTenantConfig] Tenant não encontrado para domínio: ${resolvedDomain}, status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log(`[getTenantConfig] Received data for ${resolvedDomain}, TenantID: ${data.tenant_id}`);

        // Formatar dados
        const tenantConfig: TenantConfig = {
            tenant_id: data.tenant_id,
            branding: {
                logo_url: data.branding?.logo_url || null,
                logo_dark_url: data.branding?.logo_dark_url || null,
                favicon_url: data.branding?.favicon_url || null,
                primary_color: data.branding?.primary_color || '#0ea5e9',
                secondary_color: data.branding?.secondary_color || '#10b981',
                accent_color: data.branding?.accent_color || null,
                font_family_heading: data.branding?.font_family_heading || 'Inter',
                font_family_body: data.branding?.font_family_body || 'Inter',
                company_name: data.branding?.company_name || null,
                slogan: data.branding?.slogan || null,
                whatsapp: data.branding?.whatsapp || null,
                instagram: data.branding?.instagram || null,
                facebook: data.branding?.facebook || null,
                linkedin: data.branding?.linkedin || null,
                youtube: data.branding?.youtube || null,
                email: data.branding?.email || null,
                phone: data.branding?.phone || null,
                address: data.branding?.address || null,
            },
            config: {
                template: data.config?.template || 'modern',
                hero_title: data.config?.hero_title || null,
                hero_subtitle: data.config?.hero_subtitle || null,
                hero_image_url: data.config?.hero_image_url || null,
                hero_cta_text: data.config?.hero_cta_text || null,
                hero_cta_link: data.config?.hero_cta_link || null,
                // SEO
                site_title: data.config?.site_title || null,
                site_description: data.config?.site_description || null,
                og_title: data.config?.og_title || null,
                og_description: data.config?.og_description || null,
                og_image_url: data.config?.og_image_url || null,
                // Tracking
                google_analytics_id: data.config?.google_analytics_id || null,
                google_tag_manager_id: data.config?.google_tag_manager_id || null,
                facebook_pixel_id: data.config?.facebook_pixel_id || null,
                tiktok_pixel_id: data.config?.tiktok_pixel_id || null,
                linkedin_insight_tag: data.config?.linkedin_insight_tag || null,
                microsoft_clarity_id: data.config?.microsoft_clarity_id || null,
                hotjar_id: data.config?.hotjar_id || null,
                // Verification
                google_site_verification: data.config?.google_site_verification || null,
                bing_verification: data.config?.bing_verification || null,
                facebook_domain_verification: data.config?.facebook_domain_verification || null,
                // Indexação
                allow_indexing: data.config?.allow_indexing ?? true,
                // Feature flags
                show_pricing: data.config?.show_pricing ?? true,
                show_map: data.config?.show_map ?? true,
                show_whatsapp_button: data.config?.show_whatsapp_button ?? true,
                show_contact_form: data.config?.show_contact_form ?? true,
            },
            menu: data.menu || [],
        };

        // Salvar no cache
        tenantCache.set(resolvedDomain, {
            data: tenantConfig,
            timestamp: Date.now(),
        });

        return tenantConfig;
    } catch (error) {
        console.error('Erro ao buscar tenant:', error);
        return null;
    }
}

/**
 * Busca lançamentos do tenant
 */
export async function getTenantLancamentos(tenantId: number) {
    try {
        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const response = await fetch(
            `${apiUrl}/api/public/lancamentos`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-Tenant-ID': String(tenantId),
                },
                cache: 'no-store',
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) return [];

        const data = await response.json();
        return data.lancamentos || [];
    } catch (error) {
        console.error('Erro ao buscar lançamentos:', error);
        return [];
    }
}

/**
 * Busca lançamento específico por slug
 */
export async function getTenantLancamento(tenantId: number, slug: string) {
    try {
        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const response = await fetch(
            `${apiUrl}/api/public/lancamentos/${slug}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-Tenant-ID': String(tenantId),
                },
                cache: 'no-store',
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        return data.lancamento || null;
    } catch (error) {
        console.error('Erro ao buscar lançamento:', error);
        return null;
    }
}

/**
 * Busca imóvel específico por slug ou código
 */
export async function getTenantProperty(domain: string, slug: string) {
    try {
        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const response = await fetch(
            `${apiUrl}/api/public/site/${domain}/properties/${slug}`,
            {
                headers: { 'Accept': 'application/json' },
                cache: 'no-store',
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        return data.property || null; // API retorna { property: {}, ... }
    } catch (error) {
        console.error('Erro ao buscar imóvel:', error);
        return null;
    }
}

/**
 * Busca imóveis do tenant
 */
export interface PropertySearchParams {
    page?: number;
    limit?: number;
    type?: string;     // casa, apartamento
    purpose?: string;  // venda, aluguel
    highlight?: boolean;
    city?: string;
    neighborhood?: string;
    bedrooms?: string | number;
    parking_spaces?: string | number;
    max_price?: string | number;
}

export async function getTenantProperties(domain: string, params?: PropertySearchParams) {
    try {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));

        // Mapeamento correto de parâmetros
        if (params?.type) searchParams.set('type', params.type); // ex: apartamento
        if (params?.purpose) searchParams.set('finalidade', params.purpose); // ex: venda

        // Filtros avançados
        if (params?.highlight) searchParams.set('destaque', 'true');
        if (params?.city) searchParams.set('cidade', params.city);
        if (params?.neighborhood) searchParams.set('bairro', params.neighborhood);
        if (params?.bedrooms) searchParams.set('quartos', String(params.bedrooms));
        if (params?.parking_spaces) searchParams.set('vagas', String(params.parking_spaces));
        if (params?.max_price) searchParams.set('preco_max', String(params.max_price));

        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const response = await fetch(
            `${apiUrl}/api/public/site/${domain}/properties?${searchParams}`,
            {
                headers: { 'Accept': 'application/json' },
                cache: 'no-store',
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) return { items: [], total: 0, pages: 0 };

        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar imóveis:', error);
        return { items: [], total: 0, pages: 0 };
    }
}

/**
 * Envia formulário de contato
 */
export async function submitContact(data: {
    tenant_id: number;
    name: string;
    email: string;
    phone?: string;
    message?: string;
    property_id?: number;
}) {
    try {
        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const response = await fetch(
            `${apiUrl}/api/public/contact`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            }
        );

        return await response.json();
    } catch (error) {
        console.error('Erro ao enviar contato:', error);
        return { success: false, message: 'Erro ao enviar mensagem' };
    }
}

/**
 * Busca página dinâmica por slug
 */
export async function getTenantPage(domain: string, slug: string) {
    try {
        const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
        const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
        const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

        const url = `${apiUrl}/api/public/site/${domain}/page/${slug}`;
        console.log(`[getTenantPage] Fetching: ${url}`);

        const response = await fetch(
            url,
            {
                headers: { 'Accept': 'application/json' },
                cache: 'no-store',
                next: { revalidate: 0 },
            }
        );

        console.log(`[getTenantPage] Status: ${response.status}`);
        if (!response.ok) {
            console.error(`[getTenantPage] Failed with status ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log(`[getTenantPage] Page title: ${data.page?.title}`);
        return data;
    } catch (error) {
        console.error('Erro ao buscar página:', error);
        return null;
    }
}
