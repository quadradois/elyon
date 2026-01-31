/**
 * FAQ Component
 */
import { ComponentProps } from '../types';
import { ChevronDown } from 'lucide-react';

export default function Faq(props: ComponentProps) {
    const {
        title = 'Perguntas Frequentes',
        items = []
    } = props;

    return (
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4 max-w-3xl">
                {title && (
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
                    </div>
                )}

                <div className="space-y-4">
                    {items.map((item: any, idx: number) => (
                        <details key={idx} className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <summary className="flex items-center justify-between p-6 cursor-pointer font-semibold text-lg text-gray-900 group-hover:text-[var(--color-primary)] transition-colors list-none">
                                {item.question}
                                <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="px-6 pb-6 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                                {item.answer}
                            </div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
