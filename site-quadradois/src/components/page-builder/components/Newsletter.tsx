/**
 * Newsletter Component
 */
'use client';
import { ComponentProps } from '../types';
import { Mail } from 'lucide-react';
import { useState } from 'react';

export default function Newsletter(props: ComponentProps) {
    const {
        title = 'Assine nossa newsletter',
        subtitle = 'Receba novidades e ofertas exclusivas no seu email.',
        button_text = 'Inscrever-se'
    } = props;

    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        // Simulação de envio
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStatus('success');
        setEmail('');
    };

    return (
        <section className="py-20 bg-[var(--color-primary)] text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="container mx-auto px-4 text-center relative z-10">
                <Mail className="w-12 h-12 mx-auto mb-6 opacity-80" />

                <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
                <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">{subtitle}</p>

                {status === 'success' ? (
                    <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg inline-block animate-fade-in">
                        ✅ Obrigado por se inscrever!
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
                        <input
                            type="email"
                            required
                            placeholder="Seu melhor email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex-grow px-6 py-4 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-white/50"
                        />
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="px-8 py-4 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            {status === 'loading' ? 'Enviando...' : button_text}
                        </button>
                    </form>
                )}
            </div>
        </section>
    );
}
