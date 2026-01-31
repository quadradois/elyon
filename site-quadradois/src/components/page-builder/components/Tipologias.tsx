/**
 * Tipologias Component
 */
import React from 'react';
import { ComponentProps } from '../types';
import { Bed, Bath, Ruler, Check } from 'lucide-react';

export default function Tipologias(props: ComponentProps) {
    const {
        lancamento_id,
        show_price = true,
        show_availability = true
    } = props;

    // Mock Data
    const items = [
        {
            name: "Studio Garden",
            area: "45m²",
            suites: 1,
            price: "R$ 450.000",
            image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=800",
            features: ["Quintal Privativo", "Pé direito duplo", "Automação"]
        },
        {
            name: "Apartamento Tipo",
            area: "78m²",
            suites: 2,
            price: "R$ 780.000",
            image: "https://images.unsplash.com/photo-1502005229762-cf1afd349398?auto=format&fit=crop&q=80&w=800",
            features: ["Varanda Gourmet", "Vista Mar", "2 Vagas"]
        },
        {
            name: "Duplex Premium",
            area: "140m²",
            suites: 3,
            price: "R$ 1.500.000",
            image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
            features: ["Penthouse", "Piscina Privativa", "3 Vagas"]
        }
    ];

    return (
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Tipologias</h2>
                    <p className="text-gray-600">Escolha a planta ideal para seu estilo de vida</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow group">
                            <div className="relative h-64 overflow-hidden">
                                <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-900">
                                    {item.area}
                                </div>
                            </div>

                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.name}</h3>

                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                                    <div className="flex items-center gap-1">
                                        <Bed className="w-4 h-4" />
                                        <span>{item.suites} Suítes</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Ruler className="w-4 h-4" />
                                        <span>{item.area}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    {item.features.map((feat, fIdx) => (
                                        <div key={fIdx} className="flex items-center gap-2 text-sm text-gray-600">
                                            <Check className="w-3.5 h-3.5 text-green-500" />
                                            {feat}
                                        </div>
                                    ))}
                                </div>

                                {show_price && (
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                        <div>
                                            <span className="text-xs text-gray-500 block">A partir de</span>
                                            <span className="text-lg font-bold text-[var(--color-primary)]">{item.price}</span>
                                        </div>
                                        <button className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:brightness-90 transition-all">
                                            Ver Planta
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
