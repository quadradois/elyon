'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, Grid, Maximize2, Camera, Sparkles } from 'lucide-react';

interface LaunchGalleryProps {
    images: string[];
    title?: string;
    subtitle?: string;
    primaryColor?: string;
    variant?: 'default' | 'decorado';
}

export default function LaunchGallery({
    images,
    title = 'Galeria',
    subtitle,
    primaryColor = '#0ea5e9',
    variant = 'default'
}: LaunchGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [showAll, setShowAll] = useState(false);

    if (!images || images.length === 0) return null;

    // Show limited images initially
    const displayLimit = 8;
    const visibleImages = showAll ? images : images.slice(0, displayLimit);
    const hasMore = images.length > displayLimit;

    const handleNext = useCallback(() => {
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % images.length);
        }
    }, [selectedIndex, images.length]);

    const handlePrev = useCallback(() => {
        if (selectedIndex !== null) {
            setSelectedIndex(selectedIndex === 0 ? images.length - 1 : selectedIndex - 1);
        }
    }, [selectedIndex, images.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return;
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') {
                setSelectedIndex(null);
                document.body.style.overflow = '';
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIndex, handleNext, handlePrev]);

    const openLightbox = (index: number) => {
        setSelectedIndex(index);
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        setSelectedIndex(null);
        document.body.style.overflow = '';
    };

    // Determine layout based on number of images
    const getGridLayout = () => {
        if (images.length === 1) return 'grid-cols-1';
        if (images.length === 2) return 'grid-cols-2';
        if (images.length === 3) return 'grid-cols-2 md:grid-cols-3';
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    };

    return (
        <>
            <section className="relative py-20 md:py-28 overflow-hidden">
                {/* Premium Background */}
                <div className="absolute inset-0">
                    <div className={`absolute inset-0 ${variant === 'decorado'
                        ? 'bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900'
                        : 'bg-gradient-to-b from-white via-gray-50 to-white'
                        }`} />

                    {/* Decorative elements */}
                    <div
                        className="absolute top-1/4 -left-32 w-64 h-64 rounded-full blur-3xl opacity-10"
                        style={{ background: primaryColor }}
                    />
                    <div
                        className="absolute bottom-1/4 -right-32 w-64 h-64 rounded-full blur-3xl opacity-10"
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
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 shadow-lg"
                            style={{
                                background: variant === 'decorado'
                                    ? 'rgba(255,255,255,0.1)'
                                    : 'white',
                                backdropFilter: 'blur(10px)'
                            }}
                        >
                            {variant === 'decorado' ? (
                                <Sparkles className="w-4 h-4 text-amber-400" />
                            ) : (
                                <Camera className="w-4 h-4" style={{ color: primaryColor }} />
                            )}
                            <span className={`text-sm font-semibold ${variant === 'decorado' ? 'text-white' : 'text-gray-700'
                                }`}>
                                {images.length} {images.length === 1 ? 'foto' : 'fotos'}
                            </span>
                        </div>

                        <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold mb-4 ${variant === 'decorado' ? 'text-white' : 'text-gray-900'
                            }`}>
                            {title}
                        </h2>

                        {subtitle && (
                            <p className={`text-lg max-w-2xl mx-auto ${variant === 'decorado' ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                {subtitle}
                            </p>
                        )}
                    </motion.div>

                    {/* Mobile Carousel - Horizontal Scroll */}
                    <div className="md:hidden">
                        <div
                            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 -mx-6 px-6"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {images.slice(0, 8).map((image, index) => (
                                <motion.div
                                    key={index}
                                    className="relative flex-shrink-0 snap-center cursor-pointer overflow-hidden rounded-2xl"
                                    style={{ width: '280px', height: '200px' }}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => openLightbox(index)}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={image}
                                        alt={`${title} ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                        <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-medium">
                                            {index + 1}/{images.length}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}

                            {/* View All Card */}
                            {images.length > 8 && (
                                <motion.div
                                    className="relative flex-shrink-0 snap-center cursor-pointer overflow-hidden rounded-2xl flex items-center justify-center"
                                    style={{
                                        width: '200px',
                                        height: '200px',
                                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -40)} 100%)`
                                    }}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    onClick={() => setShowAll(true)}
                                >
                                    <div className="text-center text-white">
                                        <Grid className="w-8 h-8 mx-auto mb-2" />
                                        <p className="font-bold text-lg">+{images.length - 8}</p>
                                        <p className="text-sm opacity-80">Ver todas</p>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Scroll Indicator */}
                        <div className="flex justify-center gap-1.5 mt-4">
                            {images.slice(0, Math.min(8, images.length)).map((_, index) => (
                                <div
                                    key={index}
                                    className="w-2 h-2 rounded-full transition-colors"
                                    style={{
                                        backgroundColor: index === 0 ? primaryColor : `${primaryColor}30`
                                    }}
                                />
                            ))}
                            {images.length > 8 && (
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: `${primaryColor}30` }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Desktop Masonry-style Gallery - Hidden on Mobile */}
                    <div className="hidden md:block">
                        {images.length >= 5 && !showAll ? (
                            // Featured Layout for 5+ images
                            <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[700px]">
                                {/* Hero Image - Large */}
                                <motion.div
                                    className="col-span-2 row-span-2 relative group cursor-pointer overflow-hidden rounded-3xl"
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    onClick={() => openLightbox(0)}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={images[0]}
                                        alt={`${title} 1`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                                        <motion.div
                                            className="p-5 rounded-full bg-white/20 backdrop-blur-md"
                                            whileHover={{ scale: 1.1 }}
                                        >
                                            <Maximize2 className="w-8 h-8 text-white" />
                                        </motion.div>
                                    </div>
                                    {/* Label */}
                                    <div className="absolute bottom-6 left-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-white text-sm font-medium">
                                            Vista Principal
                                        </span>
                                    </div>
                                </motion.div>

                                {/* Secondary Images */}
                                {images.slice(1, 5).map((image, index) => (
                                    <motion.div
                                        key={index + 1}
                                        className={`relative group cursor-pointer overflow-hidden rounded-2xl ${index === 3 && images.length > 5 ? 'relative' : ''
                                            }`}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: (index + 1) * 0.1 }}
                                        onClick={() => openLightbox(index + 1)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={image}
                                            alt={`${title} ${index + 2}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        {/* "See More" overlay on last item */}
                                        {index === 3 && images.length > 5 && (
                                            <div
                                                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer group-hover:bg-black/70 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                                            >
                                                <Grid className="w-8 h-8 text-white mb-2" />
                                                <p className="text-white font-bold text-lg">+{images.length - 5}</p>
                                                <p className="text-white/80 text-sm">Ver todas</p>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            // Standard Grid Layout
                            <div className={`grid ${getGridLayout()} gap-4`}>
                                {visibleImages.map((image, index) => (
                                    <motion.div
                                        key={index}
                                        className={`relative group cursor-pointer overflow-hidden rounded-2xl ${index === 0 && images.length > 4 ? 'md:col-span-2 md:row-span-2' : ''
                                            }`}
                                        style={{
                                            aspectRatio: index === 0 && images.length > 4 ? 'auto' : '1/1',
                                            height: index === 0 && images.length > 4 ? 'auto' : undefined
                                        }}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.05 }}
                                        onClick={() => openLightbox(index)}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={image}
                                            alt={`${title} ${index + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-3 rounded-full bg-white/20 backdrop-blur-md">
                                                <ZoomIn className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <span className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            {index + 1}/{images.length}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Show All / Show Less Button */}
                    {hasMore && (
                        <motion.div
                            className="text-center mt-12"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                        >
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold transition-all duration-300 ${variant === 'decorado'
                                    ? 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <Grid className="w-5 h-5" />
                                <span>{showAll ? 'Ver menos' : `Ver todas as ${images.length} fotos`}</span>
                            </button>
                        </motion.div>
                    )}
                </div>
            </section>

            {/* Premium Lightbox Modal */}
            <AnimatePresence>
                {selectedIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
                        onClick={closeLightbox}
                    >
                        {/* Blurred background preview */}
                        <div
                            className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl scale-110"
                            style={{ backgroundImage: `url(${images[selectedIndex]})` }}
                        />

                        {/* Header */}
                        <div className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
                            <div className="flex items-center gap-4">
                                <span className="text-white font-medium">{title}</span>
                                <span className="px-3 py-1 rounded-full bg-white/20 text-white text-sm">
                                    {selectedIndex + 1} / {images.length}
                                </span>
                            </div>
                            <button
                                onClick={closeLightbox}
                                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Navigation arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                    className="absolute left-4 md:left-8 z-20 p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all hover:scale-110"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                    className="absolute right-4 md:right-8 z-20 p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all hover:scale-110"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </>
                        )}

                        {/* Main Image */}
                        <motion.div
                            key={selectedIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="relative z-10 w-full h-full max-w-7xl max-h-[85vh] mx-4 md:mx-8 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={images[selectedIndex]}
                                alt={`${title} ${selectedIndex + 1}`}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            />
                        </motion.div>

                        {/* Thumbnail Strip */}
                        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 to-transparent">
                            <div className="flex justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {images.map((image, index) => (
                                    <motion.button
                                        key={index}
                                        onClick={(e) => { e.stopPropagation(); setSelectedIndex(index); }}
                                        className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden transition-all ${index === selectedIndex
                                            ? 'ring-2 ring-white scale-110'
                                            : 'opacity-50 hover:opacity-80'
                                            }`}
                                        whileHover={{ scale: index === selectedIndex ? 1.1 : 1.05 }}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={image}
                                            alt={`Thumbnail ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Keyboard hints */}
                        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-4 text-white/60 text-sm">
                            <span className="flex items-center gap-1">
                                <kbd className="px-2 py-1 rounded bg-white/10">←</kbd>
                                <kbd className="px-2 py-1 rounded bg-white/10">→</kbd>
                                para navegar
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-2 py-1 rounded bg-white/10">ESC</kbd>
                                para fechar
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
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
