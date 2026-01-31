/**
 * MissionVisionValues Component
 * Grid de Cards com efeito Glassmorphism para os pilares da empresa.
 */
import { ComponentProps } from '../types';
import { Target, Eye, Heart } from 'lucide-react';

export default function MissionVisionValues(props: ComponentProps) {
    const {
        mission_text = 'Nossa missão é transformar o mercado imobiliário com transparência e tecnologia.',
        vision_text = 'Ser a imobiliária referência em inovação e atendimento humanizado na região.',
        values_text = 'Ética, Transparência, Inovação, Foco no Cliente e Resultados.',
        layout_style = 'cards' // cards, minimal
    } = props;

    const cards = [
        {
            title: 'Missão',
            icon: Target,
            text: mission_text,
            color: 'text-blue-400'
        },
        {
            title: 'Visão',
            icon: Eye,
            text: vision_text,
            color: 'text-purple-400'
        },
        {
            title: 'Valores',
            icon: Heart,
            text: values_text,
            color: 'text-pink-400'
        }
    ];

    return (
        <section className="py-24 bg-gray-50 relative overflow-hidden">
            {/* Ambient Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-[var(--color-primary)]/5 rounded-full blur-3xl" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {cards.map((card, idx) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={idx}
                                className="group relative bg-white/80 backdrop-blur-sm border border-white/20 p-10 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
                            >
                                <div className={`w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-8 group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors duration-500`}>
                                    <Icon className={`w-8 h-8 ${card.color} group-hover:text-white transition-colors`} />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">{card.title}</h3>
                                <p className="text-gray-600 leading-relaxed text-lg">
                                    {card.text}
                                </p>

                                {/* Bottom Decoration */}
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
