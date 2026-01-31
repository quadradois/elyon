import { ResolvedSiteConfig } from '@/lib/types/customization';
import { renderService } from '@/lib/services/RenderService';
import { FALLBACK_BRANDING } from '@/lib/constants';
import { Template } from '@/lib/types/template';

interface ResolveOptions {
    preview?: boolean;
    draft?: boolean;
}

/**
 * Resolve a configuração do site pelo domínio, com fallback seguro
 * Garante que sempre retornará uma configuração válida para o SiteLayout,
 * mesmo que seja o fallback padrão (para ambientes de dev/localhost)
 */
export async function resolveConfigWithFallback(
    domain: string,
    options: ResolveOptions = {}
): Promise<ResolvedSiteConfig> {
    const { preview = false, draft = false } = options;

    try {
        // Tenta buscar configuração completa via RenderService
        const config = await renderService.resolveConfigByDomain(domain, { preview, draft });

        if (config) {
            return config;
        }
    } catch (error) {
        console.error('Erro ao resolver config:', error);
    }

    // Fallback: Mock de template e config
    const mockTemplate: Template = {
        id: 'fallback',
        nome: 'Fallback',
        slug: 'modern',
        categoria: 'residencial',
        versao: '1.0.0',
        preview_url: '',
        thumbnail_url: '',
        descricao: 'Template padrão',
        customizacao_schema: {},
        layout_estrutura: { paginas: [], componentes_disponiveis: [] },
        configuracoes_padrao: {}
    };

    return {
        tenant_id: 0,
        template: mockTemplate,
        customizacoes: {},
        branding: FALLBACK_BRANDING,
        is_preview: preview,
        is_draft: draft,
        menu: [
            { label: 'Início', href: '/', order: 0 },
            { label: 'Imóveis', href: '/imoveis', order: 1 },
            { label: 'Lançamentos', href: '/lancamentos', order: 2 },
            { label: 'Sobre', href: '/sobre', order: 3 },
            { label: 'Contato', href: '/contato', order: 4 },
        ]
    };
}
