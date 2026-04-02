import { useState } from 'react';
import { toast } from 'sonner';
import { X, Coins } from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { Tenant } from '../../servicos/servico-admin';

interface Props {
    tenant: Tenant;
    onClose: () => void;
    onSuccess: () => void;
}

export function ModalAdicionarCreditos({ tenant, onClose, onSuccess }: Props) {
    const [salvando, setSalvando] = useState(false);
    const [dados, setDados] = useState({
        quantidade: 100,
        tipo: 'PREPAGOS' as 'MENSAIS' | 'PREPAGOS' | 'BONUS',
        descricao: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (dados.quantidade < 1) {
            toast.error('Quantidade deve ser maior que 0');
            return;
        }

        try {
            setSalvando(true);
            await adminService.adicionarCreditos(
                tenant.id,
                dados.quantidade,
                dados.tipo,
                dados.descricao || undefined
            );
            toast.success(`${dados.quantidade} créditos adicionados!`);
            onSuccess();
        } catch (erro: any) {
            console.error('Erro ao adicionar créditos:', erro);
            toast.error(erro.response?.data?.erro || 'Erro ao adicionar créditos');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Coins className="w-5 h-5 text-amber-400" />
                        Adicionar Créditos
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Info do Cliente */}
                <div className="px-4 pt-4">
                    <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-slate-400 text-sm">Cliente</p>
                        <p className="font-medium text-white">{tenant.nome}</p>
                        <p className="text-sm text-slate-400 mt-1">
                            Saldo atual: {(tenant.creditosMensais || 0) + (tenant.creditosPrepagos || 0) + (tenant.creditosBonus || 0)} créditos
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Quantidade de Créditos
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={dados.quantidade}
                            onChange={e => setDados({ ...dados, quantidade: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Tipo de Crédito
                        </label>
                        <select
                            value={dados.tipo}
                            onChange={e => setDados({ ...dados, tipo: e.target.value as any })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="MENSAIS">Mensais (expiram no fim do ciclo)</option>
                            <option value="PREPAGOS">Pré-pagos (nunca expiram)</option>
                            <option value="BONUS">Bônus</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Descrição (opcional)
                        </label>
                        <input
                            type="text"
                            value={dados.descricao}
                            onChange={e => setDados({ ...dados, descricao: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                            placeholder="Ex: Bônus de boas-vindas"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={salvando}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {salvando ? 'Adicionando...' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
