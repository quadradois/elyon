/**
 * Stats Component
 */
import { ComponentProps } from '../types';

export default function Stats(props: ComponentProps) {
    const {
        items = [],
        background_color = 'bg-white'
    } = props;

    // Items: [{ label, value, suffix }]

    return (
        <section className={`py-20 ${background_color}`}>
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {items.map((item: any, idx: number) => (
                        <div key={idx} className="text-center p-6 border-l border-gray-100 hover:border-[var(--color-primary)] transition-colors duration-300 group">
                            <div className="text-4xl md:text-5xl font-bold text-[var(--color-primary)] mb-2 group-hover:-translate-y-1 transition-transform">
                                {item.value}{item.suffix}
                            </div>
                            <div className="text-sm text-gray-500 font-semibold uppercase tracking-wide group-hover:text-gray-900 transition-colors">
                                {item.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
