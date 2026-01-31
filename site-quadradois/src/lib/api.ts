/**
 * Cliente API para Site Engine
 * Consome as APIs públicas do CRM
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';

interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        next: { revalidate: 60 }, // Cache por 60 segundos
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

// ========== Tipos ==========

export interface Branding {
    logo_url: string | null;
    logo_dark_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string | null;
    font_family_heading: string | null;
    font_family_body: string | null;
    company_name: string | null;
    slogan: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    youtube: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
}

export interface SiteConfig {
    template: string;
    hero_title: string | null;
    hero_subtitle: string | null;
    hero_image_url: string | null;
    hero_cta_text: string | null;
    hero_cta_link: string | null;
    site_title: string | null;
    site_description: string | null;
    show_pricing: boolean;
    show_map: boolean;
    show_whatsapp_button: boolean;
    show_contact_form: boolean;
}

export interface Property {
    id: number;
    codigo: string;
    titulo: string;
    descricao: string | null;
    tipo: string;
    finalidade: string;
    valor: number | null;
    area_total: number | null;
    quartos: number | null;
    banheiros: number | null;
    vagas: number | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    imagem_principal: string | null;
    fotos: string[];
    destaque: boolean;
    // Raw fields from API (for compatibility)
    property_code?: string;
    title?: string;
    description?: string | null;
    sale_price?: number | null;
    rent_price?: number | null;
    area?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    parking_spots?: number | null;
    address_neighborhood?: string | null;
    address_city?: string | null;
    image_urls?: string[];
}

export interface Diferencial {
    titulo: string;
    descricao: string;
    icone?: string;
}

export interface Lancamento {
    id: number;
    slug: string;
    nome: string;
    descricao: string | null;
    construtora: string | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    previsao_entrega: string | null;
    latitude?: number | null;
    longitude?: number | null;
    status: string;
    imagem_capa: string | null;
    logo_empreendimento: string | null;
    galeria_decorado: string[];
    video_url: string | null;
    localizacao?: Localizacao;
    diferenciais: Diferencial[];
    tipologias: Tipologia[];
}

export interface Tipologia {
    id: number;
    nome: string;
    quartos: number | null;
    suites: number | null;
    vagas: number | null;
    area_privativa: number | null;
    preco_inicial: number | null;
    preco_final: number | null;
    planta_url: string | null;
}

export interface PontoInteresse {
    nome: string;
    tipo: string;
    distancia?: string;
    tempo?: string;
    icone?: string;
}

export interface Localizacao {
    latitude: number | null;
    longitude: number | null;
    pontos_interesse: PontoInteresse[];
    cidade: string | null;
    bairro: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento?: string | null;
    estado: string | null;
    cep?: string | null;
    endereco: string | null;
}

// ========== APIs ==========

export const api = {
    // Site config e branding
    getSiteConfig: async (domain: string) => {
        return fetchApi<{ site: SiteConfig; branding: Branding; menu: any[] }>(`/api/public/site/${domain}`);
    },

    // Imóveis
    getProperties: async (params?: { page?: number; limit?: number; destaque?: boolean }) => {
        const searchParams = new URLSearchParams();
        if (params?.page) searchParams.set('page', String(params.page));
        if (params?.limit) searchParams.set('limit', String(params.limit));
        if (params?.destaque) searchParams.set('destaque', 'true');

        const query = searchParams.toString();
        return fetchApi<{ properties: Property[]; total: number; pages: number }>(`/api/public/properties${query ? '?' + query : ''}`);
    },

    getProperty: async (id: number) => {
        return fetchApi<Property>(`/api/public/properties/${id}`);
    },

    // Lançamentos
    getLancamentos: async () => {
        return fetchApi<{ lancamentos: Lancamento[] }>('/api/public/lancamentos');
    },

    getLancamento: async (slug: string) => {
        return fetchApi<Lancamento>(`/api/public/lancamentos/${slug}`);
    },

    // Leads
    createLead: async (data: {
        nome: string;
        email: string;
        telefone: string;
        mensagem?: string;
        lancamento_id?: number;
        property_id?: number;
    }) => {
        return fetchApi<{ success: boolean; message: string }>('/api/public/leads', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};

/**
 * Envia formulário de contato (Client-side compatible)
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
        const response = await fetch(
            `${API_BASE}/api/public/contact`,
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
