/**
 * Partners Component
 */
import { ComponentProps } from '../types';

export default function Partners(props: ComponentProps) {
    const {
        title,
        logos = [],
        items = [], // Suporte a lista de objetos do Editor
        grayscale = true
    } = props;

    // Normalizar items para garantir compatibilidade
    // Se vier do editor (items), map para logos. Se vier legado (logos), usa direto.
    const normalizedItems = items.length > 0
        ? items.map((item: any) => ({ src: item.image, alt: item.name || 'Parceiro' }))
        : logos.map((logo: string) => ({ src: logo, alt: 'Parceiro' }));

    return (
        <section className="py-16 bg-white border-t border-gray-100">
            <div className="container mx-auto px-4">
                {title && (
                    <p className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-10">
                        {title}
                    </p>
                )}

                <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-70">
                    {normalizedItems.map((item: any, idx: number) => (
                        <div key={idx} className={`w-32 md:w-40 transition-all hover:opacity-100 ${grayscale ? 'grayscale hover:grayscale-0' : ''}`}>
                            <img
                                src={item.src}
                                alt={item.alt}
                                className="w-full h-auto object-contain"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
