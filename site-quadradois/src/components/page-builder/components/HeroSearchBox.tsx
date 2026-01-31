'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, DollarSign, Home as HomeIcon, Car, Building2, MapPin } from 'lucide-react';
import NeighborhoodAutocomplete from './NeighborhoodAutocomplete';

interface HeroSearchBoxProps {
    showBuy?: boolean;
    showRent?: boolean;
    showLaunch?: boolean;
    layout?: 'tabs' | 'unified';
    showPropertyType?: boolean;
    showGarages?: boolean;
    showLocation?: boolean;
    showPrice?: boolean;
    showBedrooms?: boolean;
}

/**
 * SearchField - Wrapper unificado para campos de busca
 * Renderiza um campo com estilo "Liquid Glass" (sem fundo individual)
 */
function SearchField({
    icon: Icon,
    label,
    children,
    className = ''
}: {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`group/field flex-1 min-w-0 ${className}`}>
            <div className="flex items-center h-full px-4 py-3 md:py-4 transition-all duration-200 rounded-xl hover:bg-white/10 focus-within:bg-white/15 focus-within:ring-1 focus-within:ring-white/30">
                <Icon className="w-5 h-5 text-white/60 group-focus-within/field:text-[var(--color-primary)] mr-3 flex-shrink-0 transition-colors duration-200" />
                <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold text-white/80 uppercase tracking-wider mb-0.5 group-focus-within/field:text-[var(--color-primary)] transition-colors duration-200 drop-shadow-sm">
                        {label}
                    </span>
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * Divider - Linha vertical adaptativa
 */
function Divider() {
    return (
        <div className="hidden md:flex items-center px-1">
            <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
        </div>
    );
}

/**
 * LiquidSelect - Dropdown customizado estilo "Liquid Glass"
 */
function LiquidSelect({
    value,
    onChange,
    options,
    placeholder = "Todos",
    suffix = ""
}: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    suffix?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || value;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left flex items-center justify-between text-white font-semibold text-sm md:text-base leading-tight focus:outline-none"
            >
                <span className={!value ? "" : ""}>
                    {value ? `${selectedLabel}${suffix}` : placeholder}
                </span>
                {/* Seta discreta */}
                <div className="ml-2 border-l border-white/20 pl-2">
                    <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-4 min-w-[140px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto">
                        <button
                            onClick={() => { onChange(""); setIsOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5"
                        >
                            {placeholder}
                        </button>
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/5 last:border-0 ${value === opt.value ? 'text-[var(--color-primary)] font-bold bg-white/5' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HeroSearchBox({
    showBuy = true,
    showRent = true,
    showLaunch = true,
    layout = 'tabs',
    showPropertyType = true,
    showGarages = true,
    showLocation = true,
    showPrice = true,
    showBedrooms = true
}: HeroSearchBoxProps) {
    const router = useRouter();

    // Tabs disponíveis
    const availableTabs = [
        { id: 'comprar', label: 'COMPRAR', show: showBuy },
        { id: 'alugar', label: 'ALUGAR', show: showRent },
        { id: 'lancamento', label: 'LANÇAMENTOS', show: showLaunch }
    ].filter(t => t.show);

    const [activeTab, setActiveTab] = useState('comprar');

    // Filtros
    const [location, setLocation] = useState('');
    const [price, setPrice] = useState('');
    const [bedrooms, setBedrooms] = useState('');
    const [garages, setGarages] = useState('');
    const [propertyType, setPropertyType] = useState('');

    // Domain para API
    const [domain, setDomain] = useState('');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setDomain(window.location.hostname);
        }
    }, []);

    // Tabs logic
    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id);
        }
    }, [availableTabs, activeTab]); // Fix initial tab if mismatch

    // Options Collections
    const propertyTypeOptions = [
        { value: 'Apartamento', label: 'Apartamento' },
        { value: 'Casa', label: 'Casa' },
        { value: 'Cobertura', label: 'Cobertura' },
        { value: 'Comercial', label: 'Comercial' },
        { value: 'Terreno', label: 'Terreno' }
    ];

    const bedroomOptions = [
        { value: '1', label: '1+' },
        { value: '2', label: '2+' },
        { value: '3', label: '3+' },
        { value: '4', label: '4+' }
    ];

    const garageOptions = [
        { value: '1', label: '1+' },
        { value: '2', label: '2+' },
        { value: '3', label: '3+' }
    ];

    // 🧠 Smart Layout: Calcular campos visíveis
    const visibleFields = useMemo(() => {
        const fields = [];
        if (showLocation) fields.push('location');
        if (showPropertyType) fields.push('type');
        if (showPrice) fields.push('price');
        if (showBedrooms) fields.push('bedrooms');
        if (showGarages) fields.push('garages');
        return fields;
    }, [showLocation, showPropertyType, showPrice, showBedrooms, showGarages]);

    const fieldCount = visibleFields.length;

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();

        let searchType = activeTab;
        if (layout === 'unified' && availableTabs.length === 1) {
            searchType = availableTabs[0].id;
        }

        if (searchType === 'lancamento') {
            const params = new URLSearchParams();
            if (location) params.append('city', location);
            router.push(`/lancamentos?${params.toString()}`);
            return;
        }

        const params = new URLSearchParams();
        if (searchType) params.append('type', searchType);
        if (location) params.append('neighborhood', location);
        if (price) {
            const extraPrice = Math.floor(Number(price) * 1.2);
            params.append('max_price', extraPrice.toString());
        }
        if (bedrooms) params.append('bedrooms', bedrooms);
        if (garages) params.append('parking_spaces', garages);
        if (propertyType) params.append('property_type', propertyType.toLowerCase());

        router.push(`/imoveis?${params.toString()}`);
    };

    const isUnified = layout === 'unified';

    // Estilos base do input - CONTRASTE ALTO
    const inputBaseClass = "w-full bg-transparent border-none p-0 text-white font-semibold placeholder-white/50 focus:ring-0 text-sm md:text-base leading-tight drop-shadow-sm";

    return (
        <div className="w-full max-w-5xl mx-auto mt-8 md:mt-12 px-4 md:px-0 animate-fade-in-up">
            <div className="relative">
                {/* Tabs */}
                {!isUnified && availableTabs.length > 1 && (
                    <div className="flex justify-center mb-0">
                        <div className="inline-flex items-end">
                            {availableTabs.map((tab, index) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className="relative px-5 md:px-7 py-2.5 text-xs font-bold tracking-wide transition-all duration-300"
                                        style={{
                                            zIndex: isActive ? 30 : 20 - index,
                                            marginLeft: index > 0 ? '-2px' : '0',
                                            background: isActive
                                                ? 'rgba(255,255,255,0.15)'
                                                : 'rgba(255,255,255,0.05)',
                                            color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                                            backdropFilter: 'blur(12px)',
                                            borderTopLeftRadius: '12px',
                                            borderTopRightRadius: '12px',
                                            borderBottom: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                        }}
                                    >
                                        <span className="relative z-10">{tab.label}</span>
                                        {isActive && (
                                            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[var(--color-primary)] rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 🔮 Main Search Container - Liquid Glass (Darker for Mobile) */}
                <div
                    className="rounded-2xl md:rounded-3xl relative transition-all duration-500 group"
                    style={{
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.3) 100%)',
                        backdropFilter: 'blur(24px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
                    }}
                >
                    {/* Glow Effects */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--color-primary)]/20 via-transparent to-[var(--color-secondary,var(--color-primary))]/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl -z-10" />

                    {/* Unified Selector */}
                    {isUnified && availableTabs.length > 1 && (
                        <div className="flex justify-center py-4 border-b border-white/10">
                            <div className="inline-flex bg-white/10 rounded-full p-1">
                                {availableTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${activeTab === tab.id
                                            ? 'bg-white/20 text-white shadow-sm'
                                            : 'text-white/60 hover:text-white'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 🧠 Smart Grid Form */}
                    <form onSubmit={handleSearch} className="p-3 md:p-4">
                        <div className={`
                            flex flex-col md:flex-row md:items-stretch
                            ${fieldCount <= 2 ? 'gap-0' : 'gap-2 md:gap-0'}
                        `}>
                            {/* Location Field */}
                            {showLocation && (
                                <>
                                    <SearchField icon={MapPin} label="Localização" className={fieldCount <= 2 ? 'md:flex-[2]' : 'md:flex-1'}>
                                        <NeighborhoodAutocomplete
                                            value={location}
                                            onChange={setLocation}
                                            apiUrl={domain ? `/api/public/site/${domain}/neighborhoods` : undefined}
                                            className={inputBaseClass}
                                        />
                                    </SearchField>
                                    {(showPropertyType || showPrice || showBedrooms || showGarages) && <Divider />}
                                </>
                            )}

                            {/* Property Type */}
                            {showPropertyType && (
                                <>
                                    <SearchField icon={Building2} label="Tipo">
                                        <LiquidSelect
                                            value={propertyType}
                                            onChange={setPropertyType}
                                            options={propertyTypeOptions}
                                            placeholder="Todos"
                                        />
                                    </SearchField>
                                    {(showPrice || showBedrooms || showGarages) && <Divider />}
                                </>
                            )}

                            {/* Price */}
                            {showPrice && (
                                <>
                                    <SearchField icon={DollarSign} label="Valor até" className={fieldCount <= 2 ? 'md:flex-1' : ''}>
                                        <input
                                            type="number"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            placeholder="R$ Máximo"
                                            className={inputBaseClass}
                                        />
                                    </SearchField>
                                    {(showBedrooms || showGarages) && <Divider />}
                                </>
                            )}

                            {/* Bedrooms */}
                            {showBedrooms && (
                                <>
                                    <SearchField icon={HomeIcon} label="Quartos">
                                        <LiquidSelect
                                            value={bedrooms}
                                            onChange={setBedrooms}
                                            options={bedroomOptions}
                                            placeholder="1+"
                                        />
                                    </SearchField>
                                    {showGarages && <Divider />}
                                </>
                            )}

                            {/* Garages */}
                            {showGarages && (
                                <SearchField icon={Car} label="Vagas">
                                    <LiquidSelect
                                        value={garages}
                                        onChange={setGarages}
                                        options={garageOptions}
                                        placeholder="1+"
                                    />
                                </SearchField>
                            )}

                            {/* Search Button */}
                            <div className="flex items-center mt-3 md:mt-0 md:ml-2">
                                <button
                                    type="submit"
                                    className="w-full md:w-auto h-12 md:h-14 px-6 md:px-8 rounded-xl text-white font-bold text-sm md:text-base active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group/btn"
                                    style={{
                                        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary, var(--color-primary)) 100%)',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    }}
                                >
                                    <span className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
                                    <Search className="w-5 h-5 relative z-10" strokeWidth={2.5} />
                                    <span className="relative z-10">Buscar</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
