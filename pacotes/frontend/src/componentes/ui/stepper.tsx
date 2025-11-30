import { CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface StepperEtapa {
  id: string;
  titulo: string;
  descricao?: string;
  icone?: React.ReactNode;
}

export type StatusEtapa = "pendente" | "atual" | "concluida" | "erro";

interface StepperProps {
  etapas: StepperEtapa[];
  etapaAtual: number; // índice da etapa atual (0-based)
  orientacao?: "horizontal" | "vertical";
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}

export function Stepper({
  etapas,
  etapaAtual,
  orientacao = "horizontal",
  tamanho = "md",
  className,
}: StepperProps) {
  const getStatusEtapa = (index: number): StatusEtapa => {
    if (index < etapaAtual) return "concluida";
    if (index === etapaAtual) return "atual";
    return "pendente";
  };

  const tamanhos = {
    sm: { circulo: "w-8 h-8", texto: "text-xs", icone: "w-4 h-4" },
    md: { circulo: "w-10 h-10", texto: "text-sm", icone: "w-5 h-5" },
    lg: { circulo: "w-12 h-12", texto: "text-base", icone: "w-6 h-6" },
  };

  const t = tamanhos[tamanho];

  if (orientacao === "vertical") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {etapas.map((etapa, index) => {
          const status = getStatusEtapa(index);
          return (
            <div key={etapa.id} className="flex items-start gap-3">
              {/* Círculo + Linha */}
              <div className="flex flex-col items-center">
                <StepperCirculo
                  numero={index + 1}
                  status={status}
                  icone={etapa.icone}
                  tamanho={t}
                />
                {index < etapas.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[24px] mt-1",
                      status === "concluida" ? "bg-green-400" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
              {/* Texto */}
              <div className="pt-1.5">
                <p
                  className={cn(
                    "font-medium",
                    t.texto,
                    status === "atual" && "text-blue-600",
                    status === "concluida" && "text-green-600",
                    status === "pendente" && "text-slate-400"
                  )}
                >
                  {etapa.titulo}
                </p>
                {etapa.descricao && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {etapa.descricao}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Orientação horizontal (padrão)
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {etapas.map((etapa, index) => {
        const status = getStatusEtapa(index);
        const isLast = index === etapas.length - 1;

        return (
          <div key={etapa.id} className="flex items-center flex-1 last:flex-none">
            {/* Etapa */}
            <div className="flex flex-col items-center">
              <StepperCirculo
                numero={index + 1}
                status={status}
                icone={etapa.icone}
                tamanho={t}
              />
              <span
                className={cn(
                  "mt-1 font-medium text-center max-w-[80px]",
                  t.texto,
                  status === "atual" && "text-blue-600",
                  status === "concluida" && "text-green-600",
                  status === "pendente" && "text-slate-400"
                )}
              >
                {etapa.titulo}
              </span>
            </div>

            {/* Linha conectora */}
            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-1 mx-2 rounded",
                  status === "concluida" ? "bg-green-300" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface StepperCirculoProps {
  numero: number;
  status: StatusEtapa;
  icone?: React.ReactNode;
  tamanho: { circulo: string; icone: string };
}

function StepperCirculo({ numero, status, icone, tamanho }: StepperCirculoProps) {
  const baseClasses = cn(
    tamanho.circulo,
    "rounded-full flex items-center justify-center font-bold transition-all"
  );

  if (status === "concluida") {
    return (
      <div className={cn(baseClasses, "bg-green-500 text-white")}>
        <CheckCircle2 className={tamanho.icone} />
      </div>
    );
  }

  if (status === "atual") {
    return (
      <div className={cn(baseClasses, "bg-blue-500 text-white animate-pulse")}>
        {icone || numero}
      </div>
    );
  }

  if (status === "erro") {
    return (
      <div className={cn(baseClasses, "bg-red-500 text-white")}>
        {icone || numero}
      </div>
    );
  }

  // Pendente
  return (
    <div className={cn(baseClasses, "bg-slate-200 text-slate-500")}>
      {icone || numero}
    </div>
  );
}

// Componente simplificado para uso rápido
interface StepperSimplesProps {
  etapas: string[];
  etapaAtual: number;
  className?: string;
}

export function StepperSimples({ etapas, etapaAtual, className }: StepperSimplesProps) {
  const etapasFormatadas = etapas.map((titulo, index) => ({
    id: `etapa-${index}`,
    titulo,
  }));

  return (
    <Stepper
      etapas={etapasFormatadas}
      etapaAtual={etapaAtual}
      className={className}
    />
  );
}
