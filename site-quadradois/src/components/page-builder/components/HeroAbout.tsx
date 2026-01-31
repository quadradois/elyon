/**
 * HeroAbout Component
 * Hero minimalista focado em branding e narrativa para a página Sobre.
 */
import { ComponentProps } from '../types';
import Link from 'next/link';

export default function HeroAbout(props: ComponentProps) {
    const {
        title = 'Nossa História',
        subtitle = 'Conectando pessoas a lares extraordinários.',
        background_image,
        overlay_opacity = 60,
        height = 'medium',
        breadcrumb_label = 'Sobre'
    } = props;

    // Height mapping
    const heightClasses = {
        small: 'min-h-[400px]',
        medium: 'min-h-[500px]',
        large: 'min-h-[700px]'
    };

    return (
        <section className={`relative ${heightClasses[height as keyof typeof heightClasses] || heightClasses.medium} flex items-center justify-center overflow-hidden`}>
            {/* Background */}
            <div className="absolute inset-0 z-0">
                {background_image && (
                    <img
                        src={background_image}
                        alt={title}
                        className="w-full h-full object-cover"
                    />
                )}
                <div
                    className="absolute inset-0 bg-black/50"
                    style={{ opacity: (typeof overlay_opacity === 'number' ? overlay_opacity : 60) / 100 }}
                />
            </div>

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 text-center">
                {/* Breadcrumb / Label */}
                <div className="flex justify-center mb-6">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium tracking-wide uppercase">
                        <Link href="/" className="hover:text-white/80 transition-colors">Início</Link>
                        <span className="opacity-50">/</span>
                        <span>{breadcrumb_label}</span>
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight drop-shadow-lg">
                    {title}
                </h1>

                {/* Subtitle */}
                {subtitle && (
                    <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-light leading-relaxed drop-shadow-md">
                        {subtitle}
                    </p>
                )}
            </div>
        </section>
    );
}
