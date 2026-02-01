import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Users,
    Clock,
    CheckCircle,
    TrendingUp,
    RefreshCw,
    MessageCircle,
    Check,
    UserPlus
} from 'lucide-react';
import * as adminService from '../../servicos/servico-admin';
import type { LeadVip } from '../../servicos/servico-admin';

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
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
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

export function AdminLeadsVip() {
    const [leads, setLeads] = useState<LeadVip[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [contagem, setContagem] = useState({ total: 0, naoAtendidos: 0 });

    const carregarLeads = useCallback(async () => {
        try {
            setCarregando(true);
            const dados = await adminService.listarLeadsVip();
            setLeads(dados.leads || []);
            setContagem(dados.contagem || { total: 0, naoAtendidos: 0 });
        } catch (erro: any) {
            console.error('Erro ao carregar leads:', erro);
            toast.error('Erro ao carregar leads');
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarLeads();
    }, [carregarLeads]);

    const handleMarcarAtendido = async (lead: LeadVip) => {
        if (!confirm('Marcar este lead como atendido?')) return;

        try {
            await adminService.marcarLeadAtendido(lead.id);
            toast.success('Lead marcado como atendido!');
            carregarLeads();
        } catch (erro) {
            toast.error('Erro ao marcar lead');
        }
    };

    const abrirWhatsApp = (telefone: string) => {
        const numero = telefone?.replace(/\D/g, '');
        window.open(`https://wa.me/55${numero}`, '_blank');
    };

    // Métricas
    const total = contagem.total;
    const naoAtendidos = contagem.naoAtendidos;
    const atendidos = total - naoAtendidos;
    const taxa = total > 0 ? Math.round((atendidos / total) * 100) : 0;

    const getStatusClass = (lead: LeadVip) => {
        if (lead.status === 'CONVERTIDO') return 'bg-emerald-500/10 text-emerald-400';
        if (lead.atendido) return 'bg-blue-500/10 text-blue-400';
        return 'bg-amber-500/10 text-amber-400';
    };

    const getStatusLabel = (lead: LeadVip) => {
        if (lead.status) return lead.status;
        return lead.atendido ? 'ATENDIDO' : 'NOVO';
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-7 h-7 text-indigo-400" />
                        Contatos do Site
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Corretores e imobiliárias interessados na plataforma ELYON
                    </p>
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        ⚠️ <span>Estes são prospects B2B, não leads de proprietários de imóveis</span>
                    </p>
                </div>
                <button
                    onClick={carregarLeads}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    titulo="Total de Leads"
                    valor={total}
                    icone={Users}
                    cor="text-indigo-400"
                />
                <MetricCard
                    titulo="Aguardando Atendimento"
                    valor={naoAtendidos}
                    icone={Clock}
                    cor="text-amber-400"
                />
                <MetricCard
                    titulo="Já Atendidos"
                    valor={atendidos}
                    icone={CheckCircle}
                    cor="text-emerald-400"
                />
                <MetricCard
                    titulo="Taxa de Conversão"
                    valor={`${taxa}%`}
                    icone={TrendingUp}
                    cor="text-purple-400"
                />
            </div>

            {/* Tabela */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h2 className="font-semibold text-white">Solicitações de Contato (Prospects B2B)</h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Corretores, imobiliárias e incorporadoras que preencheram o formulário no site elyon.ia.br
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Nome / Empresa
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Contato
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Plano
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    CRECI
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Data
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {carregando ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                        Nenhum lead encontrado
                                    </td>
                                </tr>
                            ) : (
                                leads.map(lead => (
                                    <tr
                                        key={lead.id}
                                        className="hover:bg-slate-700/30 transition-colors"
                                    >
                                        <td className="px-4 py-4">
                                            <div>
                                                <p className="font-medium text-white">{lead.nome}</p>
                                                <p className="text-sm text-slate-400">{lead.empresa || '-'}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div>
                                                <a
                                                    href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-emerald-400 hover:underline flex items-center gap-1"
                                                >
                                                    📱 {lead.whatsapp}
                                                </a>
                                                <p className="text-sm text-slate-400">{lead.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
                                                {lead.plano || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">
                                            {lead.tipo || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">
                                            {lead.creci || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-slate-400 text-sm">
                                            {lead.created_at
                                                ? new Date(lead.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(lead)}`}>
                                                {getStatusLabel(lead)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {!lead.atendido && (
                                                    <button
                                                        onClick={() => handleMarcarAtendido(lead)}
                                                        className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                        title="Marcar como atendido"
                                                    >
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => abrirWhatsApp(lead.whatsapp)}
                                                    className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                                                    title="Abrir WhatsApp"
                                                >
                                                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                                                </button>
                                                <button
                                                    className="p-2 hover:bg-emerald-600 bg-emerald-600/20 rounded-lg transition-colors"
                                                    title="Converter em Cliente"
                                                >
                                                    <UserPlus className="w-4 h-4 text-emerald-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default AdminLeadsVip;
