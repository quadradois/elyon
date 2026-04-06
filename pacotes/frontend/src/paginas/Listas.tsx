import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../componentes/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../componentes/ui/card";
import {
  List,
  Plus,
  Building2,
  Users,
  Phone,
  MessageCircle,
  Loader2,
  Trash2,
  Eye,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { api } from "../servicos/api";

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
}

export default function Listas() {
  const navigate = useNavigate();
  const [listas, setListas] = useState<Lista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  useEffect(() => {
    carregarListas();
  }, []);

  const carregarListas = async () => {
    try {
      setCarregando(true);
      const response = await api.get('/listas');
      setListas(response.data);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    } finally {
      setCarregando(false);
    }
  };

  const excluirLista = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta lista? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setExcluindo(id);
      await api.delete(`/listas/${id}`);
      setListas(listas.filter(l => l.id !== id));
    } catch (error) {
      console.error('Erro ao excluir lista:', error);
      alert('Erro ao excluir lista');
    } finally {
      setExcluindo(null);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Listas de Contatos</h1>
          <p className="text-slate-500 mt-1">
            Gerencie suas listas de contatos extraídos de empreendimentos
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/captacao')} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Captação
        </Button>
      </div>

      {/* Lista vazia */}
      {listas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <List className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Nenhuma lista criada
            </h3>
            <p className="text-slate-500 text-center max-w-md mb-6">
              Use o assistente de Captação para pesquisar um empreendimento e criar sua primeira lista de contatos.
            </p>
            <Button onClick={() => navigate('/dashboard/captacao')}>
              <Plus className="w-4 h-4 mr-2" />
              Iniciar Captação
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid de Listas */}
      {listas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listas.map((lista) => (
            <Card 
              key={lista.id} 
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/dashboard/listas/${lista.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{lista.nome}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {lista.nomeEdificio}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      excluirLista(lista.id);
                    }}
                    disabled={excluindo === lista.id}
                  >
                    {excluindo === lista.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Estatísticas */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">
                      <strong className="text-slate-900">{lista.totalContatos}</strong> contatos
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">
                      <strong className="text-slate-900">{lista.totalEnriquecidos}</strong> c/ telefone
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-600">
                      <strong className="text-slate-900">{lista.totalComWhatsapp}</strong> WhatsApp
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                    <span className="text-slate-600">
                      <strong className="text-slate-900">{lista.totalUsados}</strong> usados
                    </span>
                  </div>
                </div>

                {/* Barra de progresso de uso */}
                {lista.totalContatos > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Uso em campanhas</span>
                      <span>{Math.round((lista.totalUsados / lista.totalContatos) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand rounded-full transition-all"
                        style={{ width: `${(lista.totalUsados / lista.totalContatos) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatarData(lista.criadoEm)}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/listas/${lista.id}`);
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
