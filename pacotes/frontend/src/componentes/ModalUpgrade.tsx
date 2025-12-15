import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    X,
    Zap,
    Rocket,
    Crown,
    ArrowRight,
    Sparkles,
    Check,
    Gift,
} from "lucide-react";
import { api } from "../servicos/api";

type PlanoTipo = "STARTER" | "GROWTH" | "PRO";

interface PlanoResumo {
    id: PlanoTipo;
    nome: string;
    icone: React.ElementType;
    cor: string;
    creditosMensais: number;
    custoPorCredito: number;
    beneficios: string[];
}

const PLANOS: PlanoResumo[] = [
    {
        id: "STARTER",
        nome: "Starter",
        icone: Zap,
        cor: "blue",
        creditosMensais: 0,
        custoPorCredito: 2.0,
        beneficios: ["IA ilimitada", "Dashboard básico"],
    },
    {
        id: "GROWTH",
        nome: "Growth",
        icone: Rocket,
        cor: "emerald",
        creditosMensais: 100,
        custoPorCredito: 1.5,
        beneficios: ["100 créditos grátis/mês", "25% de economia", "Suporte prioritário"],
    },
    {
        id: "PRO",
        nome: "Pro",
        icone: Crown,
        cor: "amber",
        creditosMensais: 250,
        custoPorCredito: 1.0,
        beneficios: ["250 créditos grátis/mês", "50% de economia", "Suporte VIP 24/7"],
    },
];

const STORAGE_KEY = "elyon_upgrade_modal_dismissed";
const DIAS_PARA_MOSTRAR_NOVAMENTE = 7;

export function ModalUpgrade() {
    const [aberto, setAberto] = useState(false);
    const [planoAtual, setPlanoAtual] = useState<PlanoTipo>("STARTER");
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        verificarSeDeveMostrar();
    }, []);

    const verificarSeDeveMostrar = async () => {
        // Verifica se foi dispensado recentemente
        const dismissedAt = localStorage.getItem(STORAGE_KEY);
        if (dismissedAt) {
            const diasPassados = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
            if (diasPassados < DIAS_PARA_MOSTRAR_NOVAMENTE) {
                setCarregando(false);
                return;
            }
        }

        // Verifica o plano atual
        try {
            const response = await api.get("/tenant/meu");
            const plano = response.data?.tenant?.contaCreditos?.planoTipo || "STARTER";
            setPlanoAtual(plano);

            // Não mostra para usuários PRO
            if (plano === "PRO") {
                setCarregando(false);
                return;
            }

            // Mostra o modal após um pequeno delay (para não ser abrupto)
            setTimeout(() => {
                setAberto(true);
                setCarregando(false);
            }, 1500);
        } catch {
            // Tenta pegar do localStorage
            const tenant = JSON.parse(localStorage.getItem("elyon_tenant") || "{}");
            const mapeamento: Record<string, PlanoTipo> = {
                SMALL_BUSINESS: "STARTER",
                STARTER: "STARTER",
                GROWTH: "GROWTH",
                PRO: "PRO",
            };
            const plano = mapeamento[tenant.plano] || "STARTER";
            setPlanoAtual(plano);

            if (plano !== "PRO") {
                setTimeout(() => {
                    setAberto(true);
                    setCarregando(false);
                }, 1500);
            } else {
                setCarregando(false);
            }
        }
    };

    const fecharModal = (naoMostrarNovamente: boolean = false) => {
        setAberto(false);
        if (naoMostrarNovamente) {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        }
    };

    if (carregando || !aberto) return null;

    const planoAtualInfo = PLANOS.find((p) => p.id === planoAtual);
    const proximoPlano: PlanoTipo = planoAtual === "STARTER" ? "GROWTH" : "PRO";
    const proximoPlanoInfo = PLANOS.find((p) => p.id === proximoPlano);

    if (!planoAtualInfo || !proximoPlanoInfo) return null;

    const ProximoIcon = proximoPlanoInfo.icone;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => fecharModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header com gradiente */}
                <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center">
                    {/* Botão fechar */}
                    <button
                        onClick={() => fecharModal(false)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    {/* Ícone */}
                    <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                        <ProximoIcon className="w-8 h-8 text-amber-500" />
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-white/80" />
                        <span className="text-white/90 text-sm font-medium">
                            Potencialize seus resultados
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-white">
                        Faça upgrade para o plano {proximoPlanoInfo.nome}
                    </h2>
                </div>

                {/* Conteúdo */}
                <div className="p-6">
                    {/* Plano atual */}
                    <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-slate-200 rounded-lg">
                            <planoAtualInfo.icone className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Seu plano atual</p>
                            <p className="font-semibold text-slate-900">{planoAtualInfo.nome}</p>
                        </div>
                    </div>

                    {/* Benefícios do upgrade */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Gift className="w-4 h-4 text-amber-500" />
                            O que você ganha com o upgrade:
                        </h3>
                        <ul className="space-y-2">
                            {proximoPlanoInfo.beneficios.map((beneficio, i) => (
                                <li key={i} className="flex items-center gap-2 text-slate-600">
                                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span>{beneficio}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Comparativo de economia */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 mb-6 border border-emerald-200">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-emerald-700 font-medium">
                                    Custo por consulta de proprietário
                                </p>
                                <p className="text-xs text-emerald-600 mt-1">
                                    Economia de R${(planoAtualInfo.custoPorCredito - proximoPlanoInfo.custoPorCredito).toFixed(2)} por consulta
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-400 line-through">
                                    R${planoAtualInfo.custoPorCredito.toFixed(2)}
                                </p>
                                <p className="text-xl font-bold text-emerald-600">
                                    R${proximoPlanoInfo.custoPorCredito.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="space-y-3">
                        <Link
                            to="/dashboard/upgrade"
                            onClick={() => fecharModal(true)}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25"
                        >
                            Ver todos os planos
                            <ArrowRight className="w-4 h-4" />
                        </Link>

                        <button
                            onClick={() => fecharModal(true)}
                            className="w-full py-3 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                        >
                            Não tenho interesse agora
                        </button>
                    </div>

                    {/* Nota */}
                    <p className="text-center text-xs text-slate-400 mt-4">
                        Esta mensagem não será exibida novamente nos próximos {DIAS_PARA_MOSTRAR_NOVAMENTE} dias
                    </p>
                </div>
            </div>
        </div>
    );
}

export default ModalUpgrade;
