'use client';

import { useState } from 'react';
import { FileText, Send, Check } from 'lucide-react';

interface CTAReceiveBookProps {
    launchName: string;
    logoUrl?: string;
    primaryColor: string;
    whatsapp?: string;
}

export default function CTAReceiveBook({
    launchName,
    logoUrl,
    primaryColor,
    whatsapp
}: CTAReceiveBookProps) {
    const [formData, setFormData] = useState({ name: '', phone: '' });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Send to WhatsApp
        if (whatsapp && formData.name && formData.phone) {
            const cleanPhone = whatsapp.replace(/\D/g, '');
            const message = encodeURIComponent(
                `Olá! Sou ${formData.name} (${formData.phone}). Gostaria de receber o book completo do ${launchName}.`
            );
            window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
        }

        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
    };

    return (
        <section
            id="cta-receive-book"
            className="relative py-24 overflow-hidden"
            style={{
                background: `linear-gradient(135deg, ${primaryColor}15 0%, transparent 50%, ${primaryColor}10 100%)`
            }}
        >
            {/* Pattern Background */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `
                        radial-gradient(circle at 20px 20px, ${primaryColor} 2px, transparent 0),
                        radial-gradient(circle at 80px 80px, ${primaryColor} 2px, transparent 0)
                    `,
                    backgroundSize: '100px 100px'
                }}
            />

            <div className="container-site relative z-10">
                <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    {/* Left Side - Visual */}
                    <div className="text-center md:text-left space-y-6">
                        {logoUrl && (
                            <div className="inline-block p-6 bg-white rounded-3xl shadow-xl">
                                <img
                                    src={logoUrl}
                                    alt={`Logo ${launchName}`}
                                    className="h-24 w-auto"
                                />
                            </div>
                        )}

                        <div>
                            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                                Receba o{' '}
                                <span
                                    className="bg-clip-text text-transparent bg-gradient-to-r"
                                    style={{
                                        backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, #000 100%)`
                                    }}
                                >
                                    book completo
                                </span>
                            </h2>
                            <p className="text-lg text-gray-600 leading-relaxed">
                                Receba todas as plantas, preços e condições de pagamento diretamente no seu WhatsApp em segundos.
                            </p>
                        </div>

                        {/* Features */}
                        <div className="space-y-3">
                            {['Plantas detalhadas', 'Tabela de preços atualizada', 'Condições especiais'].map((feature, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${primaryColor}20` }}
                                    >
                                        <Check className="w-4 h-4" style={{ color: primaryColor }} />
                                    </div>
                                    <span className="text-gray-700">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side - Form */}
                    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100">
                        {!submitted ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Urgency Badge */}
                                <div className="flex items-center justify-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 mb-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    <span className="text-sm font-semibold text-red-700">
                                        🔥 Alta demanda - Últimas unidades
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Seu nome
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Digite seu nome"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Telefone/WhatsApp
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(00) 00000-0000"
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-gray-900 focus:outline-none transition-colors"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 rounded-xl font-bold text-white shadow-xl hover:shadow-2xl hover:scale-105 transform transition-all duration-300 flex items-center justify-center gap-2"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor} 0%, #000 100%)`
                                    }}
                                >
                                    <Send className="w-5 h-5" />
                                    <span>Garantir meu book agora</span>
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    ⚡ Resposta em menos de 2 minutos
                                </p>
                            </form>
                        ) : (
                            <div className="py-12 text-center">
                                <div
                                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}40 100%)`
                                    }}
                                >
                                    <Check className="w-8 h-8 animate-bounce" style={{ color: primaryColor }} />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                    Tudo certo!
                                </h3>
                                <p className="text-gray-600">
                                    Você foi redirecionado para o WhatsApp
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
