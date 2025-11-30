import { CheckCircle, FileText, Info } from "lucide-react";
import { cn } from "../../../lib/utils";
import { WizardEtapaProps, TipoAgente, TEMPLATES_INFO } from "./types";

export function EtapaTipo({ dados, setDados }: WizardEtapaProps) {
  const selecionarTipoAgente = (tipo: TipoAgente) => {
    setDados(prev => ({ ...prev, tipoAgente: tipo }));
  };

  const getCorClasse = (cor: string, selecionado: boolean) => {
    if (!selecionado) return "border-slate-200 hover:border-slate-300";
    switch (cor) {
      case 'blue': return "border-blue-600 bg-blue-50 ring-2 ring-blue-200";
      case 'green': return "border-green-600 bg-green-50 ring-2 ring-green-200";
      case 'purple': return "border-purple-600 bg-purple-50 ring-2 ring-purple-200";
      default: return "border-blue-600 bg-blue-50 ring-2 ring-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Qual o foco principal do seu SDR?
        </h2>
        <p className="text-slate-500 mt-2">
          Escolha a especialidade principal do seu agente de qualificação
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(Object.entries(TEMPLATES_INFO) as [Exclude<TipoAgente, 'PERSONALIZADO'>, typeof TEMPLATES_INFO[keyof typeof TEMPLATES_INFO]][]).map(([key, template]) => (
          <button
            key={key}
            type="button"
            onClick={() => selecionarTipoAgente(key)}
            className={cn(
              "p-6 rounded-xl border-2 text-left transition-all relative",
              getCorClasse(template.cor, dados.tipoAgente === key)
            )}
          >
            {template.badge && (
              <span className={cn(
                "absolute -top-2 -right-2 text-xs font-bold px-2 py-1 rounded-full",
                "bg-blue-600 text-white"
              )}>
                {template.badge}
              </span>
            )}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{template.emoji}</span>
              <h3 className="text-lg font-bold text-slate-900">{template.nome}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">{template.descricao}</p>
            <div className="space-y-1">
              {template.habilidades.slice(0, 3).map((hab) => (
                <p key={hab} className="text-xs text-slate-500 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  {hab}
                </p>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Nota sobre suporte documental automático */}
      <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Suporte Documental Incluído
          </p>
          <p className="text-sm text-blue-900 mt-1">
            Todos os tipos de SDR incluem automaticamente assistência com documentação. 
            O agente detecta quando o lead precisa de ajuda com documentos e orienta sobre 
            RG, CPF, comprovantes, contratos e certidões.
          </p>
        </div>
      </div>
    </div>
  );
}
