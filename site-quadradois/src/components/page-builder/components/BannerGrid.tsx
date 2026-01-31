/**
 * BannerGrid Component - Premium Design
 * Grid de banners promocionais com efeitos glassmorphism e micro-animações
 */
import { ComponentProps } from '../types';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function BannerGrid(props: ComponentProps) {
    const {
        items = [],
        columns = 3,
        height = '420px'
    } = props;

    // Fallback para preview
    const banners = items.length > 0 ? items : [
        { title: 'Frente Mar', subtitle: 'Seleção Exclusiva', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80', link: '/imoveis?tag=frente-mar' },
        { title: 'Para Investir', subtitle: 'Alta Rentabilidade', image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&q=80', link: '/imoveis?tag=investimento' },
        { title: 'Lançamentos', subtitle: 'Em Primeira Mão', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80', link: '/imoveis?tag=lancamento' }
    ];

    const gridCols = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4'
    }[Math.min(banners.length, Number(columns))] || 'md:grid-cols-3';

    return (
        <section className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white">
            <div className="container mx-auto px-4">
                <div className={`grid grid-cols-1 ${gridCols} gap-6 md:gap-8`}>
                    {banners.map((banner: any, index: number) => (
                        <Link
                            key={index}
                            href={banner.link || '#'}
                            className="group relative block overflow-hidden rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500"
                            style={{ height }}
                        >
                            {/* Background Image with Zoom Effect */}
                            <div className="absolute inset-0">
                                <img
                                    src={banner.image}
                                    alt={banner.title}
                                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                />

                                {/* Multi-layer Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

                                {/* Glow Effect on Hover */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{
                                        background: 'radial-gradient(circle at 50% 100%, var(--color-primary, #3B82F6) 0%, transparent 60%)',
                                        opacity: 0,
                                        mixBlendMode: 'soft-light'
                                    }}
                                />
                            </div>

                            {/* Decorative Border Glow */}
                            <div
                                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{
                                    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.2), inset 0 0 30px rgba(255,255,255,0.1)'
                                }}
                            />

                            {/* Content Container */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                                {/* Subtitle Badge */}
                                {banner.subtitle && (
                                    <div className="inline-flex items-center gap-2 mb-3">
                                        <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary,#3B82F6)]" />
                                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/90 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full">
                                            {banner.subtitle}
                                        </span>
                                    </div>
                                )}

                                {/* Title with Gradient */}
                                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 group-hover:text-[var(--color-primary,#3B82F6)] transition-colors duration-300">
                                    {banner.title}
                                </h3>

                                {/* CTA with Arrow Animation */}
                                <div className="inline-flex items-center gap-2 text-white font-semibold group-hover:gap-4 transition-all duration-300">
                                    <span className="relative">
                                        Ver Imóveis
                                        {/* Underline Animation */}
                                        <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[var(--color-primary,#3B82F6)] group-hover:w-full transition-all duration-300" />
                                    </span>
                                    <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300" />
                                </div>
                            </div>

                            {/* Top Corner Badge (optional - for featured items) */}
                            {index === 0 && (
                                <div className="absolute top-4 right-4 bg-[var(--color-primary,#3B82F6)] text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                                    Destaque
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
