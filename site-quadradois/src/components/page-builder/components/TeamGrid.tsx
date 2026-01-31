/**
 * TeamGrid Component
 * Exibe lista de membros da equipe (agentes)
 */
import { ComponentProps } from '../types';
import Image from 'next/image';
import { Mail, Phone, Instagram, Linkedin } from 'lucide-react';

export default function TeamGrid(props: ComponentProps) {
    const {
        title = 'Nosso Time',
        subtitle = 'Conheça nossos especialistas prontos para atendê-lo',
        items = [],
        columns = 4,
        source = 'dynamic' // 'dynamic' | 'manual'
    } = props;

    // Se source for 'manual', usa os items passados no prop.
    // Se for 'dynamic', idealmente deveria fazer um fetch ou receber do backend ja populado.
    // Como o backend atualmente deve estar enviando 'items' vazio para dynamic (ou não populando),
    // vamos manter o fallback visual APENAS se não houver items e for manual, ou lidar com o dynamic mock.

    // Nota: Em uma implementação real completa, o 'dynamic' faria um fetch client-side ou receberia server-side.
    // Para este MVP, vamos assumir que se for dynamic e items estiver vazio, mostramos o fallback "Exemplo".
    // Se for manual, mostramos o que vier em items.

    let displayItems = items;

    if (source === 'manual') {
        // Se manual e vazio, mostra 1 placeholder para o usuário não ver "vazio"
        if (!displayItems || displayItems.length === 0) {
            displayItems = [
                { name: 'Nome do Corretor', role: 'Cargo', bio: 'Bio do corretor...', photo: '' }
            ];
        }
    } else {
        // Dynamic Mode
        // Se vier vazio (backend não populou), usamos os dados de exemplo "Premium" para não quebrar o layout
        if (!displayItems || displayItems.length === 0) {
            displayItems = [
                { name: 'Ricardo Silva', role: 'Diretor Comercial', photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80', phone: '(11) 99999-9999' },
                { name: 'Ana Paula', role: 'Especialista em Alto Padrão', photo: 'https://images.unsplash.com/photo-1573496359-1506dca09c76?auto=format&fit=crop&q=80', phone: '(11) 88888-8888' },
                { name: 'Carlos Mendes', role: 'Consultor de Investimentos', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80', phone: '(11) 77777-7777' },
                { name: 'Juliana Costa', role: 'Gerente de Locação', photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80', phone: '(11) 66666-6666' }
            ];
        }
    }

    return (
        <section className="py-20 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    {title && (
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h2>
                    )}
                    {subtitle && (
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {displayItems.map((member: any, idx: number) => (
                        <div key={idx} className="group relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                            <div className="aspect-[3/4] relative bg-gray-100 overflow-hidden">
                                <Image
                                    src={member.photo || `https://ui-avatars.com/api/?name=${member.name}&background=random`}
                                    alt={member.name}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                    <div className="flex gap-4 justify-center text-white">
                                        {member.phone && <a href="#" className="hover:text-[var(--color-primary)] transition-colors"><Phone className="w-5 h-5" /></a>}
                                        {member.email && <a href="#" className="hover:text-[var(--color-primary)] transition-colors"><Mail className="w-5 h-5" /></a>}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 text-center">
                                <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
                                <p className="text-[var(--color-primary)] font-medium text-sm uppercase tracking-wider">{member.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
