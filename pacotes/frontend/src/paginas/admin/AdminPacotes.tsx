import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Package, RefreshCw, Check, X } from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { Pacote } from '../../servicos/servico-admin';

export function AdminPacotes() {
    const [pacotes, setPacotes] = useState<Pacote[]>([]);
    const [carregando, setCarregando] = useState(true);

    const carregarPacotes = useCallback(async () => {
        try {
            setCarregando(true);
            const dados = await adminService.listarPacotes();
            setPacotes(dados.pacotes || []);
        } catch (erro: any) {
            console.error('Erro ao carregar pacotes:', erro);
            toast.error('Erro ao carregar pacotes');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarPacotes();
    }, [carregarPacotes]);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Package className="w-7 h-7 text-amber-400" />
                        Pacotes de Recarga
                    </h1>
                    <p className="text-slate-400 mt-1">Configuração de pacotes de créditos</p>
                </div>
                <button
                    onClick={carregarPacotes}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Tabela */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Nome
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Créditos
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Bônus
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Valor
                                </th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {carregando ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : pacotes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        Nenhum pacote encontrado
                                    </td>
                                </tr>
                            ) : (
                                pacotes.map(pacote => (
                                    <tr
                                        key={pacote.id}
                                        className="hover:bg-slate-700/30 transition-colors"
                                    >
                                        <td className="px-4 py-4 font-medium text-white">
                                            {pacote.nome}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-300">
                                            {pacote.creditos.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-4 text-right text-emerald-400">
                                            {pacote.creditosBonus && pacote.creditosBonus > 0
                                                ? `+${pacote.creditosBonus}`
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-right text-white font-medium">
                                            R$ {pacote.valor.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {pacote.ativo ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                                                    <Check className="w-3 h-3" />
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                                                    <X className="w-3 h-3" />
                                                    Inativo
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm">
                    💡 Para gerenciar pacotes, edite diretamente no banco de dados ou crie uma API de CRUD.
                    A promoção do dia 15 é calculada automaticamente pelo sistema.
                </p>
            </div>
        </div>
    );
}

export default AdminPacotes;
