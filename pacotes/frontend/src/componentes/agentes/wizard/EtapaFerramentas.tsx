import { WizardEtapaProps, ToolCustomizada } from './types';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Wrench, Plus, Trash2, HelpCircle, Search, Calendar, Calculator, Code, Globe } from 'lucide-react';
import { useState, ChangeEvent } from 'react';

// Ferramentas pré-definidas sugeridas
const FERRAMENTAS_SUGERIDAS: ToolCustomizada[] = [
  {
    nome: 'buscar_imoveis',
    descricao: 'Buscar imóveis disponíveis no sistema por critérios',
    acao: 'buscar_imovel',
  },
  {
    nome: 'agendar_visita',
    descricao: 'Agendar uma visita presencial ao imóvel',
    acao: 'agendar_visita',
  },
  {
    nome: 'calcular_financiamento',
    descricao: 'Calcular parcelas e condições de financiamento',
    acao: 'calcular_financiamento',
  },
  {
    nome: 'consultar_api_externa',
    descricao: 'Consultar API externa para informações adicionais',
    acao: 'consultar_api',
  },
];

const ICONES_ACAO: Record<ToolCustomizada['acao'], React.ReactNode> = {
  'buscar_imovel': <Search className="w-4 h-4" />,
  'agendar_visita': <Calendar className="w-4 h-4" />,
  'calcular_financiamento': <Calculator className="w-4 h-4" />,
  'consultar_api': <Globe className="w-4 h-4" />,
  'custom': <Code className="w-4 h-4" />,
};

export function EtapaFerramentas({ dados, setDados }: WizardEtapaProps) {
  const [novaFerramenta, setNovaFerramenta] = useState<Partial<ToolCustomizada>>({
    nome: '',
    descricao: '',
    acao: 'custom',
  });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const adicionarFerramenta = () => {
    if (novaFerramenta.nome && novaFerramenta.descricao) {
      setDados(prev => ({
        ...prev,
        toolsCustomizadas: [
          ...(prev.toolsCustomizadas || []),
          novaFerramenta as ToolCustomizada
        ]
      }));
      setNovaFerramenta({ nome: '', descricao: '', acao: 'custom' });
      setMostrarFormulario(false);
    }
  };

  const removerFerramenta = (index: number) => {
    setDados(prev => ({
      ...prev,
      toolsCustomizadas: (prev.toolsCustomizadas || []).filter((_, i) => i !== index)
    }));
  };

  const adicionarSugerida = (ferramenta: ToolCustomizada) => {
    // Verifica se já foi adicionada
    const jaExiste = (dados.toolsCustomizadas || []).some(t => t.nome === ferramenta.nome);
    if (!jaExiste) {
      setDados(prev => ({
        ...prev,
        toolsCustomizadas: [...(prev.toolsCustomizadas || []), ferramenta]
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
          <Wrench className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold">Ferramentas (Tools)</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Defina as ações que seu agente pode executar
        </p>
      </div>

      {/* Explicação */}
      <div className="bg-emerald-100 border-2 border-emerald-400 rounded-lg p-4">
        <div className="flex gap-3">
          <HelpCircle className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">O que são Tools?</p>
            <p className="text-emerald-900 mt-1">
              Tools são ações que o agente pode executar durante a conversa, como buscar imóveis, 
              agendar visitas ou calcular financiamentos. O agente decide quando usar cada ferramenta.
            </p>
          </div>
        </div>
      </div>

      {/* Ferramentas Sugeridas */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700">
          Ferramentas Sugeridas
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FERRAMENTAS_SUGERIDAS.map(ferramenta => {
            const jaAdicionada = (dados.toolsCustomizadas || []).some(t => t.nome === ferramenta.nome);
            return (
              <button
                key={ferramenta.nome}
                type="button"
                onClick={() => adicionarSugerida(ferramenta)}
                disabled={jaAdicionada}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                  jaAdicionada 
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 cursor-not-allowed' 
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <div className="text-emerald-600">
                  {ICONES_ACAO[ferramenta.acao]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{ferramenta.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{ferramenta.descricao}</p>
                </div>
                {jaAdicionada && (
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ferramentas Adicionadas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            Ferramentas Configuradas ({(dados.toolsCustomizadas || []).length})
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Criar Tool
          </Button>
        </div>

        {/* Lista de ferramentas adicionadas */}
        {(dados.toolsCustomizadas || []).length > 0 ? (
          <div className="space-y-2">
            {(dados.toolsCustomizadas || []).map((ferramenta, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="text-slate-600">
                  {ICONES_ACAO[ferramenta.acao]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{ferramenta.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{ferramenta.descricao}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {ferramenta.acao.replace('_', ' ')}
                </Badge>
                <button
                  type="button"
                  onClick={() => removerFerramenta(index)}
                  className="text-slate-400 hover:text-red-500"
                  title="Remover ferramenta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            Nenhuma ferramenta adicionada. Clique nas sugeridas ou crie uma nova.
          </div>
        )}
      </div>

      {/* Formulário para criar nova tool */}
      {mostrarFormulario && (
        <div className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
          <h4 className="font-medium text-sm text-slate-700">Nova Ferramenta Customizada</h4>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Nome da Tool</label>
            <Input
              placeholder="Ex: consultar_disponibilidade"
              value={novaFerramenta.nome || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                setNovaFerramenta(prev => ({ ...prev, nome: e.target.value.toLowerCase().replace(/\s/g, '_') }))
              }
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Descrição</label>
            <Input
              placeholder="Ex: Verifica se o imóvel está disponível para visita"
              value={novaFerramenta.descricao || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => 
                setNovaFerramenta(prev => ({ ...prev, descricao: e.target.value }))
              }
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Tipo de Ação</label>
            <select
              title="Tipo de ação da ferramenta"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
              value={novaFerramenta.acao}
              onChange={(e) => 
                setNovaFerramenta(prev => ({ ...prev, acao: e.target.value as ToolCustomizada['acao'] }))
              }
            >
              <option value="buscar_imovel">Buscar Imóvel</option>
              <option value="agendar_visita">Agendar Visita</option>
              <option value="calcular_financiamento">Calcular Financiamento</option>
              <option value="consultar_api">Consultar API</option>
              <option value="custom">Customizada</option>
            </select>
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMostrarFormulario(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={adicionarFerramenta}
              disabled={!novaFerramenta.nome || !novaFerramenta.descricao}
            >
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
