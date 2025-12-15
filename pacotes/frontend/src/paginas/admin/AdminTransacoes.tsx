import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Receipt, RefreshCw } from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { Transacao } from '../../servicos/servico-admin';

export function AdminTransacoes() {
    const [transacoes, setTransacoes] = useState<Transacao[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);

    const carregarTransacoes = useCallback(async () => {
        try {
            setCarregando(true);
            const dados = await adminService.listarTransacoes(50, pagina);
            setTransacoes(dados.transacoes || []);
            setTotalPaginas(dados.paginacao?.totalPaginas || 1);
        } catch (erro: any) {
            console.error('Erro ao carregar transações:', erro);
            toast.error('Erro ao carregar transações');
        } finally {
            setCarregando(false);
        }
    }, [pagina]);

    useEffect(() => {
        carregarTransacoes();
    }, [carregarTransacoes]);

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'CONFIRMADO': return 'bg-emerald-500/10 text-emerald-400';
            case 'PENDENTE': return 'bg-amber-500/10 text-amber-400';
            case 'ATRASADO': return 'bg-red-500/10 text-red-400';
            case 'CANCELADO': return 'bg-slate-500/10 text-slate-400';
            default: return 'bg-slate-500/10 text-slate-400';
        }
    };

    const getTipoLabel = (tipo: string) => {
        switch (tipo) {
            case 'RECARGA': return '💰 Recarga';
            case 'BONUS': return '🎁 Bônus';
            case 'UPGRADE': return '⬆️ Upgrade';
            case 'CONSUMO': return '📉 Consumo';
            default: return tipo;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Receipt className="w-7 h-7 text-purple-400" />
                        Transações
                    </h1>
                    <p className="text-slate-400 mt-1">Histórico de pagamentos e créditos</p>
                </div>
                <button
                    onClick={carregarTransacoes}
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
                                    Data
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Cliente
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Descrição
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Valor
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Créditos
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {carregando ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : transacoes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        Nenhuma transação encontrada
                                    </td>
                                </tr>
                            ) : (
                                transacoes.map(transacao => (
                                    <tr
                                        key={transacao.id}
                                        className="hover:bg-slate-700/30 transition-colors"
                                    >
                                        <td className="px-4 py-4 text-slate-300">
                                            {new Date(transacao.criadoEm).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-4 text-white font-medium">
                                            {transacao.tenantNome || transacao.tenantId.substring(0, 8)}
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">
                                            {getTipoLabel(transacao.tipo)}
                                        </td>
                                        <td className="px-4 py-4 text-slate-400 max-w-xs truncate">
                                            {transacao.descricao || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-right text-white">
                                            R$ {transacao.valor.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-right text-emerald-400 font-medium">
                                            +{transacao.creditos}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(transacao.status)}`}>
                                                {transacao.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPaginas > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
                        <button
                            onClick={() => setPagina(p => Math.max(1, p - 1))}
                            disabled={pagina === 1}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Anterior
                        </button>
                        <span className="text-slate-400">
                            Página {pagina} de {totalPaginas}
                        </span>
                        <button
                            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                            disabled={pagina === totalPaginas}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Próxima
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminTransacoes;
