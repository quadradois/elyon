/**
 * Categorias de templates disponíveis no Site Engine
 * - residencial: Templates para sites de imobiliárias focadas em imóveis residenciais
 * - comercial: Templates para sites de imobiliárias focadas em imóveis comerciais
 * - corretor: Templates para sites pessoais de corretores
 * - lancamentos: Templates para landing pages de lançamentos específicos
 */
export type TemplateCategory = 'residencial' | 'comercial' | 'corretor' | 'lancamentos';

/**
 * Tipos de campos disponíveis para customização de templates
 * - text: Campo de texto simples (input)
 * - textarea: Campo de texto multilinha
 * - richtext: Editor de texto rico (HTML)
 * - color: Seletor de cor
 * - image: Upload de imagem
 * - font: Seletor de fonte tipográfica
 * - select: Lista de opções (dropdown)
 */
export type FieldType = 'text' | 'textarea' | 'richtext' | 'color' | 'image' | 'font' | 'select';

/**
 * Schema de um campo customizável no template
 * Define as propriedades e validações de cada campo editável
 */
export interface FieldSchema {
    /** Tipo do campo (determina o componente de input a ser renderizado) */
    type: FieldType;

    /** Label exibido ao usuário */
    label: string;

    /** Texto de placeholder (opcional) */
    placeholder?: string;

    /** Se o campo é obrigatório */
    required?: boolean;

    /** Opções disponíveis (apenas para type='select') */
    options?: string[];

    /** Tamanho máximo de caracteres (para campos de texto) */
    maxLength?: number;
}

/**
 * Estrutura completa de um template do Site Engine
 * Representa um template disponível para seleção e customização
 */
export interface Template {
    /** ID único do template (UUID) */
    id: string;

    /** Nome amigável do template */
    nome: string;

    /** Slug único para URL (ex: 'modern-residencial') */
    slug: string;

    /** Categoria do template */
    categoria: TemplateCategory;

    /** Versão do template (semver, ex: '1.0.0') */
    versao: string;

    /** URL de preview do template (site de demonstração) */
    preview_url: string;

    /** URL da thumbnail para exibição na galeria */
    thumbnail_url: string;

    /** Descrição do template */
    descricao: string;

    /** 
     * Schema de customização do template
     * Estrutura: { secao: { campo: FieldSchema } }
     * Ex: { hero: { titulo: { type: 'text', label: 'Título Principal' } } }
     */
    customizacao_schema: Record<string, Record<string, FieldSchema>>;

    /** 
     * Estrutura de layout do template
     * Define páginas disponíveis e componentes utilizáveis
     */
    layout_estrutura: {
        /** Lista de páginas do template (ex: ['home', 'sobre', 'contato']) */
        paginas: string[];

        /** Componentes disponíveis para uso (ex: ['hero', 'galeria', 'formulario']) */
        componentes_disponiveis: string[];
    };

    /** 
     * Configurações padrão do template
     * Valores iniciais antes de qualquer customização
     */
    configuracoes_padrao: Record<string, any>;
}
