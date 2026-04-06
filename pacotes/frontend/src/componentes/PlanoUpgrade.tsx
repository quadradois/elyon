import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Zap,
    Rocket,
    Crown,
    ArrowUpRight,
    Sparkles,
    TrendingUp,
    X
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../servicos/api";

// Tipos de plano disponíveis
type PlanoTipo = "STARTER" | "GROWTH" | "PRO";

interface PlanoInfo {
    nome: string;
    icone: React.ElementType;
    cor: string;
    corBg: string;
    corBorder: string;
    creditosMensais: number;
    custoPorCredito: number;
}

const PLANOS: Record<PlanoTipo, PlanoInfo> = {
    STARTER: {
        nome: "Starter",
        icone: Zap,
        cor: "text-indigo-500",
        corBg: "bg-brand/10",
        corBorder: "border-brand/30",
        creditosMensais: 0,
        custoPorCredito: 2.0,
    },
    GROWTH: {
        nome: "Growth",
        icone: Rocket,
        cor: "text-emerald-500",
        corBg: "bg-emerald-500/10",
        corBorder: "border-emerald-500/30",
        creditosMensais: 100,
        custoPorCredito: 1.5,
    },
    PRO: {
        nome: "Pro",
        icone: Crown,
        cor: "text-amber-500",
        corBg: "bg-amber-500/10",
        corBorder: "border-amber-500/30",
        creditosMensais: 250,
        custoPorCredito: 1.0,
    },
};

// Vantagens do upgrade
const VANTAGENS_UPGRADE: Record<PlanoTipo, string[]> = {
    STARTER: [
        "100 créditos grátis/mês",
        "Créditos 25% mais baratos",
        "Suporte prioritário",
    ],
    GROWTH: [
        "250 créditos grátis/mês",
        "Créditos 50% mais baratos",
        "Suporte VIP 24/7",
    ],
    PRO: [], // Já está no plano máximo
};

interface PlanoUpgradeProps {
    compacto?: boolean;
}

export function PlanoUpgrade({ compacto = false }: PlanoUpgradeProps) {
    const [planoAtual, setPlanoAtual] = useState<PlanoTipo>("STARTER");
    const [carregando, setCarregando] = useState(true);
    const [fechado, setFechado] = useState(false);

    useEffect(() => {
        carregarPlano();
    }, []);

    const carregarPlano = async () => {
        try {
            // Tenta carregar do backend
            const response = await api.get("/tenant/meu");
            if (response.data?.tenant?.contaCreditos?.planoTipo) {
                setPlanoAtual(response.data.tenant.contaCreditos.planoTipo);
            }
        } catch {
            // Tenta pegar do localStorage como fallback
            const tenant = JSON.parse(localStorage.getItem("elyon_tenant") || "{}");
            if (tenant.plano) {
                // Mapeia formato antigo para novo
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

    // Se já está no PRO ou fechou, não mostra
    if (planoAtual === "PRO" || fechado) {
        return null;
    }

    const plano = PLANOS[planoAtual];
    const proximoPlano: PlanoTipo = planoAtual === "STARTER" ? "GROWTH" : "PRO";
    const proximoPlanoInfo = PLANOS[proximoPlano];
    const vantagens = VANTAGENS_UPGRADE[planoAtual];
    const Icon = plano.icone;
    const ProximoIcon = proximoPlanoInfo.icone;

    if (carregando) {
        return (
            <div className={cn(
                "rounded-xl p-3 animate-pulse",
                "bg-slate-100"
            )}>
                <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-32" />
            </div>
        );
    }

    // Versão compacta para sidebar fechado
    if (compacto) {
        return (
            <Link
                to="/dashboard/upgrade"
                className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-all duration-200",
                    "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
                    "hover:from-amber-500/30 hover:to-orange-500/30",
                    "border border-amber-500/30"
                )}
                title="Fazer upgrade do plano"
            >
                <TrendingUp className="w-5 h-5 text-amber-500" />
            </Link>
        );
    }

    return (
        <div className={cn(
            "relative rounded-xl p-3 transition-all duration-300",
            "bg-gradient-to-br from-slate-50 to-slate-100",
            "border border-slate-200",
            "hover:shadow-md hover:border-slate-300"
        )}>
            {/* Botão fechar */}
            <button
                onClick={() => setFechado(true)}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-200 transition-colors opacity-0 group-hover:opacity-100"
            >
                <X className="w-3 h-3 text-slate-400" />
            </button>

            {/* Plano atual */}
            <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg", plano.corBg)}>
                    <Icon className={cn("w-4 h-4", plano.cor)} />
                </div>
                <div>
                    <p className="text-xs text-slate-500">Seu plano</p>
                    <p className="text-sm font-semibold text-slate-900">{plano.nome}</p>
                </div>
            </div>

            {/* Vantagens do próximo plano */}
            <div className={cn(
                "p-2 rounded-lg mb-2",
                "bg-gradient-to-r from-amber-50 to-orange-50",
                "border border-amber-200/50"
            )}>
                <div className="flex items-center gap-1 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">
                        Upgrade para {proximoPlanoInfo.nome}
                    </span>
                </div>
                <ul className="space-y-1">
                    {vantagens.map((v, i) => (
                        <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-amber-400" />
                            {v}
                        </li>
                    ))}
                </ul>
            </div>

            {/* CTA */}
            <Link
                to="/dashboard/upgrade"
                className={cn(
                    "flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    "bg-gradient-to-r from-amber-500 to-orange-500",
                    "hover:from-amber-600 hover:to-orange-600",
                    "text-white shadow-sm hover:shadow-md"
                )}
            >
                <ProximoIcon className="w-4 h-4" />
                Ver planos
                <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
        </div>
    );
}

export default PlanoUpgrade;
