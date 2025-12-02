/**
 * EditorBriefing - Componente de edição 100% do briefing do empreendimento
 * Permite editar todos os campos: preços, localização, condomínio, características, etc.
 */
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Save,
  X,
  Plus,
  Trash2,
  DollarSign,
  MapPin,
  Building2,
  Home,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
} from 'lucide-react';

// Tipagem do briefing estruturado
interface BriefingEstruturado {
  nome_empreendimento?: string;
  localizacao_completa?: string;
  tipo_imovel?: string;
  
  localizacao_detalhes?: {
    bairro?: string;
    caracteristica_bairro?: string;
    regiao_cidade?: string;
    pontos_referencia?: string[];
    vias_acesso?: string[];
    proximidades?: {
      shoppings?: string[];
      supermercados?: string[];
      escolas?: string[];
      hospitais?: string[];
      transporte?: string[];
    };
  };
  
  condominio?: {
    valor_estimado?: number;
    areas_lazer?: string[];
    seguranca?: string[];
    vagas_garagem?: string;
    torres?: number;
    andares?: number;
    elevador?: boolean;
  };
  
  faixa_preco?: {
    min?: number;
    max?: number;
    moeda?: string;
    fonte?: string;
    confianca?: number;
  };
  
  metragens?: Array<{
    area?: string;
    quartos?: number;
    preco_medio?: number;
  }>;
  
  caracteristicas?: Array<{ item?: string; verificado?: boolean } | string>;
  diferenciais?: string[];
  pontos_interesse?: Array<{ nome?: string; tipo?: string; distancia?: string } | string>;
  
  fontes_consultadas?: string[];
  alertas?: string[];
  confiabilidade?: number;
}

interface EditorBriefingProps {
  briefingAtual: BriefingEstruturado | null;
  resumoAtual: string;
  confiabilidade: number;
  onSalvar: (dados: { briefingCompleto: string; briefingEstruturado: BriefingEstruturado }) => Promise<void>;
}

export function EditorBriefing({
  briefingAtual,
  resumoAtual,
  confiabilidade,
  onSalvar,
}: EditorBriefingProps) {
  // Estado do briefing editável
  const [briefing, setBriefing] = useState<BriefingEstruturado>(() => ({
    nome_empreendimento: '',
    localizacao_completa: '',
    tipo_imovel: 'Apartamento',
    localizacao_detalhes: {
      bairro: '',
      caracteristica_bairro: '',
      regiao_cidade: '',
      pontos_referencia: [],
      vias_acesso: [],
      proximidades: {
        shoppings: [],
        supermercados: [],
        escolas: [],
        hospitais: [],
        transporte: [],
      },
    },
    condominio: {
      valor_estimado: 0,
      areas_lazer: [],
      seguranca: [],
      vagas_garagem: '',
      torres: 0,
      andares: 0,
      elevador: false,
    },
    faixa_preco: {
      min: 0,
      max: 0,
      moeda: 'BRL',
      fonte: 'editado manualmente',
      confianca: 1.0,
    },
    metragens: [],
    caracteristicas: [],
    diferenciais: [],
    pontos_interesse: [],
    fontes_consultadas: [],
    alertas: [],
    confiabilidade: 1.0,
    ...briefingAtual,
  }));
  
  const [resumo, setResumo] = useState(resumoAtual || '');
  const [salvando, setSalvando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'localizacao' | 'condominio' | 'precos'>('geral');
  const [modalResetOpen, setModalResetOpen] = useState(false);
  
  // Inputs temporários para adicionar itens
  const [novaCaracteristica, setNovaCaracteristica] = useState('');
  const [novoDiferencial, setNovoDiferencial] = useState('');
  const [novaAreaLazer, setNovaAreaLazer] = useState('');
  const [novaSeguranca, setNovaSeguranca] = useState('');
  const [novaViaAcesso, setNovaViaAcesso] = useState('');
  const [novaReferencia, setNovaReferencia] = useState('');

  // Carregar dados quando props mudarem
  useEffect(() => {
    if (briefingAtual) {
      setBriefing(prev => ({
        ...prev,
        ...briefingAtual,
      }));
    }
    if (resumoAtual) {
      setResumo(resumoAtual);
    }
  }, [briefingAtual, resumoAtual]);

  // Helpers para atualizar campos aninhados
  const updateLocalizacao = (campo: string, valor: any) => {
    setBriefing(prev => ({
      ...prev,
      localizacao_detalhes: {
        ...prev.localizacao_detalhes,
        [campo]: valor,
      },
    }));
  };

  const updateCondominio = (campo: string, valor: any) => {
    setBriefing(prev => ({
      ...prev,
      condominio: {
        ...prev.condominio,
        [campo]: valor,
      },
    }));
  };

  const updateFaixaPreco = (campo: string, valor: any) => {
    setBriefing(prev => ({
      ...prev,
      faixa_preco: {
        ...prev.faixa_preco,
        [campo]: valor,
      },
    }));
  };

  // Adicionar item a uma lista
  const adicionarItem = (lista: string, valor: string, limpar: () => void) => {
    if (!valor.trim()) return;
    
    setBriefing(prev => {
      const novoValor = [...(prev[lista as keyof BriefingEstruturado] as string[] || []), valor.trim()];
      return { ...prev, [lista]: novoValor };
    });
    limpar();
  };

  // Remover item de uma lista
  const removerItem = (lista: string, index: number) => {
    setBriefing(prev => {
      const novoValor = [...(prev[lista as keyof BriefingEstruturado] as string[] || [])];
      novoValor.splice(index, 1);
      return { ...prev, [lista]: novoValor };
    });
  };

  // Adicionar área de lazer ao condomínio
  const adicionarAreaLazer = () => {
    if (!novaAreaLazer.trim()) return;
    updateCondominio('areas_lazer', [...(briefing.condominio?.areas_lazer || []), novaAreaLazer.trim()]);
    setNovaAreaLazer('');
  };

  const removerAreaLazer = (index: number) => {
    const novas = [...(briefing.condominio?.areas_lazer || [])];
    novas.splice(index, 1);
    updateCondominio('areas_lazer', novas);
  };

  // Adicionar item de segurança
  const adicionarSeguranca = () => {
    if (!novaSeguranca.trim()) return;
    updateCondominio('seguranca', [...(briefing.condominio?.seguranca || []), novaSeguranca.trim()]);
    setNovaSeguranca('');
  };

  const removerSeguranca = (index: number) => {
    const novas = [...(briefing.condominio?.seguranca || [])];
    novas.splice(index, 1);
    updateCondominio('seguranca', novas);
  };

  // Adicionar via de acesso
  const adicionarViaAcesso = () => {
    if (!novaViaAcesso.trim()) return;
    updateLocalizacao('vias_acesso', [...(briefing.localizacao_detalhes?.vias_acesso || []), novaViaAcesso.trim()]);
    setNovaViaAcesso('');
  };

  const removerViaAcesso = (index: number) => {
    const novas = [...(briefing.localizacao_detalhes?.vias_acesso || [])];
    novas.splice(index, 1);
    updateLocalizacao('vias_acesso', novas);
  };

  // Adicionar ponto de referência
  const adicionarReferencia = () => {
    if (!novaReferencia.trim()) return;
    updateLocalizacao('pontos_referencia', [...(briefing.localizacao_detalhes?.pontos_referencia || []), novaReferencia.trim()]);
    setNovaReferencia('');
  };

  const removerReferencia = (index: number) => {
    const novas = [...(briefing.localizacao_detalhes?.pontos_referencia || [])];
    novas.splice(index, 1);
    updateLocalizacao('pontos_referencia', novas);
  };

  // Salvar alterações
  const salvar = async () => {
    try {
      setSalvando(true);
      
      // Atualizar confiabilidade para 100% quando editado manualmente
      const briefingFinal = {
        ...briefing,
        confiabilidade: 1.0,
        faixa_preco: {
          ...briefing.faixa_preco,
          fonte: 'editado manualmente',
          confianca: 1.0,
        },
      };
      
      await onSalvar({
        briefingCompleto: resumo,
        briefingEstruturado: briefingFinal,
      });
      
    } finally {
      setSalvando(false);
    }
  };

  // Resetar para dados originais
  const resetar = () => {
    if (briefingAtual) {
      setBriefing(briefingAtual);
    }
    if (resumoAtual) {
      setResumo(resumoAtual);
    }
    setModalResetOpen(false);
  };

  // Formatar valor monetário
  const formatarPreco = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(valor);
  };

  return (
    <div className="space-y-6">
      {/* Header com indicador de status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            confiabilidade >= 0.8 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : confiabilidade >= 0.5 
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {confiabilidade >= 0.8 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {Math.round(confiabilidade * 100)}% confiável
          </div>
          <span className="text-sm text-slate-500">
            {confiabilidade < 1.0 
              ? 'Dados coletados automaticamente - revise e complete'
              : 'Dados validados manualmente'
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalResetOpen(true)}
            className="text-slate-600"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Resetar
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Abas de edição */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1" aria-label="Tabs">
          {[
            { id: 'geral', label: 'Geral', icon: Building2 },
            { id: 'precos', label: 'Preços', icon: DollarSign },
            { id: 'localizacao', label: 'Localização', icon: MapPin },
            { id: 'condominio', label: 'Condomínio', icon: Home },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                abaAtiva === id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      <div className="space-y-6">
        {/* ABA: Geral */}
        {abaAtiva === 'geral' && (
          <div className="space-y-6">
            {/* Resumo para SDR */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Resumo para SDR
                </CardTitle>
                <CardDescription>
                  Texto que o agente de IA usará para apresentar o empreendimento aos leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none"
                  value={resumo}
                  onChange={(e) => setResumo(e.target.value)}
                  placeholder="Escreva um resumo completo do empreendimento incluindo localização, preços, diferenciais, lazer do condomínio..."
                />
                <p className="text-xs text-slate-500 mt-2">
                  💡 Dica: Inclua nome, bairro, faixa de preço, metragens, quartos, áreas de lazer e diferenciais.
                </p>
              </CardContent>
            </Card>

            {/* Dados Básicos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Básicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome do Empreendimento
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.nome_empreendimento || ''}
                      onChange={(e) => setBriefing(prev => ({ ...prev, nome_empreendimento: e.target.value }))}
                      placeholder="Ex: Reserva Buriti"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tipo de Imóvel
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.tipo_imovel || 'Apartamento'}
                      onChange={(e) => setBriefing(prev => ({ ...prev, tipo_imovel: e.target.value }))}
                      title="Tipo de Imóvel"
                    >
                      <option value="Apartamento">Apartamento</option>
                      <option value="Casa">Casa</option>
                      <option value="Cobertura">Cobertura</option>
                      <option value="Lote">Lote</option>
                      <option value="Sala Comercial">Sala Comercial</option>
                      <option value="Galpão">Galpão</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Localização Completa
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={briefing.localizacao_completa || ''}
                    onChange={(e) => setBriefing(prev => ({ ...prev, localizacao_completa: e.target.value }))}
                    placeholder="Ex: Vila Rosa, Goiânia - GO"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Características */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Características</CardTitle>
                <CardDescription>Quartos, metragens, vagas, etc.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={novaCaracteristica}
                    onChange={(e) => setNovaCaracteristica(e.target.value)}
                    placeholder="Ex: 2 quartos com 1 suíte"
                    onKeyPress={(e) => e.key === 'Enter' && adicionarItem('caracteristicas', novaCaracteristica, () => setNovaCaracteristica(''))}
                  />
                  <Button
                    variant="outline"
                    onClick={() => adicionarItem('caracteristicas', novaCaracteristica, () => setNovaCaracteristica(''))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(briefing.caracteristicas || []).map((car, idx) => {
                    const texto = typeof car === 'string' ? car : car.item || '';
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm"
                      >
                        {texto}
                        <button
                          onClick={() => removerItem('caracteristicas', idx)}
                          className="ml-1 text-slate-400 hover:text-red-500"
                          title="Remover característica"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Diferenciais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diferenciais</CardTitle>
                <CardDescription>O que destaca este empreendimento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={novoDiferencial}
                    onChange={(e) => setNovoDiferencial(e.target.value)}
                    placeholder="Ex: Vista para área verde"
                    onKeyPress={(e) => e.key === 'Enter' && adicionarItem('diferenciais', novoDiferencial, () => setNovoDiferencial(''))}
                  />
                  <Button
                    variant="outline"
                    onClick={() => adicionarItem('diferenciais', novoDiferencial, () => setNovoDiferencial(''))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {(briefing.diferenciais || []).map((dif, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg"
                    >
                      <span className="flex items-center gap-2 text-sm text-green-800">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        {dif}
                      </span>
                      <button
                        onClick={() => removerItem('diferenciais', idx)}
                        className="text-slate-400 hover:text-red-500"
                        title="Remover diferencial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ABA: Preços */}
        {abaAtiva === 'precos' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Faixa de Preço
                </CardTitle>
                <CardDescription>
                  Valores de venda do empreendimento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Preço Mínimo (R$)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.faixa_preco?.min || 0}
                      onChange={(e) => updateFaixaPreco('min', parseInt(e.target.value) || 0)}
                      placeholder="280000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Preço Máximo (R$)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.faixa_preco?.max || 0}
                      onChange={(e) => updateFaixaPreco('max', parseInt(e.target.value) || 0)}
                      placeholder="380000"
                    />
                  </div>
                </div>
                
                {/* Preview da faixa */}
                {(briefing.faixa_preco?.min || briefing.faixa_preco?.max) && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-green-800">
                      <DollarSign className="w-5 h-5" />
                      <span className="font-semibold">
                        {formatarPreco(briefing.faixa_preco?.min || 0)} - {formatarPreco(briefing.faixa_preco?.max || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metragens e preços por tipo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metragens Disponíveis</CardTitle>
                <CardDescription>Diferentes plantas e preços médios</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(briefing.metragens || []).map((m, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <input
                        type="text"
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={m.area || ''}
                        onChange={(e) => {
                          const novas = [...(briefing.metragens || [])];
                          novas[idx] = { ...novas[idx], area: e.target.value };
                          setBriefing(prev => ({ ...prev, metragens: novas }));
                        }}
                        placeholder="54m²"
                      />
                      <input
                        type="number"
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={m.quartos || ''}
                        onChange={(e) => {
                          const novas = [...(briefing.metragens || [])];
                          novas[idx] = { ...novas[idx], quartos: parseInt(e.target.value) || 0 };
                          setBriefing(prev => ({ ...prev, metragens: novas }));
                        }}
                        placeholder="2"
                      />
                      <span className="text-xs text-slate-500">quartos</span>
                      <input
                        type="number"
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={m.preco_medio || ''}
                        onChange={(e) => {
                          const novas = [...(briefing.metragens || [])];
                          novas[idx] = { ...novas[idx], preco_medio: parseInt(e.target.value) || 0 };
                          setBriefing(prev => ({ ...prev, metragens: novas }));
                        }}
                        placeholder="280000"
                      />
                      <button
                        onClick={() => {
                          const novas = [...(briefing.metragens || [])];
                          novas.splice(idx, 1);
                          setBriefing(prev => ({ ...prev, metragens: novas }));
                        }}
                        className="text-red-500 hover:text-red-700"
                        title="Remover metragem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setBriefing(prev => ({
                        ...prev,
                        metragens: [...(prev.metragens || []), { area: '', quartos: 2, preco_medio: 0 }],
                      }));
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Metragem
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ABA: Localização */}
        {abaAtiva === 'localizacao' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-600" />
                  Detalhes da Localização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.localizacao_detalhes?.bairro || ''}
                      onChange={(e) => updateLocalizacao('bairro', e.target.value)}
                      placeholder="Vila Rosa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Característica do Bairro
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.localizacao_detalhes?.caracteristica_bairro || ''}
                      onChange={(e) => updateLocalizacao('caracteristica_bairro', e.target.value)}
                      title="Característica do Bairro"
                    >
                      <option value="">Selecione...</option>
                      <option value="Residencial">Residencial</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Misto">Misto</option>
                      <option value="Nobre">Nobre</option>
                      <option value="Popular">Popular</option>
                      <option value="Em desenvolvimento">Em desenvolvimento</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Região da Cidade
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={briefing.localizacao_detalhes?.regiao_cidade || ''}
                    onChange={(e) => updateLocalizacao('regiao_cidade', e.target.value)}
                    placeholder="Região Sudoeste"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Vias de Acesso */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vias de Acesso</CardTitle>
                <CardDescription>Avenidas, rodovias e vias principais próximas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={novaViaAcesso}
                    onChange={(e) => setNovaViaAcesso(e.target.value)}
                    placeholder="Ex: Av. T-63, BR-153"
                    onKeyPress={(e) => e.key === 'Enter' && adicionarViaAcesso()}
                  />
                  <Button variant="outline" onClick={adicionarViaAcesso}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(briefing.localizacao_detalhes?.vias_acesso || []).map((via, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100"
                    >
                      {via}
                      <button
                        onClick={() => removerViaAcesso(idx)}
                        className="ml-1 text-blue-400 hover:text-red-500"
                        title="Remover via de acesso"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pontos de Referência */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pontos de Referência</CardTitle>
                <CardDescription>Shoppings, mercados, hospitais próximos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={novaReferencia}
                    onChange={(e) => setNovaReferencia(e.target.value)}
                    placeholder="Ex: Shopping Passeio das Águas - 3km"
                    onKeyPress={(e) => e.key === 'Enter' && adicionarReferencia()}
                  />
                  <Button variant="outline" onClick={adicionarReferencia}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {(briefing.localizacao_detalhes?.pontos_referencia || []).map((ref, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                    >
                      <span className="flex items-center gap-2 text-sm text-slate-700">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {ref}
                      </span>
                      <button
                        onClick={() => removerReferencia(idx)}
                        className="text-slate-400 hover:text-red-500"
                        title="Remover ponto de referência"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ABA: Condomínio */}
        {abaAtiva === 'condominio' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="w-5 h-5 text-purple-600" />
                  Dados do Condomínio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Valor Condomínio (R$/mês)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.condominio?.valor_estimado || ''}
                      onChange={(e) => updateCondominio('valor_estimado', parseInt(e.target.value) || 0)}
                      placeholder="350"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Vagas de Garagem
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.condominio?.vagas_garagem || ''}
                      onChange={(e) => updateCondominio('vagas_garagem', e.target.value)}
                      placeholder="1 vaga coberta"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Torres
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.condominio?.torres || ''}
                      onChange={(e) => updateCondominio('torres', parseInt(e.target.value) || 0)}
                      placeholder="2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Andares por Torre
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      value={briefing.condominio?.andares || ''}
                      onChange={(e) => updateCondominio('andares', parseInt(e.target.value) || 0)}
                      placeholder="8"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={briefing.condominio?.elevador || false}
                        onChange={(e) => updateCondominio('elevador', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">Possui Elevador</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Áreas de Lazer */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Áreas de Lazer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={novaAreaLazer}
                    onChange={(e) => setNovaAreaLazer(e.target.value)}
                    placeholder="Ex: Piscina adulto, Academia, Churrasqueira"
                    onKeyPress={(e) => e.key === 'Enter' && adicionarAreaLazer()}
                  />
                  <Button variant="outline" onClick={adicionarAreaLazer}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(briefing.condominio?.areas_lazer || []).map((area, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm border border-purple-100"
                    >
                      ✨ {area}
                      <button
                        onClick={() => removerAreaLazer(idx)}
                        className="ml-1 text-purple-400 hover:text-red-500"
                        title="Remover área de lazer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Sugestões rápidas */}
                <div className="flex flex-wrap gap-1 pt-2">
                  <span className="text-xs text-slate-500 mr-2">Adicionar:</span>
                  {['Piscina adulto', 'Piscina infantil', 'Academia', 'Churrasqueira', 'Salão de festas', 'Playground', 'Quadra esportiva', 'Sauna'].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => {
                        if (!(briefing.condominio?.areas_lazer || []).includes(sug)) {
                          updateCondominio('areas_lazer', [...(briefing.condominio?.areas_lazer || []), sug]);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                      title={`Adicionar ${sug}`}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Segurança */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    value={novaSeguranca}
                    onChange={(e) => setNovaSeguranca(e.target.value)}
                    placeholder="Ex: Portaria 24h, Câmeras de segurança"
                    onKeyPress={(e) => e.key === 'Enter' && adicionarSeguranca()}
                  />
                  <Button variant="outline" onClick={adicionarSeguranca}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(briefing.condominio?.seguranca || []).map((seg, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100"
                    >
                      🔒 {seg}
                      <button
                        onClick={() => removerSeguranca(idx)}
                        className="ml-1 text-green-400 hover:text-red-500"
                        title="Remover item de segurança"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Sugestões rápidas */}
                <div className="flex flex-wrap gap-1 pt-2">
                  <span className="text-xs text-slate-500 mr-2">Adicionar:</span>
                  {['Portaria 24h', 'Câmeras de segurança', 'Cerca elétrica', 'Controle de acesso', 'Guarita blindada'].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => {
                        if (!(briefing.condominio?.seguranca || []).includes(sug)) {
                          updateCondominio('seguranca', [...(briefing.condominio?.seguranca || []), sug]);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                      title={`Adicionar ${sug}`}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de confirmação de reset */}
      <Dialog open={modalResetOpen} onOpenChange={setModalResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Resetar Alterações
            </DialogTitle>
            <DialogDescription>
              Deseja desfazer todas as alterações e voltar aos dados originais da pesquisa?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalResetOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={resetar} className="bg-amber-600 hover:bg-amber-700 text-white">
              Sim, Resetar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
