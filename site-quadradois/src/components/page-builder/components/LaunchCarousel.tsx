'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight, MapPin, Bed, Bath, Car, Ruler } from 'lucide-react';

interface LaunchCarouselProps {
    properties: any[];
    title: string;
    subtitle?: string;
}

export default function LaunchCarousel({ properties, title, subtitle }: LaunchCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    const activeProperty = properties[currentIndex];

    // Auto-play
    useEffect(() => {
        if (!isAutoPlaying) return;

        const interval = setInterval(() => {
            nextSlide();
        }, 6000); // 6 segundos por slide

        return () => clearInterval(interval);
    }, [currentIndex, isAutoPlaying]);

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % properties.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + properties.length) % properties.length);
    };

    if (!activeProperty) return null;

    const mainImage = activeProperty.image_urls?.[0] || 'https://images.unsplash.com/photo-1600596542815-60c37c6525fa?q=80&w=1600';

    return (
        <section className="relative w-full h-[600px] md:h-[700px] lg:h-[800px] overflow-hidden bg-black text-white group">
            {/* Background Image with Transition */}
            <div className="absolute inset-0 transition-all duration-700 ease-in-out">
                <div
                    key={activeProperty.id} // Chave para forçar re-render e animação
                    className="absolute inset-0 bg-cover bg-center animate-fade-in"
                    style={{ backgroundImage: `url(${mainImage})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
            </div>

            {/* Content Overlay */}
            <div className="absolute inset-0 flex items-end pb-20 md:pb-32">
                <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">

                    {/* Left: Info */}
                    <div className="animate-fade-in-up md:max-w-2xl">
                        <span className="inline-block px-3 py-1 bg-[var(--color-primary)] text-white text-xs font-bold uppercase tracking-widest mb-4 rounded-full">
                            Lançamento Exclusivo
                        </span>

                        <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6 leading-tight">
                            {activeProperty.title}
                        </h2>

                        <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-xl line-clamp-2 md:line-clamp-none">
                            {activeProperty.description || subtitle || 'Um empreendimento único com design sofisticado e localização privilegiada.'}
                        </p>

                        {/* Specs */}
                        <div className="flex flex-wrap gap-4 md:gap-8 mb-8 text-sm md:text-base font-medium">
                            {activeProperty.bedrooms > 0 && (
                                <div className="flex items-center gap-2">
                                    <Bed className="w-5 h-5 text-[var(--color-primary)]" />
                                    <span>{activeProperty.bedrooms} Quartos</span>
                                </div>
                            )}
                            {activeProperty.area > 0 && (
                                <div className="flex items-center gap-2">
                                    <Ruler className="w-5 h-5 text-[var(--color-primary)]" />
                                    <span>{activeProperty.area} m²</span>
                                </div>
                            )}
                            {activeProperty.address_neighborhood && (
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-[var(--color-primary)]" />
                                    <span>{activeProperty.address_neighborhood}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <Link
                                href={`/imoveis/${activeProperty.id}`}
                                className="px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-all flex items-center gap-2"
                            >
                                Ver Detalhes <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Right: Navigation (Desktop) */}
                    <div className="hidden lg:flex flex-col items-end justify-end gap-6">
                        {/* Thumbnails if needed, or just arrows */}
                        <div className="flex gap-4">
                            <button
                                onClick={prevSlide}
                                className="p-4 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all bg-black/20 backdrop-blur-sm"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                onClick={nextSlide}
                                className="p-4 rounded-full border border-white/20 hover:bg-white hover:text-black transition-all bg-black/20 backdrop-blur-sm"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-4 text-sm font-mono text-white/60">
                            <span>{String(currentIndex + 1).padStart(2, '0')}</span>
                            <div className="w-32 h-[1px] bg-white/20 relative">
                                <div
                                    className="absolute top-0 left-0 h-full bg-white transition-all duration-300"
                                    style={{ width: `${((currentIndex + 1) / properties.length) * 100}%` }}
                                />
                            </div>
                            <span>{String(properties.length).padStart(2, '0')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation (Arrows Overlay) */}
            <button
                onClick={prevSlide}
                className="lg:hidden absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <button
                onClick={nextSlide}
                className="lg:hidden absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 backdrop-blur-md text-white border border-white/10"
            >
                <ChevronRight className="w-6 h-6" />
            </button>
        </section>
    );
}
