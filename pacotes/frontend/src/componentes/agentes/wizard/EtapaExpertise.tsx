import { MapPin, Home, Target } from "lucide-react";
import { Input } from "../../ui/input";
import { cn } from "../../../lib/utils";
import { WizardEtapaProps, TIPOS_IMOVEL } from "./types";

interface EtapaExpertiseProps extends WizardEtapaProps {
  bairrosInput: string;
  setBairrosInput: (value: string) => void;
}

export function EtapaExpertise({ dados, setDados, bairrosInput, setBairrosInput }: EtapaExpertiseProps) {
  const toggleTipoImovel = (tipo: string) => {
    setDados(prev => ({
      ...prev,
      expertise: {
        ...prev.expertise,
        tiposImovel: prev.expertise.tiposImovel.includes(tipo)
          ? prev.expertise.tiposImovel.filter(t => t !== tipo)
          : [...prev.expertise.tiposImovel, tipo],
      }
    }));
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Em que {dados.nome} é especialista?
        </h2>
        <p className="text-slate-500 mt-2">
          Defina os bairros e tipos de imóvel do seu foco de atuação
        </p>
      </div>

      <div className="space-y-6">
        {/* Bairros */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Bairros de Atuação
          </label>
          <Input
            value={bairrosInput}
            onChange={(e) => setBairrosInput(e.target.value)}
            placeholder="Ex: Centro, Jardins, Bueno, Marista..."
          />
          <p className="text-xs text-slate-500">
            Separe os bairros por vírgula. O agente terá mais contexto sobre esses locais.
          </p>
        </div>

        {/* Tipos de Imóvel */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Home className="w-4 h-4" />
            Tipos de Imóvel (selecione os principais)
          </label>
          <div className="flex flex-wrap gap-2">
            {TIPOS_IMOVEL.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => toggleTipoImovel(tipo)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  dados.expertise.tiposImovel.includes(tipo)
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 p-4 rounded-lg flex items-start gap-3">
        <Target className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          <strong>Por que isso importa?</strong> Quando um lead perguntar sobre esses 
          bairros ou tipos de imóvel, {dados.nome} saberá responder com mais propriedade.
        </p>
      </div>
    </div>
  );
}
