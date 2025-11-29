import { useState } from "react";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { Bot, Save, Sparkles, MapPin, Home } from "lucide-react";

export function ConfiguracaoAgente() {
  const [loading, setLoading] = useState(false);
  const [agente, setAgente] = useState({
    nome: "Ana",
    tomDeVoz: "amigavel",
    bairros: "Centro, Jardins, Bela Vista",
    tiposImovel: "Apartamento, Casa de Condomínio",
    saudacao:
      "Olá! Sou a Ana, assistente virtual da Quadra Dois. Como posso ajudar você a encontrar seu imóvel ideal hoje?",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulação de salvamento
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    alert("Configurações do agente salvas com sucesso!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header da Página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meu Agente IA</h1>
          <p className="text-slate-500">
            Personalize a identidade e o comportamento do seu assistente
            virtual.
          </p>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Coluna da Esquerda: Identidade Visual */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              Identidade
            </h3>

            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center border-4 border-white shadow-lg">
                <Bot className="w-16 h-16 text-blue-600" />
              </div>
              <Button variant="outline" size="sm">
                Alterar Avatar
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nome do Agente
              </label>
              <Input
                value={agente.nome}
                onChange={(e) => setAgente({ ...agente, nome: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">Dica do ELYON</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Nomes humanos como "Ana" ou "Pedro" aumentam a taxa de
                  resposta em 15% comparado a "Assistente Virtual".
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Comportamento e Expertise */}
        <div className="md:col-span-2 space-y-6">
          {/* Personalidade */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900">
              Personalidade & Tom de Voz
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {["formal", "amigavel", "entusiasta"].map((tom) => (
                <button
                  key={tom}
                  type="button"
                  onClick={() => setAgente({ ...agente, tomDeVoz: tom })}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    agente.tomDeVoz === tom
                      ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <span className="capitalize font-medium">{tom}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Mensagem de Saudação
              </label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={agente.saudacao}
                onChange={(e) =>
                  setAgente({ ...agente, saudacao: e.target.value })
                }
              />
              <p className="text-xs text-slate-500">
                Esta será a primeira mensagem enviada ao lead no WhatsApp.
              </p>
            </div>
          </div>

          {/* Expertise */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900">
              Expertise Imobiliária
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Bairros de Atuação
                </label>
                <Input
                  placeholder="Ex: Centro, Jardins, Zona Sul..."
                  value={agente.bairros}
                  onChange={(e) =>
                    setAgente({ ...agente, bairros: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Tipos de Imóvel (Foco)
                </label>
                <Input
                  placeholder="Ex: Apartamentos de Alto Padrão, Casas..."
                  value={agente.tiposImovel}
                  onChange={(e) =>
                    setAgente({ ...agente, tiposImovel: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
