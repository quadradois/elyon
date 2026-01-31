'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, DollarSign, Home as HomeIcon, Car, Building2, MapPin } from 'lucide-react';
import NeighborhoodAutocomplete from './NeighborhoodAutocomplete';

/**
 * SearchField - Wrapper unificado para campos de busca (Light Version)
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
        <div className={`group/field flex-1 min-w-[140px] ${className}`}>
            <div className="flex items-center h-full px-4 py-3 transition-all duration-200 rounded-xl hover:bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 border border-transparent focus-within:border-[var(--color-primary)]/20">
                <Icon className="w-5 h-5 text-gray-400 group-focus-within/field:text-[var(--color-primary)] mr-3 flex-shrink-0 transition-colors duration-200" />
                <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 group-focus-within/field:text-[var(--color-primary)] transition-colors duration-200">
                        {label}
                    </span>
                    {children}
                </div>
            </div>
        </div>
    );
}

/**
 * Divider - Linha vertical (Light Version)
 */
function Divider() {
    return (
        <div className="hidden lg:flex items-center px-1">
            <div className="w-px h-10 bg-gray-200" />
        </div>
    );
}

/**
 * LiquidSelect - Dropdown customizado (Light Version)
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
                className="w-full text-left flex items-center justify-between text-gray-900 font-semibold text-sm leading-tight focus:outline-none"
            >
                <span className="truncate">
                    {value ? `${selectedLabel}${suffix}` : placeholder}
                </span>
                {/* Seta discreta */}
                <div className="ml-2 border-l border-gray-200 pl-2">
                    <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 min-w-[160px] bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto">
                        <button
                            onClick={() => { onChange(""); setIsOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors border-b border-gray-50"
                        >
                            {placeholder}
                        </button>
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-50 last:border-0 ${value === opt.value ? 'text-[var(--color-primary)] font-bold bg-[var(--color-primary)]/5' : 'text-gray-700 hover:bg-gray-50'}`}
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

export default function PropertyFilterBar() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Filtros State
    const [location, setLocation] = useState(searchParams.get('neighborhood') || '');
    const [price, setPrice] = useState(''); // Não popula price pq a lógica de max_price é complexa de reverter exato
    const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
    const [garages, setGarages] = useState(searchParams.get('parking_spaces') || '');
    const [propertyType, setPropertyType] = useState(searchParams.get('property_type')?.replace(/^\w/, c => c.toUpperCase()) || '');

    // Domain para API
    const [domain, setDomain] = useState('');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setDomain(window.location.hostname);
        }
    }, []);

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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();

        const params = new URLSearchParams();
        // Preservar outros params se necessário, mas aqui vamos resetar para nova busca
        if (location) params.append('neighborhood', location);
        if (price) {
            const extraPrice = Math.floor(Number(price) * 1.2);
            params.append('max_price', extraPrice.toString());
        }
        if (bedrooms) params.append('bedrooms', bedrooms);
        if (garages) params.append('parking_spaces', garages);
        if (propertyType) params.append('property_type', propertyType.toLowerCase());

        // Always force 'venda' default logic here if not specified? Or kept generalized.
        // Se já tinha finalidade na URL, manter?
        const purpose = searchParams.get('purpose') || searchParams.get('finalidade');
        if (purpose) params.append('finalidade', purpose);

        router.push(`/imoveis?${params.toString()}`);
    };

    // Estilos base do input (Light Theme)
    const inputBaseClass = "w-full bg-transparent border-none p-0 text-gray-900 font-semibold placeholder-gray-400 focus:ring-0 text-sm leading-tight";

    return (
        <div className="w-full animate-fade-in-up">
            <div
                className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100 p-2 md:p-3"
            >
                <form onSubmit={handleSearch}>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-0">
                        {/* Location Field */}
                        <SearchField icon={MapPin} label="Localização" className="lg:flex-[2]">
                            <NeighborhoodAutocomplete
                                value={location}
                                onChange={setLocation}
                                apiUrl={domain ? `/api/public/site/${domain}/neighborhoods` : undefined}
                                className={inputBaseClass}
                            />
                        </SearchField>

                        <Divider />

                        {/* Property Type */}
                        <SearchField icon={Building2} label="Tipo">
                            <LiquidSelect
                                value={propertyType}
                                onChange={setPropertyType}
                                options={propertyTypeOptions}
                                placeholder="Todos"
                            />
                        </SearchField>

                        <Divider />

                        {/* Price */}
                        <SearchField icon={DollarSign} label="Valor até">
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="R$ Máximo"
                                className={inputBaseClass}
                            />
                        </SearchField>

                        <Divider />

                        {/* Bedrooms */}
                        <SearchField icon={HomeIcon} label="Quartos">
                            <LiquidSelect
                                value={bedrooms}
                                onChange={setBedrooms}
                                options={bedroomOptions}
                                placeholder="1+"
                            />
                        </SearchField>

                        {/* Search Button */}
                        <div className="lg:pl-3 pt-2 lg:pt-0">
                            <button
                                type="submit"
                                className="w-full lg:w-auto h-12 lg:h-full min-h-[48px] px-8 rounded-xl text-white font-bold text-sm lg:text-base active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/30 hover:shadow-[var(--color-primary)]/50"
                                style={{
                                    backgroundColor: 'var(--color-primary)'
                                }}
                            >
                                <Search className="w-5 h-5" strokeWidth={2.5} />
                                <span>Buscar</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
