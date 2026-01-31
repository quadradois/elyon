'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface NeighborhoodAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    apiUrl?: string;
    className?: string; // Para passar classes do inputBaseClass
}

export default function NeighborhoodAutocomplete({ value, onChange, apiUrl, className }: NeighborhoodAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync external value
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        // Fechar ao clicar fora
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const fetchNeighborhoods = async () => {
        if (!apiUrl || suggestions.length > 0) return;

        try {
            setLoading(true);
            const res = await fetch(apiUrl);
            if (res.ok) {
                const data = await res.json();
                setSuggestions(data);
            }
        } catch (error) {
            console.error('Failed to load neighborhoods', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFocus = () => {
        setShowSuggestions(true);
        fetchNeighborhoods();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setInputValue(newVal);
        onChange(newVal);
        setShowSuggestions(true);
    };

    const handleSelect = (neighborhood: string) => {
        setInputValue(neighborhood);
        onChange(neighborhood);
        setShowSuggestions(false);
    };

    // Filter logic
    const filteredSuggestions = suggestions.filter(s =>
        s.toLowerCase().includes(inputValue.toLowerCase())
    );

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="flex items-center">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    placeholder="Pesquisar bairro..."
                    className={`${className} w-full`}
                    autoComplete="off"
                />
                {loading && <Loader2 className="w-4 h-4 text-white/50 animate-spin ml-2" />}
            </div>

            {/* Dropdown de Sugestões - Estilo Glass Dark */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {filteredSuggestions.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelect(item)}
                            className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors border-b border-white/5 last:border-0"
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
