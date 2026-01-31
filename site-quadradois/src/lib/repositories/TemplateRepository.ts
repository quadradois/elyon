import { Template, TemplateCategory } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';

/**
 * Estrutura de cache com timestamp para TTL
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

/**
 * Repository para gerenciamento de Templates
 * Implementa cache em memória e error handling robusto
 */
class TemplateRepository {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly CACHE_TTL = 60 * 1000; // 60 segundos

    /**
     * Busca todos os templates disponíveis
     * Utiliza cache com TTL de 60 segundos
     */
    async getAll(): Promise<Template[]> {
        const cacheKey = 'all';
        const cached = this.cache.get(cacheKey);

        // Retorna do cache se ainda válido
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }

        try {
            const response = await fetch(`${API_BASE}/api/public/templates`, {
                next: { revalidate: 60 }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const templates = data.templates || data;

            // Atualiza cache
            this.cache.set(cacheKey, {
                data: templates,
                timestamp: Date.now()
            });

            return templates;
        } catch (error) {
            console.error('[TemplateRepository] Error fetching all templates:', error);

            // Retorna cache expirado se disponível (fallback)
            if (cached) {
                console.warn('[TemplateRepository] Returning stale cache due to fetch error');
                return cached.data;
            }

            throw error;
        }
    }

    /**
     * Busca um template específico por ID
     * @param id - ID único do template
     * @returns Template encontrado ou null se não existir
     */
    async getById(id: string): Promise<Template | null> {
        const cacheKey = `template:${id}`;
        const cached = this.cache.get(cacheKey);

        // Retorna do cache se ainda válido
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }

        try {
            const response = await fetch(`${API_BASE}/api/public/templates/${id}`);

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Failed to fetch template ${id}: ${response.status} ${response.statusText}`);
            }

            const template = await response.json();

            // Atualiza cache
            this.cache.set(cacheKey, {
                data: template,
                timestamp: Date.now()
            });

            return template;
        } catch (error) {
            console.error(`[TemplateRepository] Error fetching template ${id}:`, error);

            // Retorna cache expirado se disponível (fallback)
            if (cached) {
                console.warn(`[TemplateRepository] Returning stale cache for template ${id} due to fetch error`);
                return cached.data;
            }

            throw error;
        }
    }

    /**
     * Busca templates filtrados por categoria
     * @param category - Categoria do template (residencial, comercial, corretor, lancamentos)
     * @returns Array de templates da categoria especificada
     */
    async getByCategory(category: TemplateCategory): Promise<Template[]> {
        try {
            const all = await this.getAll();
            return all.filter(t => t.categoria === category);
        } catch (error) {
            console.error(`[TemplateRepository] Error fetching templates by category ${category}:`, error);
            throw error;
        }
    }

    /**
     * Limpa o cache manualmente
     * Útil para forçar atualização dos dados
     */
    clearCache(): void {
        this.cache.clear();
        console.info('[TemplateRepository] Cache cleared');
    }

    /**
     * Limpa uma entrada específica do cache
     * @param key - Chave do cache a ser limpa
     */
    clearCacheEntry(key: string): void {
        this.cache.delete(key);
        console.info(`[TemplateRepository] Cache entry '${key}' cleared`);
    }
}

/**
 * Singleton exportado do TemplateRepository
 * Utilize esta instância em toda a aplicação para compartilhar o cache
 */
export const templateRepository = new TemplateRepository();
