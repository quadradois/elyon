
import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { DollarSign, Bot, Save, Loader2 } from "lucide-react";
import { Button } from "../../../componentes/ui/button";
import { CampanhaDetalhes, formatarPreco, AgenteOpcao } from "../hooks/useCampanhaDetalhes";
import { useState, useEffect } from "react";

interface AbaVisaoGeralProps {
  campanha: CampanhaDetalhes;
  estatisticasContatos: Record<string, number>;
  agentes: AgenteOpcao[];
  onAtualizar: (dados: any) => Promise<void>;
}

export function AbaVisaoGeral({ campanha, estatisticasContatos, agentes, onAtualizar }: AbaVisaoGeralProps) {
  const briefing = campanha.briefingEstruturado;
  const [agenteSelecionado, setAgenteSelecionado] = useState(campanha.agenteId || "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setAgenteSelecionado(campanha.agenteId || "");
  }, [campanha.agenteId]);

  const handleSalvarAgente = async () => {
    try {
      setSalvando(true);
      await onAtualizar({ agenteId: agenteSelecionado || null });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuração de Agente */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-900">Agente de IA Responsável</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label htmlFor="agente-select" className="text-sm font-medium text-blue-800 mb-1 block">
                Selecione o Agente para atender esta campanha:
              </label>
              <select
                id="agente-select"
                className="w-full border border-blue-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={agenteSelecionado}
                onChange={(e) => setAgenteSelecionado(e.target.value)}
              >
                <option value="">-- Sem Agente Vinculado --</option>
                {agentes.map((agente) => (
                  <option key={agente.id} value={agente.id}>
                    {agente.nome} ({agente.tipoAgente.replace('_', ' ')})
                  </option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-1">
                ⚠️ Alterar o agente afetará como os novos leads são abordados. O histórico anterior será mantido.
              </p>
            </div>
            <Button
              onClick={handleSalvarAgente}
              disabled={salvando || agenteSelecionado === (campanha.agenteId || "")}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo rápido do empreendimento */}
      {briefing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo do Empreendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 leading-relaxed">
              {campanha.briefingCompleto || 'Sem resumo disponível.'}
            </p>
            {briefing.faixa_preco && (
              <div className="mt-4 flex items-center gap-4">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-slate-900 font-medium">
                  {formatarPreco(briefing.faixa_preco.min)} - {formatarPreco(briefing.faixa_preco.max)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estatísticas de Contatos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas de Prospecção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900">{estatisticasContatos['AGUARDANDO'] || 0}</div>
              <div className="text-sm text-slate-600">Aguardando</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{estatisticasContatos['CONTATANDO'] || 0}</div>
              <div className="text-sm text-slate-600">Em Contato</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{estatisticasContatos['INTERESSADO'] || 0}</div>
              <div className="text-sm text-slate-600">Interessados</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">{estatisticasContatos['LEAD'] || 0}</div>
              <div className="text-sm text-slate-600">Leads</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
