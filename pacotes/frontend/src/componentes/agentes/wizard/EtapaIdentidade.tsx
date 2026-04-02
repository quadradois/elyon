import { Sparkles } from "lucide-react";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/utils";
import { WizardEtapaProps, AVATARES } from "./types";

export function EtapaIdentidade({ dados, setDados }: WizardEtapaProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Quem é seu agente?
        </h2>
        <p className="text-slate-500 mt-2">
          Escolha um nome e avatar para seu assistente virtual
        </p>
      </div>

      <div className="space-y-6">
        {/* Nome */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Nome do Agente
          </label>
          <Input
            value={dados.nome}
            onChange={(e) => setDados({ ...dados, nome: e.target.value })}
            placeholder="Ex: Sofia, Ana, Pedro..."
            className="text-center text-lg"
          />
        </div>

        {/* Avatares */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Escolha um avatar
          </label>
          <div className="grid grid-cols-6 gap-4">
            {AVATARES.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => setDados({ ...dados, avatar: av.id, nome: dados.nome || av.nome })}
                className={cn(
                  "flex flex-col items-center p-4 rounded-xl border-2 transition-all",
                  dados.avatar === av.id
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <span className="text-4xl">{av.emoji}</span>
                <span className="text-xs mt-1 text-slate-600">{av.nome}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dica */}
      <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">
          <strong>Dica:</strong> Nomes humanos como "Sofia" ou "Pedro" aumentam 
          a taxa de resposta em 15% comparado a "Assistente Virtual".
        </p>
      </div>
    </div>
  );
}
