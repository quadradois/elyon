import { useState, useEffect } from "react";
import { api } from "../servicos/api";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
  Bot,
  Save,
  MapPin,
  Home,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  MessageSquare,
  RefreshCw,
  LogOut,
  BookOpen,
  FileText,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  WizardCriacaoAgente,
  DadosAgente,
} from "../componentes/agentes/WizardCriacaoAgente";
import { StatusBadge } from "../componentes/agentes/StatusBadge";
import { StatusAgente } from "../componentes/agentes/wizard/types";
import {
  UploadDocumentos,
  DocumentoUpload,
} from "../componentes/agentes/UploadDocumentos";
import { useParams, useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../componentes/ui/select";
import { ModalUpgradeAgente } from "../componentes/ModalUpgradeAgente";

// Interface para documentos salvos no backend
interface DocumentoSalvo {
  id: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  totalCaracteres?: number;
  status: "PENDENTE" | "PROCESSANDO" | "SUCESSO" | "ERRO";
  erroProcessamento?: string;
  criadoEm: string;
}

interface SessaoWhatsapp {
  id: string;
  nome: string;
  status: string;
  numeroWhatsapp: string | null;
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
    tom: "formal" | "amigavel" | "entusiasta";
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
  sessaoWhatsappId?: string | null;
  sessaoWhatsapp?: { nome: string };
}

export function ConfiguracaoAgente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [agenteExiste, setAgenteExiste] = useState(false);
  const [agenteId, setAgenteId] = useState<string | null>(id || null);
  const [mostrarWizard, setMostrarWizard] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [modalUpgradeOpen, setModalUpgradeOpen] = useState(false);
  const [limiteAtual, setLimiteAtual] = useState(1);

  // Estado para documentos (edição)
  const [documentosSalvos, setDocumentosSalvos] = useState<DocumentoSalvo[]>(
    []
  );
  const [documentosNovos, setDocumentosNovos] = useState<DocumentoUpload[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(false);

  // Estado para sessões WhatsApp
  const [sessoesWhatsapp, setSessoesWhatsapp] = useState<SessaoWhatsapp[]>([]);

  // Estado do formulário
  const [formData, setFormData] = useState({
    nome: "Sofia",
    avatar: null as string | null,
    tomDeVoz: "amigavel" as "formal" | "amigavel" | "entusiasta",
    usarEmojis: true,
    bairros: "",
    tiposImovel: "",
    saudacao:
      "Olá! Sou a Sofia, assistente virtual da sua imobiliária. Como posso ajudar você hoje? 😊",
    despedida:
      "Foi um prazer ajudar! Se precisar de algo mais, estou por aqui. Até logo! 👋",
    estaAtivo: true,
    sessaoWhatsappId: "none" as string,
  });
  useEffect(() => {
    carregarSessoes();
    if (id && id !== "novo") {
      carregarAgente(id);
    } else if (id === "novo") {
      setAgenteExiste(false);
      setMostrarWizard(true);
      setLoading(false);
    } else {
      // Se não tem ID, tenta carregar o "padrão" ou redireciona para lista
      carregarAgentePadrao();
    }
  }, [id]);

  const carregarSessoes = async () => {
    try {
      const response = await api.get("/sessoes-whatsapp");
      setSessoesWhatsapp(response.data.sessoes || []);
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
    }
  };

  const carregarAgentePadrao = async () => {
    try {
      setLoading(true);
      const response = await api.get("/agentes");

      // Se retornar lista, pega o primeiro ou redireciona para lista
      if (response.data.agentes && response.data.agentes.length > 0) {
        navigate(`/dashboard/agente/${response.data.agentes[0].id}`, {
          replace: true,
        });
        return;
      }

      // Se retornar objeto único (legado)
      if (response.data.agente) {
        configurarFormulario(response.data.agente);
      } else {
        // Nenhum agente, mostrar wizard
        setAgenteExiste(false);
        setMostrarWizard(true);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setAgenteExiste(false);
        setMostrarWizard(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const carregarAgente = async (idAgente: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/agentes/${idAgente}`);
      configurarFormulario(response.data.agente);
    } catch (error: any) {
      toast.error("Erro ao carregar agente");
      navigate("/dashboard/agentes");
    } finally {
      setLoading(false);
    }
  };

  const configurarFormulario = (agente: ConfiguracaoAgenteData) => {
    setAgenteExiste(true);
    setAgenteId(agente.id);

    setFormData({
      nome: agente.nome,
      avatar: agente.avatar,
      tomDeVoz: agente.personalidade?.tom || "amigavel",
      usarEmojis: agente.personalidade?.usarEmojis ?? true,
      bairros: agente.expertise?.bairros?.join(", ") || "",
      tiposImovel: agente.expertise?.tiposImovel?.join(", ") || "",
      saudacao: agente.scripts?.saudacao || "",
      despedida: agente.scripts?.despedida || "",
      estaAtivo: agente.estaAtivo,
      sessaoWhatsappId: agente.sessaoWhatsappId || "none",
    });

    setTermosAceitos(agente.termosAceitos);
    toast.success(`Agente "${agente.nome}" carregado!`);
  };

  const salvarAgente = async () => {
    try {
      setSalvando(true);

      const payload = {
        nome: formData.nome,
        avatar: formData.avatar,
        personalidade: {
          tom: formData.tomDeVoz,
          usarEmojis: formData.usarEmojis,
          nivelFormalidade:
            formData.tomDeVoz === "formal"
              ? 5
              : formData.tomDeVoz === "amigavel"
                ? 3
                : 2,
        },
        expertise: {
          bairros: formData.bairros
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean),
          tiposImovel: formData.tiposImovel
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
        scripts: {
          saudacao: formData.saudacao,
          despedida: formData.despedida,
        },
        estaAtivo: formData.estaAtivo,
        sessaoWhatsappId:
          formData.sessaoWhatsappId === "none"
            ? null
            : formData.sessaoWhatsappId,
      };

      let response;

      if (agenteExiste && agenteId) {
        response = await api.put(`/agentes/${agenteId}`, payload);
        toast.success("Agente atualizado!", {
          description: "As alterações já estão ativas.",
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        });
      } else {
        response = await api.post("/agentes", payload);
        setAgenteExiste(true);
        setAgenteId(response.data.agente.id);
        navigate(`/dashboard/agente/${response.data.agente.id}`, {
          replace: true,
        });
        toast.success("Agente criado!", {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        });
      }
    } catch (error: any) {
      if (
        error.response?.status === 403 &&
        error.response?.data?.codigo === "LIMITE_ATINGIDO"
      ) {
        setLimiteAtual(error.response.data.limite || 1);
        setModalUpgradeOpen(true);
        return;
      }
      console.error("[ConfigAgente] Erro ao salvar:", error);
      toast.error("Erro ao salvar", {
        description:
          error.response?.data?.erro || "Verifique os dados e tente novamente",
        icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      });
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async () => {
    if (!agenteId) return;

    try {
      const endpoint = formData.estaAtivo ? "pausar" : "ativar";
      const response = await api.patch(`/agentes/${agenteId}/${endpoint}`);

      const novoEstaAtivo =
        response.data.estaAtivo ?? response.data.status === "ATIVO";

      setFormData((prev) => ({ ...prev, estaAtivo: novoEstaAtivo }));

      if (novoEstaAtivo) {
        toast.success("🟢 Agente ativado");
      } else {
        toast.info("⏸️ Agente pausado");
      }
    } catch (error: any) {
      toast.error("Erro ao alterar status");
    }
  };

  const aceitarTermos = async () => {
    if (!agenteId) return;
    try {
      await api.patch(`/agentes/${agenteId}/aceitar-termos`, { versao: "1.0" });
      setTermosAceitos(true);
      toast.success("✅ Termos de uso aceitos!");
    } catch (error: any) {
      toast.error("Erro ao aceitar termos");
    }
  };

  const excluirAgente = async () => {
    if (!agenteId) return;
    if (!confirm("⚠️ Tem certeza que deseja excluir o agente?")) return;

    try {
      await api.delete(`/agentes/${agenteId}`);
      toast.success("🗑️ Agente excluído");
      navigate("/dashboard/agentes");
    } catch (error: any) {
      toast.error("Erro ao excluir agente");
    }
  };

  const desconectarSessao = async () => {
    const sessaoId = formData.sessaoWhatsappId;
    if (!sessaoId || sessaoId === "none") return;

    if (
      !confirm(
        "Tem certeza que deseja desconectar o WhatsApp? O agente parará de responder."
      )
    )
      return;

    try {
      await api.post(`/sessoes-whatsapp/${sessaoId}/desconectar`);
      toast.success("WhatsApp desconectado");
      carregarSessoes(); // Recarregar status
    } catch (error: any) {
      toast.error("Erro ao desconectar WhatsApp");
    }
  };

  // ===== FUNÇÕES DE DOCUMENTOS =====
  const carregarDocumentos = async () => {
    if (!agenteId) return;
    try {
      setCarregandoDocs(true);
      const response = await api.get(`/documentos/${agenteId}`);
      setDocumentosSalvos(response.data.documentos || []);
    } catch (error: any) {
      console.error("[Documentos] Erro ao carregar:", error);
    } finally {
      setCarregandoDocs(false);
    }
  };

  useEffect(() => {
    if (agenteId && agenteExiste) {
      carregarDocumentos();
    }
  }, [agenteId, agenteExiste]);

  const criarAgenteViaWizard = async (dados: DadosAgente) => {
    try {
      setSalvando(true);

      const payload = {
        nome: dados.nome,
        avatar: dados.avatar || null,
        genero: "feminino",
        tipoAgente: dados.tipoAgente || "SDR_VENDAS",
        modoCreacao: dados.modoCreacao || "PRE_TREINADO",
        personalidade: {
          tom: dados.personalidade?.tom || "amigavel",
          usarEmojis: dados.personalidade?.usarEmojis ?? true,
          nivelFormalidade: dados.personalidade?.nivelFormalidade || 3,
        },
        expertise: {
          bairros: dados.expertise?.bairros || [],
          tiposImovel: dados.expertise?.tiposImovel || [],
        },
        scripts: {
          saudacao:
            dados.scripts?.saudacao || "Olá! Como posso ajudar você hoje?",
          despedida:
            dados.scripts?.despedida || "Foi um prazer ajudar! Até logo!",
          ausencia: "No momento estou indisponível, mas retorno em breve.",
          transferencia: "Vou transferir você para um de nossos especialistas.",
        },
        regrasNegocio: {
          diasAtendimento: ["seg", "ter", "qua", "qui", "sex"],
          tempoMaximoResposta: 30,
          transferirApos: 3,
        },
        perfilImobiliaria: dados.perfilImobiliaria || null,
        termosAceitos: dados.termosAceitos || false,
        estaAtivo: false,
      };

      const response = await api.post("/agentes", payload);
      const novoAgenteId = response.data.agente.id;

      setAgenteExiste(true);
      setAgenteId(novoAgenteId);
      setMostrarWizard(false);
      setTermosAceitos(dados.termosAceitos || false);

      // Upload documentos pendentes...
      if (dados.documentosPendentes && dados.documentosPendentes.length > 0) {
        for (const arquivo of dados.documentosPendentes) {
          try {
            const formData = new FormData();
            formData.append("arquivo", arquivo);
            await api.post(`/documentos/${novoAgenteId}/upload`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch (e) {
            console.error(e);
          }
        }
      }

      navigate(`/dashboard/agente/${novoAgenteId}`, { replace: true });
      toast.success("Agente criado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao criar agente");
      throw error;
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

  if (!agenteExiste || mostrarWizard) {
    return (
      <div className="py-8">
        <WizardCriacaoAgente
          onConcluir={criarAgenteViaWizard}
          onCancelar={() => {
            if (agenteExiste) setMostrarWizard(false);
            else navigate("/dashboard/agentes");
          }}
          salvando={salvando}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ModalUpgradeAgente
        isOpen={modalUpgradeOpen}
        onClose={() => setModalUpgradeOpen(false)}
        limiteAtual={limiteAtual}
      />
      {/* Header da Página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Configuração do Agente
          </h1>
          <p className="text-slate-500">
            Personalize a identidade e comportamento de {formData.nome}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/agentes")}
          >
            Voltar
          </Button>
          {agenteExiste && (
            <Button
              variant="outline"
              onClick={toggleAtivo}
              className={
                formData.estaAtivo ? "text-green-600" : "text-slate-400"
              }
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
                Salvar Alterações
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
              <p className="font-medium text-red-800">
                ⚠️ Termos de uso não aceitos
              </p>
              <p className="text-sm text-red-600">
                Você precisa aceitar os termos para ativar o agente.
              </p>
            </div>
          </div>
          <Button
            onClick={aceitarTermos}
            className="bg-red-600 hover:bg-red-700"
          >
            Aceitar Termos
          </Button>
        </div>
      )}

      {/* Banner de Status */}
      {agenteExiste && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            formData.estaAtivo
              ? "bg-green-50 border border-green-200"
              : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {formData.estaAtivo ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    Agente ativo e respondendo
                  </p>
                  <p className="text-sm text-green-600">
                    Seu assistente está atendendo leads automaticamente.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Agente pausado</p>
                  <p className="text-sm text-yellow-600">
                    Mensagens estão sendo encaminhadas para atendimento humano.
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              status={formData.estaAtivo ? "ATIVO" : "PAUSADO"}
              tamanho="lg"
            />
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
        {/* Coluna da Esquerda: Identidade Visual e Conexão */}
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nome do Agente
              </label>
              <Input
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder="Ex: Sofia, Ana, Pedro..."
              />
            </div>
          </div>

          {/* Conexão WhatsApp */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-green-600" />
              Conexão WhatsApp
            </h3>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Sessão Vinculada
              </label>
              <Select
                value={formData.sessaoWhatsappId}
                onValueChange={(val) =>
                  setFormData({ ...formData, sessaoWhatsappId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma sessão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (Não responderá)</SelectItem>
                  {sessoesWhatsapp.map((sessao) => (
                    <SelectItem key={sessao.id} value={sessao.id}>
                      {sessao.nome} ({sessao.numeroWhatsapp || "Sem número"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Escolha qual número de WhatsApp este agente usará para
                responder.
              </p>
            </div>

            {formData.sessaoWhatsappId &&
              formData.sessaoWhatsappId !== "none" && (
                <div className="pt-2">
                  {sessoesWhatsapp.find(
                    (s) => s.id === formData.sessaoWhatsappId
                  )?.status === "CONECTADO" ? (
                    <Button
                      variant="outline"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={desconectarSessao}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Desconectar WhatsApp
                    </Button>
                  ) : (
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-sm text-slate-500 mb-2">
                        WhatsApp não conectado
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => navigate("/dashboard/whatsapp")}
                      >
                        Conectar Agora
                      </Button>
                    </div>
                  )}
                </div>
              )}

            <Button
              variant="ghost"
              className="w-full text-xs text-slate-500"
              onClick={() => navigate("/dashboard/whatsapp")}
            >
              Gerenciar Todas as Sessões
            </Button>
          </div>
        </div>
        <div className="md:col-span-2 space-y-6">
          {/* Personalidade */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="font-semibold text-slate-900">
              Personalidade & Tom de Voz
            </h3>

            <div className="grid grid-cols-3 gap-4">
              {(["formal", "amigavel", "entusiasta"] as const).map((tom) => (
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
                    {tom === "formal" ? "👔" : tom === "amigavel" ? "😊" : "🚀"}
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
                onChange={(e) =>
                  setFormData({ ...formData, usarEmojis: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="usarEmojis" className="text-sm text-slate-700">
                Usar emojis moderadamente nas respostas
              </label>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="saudacao"
                className="text-sm font-medium text-slate-700 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Mensagem de Saudação
              </label>
              <textarea
                id="saudacao"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.saudacao}
                onChange={(e) =>
                  setFormData({ ...formData, saudacao: e.target.value })
                }
                placeholder="Olá! Como posso ajudar?"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="despedida"
                className="text-sm font-medium text-slate-700"
              >
                Mensagem de Despedida
              </label>
              <textarea
                id="despedida"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.despedida}
                onChange={(e) =>
                  setFormData({ ...formData, despedida: e.target.value })
                }
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
                  onChange={(e) =>
                    setFormData({ ...formData, bairros: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Tipos de Imóvel (Foco)
                </label>
                <Input
                  placeholder="Ex: Apartamentos, Casas de Condomínio, Lotes..."
                  value={formData.tiposImovel}
                  onChange={(e) =>
                    setFormData({ ...formData, tiposImovel: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Conhecimento Personalizado */}
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
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${carregandoDocs ? "animate-spin" : ""}`}
                  />
                  Atualizar
                </Button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <BookOpen className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-orange-900">
                      Treine seu agente com conhecimento exclusivo!
                    </p>
                    <p className="text-orange-800 mt-1">
                      Suba documentos como estratégias de vendas, manuais de
                      atendimento, scripts ou qualquer material que você queira
                      que o agente aprenda.
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
                          doc.status === "ERRO"
                            ? "bg-red-50 border-red-200"
                            : doc.status === "SUCESSO"
                              ? "bg-green-50 border-green-200"
                              : "bg-white border-slate-200"
                        }`}
                      >
                        <FileText
                          className={`w-4 h-4 ${
                            doc.status === "ERRO"
                              ? "text-red-500"
                              : doc.status === "SUCESSO"
                                ? "text-green-500"
                                : "text-slate-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {doc.nomeOriginal}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(doc.tamanhoBytes / 1024).toFixed(1)} KB •{" "}
                            {doc.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <UploadDocumentos
                documentos={documentosNovos}
                onDocumentosChange={setDocumentosNovos}
                onUpload={async (arquivo) => {
                  const formDataUpload = new FormData();
                  formDataUpload.append("arquivo", arquivo);
                  await api.post(
                    `/documentos/${agenteId}/upload`,
                    formDataUpload,
                    {
                      headers: { "Content-Type": "multipart/form-data" },
                    }
                  );
                  carregarDocumentos();
                  return { id: "temp", textoExtraido: "" };
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
