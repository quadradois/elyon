/**
 * Página de Gerenciamento de Blacklist
 * 
 * Permite visualizar, adicionar e remover contatos bloqueados
 * que o agente não deve responder
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Phone, 
  User, 
  Calendar,
  Ban,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Upload
} from 'lucide-react';
import { Button } from '../componentes/ui/button';
import { api } from '../servicos/api';

// Tipos
interface ContatoBloqueado {
  id: string;
  telefone: string;
  motivo: string;
  nomeContato?: string;
  campanhaOrigem?: string;
  observacoes?: string;
  criadoEm: string;
}

const MOTIVOS_DESCRICAO: Record<string, string> = {
  'CONTATO_PESSOAL': '👤 Contato pessoal',
  'OPTOUT': 'Pediu para sair',
  'INVALIDO': 'Número inválido',
  'RECLAMACAO': 'Reclamou do contato',
  'BLOQUEADO_WHATSAPP': 'Bloqueou no WhatsApp',
  'MANUAL': 'Bloqueado manualmente',
  'NAO_PERTURBE': 'Lista "não perturbe"',
  'CONCORRENTE': 'É um concorrente',
  'SPAM': 'Enviou spam'
};

const MOTIVOS_COR: Record<string, string> = {
  'CONTATO_PESSOAL': 'bg-indigo-100 text-indigo-800',
  'OPTOUT': 'bg-amber-100 text-amber-800',
  'INVALIDO': 'bg-gray-100 text-gray-800',
  'RECLAMACAO': 'bg-red-100 text-red-800',
  'BLOQUEADO_WHATSAPP': 'bg-emerald-100 text-emerald-800',
  'MANUAL': 'bg-indigo-100 text-indigo-800',
  'NAO_PERTURBE': 'bg-violet-100 text-violet-800',
  'CONCORRENTE': 'bg-orange-100 text-orange-800',
  'SPAM': 'bg-red-100 text-red-800'
};

export function Blacklist() {
  // Estados
  const [bloqueados, setBloqueados] = useState<ContatoBloqueado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState<string>('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [estatisticas, setEstatisticas] = useState<Record<string, number>>({});
  
  // Modal de adicionar
  const [modalAberto, setModalAberto] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('MANUAL');
  const [novaObservacao, setNovaObservacao] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  
  // Modal de lote
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [telefonesLote, setTelefonesLote] = useState('');
  const [motivoLote, setMotivoLote] = useState('MANUAL');
  
  // Tenant
  const tenant = JSON.parse(localStorage.getItem('elyon_tenant') || '{}');
  
  // Buscar dados
  const buscarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        limite: '20',
        tenantId: tenant.id
      });
      
      if (busca) params.append('busca', busca);
      if (filtroMotivo) params.append('motivo', filtroMotivo);
      
      const response = await api.get(`/blacklist?${params.toString()}`);
      
      setBloqueados(response.data.telefones || []);
      setTotal(response.data.total || 0);
      setTotalPaginas(Math.ceil((response.data.total || 0) / 20));
      
    } catch (error) {
      console.error('Erro ao buscar blacklist:', error);
    } finally {
      setCarregando(false);
    }
  }, [tenant.id, pagina, busca, filtroMotivo]);
  
  // Buscar estatísticas
  const buscarEstatisticas = useCallback(async () => {
    try {
      const response = await api.get(`/blacklist/estatisticas?tenantId=${tenant.id}`);
      setEstatisticas(response.data.porMotivo || {});
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  }, [tenant.id]);
  
  useEffect(() => {
    buscarDados();
    buscarEstatisticas();
  }, [buscarDados, buscarEstatisticas]);
  
  // Adicionar à blacklist
  const adicionarBlacklist = async () => {
    if (!novoTelefone.trim()) return;
    
    setAdicionando(true);
    try {
      await api.post('/blacklist', {
        telefone: novoTelefone.trim(),
        motivo: novoMotivo,
        nomeContato: novoNome.trim() || undefined,
        observacoes: novaObservacao.trim() || undefined,
        tenantId: tenant.id
      });
      
      // Limpar e fechar modal
      setNovoTelefone('');
      setNovoNome('');
      setNovoMotivo('MANUAL');
      setNovaObservacao('');
      setModalAberto(false);
      
      // Recarregar dados
      buscarDados();
      buscarEstatisticas();
      
    } catch (error: any) {
      console.error('Erro ao adicionar:', error);
      alert(error.response?.data?.erro || 'Erro ao adicionar à blacklist');
    } finally {
      setAdicionando(false);
    }
  };
  
  // Adicionar em lote
  const adicionarLote = async () => {
    const telefones = telefonesLote
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length >= 8);
    
    if (telefones.length === 0) {
      alert('Nenhum telefone válido encontrado');
      return;
    }
    
    setAdicionando(true);
    try {
      const response = await api.post('/blacklist/lote', {
        telefones,
        motivo: motivoLote,
        tenantId: tenant.id
      });
      
      alert(`${response.data.adicionados} telefones adicionados, ${response.data.erros} erros`);
      
      setTelefonesLote('');
      setModalLoteAberto(false);
      
      buscarDados();
      buscarEstatisticas();
      
    } catch (error: any) {
      console.error('Erro ao adicionar lote:', error);
      alert(error.response?.data?.erro || 'Erro ao adicionar lote');
    } finally {
      setAdicionando(false);
    }
  };
  
  // Remover da blacklist
  const removerBlacklist = async (telefone: string) => {
    if (!confirm('Deseja remover este telefone da blacklist?')) return;
    
    try {
      await api.delete(`/blacklist/${encodeURIComponent(telefone)}?tenantId=${tenant.id}`);
      buscarDados();
      buscarEstatisticas();
    } catch (error) {
      console.error('Erro ao remover:', error);
      alert('Erro ao remover da blacklist');
    }
  };
  
  // Formatar telefone para exibição
  const formatarTelefone = (telefone: string): string => {
    if (!telefone) return '-';
    // Remove 55 do início se tiver
    let num = telefone.replace(/\D/g, '');
    if (num.startsWith('55')) num = num.slice(2);
    // Formata como (XX) XXXXX-XXXX
    if (num.length === 11) {
      return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
    }
    if (num.length === 10) {
      return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`;
    }
    return telefone;
  };
  
  // Formatar data
  const formatarData = (dataStr: string): string => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Contatos Bloqueados
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie os telefones que o agente não deve responder
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setModalLoteAberto(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar Lote
          </Button>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>
      
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Object.entries(MOTIVOS_DESCRICAO).slice(0, 6).map(([motivo, descricao]) => (
          <div 
            key={motivo}
            className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
              filtroMotivo === motivo ? 'ring-2 ring-brand border-brand' : 'hover:border-indigo-300'
            }`}
            onClick={() => setFiltroMotivo(filtroMotivo === motivo ? '' : motivo)}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${MOTIVOS_COR[motivo]}`}>
                {motivo}
              </span>
              <span className="text-2xl font-bold text-slate-900">
                {estatisticas[motivo] || 0}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 truncate" title={descricao}>
              {descricao}
            </p>
          </div>
        ))}
      </div>
      
      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por telefone ou nome..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
          />
        </div>
        
        <select
          value={filtroMotivo}
          onChange={(e) => {
            setFiltroMotivo(e.target.value);
            setPagina(1);
          }}
          title="Filtrar por motivo"
          aria-label="Filtrar por motivo"
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
        >
          <option value="">Todos os motivos</option>
          {Object.entries(MOTIVOS_DESCRICAO).map(([valor, desc]) => (
            <option key={valor} value={valor}>{desc}</option>
          ))}
        </select>
        
        <Button variant="outline" onClick={buscarDados}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Tabela */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {carregando ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : bloqueados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <Ban className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-lg font-medium">Nenhum contato bloqueado</p>
            <p className="text-sm">Adicione telefones que o agente não deve responder</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Observações
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bloqueados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-sm">
                          {formatarTelefone(item.telefone)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {item.nomeContato || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${MOTIVOS_COR[item.motivo] || 'bg-gray-100 text-gray-800'}`}>
                        {item.motivo}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500 max-w-xs truncate block" title={item.observacoes}>
                        {item.observacoes || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        {formatarData(item.criadoEm)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removerBlacklist(item.telefone)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <span className="text-sm text-slate-500">
              Mostrando {((pagina - 1) * 20) + 1} a {Math.min(pagina * 20, total)} de {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal Adicionar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Adicionar à Blacklist</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(e.target.value)}
                  placeholder="(XX) XXXXX-XXXX"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome (opcional)
                </label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome do contato"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo *
                </label>
                <select
                  value={novoMotivo}
                  onChange={(e) => setNovoMotivo(e.target.value)}
                  title="Selecionar motivo"
                  aria-label="Selecionar motivo"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  {Object.entries(MOTIVOS_DESCRICAO).map(([valor, desc]) => (
                    <option key={valor} value={valor}>{desc}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  value={novaObservacao}
                  onChange={(e) => setNovaObservacao(e.target.value)}
                  placeholder="Notas adicionais..."
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={adicionarBlacklist}
                disabled={!novoTelefone.trim() || adicionando}
              >
                {adicionando ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Importar Lote */}
      {modalLoteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Importar Telefones em Lote</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefones (um por linha)
                </label>
                <textarea
                  value={telefonesLote}
                  onChange={(e) => setTelefonesLote(e.target.value)}
                  placeholder="(11) 99999-9999&#10;(21) 88888-8888&#10;(31) 77777-7777"
                  rows={10}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {telefonesLote.split('\n').filter(t => t.trim().length >= 8).length} telefones válidos
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo para todos
                </label>
                <select
                  value={motivoLote}
                  onChange={(e) => setMotivoLote(e.target.value)}
                  title="Selecionar motivo do lote"
                  aria-label="Selecionar motivo do lote"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  {Object.entries(MOTIVOS_DESCRICAO).map(([valor, desc]) => (
                    <option key={valor} value={valor}>{desc}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setModalLoteAberto(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={adicionarLote}
                disabled={telefonesLote.trim().length === 0 || adicionando}
              >
                {adicionando ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Importar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
