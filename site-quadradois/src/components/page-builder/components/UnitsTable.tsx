/**
 * UnitsTable Component
 */
import React from 'react';
import { ComponentProps } from '../types';

export default function UnitsTable(props: ComponentProps) {
    const {
        lancamento_id,
        group_by = 'tipologia'
    } = props;

    // Mock Data
    const units = [
        { unit: "101", floor: "1º Andar", type: "Studio Garden", area: "45m²", price: "R$ 450.000", status: "available" },
        { unit: "102", floor: "1º Andar", type: "Studio Garden", area: "45m²", price: "R$ 455.000", status: "reserved" },
        { unit: "201", floor: "2º Andar", type: "Apartamento Tipo", area: "78m²", price: "R$ 780.000", status: "available" },
        { unit: "202", floor: "2º Andar", type: "Apartamento Tipo", area: "78m²", price: "R$ 785.000", status: "sold" },
        { unit: "301", floor: "3º Andar", type: "Apartamento Tipo", area: "78m²", price: "R$ 810.000", status: "available" },
    ];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Disponível</span>;
            case 'reserved': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">Reservado</span>;
            case 'sold': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Vendido</span>;
            default: return null;
        }
    };

    return (
        <section className="py-20 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Tabela de Disponibilidade</h2>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase">Unidade</th>
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase">Andar</th>
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase">Tipologia</th>
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase">Área</th>
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase">Preço</th>
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase text-center">Status</th>
                                <th className="p-4 font-semibold text-gray-700 text-sm uppercase"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {units.map((unit, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-bold text-gray-900">{unit.unit}</td>
                                    <td className="p-4 text-gray-600">{unit.floor}</td>
                                    <td className="p-4 text-gray-600">{unit.type}</td>
                                    <td className="p-4 text-gray-600">{unit.area}</td>
                                    <td className="p-4 font-semibold text-[var(--color-primary)]">{unit.price}</td>
                                    <td className="p-4 text-center">{getStatusBadge(unit.status)}</td>
                                    <td className="p-4 text-right">
                                        <button className="text-[var(--color-primary)] hover:underline text-sm font-medium">
                                            Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
