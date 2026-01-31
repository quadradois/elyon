/**
 * LaunchHero Component - Premium Carousel
 * Carrossel fullscreen de lançamentos com busca automática e design Liquid Glass
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ComponentProps } from '../types';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MapPin, Bed, Building2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tipologia {
    id: number;
    nome: string;
    quartos: number | null;
    suites: number | null;
    vagas: number | null;
    area_privativa: number | null;
}

interface Lancamento {
    id: number;
    slug: string;
    nome: string;
    descricao: string | null;
    construtora: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    previsao_entrega: string | null;
    status: string;
    imagem_hero: string | null;
    logo_empreendimento: string | null;
    tipologias: Tipologia[];
}

export default function LaunchHero(props: ComponentProps) {
    const {
        autoplay = true,
        autoplay_interval = 6000,
        show_logo = true,
        show_navigation = true,
        tenantId
    } = props;

    const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    // Fetch lancamentos
    useEffect(() => {
        const fetchLancamentos = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quadradois.com.br';
                const response = await fetch(`${apiUrl}/api/public/lancamentos`, {
                    headers: {
                        'Accept': 'application/json',
                        ...(tenantId && { 'X-Tenant-ID': String(tenantId) })
                    },
                    cache: 'no-store'
                });

                if (!response.ok) throw new Error('Failed to fetch');

                const data = await response.json();
                setLancamentos(data.lancamentos || []);
            } catch (error) {
                console.error('Erro ao buscar lançamentos:', error);
                // Fallback data for preview
                setLancamentos([{
                    id: 1,
                    slug: 'reserva-do-bosque',
                    nome: 'Reserva do Bosque',
                    descricao: 'Viva em harmonia com a natureza',
                    construtora: 'Construtora Premium',
                    bairro: 'Campeche',
                    cidade: 'Florianópolis',
                    estado: 'SC',
                    previsao_entrega: '2026-12-01',
                    status: 'em_construcao',
                    imagem_hero: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2653&auto=format&fit=crop',
                    logo_empreendimento: null,
                    tipologias: [{ id: 1, nome: '2 dormitórios', quartos: 2, suites: 1, vagas: 2, area_privativa: 85 }]
                }]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLancamentos();
    }, [tenantId]);

    // Autoplay
    useEffect(() => {
        if (!autoplay || lancamentos.length <= 1) return;

        const interval = setInterval(() => {
            goToNext();
        }, Number(autoplay_interval));

        return () => clearInterval(interval);
    }, [autoplay, autoplay_interval, lancamentos.length, currentIndex]);

    const goToNext = useCallback(() => {
        if (isAnimating || lancamentos.length <= 1) return;
        setIsAnimating(true);
        setCurrentIndex((prev) => (prev + 1) % lancamentos.length);
        setTimeout(() => setIsAnimating(false), 700);
    }, [isAnimating, lancamentos.length]);

    const goToPrev = useCallback(() => {
        if (isAnimating || lancamentos.length <= 1) return;
        setIsAnimating(true);
        setCurrentIndex((prev) => (prev - 1 + lancamentos.length) % lancamentos.length);
        setTimeout(() => setIsAnimating(false), 700);
    }, [isAnimating, lancamentos.length]);

    // Loading state
    if (isLoading) {
        return (
            <section className="relative h-[85vh] min-h-[600px] bg-gray-900 flex items-center justify-center">
                <div className="animate-pulse text-white">Carregando lançamentos...</div>
            </section>
        );
    }

    // No lancamentos
    if (lancamentos.length === 0) {
        return null;
    }

    const current = lancamentos[currentIndex];

    // Get bedrooms range from tipologias
    const getBedroomsRange = () => {
        if (!current.tipologias || current.tipologias.length === 0) return null;
        const bedrooms = current.tipologias
            .map(t => t.quartos)
            .filter(q => q !== null) as number[];
        if (bedrooms.length === 0) return null;
        const min = Math.min(...bedrooms);
        const max = Math.max(...bedrooms);
        return min === max ? `${min} dormitórios` : `${min} a ${max} dormitórios`;
    };

    // Format delivery date
    const formatDelivery = () => {
        if (!current.previsao_entrega) return null;
        const date = new Date(current.previsao_entrega);
        const month = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
        const year = date.getFullYear();
        return `${month}/${year}`;
    };

    return (
        <section className="relative h-[85vh] min-h-[600px] overflow-hidden bg-black">
            {/* Background Images - All slides */}
            {lancamentos.map((lancamento, index) => (
                <div
                    key={lancamento.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                >
                    <motion.div
                        initial={false}
                        animate={index === currentIndex ? { scale: 1.05 } : { scale: 1 }}
                        transition={{ duration: 10, ease: "linear" }}
                        className="w-full h-full"
                    >
                        <img
                            src={lancamento.imagem_hero || 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2653&auto=format&fit=crop'}
                            alt={lancamento.nome}
                            className="w-full h-full object-cover"
                        />
                    </motion.div>

                    {/* Premium Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                </div>
            ))}

            {/* Content Container */}
            <div className="relative z-10 h-full container mx-auto px-4 md:px-8 flex items-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="max-w-3xl pt-20"
                    >
                        {/* 1. Logo (Reposicionado no Topo) */}
                        {show_logo && current.logo_empreendimento && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="mb-8"
                            >
                                <img
                                    src={current.logo_empreendimento}
                                    alt={`Logo ${current.nome}`}
                                    className="h-20 md:h-24 object-contain filter drop-shadow-2xl"
                                />
                            </motion.div>
                        )}

                        {/* 2. Badge de Status (Liquid Glass) */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg shadow-black/10"
                        >
                            <Building2 className="w-4 h-4 text-[var(--color-primary,#3B82F6)]" />
                            <span className="text-sm font-bold text-white uppercase tracking-wider">
                                Lançamento Exclusivo
                            </span>
                        </motion.div>

                        {/* 3. Título e Localização */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-white mb-6 leading-[1.1] drop-shadow-lg"
                        >
                            {current.construtora && (
                                <span className="block text-xl md:text-2xl font-medium text-white/80 mb-2">
                                    {current.construtora}
                                </span>
                            )}
                            {current.nome}
                        </motion.h1>

                        {/* Localização */}
                        {(current.bairro || current.cidade) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="flex items-center gap-2 text-xl md:text-2xl text-white/90 mb-8 font-light"
                            >
                                <MapPin className="w-6 h-6 text-[var(--color-primary,#3B82F6)]" />
                                <span>
                                    {current.bairro && `${current.bairro}, `}{current.cidade}
                                </span>
                            </motion.div>
                        )}

                        {/* 4. Features (Liquid Glass Pills) */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="flex flex-wrap gap-4 mb-10"
                        >
                            {getBedroomsRange() && (
                                <div className="flex items-center gap-3 px-5 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors duration-300">
                                    <Bed className="w-5 h-5 text-[var(--color-primary,#3B82F6)]" />
                                    <span className="text-white font-medium text-lg">{getBedroomsRange()}</span>
                                </div>
                            )}
                            {formatDelivery() && (
                                <div className="flex items-center gap-3 px-5 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-white/10 transition-colors duration-300">
                                    <Calendar className="w-5 h-5 text-[var(--color-primary,#3B82F6)]" />
                                    <span className="text-white font-medium text-lg">Entrega: {formatDelivery()}</span>
                                </div>
                            )}
                        </motion.div>

                        {/* 5. CTA Principal */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <Link
                                href={`/lancamentos/${current.slug}`}
                                className="group inline-flex items-center gap-3 px-8 py-4 bg-[var(--color-primary,#3B82F6)] text-white font-bold text-lg rounded-2xl shadow-lg shadow-[var(--color-primary)]/20 hover:shadow-[var(--color-primary)]/40 hover:scale-105 transition-all duration-300"
                            >
                                Conhecer Empreendimento
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Arrows (Bottom Left) */}
            {show_navigation && lancamentos.length > 1 && (
                <div className="absolute bottom-10 left-4 md:left-8 z-20 flex items-center gap-4">
                    <button
                        onClick={goToPrev}
                        disabled={isAnimating}
                        className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 disabled:opacity-50 group"
                        aria-label="Anterior"
                    >
                        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <button
                        onClick={goToNext}
                        disabled={isAnimating}
                        className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 hover:scale-105 transition-all duration-300 disabled:opacity-50 group"
                        aria-label="Próximo"
                    >
                        <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Slide Counter */}
                    <div className="ml-6 flex items-center gap-3">
                        <span className="text-2xl font-bold text-white">{String(currentIndex + 1).padStart(2, '0')}</span>
                        <div className="h-[2px] w-12 bg-white/20">
                            <motion.div
                                className="h-full bg-[var(--color-primary,#3B82F6)]"
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                key={currentIndex}
                                transition={{ duration: Number(autoplay_interval) / 1000, ease: "linear" }}
                            />
                        </div>
                        <span className="text-lg text-white/50 font-medium">{String(lancamentos.length).padStart(2, '0')}</span>
                    </div>
                </div>
            )}

            {/* Progress Dots (Hidden on Mobile, Visible on Desktop for direct access) */}
            {lancamentos.length > 1 && (
                <div className="hidden md:flex absolute bottom-12 right-8 z-20 items-center gap-3">
                    {lancamentos.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                if (!isAnimating) {
                                    setIsAnimating(true);
                                    setCurrentIndex(index);
                                    setTimeout(() => setIsAnimating(false), 700);
                                }
                            }}
                            className={`h-1.5 rounded-full transition-all duration-500 ${index === currentIndex
                                ? 'w-12 bg-white'
                                : 'w-2 bg-white/30 hover:bg-white/50'
                                }`}
                            aria-label={`Ir para slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
