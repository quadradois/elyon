'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { Check, TrendingDown, Bell, BellOff, Sparkles, ArrowRight, Users, Shield } from 'lucide-react';

interface PriceSectionProps {
    minPrice: number;
    maxPrice?: number;
    tipologias: any[];
    primaryColor: string;
    launchName: string;
    whatsapp?: string;
}

// Animated counter component
function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });
    const spring = useSpring(0, { duration: duration * 1000 });
    const display = useTransform(spring, (current) =>
        new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Math.floor(current))
    );

    useEffect(() => {
        if (isInView) {
            spring.set(value);
        }
    }, [isInView, spring, value]);

    return <motion.span ref={ref}>{display}</motion.span>;
}

export default function PriceSection({
    minPrice,
    maxPrice,
    tipologias,
    primaryColor,
    launchName,
    whatsapp
}: PriceSectionProps) {
    const [priceAlertEnabled, setPriceAlertEnabled] = useState(false);
    const [selectedTipologia, setSelectedTipologia] = useState(0);
    const [interestedCount] = useState(() => Math.floor(Math.random() * 15) + 8);

    const currentTipologia = tipologias[selectedTipologia];
    const displayPrice = currentTipologia?.preco_de || minPrice;

    const handleSimularFinanciamento = () => {
        if (!whatsapp) return;
        const cleanPhone = whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(`Olá! Gostaria de simular o financiamento do ${launchName}`);
        window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    };

    const handleAgendarVisita = () => {
        const ctaSection = document.getElementById('cta-receive-book');
        if (ctaSection) {
            ctaSection.scrollIntoView({ behavior: 'smooth' });
        } else if (whatsapp) {
            const cleanPhone = whatsapp.replace(/\D/g, '');
            const message = encodeURIComponent(`Olá! Gostaria de agendar uma visita ao ${launchName}`);
            window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
        }
    };

    return (
        <section className="relative py-24 overflow-hidden">
            {/* Premium Background */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50 to-white" />
                <div
                    className="absolute top-0 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-10"
                    style={{ background: primaryColor }}
                />
                <div
                    className="absolute bottom-0 right-1/3 w-96 h-96 rounded-full blur-3xl opacity-10"
                    style={{ background: primaryColor }}
                />
                {/* Decorative grid */}
                <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`,
                        backgroundSize: '60px 60px'
                    }}
                />
            </div>

            <div className="container-site relative z-10">
                <div className="max-w-5xl mx-auto">
                    {/* Main Price Card */}
                    <motion.div
                        className="relative bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl border border-gray-100 overflow-hidden"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        {/* Shine effect */}
                        <div
                            className="absolute top-0 left-0 right-0 h-1 opacity-50"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`
                            }}
                        />

                        {/* Social proof badge */}
                        <motion.div
                            className="absolute top-6 right-6 hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                        >
                            <Users className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">
                                {interestedCount} pessoas interessadas hoje
                            </span>
                        </motion.div>

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                            {/* Price Display */}
                            <div className="flex-1">
                                {/* Label with verification */}
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                        A partir de
                                    </span>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-full border border-green-100">
                                        <Shield className="w-4 h-4 text-green-600" />
                                        <span className="text-xs font-bold text-green-700 uppercase tracking-wider">
                                            Preço Verificado
                                        </span>
                                    </div>
                                </div>

                                {/* Animated Price */}
                                <div className="relative mb-4">
                                    <h3 className="text-5xl md:text-6xl lg:text-7xl font-black">
                                        <span
                                            className="bg-clip-text text-transparent"
                                            style={{
                                                backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -40)} 100%)`
                                            }}
                                        >
                                            <AnimatedCounter value={displayPrice} />
                                        </span>
                                    </h3>
                                    {/* Glow effect */}
                                    <div
                                        className="absolute -inset-4 rounded-xl opacity-20 blur-2xl -z-10"
                                        style={{ background: primaryColor }}
                                    />
                                </div>

                                {maxPrice && maxPrice > minPrice && (
                                    <p className="text-gray-500 mb-6">
                                        Valores de <strong>{formatPrice(minPrice)}</strong> a <strong>{formatPrice(maxPrice)}</strong>
                                    </p>
                                )}

                                {/* Tipologia Selector */}
                                {tipologias.length > 1 && (
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {tipologias.map((tip, index) => (
                                            <motion.button
                                                key={tip.id}
                                                onClick={() => setSelectedTipologia(index)}
                                                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${selectedTipologia === index
                                                        ? 'text-white shadow-lg'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                style={selectedTipologia === index ? {
                                                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
                                                    boxShadow: `0 8px 20px ${primaryColor}40`
                                                } : {}}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                {tip.quartos} {tip.quartos === 1 ? 'Quarto' : 'Quartos'} • {tip.area_privativa}m²
                                            </motion.button>
                                        ))}
                                    </div>
                                )}

                                {/* Price Alert Toggle */}
                                <motion.div
                                    className="inline-flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 cursor-pointer group hover:shadow-lg transition-all"
                                    onClick={() => setPriceAlertEnabled(!priceAlertEnabled)}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    <motion.div
                                        className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${priceAlertEnabled ? 'shadow-lg' : 'bg-white shadow-sm'
                                            }`}
                                        style={priceAlertEnabled ? {
                                            background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`
                                        } : {}}
                                        animate={priceAlertEnabled ? { scale: [1, 1.1, 1] } : {}}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {priceAlertEnabled ? (
                                            <Bell className="w-5 h-5 text-white" />
                                        ) : (
                                            <BellOff className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                                        )}
                                    </motion.div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900">
                                            Alerta de Preço
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {priceAlertEnabled ? '✓ Notificações ativadas' : 'Seja avisado se o preço mudar'}
                                        </p>
                                    </div>
                                    <div
                                        className={`w-14 h-7 rounded-full transition-all p-0.5 ${priceAlertEnabled ? '' : 'bg-gray-200'
                                            }`}
                                        style={priceAlertEnabled ? {
                                            background: `linear-gradient(90deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -20)} 100%)`
                                        } : {}}
                                    >
                                        <motion.div
                                            className="w-6 h-6 bg-white rounded-full shadow-md"
                                            animate={{ x: priceAlertEnabled ? 26 : 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    </div>
                                </motion.div>
                            </div>

                            {/* CTA Section */}
                            <div className="flex-shrink-0 lg:w-80 space-y-4">
                                <motion.button
                                    onClick={handleSimularFinanciamento}
                                    className="w-full group relative px-8 py-5 rounded-2xl font-bold text-lg text-white shadow-xl overflow-hidden"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -40)} 100%)`
                                    }}
                                    whileHover={{ scale: 1.02, boxShadow: `0 20px 40px ${primaryColor}50` }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {/* Shine animation */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity">
                                        <motion.div
                                            className="absolute inset-0"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)',
                                            }}
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                                        />
                                    </div>
                                    <span className="relative flex items-center justify-center gap-3">
                                        <TrendingDown className="w-5 h-5" />
                                        Simular Financiamento
                                    </span>
                                </motion.button>

                                <motion.button
                                    onClick={handleAgendarVisita}
                                    className="w-full group px-8 py-5 rounded-2xl font-bold text-lg border-2 transition-all hover:shadow-lg"
                                    style={{
                                        borderColor: primaryColor,
                                        color: primaryColor
                                    }}
                                    whileHover={{ scale: 1.02, backgroundColor: `${primaryColor}08` }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="flex items-center justify-center gap-3">
                                        Agendar Visita
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </motion.button>

                                {whatsapp && (
                                    <a
                                        href={`https://wa.me/55${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse no ${launchName}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full px-8 py-3 text-center text-sm font-semibold transition-all hover:underline"
                                        style={{ color: primaryColor }}
                                    >
                                        Falar no WhatsApp →
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <p className="text-xs text-gray-400 mt-8 text-center">
                            *Preços sujeitos à confirmação de disponibilidade. Condições podem ser alteradas sem aviso prévio.
                        </p>
                    </motion.div>

                    {/* Features Pills */}
                    {currentTipologia && (
                        <motion.div
                            className="flex flex-wrap justify-center gap-3 mt-8"
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="px-5 py-3 bg-white rounded-2xl shadow-lg border border-gray-100">
                                <span className="text-sm font-bold text-gray-800">
                                    🛏️ {currentTipologia.quartos} {currentTipologia.quartos === 1 ? 'Quarto' : 'Quartos'}
                                </span>
                            </div>
                            <div className="px-5 py-3 bg-white rounded-2xl shadow-lg border border-gray-100">
                                <span className="text-sm font-bold text-gray-800">
                                    📐 {currentTipologia.area_privativa}m²
                                </span>
                            </div>
                            {currentTipologia.suites > 0 && (
                                <div className="px-5 py-3 bg-white rounded-2xl shadow-lg border border-gray-100">
                                    <span className="text-sm font-bold text-gray-800">
                                        🚿 {currentTipologia.suites} {currentTipologia.suites === 1 ? 'Suíte' : 'Suítes'}
                                    </span>
                                </div>
                            )}
                            {currentTipologia.vagas > 0 && (
                                <div className="px-5 py-3 bg-white rounded-2xl shadow-lg border border-gray-100">
                                    <span className="text-sm font-bold text-gray-800">
                                        🚗 {currentTipologia.vagas} {currentTipologia.vagas === 1 ? 'Vaga' : 'Vagas'}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            </div>
        </section>
    );
}

// Helper functions
function formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);
}

function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
