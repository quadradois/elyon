import { TenantCustomizacao } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';

/**
 * Repository para gerenciar customizações de templates por tenant
 * 
 * Responsabilidades:
 * - Buscar customizações do tenant autenticado
 * - Atualizar customizações publicadas
 * - Gerenciar rascunhos (salvar/publicar)
 * - Autenticação via Bearer token
 */
class CustomizationRepository {
    /**
     * Busca as customizações do tenant autenticado
     * 
     * @param token - Token JWT do tenant
     * @returns Customizações do tenant ou null se não encontrado
     */
    async getByTenant(token: string): Promise<TenantCustomizacao | null> {
        const response = await fetch(`${API_BASE}/api/site/customization`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.customization || data;
    }

    /**
     * Atualiza as customizações publicadas do tenant
     * 
     * @param token - Token JWT do tenant
     * @param customizacoes - Objeto com customizações a aplicar
     * @returns Customizações atualizadas
     */
    async update(token: string, customizacoes: any): Promise<TenantCustomizacao> {
        const response = await fetch(`${API_BASE}/api/site/customization`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customizacoes })
        });

        return response.json();
    }

    /**
     * Salva um rascunho de customizações sem publicar
     * Permite edições sem afetar o site publicado
     * 
     * @param token - Token JWT do tenant
     * @param customizacoes - Objeto com customizações do rascunho
     */
    async saveDraft(token: string, customizacoes: any): Promise<void> {
        await fetch(`${API_BASE}/api/site/customization/draft`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ customizacoes })
        });
    }

    /**
     * Publica o rascunho atual, tornando-o a versão ativa
     * 
     * @param token - Token JWT do tenant
     */
    async publishDraft(token: string): Promise<void> {
        await fetch(`${API_BASE}/api/site/customization/publish`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
}

/**
 * Instância singleton do repository
 * Use: import { customizationRepository } from '@/lib/repositories/CustomizationRepository'
 */
export const customizationRepository = new CustomizationRepository();
