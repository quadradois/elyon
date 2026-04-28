/**
 * NotificacoesDropdown
 * 
 * Componente de notificações em tempo real
 * Exibe alertas do sistema com badge contador
 */

import { useState } from 'react';
import { useAlertas } from '../ganchos/useAlertas';
import { Bell, MessageSquare, AlertTriangle, CheckCircle, Clock, User, Phone, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function NotificacoesDropdown() {
  const [aberto, setAberto] = useState(false);
  const { alertas, totalPendentes, conectado, carregando, marcarVisualizado, marcarAtendido } = useAlertas();
  
  // Ícone baseado no tipo
  const getIcone = (tipo: string) => {
    switch (tipo) {
      case 'ATENDIMENTO_HUMANO':
        return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case 'LEAD_QUENTE':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'escalacao':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };
  
  // Cor do badge baseado na prioridade
  const getBadgeCor = (prioridade: string) => {
    switch (prioridade) {
      case 'alta':
        return 'bg-red-500';
      case 'media':
        return 'bg-orange-500';
      default:
        return 'bg-brand';
    }
  };
  
  // Formatar tempo relativo
  const formatarTempo = (data: string) => {
    try {
      return formatDistanceToNow(new Date(data), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'agora';
    }
  };
  
  return (
    <div className="relative">
      {/* Botão do sino */}
      <button
        onClick={() => setAberto(!aberto)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={conectado ? 'Notificações em tempo real' : 'Reconectando...'}
      >
        <Bell className={`w-5 h-5 ${conectado ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`} />
        
        {/* Badge contador */}
        {totalPendentes > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {totalPendentes > 9 ? '9+' : totalPendentes}
          </span>
        )}
        
        {/* Indicador de conexão */}
        <span 
          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
            conectado ? 'bg-success' : 'bg-slate-400'
          }`}
          title={conectado ? 'Conectado' : 'Desconectado'}
        />
      </button>
      
      {/* Dropdown */}
      {aberto && (
        <>
          {/* Overlay para fechar */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setAberto(false)}
          />
          
          {/* Painel de notificações */}
          <div className="absolute right-0 mt-2 w-96 max-h-[500px] overflow-hidden bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notificações
                {totalPendentes > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium text-white bg-red-500 rounded-full">
                    {totalPendentes}
                  </span>
                )}
              </h3>
              
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`flex items-center gap-1 ${conectado ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${conectado ? 'bg-success' : 'bg-slate-400'}`} />
                  {conectado ? 'Ao vivo' : 'Offline'}
                </span>
              </div>
            </div>
            
            {/* Lista de alertas */}
            <div className="max-h-[400px] overflow-y-auto">
              {carregando ? (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <Clock className="w-5 h-5 animate-spin mr-2" />
                  Carregando...
                </div>
              ) : alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mb-3 text-emerald-500" />
                  <p className="font-medium">Tudo em dia!</p>
                  <p className="text-sm">Nenhum alerta pendente</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alertas.map((alerta) => (
                    <li 
                      key={alerta.id}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
                        alerta.status === 'pendente' ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                      }`}
                      onClick={() => {
                        if (alerta.status === 'pendente') {
                          marcarVisualizado(alerta.id);
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        {/* Ícone */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          alerta.prioridade === 'alta' 
                            ? 'bg-red-100 dark:bg-red-900/30' 
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}>
                          {getIcone(alerta.tipo)}
                        </div>
                        
                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                              {alerta.titulo}
                            </p>
                            <span className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium text-white rounded-full ${getBadgeCor(alerta.prioridade)}`}>
                              {alerta.prioridade}
                            </span>
                          </div>
                          
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {alerta.descricao}
                          </p>
                          
                          {/* Info do lead */}
                          {alerta.leadNome && (
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {alerta.leadNome}
                              </span>
                              {alerta.leadTelefone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {alerta.leadTelefone}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-slate-400">
                              {formatarTempo(alerta.criadoEm)}
                            </span>
                            
                            <div className="flex gap-2">
                              {alerta.leadId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Rota de conversas está em construção; abrir detalhe do lead
                                    window.location.href = `/dashboard/leads/${alerta.leadId}`;
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand hover:text-brand hover:bg-indigo-50 rounded transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Ver lead
                                </button>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  marcarAtendido(alerta.id);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Atendido
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            {/* Footer */}
            {alertas.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <a 
                  href="/dashboard/alertas"
                  className="block text-center text-sm font-medium text-brand hover:text-brand"
                >
                  Ver todos os alertas
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
