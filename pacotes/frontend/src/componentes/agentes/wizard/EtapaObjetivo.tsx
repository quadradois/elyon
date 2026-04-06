import { WizardEtapaProps } from './types';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Target, AlertTriangle, Lightbulb, X } from 'lucide-react';
import { useState, ChangeEvent } from 'react';

export function EtapaObjetivo({ dados, setDados }: WizardEtapaProps) {
  const [novaRestricao, setNovaRestricao] = useState('');

  const adicionarRestricao = () => {
    if (novaRestricao.trim()) {
      setDados(prev => ({
        ...prev,
        restricoes: [...(prev.restricoes || []), novaRestricao.trim()]
      }));
      setNovaRestricao('');
    }
  };

  const removerRestricao = (index: number) => {
    setDados(prev => ({
      ...prev,
      restricoes: (prev.restricoes || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center">
          <Target className="w-8 h-8 text-violet-600" />
        </div>
        <h2 className="text-2xl font-bold">Objetivo e Contexto</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Defina claramente o que seu agente deve fazer
        </p>
      </div>

      {/* Aviso Modo Avançado */}
      <div className="bg-amber-100 border-2 border-amber-400 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Modo Avançado</p>
            <p className="text-amber-900 mt-1">
              Você terá controle total sobre o comportamento do agente. 
              A QuadraDois não se responsabiliza por respostas geradas em modo personalizado.
            </p>
          </div>
        </div>
      </div>

      {/* Objetivo */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Target className="w-4 h-4" />
          Objetivo do Agente *
        </label>
        <textarea
          placeholder="Ex: Qualificar leads interessados em imóveis de alto padrão na região Sul de Goiânia, identificando poder de compra e urgência..."
          className="w-full min-h-[120px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          value={dados.objetivo || ''}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDados(prev => ({ ...prev, objetivo: e.target.value }))}
        />
        <p className="text-xs text-gray-500">
          Descreva claramente qual o objetivo principal do seu agente. 
          Seja específico sobre o tipo de atendimento esperado.
        </p>
      </div>

      {/* Contexto */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Lightbulb className="w-4 h-4" />
          Contexto Adicional
        </label>
        <textarea
          placeholder="Ex: Trabalhamos apenas com imóveis acima de R$ 500.000. Nossa imobiliária está no mercado há 15 anos e é conhecida pelo atendimento premium..."
          className="w-full min-h-[100px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          value={dados.contexto || ''}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDados(prev => ({ ...prev, contexto: e.target.value }))}
        />
        <p className="text-xs text-gray-500">
          Informações adicionais que ajudem o agente a entender o contexto do negócio.
        </p>
      </div>

      {/* Restrições */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <AlertTriangle className="w-4 h-4" />
          Restrições e Limitações
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Nunca prometer descontos, Não fornecer informações financeiras..."
            value={novaRestricao}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNovaRestricao(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarRestricao())}
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={adicionarRestricao}
            disabled={!novaRestricao.trim()}
          >
            Adicionar
          </Button>
        </div>
        
        {(dados.restricoes || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {(dados.restricoes || []).map((restricao, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="flex items-center gap-1 py-1"
              >
                {restricao}
                <button
                  type="button"
                  onClick={() => removerRestricao(index)}
                  className="ml-1 hover:text-red-500"
                  title="Remover restrição"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        
        <p className="text-xs text-gray-500">
          Defina o que o agente NÃO deve fazer ou falar.
        </p>
      </div>
    </div>
  );
}
