import { Zap, Settings2, CheckCircle, GraduationCap } from "lucide-react";
import { cn } from "../../../lib/utils";
import { WizardEtapaProps } from "./types";

export function EtapaModo({ dados, setDados }: WizardEtapaProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Como você quer criar seu agente?
        </h2>
        <p className="text-slate-500 mt-2">
          Escolha entre um agente pré-treinado ou personalizado do zero
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Modo Rápido */}
        <button
          type="button"
          onClick={() => setDados({ ...dados, modoCreacao: 'PRE_TREINADO' })}
          className={cn(
            "p-8 rounded-xl border-2 text-left transition-all",
            dados.modoCreacao === 'PRE_TREINADO'
              ? "border-brand bg-indigo-50 ring-2 ring-indigo-200"
              : "border-slate-200 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <Zap className="w-6 h-6 text-brand" />
            </div>
            <span className="text-xs font-bold text-brand bg-indigo-100 px-2 py-1 rounded-full">
              RECOMENDADO
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">🎓 Modo Rápido</h3>
          <p className="text-slate-600 mb-4">
            Agente pré-treinado com conhecimento especializado. Pronto para usar em minutos.
          </p>
          <ul className="space-y-2">
            {['Conhecimento de mercado', 'Scripts otimizados', 'Tratamento de objeções', 'Funil configurado'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </button>

        {/* Modo Avançado */}
        <button
          type="button"
          onClick={() => setDados({ ...dados, modoCreacao: 'PERSONALIZADO', tipoAgente: 'PERSONALIZADO' })}
          className={cn(
            "p-8 rounded-xl border-2 text-left transition-all",
            dados.modoCreacao === 'PERSONALIZADO'
              ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200"
              : "border-slate-200 hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
              <Settings2 className="w-6 h-6 text-violet-600" />
            </div>
            <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
              AVANÇADO
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">🔧 Modo Personalizado</h3>
          <p className="text-slate-600 mb-4">
            Controle total sobre personalidade, scripts e comportamento do agente.
          </p>
          <ul className="space-y-2">
            {['Tom de voz customizado', 'Scripts próprios', 'Expertise específica', 'Configuração granular'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                <Settings2 className="w-4 h-4 text-violet-500" />
                {item}
              </li>
            ))}
          </ul>
        </button>
      </div>

      {/* Info */}
      <div className="bg-slate-50 p-4 rounded-lg flex items-start gap-3">
        <GraduationCap className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-slate-700 font-medium">Faculdade vs Cultura</p>
          <p className="text-sm text-slate-600 mt-1">
            Agentes pré-treinados vêm com "faculdade" - conhecimento especializado do mercado.
            Personalizados começam do zero, mas você define cada detalhe.
          </p>
        </div>
      </div>
    </div>
  );
}
