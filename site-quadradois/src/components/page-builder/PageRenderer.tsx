/**
 * PageRenderer
 * Renderizador dinâmico de componentes da página
 */
import React from 'react';
import { ComponentItem } from './types';

// Importar componentes
import Hero from './components/Hero';
import TextBlock from './components/TextBlock';
import PropertyGrid from './components/PropertyGrid';
import ContactForm from './components/ContactForm';
import ImageGallery from './components/ImageGallery';
import Video from './components/Video';
import Map from './components/Map';
import CtaButton from './components/CtaButton';
import Testimonials from './components/Testimonials';
import Features from './components/Features';
import Faq from './components/Faq';
import Newsletter from './components/Newsletter';
import Stats from './components/Stats';
import Partners from './components/Partners';
import BannerGrid from './components/BannerGrid';
import PropertyCarousel from './components/PropertyCarousel';
import TeamGrid from './components/TeamGrid';
import LaunchHero from './components/LaunchHero';
import Tipologias from './components/Tipologias';
import UnitsTable from './components/UnitsTable';
import SellPropertyForm from './components/SellPropertyForm';

// Importar componentes especializados
import HeroAbout from './components/HeroAbout';
import MissionVisionValues from './components/MissionVisionValues';
import CompanyTimeline from './components/CompanyTimeline';
import PropertyFilterBar from './components/PropertyFilterBar';

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
    'hero': Hero,
    'text_block': TextBlock,
    'property_grid': PropertyGrid,
    'contact_form': ContactForm,
    'image_gallery': ImageGallery,
    'video': Video,
    'map': Map,
    'cta_button': CtaButton,
    'testimonials': Testimonials,
    'features': Features,
    'faq': Faq,
    'newsletter': Newsletter,
    'stats': Stats,
    'partners': Partners,

    'banner_grid': BannerGrid,
    'lancamento_hero': LaunchHero,
    'tipologias': Tipologias,
    'tabela_unidades': UnitsTable,
    'sell_property_form': SellPropertyForm,

    // Componentes Sobre (Specialized)
    'hero_about': HeroAbout,
    'mission_vision': MissionVisionValues,
    'company_timeline': CompanyTimeline,

    // Novos componentes
    'property_search_bar': PropertyFilterBar,

    // Alias / Fallbacks
    'agents_grid': TeamGrid,
    'social_proof': Partners,
    'property_carousel': PropertyCarousel,
    'property_filter': PropertyGrid,
};

interface PageRendererProps {
    components: ComponentItem[];
    tenantId?: number; // Opcional, para componentes que precisem
}

export default function PageRenderer({ components, tenantId }: PageRendererProps) {
    if (!components || components.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col w-full">
            {components.map((component) => {
                const Component = COMPONENT_MAP[component.type];

                if (!Component) {
                    console.warn(`Componente desconhecido: ${component.type}`);
                    return null;
                }

                // Injeta tenantId se disponível
                const extraProps = tenantId ? { tenantId } : {};

                return (
                    <div key={component.id} id={component.id} className="w-full">
                        <Component {...component.props} {...extraProps} />
                    </div>
                );
            })}
        </div>
    );
}
