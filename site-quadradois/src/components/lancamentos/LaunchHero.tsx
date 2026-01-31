'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, FileText, Flame } from 'lucide-react';

interface LaunchHeroProps {
    title: string;
    subtitle?: string;
    image: string;
    video?: string;
    status: string;
    primaryColor: string;
    whatsapp?: string;
    launchName?: string;
    unidadesDisponiveis?: number;
}

export default function LaunchHero({
    title,
    subtitle,
    image,
    video,
    status,
    primaryColor,
    whatsapp,
    launchName,
    unidadesDisponiveis
}: LaunchHeroProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Reset error state when image determines changes
    useEffect(() => {
        setImageError(false);
        setImageLoaded(false);
    }, [image]);

    const hasValidImage = image && image.trim() !== '' && !imageError;

    const handleWhatsApp = () => {
        if (!whatsapp) return;
        const cleanPhone = whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(`Olá! Tenho interesse no ${launchName || title}. Gostaria de mais informações.`);
        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    };

    const handleVerValores = () => {
        // Scroll to CTA form section
        const ctaSection = document.getElementById('cta-receive-book');
        if (ctaSection) {
            ctaSection.scrollIntoView({ behavior: 'smooth' });
        } else if (whatsapp) {
            handleWhatsApp();
        }
    };

    return (
        <section className="relative h-screen min-h-[600px] flex items-end overflow-hidden">
            {/* Layer 1: Fallback gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black z-0" />

            {/* Layer 2: Image or Video */}
            {video ? (
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={image}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                >
                    <source src={video} type="video/mp4" />
                </video>
            ) : hasValidImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={image}
                    alt={title}
                    className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={(e) => {
                        console.error('LaunchHero Image Load Error:', image, e);
                        setImageError(true);
                    }}
                />
            )}

            {/* Layer 3: Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />

            {/* Layer 4: Content */}
            <motion.div
                className="relative z-10 container-site pb-16 md:pb-24"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                {/* Status + Urgency Badges */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <motion.span
                        className="inline-block px-4 py-2 text-sm font-bold text-white rounded-full uppercase tracking-wider shadow-lg"
                        style={{ backgroundColor: primaryColor }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {status}
                    </motion.span>

                    {/* Urgency Badge */}
                    {unidadesDisponiveis && unidadesDisponiveis <= 20 && (
                        <motion.span
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-full bg-red-500/90 backdrop-blur-sm shadow-lg"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Flame className="w-4 h-4 animate-pulse" />
                            {unidadesDisponiveis <= 5
                                ? `Últimas ${unidadesDisponiveis} unidades!`
                                : `Apenas ${unidadesDisponiveis} unidades restantes`
                            }
                        </motion.span>
                    )}
                </div>

                <motion.h1
                    className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    {title}
                </motion.h1>
                {subtitle && (
                    <motion.p
                        className="text-lg md:text-2xl text-white/90 mb-8 max-w-3xl"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        {subtitle}
                    </motion.p>
                )}

                {/* CTA Buttons */}
                <motion.div
                    className="flex flex-col sm:flex-row gap-4 mt-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    {whatsapp && (
                        <button
                            onClick={handleWhatsApp}
                            className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-white shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
                            style={{
                                background: `linear-gradient(135deg, ${primaryColor} 0%, #000 100%)`
                            }}
                        >
                            <Phone className="w-5 h-5 group-hover:animate-pulse" />
                            <span>Falar com Corretor</span>
                        </button>
                    )}
                    <button
                        onClick={handleVerValores}
                        className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold border-2 border-white/80 text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 transform hover:scale-105 transition-all duration-300"
                    >
                        <FileText className="w-5 h-5" />
                        <span>Ver Valores e Plantas</span>
                    </button>
                </motion.div>
            </motion.div>
        </section>
    );
}
