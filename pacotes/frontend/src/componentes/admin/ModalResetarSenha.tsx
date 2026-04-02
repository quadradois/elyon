import { useState } from 'react';
import { toast } from 'sonner';
import { X, Key, Copy, Check } from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { Tenant } from '../../servicos/servico-admin';

interface Props {
    tenant: Tenant;
    onClose: () => void;
}

export function ModalResetarSenha({ tenant, onClose }: Props) {
    const [salvando, setSalvando] = useState(false);
    const [novaSenha, setNovaSenha] = useState('');
    const [resultado, setResultado] = useState<{ email: string; novaSenha: string } | null>(null);
    const [copiado, setCopiado] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setSalvando(true);
            const res = await adminService.resetarSenha(tenant.id, novaSenha || undefined);
            setResultado({
                email: res.email,
                novaSenha: res.novaSenha
            });
            toast.success('Senha resetada com sucesso!');
        } catch (erro: any) {
            console.error('Erro ao resetar senha:', erro);
            toast.error(erro.response?.data?.erro || 'Erro ao resetar senha');
        } finally {
            setSalvando(false);
        }
    };

    const copiarCredenciais = () => {
        if (resultado) {
            navigator.clipboard.writeText(`Email: ${resultado.email}\nSenha: ${resultado.novaSenha}`);
            setCopiado(true);
            toast.success('Credenciais copiadas!');
            setTimeout(() => setCopiado(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-400" />
                        {resultado ? 'Senha Resetada' : 'Resetar Senha'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {resultado ? (
                    /* Exibir Resultado */
                    <div className="p-4 space-y-4">
                        <p className="text-slate-400 text-center">
                            Envie estas credenciais ao cliente:
                        </p>

                        <div className="bg-slate-900 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Email:</span>
                                <span className="text-white font-medium">{resultado.email}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Senha:</span>
                                <code className="bg-indigo-600 text-white px-2 py-1 rounded">
                                    {resultado.novaSenha}
                                </code>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                            <button
                                onClick={copiarCredenciais}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                            >
                                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copiado ? 'Copiado!' : 'Copiar'}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Form */
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
                        <div className="bg-slate-900 rounded-lg p-3">
                            <p className="text-slate-400 text-sm">Resetando senha de:</p>
                            <p className="font-medium text-white">{tenant.nome}</p>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-300 mb-1">
                                Nova Senha (opcional)
                            </label>
                            <input
                                type="text"
                                value={novaSenha}
                                onChange={e => setNovaSenha(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Deixe vazio para gerar automaticamente"
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
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {salvando ? 'Resetando...' : 'Resetar Senha'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
