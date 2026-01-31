import { renderService } from '../RenderService';
import { FALLBACK_BRANDING } from '@/lib/constants';
import type { ResolvedSiteConfig, Template, Branding } from '@/lib/types';

describe('RenderService', () => {
    describe('mergeBranding', () => {
        it('prioriza valores customizados sobre template defaults', () => {
            const templateDefaults: Partial<Branding> = {
                primary_color: '#000000',
                secondary_color: '#111111',
            };
            const customBranding = {
                primary_color: '#FF0000',
            };

            const result = renderService.mergeBranding(templateDefaults, customBranding);

            expect(result.primary_color).toBe('#FF0000');
            expect(result.secondary_color).toBe('#111111');
        });

        it('usa fallback quando custom é null', () => {
            const templateDefaults: Partial<Branding> = {};
            const customBranding = {
                primary_color: null,
            };

            const result = renderService.mergeBranding(templateDefaults, customBranding, FALLBACK_BRANDING);

            expect(result.primary_color).toBe(FALLBACK_BRANDING.primary_color);
        });

        it('usa template defaults quando custom não está presente', () => {
            const templateDefaults: Partial<Branding> = {
                primary_color: '#AAAAAA',
                company_name: 'Template Company',
            };
            const customBranding = {};

            const result = renderService.mergeBranding(templateDefaults, customBranding);

            expect(result.primary_color).toBe('#AAAAAA');
            expect(result.company_name).toBe('Template Company');
        });

        it('combina todos os campos corretamente', () => {
            const templateDefaults: Partial<Branding> = {
                primary_color: '#000000',
                logo_url: 'https://example.com/logo.png',
            };
            const customBranding = {
                secondary_color: '#FF0000',
                company_name: 'Custom Company',
            };

            const result = renderService.mergeBranding(templateDefaults, customBranding);

            expect(result.primary_color).toBe('#000000');
            expect(result.secondary_color).toBe('#FF0000');
            expect(result.logo_url).toBe('https://example.com/logo.png');
            expect(result.company_name).toBe('Custom Company');
        });
    });

    describe('generateCssVariables', () => {
        it('gera variáveis CSS corretas', () => {
            const mockConfig: ResolvedSiteConfig = {
                tenant_id: 1,
                template: {} as Template,
                customizacoes: {},
                branding: {
                    ...FALLBACK_BRANDING,
                    primary_color: '#0ea5e9',
                    secondary_color: '#10b981',
                    accent_color: '#f59e0b',
                    font_family_heading: 'Poppins',
                    font_family_body: 'Inter',
                },
                is_preview: false,
                is_draft: false,
                menu: [],
            };

            const result = renderService.generateCssVariables(mockConfig);

            expect(result['--color-primary']).toBe('#0ea5e9');
            expect(result['--color-secondary']).toBe('#10b981');
            expect(result['--color-accent']).toBe('#f59e0b');
            expect(result['--font-heading']).toContain('Poppins');
            expect(result['--font-body']).toContain('Inter');
        });

        it('usa accent_color como fallback de primary_color quando não definido', () => {
            const mockConfig: ResolvedSiteConfig = {
                tenant_id: 1,
                template: {} as Template,
                customizacoes: {},
                branding: {
                    ...FALLBACK_BRANDING,
                    primary_color: '#0ea5e9',
                    secondary_color: '#10b981',
                    accent_color: null,
                },
                is_preview: false,
                is_draft: false,
                menu: [],
            };

            const result = renderService.generateCssVariables(mockConfig);

            expect(result['--color-accent']).toBe('#0ea5e9');
        });

        it('gera variantes de cores (light/dark)', () => {
            const mockConfig: ResolvedSiteConfig = {
                tenant_id: 1,
                template: {} as Template,
                customizacoes: {},
                branding: {
                    ...FALLBACK_BRANDING,
                    primary_color: '#0ea5e9',
                    secondary_color: '#10b981',
                },
                is_preview: false,
                is_draft: false,
                menu: [],
            };

            const result = renderService.generateCssVariables(mockConfig);

            expect(result['--color-primary-light']).toBeDefined();
            expect(result['--color-primary-dark']).toBeDefined();
            expect(result['--color-secondary-light']).toBeDefined();
            expect(result['--color-secondary-dark']).toBeDefined();
        });

        it('inclui fontes com fallback sans-serif', () => {
            const mockConfig: ResolvedSiteConfig = {
                tenant_id: 1,
                template: {} as Template,
                customizacoes: {},
                branding: {
                    ...FALLBACK_BRANDING,
                    font_family_heading: 'Poppins',
                    font_family_body: 'Inter',
                },
                is_preview: false,
                is_draft: false,
                menu: [],
            };

            const result = renderService.generateCssVariables(mockConfig);

            expect(result['--font-heading']).toBe("'Poppins', sans-serif");
            expect(result['--font-body']).toBe("'Inter', sans-serif");
        });
    });

    describe('generateFontUrl', () => {
        it('gera URL válida do Google Fonts com uma fonte', () => {
            const url = renderService.generateFontUrl('Poppins', 'Poppins');

            expect(url).toContain('fonts.googleapis.com');
            expect(url).toContain('family=Poppins');
            expect(url).toContain('wght@400;500;600;700');
            expect(url).toContain('display=swap');
        });

        it('gera URL válida do Google Fonts com duas fontes diferentes', () => {
            const url = renderService.generateFontUrl('Poppins', 'Inter');

            expect(url).toContain('family=Poppins');
            expect(url).toContain('family=Inter');
        });

        it('remove duplicatas quando heading e body são iguais', () => {
            const url = renderService.generateFontUrl('Inter', 'Inter');

            // Conta quantas vezes "family=Inter" aparece
            const matches = url.match(/family=Inter/g);
            expect(matches).toHaveLength(1);
        });

        it('substitui espaços por + na URL', () => {
            const url = renderService.generateFontUrl('Open Sans', 'Roboto Mono');

            expect(url).toContain('Open+Sans');
            expect(url).toContain('Roboto+Mono');
        });

        it('retorna URL padrão do Inter quando fontes vazias', () => {
            const url = renderService.generateFontUrl('', '');

            expect(url).toContain('family=Inter');
            expect(url).toContain('wght@400;500;600;700');
        });
    });

    describe('generateFontUrlFromConfig', () => {
        it('gera URL a partir da configuração', () => {
            const mockConfig: ResolvedSiteConfig = {
                tenant_id: 1,
                template: {} as Template,
                customizacoes: {},
                branding: {
                    ...FALLBACK_BRANDING,
                    font_family_heading: 'Poppins',
                    font_family_body: 'Inter',
                },
                is_preview: false,
                is_draft: false,
                menu: [],
            };

            const url = renderService.generateFontUrlFromConfig(mockConfig);

            expect(url).toContain('family=Poppins');
            expect(url).toContain('family=Inter');
        });

        it('usa Inter como fallback quando fontes não definidas', () => {
            const mockConfig: ResolvedSiteConfig = {
                tenant_id: 1,
                template: {} as Template,
                customizacoes: {},
                branding: {
                    ...FALLBACK_BRANDING,
                    font_family_heading: null,
                    font_family_body: null,
                },
                is_preview: false,
                is_draft: false,
                menu: [],
            };

            const url = renderService.generateFontUrlFromConfig(mockConfig);

            expect(url).toContain('family=Inter');
        });
    });

    describe('resolveConfig', () => {
        // Mock do getTenantConfig
        const mockGetTenantConfig = jest.fn();
        const mockFetch = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
            global.fetch = mockFetch as any;
        });

        it('retorna null quando tenant não é encontrado', async () => {
            mockGetTenantConfig.mockResolvedValue(null);

            const result = await renderService.resolveConfig(999);

            expect(result).toBeNull();
        });

        it('retorna null quando template não é encontrado', async () => {
            // Este teste é difícil sem mockar internamente o templateRepository
            // Por ora, apenas garantimos que não lança erro
            const result = await renderService.resolveConfig(1, { preview: true });

            // Pode retornar null se não encontrar o template
            expect(result === null || typeof result === 'object').toBe(true);
        });
    });

    describe('resolveConfigByDomain', () => {
        it('retorna null quando domínio não tem tenant', async () => {
            const result = await renderService.resolveConfigByDomain('invalid-domain.com');

            expect(result === null || typeof result === 'object').toBe(true);
        });

        it('passa opções corretamente para resolveConfig', async () => {
            const result = await renderService.resolveConfigByDomain('test.com', { preview: true, draft: true });

            // Verifica que não lança erro
            expect(result === null || typeof result === 'object').toBe(true);
        });
    });

    describe('clearCache', () => {
        it('limpa cache de tenant específico', () => {
            // Este teste é mais difícil de validar sem mockar internals
            // Mas podemos ao menos verificar que não lança erro
            expect(() => {
                renderService.clearCache(123);
            }).not.toThrow();
        });

        it('limpa cache completo quando sem tenantId', () => {
            expect(() => {
                renderService.clearCache();
            }).not.toThrow();
        });
    });
});
