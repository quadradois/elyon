import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    Zap,
    Rocket,
    Crown,
    Check,
    ArrowRight,
    Sparkles,
    CreditCard,
    MessageSquare,
    BarChart3,
    Headphones,
    Gift,
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../servicos/api";

type PlanoTipo = "STARTER" | "GROWTH" | "PRO";

interface PlanoConfig {
    id: PlanoTipo;
    nome: string;
    valorMensal: number;
    creditosMensais: number;
    custoPorCredito: number;
    descricao: string;
    recursos: string[];
    destaque: boolean;
    icone: React.ElementType;
    cor: string;
    corGradient: string;
}

const PLANOS: PlanoConfig[] = [
    {
        id: "STARTER",
        nome: "Starter",
        valorMensal: 199,
        creditosMensais: 0,
        custoPorCredito: 2.0,
        descricao: "Para testar a plataforma",
        recursos: [
            "IA ilimitada inclusa",
            "Prospecção via WhatsApp",
            "Dashboard básico",
            "Suporte via email",
        ],
        destaque: false,
        icone: Zap,
        cor: "blue",
        corGradient: "from-blue-500 to-blue-600",
    },
    {
        id: "GROWTH",
        nome: "Growth",
        valorMensal: 299,
        creditosMensais: 100,
        custoPorCredito: 1.5,
        descricao: "Para imobiliárias em crescimento",
        recursos: [
            "Tudo do Starter",
            "100 créditos grátis/mês",
            "Créditos 25% mais baratos",
            "Suporte prioritário",
            "Relatórios avançados",
        ],
        destaque: false,
        icone: Rocket,
        cor: "emerald",
        corGradient: "from-emerald-500 to-emerald-600",
    },
    {
        id: "PRO",
        nome: "Pro",
        valorMensal: 499,
        creditosMensais: 250,
        custoPorCredito: 1.0,
        descricao: "Máximo desempenho e economia",
        recursos: [
            "Tudo do Growth",
            "250 créditos grátis/mês",
            "Créditos 50% mais baratos",
            "Suporte VIP 24/7",
            "Acesso antecipado a novos módulos",
        ],
        destaque: true,
        icone: Crown,
        cor: "amber",
        corGradient: "from-amber-500 to-orange-500",
    },
];

const BENEFICIOS = [
    {
        icone: CreditCard,
        titulo: "Economia Real",
        descricao: "Quanto mais alto o plano, mais barato cada consulta de proprietário",
    },
    {
        icone: MessageSquare,
        titulo: "IA Ilimitada",
        descricao: "Todos os planos incluem uso ilimitado do agente SDR",
    },
    {
        icone: BarChart3,
        titulo: "Mais Conversões",
        descricao: "Clientes Pro convertem 3x mais leads em negócios fechados",
    },
    {
        icone: Headphones,
        titulo: "Suporte Dedicado",
        descricao: "Quanto maior o plano, mais rápido e personalizado o atendimento",
    },
];

export function Upgrade() {
    const [planoAtual, setPlanoAtual] = useState<PlanoTipo>("STARTER");
    const [carregando, setCarregando] = useState(true);
    const [processando, setProcessando] = useState<PlanoTipo | null>(null);

    useEffect(() => {
        carregarPlano();
    }, []);

    const carregarPlano = async () => {
        try {
            const response = await api.get("/tenant/meu");
            const tenant = response.data?.tenant;

            // Tenta ler de contaCreditos primeiro, depois diretamente do tenant
            let planoFromApi = tenant?.contaCreditos?.planoTipo || tenant?.plano;

            if (planoFromApi) {
                // Mapeia planos legados para os novos nomes
                const mapeamento: Record<string, PlanoTipo> = {
                    SMALL_BUSINESS: "STARTER",
                    STARTER: "STARTER",
                    GROWTH: "GROWTH",
                    PRO: "PRO",
                };
                setPlanoAtual(mapeamento[planoFromApi] || "STARTER");

                // Atualiza localStorage com dados frescos da API
                const tenantLocal = JSON.parse(localStorage.getItem("elyon_tenant") || "{}");
                if (tenantLocal.id === tenant?.id) {
                    tenantLocal.plano = planoFromApi;
                    localStorage.setItem("elyon_tenant", JSON.stringify(tenantLocal));
                }
            }
        } catch {
            // Fallback para localStorage se a API falhar
            const tenant = JSON.parse(localStorage.getItem("elyon_tenant") || "{}");
            if (tenant.plano) {
                const mapeamento: Record<string, PlanoTipo> = {
                    SMALL_BUSINESS: "STARTER",
                    STARTER: "STARTER",
                    GROWTH: "GROWTH",
                    PRO: "PRO",
                };
                setPlanoAtual(mapeamento[tenant.plano] || "STARTER");
            }
        } finally {
            setCarregando(false);
        }
    };

    const handleUpgrade = async (planoId: PlanoTipo) => {
        if (planoId === planoAtual) {
            toast.info("Você já está neste plano!");
            return;
        }

        const planoIndex = PLANOS.findIndex(p => p.id === planoId);
        const atualIndex = PLANOS.findIndex(p => p.id === planoAtual);

        if (planoIndex < atualIndex) {
            toast.error("Downgrade de plano deve ser feito pelo suporte");
            return;
        }

        setProcessando(planoId);

        try {
            // TODO: Implementar checkout de upgrade quando backend estiver pronto
            // const response = await api.post("/assinatura/upgrade", { plano: planoId });

            // Por enquanto, simula o processo
            await new Promise(resolve => setTimeout(resolve, 1500));

            toast.success(
                "Solicitação de upgrade enviada! Nossa equipe entrará em contato.",
                { duration: 5000 }
            );

            // Redireciona para WhatsApp do suporte
            const mensagem = encodeURIComponent(
                `Olá! Gostaria de fazer upgrade do meu plano para ${PLANOS.find(p => p.id === planoId)?.nome}. Minha imobiliária é: ${localStorage.getItem("elyon_tenant") ? JSON.parse(localStorage.getItem("elyon_tenant") || "{}").nome : ""}`
            );
            window.open(`https://wa.me/5511999999999?text=${mensagem}`, "_blank");

        } catch (error: any) {
            toast.error(error.response?.data?.erro || "Erro ao processar upgrade");
        } finally {
            setProcessando(null);
        }
    };

    const getPlanoStatus = (planoId: PlanoTipo) => {
        const planoIndex = PLANOS.findIndex(p => p.id === planoId);
        const atualIndex = PLANOS.findIndex(p => p.id === planoAtual);

        if (planoId === planoAtual) return "atual";
        if (planoIndex < atualIndex) return "anterior";
        return "upgrade";
    };

    if (carregando) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 mb-4">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">
                        Potencialize seus resultados
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Escolha o plano ideal para sua imobiliária
                </h1>
                <p className="text-slate-500 max-w-2xl mx-auto">
                    Todos os planos incluem IA ilimitada e acesso completo à plataforma.
                    A diferença está nos créditos mensais e no valor por consulta de proprietário.
                </p>
            </div>

            {/* Planos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANOS.map((plano) => {
                    const Icon = plano.icone;
                    const status = getPlanoStatus(plano.id);
                    const isProcessando = processando === plano.id;

                    return (
                        <div
                            key={plano.id}
                            className={cn(
                                "relative bg-white rounded-2xl border-2 transition-all duration-300",
                                status === "atual"
                                    ? "border-brand shadow-lg shadow-blue-500/10"
                                    : plano.destaque
                                        ? "border-amber-500 shadow-xl shadow-amber-500/10 scale-105"
                                        : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
                            )}
                        >
                            {/* Badge */}
                            {plano.destaque && status !== "atual" && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-md">
                                        MAIS POPULAR
                                    </span>
                                </div>
                            )}
                            {status === "atual" && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="px-3 py-1 bg-brand text-white text-xs font-bold rounded-full shadow-md">
                                        SEU PLANO ATUAL
                                    </span>
                                </div>
                            )}

                            {/* Header do Plano */}
                            <div className="p-6 border-b border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center",
                                        `bg-${plano.cor}-100`
                                    )}>
                                        <Icon className={cn("w-6 h-6", `text-${plano.cor}-600`)} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">
                                            {plano.nome}
                                        </h3>
                                        <p className="text-sm text-slate-500">{plano.descricao}</p>
                                    </div>
                                </div>

                                {/* Preço */}
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold text-slate-900">
                                        R${plano.valorMensal}
                                    </span>
                                    <span className="text-slate-500">/mês</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-1">
                                    + R${plano.custoPorCredito.toFixed(2)} por consulta
                                </p>
                            </div>

                            {/* Créditos */}
                            <div className={cn(
                                "px-6 py-4 border-b border-slate-100",
                                plano.creditosMensais > 0 ? "bg-emerald-50" : "bg-slate-50"
                            )}>
                                <div className="flex items-center gap-2">
                                    <Gift className={cn(
                                        "w-5 h-5",
                                        plano.creditosMensais > 0 ? "text-emerald-600" : "text-slate-400"
                                    )} />
                                    <span className={cn(
                                        "font-semibold",
                                        plano.creditosMensais > 0 ? "text-emerald-700" : "text-slate-500"
                                    )}>
                                        {plano.creditosMensais > 0
                                            ? `${plano.creditosMensais} créditos grátis/mês`
                                            : "0 créditos inclusos"
                                        }
                                    </span>
                                </div>
                            </div>

                            {/* Recursos */}
                            <div className="p-6 flex-1">
                                <ul className="space-y-3">
                                    {plano.recursos.map((recurso, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <Check className={cn(
                                                "w-5 h-5 shrink-0 mt-0.5",
                                                `text-${plano.cor}-500`
                                            )} />
                                            <span className="text-slate-600">{recurso}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA */}
                            <div className="p-6 pt-0">
                                {status === "atual" ? (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 font-medium cursor-not-allowed"
                                    >
                                        Plano Atual
                                    </button>
                                ) : status === "anterior" ? (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 font-medium cursor-not-allowed"
                                    >
                                        Plano Anterior
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleUpgrade(plano.id)}
                                        disabled={isProcessando}
                                        className={cn(
                                            "w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                                            plano.destaque
                                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25"
                                                : "bg-slate-900 text-white hover:bg-slate-800"
                                        )}
                                    >
                                        {isProcessando ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Processando...
                                            </>
                                        ) : (
                                            <>
                                                Fazer Upgrade
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Benefícios */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 text-center mb-6">
                    Por que fazer upgrade?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {BENEFICIOS.map((beneficio, i) => {
                        const Icon = beneficio.icone;
                        return (
                            <div key={i} className="text-center">
                                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                    <Icon className="w-6 h-6 text-brand" />
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-1">
                                    {beneficio.titulo}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {beneficio.descricao}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* FAQ / Dúvidas */}
            <div className="text-center bg-white rounded-2xl p-8 border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                    Tem dúvidas sobre qual plano escolher?
                </h2>
                <p className="text-slate-500 mb-4">
                    Nossa equipe está pronta para ajudar você a encontrar o plano ideal.
                </p>
                <button
                    onClick={() => {
                        const mensagem = encodeURIComponent(
                            "Olá! Gostaria de tirar dúvidas sobre os planos do ELYON."
                        );
                        window.open(`https://wa.me/5511999999999?text=${mensagem}`, "_blank");
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                    <MessageSquare className="w-5 h-5" />
                    Falar com Consultor
                </button>
            </div>
        </div>
    );
}

export default Upgrade;
