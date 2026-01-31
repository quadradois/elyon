import { Branding, SiteConfig } from './api';

export const FALLBACK_BRANDING: Branding = {
    logo_url: null,
    logo_dark_url: null,
    favicon_url: null,
    primary_color: '#0ea5e9',
    secondary_color: '#10b981',
    accent_color: '#f59e0b',
    font_family_heading: 'Inter',
    font_family_body: 'Inter',
    company_name: 'Site em configuração',
    slogan: null,
    whatsapp: null,
    instagram: null,
    facebook: null,
    linkedin: null,
    youtube: null,
    email: null,
    phone: null,
    address: null,
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
    template: 'modern',
    hero_title: 'Encontre seu imóvel ideal',
    hero_subtitle: 'Os melhores imóveis da região',
    hero_image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80',
    hero_cta_text: 'Ver Imóveis',
    hero_cta_link: '/imoveis',
    site_title: 'Site em configuração',
    site_description: null,
    show_pricing: true,
    show_map: true,
    show_whatsapp_button: true,
    show_contact_form: true,
};
