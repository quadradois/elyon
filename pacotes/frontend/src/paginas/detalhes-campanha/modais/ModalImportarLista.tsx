import { Button } from "../../../componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../componentes/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  Users,
  MessageSquare,
  List,
} from "lucide-react";
import { ListaSimples } from "../hooks/useCampanhaDetalhes";

interface ModalImportarListaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listas: ListaSimples[];
  listaSelecionada: string;
  carregandoListas: boolean;
  importandoDeLista: boolean;
  onListaSelect: (listaId: string) => void;
  onImportar: () => void;
}

export function ModalImportarLista({
  open,
  onOpenChange,
  listas,
  listaSelecionada,
  carregandoListas,
  importandoDeLista,
  onListaSelect,
  onImportar,
}: ModalImportarListaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="w-5 h-5 text-violet-600" />
            Importar de Lista
          </DialogTitle>
          <DialogDescription>
            Selecione uma lista de contatos minerados para importar para esta campanha.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {carregandoListas ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
            </div>
          ) : listas.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <List className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Nenhuma lista disponível</p>
              <p className="text-sm mt-1">
                Vá em <strong>Captação</strong> para minerar novos contatos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Selecione a lista
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {listas.map((lista) => {
                  const disponiveis = lista.totalContatos - lista.totalUsados;
                  return (
                    <button
                      key={lista.id}
                      onClick={() => onListaSelect(lista.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        listaSelecionada === lista.id
                          ? 'border-purple-500 bg-violet-50 ring-2 ring-violet-200'
                          : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{lista.nome}</p>
                          <p className="text-sm text-slate-500">{lista.nomeEdificio}</p>
                        </div>
                        {listaSelecionada === lista.id && (
                          <CheckCircle2 className="w-5 h-5 text-violet-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {disponiveis} disponíveis
                        </span>
                        {lista.totalComWhatsapp > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <MessageSquare className="w-3 h-3" />
                            {lista.totalComWhatsapp} WhatsApp
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={onImportar} 
            disabled={!listaSelecionada || importandoDeLista}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {importandoDeLista ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              'Importar Contatos'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
