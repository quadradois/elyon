import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Users,
    CreditCard,
    TrendingUp,
    UserCheck,
    Plus,
    Edit,
    Key,
    Pause,
    Play,
    RefreshCw,
    Coins
} from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { Tenant } from '../../servicos/servico-admin';
import { ModalNovoCliente } from '../../componentes/admin/ModalNovoCliente';
import { ModalEditarCliente } from '../../componentes/admin/ModalEditarCliente';
import { ModalAdicionarCreditos } from '../../componentes/admin/ModalAdicionarCreditos';
import { ModalResetarSenha } from '../../componentes/admin/ModalResetarSenha';

// Componente de Card de Métrica
function MetricCard({
    titulo,
    valor,
    icone: Icone,
    cor
}: {
    titulo: string;
    valor: string | number;
    icone: React.ElementType;
    cor: string;
}) {
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-sm">{titulo}</p>
                    <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
                </div>
                <div className={`p-3 rounded-lg bg-slate-700/50`}>
                    <Icone className={`w-6 h-6 ${cor}`} />
                </div>
            </div>
        </div>
    );
}

export function AdminClientes() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [carregando, setCarregando] = useState(true);

    // States dos modais
    const [modalNovo, setModalNovo] = useState(false);
    const [modalEditar, setModalEditar] = useState<Tenant | null>(null);
    const [modalCreditos, setModalCreditos] = useState<Tenant | null>(null);
    const [modalSenha, setModalSenha] = useState<Tenant | null>(null);

    // Carregar tenants
    const carregarTenants = useCallback(async () => {
        try {
            setCarregando(true);
            const dados = await adminService.listarTenants();
            setTenants(Array.isArray(dados) ? dados : []);
        } catch (erro: any) {
            console.error('Erro ao carregar clientes:', erro);
            toast.error('Erro ao carregar clientes');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarTenants();
    }, [carregarTenants]);

    // Calcular métricas
    const totalClientes = tenants.length;
    const clientesAtivos = tenants.filter(t => t.status === 'ATIVO').length;
    const totalCreditos = tenants.reduce(
        (acc, t) => acc + (t.creditosMensais || 0) + (t.creditosPrepagos || 0) + (t.creditosBonus || 0),
        0
    );
    const mrr = tenants.reduce((acc, t) => acc + (t.valorPlano || 0), 0);

    // Ações
    const handleSuspender = async (tenant: Tenant) => {
        if (!confirm(`Tem certeza que deseja SUSPENDER "${tenant.nome}"?`)) return;

        try {
            await adminService.suspenderCliente(tenant.id);
            toast.success('Cliente suspenso!');
            carregarTenants();
        } catch (erro) {
            toast.error('Erro ao suspender cliente');
        }
    };

    const handleReativar = async (tenant: Tenant) => {
        try {
            await adminService.reativarCliente(tenant.id);
            toast.success('Cliente reativado!');
            carregarTenants();
        } catch (erro) {
            toast.error('Erro ao reativar cliente');
        }
    };

    // Helper para calcular total de créditos
    const getTotalCreditos = (t: Tenant) =>
        (t.creditosMensais || 0) + (t.creditosPrepagos || 0) + (t.creditosBonus || 0);

    // Helper para classe de status
    const getStatusClass = (status: string) => {
        switch (status) {
            case 'ATIVO': return 'bg-emerald-500/10 text-emerald-400';
            case 'SUSPENSO': return 'bg-amber-500/10 text-amber-400';
            case 'CANCELADO': return 'bg-red-500/10 text-red-400';
            default: return 'bg-slate-500/10 text-slate-400';
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Clientes</h1>
                    <p className="text-slate-400 mt-1">Gerencie tenants, créditos e acessos</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={carregarTenants}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Atualizar
                    </button>
                    <button
                        onClick={() => setModalNovo(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    titulo="Total de Clientes"
                    valor={totalClientes}
                    icone={Users}
                    cor="text-indigo-400"
                />
                <MetricCard
                    titulo="Clientes Ativos"
                    valor={clientesAtivos}
                    icone={UserCheck}
                    cor="text-emerald-400"
                />
                <MetricCard
                    titulo="Créditos Totais"
                    valor={totalCreditos.toLocaleString('pt-BR')}
                    icone={CreditCard}
                    cor="text-amber-400"
                />
                <MetricCard
                    titulo="MRR"
                    valor={`R$ ${mrr.toLocaleString('pt-BR')}`}
                    icone={TrendingUp}
                    cor="text-purple-400"
                />
            </div>

            {/* Tabela */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h2 className="font-semibold text-white">Clientes (Tenants)</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Imobiliária
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Plano
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Créditos
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Renovação
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {carregando ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : tenants.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                        Nenhum cliente encontrado
                                    </td>
                                </tr>
                            ) : (
                                tenants.map(tenant => (
                                    <tr
                                        key={tenant.id}
                                        className="hover:bg-slate-700/30 transition-colors"
                                    >
                                        <td className="px-4 py-4">
                                            <div>
                                                <p className="font-medium text-white">{tenant.nome}</p>
                                                <p className="text-sm text-slate-400">{tenant.slug}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-slate-300">
                                                {tenant.planoTipo || tenant.plano || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div>
                                                <p className="font-medium text-white">{getTotalCreditos(tenant)}</p>
                                                <p className="text-xs text-slate-400">
                                                    M:{tenant.creditosMensais || 0} | P:{tenant.creditosPrepagos || 0} | B:{tenant.creditosBonus || 0}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(tenant.status)}`}>
                                                {tenant.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">
                                            {tenant.dataRenovacao
                                                ? new Date(tenant.dataRenovacao).toLocaleDateString('pt-BR')
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => setModalEditar(tenant)}
                                                    className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4 text-slate-400" />
                                                </button>
                                                <button
                                                    onClick={() => setModalCreditos(tenant)}
                                                    className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                    title="Adicionar Créditos"
                                                >
                                                    <Coins className="w-4 h-4 text-amber-400" />
                                                </button>
                                                <button
                                                    onClick={() => setModalSenha(tenant)}
                                                    className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                    title="Resetar Senha"
                                                >
                                                    <Key className="w-4 h-4 text-slate-400" />
                                                </button>
                                                {tenant.status === 'ATIVO' ? (
                                                    <button
                                                        onClick={() => handleSuspender(tenant)}
                                                        className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                        title="Suspender"
                                                    >
                                                        <Pause className="w-4 h-4 text-amber-400" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleReativar(tenant)}
                                                        className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                        title="Reativar"
                                                    >
                                                        <Play className="w-4 h-4 text-emerald-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modais */}
            {modalNovo && (
                <ModalNovoCliente
                    onClose={() => setModalNovo(false)}
                    onSuccess={() => {
                        setModalNovo(false);
                        carregarTenants();
                    }}
                />
            )}

            {modalEditar && (
                <ModalEditarCliente
                    tenant={modalEditar}
                    onClose={() => setModalEditar(null)}
                    onSuccess={() => {
                        setModalEditar(null);
                        carregarTenants();
                    }}
                />
            )}

            {modalCreditos && (
                <ModalAdicionarCreditos
                    tenant={modalCreditos}
                    onClose={() => setModalCreditos(null)}
                    onSuccess={() => {
                        setModalCreditos(null);
                        carregarTenants();
                    }}
                />
            )}

            {modalSenha && (
                <ModalResetarSenha
                    tenant={modalSenha}
                    onClose={() => setModalSenha(null)}
                />
            )}
        </div>
    );
}

export default AdminClientes;
