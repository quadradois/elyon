/**
 * PropertyGrid Component
 */
import { ComponentProps } from '../types';
import PropertyCard from '@/components/properties/PropertyCard';
import { getTenantProperties, getDomainFromHeaders } from '@/lib/tenant';
import Link from 'next/link';

// Componente Wrapper Server Side para buscar dados
export default async function PropertyGrid(props: ComponentProps) {
    const {
        title,
        subtitle,
        limit = 8,
        columns = 4, // Default agora é 4 para desktop large
        filter_type, // 'venda' | 'aluguel' | null
        show_button = true,
        button_text = 'Ver todos os imóveis'
    } = props;

    // Buscar dados server-side
    const domain = getDomainFromHeaders();

    // Mapear filter_type para params
    const queryParams: any = { limit: Number(limit) };
    if (filter_type === 'venda') queryParams.purpose = 'venda';
    if (filter_type === 'aluguel' || filter_type === 'locacao') queryParams.purpose = 'aluguel';

    const data = await getTenantProperties(domain, queryParams);
    const properties = data.items || [];

    if (properties.length === 0) return null;

    // Grid classes baseadas na prop columns
    const gridColsClass = Number(columns) === 4
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

    return (
        <section className="py-16 md:py-24 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
                    <div className="max-w-3xl">
                        {title && (
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-lg text-gray-600">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className={`grid ${gridColsClass} gap-6 md:gap-8`}>
                    {properties.map((property: any) => (
                        <PropertyCard
                            key={property.id}
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
                    ))}
                </div>

                {show_button && (
                    <div className="mt-16 text-center">
                        <Link
                            href={filter_type === 'aluguel' ? '/imoveis?finalidade=aluguel' : '/imoveis'}
                            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold hover:bg-gray-50 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all shadow-sm hover:shadow-md"
                        >
                            {button_text}
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
