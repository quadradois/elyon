/**
 * Customizações de template aplicadas por um tenant específico
 * Armazena tanto a versão publicada quanto rascunhos
 */
export interface TenantCustomizacao {
    /** ID único da customização (UUID) */
    id: string;

    /** ID do tenant (imobiliária/corretor) dono desta customização */
    tenant_id: number;

    /** ID do template base sendo customizado */
    template_id: string;

    /** 
     * Customizações publicadas/ativas
     * Estrutura: { secao: { campo: valor } }
     * Ex: { hero: { titulo: 'Minha Imobiliária', cor_fundo: '#003366' } }
     */
    customizacoes: Record<string, Record<string, string | null>>;

    /** 
     * Rascunho de customizações (não publicado)
     * Permite edições sem afetar o site publicado
     * null = sem rascunho pendente
     */
    rascunho: Record<string, Record<string, string | null>> | null;

    /** Versão da customização (incrementa a cada publicação) */
    versao: number;

    /** Se a customização está publicada e visível no site */
    publicado: boolean;
}

/**
 * Configuração completa e resolvida de um site
 * Combina template + customizações + branding para renderização
 */
export interface ResolvedSiteConfig {
    /** ID do tenant dono do site */
    tenant_id: number;

    /** Template base selecionado */
    template: import('./template').Template;

    /** Customizações aplicadas (valores finais mesclados) */
    customizacoes: TenantCustomizacao['customizacoes'];

    /** Branding do tenant (logo, cores, etc) */
    branding: import('../api').Branding;

    /** Se está em modo preview (não afeta site publicado) */
    is_preview: boolean;

    /** Se está renderizando o rascunho (ao invés da versão publicada) */
    is_draft: boolean;

    /** Menu de navegação */
    menu: { label: string; href: string; order: number }[];
}
