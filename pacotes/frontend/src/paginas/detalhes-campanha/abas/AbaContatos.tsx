import { useState } from "react";
import { Button } from "../../../componentes/ui/button";
import { Card, CardContent } from "../../../componentes/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../componentes/ui/dropdown-menu";
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
  MoreVertical,
  BellOff,
  ShieldBan,
  UserMinus,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { Contato, formatarTelefone, getStatusProspeccaoColor } from "../hooks/useCampanhaDetalhes";
import { api } from "../../../servicos/api";
import { toast } from "sonner";
import {
  formatarStatusProspeccao,
  obterStatusProspeccaoExibicao,
} from "../../../lib/status-prospeccao";

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

type AcaoConfirmacao =
  | { tipo: "excluir"; contatoId: string }
  | { tipo: "blacklist"; contatoId: string }
  | { tipo: "removerLead"; contatoId: string };

type AcaoBulk = "excluir" | "blacklist" | "desativar";

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
  const STATUS_EM_CONTATO = `CONTA${"TANDO"}`;
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [confirmandoAcao, setConfirmandoAcao] = useState<AcaoConfirmacao | null>(null);
  const [acaoBulk, setAcaoBulk] = useState<AcaoBulk | null>(null);

  const toggleSelecionado = (id: string) => {
    const novos = new Set(selecionados);
    if (novos.has(id)) novos.delete(id);
    else novos.add(id);
    setSelecionados(novos);
  };

  const toggleTodos = () => {
    if (selecionados.size === contatos.length) setSelecionados(new Set());
    else setSelecionados(new Set(contatos.map((c) => c.id)));
  };

  // ── Ações individuais ──────────────────────────────────────────────────────

  const excluirContato = async (contatoId: string) => {
    try {
      setProcessando(true);
      await api.delete(`/campanhas/${campanhaId}/contatos/${contatoId}`);
      toast.success("Contato excluído com sucesso");
      setConfirmandoAcao(null);
      onRecarregar();
    } catch {
      toast.error("Erro ao excluir contato");
    } finally {
      setProcessando(false);
    }
  };

  const desativarContato = async (contatoId: string) => {
    try {
      setProcessando(true);
      await api.patch(`/campanhas/${campanhaId}/contatos/${contatoId}`, {
        statusProspeccao: "SEM_INTERESSE",
      });
      toast.success("Contato desativado");
      onRecarregar();
    } catch {
      toast.error("Erro ao desativar contato");
    } finally {
      setProcessando(false);
    }
  };

  const blacklistContato = async (contatoId: string) => {
    try {
      setProcessando(true);
      await api.post(`/campanhas/${campanhaId}/contatos/${contatoId}/blacklist`, {
        motivo: "MANUAL",
      });
      toast.success("Telefone adicionado à blacklist");
      setConfirmandoAcao(null);
      onRecarregar();
    } catch {
      toast.error("Erro ao adicionar à blacklist");
    } finally {
      setProcessando(false);
    }
  };

  const removerLead = async (contatoId: string) => {
    try {
      setProcessando(true);
      await api.post(`/campanhas/${campanhaId}/contatos/${contatoId}/remover-lead`);
      toast.success("Lead removido. Contato restaurado como prospect.");
      setConfirmandoAcao(null);
      onRecarregar();
    } catch {
      toast.error("Erro ao remover lead");
    } finally {
      setProcessando(false);
    }
  };

  // ── Ações em lote ──────────────────────────────────────────────────────────

  const executarAcaoBulk = async () => {
    if (selecionados.size === 0 || !acaoBulk) return;
    const ids = Array.from(selecionados);

    try {
      setProcessando(true);

      if (acaoBulk === "excluir") {
        await api.delete(`/campanhas/${campanhaId}/contatos`, {
          data: { contatoIds: ids },
        });
        toast.success(`${ids.length} contato(s) excluído(s)`);

      } else if (acaoBulk === "desativar") {
        await Promise.all(
          ids.map((id) =>
            api.patch(`/campanhas/${campanhaId}/contatos/${id}`, {
              statusProspeccao: "SEM_INTERESSE",
            })
          )
        );
        toast.success(`${ids.length} contato(s) desativado(s)`);

      } else if (acaoBulk === "blacklist") {
        await Promise.all(
          ids.map((id) =>
            api.post(`/campanhas/${campanhaId}/contatos/${id}/blacklist`, {
              motivo: "MANUAL",
            })
          )
        );
        toast.success(`${ids.length} telefone(s) adicionado(s) à blacklist`);
      }

      setSelecionados(new Set());
      setAcaoBulk(null);
      onRecarregar();
    } catch {
      toast.error("Erro ao executar ação em lote");
    } finally {
      setProcessando(false);
    }
  };

  const todosEstaoSelecionados = contatos.length > 0 && selecionados.size === contatos.length;

  // ── Confirmação inline ────────────────────────────────────────────────────

  const renderConfirmacao = (contatoId: string) => {
    if (!confirmandoAcao || confirmandoAcao.contatoId !== contatoId) return null;

    const labels: Record<AcaoConfirmacao["tipo"], string> = {
      excluir: "Excluir permanentemente?",
      blacklist: "Adicionar à blacklist?",
      removerLead: "Remover lead e restaurar contato?",
    };

    const handlers: Record<AcaoConfirmacao["tipo"], () => void> = {
      excluir: () => excluirContato(contatoId),
      blacklist: () => blacklistContato(contatoId),
      removerLead: () => removerLead(contatoId),
    };

    return (
      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        <span className="text-xs text-amber-800 font-medium whitespace-nowrap">
          {labels[confirmandoAcao.tipo]}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-red-600 hover:bg-red-50 text-xs"
          onClick={handlers[confirmandoAcao.tipo]}
          disabled={processando}
        >
          {processando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-slate-600 text-xs"
          onClick={() => setConfirmandoAcao(null)}
        >
          Não
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
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
              <option value={STATUS_EM_CONTATO}>Contatando</option>
              <option value="RESPONDEU">Respondeu</option>
              <option value="INTERESSADO">Interessado</option>
              <option value="SEM_INTERESSE">Sem Interesse</option>
              <option value="LEAD">Lead</option>
              <option value="OPTOUT">Blacklist / Opt-out</option>
            </select>
          </div>

          {/* Painel de seleção múltipla */}
          {selecionados.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg flex-wrap">
              <span className="text-sm text-indigo-700 font-medium">
                {selecionados.size} selecionado(s)
              </span>

              {acaoBulk ? (
                <>
                  <span className="text-xs text-indigo-600">
                    {acaoBulk === "excluir" && "Excluir todos?"}
                    {acaoBulk === "desativar" && "Desativar todos?"}
                    {acaoBulk === "blacklist" && "Blacklist em massa?"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={executarAcaoBulk}
                    disabled={processando}
                  >
                    {processando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Confirmar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-slate-600"
                    onClick={() => setAcaoBulk(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-slate-600 hover:bg-slate-100"
                    onClick={() => setAcaoBulk("desativar")}
                  >
                    <BellOff className="w-3.5 h-3.5 mr-1" />
                    Desativar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-orange-600 hover:bg-orange-50"
                    onClick={() => setAcaoBulk("blacklist")}
                  >
                    <ShieldBan className="w-3.5 h-3.5 mr-1" />
                    Blacklist
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-red-600 hover:bg-red-50"
                    onClick={() => setAcaoBulk("excluir")}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Excluir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-slate-500"
                    onClick={() => setSelecionados(new Set())}
                  >
                    Limpar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" className="gap-2" onClick={onExportar}>
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabela */}
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
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Score de Crédito</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contatos.map((contato) => {
                    const estaConfirmando =
                      confirmandoAcao !== null && confirmandoAcao.contatoId === contato.id;
                    const statusProspeccao = obterStatusProspeccaoExibicao(contato);

                    return (
                      <tr
                        key={contato.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          selecionados.has(contato.id) ? "bg-indigo-50" : ""
                        }`}
                      >
                        {/* Checkbox */}
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

                        {/* Nome */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onVerContato(contato.id)}
                            className="font-medium text-slate-900 hover:text-brand hover:underline underline-offset-2 transition-colors text-left"
                            title="Abrir detalhes do contato"
                          >
                            {contato.nome}
                          </button>
                          {contato.cpf && (
                            <div className="text-xs text-slate-500">CPF: {contato.cpf}</div>
                          )}
                        </td>

                        {/* Telefone */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {contato.temWhatsapp && (
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span>{formatarTelefone(contato.telefone)}</span>
                          </div>
                          {contato.telefone2 && (
                            <div className="text-xs text-slate-500">
                              {formatarTelefone(contato.telefone2)}
                            </div>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3">
                          <span className="text-slate-700">{contato.email || "-"}</span>
                        </td>

                        {/* Imóvel */}
                        <td className="px-4 py-3">
                          <div
                            className="text-slate-700 max-w-[200px]"
                            title={`${contato.unidade || ""} ${
                              contato.box ? "| Box " + contato.box : ""
                            }`}
                          >
                            {contato.unidade ? (
                              <>
                                <span className="font-medium">{contato.unidade}</span>
                                {contato.box && (
                                  <span className="text-emerald-600 ml-1">Box {contato.box}</span>
                                )}
                              </>
                            ) : (
                              <span className="truncate">{contato.enderecoImovel || "-"}</span>
                            )}
                          </div>
                          {contato.bairroImovel && (
                            <div className="text-xs text-slate-500">{contato.bairroImovel}</div>
                          )}
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3">
                          {contato.scoreAssertiva ? (
                            <div
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                contato.scoreAssertiva >= 70
                                  ? "bg-emerald-100 text-emerald-700"
                                  : contato.scoreAssertiva >= 40
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {contato.scoreAssertiva}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Status + badge Lead */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusProspeccaoColor(
                                statusProspeccao
                              )}`}
                            >
                              {formatarStatusProspeccao(statusProspeccao)}
                            </span>
                            {contato.virouLead && statusProspeccao !== "LEAD" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 w-fit">
                                <UserCheck className="w-3 h-3" />
                                LEAD
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          {estaConfirmando ? (
                            renderConfirmacao(contato.id)
                          ) : (
                            <div className="flex items-center justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  {/* Ver detalhes */}
                                  <DropdownMenuItem
                                    onClick={() => onVerContato(contato.id)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4 text-slate-500" />
                                    Ver detalhes
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  {/* Desativar */}
                                  <DropdownMenuItem
                                    onClick={() => desativarContato(contato.id)}
                                    className="gap-2 cursor-pointer text-slate-700"
                                    disabled={processando}
                                  >
                                    <BellOff className="w-4 h-4 text-slate-500" />
                                    Desativar
                                  </DropdownMenuItem>

                                  {/* Blacklist */}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmandoAcao({
                                        tipo: "blacklist",
                                        contatoId: contato.id,
                                      })
                                    }
                                    className="gap-2 cursor-pointer text-orange-700"
                                    disabled={processando}
                                  >
                                    <ShieldBan className="w-4 h-4" />
                                    Enviar para blacklist
                                  </DropdownMenuItem>

                                  {/* Remover Lead — só se virouLead */}
                                  {contato.virouLead && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setConfirmandoAcao({
                                            tipo: "removerLead",
                                            contatoId: contato.id,
                                          })
                                        }
                                        className="gap-2 cursor-pointer text-violet-700"
                                        disabled={processando}
                                      >
                                        <UserMinus className="w-4 h-4" />
                                        Remover de leads
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setConfirmandoAcao({
                                            tipo: "removerLead",
                                            contatoId: contato.id,
                                          })
                                        }
                                        className="gap-2 cursor-pointer text-violet-700"
                                        disabled={processando}
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                        Definir como contato
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  <DropdownMenuSeparator />

                                  {/* Excluir */}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmandoAcao({
                                        tipo: "excluir",
                                        contatoId: contato.id,
                                      })
                                    }
                                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600"
                                    disabled={processando}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir contato
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
