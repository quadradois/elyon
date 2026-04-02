import { useState } from 'react';
import { toast } from 'sonner';
import { X, Building2, User, CreditCard } from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';

interface Props {
    onClose: () => void;
    onSuccess: (credenciais: { email: string; senha: string }) => void;
}

export function ModalNovoCliente({ onClose, onSuccess }: Props) {
    const [salvando, setSalvando] = useState(false);
    const [dados, setDados] = useState({
        nomeEmpresa: '',
        slug: '',
        email: '',
        telefone: '',
        cnpj: '',
        cidade: '',
        planoTipo: 'STARTER' as 'STARTER' | 'GROWTH' | 'PRO',
        nomeAdmin: '',
        emailAdmin: '',
        senhaAdmin: '',
        integrarAsaas: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!dados.nomeEmpresa || !dados.email || !dados.nomeAdmin || !dados.emailAdmin) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        try {
            setSalvando(true);
            const resultado = await adminService.criarCliente({
                ...dados,
                slug: dados.slug || undefined,
                telefone: dados.telefone || undefined,
                cnpj: dados.cnpj || undefined,
                cidade: dados.cidade || undefined,
                senhaAdmin: dados.senhaAdmin || undefined
            });

            toast.success('Cliente criado com sucesso!');

            // Mostrar credenciais
            if (resultado.credenciais) {
                toast.info(
                    `Credenciais:\nEmail: ${resultado.credenciais.email}\nSenha: ${resultado.credenciais.senha}`,
                    { duration: 15000 }
                );
            }

            onSuccess(resultado.credenciais);
        } catch (erro: any) {
            console.error('Erro ao criar cliente:', erro);
            toast.error(erro.response?.data?.erro || 'Erro ao criar cliente');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-emerald-400" />
                        Novo Cliente
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-6">
                    {/* Dados da Empresa */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Dados da Empresa
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    Nome da Empresa *
                                </label>
                                <input
                                    type="text"
                                    value={dados.nomeEmpresa}
                                    onChange={e => setDados({ ...dados, nomeEmpresa: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="Ex: Imobiliária XYZ"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    Slug (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={dados.slug}
                                    onChange={e => setDados({ ...dados, slug: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="imobiliaria-xyz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    Email da Empresa *
                                </label>
                                <input
                                    type="email"
                                    value={dados.email}
                                    onChange={e => setDados({ ...dados, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="contato@empresa.com"
                                    required
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
                                    placeholder="(62) 99999-9999"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    CNPJ
                                </label>
                                <input
                                    type="text"
                                    value={dados.cnpj}
                                    onChange={e => setDados({ ...dados, cnpj: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="00.000.000/0001-00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    Cidade
                                </label>
                                <input
                                    type="text"
                                    value={dados.cidade}
                                    onChange={e => setDados({ ...dados, cidade: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="Goiânia"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Plano */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Plano
                        </h4>
                        <select
                            value={dados.planoTipo}
                            onChange={e => setDados({ ...dados, planoTipo: e.target.value as any })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="STARTER">Starter - R$ 199/mês (0 créditos)</option>
                            <option value="GROWTH">Growth - R$ 299/mês (100 créditos)</option>
                            <option value="PRO">Pro - R$ 499/mês (250 créditos)</option>
                        </select>
                    </div>

                    {/* Usuário Admin */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Usuário Administrador
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    Nome do Admin *
                                </label>
                                <input
                                    type="text"
                                    value={dados.nomeAdmin}
                                    onChange={e => setDados({ ...dados, nomeAdmin: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="João Silva"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-1">
                                    Email do Admin *
                                </label>
                                <input
                                    type="email"
                                    value={dados.emailAdmin}
                                    onChange={e => setDados({ ...dados, emailAdmin: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="joao@empresa.com"
                                    required
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm text-slate-300 mb-1">
                                    Senha (deixe vazio para gerar)
                                </label>
                                <input
                                    type="text"
                                    value={dados.senhaAdmin}
                                    onChange={e => setDados({ ...dados, senhaAdmin: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                                    placeholder="Será gerada automaticamente"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Opções */}
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={dados.integrarAsaas}
                                onChange={e => setDados({ ...dados, integrarAsaas: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-slate-300">
                                Cadastrar no Asaas (para cobrança recorrente)
                            </span>
                        </label>
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
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {salvando ? 'Criando...' : 'Criar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
