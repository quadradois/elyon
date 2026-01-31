'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Property } from '@/lib/api';
import { MapPin, Bed, Bath, Car, Maximize, Share2, Heart, Phone, Mail } from 'lucide-react';

interface PropertyDetailProps {
    property: Property;
    primaryColor?: string;
    secondaryColor?: string;
    onContactSubmit?: (data: any) => Promise<void>;
}

export default function PropertyDetail({
    property,
    primaryColor = '#0ea5e9',
    secondaryColor = '#10b981',
    onContactSubmit
}: PropertyDetailProps) {
    const [activeImage, setActiveImage] = useState(0);
    const [showContactForm, setShowContactForm] = useState(false);

    // Formatar preço
    const formatPrice = (value: number | null) => {
        if (!value) return 'Consulte';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Imagens (garantir array)
    const images = property.fotos && property.fotos.length > 0
        ? property.fotos
        : [property.imagem_principal || 'https://via.placeholder.com/800x600?text=Sem+Foto'];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Gallery Section */}
            <div className="relative h-[400px] md:h-[500px] bg-gray-100">
                <Image
                    src={images[activeImage]}
                    alt={property.titulo}
                    fill
                    className="object-cover"
                    priority
                />

                {/* Navigation Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2 pointer-events-auto scrollbar-hide">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveImage(idx)}
                            className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${activeImage === idx ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                                }`}
                        >
                            <Image src={img} alt={`Foto ${idx + 1}`} fill className="object-cover" />
                        </button>
                    ))}
                </div>

                <div className="absolute top-4 right-4 flex gap-2">
                    <button className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors text-gray-700">
                        <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors text-red-500">
                        <Heart className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">

                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                                    {property.titulo}
                                </h1>
                                <div className="flex items-center text-gray-500">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    <span>{property.bairro}, {property.cidade}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">
                                    {property.finalidade}
                                </p>
                                <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                                    {formatPrice(property.valor)}
                                </p>
                            </div>
                        </div>

                        {/* Features Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                    <Bed className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Quartos</p>
                                    <p className="font-semibold">{property.quartos || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                    <Bath className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Banheiros</p>
                                    <p className="font-semibold">{property.banheiros || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                    <Car className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Vagas</p>
                                    <p className="font-semibold">{property.vagas || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                    <Maximize className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Área</p>
                                    <p className="font-semibold">{property.area_total ? `${property.area_total}m²` : '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="mt-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Sobre o imóvel</h2>
                            <div className="prose prose-gray max-w-none text-gray-600 whitespace-pre-line">
                                {property.descricao || 'Sem descrição disponível.'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar (Contact) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Interessou?</h3>
                        <p className="text-gray-600 text-sm mb-6">
                            Entre em contato para agendar uma visita ou tirar dúvidas sobre este imóvel.
                        </p>

                        <div className="space-y-3">
                            <button
                                className="w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-white font-medium transition-opacity hover:opacity-90"
                                style={{ backgroundColor: '#25D366' }} // Whatsapp Green
                            >
                                <Phone className="w-5 h-5" />
                                Conversar no WhatsApp
                            </button>

                            <button
                                className="w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                <Mail className="w-5 h-5" />
                                Enviar E-mail
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <p className="text-xs text-center text-gray-400">
                                Cód. do Imóvel: <span className="font-mono text-gray-600">{property.codigo}</span>
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
