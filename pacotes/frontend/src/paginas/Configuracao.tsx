import { useState, useEffect } from "react";
import { Button } from "../componentes/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../componentes/ui/card";
import { AlertCircle, CheckCircle2, QrCode, RefreshCw } from "lucide-react";
import { api } from "../servicos/api";

export function Configuracao() {
  const [status, setStatus] = useState<
    "CONECTADO" | "DESCONECTADO" | "CARREGANDO" | "CONECTANDO"
  >("CARREGANDO");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const [ignorarGrupos, setIgnorarGrupos] = useState<boolean | null>(null);

  useEffect(() => {
    verificarStatus();
  }, []);

  // Polling para verificar status quando estiver conectando
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "CONECTANDO") {
      interval = setInterval(verificarStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const verificarStatus = async () => {
    try {
      // Não mostra loading no polling para não piscar a tela
      if (status !== "CONECTANDO") setLoading(true);

      const response = await api.get("/whatsapp/status");

      // Se a API retornar que está conectado, atualiza
      if (response.data.status === "CONECTADO") {
        setStatus("CONECTADO");
        setQrCode(null);
        buscarConfiguracao(); // Busca configurações se estiver conectado
      } else if (response.data.status === "CONECTANDO") {
        setStatus("CONECTANDO");
      } else {
        setStatus("DESCONECTADO");
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      setStatus("DESCONECTADO");
    } finally {
      setLoading(false);
    }
  };

  const buscarConfiguracao = async () => {
    try {
      const response = await api.get("/whatsapp/configurar");
      if (response.data && response.data.settings) {
        setIgnorarGrupos(response.data.settings.groupsIgnore);
      }
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
    }
  };

  const conectar = async () => {
    try {
      setLoading(true);
      setDetalheErro(null);
      const response = await api.post("/whatsapp/conectar");

      if (response.data.qrcode) {
        setQrCode(response.data.qrcode);
        setStatus("DESCONECTADO"); // Ainda não conectou, está esperando ler QR
      } else if (response.data.status === "CONECTADO") {
        setStatus("CONECTADO");
        setQrCode(null);
        buscarConfiguracao();
      } else if (response.data.status === "CONECTANDO") {
        setStatus("CONECTANDO");
        setQrCode(null);
        // Alert removido para não bloquear a UI durante o polling
      } else {
        // Se retornou desconectado com detalhe
        if (response.data.detalhe) {
          setDetalheErro(`Status da instância: ${response.data.detalhe}`);
        }
      }
    } catch (error: any) {
      console.error("Erro ao conectar:", error);
      const msg = error.response?.data?.details || error.message;
      alert(`Erro ao conectar: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const resetarInstancia = async () => {
    try {
      setLoading(true);
      if (
        confirm(
          "Isso irá apagar a instância atual e criar uma nova. Deseja continuar?"
        )
      ) {
        await api.post("/whatsapp/reset");
        alert("Instância resetada! A página será recarregada.");
        window.location.reload();
      }
    } catch (error) {
      console.error("Erro ao resetar:", error);
      alert("Erro ao resetar instância.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Gerencie as integrações do sistema.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-green-600" />
                  WhatsApp (Evolution API)
                </CardTitle>
                <CardDescription>
                  Conecte seu WhatsApp para enviar mensagens automáticas aos
                  leads.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {status === "CONECTADO" ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" /> Conectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    <AlertCircle className="w-4 h-4" /> Desconectado
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              {status === "CONECTANDO" && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                  <p className="text-slate-600">
                    Aguardando conexão com o WhatsApp...
                  </p>
                  <p className="text-xs text-slate-400">
                    Isso pode levar alguns segundos.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetarInstancia}
                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    Demorando muito? Resetar Instância
                  </Button>
                </div>
              )}

              {detalheErro && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm max-w-md mx-auto">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  {detalheErro}
                </div>
              )}

              {status === "DESCONECTADO" &&
                !qrCode &&
                status !== "CONECTANDO" && (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <QrCode className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 max-w-md mx-auto">
                      Para conectar, clique no botão abaixo e escaneie o QR Code
                      com seu WhatsApp.
                    </p>
                    <Button onClick={conectar} disabled={loading}>
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Conectar WhatsApp
                    </Button>
                  </div>
                )}

              {qrCode && (
                <div className="text-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm inline-block">
                    <img
                      src={qrCode}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-sm text-slate-500">
                    Abra o WhatsApp no seu celular &gt; Configurações &gt;
                    Aparelhos conectados &gt; Conectar aparelho
                  </p>
                </div>
              )}

              {status === "CONECTADO" && (
                <div className="text-center space-y-4">
                  <p className="text-slate-600">
                    Sua instância <strong>elyon_main</strong> está ativa e
                    pronta para enviar mensagens.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={verificarStatus}>
                      Verificar Conexão
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              Preferências da Instância
            </CardTitle>
            <CardDescription>
              Personalize o comportamento do seu WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <label className="text-base font-medium text-slate-900">
                  Ignorar Grupos
                </label>
                <p className="text-sm text-slate-500">
                  Não receber mensagens de grupos no sistema.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={ignorarGrupos === true ? "default" : "outline"}
                  className={
                    ignorarGrupos === true
                      ? "bg-green-600 hover:bg-green-700"
                      : ""
                  }
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await api.post("/whatsapp/configurar", {
                        ignorarGrupos: true,
                      });
                      setIgnorarGrupos(true);
                      alert(
                        "Configuração salva! O sistema irá IGNORAR mensagens de grupos."
                      );
                    } catch (error) {
                      console.error(error);
                      alert("Erro ao salvar configuração.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={
                    loading || status !== "CONECTADO" || ignorarGrupos === true
                  }
                >
                  {ignorarGrupos === true ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : null}
                  Ativar
                </Button>
                <Button
                  variant={ignorarGrupos === false ? "default" : "outline"}
                  className={
                    ignorarGrupos === false ? "bg-red-600 hover:bg-red-700" : ""
                  }
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await api.post("/whatsapp/configurar", {
                        ignorarGrupos: false,
                      });
                      setIgnorarGrupos(false);
                      alert(
                        "Configuração salva! O sistema irá RECEBER mensagens de grupos."
                      );
                    } catch (error) {
                      console.error(error);
                      alert("Erro ao salvar configuração.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={
                    loading || status !== "CONECTADO" || ignorarGrupos === false
                  }
                >
                  {ignorarGrupos === false ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : null}
                  Desativar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
