'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Bed, Bath, Car, Maximize, Sparkles, ZoomIn, Phone, ChevronLeft, ChevronRight } from 'lucide-react';

interface Tipologia {
    id: number;
    nome: string;
    area_privativa?: number;
    quartos?: number;
    suites?: number;
    vagas?: number;
    preco_inicial?: number | null;
    preco_de?: number | null;
    planta_url?: string;
    disponivel?: boolean;
}

interface TypologiesShowcaseProps {
    tipologias: Tipologia[];
    primaryColor: string;
    whatsapp?: string;
    launchName?: string;
}

export default function TypologiesShowcase({
    tipologias,
    primaryColor,
    whatsapp,
    launchName
}: TypologiesShowcaseProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    if (!tipologias || tipologias.length === 0) return null;

    const total = tipologias.length;

    // Get visible indices (prev, current, next) with infinite loop
    const getVisibleIndices = useCallback(() => {
        const prev = (activeIndex - 1 + total) % total;
        const next = (activeIndex + 1) % total;
        return { prev, current: activeIndex, next };
    }, [activeIndex, total]);

    const { prev, current, next } = getVisibleIndices();

    // Navigation handlers
    const goToNext = useCallback(() => {
        setActiveIndex((prev) => (prev + 1) % total);
    }, [total]);

    const goToPrev = useCallback(() => {
        setActiveIndex((prev) => (prev - 1 + total) % total);
    }, [total]);

    // Auto-play carousel
    useEffect(() => {
        if (!isAutoPlaying || total <= 1) return;

        const interval = setInterval(goToNext, 5000);
        return () => clearInterval(interval);
    }, [isAutoPlaying, goToNext, total]);

    // Pause auto-play on hover
    const handleMouseEnter = () => setIsAutoPlaying(false);
    const handleMouseLeave = () => setIsAutoPlaying(true);

    const formatPrice = (value: number | null | undefined) => {
        if (!value) return 'Consulte';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
    };

    const handleWhatsApp = (tipologia: Tipologia) => {
        if (!whatsapp) return;
        const cleanPhone = whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(
            `Olá! Tenho interesse na planta ${tipologia.nome} (${tipologia.quartos} quartos, ${tipologia.area_privativa}m²) do ${launchName || 'empreendimento'}`
        );
        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    };

    // Card component for reuse
    const renderCard = (tipologia: Tipologia, position: 'prev' | 'current' | 'next', index: number) => {
        const isCurrent = position === 'current';
        const price = tipologia.preco_inicial || tipologia.preco_de;

        return (
            <motion.div
                key={`${tipologia.id}-${position}`}
                className={`relative ${isCurrent ? 'z-20' : 'z-10'}`}
                initial={false}
                animate={{
                    scale: isCurrent ? 1 : 0.85,
                    opacity: isCurrent ? 1 : 0.6,
                    x: position === 'prev' ? '5%' : position === 'next' ? '-5%' : 0,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={() => !isCurrent && setActiveIndex(index)}
                style={{ cursor: isCurrent ? 'default' : 'pointer' }}
            >
                <div
                    className={`bg-white rounded-3xl overflow-hidden transition-all duration-500 border-2 ${isCurrent
                            ? 'shadow-2xl border-transparent'
                            : 'shadow-lg border-gray-100 hover:border-gray-200'
                        }`}
                    style={isCurrent ? {
                        boxShadow: `0 30px 80px -20px ${primaryColor}40`
                    } : {}}
                >
                    {/* Image Container */}
                    {tipologia.planta_url && (
                        <div
                            className={`relative overflow-hidden ${isCurrent ? 'aspect-[4/3]' : 'aspect-square'}`}
                            onClick={(e) => {
                                if (isCurrent) {
                                    e.stopPropagation();
                                    setZoomedImage(tipologia.planta_url || null);
                                }
                            }}
                            style={{ cursor: isCurrent ? 'zoom-in' : 'pointer' }}
                        >
                            {/* Gradient background */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)`
                                }}
                            />

                            <Image
                                src={tipologia.planta_url}
                                alt={tipologia.nome}
                                fill
                                className={`object-contain transition-transform duration-500 ${isCurrent ? 'p-6 hover:scale-105' : 'p-4'}`}
                            />

                            {/* Zoom overlay - only for current */}
                            {isCurrent && (
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center group">
                                    <motion.div
                                        className="p-3 rounded-full bg-white/90 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        whileHover={{ scale: 1.1 }}
                                    >
                                        <ZoomIn className="w-5 h-5" style={{ color: primaryColor }} />
                                    </motion.div>
                                </div>
                            )}

                            {/* Sold out badge */}
                            {tipologia.disponivel === false && (
                                <div className="absolute top-4 left-4 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full shadow-lg">
                                    Esgotado
                                </div>
                            )}
                        </div>
                    )}

                    {/* Content - Full for current, minimal for sides */}
                    <div className={`${isCurrent ? 'p-6' : 'p-4'}`}>
                        {/* Title */}
                        <h3 className={`font-bold text-gray-900 ${isCurrent ? 'text-xl mb-4' : 'text-base mb-2'}`}>
                            {tipologia.nome}
                        </h3>

                        {/* Features Grid - Only for current */}
                        {isCurrent && (
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {tipologia.quartos && (
                                    <div
                                        className="flex items-center gap-2 p-3 rounded-xl transition-colors"
                                        style={{ background: `${primaryColor}08` }}
                                    >
                                        <Bed className="w-4 h-4" style={{ color: primaryColor }} />
                                        <span className="text-sm font-medium text-gray-700">
                                            {tipologia.quartos} {tipologia.quartos === 1 ? 'quarto' : 'quartos'}
                                        </span>
                                    </div>
                                )}
                                {tipologia.suites && tipologia.suites > 0 && (
                                    <div
                                        className="flex items-center gap-2 p-3 rounded-xl"
                                        style={{ background: `${primaryColor}08` }}
                                    >
                                        <Bath className="w-4 h-4" style={{ color: primaryColor }} />
                                        <span className="text-sm font-medium text-gray-700">
                                            {tipologia.suites} {tipologia.suites === 1 ? 'suíte' : 'suítes'}
                                        </span>
                                    </div>
                                )}
                                {tipologia.vagas && (
                                    <div
                                        className="flex items-center gap-2 p-3 rounded-xl"
                                        style={{ background: `${primaryColor}08` }}
                                    >
                                        <Car className="w-4 h-4" style={{ color: primaryColor }} />
                                        <span className="text-sm font-medium text-gray-700">
                                            {tipologia.vagas} {tipologia.vagas === 1 ? 'vaga' : 'vagas'}
                                        </span>
                                    </div>
                                )}
                                {tipologia.area_privativa && (
                                    <div
                                        className="flex items-center gap-2 p-3 rounded-xl"
                                        style={{ background: `${primaryColor}08` }}
                                    >
                                        <Maximize className="w-4 h-4" style={{ color: primaryColor }} />
                                        <span className="text-sm font-medium text-gray-700">
                                            {tipologia.area_privativa}m²
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Compact features for side cards */}
                        {!isCurrent && (
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                                {tipologia.quartos && <span>{tipologia.quartos} qts</span>}
                                {tipologia.area_privativa && <span>{tipologia.area_privativa}m²</span>}
                            </div>
                        )}

                        {/* Price */}
                        <div className={`${isCurrent ? 'pt-4 border-t border-gray-100' : ''}`}>
                            <div className={`flex items-end ${isCurrent ? 'justify-between gap-4' : 'justify-center'}`}>
                                <div className={isCurrent ? '' : 'text-center'}>
                                    <p className={`text-xs text-gray-400 uppercase tracking-wider mb-1 ${!isCurrent && 'hidden'}`}>
                                        A partir de
                                    </p>
                                    <p
                                        className={`font-black ${isCurrent ? 'text-3xl' : 'text-xl'}`}
                                        style={{ color: price ? primaryColor : 'inherit' }}
                                    >
                                        {formatPrice(price)}
                                    </p>
                                </div>

                                {isCurrent && whatsapp && (
                                    <motion.button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleWhatsApp(tipologia);
                                        }}
                                        className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white text-sm shadow-lg"
                                        style={{
                                            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`
                                        }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Phone className="w-4 h-4" />
                                        Interesse
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom accent line for current */}
                    {isCurrent && (
                        <motion.div
                            className="h-1"
                            style={{ backgroundColor: primaryColor }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.3 }}
                        />
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <>
            <section className="relative py-24 overflow-hidden">
                {/* Background */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50" />
                    <div
                        className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
                        style={{ background: primaryColor }}
                    />
                    <div
                        className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
                        style={{ background: primaryColor }}
                    />
                </div>

                <div className="container-site relative z-10">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg mb-6">
                            <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                            <span className="text-sm font-semibold text-gray-700">
                                {tipologias.length} {tipologias.length === 1 ? 'opção disponível' : 'opções disponíveis'}
                            </span>
                        </div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                            Plantas e{' '}
                            <span style={{ color: primaryColor }}>Valores</span>
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Escolha a planta que melhor se adapta ao seu estilo de vida
                        </p>
                    </motion.div>

                    {/* Carousel Container */}
                    <div
                        className="relative"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        {/* Navigation Arrows */}
                        <button
                            onClick={goToPrev}
                            className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-110 transition-all"
                            style={{ color: primaryColor }}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                            onClick={goToNext}
                            className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-110 transition-all"
                            style={{ color: primaryColor }}
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>

                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-8 md:px-16">
                            {/* Mobile: Show only current */}
                            <div className="md:hidden col-span-1">
                                {renderCard(tipologias[current], 'current', current)}
                            </div>

                            {/* Desktop: Show 3 cards */}
                            <div className="hidden md:block">
                                {renderCard(tipologias[prev], 'prev', prev)}
                            </div>
                            <div className="hidden md:block">
                                {renderCard(tipologias[current], 'current', current)}
                            </div>
                            <div className="hidden md:block">
                                {renderCard(tipologias[next], 'next', next)}
                            </div>
                        </div>

                        {/* Dots Indicator */}
                        <div className="flex justify-center gap-2 mt-8">
                            {tipologias.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveIndex(index)}
                                    className={`h-2 rounded-full transition-all duration-300 ${index === activeIndex
                                            ? 'w-8'
                                            : 'w-2 opacity-40 hover:opacity-70'
                                        }`}
                                    style={{ backgroundColor: primaryColor }}
                                />
                            ))}
                        </div>

                        {/* Auto-play indicator */}
                        {total > 1 && (
                            <div className="flex justify-center mt-4">
                                <span className={`text-xs text-gray-400 transition-opacity ${isAutoPlaying ? 'opacity-100' : 'opacity-0'}`}>
                                    ● Rolagem automática
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Zoom Modal */}
            <AnimatePresence>
                {zoomedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
                        onClick={() => setZoomedImage(null)}
                    >
                        <button
                            onClick={() => setZoomedImage(null)}
                            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
                        >
                            ✕
                        </button>
                        <motion.div
                            className="relative w-full h-full max-w-5xl max-h-[85vh]"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                        >
                            <Image
                                src={zoomedImage}
                                alt="Planta ampliada"
                                fill
                                className="object-contain"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// Helper function
function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
