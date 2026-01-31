/**
 * FontLoader - Carrega fontes dinâmicas do Google Fonts
 * 
 * Responsável por:
 * - Gerar URL do Google Fonts baseado nas fontes configuradas
 * - Adicionar preconnect para performance
 * - Aplicar fontes via CSS variables
 */

import { renderService } from '@/lib/services/RenderService';

interface FontLoaderProps {
    /** Nome da fonte para títulos (headings) */
    heading: string;
    /** Nome da fonte para corpo de texto (body) */
    body: string;
}

/**
 * Componente que injeta as fontes do Google Fonts no <head>
 * Deve ser usado dentro do SiteLayout para aplicar fontes dinâmicas
 * 
 * @example
 * <FontLoader heading="Poppins" body="Inter" />
 */
export default function FontLoader({ heading, body }: FontLoaderProps) {
    const url = renderService.generateFontUrl(heading, body);

    return (
        <>
            {/* Preconnect para melhor performance */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

            {/* Carrega as fontes */}
            <link rel="stylesheet" href={url} />
        </>
    );
}
