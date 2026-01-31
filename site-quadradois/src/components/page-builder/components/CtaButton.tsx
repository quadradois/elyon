/**
 * CtaButton Component
 * Agora evoluído para uma Seção de CTA completa
 */
import { ComponentProps } from '../types';
import Link from 'next/link';
import { MessageCircle, ArrowRight } from 'lucide-react';

export default function CtaButton(props: ComponentProps) {
    const {
        title, // Novo
        description, // Novo
        text = 'Saiba Mais',
        link = '#',
        whatsapp = false,
        style = 'primary', // primary, secondary, outline
        size = 'large'
    } = props;

    const sizeClasses = {
        small: 'px-6 py-2.5 text-sm',
        medium: 'px-8 py-3 text-base',
        large: 'px-10 py-4 text-lg'
    }[size as string] || 'px-10 py-4 text-lg';

    const baseClasses = "inline-flex items-center gap-2 font-bold rounded-xl transition-all transform hover:-translate-y-1";

    let styleClasses = "bg-[var(--color-primary)] text-white hover:brightness-110 shadow-lg hover:shadow-xl hover:shadow-[var(--color-primary)]/30";
    if (style === 'secondary') styleClasses = "bg-gray-900 text-white hover:bg-gray-800 shadow-lg";
    if (style === 'outline') styleClasses = "border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white";

    const href = whatsapp
        ? `https://wa.me/55${link.replace(/\D/g, '')}`
        : link;

    return (
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-4 text-center max-w-4xl">
                {title && (
                    <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                        {title}
                    </h2>
                )}

                {description && (
                    <p className="text-xl text-gray-600 mb-10 text-balance px-4">
                        {description}
                    </p>
                )}

                <Link
                    href={href}
                    target={whatsapp ? '_blank' : undefined}
                    className={`${baseClasses} ${sizeClasses} ${styleClasses}`}
                >
                    {whatsapp ? <MessageCircle className="w-5 h-5" /> : null}
                    {text}
                    {!whatsapp && <ArrowRight className="w-5 h-5 group-hover:translate-x-1" />}
                </Link>
            </div>
        </section>
    );
}
