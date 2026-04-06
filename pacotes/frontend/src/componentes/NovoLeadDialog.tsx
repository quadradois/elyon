import { useState } from "react";
import { Button } from "../componentes/ui/button";
import { Input } from "../componentes/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../componentes/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../componentes/ui/tabs";
import { Search, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../servicos/api";

interface NovoLeadDialogProps {
  onLeadCreated?: () => void;
}

export function NovoLeadDialog({ onLeadCreated }: NovoLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState<"busca" | "resultado" | "sucesso">(
    "busca"
  );
  const [iptu, setIptu] = useState("");
  const [open, setOpen] = useState(false);
  const [dadosEncontrados, setDadosEncontrados] = useState<any>(null);
  const [novoLead, setNovoLead] = useState({
    nome: "",
    telefone: "",
    email: "",
  });

  const handleSalvarManual = async () => {
    try {
      setLoading(true);
      await api.post("/leads", novoLead);

      setEtapa("sucesso");
      if (onLeadCreated) onLeadCreated();

      setTimeout(() => {
        setOpen(false);
        setNovoLead({ nome: "", telefone: "", email: "" });
        setEtapa("busca");
      }, 1500);
    } catch (error) {
      console.error("Erro ao criar lead:", error);
    } finally {
      setLoading(false);
    }
  };

  // Import useToast if available, otherwise just use console for now or minimal alert
  // Assuming toast is available since UI components exist

  const handleBuscaIPTU = async () => {
    if (!iptu) return;
    setLoading(true);
    setDadosEncontrados(null);

    try {
      // Chamada Real ao Backend
      const response = await api.post("/mineracao/iptu-unitario", { iptu });

      setDadosEncontrados(response.data);
      setEtapa("resultado");
    } catch (error: any) {
      console.error("Erro busca IPTU:", error);

      // Tratamento de erro básico
      if (error.response?.status === 402) {
        alert("Saldo insuficiente para realizar a busca.");
      } else if (error.response?.status === 404) {
        alert("IPTU não encontrado na base da Prefeitura.");
      } else {
        alert("Erro ao buscar IPTU. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarLead = async () => {
    if (!dadosEncontrados) return;
    setLoading(true);

    try {
      // Salvar Lead Real
      // Mapear dados para o formato esperado pelo endpoint POST /leads
      const leadPayload = {
        nome: dadosEncontrados.proprietario.nome || "Proprietário Desconhecido",
        telefone: dadosEncontrados.proprietario.telefones[0]
          ? dadosEncontrados.proprietario.telefones[0].replace(/\D/g, '') // Limpar formatação
          : "",
        email: dadosEncontrados.proprietario.emails[0] || "",
        cpf: dadosEncontrados.proprietario.cpfEnriquecido || dadosEncontrados.proprietario.cpf,

        // Dados do Imóvel
        enderecoImovel: dadosEncontrados.imovel.endereco,
        tipoImovel: dadosEncontrados.imovel.tipo,

        status: "NOVO",
        origem: "IPTU_HUNTING"
      };

      await api.post("/leads", leadPayload);

      setEtapa("sucesso");
      if (onLeadCreated) {
        onLeadCreated();
      }

      setTimeout(() => {
        setOpen(false);
        // Reseta o estado
        setTimeout(() => {
          setEtapa("busca");
          setIptu("");
          setDadosEncontrados(null);
        }, 500);
      }, 1500);

    } catch (error) {
      console.error("Erro ao salvar lead:", error);
      alert("Erro ao criar lead. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand hover:bg-brand-dark">+ Novo Lead</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Lead</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="iptu" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iptu">Busca Inteligente (IPTU)</TabsTrigger>
            <TabsTrigger value="manual">Cadastro Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="iptu" className="space-y-4 py-4">
            {etapa === "busca" && (
              <div className="space-y-4">
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-800">
                  <p className="flex items-center gap-2 font-medium">
                    <Building2 className="w-4 h-4" />
                    Integração Prefeitura de Goiânia
                  </p>
                  <p className="mt-1 text-brand">
                    Digite a inscrição do IPTU para buscar dados do proprietário
                    e enriquecer com contatos automaticamente.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Inscrição IPTU (ex: 123.456.789)"
                    value={iptu}
                    onChange={(e) => setIptu(e.target.value)}
                  />
                  <Button onClick={handleBuscaIPTU} disabled={loading || !iptu}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {etapa === "resultado" && dadosEncontrados && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900 border-b pb-2">
                    Dados do Imóvel
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block">Endereço</span>
                      <span className="font-medium">
                        {dadosEncontrados.imovel.endereco}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        Área Construída
                      </span>
                      <span className="font-medium">
                        {dadosEncontrados.imovel.area}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900 border-b pb-2 flex items-center justify-between">
                    Dados do Proprietário
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      Enriquecido via Assertiva
                    </span>
                  </h3>

                  <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-brand font-bold">
                        {dadosEncontrados.proprietario.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {dadosEncontrados.proprietario.nome}
                        </p>
                        <p className="text-xs text-slate-500">
                          CPF: {dadosEncontrados.proprietario.cpfEnriquecido}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                      <div className="bg-white p-2 rounded border">
                        <span className="text-xs text-slate-400 block">
                          Telefone Principal
                        </span>
                        <span className="font-medium text-slate-700">
                          {dadosEncontrados.proprietario.telefones[0]}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded border">
                        <span className="text-xs text-slate-400 block">
                          Score de Crédito
                        </span>
                        <span className="font-medium text-emerald-600">
                          {dadosEncontrados.proprietario.score} (Alto)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full bg-success hover:bg-success-dark"
                  onClick={handleSalvarLead}
                  disabled={loading}
                >
                  {loading ? "Salvando..." : "Confirmar e Importar Lead"}
                </Button>
              </div>
            )}

            {etapa === "sucesso" && (
              <div className="text-center py-8 space-y-4 animate-in zoom-in">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Lead Importado!
                  </h3>
                  <p className="text-slate-500">
                    O agente já pode iniciar o atendimento.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEtapa("busca");
                    setIptu("");
                    setNovoLead({ nome: "", telefone: "", email: "" });
                  }}
                >
                  Adicionar Outro
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome Completo</label>
                <Input
                  placeholder="Ex: João da Silva"
                  value={novoLead.nome}
                  onChange={(e) =>
                    setNovoLead({ ...novoLead, nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Telefone (WhatsApp)
                </label>
                <Input
                  placeholder="Ex: 62999998888"
                  value={novoLead.telefone}
                  onChange={(e) =>
                    setNovoLead({ ...novoLead, telefone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email (Opcional)</label>
                <Input
                  placeholder="Ex: joao@email.com"
                  value={novoLead.email}
                  onChange={(e) =>
                    setNovoLead({ ...novoLead, email: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full bg-brand hover:bg-brand-dark mt-4"
                onClick={handleSalvarManual}
                disabled={loading || !novoLead.nome || !novoLead.telefone}
              >
                {loading ? "Salvando..." : "Cadastrar Lead"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
