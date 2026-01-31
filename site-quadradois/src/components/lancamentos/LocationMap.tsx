'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    MapPin, Navigation, ExternalLink, Car, Train,
    School, ShoppingBag, Trees, Building, Sparkles,
    Clock, Route
} from 'lucide-react';

interface NearbyPlace {
    nome: string;
    tipo: string;
    distancia?: string;
    tempo?: string;
    icone?: string; // Add support for custom icon if coming from backend
}

interface LocationMapProps {
    address: string;
    city: string;
    neighborhood?: string;
    latitude?: number;
    longitude?: number;
    primaryColor?: string;
    nearbyPlaces?: NearbyPlace[];
}

const placeTypeIcons: Record<string, any> = {
    'escola': School,
    'faculdade': School,
    'universidade': School,
    'shopping': ShoppingBag,
    'mercado': ShoppingBag,
    'supermercado': ShoppingBag,
    'parque': Trees,
    'praca': Trees,
    'metro': Train,
    'estacao': Train,
    'terminal': Train,
    'hospital': Building,
    'clinica': Building,
};

const getPlaceIcon = (tipo: string) => {
    const tipoLower = tipo.toLowerCase();
    for (const [key, Icon] of Object.entries(placeTypeIcons)) {
        if (tipoLower.includes(key)) return Icon;
    }
    return MapPin;
};

export default function LocationMap({
    address,
    city,
    neighborhood,
    latitude,
    longitude,
    primaryColor = '#0ea5e9',
    nearbyPlaces = []
}: LocationMapProps) {
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    const fullAddress = `${address}${neighborhood ? `, ${neighborhood}` : ''} - ${city}`;

    const mapUrl = latitude && longitude
        ? `https://www.google.com/maps?q=${latitude},${longitude}&hl=pt-BR&z=15&output=embed`
        : `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&hl=pt-BR&z=15&output=embed`;

    const directionsUrl = latitude && longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

    return (
        <section className="relative py-24 bg-gray-900 overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-black" />
                <div
                    className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10"
                    style={{ background: primaryColor }}
                />
                <div
                    className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-10"
                    style={{ background: primaryColor }}
                />
            </div>

            <div className="container-site relative z-10">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-6">
                        <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                        <span className="text-sm font-semibold text-white/90">
                            Localização Privilegiada
                        </span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                        Onde tudo <span style={{ color: primaryColor }}>acontece</span>
                    </h2>
                </motion.div>

                {/* Main Content Grid */}
                <motion.div
                    className="bg-gray-800/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="grid lg:grid-cols-2 min-h-[600px]">
                        {/* Left Column: Map */}
                        <div className="relative h-[400px] lg:h-full w-full bg-gray-900/50">
                            {/* Loading State */}
                            {!isMapLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                                    <div className="flex flex-col items-center gap-4">
                                        <div
                                            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                                            style={{ borderColor: primaryColor, borderTopColor: 'transparent' }}
                                        />
                                        <span className="text-gray-400 text-sm">Carregando mapa...</span>
                                    </div>
                                </div>
                            )}

                            <iframe
                                src={mapUrl}
                                className="absolute inset-0 w-full h-full grayscale-[20%] contrast-[1.1] hover:grayscale-0 transition-all duration-700"
                                allowFullScreen
                                loading="lazy"
                                title="Mapa de localização"
                                onLoad={() => setIsMapLoaded(true)}
                            />

                            {/* Overlay Gradient for seamless merge on mobile */}
                            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gray-900 to-transparent lg:hidden pointer-events-none" />
                        </div>

                        {/* Right Column: Info & Points */}
                        <div className="relative p-8 lg:p-12 flex flex-col h-full bg-gray-900/40">
                            {/* Address Block */}
                            <div className="mb-10">
                                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                                    <MapPin className="w-6 h-6" style={{ color: primaryColor }} />
                                    {neighborhood || city}
                                </h3>
                                <p className="text-lg text-gray-300 leading-relaxed max-w-md">
                                    {fullAddress}
                                </p>

                                <div className="flex gap-4 mt-8">
                                    <a
                                        href={directionsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                                        style={{ background: primaryColor }}
                                    >
                                        <Navigation className="w-4 h-4" />
                                        Como Chegar
                                    </a>
                                </div>
                            </div>

                            {/* Points of Interest */}
                            {nearbyPlaces && nearbyPlaces.length > 0 ? (
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Sparkles className="w-5 h-5" style={{ color: primaryColor }} />
                                        <span className="text-white font-semibold">Nos Arredores</span>
                                    </div>

                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {nearbyPlaces.map((place, index) => {
                                            const Icon = getPlaceIcon(place.tipo);
                                            return (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
                                                >
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                                                        style={{ background: `${primaryColor}20` }}
                                                    >
                                                        <Icon className="w-5 h-5" style={{ color: primaryColor }} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white font-medium truncate">{place.nome}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            {place.distancia && (
                                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <Route className="w-3 h-3" />
                                                                    {place.distancia}
                                                                </span>
                                                            )}
                                                            {place.tempo && (
                                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {place.tempo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                    <MapPin className="w-12 h-12 mb-4 opacity-50 text-gray-400" />
                                    <p className="text-gray-400">
                                        Explore a região pelo mapa ao lado e descubra o que este bairro incrível tem a oferecer.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
