'use client';

import { useState, useEffect } from 'react';
import { Phone, Calendar } from 'lucide-react';

interface StickyPriceBarProps {
    price: number;
    launchName: string;
    primaryColor: string;
    whatsapp?: string;
}

export default function StickyPriceBar({
    price,
    launchName,
    primaryColor,
    whatsapp
}: StickyPriceBarProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling 800px
            setIsVisible(window.scrollY > 800);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    const handleWhatsApp = () => {
        if (!whatsapp) return;
        const cleanPhone = whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(`Olá! Tenho interesse no ${launchName}`);
        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 transform transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                }`}
        >
            {/* Glassmorphism Bar */}
            <div className="bg-white/90 backdrop-blur-xl border-t border-white/20 shadow-2xl">
                <div className="container-site">
                    <div className="flex items-center justify-between gap-4 py-4">
                        {/* Price Info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                A partir de
                            </p>
                            <p
                                className="text-2xl md:text-3xl font-bold truncate bg-clip-text text-transparent bg-gradient-to-r"
                                style={{
                                    backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, #000 100%)`
                                }}
                            >
                                {formatPrice(price)}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleWhatsApp}
                                className="hidden md:flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor} 0%, #000 100%)`
                                }}
                            >
                                <Phone className="w-5 h-5" />
                                <span>Falar no WhatsApp</span>
                            </button>

                            <button
                                onClick={() => {
                                    const ctaSection = document.getElementById('cta-receive-book');
                                    if (ctaSection) {
                                        ctaSection.scrollIntoView({ behavior: 'smooth' });
                                    } else if (whatsapp) {
                                        const cleanPhone = whatsapp.replace(/\D/g, '');
                                        const message = encodeURIComponent(`Olá! Gostaria de agendar uma visita ao ${launchName}`);
                                        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
                                    }
                                }}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 bg-white hover:bg-gray-50 transition-all duration-300"
                                style={{
                                    borderColor: primaryColor,
                                    color: primaryColor
                                }}
                            >
                                <Calendar className="w-5 h-5" />
                                <span className="hidden sm:inline">Agendar Visita</span>
                                <span className="sm:hidden">Visita</span>
                            </button>

                            {/* Mobile WhatsApp Button */}
                            <button
                                onClick={handleWhatsApp}
                                className="md:hidden p-3 rounded-xl text-white shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${primaryColor} 0%, #000 100%)`
                                }}
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Animated Glow Effect */}
            <div
                className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50 animate-pulse"
                style={{ color: primaryColor }}
            />
        </div>
    );
}
