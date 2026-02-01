import { useState } from 'react';
import { toast } from 'sonner';
import {
    Package,
    Rocket,
    Crown,
    Zap,
    Check,
    Edit,
    Save,
    X,
    DollarSign,
    CreditCard
} from 'lucide-react';

// Tipos
interface PlanoConfig {
    id: string;
    nome: string;
    valorMensal: number;
    creditosMensais: number;
    custoPorCreditoExtra: number;
    taxaSetup: number;
    descricao: string;
    recursos: string[];
    destaque: boolean;
    icone: 'starter' | 'growth' | 'pro';
}

// Configurações dos planos (baseado no site elyon.ia.br)
const PLANOS_INICIAIS: PlanoConfig[] = [
    {
        id: 'STARTER',
        nome: 'Starter',
        valorMensal: 199.00,
        creditosMensais: 0,
        custoPorCreditoExtra: 2.00,
        taxaSetup: 899.00,
        descricao: 'Para testar a plataforma',
        recursos: [
            '0 consultas grátis',
            'IA ilimitada inclusa',
            'Prospecção via WhatsApp',
            'Dashboard básico',
            'Suporte via email'
        ],
        destaque: false,
        icone: 'starter'
    },
    {
        id: 'GROWTH',
        nome: 'Growth',
        valorMensal: 299.00,
        creditosMensais: 100,
        custoPorCreditoExtra: 1.50,
        taxaSetup: 899.00,
        descricao: 'Para imobiliárias em crescimento',
        recursos: [
            'Tudo do plano Starter',
            '+ 100 consultas grátis/mês',
            '+ Consultas 25% mais baratas',
            '+ Suporte prioritário',
            '+ Relatórios avançados'
        ],
        destaque: false,
        icone: 'growth'
    },
    {
        id: 'PRO',
        nome: 'Pro',
        valorMensal: 499.00,
        creditosMensais: 250,
        custoPorCreditoExtra: 1.00,
        taxaSetup: 899.00,
        descricao: 'Máximo desempenho e economia',
        recursos: [
            'Tudo do plano Growth',
            '+ 250 consultas grátis/mês',
            '+ Consultas 50% mais baratas',
            '+ Suporte VIP 24/7',
            '+ Acesso antecipado a novos módulos'
        ],
        destaque: true,
        icone: 'pro'
    }
];

// Ícone do plano
function PlanoIcone({ tipo }: { tipo: 'starter' | 'growth' | 'pro' }) {
    switch (tipo) {
        case 'starter':
            return <Zap className="w-8 h-8 text-blue-400" />;
        case 'growth':
            return <Rocket className="w-8 h-8 text-emerald-400" />;
        case 'pro':
            return <Crown className="w-8 h-8 text-amber-400" />;
    }
}

// Card de Plano
function PlanoCard({
    plano,
    onEdit
}: {
    plano: PlanoConfig;
    onEdit: () => void;
}) {
    const corBorda = plano.destaque ? 'border-amber-500' : 'border-slate-700';
    const corHeader = plano.destaque
        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20'
        : 'bg-slate-700/50';

    return (
        <div className={`bg-slate-800 border-2 ${corBorda} rounded-xl overflow-hidden flex flex-col`}>
            {/* Header */}
            <div className={`p-4 ${corHeader} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    <PlanoIcone tipo={plano.icone} />
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {plano.nome}
                            {plano.destaque && (
                                <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-medium">
                                    POPULAR
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-slate-400">{plano.descricao}</p>
                    </div>
                </div>
                <button
                    onClick={onEdit}
                    className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Editar plano"
                >
                    <Edit className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            {/* Preço */}
            <div className="p-4 border-b border-slate-700">
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">
                        R$ {plano.valorMensal.toFixed(0)}
                    </span>
                    <span className="text-slate-400">/mês</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                    + R$ {plano.custoPorCreditoExtra.toFixed(2)} por proprietário
                </p>
                <p className="text-xs text-slate-500 mt-1">
                    Taxa de setup: R$ {plano.taxaSetup.toFixed(0)}
                </p>
            </div>

            {/* Créditos */}
            <div className="p-4 border-b border-slate-700 bg-slate-700/30">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-400" />
                    <span className="text-white font-medium">
                        {plano.creditosMensais} créditos/mês
                    </span>
                </div>
            </div>

            {/* Recursos */}
            <div className="p-4 flex-1">
                <ul className="space-y-2">
                    {plano.recursos.map((recurso, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            {recurso}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// Modal de Edição
function ModalEditarPlano({
    plano,
    onClose,
    onSave
}: {
    plano: PlanoConfig;
    onClose: () => void;
    onSave: (plano: PlanoConfig) => void;
}) {
    const [form, setForm] = useState<PlanoConfig>({ ...plano });
    const [salvando, setSalvando] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSalvando(true);

        // Simular delay (em produção seria uma chamada API)
        await new Promise(resolve => setTimeout(resolve, 500));

        onSave(form);
        toast.success('Plano atualizado com sucesso!');
        setSalvando(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Edit className="w-5 h-5 text-indigo-400" />
                        Editar Plano {plano.nome}
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">
                                Valor Mensal (R$)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.valorMensal}
                                onChange={e => setForm({ ...form, valorMensal: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">
                                Créditos Mensais
                            </label>
                            <input
                                type="number"
                                value={form.creditosMensais}
                                onChange={e => setForm({ ...form, creditosMensais: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">
                                Custo por Crédito Extra (R$)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.custoPorCreditoExtra}
                                onChange={e => setForm({ ...form, custoPorCreditoExtra: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-1">
                                Taxa de Setup (R$)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.taxaSetup}
                                onChange={e => setForm({ ...form, taxaSetup: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">
                            Descrição
                        </label>
                        <input
                            type="text"
                            value={form.descricao}
                            onChange={e => setForm({ ...form, descricao: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.destaque}
                                onChange={e => setForm({ ...form, destaque: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-slate-300">
                                Marcar como plano em destaque (Popular)
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
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {salvando ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>

                {/* Aviso */}
                <div className="p-4 bg-amber-500/10 border-t border-amber-500/30">
                    <p className="text-amber-400 text-sm">
                        ⚠️ <strong>Atenção:</strong> Alterações aqui são apenas visuais por hora.
                        Para alterar os valores reais, edite o arquivo <code className="bg-slate-700 px-1 rounded">servico-gestao-clientes.ts</code> no backend.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Componente Principal
export function AdminPlanos() {
    const [planos, setPlanos] = useState<PlanoConfig[]>(PLANOS_INICIAIS);
    const [editando, setEditando] = useState<PlanoConfig | null>(null);

    const handleSave = (planoAtualizado: PlanoConfig) => {
        setPlanos(prev => prev.map(p => p.id === planoAtualizado.id ? planoAtualizado : p));
        setEditando(null);
    };

    // Calcular estatísticas
    const valorMedioPlano = planos.reduce((acc, p) => acc + p.valorMensal, 0) / planos.length;
    const totalCreditos = planos.reduce((acc, p) => acc + p.creditosMensais, 0);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Package className="w-7 h-7 text-indigo-400" />
                        Gestão de Planos
                    </h1>
                    <p className="text-slate-400 mt-1">Configure os planos de assinatura da plataforma</p>
                </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Package className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Total de Planos</p>
                            <p className="text-xl font-bold text-white">{planos.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Valor Médio</p>
                            <p className="text-xl font-bold text-white">R$ {valorMedioPlano.toFixed(0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <CreditCard className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Créditos Totais/Mês</p>
                            <p className="text-xl font-bold text-white">{totalCreditos}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cards dos Planos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {planos.map(plano => (
                    <PlanoCard
                        key={plano.id}
                        plano={plano}
                        onEdit={() => setEditando(plano)}
                    />
                ))}
            </div>

            {/* Tabela Comparativa */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h2 className="font-semibold text-white">Comparativo de Planos</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Plano</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Valor/Mês</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Créditos/Mês</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Custo/Crédito Extra</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Taxa Setup</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {planos.map(plano => (
                                <tr key={plano.id} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <PlanoIcone tipo={plano.icone} />
                                            <span className="font-medium text-white">{plano.nome}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-white font-medium">
                                        R$ {plano.valorMensal.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                                        {plano.creditosMensais}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-300">
                                        R$ {plano.custoPorCreditoExtra.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-300">
                                        R$ {plano.taxaSetup.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-sm">
                    💡 <strong>Dica:</strong> Os planos são configurados no backend em <code className="bg-slate-700 px-1 rounded">CONFIGURACOES_PLANOS</code>.
                    Alterações visuais aqui servem para planejamento. Para aplicar mudanças, atualize o código no servidor.
                </p>
            </div>

            {/* Modal de Edição */}
            {editando && (
                <ModalEditarPlano
                    plano={editando}
                    onClose={() => setEditando(null)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

export default AdminPlanos;
