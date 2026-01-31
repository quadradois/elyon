'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Waves, Dumbbell, TreePine, UtensilsCrossed, Car,
    ShoppingBag, Dog, Baby, Wifi, Shield, Sun, Wind,
    Search, X, ChevronRight, Sparkles, Home, Coffee,
    Gamepad2, Bike, Heart, Music, Camera, Palette,
    BookOpen, Users, Leaf, Zap, Star, Building,
    Bath, Sofa, Play, PartyPopper
} from 'lucide-react';

interface Amenity {
    nome: string;
    descricao?: string;
    icone?: string;
    categoria?: string;
}

interface AmenitiesGridProps {
    amenities: Amenity[];
    primaryColor: string;
}

const iconMap: Record<string, any> = {
    piscina: Waves,
    academia: Dumbbell,
    fitness: Dumbbell,
    parque: TreePine,
    jardim: TreePine,
    churrasqueira: UtensilsCrossed,
    gourmet: UtensilsCrossed,
    garagem: Car,
    estacionamento: Car,
    mercado: ShoppingBag,
    pet: Dog,
    cachorro: Dog,
    kids: Baby,
    crianca: Baby,
    playground: Baby,
    brinquedoteca: Baby,
    wifi: Wifi,
    internet: Wifi,
    seguranca: Shield,
    portaria: Shield,
    solar: Sun,
    solarium: Sun,
    ventilacao: Wind,
    ar: Wind,
    spa: Heart,
    sauna: Heart,
    salao: PartyPopper,
    festa: PartyPopper,
    jogos: Gamepad2,
    game: Gamepad2,
    bicicleta: Bike,
    bike: Bike,
    cinema: Play,
    teatro: Play,
    coworking: Coffee,
    trabalho: Coffee,
    lounge: Sofa,
    estar: Sofa,
    biblioteca: BookOpen,
    leitura: BookOpen,
    reuniao: Users,
    multiuso: Users,
    sustentavel: Leaf,
    eco: Leaf,
    energia: Zap,
    eletrico: Zap,
    lavanderia: Home,
    laundry: Home,
    banho: Bath,
    hidro: Bath,
    quadra: Play,
    esporte: Play,
    musica: Music,
    som: Music,
    foto: Camera,
    arte: Palette,
    hobby: Palette,
};

const categoryIcons: Record<string, any> = {
    'Lazer': PartyPopper,
    'Esporte': Dumbbell,
    'Comodidade': Home,
    'Segurança': Shield,
    'Sustentabilidade': Leaf,
};

const getIcon = (amenity: Amenity) => {
    const iconName = amenity.icone?.toLowerCase() || '';
    const amenityName = amenity.nome.toLowerCase();

    for (const [key, Icon] of Object.entries(iconMap)) {
        if (iconName.includes(key) || amenityName.includes(key)) {
            return Icon;
        }
    }
    return Star;
};

const categorizeAmenity = (amenity: Amenity): string => {
    if (amenity.categoria) return amenity.categoria;

    const name = amenity.nome.toLowerCase();
    if (['piscina', 'churras', 'salao', 'festa', 'lounge', 'gourmet', 'bar', 'cinema'].some(k => name.includes(k))) return 'Lazer';
    if (['academia', 'fitness', 'quadra', 'esporte', 'bike', 'yoga'].some(k => name.includes(k))) return 'Esporte';
    if (['portaria', 'seguranca', 'cftv', 'controle'].some(k => name.includes(k))) return 'Segurança';
    if (['solar', 'eco', 'sustentavel', 'reuso', 'agua'].some(k => name.includes(k))) return 'Sustentabilidade';
    return 'Comodidade';
};

export default function AmenitiesGrid({ amenities, primaryColor }: AmenitiesGridProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Categorize amenities
    const categorizedAmenities = useMemo(() => {
        const cats: Record<string, Amenity[]> = {};
        amenities.forEach(a => {
            const cat = categorizeAmenity(a);
            if (!cats[cat]) cats[cat] = [];
            cats[cat].push(a);
        });
        return cats;
    }, [amenities]);

    const categories = Object.keys(categorizedAmenities);

    // Filter amenities
    const filteredAmenities = useMemo(() => {
        let result = selectedCategory
            ? categorizedAmenities[selectedCategory] || []
            : amenities;

        if (searchQuery) {
            result = result.filter(a =>
                a.nome.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return result;
    }, [selectedCategory, amenities, categorizedAmenities, searchQuery]);

    const displayLimit = 12;
    const visibleAmenities = showAll ? filteredAmenities : filteredAmenities.slice(0, displayLimit);
    const hasMore = filteredAmenities.length > displayLimit;

    return (
        <section className="relative py-24 overflow-hidden">
            {/* Premium Background */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50" />
                <div
                    className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10"
                    style={{ background: primaryColor }}
                />
                <div
                    className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-10"
                    style={{ background: primaryColor }}
                />
                {/* Subtle pattern */}
                <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, ${primaryColor} 1px, transparent 0)`,
                        backgroundSize: '32px 32px'
                    }}
                />
            </div>

            <div className="container-site relative z-10">
                {/* Header */}
                <motion.div
                    className="max-w-4xl mx-auto text-center mb-16"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg mb-6"
                    >
                        <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                        <span className="text-sm font-semibold text-gray-700">
                            {amenities.length} amenidades exclusivas
                        </span>
                    </div>

                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                        Viva com{' '}
                        <span
                            className="relative inline-block"
                            style={{ color: primaryColor }}
                        >
                            estilo premium
                            <svg
                                className="absolute -bottom-2 left-0 w-full"
                                viewBox="0 0 200 12"
                                fill="none"
                            >
                                <path
                                    d="M2 8C50 2 150 2 198 8"
                                    stroke={primaryColor}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeOpacity="0.3"
                                />
                            </svg>
                        </span>
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Desfrute de uma infraestrutura completa pensada para o seu bem-estar e de toda sua família
                    </p>
                </motion.div>

                {/* Category Pills */}
                {categories.length > 1 && (
                    <motion.div
                        className="flex flex-wrap justify-center gap-3 mb-12"
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                    >
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${selectedCategory === null
                                ? 'text-white shadow-lg scale-105'
                                : 'bg-white text-gray-600 hover:bg-gray-100 shadow-md'
                                }`}
                            style={selectedCategory === null ? {
                                background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
                                boxShadow: `0 10px 30px ${primaryColor}40`
                            } : {}}
                        >
                            Todas
                        </button>
                        {categories.map(cat => {
                            const CatIcon = categoryIcons[cat] || Star;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 ${selectedCategory === cat
                                        ? 'text-white shadow-lg scale-105'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 shadow-md'
                                        }`}
                                    style={selectedCategory === cat ? {
                                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
                                        boxShadow: `0 10px 30px ${primaryColor}40`
                                    } : {}}
                                >
                                    <CatIcon className="w-4 h-4" />
                                    {cat}
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === cat
                                        ? 'bg-white/20'
                                        : 'bg-gray-100'
                                        }`}>
                                        {categorizedAmenities[cat]?.length}
                                    </span>
                                </button>
                            );
                        })}
                    </motion.div>
                )}

                {/* Search (when showing all) */}
                <AnimatePresence>
                    {showAll && (
                        <motion.div
                            className="max-w-md mx-auto mb-12"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Buscar amenidade..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-gray-200 focus:border-gray-400 focus:outline-none transition-colors bg-white shadow-lg"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                                    >
                                        <X className="w-4 h-4 text-gray-500" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Premium Grid - Centered */}
                <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-12">
                    <AnimatePresence mode="popLayout">
                        {visibleAmenities.map((amenity, index) => {
                            const Icon = getIcon(amenity);
                            const isHovered = hoveredIndex === index;

                            return (
                                <motion.div
                                    key={amenity.nome}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{
                                        delay: index * 0.03,
                                        type: "spring",
                                        stiffness: 300
                                    }}
                                    className="group relative w-[calc(50%-0.5rem)] sm:w-[calc(33.33%-1rem)] lg:w-[calc(25%-1.125rem)] xl:w-[calc(16.66%-1.25rem)]"
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                >
                                    <div
                                        className={`relative bg-white rounded-3xl p-6 h-full flex flex-col items-center text-center transition-all duration-500 cursor-pointer border-2 ${isHovered
                                            ? 'shadow-2xl scale-105 border-transparent'
                                            : 'shadow-md border-gray-100 hover:shadow-xl'
                                            }`}
                                        style={isHovered ? {
                                            boxShadow: `0 25px 50px -12px ${primaryColor}30`
                                        } : {}}
                                    >
                                        {/* Gradient overlay on hover */}
                                        <div
                                            className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            style={{
                                                background: `linear-gradient(135deg, ${primaryColor}08 0%, transparent 70%)`
                                            }}
                                        />

                                        {/* Icon Container */}
                                        <motion.div
                                            className="relative w-16 h-16 rounded-2xl mb-4 flex items-center justify-center overflow-hidden"
                                            style={{
                                                background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)`
                                            }}
                                            animate={isHovered ? { rotate: [0, -5, 5, 0], scale: 1.1 } : { rotate: 0, scale: 1 }}
                                            transition={{ duration: 0.5 }}
                                        >
                                            {/* Shine effect */}
                                            {isHovered && (
                                                <motion.div
                                                    className="absolute inset-0 opacity-50"
                                                    style={{
                                                        background: 'linear-gradient(90deg, transparent, white, transparent)',
                                                    }}
                                                    animate={{ x: ['-100%', '100%'] }}
                                                    transition={{ duration: 0.6 }}
                                                />
                                            )}
                                            <Icon
                                                className="w-8 h-8 relative z-10 transition-colors duration-300"
                                                style={{ color: primaryColor }}
                                            />
                                        </motion.div>

                                        {/* Name */}
                                        <h4 className="font-semibold text-gray-900 text-sm leading-snug relative z-10">
                                            {amenity.nome}
                                        </h4>

                                        {/* Description */}
                                        {amenity.descricao && (
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed relative z-10 line-clamp-2">
                                                {amenity.descricao}
                                            </p>
                                        )}

                                        {/* Animated underline */}
                                        <motion.div
                                            className="h-0.5 rounded-full mt-3"
                                            style={{ backgroundColor: primaryColor }}
                                            initial={{ width: 0 }}
                                            animate={{ width: isHovered ? '60%' : 0 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Show More/Less Button */}
                {hasMore && !searchQuery && (
                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                    >
                        <motion.button
                            onClick={() => setShowAll(!showAll)}
                            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                            style={{
                                background: showAll
                                    ? 'white'
                                    : `linear-gradient(135deg, ${primaryColor} 0%, ${adjustColor(primaryColor, -30)} 100%)`,
                                color: showAll ? primaryColor : 'white',
                                border: showAll ? `2px solid ${primaryColor}` : 'none'
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <span>
                                {showAll
                                    ? 'Ver menos'
                                    : `Ver todas as ${amenities.length} amenidades`
                                }
                            </span>
                            <ChevronRight
                                className={`w-5 h-5 transform transition-transform ${showAll ? 'rotate-90' : ''
                                    }`}
                            />
                        </motion.button>
                    </motion.div>
                )}

                {/* No Results */}
                {searchQuery && filteredAmenities.length === 0 && (
                    <motion.div
                        className="text-center py-16"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">
                            Nenhuma amenidade encontrada para "{searchQuery}"
                        </p>
                    </motion.div>
                )}
            </div>
        </section >
    );
}

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
