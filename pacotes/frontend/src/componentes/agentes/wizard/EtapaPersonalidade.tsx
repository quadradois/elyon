import { MessageSquare } from "lucide-react";
import { cn } from "../../../lib/utils";
import { WizardEtapaProps, DadosAgente } from "./types";

// Gerador de saudação
const gerarSaudacao = (d: DadosAgente) => {
  const emoji = d.personalidade.usarEmojis ? ' 😊' : '';
  switch (d.personalidade.tom) {
    case 'formal':
      return `Bom dia! Sou ${d.nome}, assistente virtual. Como posso ajudá-lo(a)?`;
    case 'entusiasta':
      return `Oi! 🎉 Aqui é a ${d.nome}! Que ótimo falar com você! Como posso ajudar?`;
    default:
      return `Olá! Sou a ${d.nome}, sua assistente virtual.${emoji} Como posso ajudar você hoje?`;
  }
};

export function EtapaPersonalidade({ dados, setDados }: WizardEtapaProps) {
  const tonsVoz = [
    { id: 'formal' as const, emoji: '👔', titulo: 'Formal', desc: 'Profissional e respeitoso' },
    { id: 'amigavel' as const, emoji: '😊', titulo: 'Amigável', desc: 'Simpático e próximo' },
    { id: 'entusiasta' as const, emoji: '🚀', titulo: 'Entusiasta', desc: 'Animado e motivador' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Como {dados.nome} se comunica?
        </h2>
        <p className="text-slate-500 mt-2">
          Defina o tom de voz e estilo de comunicação
        </p>
      </div>

      <div className="space-y-6">
        {/* Tom de Voz */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">
            Tom de Voz
          </label>
          <div className="grid grid-cols-3 gap-4">
            {tonsVoz.map((tom) => (
              <button
                key={tom.id}
                type="button"
                onClick={() => setDados({ 
                  ...dados, 
                  personalidade: { 
                    ...dados.personalidade, 
                    tom: tom.id,
                    nivelFormalidade: tom.id === 'formal' ? 5 : tom.id === 'amigavel' ? 3 : 2,
                  } 
                })}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all",
                  dados.personalidade.tom === tom.id
                    ? "border-brand bg-indigo-50 ring-2 ring-indigo-200"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <span className="text-3xl">{tom.emoji}</span>
                <h4 className="font-semibold text-slate-900 mt-2">{tom.titulo}</h4>
                <p className="text-sm text-slate-500 mt-1">{tom.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Usar Emojis */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div>
            <p className="font-medium text-slate-900">Usar emojis nas mensagens</p>
            <p className="text-sm text-slate-500">Emojis moderados tornam a conversa mais amigável</p>
          </div>
          <button
            type="button"
            title={dados.personalidade.usarEmojis ? 'Desativar emojis' : 'Ativar emojis'}
            onClick={() => setDados({ 
              ...dados, 
              personalidade: { 
                ...dados.personalidade, 
                usarEmojis: !dados.personalidade.usarEmojis 
              } 
            })}
            className={cn(
              "w-14 h-8 rounded-full transition-all relative",
              dados.personalidade.usarEmojis ? "bg-brand" : "bg-slate-300"
            )}
          >
            <span 
              className={cn(
                "absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all",
                dados.personalidade.usarEmojis ? "left-7" : "left-1"
              )}
            />
          </button>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Preview da Saudação
          </label>
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <p className="text-sm text-slate-700">
              {gerarSaudacao(dados)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
