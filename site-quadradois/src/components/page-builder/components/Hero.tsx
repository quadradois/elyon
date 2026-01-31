/**
 * Hero Component - Premium Typography Edition
 */
'use client';

import { ComponentProps } from '../types';
import Link from 'next/link';
import HeroSearchBox from './HeroSearchBox';

/**
 * HeroTitle - Componente de título com gradient e highlight dinâmico
 */
function HeroTitle({ text, alignment }: { text: string; alignment: string }) {
    // Dividir texto em palavras, destacar a última
    const words = text.trim().split(' ');
    const lastWord = words.pop() || '';
    const restOfTitle = words.join(' ');

    return (
        <h1
            className={`
                text-5xl md:text-7xl font-extrabold mb-6 leading-none tracking-tight
                animate-hero-title
                ${alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'}
            `}
            style={{
                textShadow: '0 0 60px rgba(255,255,255,0.2), 0 4px 20px rgba(0,0,0,0.5)'
            }}
        >
            {restOfTitle && (
                <span className="text-white drop-shadow-lg">{restOfTitle} </span>
            )}
            <span
                className="inline-block"
                style={{
                    background: 'linear-gradient(135deg, white 0%, var(--color-primary) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 0 30px var(--color-primary))'
                }}
            >
                {lastWord}
            </span>
        </h1>
    );
}

/**
 * HeroSubtitle - Subtítulo com animação de entrada
 */
function HeroSubtitle({ text, alignment }: { text: string; alignment: string }) {
    return (
        <p
            className={`
                text-lg md:text-2xl text-white/80 mb-10 max-w-3xl font-light
                animate-hero-subtitle
                ${alignment === 'center' ? 'text-center mx-auto' : alignment === 'right' ? 'text-right ml-auto' : 'text-left'}
            `}
            style={{
                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
            }}
        >
            {text}
        </p>
    );
}

export default function Hero(props: ComponentProps) {
    const {
        title,
        subtitle,
        image_url,
        background_image,
        cta_text,
        cta_link,
        overlay_opacity = 50,
        overlay,
        height = 'large',
        alignment = 'center',
        show_search = false,
        show_buy = true,
        show_rent = true,
        show_launch = true,
        search_layout = 'tabs',
        show_location = true,
        show_property_type = true,
        show_price = true,
        show_bedrooms = true,
        show_garages = true
    } = props;

    const heroImage = background_image || image_url;
    const overlayOpacity = overlay === false ? 0 : (typeof overlay_opacity === 'number' ? overlay_opacity : 50);

    const heightClasses = {
        small: 'min-h-[400px]',
        medium: 'min-h-[600px]',
        large: 'min-h-[800px]',
        full: 'min-h-screen'
    };

    const alignClasses = {
        left: 'items-start',
        center: 'items-center',
        right: 'items-end'
    };

    return (
        <section className={`relative ${heightClasses[height as keyof typeof heightClasses] || heightClasses.large} flex items-center justify-center overflow-hidden`}>
            {/* Background Image with Parallax-ready structure */}
            <div className="absolute inset-0">
                {heroImage && (
                    <img
                        src={heroImage}
                        alt={title || 'Hero'}
                        className="w-full h-full object-cover scale-105"
                    />
                )}
                {/* Gradient Overlay for depth */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(to bottom, rgba(0,0,0,${overlayOpacity / 100 * 0.3}) 0%, rgba(0,0,0,${overlayOpacity / 100}) 50%, rgba(0,0,0,${overlayOpacity / 100 * 0.8}) 100%)`
                    }}
                />
            </div>

            {/* Content */}
            <div className="relative container mx-auto px-4 z-10 text-white w-full">
                <div className={`flex flex-col ${alignClasses[alignment as keyof typeof alignClasses] || alignClasses.center} max-w-5xl mx-auto`}>

                    {/* Premium Title */}
                    {title && <HeroTitle text={title} alignment={alignment} />}

                    {/* Animated Subtitle */}
                    {subtitle && <HeroSubtitle text={subtitle} alignment={alignment} />}

                    {/* Search Box ou CTA */}
                    <div className="animate-hero-content w-full">
                        {show_search ? (
                            <HeroSearchBox
                                showBuy={show_buy}
                                showRent={show_rent}
                                showLaunch={show_launch}
                                layout={search_layout}
                                showLocation={show_location}
                                showPropertyType={show_property_type}
                                showPrice={show_price}
                                showBedrooms={show_bedrooms}
                                showGarages={show_garages}
                            />
                        ) : (
                            cta_text && cta_link && (
                                <Link
                                    href={cta_link}
                                    className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-lg hover:opacity-90 transition-all transform hover:scale-105 shadow-2xl"
                                    style={{
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 0 60px var(--color-primary)'
                                    }}
                                >
                                    {cta_text}
                                </Link>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* CSS Animations */}
            <style jsx>{`
                @keyframes hero-title-in {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px) scale(0.95); 
                        filter: blur(10px);
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1); 
                        filter: blur(0);
                    }
                }
                @keyframes hero-subtitle-in {
                    from { 
                        opacity: 0; 
                        transform: translateY(20px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                @keyframes hero-content-in {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                :global(.animate-hero-title) {
                    animation: hero-title-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                :global(.animate-hero-subtitle) {
                    animation: hero-subtitle-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
                    opacity: 0;
                }
                :global(.animate-hero-content) {
                    animation: hero-content-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
                    opacity: 0;
                }
            `}</style>
        </section>
    );
}
