'use client';

import { MessageCircle } from 'lucide-react';

interface WhatsAppButtonProps {
    phone: string | null;
    primaryColor?: string;
}

export default function WhatsAppButton({ phone, primaryColor }: WhatsAppButtonProps) {
    if (!phone) return null;

    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanPhone}`;

    return (
        <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
            aria-label="Falar pelo WhatsApp"
        >
            <MessageCircle className="w-7 h-7" />

            {/* Tooltip */}
            <span className="absolute right-16 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Fale conosco
            </span>

            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25"></span>
        </a>
    );
}
