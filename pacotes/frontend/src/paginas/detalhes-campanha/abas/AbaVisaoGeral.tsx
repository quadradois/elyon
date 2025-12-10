import { Card, CardContent, CardHeader, CardTitle } from "../../../componentes/ui/card";
import { DollarSign } from "lucide-react";
import { CampanhaDetalhes, formatarPreco } from "../hooks/useCampanhaDetalhes";

interface AbaVisaoGeralProps {
  campanha: CampanhaDetalhes;
  estatisticasContatos: Record<string, number>;
}

export function AbaVisaoGeral({ campanha, estatisticasContatos }: AbaVisaoGeralProps) {
  const briefing = campanha.briefingEstruturado;

  return (
    <div className="space-y-6">
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
