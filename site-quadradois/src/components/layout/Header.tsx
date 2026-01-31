'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import type { Branding } from '@/lib/api';

interface HeaderProps {
    branding: Branding | null;
    menu?: { label: string; href: string; order: number }[];
    transparent?: boolean;
}

const defaultMenuItems = [
    { label: 'Início', href: '/', order: 0 },
    { label: 'Imóveis', href: '/imoveis', order: 1 },
    { label: 'Lançamentos', href: '/lancamentos', order: 2 },
    { label: 'Sobre', href: '/sobre', order: 3 },
    { label: 'Contato', href: '/contato', order: 4 },
];

export default function Header({ branding, menu, transparent = false }: HeaderProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);
        // Check initial scroll
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const menuItems = menu && menu.length > 0
        ? [...menu].sort((a, b) => a.order - b.order)
        : defaultMenuItems;

    const isTransparent = transparent && !isScrolled && !isMenuOpen;

    // Cores baseadas no estado (transparente vs sólido)
    // Se transparente: texto branco. Se rolado ou menu aberto: texto escuro
    const textColorClass = isTransparent ? 'text-white hover:text-white/80' : 'text-gray-600 hover:text-[var(--color-primary)]';
    const logoClass = isTransparent ? 'brightness-0 invert' : '';

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isTransparent
                    ? 'bg-transparent border-transparent py-4'
                    : 'bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm py-0'
                }`}
        >
            <div className="container-site">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 relative z-50">
                        {branding?.logo_url ? (
                            <div className={`transition-all duration-300 ${logoClass}`}>
                                <Image
                                    src={branding.logo_url}
                                    alt={branding.company_name || 'Logo'}
                                    width={140}
                                    height={40}
                                    className="h-8 md:h-10 w-auto object-contain"
                                />
                            </div>
                        ) : (
                            <span className={`text-xl font-bold transition-colors ${isTransparent ? 'text-white' : 'text-gray-900'}`}>
                                {branding?.company_name || 'Imobiliária'}
                            </span>
                        )}
                    </Link>

                    {/* Desktop Menu */}
                    <nav className="hidden md:flex items-center gap-8">
                        {menuItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`text-sm font-medium transition-colors ${isTransparent
                                        ? 'text-white/90 hover:text-white font-semibold drop-shadow-sm'
                                        : 'text-gray-600 hover:text-[var(--color-primary)]'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* CTA Button */}
                    {branding?.whatsapp && (
                        <a
                            href={`https://wa.me/55${branding.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hidden md:flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all transform hover:scale-105 ${isTransparent
                                    ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg'
                                    : 'bg-[var(--color-primary)] text-white hover:opacity-90'
                                }`}
                        >
                            <Phone className="w-4 h-4" />
                            Fale Conosco
                        </a>
                    )}

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`md:hidden p-2 transition-colors ${isTransparent ? 'text-white' : 'text-gray-600'}`}
                    >
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>

                {/* Mobile Menu Overlay */}
                {isMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 shadow-xl animate-fade-in-down max-h-[calc(100vh-80px)] overflow-y-auto">
                        <nav className="flex flex-col p-4 gap-2">
                            {menuItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="px-4 py-3 text-base font-medium text-gray-600 hover:text-[var(--color-primary)] hover:bg-gray-50 rounded-lg transition-colors"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                            {branding?.whatsapp && (
                                <a
                                    href={`https://wa.me/55${branding.whatsapp.replace(/\D/g, '')}`}
                                    className="px-4 py-3 text-base font-bold text-[var(--color-primary)] bg-gray-50 rounded-lg flex items-center gap-2 mt-2"
                                >
                                    <Phone className="w-4 h-4" />
                                    WhatsApp
                                </a>
                            )}
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}
