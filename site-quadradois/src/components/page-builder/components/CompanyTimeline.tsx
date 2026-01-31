/**
 * CompanyTimeline Component
 * Linha do tempo vertical para narrar a evolução da empresa.
 */
'use client';

import { ComponentProps } from '../types';
import { useRef } from 'react';

export default function CompanyTimeline(props: ComponentProps) {
    const {
        items = [], // Array de { year, title, description }
        line_color = 'primary' // 'primary' | 'gray'
    } = props;

    // Mock items se estiver vazio (apenas para preview)
    const timelineItems = items.length > 0 ? items : [
        { year: '2014', title: 'O Início', description: 'Fundação da empresa em um pequeno escritório no centro.' },
        { year: '2016', title: 'Expansão', description: 'Abertura da segunda filial e crescimento de 200%.' },
        { year: '2019', title: 'Digitalização', description: 'Lançamento da plataforma digital proprietária.' },
        { year: '2023', title: 'Liderança', description: 'Reconhecida como a imobiliária número 1 da região.' }
    ];

    return (
        <section className="py-24 bg-white overflow-hidden">
            <div className="container mx-auto px-4 relative">
                {/* Linha Central Vertical */}
                <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-gray-200" />

                <div className="space-y-20">
                    {timelineItems.map((item: any, idx: number) => {
                        const isEven = idx % 2 === 0;
                        return (
                            <div key={idx} className={`relative flex items-center justify-between ${isEven ? 'flex-row' : 'flex-row-reverse'}`}>
                                {/* Conteúdo */}
                                <div className={`w-5/12 ${isEven ? 'text-right pr-12' : 'text-left pl-12'}`}>
                                    <div
                                        className="inline-block px-4 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm mb-4"
                                    >
                                        {item.year}
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>

                                {/* Dot Central */}
                                <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-[var(--color-primary)] ring-4 ring-white shadow-lg z-10" />

                                {/* Espaço Vazio (Balance) */}
                                <div className="w-5/12" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
