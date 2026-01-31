/**
 * ContactForm Component
 */
'use client'; // Client component para interatividade

import { useState } from 'react';
import { ComponentProps } from '../types';
import { submitContact } from '@/lib/api';

import { Loader2 } from 'lucide-react';

// Precisamos injetar o tenantId de alguma forma, talvez via Context ou props
// Por simplificação, vamos assumir que o PageRenderer pode passar isso, 
// ou vamos pegar de um Provider global. 
// Mas como estamos no app router, podemos passar via props no server component.

export default function ContactForm(props: ComponentProps & { tenantId?: number }) {
    const {
        title = 'Fale Conosco',
        subtitle = 'Preencha o formulário abaixo e entraremos em contato.',
        button_text = 'Enviar Mensagem',
        tenantId
    } = props;

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!tenantId) {
            setError('Configuração inválida (Tenant ID ausente)');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const data = {
            tenant_id: tenantId,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            message: formData.get('message') as string,
        };

        const result = await submitContact(data);

        if (result.success) {
            setSuccess(true);
            (e.target as HTMLFormElement).reset();
        } else {
            setError(result.message || 'Erro ao enviar mensagem');
        }

        setLoading(false);
    };

    return (
        <section className="py-16 bg-white">
            <div className="container mx-auto px-4 max-w-2xl">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
                    <p className="text-gray-600">{subtitle}</p>
                </div>

                <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 shadow-sm">
                    {success ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                ✓
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Mensagem Enviada!</h3>
                            <p className="text-gray-600">
                                Obrigado pelo contato. Responderemos o mais breve possível.
                            </p>
                            <button
                                onClick={() => setSuccess(false)}
                                className="mt-6 text-[var(--color-primary)] font-medium hover:underline"
                            >
                                Enviar outra mensagem
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all"
                                    placeholder="Seu nome completo"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                                <textarea
                                    name="message"
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none transition-all"
                                    placeholder="Olá, gostaria de saber mais sobre..."
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-[var(--color-primary)] text-white font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {button_text}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
