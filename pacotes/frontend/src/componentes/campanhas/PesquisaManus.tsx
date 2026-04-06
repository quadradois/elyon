/**
 * COMPONENTE DE PESQUISA DE EMPREENDIMENTO VIA MANUS
 * 
 * Modal para iniciar e acompanhar pesquisas de empreendimento
 * usando a API Manus (IA autônoma) ou preenchimento manual
 */

import { useState, useEffect } from "react";
import { api } from "../../servicos/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Progress } from "../ui/progress";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Brain,
  Building2,
  MapPin,
  RefreshCw,
  FileText,
  Edit3,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

// ============================================
// TIPOS
// ============================================

interface PesquisaManusProps {
  aberto: boolean;
  onFechar: () => void;
  // Dados pré-preenchidos (da campanha ou lista)
  dadosIniciais?: {
    nomeEmpreendimento?: string;
    construtora?: string;
    endereco?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    campanhaId?: string;
  };
  // Callback quando a pesquisa for aplicada
  onAplicado?: (empreendimentoId: string) => void;
}

interface Pesquisa {
  id: string;
  taskId: string;
  taskUrl?: string;
  shareUrl?: string;
  status: "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";
  resultado?: string;
  erro?: string;
}

// ============================================
// COMPONENTE
// ============================================

export function PesquisaManusModal({
  aberto,
  onFechar,
  dadosIniciais,
  onAplicado,
}: PesquisaManusProps) {
  // Form
  const [nomeEmpreendimento, setNomeEmpreendimento] = useState(dadosIniciais?.nomeEmpreendimento || "");
  const [construtora, setConstrutora] = useState(dadosIniciais?.construtora || "");
  const [endereco, setEndereco] = useState(dadosIniciais?.endereco || "");
  const [bairro, setBairro] = useState(dadosIniciais?.bairro || "");
  const [cidade, setCidade] = useState(dadosIniciais?.cidade || "Goiânia");
  const [estado, setEstado] = useState(dadosIniciais?.estado || "GO");

  // Estado
  const [iniciando, setIniciando] = useState(false);
  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  
  // Modo manual (fallback quando Manus não funciona)
  const [modoManual, setModoManual] = useState(false);
  const [briefingManual, setBriefingManual] = useState({
    descricao: "",
    diferenciais: "",
    publicoAlvo: "",
    faixaPreco: "",
    tipologia: "",
    areaUtil: "",
    dataEntrega: "",
    infraestrutura: "",
    localizacao: "",
  });

  // Auto-polling quando pesquisa está em andamento
  useEffect(() => {
    if (!pesquisa) return;
    if (pesquisa.status === "CONCLUIDO" || pesquisa.status === "ERRO") return;

    const interval = setInterval(() => {
      verificarStatus();
    }, 10000); // Verificar a cada 10 segundos

    return () => clearInterval(interval);
  }, [pesquisa?.id, pesquisa?.status]);

  // Simular progresso durante pesquisa
  useEffect(() => {
    if (!pesquisa || pesquisa.status === "CONCLUIDO" || pesquisa.status === "ERRO") {
      return;
    }

    const interval = setInterval(() => {
      setProgresso(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 5;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [pesquisa?.status]);

  // Resetar ao abrir
  useEffect(() => {
    if (aberto) {
      setNomeEmpreendimento(dadosIniciais?.nomeEmpreendimento || "");
      setConstrutora(dadosIniciais?.construtora || "");
      setEndereco(dadosIniciais?.endereco || "");
      setBairro(dadosIniciais?.bairro || "");
      setCidade(dadosIniciais?.cidade || "Goiânia");
      setEstado(dadosIniciais?.estado || "GO");
      setPesquisa(null);
      setProgresso(0);
      setModoManual(false);
      setBriefingManual({
        descricao: "",
        diferenciais: "",
        publicoAlvo: "",
        faixaPreco: "",
        tipologia: "",
        areaUtil: "",
        dataEntrega: "",
        infraestrutura: "",
        localizacao: "",
      });
    }
  }, [aberto, dadosIniciais]);

  // ============================================
  // FUNÇÕES
  // ============================================

  const iniciarPesquisa = async () => {
    if (!nomeEmpreendimento.trim()) {
      toast.error("Nome do empreendimento é obrigatório");
      return;
    }

    if (!cidade.trim()) {
      toast.error("Cidade é obrigatória");
      return;
    }

    try {
      setIniciando(true);
      setProgresso(0);

      const response = await api.post("/pesquisas", {
        nomeEmpreendimento: nomeEmpreendimento.trim(),
        construtora: construtora.trim() || undefined,
        endereco: endereco.trim() || undefined,
        bairro: bairro.trim() || undefined,
        cidade: cidade.trim(),
        estado: estado.trim() || undefined,
        campanhaId: dadosIniciais?.campanhaId,
      });

      if (response.data.sucesso) {
        setPesquisa(response.data.pesquisa);
        setProgresso(10);
        toast.success("Pesquisa iniciada!", {
          description: "A IA está pesquisando informações sobre o empreendimento...",
        });
      }
    } catch (error: any) {
      console.error("Erro ao iniciar pesquisa:", error);
      const msg = error.response?.data?.erro || "Erro ao iniciar pesquisa";
      toast.error(msg);
    } finally {
      setIniciando(false);
    }
  };

  const verificarStatus = async () => {
    if (!pesquisa?.id) return;

    try {
      setVerificando(true);

      const response = await api.post(`/pesquisas/${pesquisa.id}/verificar`);

      if (response.data.sucesso) {
        const novoStatus = response.data.pesquisa;
        setPesquisa(prev => ({
          ...prev!,
          ...novoStatus,
        }));

        if (novoStatus.status === "CONCLUIDO") {
          setProgresso(100);
          toast.success("Pesquisa concluída!", {
            description: "Revise os resultados e aplique como briefing.",
          });
        } else if (novoStatus.status === "ERRO") {
          toast.error("Pesquisa falhou", {
            description: novoStatus.erro || "Erro desconhecido",
          });
        }
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    } finally {
      setVerificando(false);
    }
  };

  const aplicarResultado = async () => {
    if (!pesquisa?.id) return;

    try {
      setAplicando(true);

      const response = await api.post(`/pesquisas/${pesquisa.id}/aplicar`);

      if (response.data.sucesso) {
        toast.success("Briefing aplicado com sucesso!", {
          description: `Empreendimento "${response.data.empreendimento.nome}" atualizado`,
        });

        if (onAplicado) {
          onAplicado(response.data.empreendimento.id);
        }

        onFechar();
      }
    } catch (error: any) {
      console.error("Erro ao aplicar:", error);
      const msg = error.response?.data?.erro || "Erro ao aplicar briefing";
      toast.error(msg);
    } finally {
      setAplicando(false);
    }
  };

  // Salvar briefing manual diretamente na campanha
  const salvarBriefingManual = async () => {
    if (!dadosIniciais?.campanhaId) {
      toast.error("ID da campanha não encontrado");
      return;
    }

    // Montar o texto do briefing a partir dos campos
    const partes = [];
    
    if (briefingManual.descricao) {
      partes.push(`## Descrição do Empreendimento\n${briefingManual.descricao}`);
    }
    if (briefingManual.tipologia) {
      partes.push(`## Tipologia\n${briefingManual.tipologia}`);
    }
    if (briefingManual.areaUtil) {
      partes.push(`## Área Útil\n${briefingManual.areaUtil}`);
    }
    if (briefingManual.faixaPreco) {
      partes.push(`## Faixa de Preço\n${briefingManual.faixaPreco}`);
    }
    if (briefingManual.diferenciais) {
      partes.push(`## Diferenciais\n${briefingManual.diferenciais}`);
    }
    if (briefingManual.publicoAlvo) {
      partes.push(`## Público-Alvo\n${briefingManual.publicoAlvo}`);
    }
    if (briefingManual.infraestrutura) {
      partes.push(`## Infraestrutura e Lazer\n${briefingManual.infraestrutura}`);
    }
    if (briefingManual.localizacao) {
      partes.push(`## Localização e Entorno\n${briefingManual.localizacao}`);
    }
    if (briefingManual.dataEntrega) {
      partes.push(`## Previsão de Entrega\n${briefingManual.dataEntrega}`);
    }

    const briefingCompleto = partes.join("\n\n");

    if (!briefingCompleto.trim()) {
      toast.error("Preencha pelo menos a descrição do empreendimento");
      return;
    }

    try {
      setAplicando(true);

      // Atualizar campanha com o briefing
      const response = await api.patch(`/campanhas/${dadosIniciais.campanhaId}`, {
        briefingCompleto,
        briefingValidado: true, // Marcar como validado já que foi preenchido manualmente
      });

      if (response.data) {
        toast.success("Briefing salvo com sucesso!", {
          description: "O briefing manual foi aplicado à campanha.",
        });
        
        if (onAplicado) {
          onAplicado(dadosIniciais.campanhaId);
        }
        
        onFechar();
      }
    } catch (error: any) {
      console.error("Erro ao salvar briefing manual:", error);
      const msg = error.response?.data?.erro || "Erro ao salvar briefing";
      toast.error(msg);
    } finally {
      setAplicando(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modoManual ? (
              <>
                <Edit3 className="w-5 h-5 text-brand" />
                Briefing Manual
              </>
            ) : (
              <>
                <Brain className="w-5 h-5 text-violet-600" />
                Pesquisa de Empreendimento via IA
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {modoManual 
              ? "Preencha manualmente as informações do empreendimento."
              : "A IA irá pesquisar informações completas sobre o empreendimento na web."
            }
          </DialogDescription>
        </DialogHeader>

        {/* MODO MANUAL - FORMULÁRIO DE BRIEFING */}
        {modoManual && (
          <div className="space-y-4 py-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setModoManual(false)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para pesquisa IA
            </Button>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Descrição do Empreendimento *
                </label>
                <Textarea
                  value={briefingManual.descricao}
                  onChange={(e) => setBriefingManual(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva o empreendimento: tipo (apartamento, casa, lote), quantidade de unidades, torres, etc."
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Tipologia
                  </label>
                  <Input
                    value={briefingManual.tipologia}
                    onChange={(e) => setBriefingManual(prev => ({ ...prev, tipologia: e.target.value }))}
                    placeholder="Ex: 2 e 3 quartos, suíte"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Área Útil
                  </label>
                  <Input
                    value={briefingManual.areaUtil}
                    onChange={(e) => setBriefingManual(prev => ({ ...prev, areaUtil: e.target.value }))}
                    placeholder="Ex: 45m² a 75m²"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Faixa de Preço
                  </label>
                  <Input
                    value={briefingManual.faixaPreco}
                    onChange={(e) => setBriefingManual(prev => ({ ...prev, faixaPreco: e.target.value }))}
                    placeholder="Ex: R$ 250.000 a R$ 400.000"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Previsão de Entrega
                  </label>
                  <Input
                    value={briefingManual.dataEntrega}
                    onChange={(e) => setBriefingManual(prev => ({ ...prev, dataEntrega: e.target.value }))}
                    placeholder="Ex: Dezembro/2026"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Diferenciais
                </label>
                <Textarea
                  value={briefingManual.diferenciais}
                  onChange={(e) => setBriefingManual(prev => ({ ...prev, diferenciais: e.target.value }))}
                  placeholder="Lista os diferenciais: varanda gourmet, piscina, academia, etc."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Público-Alvo
                </label>
                <Input
                  value={briefingManual.publicoAlvo}
                  onChange={(e) => setBriefingManual(prev => ({ ...prev, publicoAlvo: e.target.value }))}
                  placeholder="Ex: Jovens casais, famílias, investidores"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Infraestrutura e Lazer
                </label>
                <Textarea
                  value={briefingManual.infraestrutura}
                  onChange={(e) => setBriefingManual(prev => ({ ...prev, infraestrutura: e.target.value }))}
                  placeholder="Áreas comuns: salão de festas, playground, churrasqueira, etc."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Localização e Entorno
                </label>
                <Textarea
                  value={briefingManual.localizacao}
                  onChange={(e) => setBriefingManual(prev => ({ ...prev, localizacao: e.target.value }))}
                  placeholder="Pontos de referência próximos: escolas, shoppings, hospitais, etc."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onFechar}>
                Cancelar
              </Button>
              <Button onClick={salvarBriefingManual} disabled={aplicando}>
                {aplicando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Salvar Briefing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* FORMULÁRIO INICIAL */}
        {!pesquisa && !modoManual && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Nome do Empreendimento *
                </label>
                <div className="relative mt-1">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={nomeEmpreendimento}
                    onChange={(e) => setNomeEmpreendimento(e.target.value)}
                    placeholder="Ex: Reserva do Parque"
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Construtora
                </label>
                <Input
                  value={construtora}
                  onChange={(e) => setConstrutora(e.target.value)}
                  placeholder="Ex: MRV, Cyrela"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Endereço
                </label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Bairro
                </label>
                <Input
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Setor, bairro"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700">
                    Cidade *
                  </label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Cidade"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-20">
                  <label className="text-sm font-medium text-slate-700">
                    UF
                  </label>
                  <Input
                    value={estado}
                    onChange={(e) => setEstado(e.target.value.toUpperCase())}
                    placeholder="GO"
                    maxLength={2}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-violet-50 rounded-lg p-4 text-sm text-violet-800 opacity-80">
              <p className="font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Como funciona?
              </p>
              <ul className="mt-2 space-y-1 text-violet-700">
                <li>• A IA irá buscar informações na web sobre o empreendimento</li>
                <li>• Coleta dados como: plantas, preços, infraestrutura, localização</li>
                <li>• O processo leva de 2 a 5 minutos</li>
                <li>• O resultado vira o briefing/RAG da campanha</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              {/* Botão principal - Pesquisa IA */}
              <Button 
                onClick={iniciarPesquisa} 
                disabled={iniciando}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md"
              >
                {iniciando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando Pesquisa...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Pesquisar com IA (Recomendado)
                  </>
                )}
              </Button>
              
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={onFechar}>
                  Cancelar
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setModoManual(true)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Preencher Manualmente
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PESQUISA EM ANDAMENTO */}
        {pesquisa && pesquisa.status !== "CONCLUIDO" && pesquisa.status !== "ERRO" && (
          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-violet-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Pesquisando...
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                A IA está coletando informações sobre "{nomeEmpreendimento}"
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Progresso</span>
                <span className="text-slate-900 font-medium">{Math.round(progresso)}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>

            {pesquisa.shareUrl && (
              <div className="text-center">
                <a
                  href={pesquisa.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-violet-600 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Acompanhar no Manus
                </a>
              </div>
            )}

            <div className="flex justify-center">
              <Button variant="outline" onClick={verificarStatus} disabled={verificando}>
                {verificando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Verificar Status
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* PESQUISA CONCLUÍDA */}
        {pesquisa && pesquisa.status === "CONCLUIDO" && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Pesquisa Concluída!
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Revise o resultado abaixo e aplique como briefing.
              </p>
            </div>

            {/* Resultado */}
            {pesquisa.resultado && (
              <div className="max-h-64 overflow-y-auto bg-slate-50 rounded-lg p-4">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans">
                    {pesquisa.resultado.substring(0, 2000)}
                    {pesquisa.resultado.length > 2000 && "...\n\n[Resultado truncado para visualização]"}
                  </pre>
                </div>
              </div>
            )}

            {pesquisa.shareUrl && (
              <div className="text-center">
                <a
                  href={pesquisa.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-violet-600 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver pesquisa completa no Manus
                </a>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onFechar}>
                Fechar
              </Button>
              <Button onClick={aplicarResultado} disabled={aplicando}>
                {aplicando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Aplicar como Briefing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ERRO */}
        {pesquisa && pesquisa.status === "ERRO" && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Pesquisa Falhou
              </h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                {pesquisa.erro || "Erro desconhecido ao realizar a pesquisa."}
              </p>
            </div>

            {/* Sugestão de preenchimento manual */}
            <div className="bg-indigo-50 rounded-lg p-4 text-sm text-indigo-800 text-center">
              <p className="font-medium">💡 Alternativa</p>
              <p className="mt-1 text-indigo-700">
                Você pode preencher o briefing manualmente enquanto o serviço de IA é restabelecido.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                <Button variant="outline" onClick={onFechar}>
                  Fechar
                </Button>
                <Button onClick={() => setPesquisa(null)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setPesquisa(null);
                  setModoManual(true);
                }}
                className="text-brand hover:text-brand"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Preencher manualmente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// BOTÃO RÁPIDO PARA USO EM OUTROS LUGARES
// ============================================

interface BotaoPesquisaProps {
  dadosIniciais?: PesquisaManusProps["dadosIniciais"];
  onAplicado?: (empreendimentoId: string) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function BotaoPesquisaManus({
  dadosIniciais,
  onAplicado,
  variant = "outline",
  size = "default",
}: BotaoPesquisaProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setAberto(true)}>
        <Brain className="w-4 h-4 mr-2" />
        Pesquisar via IA
      </Button>

      <PesquisaManusModal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        dadosIniciais={dadosIniciais}
        onAplicado={onAplicado}
      />
    </>
  );
}
