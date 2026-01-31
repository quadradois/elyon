'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bed, Maximize2, Car, Bath, X, ZoomIn, ChevronLeft, ChevronRight, Sparkles, Phone } from 'lucide-react';

interface Tipologia {
    id: number;
    nome: string;
    quartos: number;
    suites: number;
    banheiros: number;
    vagas: number;
    area_privativa: number;
    area_total?: number;
    preco_de?: number;
    preco_por?: number;
    planta_url?: string;
    disponivel?: boolean;
}

interface FloorPlanSelectorProps {
    tipologias: Tipologia[];
    primaryColor: string;
    whatsapp?: string;
    launchName?: string;
}

export default function FloorPlanSelector({
    tipologias,
    primaryColor,
    whatsapp,
    launchName
}: FloorPlanSelectorProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const selected = tipologias[selectedIndex];

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const handleSelect = (index: number) => {
        if (index !== selectedIndex && !isAnimating) {
            setIsAnimating(true);
            setSelectedIndex(index);
            setTimeout(() => setIsAnimating(false), 500);
        }
    };

    const handlePrev = () => {
        if (selectedIndex > 0) handleSelect(selectedIndex - 1);
    };

    const handleNext = () => {
        if (selectedIndex < tipologias.length - 1) handleSelect(selectedIndex + 1);
    };

    const handleWhatsApp = () => {
        if (!whatsapp) return;
        const cleanPhone = whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(
            `Olá! Tenho interesse na planta ${selected.nome} (${selected.quartos} quartos, ${selected.area_privativa}m²) do ${launchName || 'empreendimento'}`
        );
        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    };

    // Feature card component
    const FeatureCard = ({ icon: Icon, label, value, unit = '' }: {
        icon: any;
        label: string;
        value: number | string;
        unit?: string;
    }) => (
        <motion.div
            className="group relative bg-white rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 overflow-hidden"
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
        >
            {/* Decorative gradient */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                    background: `linear-gradient(135deg, ${primaryColor}08 0%, transparent 70%)`
                }}
            />

            {/* Icon with glow effect */}
            <div className="relative mb-3">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                    style={{
                        background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)`,
                        boxShadow: `0 0 0 0 ${primaryColor}40`
                    }}
                >
                    <Icon
                        className="w-7 h-7 transition-all duration-500 group-hover:scale-110"
                        style={{ color: primaryColor }}
                    />
                </div>
            </div>

            {/* Label */}
            <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>

            {/* Value */}
            <p className="text-2xl font-bold text-gray-900">
                {value}<span className="text-lg text-gray-500">{unit}</span>
            </p>
        </motion.div>
    );

    return (
        <>
            <section className="relative py-24 overflow-hidden">
                {/* Premium Background */}
                <div className="absolute inset-0">
                    {/* Base gradient */}
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50" />

                    {/* Decorative elements */}
                    <div
                        className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
                        style={{ background: primaryColor }}
                    />
                    <div
                        className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10"
                        style={{ background: primaryColor }}
                    />

                    {/* Pattern overlay */}
                    <div
                        className="absolute inset-0 opacity-5"
                        style={{
                            backgroundImage: `radial-gradient(circle at 1px 1px, ${primaryColor} 1px, transparent 0)`,
                            backgroundSize: '40px 40px'
                        }}
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
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md mb-6">
                            <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                            <span className="text-sm font-semibold text-gray-700">
                                {tipologias.length} opções disponíveis
                            </span>
                        </div>

                        <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
                            Escolha sua{' '}
                            <span
                                className="relative"
                                style={{ color: primaryColor }}
                            >
                                planta ideal
                                <svg
                                    className="absolute -bottom-2 left-0 w-full"
                                    viewBox="0 0 200 12"
                                    fill="none"
                                >
                                    <path
                                        d="M2 8C50 2 150 2 198 8"
                                        stroke={primaryColor}
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeOpacity="0.3"
                                    />
                                </svg>
                            </span>
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Explore cada detalhe das nossas plantas exclusivas e encontre o espaço perfeito para você
                        </p>
                    </motion.div>

                    {/* Premium Tab Selector - Carousel */}
                    <div className="relative max-w-5xl mx-auto mb-16">
                        {/* Navigation Arrows */}
                        <button
                            onClick={handlePrev}
                            disabled={selectedIndex === 0}
                            className="absolute -left-2 md:-left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 transition-transform"
                            style={{ color: primaryColor }}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={selectedIndex === tipologias.length - 1}
                            className="absolute -right-2 md:-right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 transition-transform"
                            style={{ color: primaryColor }}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>

                        {/* Tab Pills - Horizontal Scroll Carousel */}
                        <div
                            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-4 py-2 -mx-4"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {tipologias.map((tip, index) => (
                                <motion.button
                                    key={tip.id}
                                    onClick={() => handleSelect(index)}
                                    className={`relative flex-shrink-0 snap-center px-6 py-4 rounded-2xl transition-all duration-500 overflow-hidden ${selectedIndex === index
                                            ? 'text-white shadow-2xl'
                                            : 'bg-white text-gray-700 shadow-md hover:shadow-xl'
                                        }`}
                                    style={selectedIndex === index ? {
                                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
                                        boxShadow: `0 20px 40px ${primaryColor}40`
                                    } : {}}
                                    whileHover={{ scale: selectedIndex === index ? 1.02 : 1.05 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {/* Shine effect for selected */}
                                    {selectedIndex === index && (
                                        <motion.div
                                            className="absolute inset-0 opacity-30"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, white, transparent)',
                                            }}
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                                        />
                                    )}

                                    <div className="relative z-10 text-center min-w-[70px]">
                                        <p className={`text-xs font-bold mb-1 whitespace-nowrap ${selectedIndex === index ? 'text-white/90' : 'text-gray-500'
                                            }`}>
                                            {tip.quartos} {tip.quartos === 1 ? 'Quarto' : 'Quartos'}
                                        </p>
                                        <p className={`text-2xl font-bold whitespace-nowrap ${selectedIndex === index ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {tip.area_privativa}<span className="text-sm">m²</span>
                                        </p>
                                    </div>

                                    {/* Availability badge */}
                                    {tip.disponivel === false && (
                                        <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                            Esgotado
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>

                        {/* Scroll Indicator Dots */}
                        <div className="flex justify-center gap-2 mt-4">
                            {tipologias.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSelect(index)}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${selectedIndex === index
                                            ? 'w-6'
                                            : 'opacity-40 hover:opacity-70'
                                        }`}
                                    style={{ backgroundColor: primaryColor }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedIndex}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto items-center"
                        >
                            {/* Floor Plan Image - Premium Card */}
                            <div className="relative group">
                                {/* Floating decorative elements */}
                                <div
                                    className="absolute -top-4 -left-4 w-24 h-24 rounded-2xl opacity-20 blur-sm"
                                    style={{ background: primaryColor }}
                                />
                                <div
                                    className="absolute -bottom-4 -right-4 w-32 h-32 rounded-2xl opacity-10 blur-sm"
                                    style={{ background: primaryColor }}
                                />

                                {/* Main Card */}
                                <motion.div
                                    className="relative bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100"
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* Header bar */}
                                    <div
                                        className="flex items-center justify-between px-6 py-4"
                                        style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, transparent 100%)` }}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Planta</p>
                                            <h3 className="text-xl font-bold text-gray-900">{selected.nome}</h3>
                                        </div>
                                        {selected.disponivel === false && (
                                            <span className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse">
                                                Esgotado
                                            </span>
                                        )}
                                    </div>

                                    {/* Image container */}
                                    <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-white p-8 cursor-pointer"
                                        onClick={() => selected.planta_url && setZoomedImage(selected.planta_url)}
                                    >
                                        {selected.planta_url ? (
                                            <>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <motion.img
                                                    src={selected.planta_url}
                                                    alt={`Planta ${selected.nome}`}
                                                    className="w-full h-full object-contain"
                                                    initial={{ scale: 0.9, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ duration: 0.5 }}
                                                />

                                                {/* Zoom overlay */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                                    <motion.div
                                                        className="p-4 rounded-full bg-white shadow-xl opacity-0 group-hover:opacity-100 transition-all"
                                                        whileHover={{ scale: 1.1 }}
                                                    >
                                                        <ZoomIn className="w-6 h-6" style={{ color: primaryColor }} />
                                                    </motion.div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                                <Maximize2 className="w-16 h-16 mb-4 opacity-30" />
                                                <p>Planta em breve</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Info Panel */}
                            <div className="space-y-8">
                                {/* Title */}
                                <div>
                                    <motion.h3
                                        className="text-4xl font-bold text-gray-900 mb-2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        {selected.nome}
                                    </motion.h3>
                                    <p className="text-lg text-gray-500">
                                        {selected.quartos} quarto{selected.quartos > 1 ? 's' : ''} • {selected.area_privativa}m² privativos
                                    </p>
                                </div>

                                {/* Features Grid */}
                                <motion.div
                                    className="grid grid-cols-2 gap-4"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <FeatureCard icon={Bed} label="Quartos" value={selected.quartos} />
                                    <FeatureCard icon={Bath} label="Suítes" value={selected.suites} />
                                    <FeatureCard icon={Car} label="Vagas" value={selected.vagas} />
                                    <FeatureCard icon={Maximize2} label="Área Privativa" value={selected.area_privativa} unit="m²" />
                                </motion.div>

                                {/* Price Card */}
                                {selected.preco_de && (
                                    <motion.div
                                        className="relative p-8 rounded-3xl overflow-hidden"
                                        style={{
                                            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -40)} 100%)`,
                                        }}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        {/* Shine effect */}
                                        <div
                                            className="absolute inset-0 opacity-10"
                                            style={{
                                                background: 'linear-gradient(45deg, transparent 40%, white 50%, transparent 60%)',
                                                backgroundSize: '200% 200%',
                                            }}
                                        />

                                        <div className="relative z-10">
                                            <p className="text-white/80 text-sm font-medium mb-2">A partir de</p>
                                            <p className="text-5xl font-bold text-white mb-4">
                                                {formatPrice(selected.preco_de)}
                                            </p>

                                            {selected.preco_por && selected.preco_por < selected.preco_de && (
                                                <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                                                    <p className="text-white text-sm font-medium">
                                                        🎁 Condições especiais: {formatPrice(selected.preco_por)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                                {/* CTA Button */}
                                {whatsapp && (
                                    <motion.button
                                        onClick={handleWhatsApp}
                                        className="w-full py-5 px-8 rounded-2xl font-bold text-lg text-white shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 group"
                                        style={{
                                            background: `linear-gradient(135deg, #25D366 0%, #128C7E 100%)`
                                        }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                    >
                                        <Phone className="w-5 h-5 group-hover:animate-pulse" />
                                        <span>Tenho interesse nesta planta</span>
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </section>

            {/* Premium Zoom Modal */}
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
                            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        <motion.div
                            className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={zoomedImage}
                                alt="Planta ampliada"
                                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
