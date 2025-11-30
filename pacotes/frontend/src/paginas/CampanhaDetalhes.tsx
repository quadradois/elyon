import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../componentes/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../componentes/ui/dialog";
import {
  ArrowLeft,
  Building2,
  MapPin,
  DollarSign,
  Users,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Home,
  TrendingUp,
  Info,
  Pause,
  Play,
  Archive,
  Upload,
  Edit,
  Save,
  X,
} from "lucide-react";
import { api } from "../servicos/api";

interface CampanhaDetalhes {
  id: string;
  nome: string;
  tenantId: string;
  tipo: string;
  parametrosBusca: any;
  nomeEmpreendimento: string | null;
  tipoImovel: string | null;
  localizacao: string | null;
  perfilImovel: string | null;
  briefingCompleto: string | null;
  briefingEstruturado: any;
  briefingGeradoEm: string | null;
  briefingConfiabilidade: string | null;
  totalContatos: number;
  totalLeads: number;
  status: string;
  criadoEm: string;
  atualizadoEm: string;
}

export function CampanhaDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campanha, setCampanha] = useState<CampanhaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // Estados para Importação
  const [modalImportacaoOpen, setModalImportacaoOpen] = useState(false);
  const [textoImportacao, setTextoImportacao] = useState("");
  const [importando, setImportando] = useState(false);

  // Estados para Edição de Briefing
  const [editandoBriefing, setEditandoBriefing] = useState(false);
  const [textoBriefing, setTextoBriefing] = useState("");
  const [salvandoBriefing, setSalvandoBriefing] = useState(false);

  useEffect(() => {
    if (id) {
      carregarCampanha();
    }
  }, [id]);

  const carregarCampanha = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/campanhas/${id}`);
      setCampanha(response.data.campanha);
      setTextoBriefing(response.data.campanha.briefingCompleto || "");
    } catch (error) {
      console.error("Erro ao carregar campanha:", error);
      setErro("Não foi possível carregar os detalhes da campanha.");
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatus = async (
    novoStatus: "PAUSADA" | "FINALIZADA" | "ATIVA"
  ) => {
    if (!campanha) return;

    const mensagens = {
      PAUSADA: "Deseja pausar esta campanha?",
      FINALIZADA:
        "Deseja finalizar esta campanha? Esta ação não pode ser desfeita.",
      ATIVA: "Deseja reativar esta campanha?",
    };

    if (!confirm(mensagens[novoStatus])) return;

    try {
      await api.patch(`/campanhas/${id}/status`, { status: novoStatus });
      alert(`✅ Campanha ${novoStatus.toLowerCase()} com sucesso!`);
      carregarCampanha(); // Recarrega dados
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar status da campanha");
    }
  };

  const importarContatos = async () => {
    if (!textoImportacao.trim()) return;

    try {
      setImportando(true);

      // Parser simples: Nome, Telefone (por linha)
      const linhas = textoImportacao.split("\n").filter((l) => l.trim());
      const contatos = linhas
        .map((linha) => {
          const [nome, telefone, email] = linha.split(",").map((s) => s.trim());
          return {
            nome: nome || "Sem Nome",
            telefone: telefone || "",
            email: email || "",
          };
        })
        .filter((c) => c.nome && c.telefone);

      if (contatos.length === 0) {
        alert(
          "Nenhum contato válido encontrado. Use o formato: Nome, Telefone"
        );
        return;
      }

      const response = await api.post(`/campanhas/${id}/importar-contatos`, {
        contatos,
      });

      alert(response.data.mensagem);
      setModalImportacaoOpen(false);
      setTextoImportacao("");
      carregarCampanha();
    } catch (error) {
      console.error("Erro ao importar:", error);
      alert("Erro ao importar contatos. Verifique o formato.");
    } finally {
      setImportando(false);
    }
  };

  const salvarBriefing = async () => {
    try {
      setSalvandoBriefing(true);
      await api.put(`/campanhas/${id}/briefing`, {
        briefingCompleto: textoBriefing,
        validar: true, // Atualiza o RAG!
      });

      setEditandoBriefing(false);
      carregarCampanha();
      alert("✅ Resumo atualizado e conhecimento salvo no RAG!");
    } catch (error) {
      console.error("Erro ao salvar briefing:", error);
      alert("Erro ao salvar alterações.");
    } finally {
      setSalvandoBriefing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATIVA":
        return "bg-green-100 text-green-700 border-green-200";
      case "PAUSADA":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "FINALIZADA":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const getConfiabilidadeColor = (conf: number) => {
    if (conf >= 0.8) return "text-green-600";
    if (conf >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  const formatarPreco = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (erro || !campanha) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/campanhas")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro || "Campanha não encontrada"}
        </div>
      </div>
    );
  }

  const briefing = campanha.briefingEstruturado;
  const confiabilidade = parseFloat(campanha.briefingConfiabilidade || "0");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard/campanhas")}
            className="gap-2 -ml-3 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Campanhas
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{campanha.nome}</h1>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campanha.status)}`}
            >
              {campanha.status}
            </span>
            {campanha.nomeEmpreendimento && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="w-4 h-4" />
                {campanha.nomeEmpreendimento}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Botão Importar Contatos */}
          <Dialog
            open={modalImportacaoOpen}
            onOpenChange={setModalImportacaoOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white">
                <Upload className="w-4 h-4" />
                Importar Contatos
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Importar Contatos</DialogTitle>
                <DialogDescription>
                  Cole sua lista de contatos abaixo. Formato:{" "}
                  <strong>Nome, Telefone</strong> (um por linha).
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <textarea
                  className="w-full h-64 p-3 border rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder={`João Silva, 11999998888\nMaria Santos, 11988887777`}
                  value={textoImportacao}
                  onChange={(e) => setTextoImportacao(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setModalImportacaoOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={importarContatos} disabled={importando}>
                  {importando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    "Importar Contatos"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {campanha.status === "ATIVA" && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => atualizarStatus("PAUSADA")}
              >
                <Pause className="w-4 h-4" />
                Pausar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => atualizarStatus("FINALIZADA")}
              >
                <Archive className="w-4 h-4" />
                Finalizar
              </Button>
            </>
          )}
          {campanha.status === "PAUSADA" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => atualizarStatus("ATIVA")}
            >
              <Play className="w-4 h-4" />
              Reativar
            </Button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total de Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalContatos}
              </span>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Leads Qualificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalLeads}
              </span>
              <Target className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalContatos > 0
                  ? Math.round(
                      (campanha.totalLeads / campanha.totalContatos) * 100
                    )
                  : 0}
                %
              </span>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Briefing do Empreendimento */}
      {briefing && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Inteligência do Empreendimento</CardTitle>
                <CardDescription>
                  Dados coletados automaticamente via pesquisa
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {confiabilidade >= 0.8 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : confiabilidade >= 0.5 ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span
                  className={`font-semibold ${getConfiabilidadeColor(confiabilidade)}`}
                >
                  {Math.round(confiabilidade * 100)}% confiável
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumo para SDR - Editável */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <strong className="text-blue-900">Resumo para SDR:</strong>
                </div>
                {!editandoBriefing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                    onClick={() => setEditandoBriefing(true)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setEditandoBriefing(false);
                        setTextoBriefing(campanha.briefingCompleto || "");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-green-700 hover:bg-green-50"
                      onClick={salvarBriefing}
                      disabled={salvandoBriefing}
                    >
                      {salvandoBriefing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {editandoBriefing ? (
                <textarea
                  className="w-full h-40 p-3 text-sm text-slate-900 bg-white border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={textoBriefing}
                  onChange={(e) => setTextoBriefing(e.target.value)}
                />
              ) : (
                <p className="text-sm text-blue-900 leading-relaxed pl-7 whitespace-pre-wrap">
                  {campanha.briefingCompleto}
                </p>
              )}
            </div>

            {/* Faixa de Preço */}
            {briefing.faixa_preco && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Faixa de Preço (Anúncios)
                </h3>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {formatarPreco(briefing.faixa_preco.min)}
                    </span>
                    <span className="text-slate-500">até</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {formatarPreco(briefing.faixa_preco.max)}
                    </span>
                  </div>
                  {briefing.faixa_preco.observacao && (
                    <p className="text-sm text-slate-600 mt-2">
                      {briefing.faixa_preco.observacao}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Características */}
            {briefing.caracteristicas &&
              briefing.caracteristicas.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Home className="w-5 h-5 text-blue-600" />
                    Características
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {briefing.caracteristicas.map(
                      (car: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm"
                        >
                          {car}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Diferenciais */}
            {briefing.diferenciais && briefing.diferenciais.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">
                  ✨ Diferenciais
                </h3>
                <ul className="space-y-2">
                  {briefing.diferenciais.map((dif: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-slate-700"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{dif}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pontos de Interesse */}
            {briefing.pontos_interesse &&
              briefing.pontos_interesse.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-600" />
                    Pontos de Interesse Próximos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {briefing.pontos_interesse.map(
                      (ponto: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg"
                        >
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {ponto}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Alertas */}
            {briefing.alertas && briefing.alertas.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Alertas de Validação
                </h3>
                <ul className="space-y-1">
                  {briefing.alertas.map((alerta: string, idx: number) => (
                    <li key={idx} className="text-sm text-yellow-800">
                      • {alerta}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fontes */}
            {briefing.fontes_consultadas && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  <strong>Fontes consultadas:</strong>{" "}
                  {briefing.fontes_consultadas.join(", ")}
                </p>
                {briefing.quantidade_resultados && (
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>Resultados analisados:</strong>{" "}
                    {briefing.quantidade_resultados}
                  </p>
                )}
                {campanha.briefingGeradoEm && (
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>Pesquisado em:</strong>{" "}
                    {new Date(campanha.briefingGeradoEm).toLocaleString(
                      "pt-BR"
                    )}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sem Briefing */}
      {!briefing && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">
              Esta campanha não possui informações do empreendimento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
