import { useState } from "react";
import { Button } from "../../../componentes/ui/button";
import { Card, CardContent } from "../../../componentes/ui/card";
import {
  Users,
  Loader2,
  Filter,
  Download,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import { Contato, formatarTelefone, getStatusProspeccaoColor } from "../hooks/useCampanhaDetalhes";
import { api } from "../../../servicos/api";
import { toast } from "sonner";

interface AbaContatosProps {
  contatos: Contato[];
  loadingContatos: boolean;
  paginaAtual: number;
  totalContatos: number;
  totalPaginas: number;
  filtroStatus: string;
  campanhaId: string;
  onFiltroChange: (status: string) => void;
  onPaginaChange: (pagina: number) => void;
  onExportar: () => void;
  onVerContato: (contatoId: string) => void;
  onRecarregar: () => void;
}

export function AbaContatos({
  contatos,
  loadingContatos,
  paginaAtual,
  totalContatos,
  totalPaginas,
  filtroStatus,
  campanhaId,
  onFiltroChange,
  onPaginaChange,
  onExportar,
  onVerContato,
  onRecarregar,
}: AbaContatosProps) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  // Toggle seleção de um contato
  const toggleSelecionado = (id: string) => {
    const novos = new Set(selecionados);
    if (novos.has(id)) {
      novos.delete(id);
    } else {
      novos.add(id);
    }
    setSelecionados(novos);
  };

  // Selecionar/deselecionar todos
  const toggleTodos = () => {
    if (selecionados.size === contatos.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(contatos.map(c => c.id)));
    }
  };

  // Excluir um contato
  const excluirContato = async (contatoId: string) => {
    try {
      setExcluindo(true);
      await api.delete(`/campanhas/${campanhaId}/contatos/${contatoId}`);
      toast.success('Contato excluído com sucesso');
      setConfirmandoExclusao(null);
      onRecarregar();
    } catch (error) {
      toast.error('Erro ao excluir contato');
    } finally {
      setExcluindo(false);
    }
  };

  // Excluir selecionados
  const excluirSelecionados = async () => {
    if (selecionados.size === 0) return;
    
    try {
      setExcluindo(true);
      await api.delete(`/campanhas/${campanhaId}/contatos`, {
        data: { contatoIds: Array.from(selecionados) }
      });
      toast.success(`${selecionados.size} contatos excluídos`);
      setSelecionados(new Set());
      onRecarregar();
    } catch (error) {
      toast.error('Erro ao excluir contatos');
    } finally {
      setExcluindo(false);
    }
  };

  const todosEstaoSelecionados = contatos.length > 0 && selecionados.size === contatos.length;
  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filtroStatus}
              onChange={(e) => onFiltroChange(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              title="Filtrar por status"
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="AGUARDANDO">Aguardando</option>
              <option value="CONTATANDO">Contatando</option>
              <option value="RESPONDEU">Respondeu</option>
              <option value="INTERESSADO">Interessado</option>
              <option value="SEM_INTERESSE">Sem Interesse</option>
              <option value="LEAD">Lead</option>
            </select>
          </div>
          
          {/* Ações de seleção */}
          {selecionados.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-700 font-medium">
                {selecionados.size} selecionado(s)
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                onClick={excluirSelecionados}
                disabled={excluindo}
              >
                {excluindo ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Excluir
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-slate-600"
                onClick={() => setSelecionados(new Set())}
              >
                Limpar
              </Button>
            </div>
          )}
        </div>
        
        <Button variant="outline" size="sm" className="gap-2" onClick={onExportar}>
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabela de Contatos */}
      <Card>
        <CardContent className="p-0">
          {loadingContatos ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            </div>
          ) : contatos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Users className="w-12 h-12 mb-2 text-slate-300" />
              <p>Nenhum contato encontrado</p>
              <p className="text-sm">Execute a mineração para capturar contatos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <button
                        onClick={toggleTodos}
                        className="flex items-center justify-center text-slate-500 hover:text-slate-700"
                        title={todosEstaoSelecionados ? "Desmarcar todos" : "Selecionar todos"}
                      >
                        {todosEstaoSelecionados ? (
                          <CheckSquare className="w-5 h-5 text-brand" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Imóvel</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contatos.map((contato) => (
                    <tr key={contato.id} className={`hover:bg-slate-50 ${selecionados.has(contato.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelecionado(contato.id)}
                          className="flex items-center justify-center text-slate-500 hover:text-slate-700"
                        >
                          {selecionados.has(contato.id) ? (
                            <CheckSquare className="w-5 h-5 text-brand" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{contato.nome}</div>
                        {contato.cpf && (
                          <div className="text-xs text-slate-500">CPF: {contato.cpf}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {contato.temWhatsapp && (
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>{formatarTelefone(contato.telefone)}</span>
                        </div>
                        {contato.telefone2 && (
                          <div className="text-xs text-slate-500">{formatarTelefone(contato.telefone2)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700">{contato.email || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 max-w-[200px]" title={`${contato.unidade || ''} ${contato.box ? '| Box ' + contato.box : ''}`}>
                          {contato.unidade ? (
                            <>
                              <span className="font-medium">{contato.unidade}</span>
                              {contato.box && (
                                <span className="text-emerald-600 ml-1">Box {contato.box}</span>
                              )}
                            </>
                          ) : (
                            <span className="truncate">{contato.enderecoImovel || '-'}</span>
                          )}
                        </div>
                        {contato.bairroImovel && (
                          <div className="text-xs text-slate-500">{contato.bairroImovel}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {contato.scoreAssertiva ? (
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            contato.scoreAssertiva >= 70 ? 'bg-emerald-100 text-emerald-700' :
                            contato.scoreAssertiva >= 40 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {contato.scoreAssertiva}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusProspeccaoColor(contato.statusProspeccao)}`}>
                          {contato.statusProspeccao.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => onVerContato(contato.id)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {confirmandoExclusao === contato.id ? (
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2 text-red-600 hover:bg-red-50"
                                onClick={() => excluirContato(contato.id)}
                                disabled={excluindo}
                              >
                                {excluindo ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Sim'
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2"
                                onClick={() => setConfirmandoExclusao(null)}
                              >
                                Não
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setConfirmandoExclusao(contato.id)}
                              title="Excluir contato"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Mostrando {contatos.length} de {totalContatos} contatos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual === 1}
              onClick={() => onPaginaChange(paginaAtual - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-600">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual === totalPaginas}
              onClick={() => onPaginaChange(paginaAtual + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
