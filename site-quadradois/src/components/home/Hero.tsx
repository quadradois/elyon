import Image from 'next/image';
import Link from 'next/link';
import type { SiteConfig, Branding } from '@/lib/api';

interface HeroProps {
    config: SiteConfig | null;
    branding: Branding | null;
}

export default function Hero({ config, branding }: HeroProps) {
    const title = config?.hero_title || 'Encontre o imóvel dos seus sonhos';
    const subtitle = config?.hero_subtitle || 'Os melhores imóveis da região, com atendimento personalizado.';
    const ctaText = config?.hero_cta_text || 'Ver Imóveis';
    const ctaLink = config?.hero_cta_link || '/imoveis';
    const heroImage = config?.hero_image_url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80';

    return (
        <section className="relative min-h-[80vh] flex items-center">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src={heroImage}
                    alt="Hero"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
            </div>

            {/* Content */}
            <div className="container-site relative z-10">
                <div className="max-w-2xl">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fadeIn">
                        {title}
                    </h1>
                    <p className="text-lg md:text-xl text-gray-200 mb-8 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
                        {subtitle}
                    </p>
                    <div className="flex flex-wrap gap-4 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
                        <Link
                            href={ctaLink}
                            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-lg transition-all hover:opacity-90 hover:scale-105"
                            style={{ backgroundColor: branding?.primary_color || '#0ea5e9' }}
                        >
                            {ctaText}
                        </Link>
                        <Link
                            href="/lancamentos"
                            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 rounded-lg backdrop-blur-sm transition-all hover:bg-white/10"
                        >
                            Ver Lançamentos
                        </Link>
                    </div>
                </div>
            </div>

            {/* Search Box (Optional - pode descomentar depois) */}
            {/* 
            <div className="absolute bottom-0 left-0 right-0 z-10">
                <div className="container-site pb-8">
                    <div className="bg-white rounded-xl shadow-xl p-4 md:p-6">
                        <PropertySearchBox />
                    </div>
                </div>
            </div>
            */}
        </section>
    );
}
