import { useState } from 'react';
import { toast } from 'sonner';
import { X, Edit } from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { Tenant } from '../../servicos/servico-admin';

interface Props {
    tenant: Tenant;
    onClose: () => void;
    onSuccess: () => void;
}

export function ModalEditarCliente({ tenant, onClose, onSuccess }: Props) {
    const [salvando, setSalvando] = useState(false);
    const [dados, setDados] = useState({
        nome: tenant.nome,
        email: tenant.email || '',
        telefone: tenant.telefone || '',
        planoTipo: tenant.planoTipo || tenant.plano || 'STARTER',
        status: tenant.status
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setSalvando(true);
            await adminService.editarCliente(tenant.id, dados);
            toast.success('Cliente atualizado!');
            onSuccess();
        } catch (erro: any) {
            console.error('Erro ao editar cliente:', erro);
            toast.error(erro.response?.data?.erro || 'Erro ao editar cliente');
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
                        <Edit className="w-5 h-5 text-indigo-400" />
                        Editar Cliente
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Nome da Empresa
                        </label>
                        <input
                            type="text"
                            value={dados.nome}
                            onChange={e => setDados({ ...dados, nome: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={dados.email}
                            onChange={e => setDados({ ...dados, email: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Telefone
                        </label>
                        <input
                            type="text"
                            value={dados.telefone}
                            onChange={e => setDados({ ...dados, telefone: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Plano
                        </label>
                        <select
                            value={dados.planoTipo}
                            onChange={e => setDados({ ...dados, planoTipo: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="STARTER">Starter - R$ 199/mês</option>
                            <option value="GROWTH">Growth - R$ 299/mês</option>
                            <option value="PRO">Pro - R$ 499/mês</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Status
                        </label>
                        <select
                            value={dados.status}
                            onChange={e => setDados({ ...dados, status: e.target.value as any })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="ATIVO">Ativo</option>
                            <option value="SUSPENSO">Suspenso</option>
                            <option value="CANCELADO">Cancelado</option>
                        </select>
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
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {salvando ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
