/**
 * RenderService - Core do sistema de renderização dinâmica
 * 
 * Responsável por:
 * - Resolver configuração final (merge template + customizações)
 * - Suportar modo preview/draft
 * - Gerar CSS variables para theming dinâmico
 * - Gerenciar fontes do Google Fonts
 */

import { Template, TenantCustomizacao, ResolvedSiteConfig } from '../types';
import { templateRepository } from '../repositories/TemplateRepository';
import { getTenantConfig, TenantConfig } from '../tenant';
import { Branding } from '../api';
import { FALLBACK_BRANDING } from '../constants';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';

/**
 * Interface para opções de resolução de configuração
 */
export interface ResolveConfigOptions {
    /** Habilita modo preview (visualização sem afetar site publicado) */
    preview?: boolean;
    /** Usa rascunho ao invés da versão publicada */
    draft?: boolean;
    /** Token JWT para autenticação (necessário para draft) */
    token?: string;
    /** Domínio opcional para resolver tenant */
    domain?: string;
}

/**
 * Cache de customizações por tenant
 */
interface CustomizationCacheEntry {
    data: TenantCustomizacao;
    timestamp: number;
}

class RenderService {
    private customizationCache: Map<string, CustomizationCacheEntry> = new Map();
    private readonly CACHE_TTL = 60 * 1000; // 60 segundos

    /**
     * Resolve a configuração completa do site
     * 
     * Fluxo:
     * 1. Buscar TenantConfig atual (via domínio ou tenantId)
     * 2. Buscar TenantCustomizacao (via API ou cache)
     * 3. Buscar Template base
     * 4. Fazer merge: template defaults + customizações
     * 5. Retornar ResolvedSiteConfig
     * 
     * @param tenantId - ID do tenant
     * @param options - Opções de preview/draft
     * @returns Configuração resolvida ou null se não encontrada
     */
    async resolveConfig(
        tenantId: number,
        options?: ResolveConfigOptions
    ): Promise<ResolvedSiteConfig | null> {
        const { preview = false, draft = false, token, domain } = options || {};

        try {
            // 1. Buscar TenantConfig atual
            const tenantConfig = await getTenantConfig(domain);
            if (!tenantConfig || tenantConfig.tenant_id !== tenantId) {
                console.error(`[RenderService] Tenant ${tenantId} não encontrado`);
                return null;
            }

            // 2. Buscar TenantCustomizacao
            const customization = await this.fetchCustomization(tenantId, { draft, token });

            // 3. Buscar Template base (opcional - sistema funciona sem template)
            const templateSlug = customization?.template_id || tenantConfig.config.template;
            let template = templateSlug ? await templateRepository.getById(templateSlug) : null;

            // Se não encontrar template, criar um objeto padrão para não quebrar
            if (!template) {
                console.warn(`[RenderService] Template ${templateSlug || 'nenhum'} não encontrado, usando apenas branding`);
                template = {
                    id: 'default',
                    nome: 'Default',
                    slug: 'default',
                    categoria: 'residencial',
                    versao: '1.0.0',
                    preview_url: '',
                    thumbnail_url: '',
                    descricao: 'Template padrão do sistema',
                    customizacao_schema: {},
                    layout_estrutura: {
                        paginas: ['home'],
                        componentes_disponiveis: ['hero', 'property_grid', 'contact_form'],
                    },
                    configuracoes_padrao: {},
                };
            }

            // 4. Determinar customizações ativas (rascunho ou publicado)
            const activeCustomizations = draft && customization?.rascunho
                ? customization.rascunho
                : customization?.customizacoes || {};

            // 5. Fazer merge: template defaults + customizações + branding do tenant
            const mergedBranding = this.mergeBranding(
                template.configuracoes_padrao?.branding || {},
                this.extractBrandingFromCustomizations(activeCustomizations),
                tenantConfig.branding
            );

            // 6. Retornar ResolvedSiteConfig
            return {
                tenant_id: tenantId,
                template,
                customizacoes: this.deepMerge(
                    template.configuracoes_padrao || {},
                    activeCustomizations
                ),
                branding: mergedBranding,
                is_preview: preview,
                is_draft: draft,
                menu: tenantConfig.menu || [],
            };
        } catch (error) {
            console.error('[RenderService] Erro ao resolver config:', error);
            return null;
        }
    }


    /**
     * Resolve configuração a partir do domínio
     * Atalho conveniente para uso em páginas
     * 
     * @param domain - Domínio do site
     * @param options - Opções de preview/draft
     */
    async resolveConfigByDomain(
        domain: string,
        options?: Omit<ResolveConfigOptions, 'domain'>
    ): Promise<ResolvedSiteConfig | null> {
        const tenantConfig = await getTenantConfig(domain);
        if (!tenantConfig) return null;

        return this.resolveConfig(tenantConfig.tenant_id, { ...options, domain });
    }

    /**
     * Busca customizações do tenant via API
     * Implementa cache com TTL
     */
    private async fetchCustomization(
        tenantId: number,
        options: { draft?: boolean; token?: string }
    ): Promise<TenantCustomizacao | null> {
        const { draft, token } = options;
        const cacheKey = `tenant:${tenantId}:${draft ? 'draft' : 'published'}`;

        // Verificar cache (apenas para versão publicada)
        if (!draft) {
            const cached = this.customizationCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.data;
            }
        }

        try {
            // Para draft, precisa de autenticação
            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const publicApiUrl = API_BASE;
            const internalApiUrl = process.env.INTERNAL_API_URL || publicApiUrl;
            const apiUrl = typeof window === 'undefined' ? internalApiUrl : publicApiUrl;

            const response = await fetch(
                `${apiUrl}/api/public/site/customization/${tenantId}`,
                {
                    headers,
                    cache: draft ? 'no-store' : 'default',
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Erro ao buscar customizações: ${response.status}`);
            }

            const data = await response.json();
            const customization = data.customization || data;

            // Salvar no cache (apenas versão publicada)
            if (!draft) {
                this.customizationCache.set(cacheKey, {
                    data: customization,
                    timestamp: Date.now(),
                });
            }

            return customization;
        } catch (error) {
            console.error('[RenderService] Erro ao buscar customizações:', error);
            return null;
        }
    }

    /**
     * Extrai campos de branding das customizações
     * As customizações podem ter uma seção 'branding' com as configurações visuais
     */
    private extractBrandingFromCustomizations(
        customizacoes: Record<string, Record<string, string | null>>
    ): Record<string, string | null> {
        // Branding pode vir na seção 'branding' ou 'design'
        return {
            ...customizacoes.branding,
            ...customizacoes.design,
        };
    }

    /**
     * Faz merge de branding seguindo prioridade:
     * custom (customizações do tenant) > template (defaults do template) > fallback
     * 
     * @param templateDefaults - Valores padrão do template
     * @param customBranding - Customizações do tenant
     * @param fallback - Valores fallback (normalmente FALLBACK_BRANDING)
     * @returns Branding completo e resolvido
     */
    mergeBranding(
        templateDefaults: Partial<Branding>,
        customBranding: Record<string, string | null>,
        fallback: Branding = FALLBACK_BRANDING
    ): Branding {
        return {
            // Logos
            logo_url: customBranding.logo_url ?? templateDefaults.logo_url ?? fallback.logo_url,
            logo_dark_url: customBranding.logo_dark_url ?? templateDefaults.logo_dark_url ?? fallback.logo_dark_url,
            favicon_url: customBranding.favicon_url ?? templateDefaults.favicon_url ?? fallback.favicon_url,

            // Cores
            primary_color: customBranding.primary_color ?? templateDefaults.primary_color ?? fallback.primary_color,
            secondary_color: customBranding.secondary_color ?? templateDefaults.secondary_color ?? fallback.secondary_color,
            accent_color: customBranding.accent_color ?? templateDefaults.accent_color ?? fallback.accent_color,

            // Fontes
            font_family_heading: customBranding.font_family_heading ?? templateDefaults.font_family_heading ?? fallback.font_family_heading,
            font_family_body: customBranding.font_family_body ?? templateDefaults.font_family_body ?? fallback.font_family_body,

            // Dados da empresa
            company_name: customBranding.company_name ?? templateDefaults.company_name ?? fallback.company_name,
            slogan: customBranding.slogan ?? templateDefaults.slogan ?? fallback.slogan,

            // Contato
            whatsapp: customBranding.whatsapp ?? templateDefaults.whatsapp ?? fallback.whatsapp,
            email: customBranding.email ?? templateDefaults.email ?? fallback.email,
            phone: customBranding.phone ?? templateDefaults.phone ?? fallback.phone,
            address: customBranding.address ?? templateDefaults.address ?? fallback.address,

            // Redes sociais
            instagram: customBranding.instagram ?? templateDefaults.instagram ?? fallback.instagram,
            facebook: customBranding.facebook ?? templateDefaults.facebook ?? fallback.facebook,
            linkedin: customBranding.linkedin ?? templateDefaults.linkedin ?? fallback.linkedin,
            youtube: customBranding.youtube ?? templateDefaults.youtube ?? fallback.youtube,
        };
    }

    /**
     * Gera CSS variables a partir da configuração resolvida
     * Usado para aplicar theming dinâmico nos componentes
     * 
     * @param config - Configuração resolvida do site
     * @returns Objeto de estilos CSS com custom properties
     */
    generateCssVariables(config: ResolvedSiteConfig): React.CSSProperties {
        const { branding } = config;

        return {
            // Cores principais
            '--color-primary': branding.primary_color,
            '--color-secondary': branding.secondary_color,
            '--color-accent': branding.accent_color || branding.primary_color,

            // Variantes de cores (derivadas)
            '--color-primary-light': this.lightenColor(branding.primary_color, 20),
            '--color-primary-dark': this.darkenColor(branding.primary_color, 20),
            '--color-secondary-light': this.lightenColor(branding.secondary_color, 20),
            '--color-secondary-dark': this.darkenColor(branding.secondary_color, 20),

            // Fontes (com fallback sans-serif)
            '--font-heading': `'${branding.font_family_heading || 'Inter'}', sans-serif`,
            '--font-body': `'${branding.font_family_body || 'Inter'}', sans-serif`,

            // Outras variáveis úteis
            '--color-text': '#1f2937',
            '--color-text-muted': '#6b7280',
            '--color-background': '#ffffff',
            '--color-surface': '#f9fafb',
            '--color-border': '#e5e7eb',
        } as React.CSSProperties;
    }

    /**
     * Gera URL do Google Fonts para as fontes configuradas
     * Remove duplicatas e formata corretamente os parâmetros
     * 
     * @param heading - Nome da fonte para títulos
     * @param body - Nome da fonte para corpo
     * @returns URL do Google Fonts
     */
    generateFontUrl(heading: string, body: string): string {
        const fonts = Array.from(new Set([heading, body].filter(Boolean)));

        if (fonts.length === 0) {
            return 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        }

        const params = fonts
            .map(font => `family=${font.replace(/\s+/g, '+')}:wght@400;500;600;700`)
            .join('&');

        return `https://fonts.googleapis.com/css2?${params}&display=swap`;
    }

    /**
     * Gera URL do Google Fonts a partir da configuração
     * Atalho conveniente que extrai fontes do branding
     */
    generateFontUrlFromConfig(config: ResolvedSiteConfig): string {
        return this.generateFontUrl(
            config.branding.font_family_heading || 'Inter',
            config.branding.font_family_body || 'Inter'
        );
    }

    /**
     * Limpa o cache de customizações
     * Útil após atualização de customizações
     */
    clearCache(tenantId?: number): void {
        if (tenantId) {
            this.customizationCache.delete(`tenant:${tenantId}:published`);
            this.customizationCache.delete(`tenant:${tenantId}:draft`);
            console.info(`[RenderService] Cache do tenant ${tenantId} limpo`);
        } else {
            this.customizationCache.clear();
            console.info('[RenderService] Cache completo limpo');
        }
    }

    // ========== Utilitários privados ==========

    /**
     * Deep merge de objetos
     * Mescla recursivamente, priorizando valores do segundo objeto
     */
    private deepMerge<T extends Record<string, any>>(
        base: T,
        override: Partial<T>
    ): T {
        const result = { ...base } as T;

        for (const key in override) {
            if (Object.prototype.hasOwnProperty.call(override, key)) {
                const baseVal = base[key];
                const overrideVal = override[key];

                if (
                    overrideVal !== null &&
                    overrideVal !== undefined &&
                    typeof overrideVal === 'object' &&
                    !Array.isArray(overrideVal) &&
                    typeof baseVal === 'object' &&
                    !Array.isArray(baseVal)
                ) {
                    result[key] = this.deepMerge(baseVal, overrideVal);
                } else if (overrideVal !== null && overrideVal !== undefined) {
                    result[key] = overrideVal as T[Extract<keyof T, string>];
                }
            }
        }

        return result;
    }

    /**
     * Clareia uma cor hex
     * @param color - Cor em formato hex (#RRGGBB)
     * @param percent - Porcentagem de clareamento (0-100)
     */
    private lightenColor(color: string, percent: number): string {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
        const B = Math.min(255, (num & 0x0000ff) + amt);

        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }

    /**
     * Escurece uma cor hex
     * @param color - Cor em formato hex (#RRGGBB)
     * @param percent - Porcentagem de escurecimento (0-100)
     */
    private darkenColor(color: string, percent: number): string {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
        const B = Math.max(0, (num & 0x0000ff) - amt);

        return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
    }
}

/**
 * Instância singleton do RenderService
 * Use: import { renderService } from '@/lib/services/RenderService'
 */
export const renderService = new RenderService();
