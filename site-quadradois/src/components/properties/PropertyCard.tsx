import Image from 'next/image';
import Link from 'next/link';
import { Bed, Bath, Car, Maximize } from 'lucide-react';
import type { Property } from '@/lib/api';

interface PropertyCardProps {
    property: Property;
    primaryColor?: string;
}

export default function PropertyCard({ property, primaryColor }: PropertyCardProps) {
    const formatPrice = (value: number | null) => {
        if (!value) return 'Consulte';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <Link
            href={`/imoveis/${property.codigo}`}
            className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
        >
            {/* Image */}
            <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                    src={property.imagem_principal || 'https://via.placeholder.com/400x300?text=Sem+Foto'}
                    alt={property.titulo}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {property.destaque && (
                    <span
                        className="absolute top-3 left-3 px-3 py-1 text-xs font-semibold text-white rounded-full"
                        style={{ backgroundColor: primaryColor || '#0ea5e9' }}
                    >
                        Destaque
                    </span>
                )}
                <span className="absolute top-3 right-3 px-3 py-1 text-xs font-semibold bg-white/90 text-gray-700 rounded-full">
                    {property.finalidade}
                </span>
            </div>

            {/* Content */}
            <div className="p-4 md:p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    {property.bairro}, {property.cidade}
                </p>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {property.titulo}
                </h3>
                <p
                    className="text-xl font-bold mb-4"
                    style={{ color: primaryColor || '#0ea5e9' }}
                >
                    {formatPrice(property.valor)}
                </p>

                {/* Features */}
                <div className="flex items-center gap-4 text-gray-500 text-sm">
                    {property.quartos && (
                        <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            <span>{property.quartos}</span>
                        </div>
                    )}
                    {property.banheiros && (
                        <div className="flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            <span>{property.banheiros}</span>
                        </div>
                    )}
                    {property.vagas && (
                        <div className="flex items-center gap-1">
                            <Car className="w-4 h-4" />
                            <span>{property.vagas}</span>
                        </div>
                    )}
                    {property.area_total && (
                        <div className="flex items-center gap-1">
                            <Maximize className="w-4 h-4" />
                            <span>{property.area_total}m²</span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
