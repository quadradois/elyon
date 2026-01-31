import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, Mail, Instagram, Facebook, Linkedin, Youtube } from 'lucide-react';
import type { Branding } from '@/lib/api';

interface FooterProps {
    branding: Branding | null;
}

export default function Footer({ branding }: FooterProps) {
    const currentYear = new Date().getFullYear();

    const socialLinks = [
        { icon: Instagram, url: branding?.instagram, label: 'Instagram' },
        { icon: Facebook, url: branding?.facebook, label: 'Facebook' },
        { icon: Linkedin, url: branding?.linkedin, label: 'LinkedIn' },
        { icon: Youtube, url: branding?.youtube, label: 'YouTube' },
    ].filter(s => s.url);

    return (
        <footer className="bg-gray-900 text-white">
            {/* Main Footer */}
            <div className="container-site py-12 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Logo & Description */}
                    <div className="md:col-span-2">
                        {branding?.logo_dark_url || branding?.logo_url ? (
                            <Image
                                src={branding.logo_dark_url || branding.logo_url || ''}
                                alt={branding.company_name || 'Logo'}
                                width={160}
                                height={48}
                                className="h-10 w-auto object-contain mb-4"
                            />
                        ) : (
                            <h3 className="text-xl font-bold mb-4">
                                {branding?.company_name || 'Imobiliária'}
                            </h3>
                        )}
                        {branding?.slogan && (
                            <p className="text-gray-400 text-sm mb-4">{branding.slogan}</p>
                        )}
                        {branding?.address && (
                            <div className="flex items-start gap-2 text-gray-400 text-sm">
                                <MapPin className="w-4 h-4 mt-1 shrink-0" />
                                <span>{branding.address}</span>
                            </div>
                        )}
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="font-semibold mb-4">Navegação</h4>
                        <nav className="flex flex-col gap-2">
                            <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
                                Início
                            </Link>
                            <Link href="/imoveis" className="text-gray-400 hover:text-white text-sm transition-colors">
                                Imóveis
                            </Link>
                            <Link href="/lancamentos" className="text-gray-400 hover:text-white text-sm transition-colors">
                                Lançamentos
                            </Link>
                            <Link href="/sobre" className="text-gray-400 hover:text-white text-sm transition-colors">
                                Sobre Nós
                            </Link>
                            <Link href="/contato" className="text-gray-400 hover:text-white text-sm transition-colors">
                                Contato
                            </Link>
                        </nav>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-semibold mb-4">Contato</h4>
                        <div className="flex flex-col gap-3">
                            {branding?.phone && (
                                <a
                                    href={`tel:${branding.phone.replace(/\D/g, '')}`}
                                    className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                                >
                                    <Phone className="w-4 h-4" />
                                    {branding.phone}
                                </a>
                            )}
                            {branding?.email && (
                                <a
                                    href={`mailto:${branding.email}`}
                                    className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                                >
                                    <Mail className="w-4 h-4" />
                                    {branding.email}
                                </a>
                            )}
                        </div>

                        {/* Social Links */}
                        {socialLinks.length > 0 && (
                            <div className="flex items-center gap-3 mt-6">
                                {socialLinks.map((social) => (
                                    <a
                                        key={social.label}
                                        href={social.url!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                                        aria-label={social.label}
                                    >
                                        <social.icon className="w-4 h-4" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-800">
                <div className="container-site py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-xs text-center md:text-left">
                        © {currentYear} {branding?.company_name || 'Imobiliária'}. Todos os direitos reservados.
                    </p>
                    <p className="text-gray-600 text-xs">
                        Powered by <span className="text-gray-400">QuadraDois</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}
