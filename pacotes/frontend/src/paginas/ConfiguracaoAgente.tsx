import { useState, useEffect } from "react";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import { 
  Bot, 
  Save, 
  Sparkles, 
  MapPin, 
  Home, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Play,
  Pause,
  MessageSquare,
  RefreshCw,
  BookOpen,
  FileText,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { WizardCriacaoAgente, DadosAgente } from "../componentes/agentes/WizardCriacaoAgente";
import { StatusBadge } from "../componentes/agentes/StatusBadge";
import { StatusAgente } from "../componentes/agentes/wizard/types";
import { UploadDocumentos, DocumentoUpload } from "../componentes/agentes/UploadDocumentos";

// Interface para documentos salvos no backend
interface DocumentoSalvo {
  id: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  totalCaracteres?: number;
  status: 'PENDENTE' | 'PROCESSANDO' | 'SUCESSO' | 'ERRO';
  erroProcessamento?: string;
  criadoEm: string;
}

interface ConfiguracaoAgenteData {
  id: string;
  tenantId: string;
  nome: string;
  avatar: string | null;
  tipoAgente: string;
  modoCreacao: string;
  status: StatusAgente;
  personalidade: {
    tom: 'formal' | 'amigavel' | 'entusiasta';
    usarEmojis: boolean;
    nivelFormalidade: number;
  };
  expertise: {
    bairros: string[];
    tiposImovel: string[];
    faixaPreco?: { min?: number; max?: number };
  };
  scripts: {
    saudacao: string;
    despedida: string;
    ausencia: string;
    transferencia: string;
  };
  regrasNegocio: {
    horarioAtendimento?: { inicio: string; fim: string };
    diasAtendimento: string[];
    tempoMaximoResposta: number;
    transferirApos: number;
  };
  estaAtivo: boolean;
  termosAceitos: boolean;
  promptCustomizado?: string;
  criadoEm: string;
  atualizadoEm: string;
  tenant?: { nome: string; slug: string };
}

export function ConfiguracaoAgente() {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [agenteExiste, setAgenteExiste] = useState(false);
  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  
  // Estado para documentos (edição)
  const [documentosSalvos, setDocumentosSalvos] = useState<DocumentoSalvo[]>([]);
  const [documentosNovos, setDocumentosNovos] = useState<DocumentoUpload[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    nome: "Sofia",
    avatar: null as string | null,
    tomDeVoz: "amigavel" as 'formal' | 'amigavel' | 'entusiasta',
    usarEmojis: true,
    bairros: "",
    tiposImovel: "",
    saudacao: "Olá! Sou a Sofia, assistente virtual da sua imobiliária. Como posso ajudar você hoje? 😊",
    despedida: "Foi um prazer ajudar! Se precisar de algo mais, estou por aqui. Até logo! 👋",
    estaAtivo: true,
  });

  // Carregar configuração existente ao montar
  useEffect(() => {
    carregarAgente();
  }, []);

  const carregarAgente = async () => {
    try {
      setLoading(true);
      const response = await api.get('/agentes');
      const agente: ConfiguracaoAgenteData = response.data.agente;
      
      setAgenteExiste(true);
      setAgenteId(agente.id);
      
      // Preencher formulário com dados existentes
      setFormData({
        nome: agente.nome,
        avatar: agente.avatar,
        tomDeVoz: agente.personalidade?.tom || 'amigavel',
        usarEmojis: agente.personalidade?.usarEmojis ?? true,
        bairros: agente.expertise?.bairros?.join(', ') || '',
        tiposImovel: agente.expertise?.tiposImovel?.join(', ') || '',
        saudacao: agente.scripts?.saudacao || '',
        despedida: agente.scripts?.despedida || '',
        estaAtivo: agente.estaAtivo,
      });
      
      // Atualizar estado dos termos
      setTermosAceitos(agente.termosAceitos);
      
      toast.success(`Agente "${agente.nome}" carregado!`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Agente não existe, ok para criar
        setAgenteExiste(false);
        console.log('[ConfigAgente] Nenhum agente configurado ainda');
      } else {
        console.error('[ConfigAgente] Erro ao carregar:', error);
        toast.error('Erro ao carregar configuração', {
          description: error.response?.data?.erro || 'Tente novamente'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const salvarAgente = async () => {
    try {
      setSalvando(true);
      
      // Montar payload
      const payload = {
        nome: formData.nome,
        avatar: formData.avatar,
        personalidade: {
          tom: formData.tomDeVoz,
          usarEmojis: formData.usarEmojis,
          nivelFormalidade: formData.tomDeVoz === 'formal' ? 5 : formData.tomDeVoz === 'amigavel' ? 3 : 2,
        },
        expertise: {
          bairros: formData.bairros.split(',').map(b => b.trim()).filter(Boolean),
          tiposImovel: formData.tiposImovel.split(',').map(t => t.trim()).filter(Boolean),
        },
        scripts: {
          saudacao: formData.saudacao,
          despedida: formData.despedida,
        },
        estaAtivo: formData.estaAtivo,
      };

      let response;
      
      if (agenteExiste && agenteId) {
        // Atualizar existente
        response = await api.put(`/agentes/${agenteId}`, payload);
        toast.success('Agente atualizado!', {
          description: 'As alterações já estão ativas no WhatsApp.',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />
        });
      } else {
        // Criar novo
        response = await api.post('/agentes', payload);
        setAgenteExiste(true);
        setAgenteId(response.data.agente.id);
        toast.success('Agente criado!', {
          description: 'Seu assistente virtual está pronto para usar.',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />
        });
      }
      
      console.log('[ConfigAgente] Salvo com sucesso:', response.data);
    } catch (error: any) {
      console.error('[ConfigAgente] Erro ao salvar:', error);
      toast.error('Erro ao salvar', {
        description: error.response?.data?.erro || 'Verifique os dados e tente novamente',
        icon: <AlertCircle className="w-5 h-5 text-red-500" />
      });
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async () => {
    if (!agenteId) return;
    
    try {
      // Novo fluxo: RASCUNHO -> ativar -> ATIVO
      //             ATIVO -> pausar -> PAUSADO
      //             PAUSADO -> ativar -> ATIVO
      const endpoint = formData.estaAtivo ? 'pausar' : 'ativar';
      const response = await api.patch(`/agentes/${agenteId}/${endpoint}`);
      
      // A API retorna { status, estaAtivo } diretamente (não dentro de agente)
      const novoEstaAtivo = response.data.estaAtivo ?? response.data.status === 'ATIVO';
      
      setFormData(prev => ({ ...prev, estaAtivo: novoEstaAtivo }));
      
      if (novoEstaAtivo) {
        toast.success('🟢 Agente ativado', {
          description: 'O agente voltou a responder automaticamente'
        });
      } else {
        toast.info('⏸️ Agente pausado', {
          description: 'Conversas serão direcionadas para atendimento humano'
        });
      }
    } catch (error: any) {
      toast.error('Erro ao alterar status', {
        description: error.response?.data?.erro || 'Tente novamente'
      });
    }
  };

  // Aceitar termos de uso
  const aceitarTermos = async () => {
    if (!agenteId) return;
    
    try {
      await api.patch(`/agentes/${agenteId}/aceitar-termos`, { versao: '1.0' });
      setTermosAceitos(true);
      toast.success('✅ Termos de uso aceitos!', {
        description: 'Agora você pode ativar seu agente.'
      });
    } catch (error: any) {
      toast.error('Erro ao aceitar termos', {
        description: error.response?.data?.erro || 'Tente novamente'
      });
    }
  };

  // Excluir agente
  const excluirAgente = async () => {
    if (!agenteId) return;
    
    if (!confirm('⚠️ Tem certeza que deseja excluir o agente? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      await api.delete(`/agentes/${agenteId}`);
      setAgenteExiste(false);
      setAgenteId(null);
      setTermosAceitos(false);
      setMostrarWizard(true);
      toast.success('🗑️ Agente excluído', {
        description: 'Você pode criar um novo agente agora.'
      });
    } catch (error: any) {
      toast.error('Erro ao excluir agente', {
        description: error.response?.data?.erro || 'Tente novamente'
      });
    }
  };

  // ===== FUNÇÕES DE DOCUMENTOS =====
  
  // Carregar documentos do agente
  const carregarDocumentos = async () => {
    if (!agenteId) return;
    
    try {
      setCarregandoDocs(true);
      const response = await api.get(`/documentos/${agenteId}`);
      setDocumentosSalvos(response.data.documentos || []);
    } catch (error: any) {
      console.error('[Documentos] Erro ao carregar:', error);
    } finally {
      setCarregandoDocs(false);
    }
  };

  // Carregar documentos quando o agente for carregado
  useEffect(() => {
    if (agenteId && agenteExiste) {
      carregarDocumentos();
    }
  }, [agenteId, agenteExiste]);

  // Enviar novo documento
  const enviarDocumento = async (arquivo: File): Promise<{ id: string; textoExtraido: string }> => {
    if (!agenteId) throw new Error('Agente não encontrado');
    
    const formDataUpload = new FormData();
    formDataUpload.append('arquivo', arquivo);
    
    const response = await api.post(`/documentos/${agenteId}/upload`, formDataUpload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    // Recarregar lista de documentos
    carregarDocumentos();
    
    return {
      id: response.data.documento.id,
      textoExtraido: response.data.textoExtraido || '',
    };
  };

  // Excluir documento
  const excluirDocumento = async (documentoId: string) => {
    if (!agenteId) return;
    
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
      await api.delete(`/documentos/${agenteId}/${documentoId}`);
      setDocumentosSalvos(prev => prev.filter(d => d.id !== documentoId));
      toast.success('Documento excluído');
    } catch (error: any) {
      toast.error('Erro ao excluir documento', {
        description: error.response?.data?.erro || 'Tente novamente'
      });
    }
  };

  // Formatar tamanho de arquivo
  const formatarTamanho = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handler para criar agente via Wizard
  const criarAgenteViaWizard = async (dados: DadosAgente) => {
    try {
      setSalvando(true);
      
      const payload = {
        nome: dados.nome,
        avatar: dados.avatar || null,
        genero: 'feminino', // default
        tipoAgente: dados.tipoAgente || 'SDR_VENDAS',
        modoCreacao: dados.modoCreacao || 'PRE_TREINADO',
        personalidade: {
          tom: dados.personalidade?.tom || 'amigavel',
          usarEmojis: dados.personalidade?.usarEmojis ?? true,
          nivelFormalidade: dados.personalidade?.nivelFormalidade || 3,
        },
        expertise: {
          bairros: dados.expertise?.bairros || [],
          tiposImovel: dados.expertise?.tiposImovel || [],
        },
        scripts: {
          saudacao: dados.scripts?.saudacao || 'Olá! Como posso ajudar você hoje?',
          despedida: dados.scripts?.despedida || 'Foi um prazer ajudar! Até logo!',
          ausencia: 'No momento estou indisponível, mas retorno em breve.',
          transferencia: 'Vou transferir você para um de nossos especialistas.',
        },
        regrasNegocio: {
          diasAtendimento: ['seg', 'ter', 'qua', 'qui', 'sex'],
          tempoMaximoResposta: 30,
          transferirApos: 3,
        },
        // Incluir perfil da imobiliária se preenchido
        perfilImobiliaria: dados.perfilImobiliaria || null,
        termosAceitos: dados.termosAceitos || false,
        estaAtivo: false, // Começa como rascunho
      };
      
      console.log('[ConfigAgente] Enviando payload:', payload);
      
      const response = await api.post('/agentes', payload);
      const novoAgenteId = response.data.agente.id;
      
      setAgenteExiste(true);
      setAgenteId(novoAgenteId);
      setMostrarWizard(false);
      setTermosAceitos(dados.termosAceitos || false);
      
      // Enviar documentos se houver
      if (dados.documentosPendentes && dados.documentosPendentes.length > 0) {
        console.log(`[ConfigAgente] Enviando ${dados.documentosPendentes.length} documentos...`);
        
        for (const arquivo of dados.documentosPendentes) {
          try {
            const formData = new FormData();
            formData.append('arquivo', arquivo);
            
            await api.post(`/documentos/${novoAgenteId}/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            console.log(`[ConfigAgente] Documento "${arquivo.name}" enviado com sucesso`);
          } catch (docError: any) {
            console.error(`[ConfigAgente] Erro ao enviar documento "${arquivo.name}":`, docError);
            // Continua com os próximos documentos mesmo se um falhar
          }
        }
        
        toast.success('Documentos processados! 📄', {
          description: 'O agente foi treinado com seu conhecimento personalizado.',
        });
      }
      
      // Atualizar form com os dados criados
      setFormData({
        nome: dados.nome,
        avatar: dados.avatar,
        tomDeVoz: dados.personalidade.tom,
        usarEmojis: dados.personalidade.usarEmojis,
        bairros: dados.expertise.bairros.join(', '),
        tiposImovel: dados.expertise.tiposImovel.join(', '),
        saudacao: dados.scripts.saudacao,
        despedida: dados.scripts.despedida,
        estaAtivo: false, // Começa como rascunho, não ativo
      });
      
      toast.success('Agente criado com sucesso! 🎉', {
        description: `${dados.nome} está pronto para ser ativado.`,
      });
      
    } catch (error: any) {
      console.error('[ConfigAgente] Erro ao criar via wizard:', error);
      console.error('[ConfigAgente] Response data:', error.response?.data);
      
      const detalhes = error.response?.data?.detalhes;
      let mensagemErro = error.response?.data?.erro || 'Tente novamente';
      
      if (detalhes?.fieldErrors) {
        const campos = Object.keys(detalhes.fieldErrors).join(', ');
        mensagemErro += ` (campos: ${campos})`;
      }
      
      toast.error('Erro ao criar agente', {
        description: mensagemErro,
      });
      throw error; // Re-throw para o wizard saber que falhou
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Carregando configuração...</span>
      </div>
    );
  }

  // Mostrar Wizard para novos agentes
  if (!agenteExiste || mostrarWizard) {
    return (
      <div className="py-8">
        <WizardCriacaoAgente
          onConcluir={criarAgenteViaWizard}
          onCancelar={() => {
            if (agenteExiste) {
              setMostrarWizard(false);
            }
          }}
          salvando={salvando}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header da Página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meu Agente IA</h1>
          <p className="text-slate-500">
            {agenteExiste 
              ? 'Personalize a identidade e comportamento do seu assistente virtual.'
              : 'Configure seu assistente virtual para começar a atender automaticamente.'
            }
          </p>
        </div>
        <div className="flex gap-2">
          {agenteExiste && (
            <Button
              variant="outline"
              onClick={toggleAtivo}
              className={formData.estaAtivo ? 'text-green-600' : 'text-slate-400'}
            >
              {formData.estaAtivo ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Ativar
                </>
              )}
            </Button>
          )}
          <Button
            onClick={salvarAgente}
            disabled={salvando}
            className="bg-green-600 hover:bg-green-700"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {agenteExiste ? 'Salvar Alterações' : 'Criar Agente'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Banner de Termos não aceitos */}
      {agenteExiste && !termosAceitos && (
        <div className="p-4 rounded-lg flex items-center justify-between bg-red-50 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">⚠️ Termos de uso não aceitos</p>
              <p className="text-sm text-red-600">Você precisa aceitar os termos para ativar o agente.</p>
            </div>
          </div>
          <Button onClick={aceitarTermos} className="bg-red-600 hover:bg-red-700">
            Aceitar Termos
          </Button>
        </div>
      )}

      {/* Banner de Status com StatusBadge */}
      {agenteExiste && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          formData.estaAtivo 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            {formData.estaAtivo ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Agente ativo e respondendo</p>
                  <p className="text-sm text-green-600">Seu assistente está atendendo leads automaticamente no WhatsApp.</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Agente pausado</p>
                  <p className="text-sm text-yellow-600">Mensagens estão sendo encaminhadas para atendimento humano.</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={formData.estaAtivo ? 'ATIVO' : 'PAUSADO'} tamanho="lg" />
            {!formData.estaAtivo && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={excluirAgente}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Excluir Agente
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Coluna da Esquerda: Identidade Visual */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              Identidade
            </h3>

            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-white shadow-lg">
                <span className="text-4xl font-bold text-white">
                  {formData.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <Button variant="outline" size="sm" disabled>
                Alterar Avatar (em breve)
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nome do Agente
              </label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Sofia, Ana, Pedro..."
              />
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">Dica do ELYON</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Nomes humanos como "Sofia" ou "Pedro" aumentam a taxa de
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
              {(['formal', 'amigavel', 'entusiasta'] as const).map((tom) => (
                <button
                  key={tom}
                  type="button"
                  onClick={() => setFormData({ ...formData, tomDeVoz: tom })}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    formData.tomDeVoz === tom
                      ? "border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <span className="text-2xl block mb-1">
                    {tom === 'formal' ? '👔' : tom === 'amigavel' ? '😊' : '🚀'}
                  </span>
                  <span className="capitalize font-medium">{tom}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="usarEmojis"
                checked={formData.usarEmojis}
                onChange={(e) => setFormData({ ...formData, usarEmojis: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="usarEmojis" className="text-sm text-slate-700">
                Usar emojis moderadamente nas respostas
              </label>
            </div>

            <div className="space-y-2">
              <label htmlFor="saudacao" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Mensagem de Saudação
              </label>
              <textarea
                id="saudacao"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.saudacao}
                onChange={(e) => setFormData({ ...formData, saudacao: e.target.value })}
                placeholder="Olá! Como posso ajudar?"
              />
              <p className="text-xs text-slate-500">
                Esta será a primeira mensagem enviada ao lead no WhatsApp.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="despedida" className="text-sm font-medium text-slate-700">
                Mensagem de Despedida
              </label>
              <textarea
                id="despedida"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.despedida}
                onChange={(e) => setFormData({ ...formData, despedida: e.target.value })}
                placeholder="Obrigado pelo contato!"
              />
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
                  placeholder="Ex: Centro, Jardins, Bueno, Marista..."
                  value={formData.bairros}
                  onChange={(e) => setFormData({ ...formData, bairros: e.target.value })}
                />
                <p className="text-xs text-slate-500">
                  Separe por vírgula. O agente terá mais contexto sobre esses bairros.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Tipos de Imóvel (Foco)
                </label>
                <Input
                  placeholder="Ex: Apartamentos, Casas de Condomínio, Lotes..."
                  value={formData.tiposImovel}
                  onChange={(e) => setFormData({ ...formData, tiposImovel: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Conhecimento Personalizado - Documentos */}
          {agenteExiste && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                  Conhecimento Personalizado
                </h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={carregarDocumentos}
                  disabled={carregandoDocs}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${carregandoDocs ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <BookOpen className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-orange-900">Treine seu agente com conhecimento exclusivo!</p>
                    <p className="text-orange-800 mt-1">
                      Suba documentos como estratégias de vendas, manuais de atendimento, 
                      scripts ou qualquer material que você queira que o agente aprenda.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de documentos salvos */}
              {documentosSalvos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Documentos ativos ({documentosSalvos.length})
                  </p>
                  <div className="space-y-2">
                    {documentosSalvos.map((doc) => (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          doc.status === 'ERRO' 
                            ? 'bg-red-50 border-red-200' 
                            : doc.status === 'SUCESSO'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-white border-slate-200'
                        }`}
                      >
                        <FileText className={`w-4 h-4 ${
                          doc.status === 'ERRO' ? 'text-red-500' : 
                          doc.status === 'SUCESSO' ? 'text-green-500' : 
                          'text-slate-400'
                        }`} />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-700 truncate">
                            {doc.nomeOriginal}
                          </p>
                          <p className="text-xs text-slate-500">
                            {doc.status === 'ERRO' 
                              ? doc.erroProcessamento 
                              : `${formatarTamanho(doc.tamanhoBytes)}${doc.totalCaracteres ? ` • ${doc.totalCaracteres.toLocaleString()} caracteres` : ''}`
                            }
                          </p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => excluirDocumento(doc.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Remover documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload de novos documentos */}
              <UploadDocumentos
                documentos={documentosNovos}
                onDocumentosChange={setDocumentosNovos}
                onUpload={enviarDocumento}
                modo="edicao"
                maxArquivos={10}
                maxTamanhoMB={10}
              />
            </div>
          )}

          {/* Preview (Futuro) */}
          {agenteExiste && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Testar Agente
                </h3>
                <Button variant="outline" size="sm" disabled>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Em breve
                </Button>
              </div>
              <p className="text-sm text-slate-500">
                Em breve você poderá testar como seu agente responde a mensagens de exemplo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
