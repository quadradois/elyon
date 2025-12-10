import { Button } from "../componentes/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../componentes/ui/card";
import { QrCode } from "lucide-react";

export function Configuracao() {
  // Componente simplificado apenas para redirecionamento

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
                  Gerenciamento do WhatsApp
                </CardTitle>
                <CardDescription>
                  Gerencie suas conexões do WhatsApp em nossa nova interface.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <QrCode className="w-8 h-8 text-green-600" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="font-semibold text-slate-900">
                  Nova Área de Sessões
                </h3>
                <p className="text-slate-500">
                  Agora você pode gerenciar múltiplas sessões do WhatsApp e
                  vincular cada uma a um agente diferente.
                </p>
              </div>
              <Button
                onClick={() => (window.location.href = "/dashboard/whatsapp")}
                className="bg-green-600 hover:bg-green-700"
              >
                Gerenciar Sessões WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
