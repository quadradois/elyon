/**
 * PropertyCarousel Component
 * Carrossel de imóveis com scroll snap
 */
import { ComponentProps } from '../types';
import PropertyCard from '@/components/properties/PropertyCard';
import { getTenantProperties, getDomainFromHeaders } from '@/lib/tenant';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import LaunchCarousel from './LaunchCarousel';

export default async function PropertyCarousel(props: ComponentProps) {
    const {
        title = 'Destaques',
        subtitle = 'Nossa seleção exclusiva para você',
        limit = 8,
        show_button = true,
        button_text = 'Ver todos'
    } = props;

    // Buscar dados server-side
    const domain = getDomainFromHeaders();
    // Se for lançamentos, buscar com tag ou filtro específico se houver (por enquanto busca geral com limit)
    // O ideal seria filtrar por destaque ou tipo se a API suportar
    const data = await getTenantProperties(domain, { limit: Number(limit) });
    const properties = data.items || [];

    // Fallback: Preview
    const isPreview = properties.length === 0;
    if (isPreview) {
        properties.push(
            { id: 1, title: 'Residencial Ocean View', address_neighborhood: 'Barra Sul', sale_price: 2500000, bedrooms: 3, bathrooms: 2, parking_spots: 2, area: 156, image_urls: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80'] },
            { id: 2, title: 'Edifício Horizon', address_neighborhood: 'Centro', sale_price: 1850000, bedrooms: 4, bathrooms: 3, parking_spots: 3, area: 210, image_urls: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80'] },
            { id: 3, title: 'Vila dos Pássaros', address_neighborhood: 'Praia Brava', sale_price: 3200000, bedrooms: 5, bathrooms: 4, parking_spots: 4, area: 380, image_urls: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=800&auto=format&fit=crop'] }
        );
    }

    // Detecção automática de Modo Lançamento (Premium Fullscreen) se o título mencionar Lançamento
    const isLaunchMode = title?.toLowerCase().includes('lançamento');

    if (isLaunchMode) {
        return <LaunchCarousel properties={properties} title={title} subtitle={subtitle} />;
    }


    return (
        <section className="py-16 md:py-24 bg-surface">
            <div className="container mx-auto px-4">
                <div className="flex items-end justify-between mb-8 md:mb-12">
                    <div>
                        {title && (
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-xl text-gray-600">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {show_button && (
                        <Link
                            href="/imoveis"
                            className="hidden md:flex items-center gap-2 text-[var(--color-primary)] font-semibold hover:gap-3 transition-all"
                        >
                            {button_text} <ChevronRight className="w-5 h-5" />
                        </Link>
                    )}
                </div>

                {/* Carousel Container */}
                <div className="relative -mx-4 px-4">
                    <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory hide-scrollbar">
                        {properties.map((property: any) => (
                            <div
                                key={property.id}
                                className="min-w-[300px] md:min-w-[350px] snap-center"
                            >
                                <PropertyCard
                                    property={{
                                        id: property.id,
                                        codigo: property.property_code || String(property.id),
                                        titulo: property.title,
                                        descricao: property.description,
                                        tipo: 'Imóvel',
                                        finalidade: property.sale_price ? 'Venda' : 'Aluguel',
                                        valor: property.sale_price || property.rent_price,
                                        area_total: property.area,
                                        quartos: property.bedrooms,
                                        banheiros: property.bathrooms,
                                        vagas: property.parking_spots,
                                        endereco: '',
                                        bairro: property.address_neighborhood,
                                        cidade: property.address_city,
                                        estado: '',
                                        imagem_principal: property.image_urls?.[0] || null,
                                        fotos: property.image_urls || [],
                                        destaque: false,
                                    }}
                                    primaryColor="var(--color-primary)"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {show_button && (
                    <div className="mt-4 text-center md:hidden">
                        <Link
                            href="/imoveis"
                            className="inline-flex items-center gap-2 text-[var(--color-primary)] font-semibold"
                        >
                            {button_text} <ChevronRight className="w-5 h-5" />
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
