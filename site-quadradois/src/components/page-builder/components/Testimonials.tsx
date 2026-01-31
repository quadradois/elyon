/**
 * Testimonials Component
 */
import { ComponentProps } from '../types';
import { Star, Quote } from 'lucide-react';

export default function Testimonials(props: ComponentProps) {
    const {
        title = 'O que dizem sobre nós',
        items = [],
        layout = 'slider'
    } = props;

    // Items esperados: [{ name, role, content, avatar, rating }]

    // Fallback data se vazio
    const testimonials = items.length > 0 ? items : [
        { name: 'Cliente Satisfeito', role: 'Comprador', content: 'Excelente atendimento!', rating: 5 }
    ];

    return (
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4">
                {title && (
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((item: any, idx: number) => (
                        <div key={idx} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                            <Quote className="w-10 h-10 text-[var(--color-primary)] opacity-20 mb-6" />

                            <p className="text-gray-600 mb-6 flex-grow italic">
                                "{item.content}"
                            </p>

                            <div className="flex items-center gap-4 mt-auto">
                                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                                    {item.avatar ? (
                                        <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-xl">
                                            {item.name[0]}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                                    <p className="text-xs text-gray-500">{item.role}</p>
                                </div>
                                <div className="ml-auto flex gap-1">
                                    {[...Array(item.rating || 5)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
