import { useState, useEffect } from "react";
import { api } from "../servicos/api";
import {
  Plus,
  Smartphone,
  QrCode,
  Trash2,
  LogOut,
  Loader2,
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../componentes/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../componentes/ui/dialog";
import { Switch } from "../componentes/ui/switch";
import { Badge } from "../componentes/ui/badge";
import { toast } from "sonner";

interface SessaoWhatsapp {
  id: string;
  nome: string;
  descricao: string | null;
  instanceName: string;
  numeroWhatsapp: string | null;
  nomeWhatsapp: string | null;
  status: "DESCONECTADO" | "CONECTANDO" | "CONECTADO" | "ERRO";
  criadoEm: string;
  agente?: { nome: string };
  ignorarGrupos?: boolean;
  webhookBase64?: boolean;
}

export function SessoesWhatsapp() {
  const [sessoes, setSessoes] = useState<SessaoWhatsapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [modalCriarOpen, setModalCriarOpen] = useState(false);
  const [modalQrOpen, setModalQrOpen] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [sessaoConectando, setSessaoConectando] = useState<string | null>(null);

  // Form state
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  // Config Modal State (Legacy/Unfinished)
  const [modalConfigOpen, setModalConfigOpen] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [ignorarGrupos, setIgnorarGrupos] = useState(false);
  const [webhookBase64, setWebhookBase64] = useState(false);

  const salvarConfiguracao = async () => {
    setLoadingConfig(true);
    // Placeholder - implementation missing
    setTimeout(() => {
      setLoadingConfig(false);
      setModalConfigOpen(false);
      toast.success("Configuração salva (Placeholder)");
    }, 500);
  };

  useEffect(() => {
    carregarSessoes();
  }, []);

  // Polling para verificar status de sessões conectando
  useEffect(() => {
    const sessoesConectando = sessoes.filter((s) => s.status === "CONECTANDO");

    if (sessoesConectando.length === 0) return;

    const interval = setInterval(async () => {
      let mudouAlguma = false;

      for (const sessao of sessoesConectando) {
        try {
          const response = await api.get(
            `/sessoes-whatsapp/${sessao.id}/status`
          );
          if (response.data.status !== sessao.status) {
            mudouAlguma = true;
          }
        } catch (error) {
          console.error(
            `Erro ao verificar status da sessão ${sessao.id}:`,
            error
          );
        }
      }

      if (mudouAlguma) {
        carregarSessoes();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessoes]);

  const carregarSessoes = async () => {
    try {
      // Não mostra loading se já tiver sessões (para não piscar no polling)
      if (sessoes.length === 0) setLoading(true);

      const response = await api.get("/sessoes-whatsapp");
      setSessoes(response.data.sessoes);
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
      toast.error("Erro ao carregar sessões WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const criarSessao = async () => {
    if (!novoNome.trim()) return;

    try {
      setCriando(true);
      await api.post("/sessoes-whatsapp", {
        nome: novoNome,
        descricao: novaDescricao,
      });

      toast.success("Sessão criada com sucesso!");
      setModalCriarOpen(false);
      setNovoNome("");
      setNovaDescricao("");
      carregarSessoes();
    } catch (error: any) {
      toast.error("Erro ao criar sessão", {
        description: error.response?.data?.erro || "Tente novamente",
      });
    } finally {
      setCriando(false);
    }
  };

  const conectarSessao = async (id: string) => {
    try {
      setSessaoConectando(id);
      const response = await api.post(`/sessoes-whatsapp/${id}/conectar`);

      if (response.data.qrcode) {
        // Backend pode retornar o QR Code como string direta ou objeto { base64: ... }
        const qr =
          typeof response.data.qrcode === "string"
            ? response.data.qrcode
            : response.data.qrcode.base64;

        setQrCodeBase64(qr);
        setModalQrOpen(true);
      } else if (response.data.status === "CONECTADO") {
        toast.success("Sessão já está conectada!");
        carregarSessoes();
      }
    } catch (error: any) {
      toast.error("Erro ao iniciar conexão", {
        description: error.response?.data?.erro || "Tente novamente",
      });
    } finally {
      setSessaoConectando(null);
    }
  };

  const desconectarSessao = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja desconectar? O agente parará de responder."
      )
    )
      return;

    try {
      await api.post(`/sessoes-whatsapp/${id}/desconectar`);
      toast.success("Sessão desconectada");
      carregarSessoes();
    } catch (error) {
      toast.error("Erro ao desconectar");
    }
  };

  const excluirSessao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta sessão permanentemente?"))
      return;

    try {
      await api.delete(`/sessoes-whatsapp/${id}`);
      toast.success("Sessão excluída");
      carregarSessoes();
    } catch (error) {
      toast.error("Erro ao excluir sessão");
    }
  };

  const atualizarConfigRapida = async (id: string, campo: 'ignorarGrupos' | 'webhookBase64', valor: boolean) => {
    try {
      // Atualizar localmente primeiro para feedback imediato
      setSessoes(prev => prev.map(s =>
        s.id === id
          ? { ...s, [campo]: valor }
          : s
      ));

      await api.post(`/sessoes-whatsapp/${id}/configurar`, {
        [campo]: valor,
      });

      toast.success(campo === 'ignorarGrupos'
        ? `Grupos ${valor ? 'serão ignorados' : 'serão processados'}`
        : `Transcrição de áudios ${valor ? 'ativada' : 'desativada'}`
      );
    } catch (error) {
      console.error(`Erro ao atualizar ${campo}:`, error);
      toast.error("Erro ao atualizar configuração");
      // Reverter em caso de erro
      carregarSessoes();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CONECTADO":
        return "bg-green-100 text-green-700 border-green-200";
      case "CONECTANDO":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "ERRO":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-green-600" />
            Sessões WhatsApp
          </h1>
          <p className="text-slate-500">
            Gerencie suas conexões do WhatsApp para os agentes
          </p>
        </div>
        <Button
          onClick={() => setModalCriarOpen(true)}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Sessão
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : sessoes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Nenhuma sessão encontrada
            </h3>
            <p className="text-slate-500 max-w-sm mt-2 mb-6">
              Crie uma sessão para conectar seu WhatsApp e permitir que os
              agentes respondam automaticamente.
            </p>
            <Button onClick={() => setModalCriarOpen(true)} variant="outline">
              Criar Primeira Sessão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessoes.map((sessao) => (
            <Card
              key={sessao.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {sessao.nome}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {sessao.descricao || "Sem descrição"}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={getStatusColor(sessao.status)}
                  >
                    {sessao.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Info do número conectado */}
                {sessao.status === "CONECTADO" && sessao.numeroWhatsapp && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800">{sessao.nomeWhatsapp || "WhatsApp"}</p>
                      <p className="text-sm text-green-600">+{sessao.numeroWhatsapp}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Agente Vinculado</span>
                    <span className="font-medium text-slate-900">
                      {sessao.agente?.nome || "Nenhum"}
                    </span>
                  </div>
                </div>

                {/* Toggles de configuração (apenas quando conectado) */}
                {sessao.status === "CONECTADO" && (
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Ignorar Grupos</p>
                        <p className="text-xs text-slate-500">Não responder mensagens de grupos</p>
                      </div>
                      <Switch
                        checked={sessao.ignorarGrupos || false}
                        onCheckedChange={(checked) => atualizarConfigRapida(sessao.id, 'ignorarGrupos', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Áudios (Base64)</p>
                        <p className="text-xs text-slate-500">Habilita transcrição de áudios</p>
                      </div>
                      <Switch
                        checked={sessao.webhookBase64 || false}
                        onCheckedChange={(checked) => atualizarConfigRapida(sessao.id, 'webhookBase64', checked)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {sessao.status === "CONECTADO" ? (
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => desconectarSessao(sessao.id)}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Desconectar
                    </Button>
                  ) : (
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => conectarSessao(sessao.id)}
                      disabled={sessaoConectando === sessao.id}
                    >
                      {sessaoConectando === sessao.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4 mr-2" />
                      )}
                      Conectar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => excluirSessao(sessao.id)}
                    title="Excluir sessão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Criar Sessão */}
      <Dialog open={modalCriarOpen} onOpenChange={setModalCriarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Sessão WhatsApp</DialogTitle>
            <DialogDescription>
              Crie uma identificação para este número (ex: "Comercial",
              "Aluguel").
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Sessão</label>
              <Input
                placeholder="Ex: Vendas Principal"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Descrição (Opcional)
              </label>
              <Input
                placeholder="Ex: Utilizado pelo time de vendas"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCriarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={criarSessao}
              disabled={criando || !novoNome.trim()}
            >
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code */}
      <Dialog open={modalQrOpen} onOpenChange={setModalQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e
              escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            {qrCodeBase64 ? (
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <img
                  src={qrCodeBase64}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-slate-100 rounded-xl flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            )}

            <p className="text-sm text-slate-500 text-center max-w-xs">
              Mantenha esta janela aberta até escanear. A conexão será
              atualizada automaticamente.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setModalQrOpen(false);
                carregarSessoes(); // Recarregar para ver se conectou
              }}
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Configurações */}
      <Dialog open={modalConfigOpen} onOpenChange={setModalConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações da Sessão</DialogTitle>
            <DialogDescription>
              Ajuste o comportamento desta conexão do WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {loadingConfig ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="py-4 space-y-6">
              <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Ignorar Grupos
                  </label>
                  <p className="text-sm text-slate-500">
                    Não processar mensagens vindas de grupos.
                  </p>
                </div>
                <Switch
                  checked={ignorarGrupos}
                  onCheckedChange={setIgnorarGrupos}
                />
              </div>

              <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg border-amber-200 bg-amber-50/50">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Webhook Base64 (Áudios)
                  </label>
                  <p className="text-sm text-slate-500">
                    Habilita transcrição automática de áudios recebidos.
                  </p>
                </div>
                <Switch
                  checked={webhookBase64}
                  onCheckedChange={setWebhookBase64}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConfigOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarConfiguracao} disabled={loadingConfig}>
              {loadingConfig && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
