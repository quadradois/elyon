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
} from "../componentes/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Users,
  Phone,
  MessageCircle,
  Loader2,
  CheckCircle2,
  Plus,
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { api } from "../servicos/api";

interface ContatoLista {
  id: string;
  nome: string;
  cpf?: string;
  inscricaoIptu?: string;
  unidade?: string;
  box?: string;
  enderecoImovel?: string;
  bairroImovel?: string;
  telefone?: string;
  telefone2?: string;
  telefone3?: string;
  email?: string;
  temWhatsapp: boolean;
  quantidadeWhatsapp: number;
  usadoEmCampanha: boolean;
}

interface Lista {
  id: string;
  nome: string;
  nomeEdificio: string;
  localizacao?: string;
  totalContatos: number;
  totalEnriquecidos: number;
  totalComWhatsapp: number;
  totalUsados: number;
  criadoEm: string;
  contatos: ContatoLista[];
  paginacao: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
}

interface Campanha {
  id: string;
  nome: string;
  status: string;
  totalContatos: number;
}

export default function ListaDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [lista, setLista] = useState<Lista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  
  const [modalCampanhaOpen, setModalCampanhaOpen] = useState(false);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<string>('');
  const [contatosSelecionados, setContatosSelecionados] = useState<Set<string>>(new Set());
  const [adicionando, setAdicionando] = useState(false);
  const [selecionarTodos, setSelecionarTodos] = useState(false);

  useEffect(() => {
    carregarLista();
    carregarCampanhas();
  }, [id, paginaAtual]);

  const carregarLista = async () => {
    try {
      setCarregando(true);
      const response = await api.get(`/listas/${id}?pagina=${paginaAtual}&limite=50`);
      setLista(response.data);
    } catch (error) {
      console.error('Erro ao carregar lista:', error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarCampanhas = async () => {
    try {
      const response = await api.get('/campanhas');
      const arrayCampanhas = response.data?.campanhas || (Array.isArray(response.data) ? response.data : []);
      // Filtrar apenas campanhas ativas ou pausadas
      const campanhasDisponiveis = arrayCampanhas.filter(
        (c: Campanha) => c.status === 'ATIVA' || c.status === 'PAUSADA' || c.status === 'RASCUNHO'
      );
      setCampanhas(campanhasDisponiveis);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
    }
  };

  const toggleSelecionarContato = (contatoId: string) => {
    const novos = new Set(contatosSelecionados);
    if (novos.has(contatoId)) {
      novos.delete(contatoId);
    } else {
      novos.add(contatoId);
    }
    setContatosSelecionados(novos);
  };

  const toggleSelecionarTodos = () => {
    if (selecionarTodos) {
      setContatosSelecionados(new Set());
    } else {
      const todos = new Set(lista?.contatos.map(c => c.id) || []);
      setContatosSelecionados(todos);
    }
    setSelecionarTodos(!selecionarTodos);
  };

  const adicionarACampanha = async () => {
    if (!campanhaSelecionada) {
      alert('Selecione uma campanha');
      return;
    }

    try {
      setAdicionando(true);
      
      const contatoIds = selecionarTodos ? undefined : Array.from(contatosSelecionados);
      
      const response = await api.post(`/listas/${id}/adicionar-campanha`, {
        campanhaId: campanhaSelecionada,
        contatoIds,
      });

      alert(`${response.data.adicionados} contatos adicionados à campanha!`);
      
      setModalCampanhaOpen(false);
      setContatosSelecionados(new Set());
      setSelecionarTodos(false);
      carregarLista(); // Recarregar para atualizar status
    } catch (error) {
      console.error('Erro ao adicionar à campanha:', error);
      alert('Erro ao adicionar contatos à campanha');
    } finally {
      setAdicionando(false);
    }
  };

  const formatarCpf = (cpf?: string) => {
    if (!cpf) return '-';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatarTelefone = (tel?: string) => {
    if (!tel) return '-';
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 11) {
      return limpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    if (limpo.length === 10) {
      return limpo.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return tel;
  };

  if (carregando && !lista) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!lista) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-slate-900">Lista não encontrada</h2>
        <Button onClick={() => navigate('/dashboard/listas')} className="mt-4">
          Voltar para Listas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard/listas")}
            className="gap-2 -ml-3 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Listas
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{lista.nome}</h1>
              <p className="text-slate-500">{lista.nomeEdificio}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setModalCampanhaOpen(true)}
            className="gap-2"
            disabled={lista.contatos.length === 0}
          >
            <Plus className="w-4 h-4" />
            Adicionar à Campanha
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lista.totalContatos}</p>
                <p className="text-sm text-slate-500">Total de contatos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lista.totalEnriquecidos}</p>
                <p className="text-sm text-slate-500">Com telefone</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lista.totalComWhatsapp}</p>
                <p className="text-sm text-slate-500">Com WhatsApp</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{lista.totalUsados}</p>
                <p className="text-sm text-slate-500">Já usados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Contatos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contatos</CardTitle>
              <CardDescription>
                {lista.paginacao.total} contatos na lista
              </CardDescription>
            </div>
            {contatosSelecionados.size > 0 && (
              <div className="text-sm text-brand font-medium">
                {contatosSelecionados.size} selecionado(s)
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-2 text-left">
                    <input
                      type="checkbox"
                      checked={selecionarTodos}
                      onChange={toggleSelecionarTodos}
                      className="rounded border-slate-300"
                      title="Selecionar todos os contatos"
                    />
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Nome
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-medium text-slate-500 uppercase">
                    CPF
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Unidade
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Telefone
                  </th>
                  <th className="py-3 px-2 text-left text-xs font-medium text-slate-500 uppercase">
                    Email
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-medium text-slate-500 uppercase">
                    WhatsApp
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-medium text-slate-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.contatos.map((contato) => (
                  <tr 
                    key={contato.id} 
                    className={`border-b border-slate-100 hover:bg-slate-50 ${
                      contato.usadoEmCampanha ? 'bg-slate-50 opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-2">
                      <input
                        type="checkbox"
                        checked={contatosSelecionados.has(contato.id)}
                        onChange={() => toggleSelecionarContato(contato.id)}
                        disabled={contato.usadoEmCampanha}
                        className="rounded border-slate-300"
                        title="Selecionar contato"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-medium text-slate-900">{contato.nome}</span>
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-600">
                      {formatarCpf(contato.cpf)}
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-600">
                      {contato.unidade || '-'}
                      {contato.box && ` / Box ${contato.box}`}
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-600">
                      {formatarTelefone(contato.telefone)}
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-600">
                      {contato.email || '-'}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {contato.temWhatsapp ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                          <MessageCircle className="w-3 h-3" />
                          {contato.quantidadeWhatsapp}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {contato.usadoEmCampanha ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">
                          <Check className="w-3 h-3" />
                          Usado
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Disponível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {lista.paginacao.totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Página {lista.paginacao.pagina} de {lista.paginacao.totalPaginas}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaAtual(p => Math.min(lista.paginacao.totalPaginas, p + 1))}
                  disabled={paginaAtual === lista.paginacao.totalPaginas}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Adicionar à Campanha */}
      <Dialog open={modalCampanhaOpen} onOpenChange={setModalCampanhaOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-brand" />
              Adicionar à Campanha
            </DialogTitle>
            <DialogDescription>
              {selecionarTodos || contatosSelecionados.size === 0 
                ? `Todos os ${lista.contatos.filter(c => !c.usadoEmCampanha).length} contatos disponíveis serão adicionados.`
                : `${contatosSelecionados.size} contato(s) selecionado(s) serão adicionados.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Selecione a campanha
            </label>
            <select
              value={campanhaSelecionada}
              onChange={(e) => setCampanhaSelecionada(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand focus:border-brand"
              title="Selecione a campanha"
            >
              <option value="">Selecione uma campanha...</option>
              {campanhas.map((campanha) => (
                <option key={campanha.id} value={campanha.id}>
                  {campanha.nome} ({campanha.totalContatos} contatos)
                </option>
              ))}
            </select>

            {campanhas.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">
                Nenhuma campanha disponível. 
                <Button 
                  variant="link" 
                  className="px-1 h-auto"
                  onClick={() => navigate('/dashboard/campanhas')}
                >
                  Criar campanha
                </Button>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCampanhaOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={adicionarACampanha} 
              disabled={!campanhaSelecionada || adicionando}
            >
              {adicionando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
