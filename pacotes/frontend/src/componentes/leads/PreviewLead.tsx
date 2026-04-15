/**
 * Preview inline do lead selecionado — painel lateral direito.
 * Mostra dados resumidos, chat, imóvel e timeline sem navegar.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Phone,
  Mail,
  ExternalLink,
  Home,
  Bot,
  Calendar,
  MessageSquare,
  Target,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ChatPanel } from './ChatPanel';
import type { LeadPriorizado } from '../../ganchos/useLeadsPriorizados';
import { toast } from 'sonner';

type AbaPreview = 'resumo' | 'chat' | 'imovel' | 'timeline';

interface PreviewLeadProps {
  lead: LeadPriorizado;
  onFechar: () => void;
}

function getStatusLabel(status: string): string {
  const mapa: Record<string, string> = {
    NOVO: 'Novo',
    QUALIFICADO: 'Qualificado',
    TENTATIVA_AGENDAMENTO: 'Tentando Agendar',
    VISITA_AGENDADA: 'Visita Agendada',
    CONTATANDO: 'Contatando',
    AVALIACAO_EM_ANDAMENTO: 'Avaliação',
    DOCUMENTACAO: 'Documentação',
    EM_NEGOCIACAO: 'Negociação',
    ONBOARDING: 'Onboarding',
    CAPTADO: 'Captado',
    PERDIDO: 'Perdido',
    ARQUIVADO: 'Arquivado',
  };
  return mapa[status] || status;
}

function getStatusColor(status: string): string {
  if (['NOVO', 'QUALIFICADO'].includes(status)) return 'bg-indigo-100 text-indigo-700';
  if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'CONTATANDO'].includes(status)) return 'bg-amber-100 text-amber-700';
  if (['DOCUMENTACAO', 'EM_NEGOCIACAO', 'AVALIACAO_EM_ANDAMENTO'].includes(status)) return 'bg-violet-100 text-violet-700';
  if (['ONBOARDING'].includes(status)) return 'bg-emerald-100 text-emerald-700';
  if (status === 'CAPTADO') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PERDIDO') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-700';
}

export function PreviewLead({ lead, onFechar }: PreviewLeadProps) {
  const navigate = useNavigate();
  const [aba, setAba] = useState<AbaPreview>('resumo');
  const [copiado, setCopiado] = useState(false);

  const copiarTelefone = () => {
    if (lead.telefone) {
      navigator.clipboard.writeText(lead.telefone);
      setCopiado(true);
      toast.success('Telefone copiado!');
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate text-sm">{lead.nome || 'Sem nome'}</h3>
            <Badge className={`text-[10px] ${getStatusColor(lead.status)}`}>
              {getStatusLabel(lead.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {lead.telefone && (
              <button
                onClick={copiarTelefone}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                <Phone className="w-3 h-3" />
                {lead.telefone}
                {copiado ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
            {lead.email && (
              <span className="flex items-center gap-1 text-xs text-slate-400 truncate">
                <Mail className="w-3 h-3" />
                {lead.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
          >
            <ExternalLink className="w-3 h-3" />
            Abrir
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onFechar}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {[
          { id: 'resumo' as const, label: 'Resumo', icone: Target },
          { id: 'chat' as const, label: 'Chat', icone: MessageSquare },
          { id: 'imovel' as const, label: 'Imóvel', icone: Home },
          { id: 'timeline' as const, label: 'Timeline', icone: Clock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setAba(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all
              ${aba === tab.id
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }
            `}
          >
            <tab.icone className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {aba === 'resumo' && <AbaResumo lead={lead} />}
        {aba === 'chat' && (
          <ChatPanel
            leadId={lead.id}
            leadNome={lead.nome || 'Lead'}
            leadTelefone={lead.telefone}
          />
        )}
        {aba === 'imovel' && <AbaImovel lead={lead} />}
        {aba === 'timeline' && <AbaTimeline lead={lead} />}
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTES ============

function AbaResumo({ lead }: { lead: LeadPriorizado }) {
  return (
    <div className="p-4 space-y-4">
      {/* Score + Urgência */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={`
            w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold
            ${lead.urgencia >= 50 ? 'bg-red-100 text-red-700' :
              lead.urgencia >= 25 ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'}
          `}>
            {lead.urgencia}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Urgência</p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-slate-500 font-medium">💡 {lead.motivoUrgencia}</p>
          {lead.ultimaAcaoIA && (
            <p className="text-[11px] text-indigo-600 mt-1 flex items-center gap-1">
              <Bot className="w-3 h-3" />
              {lead.ultimaAcaoIA}
            </p>
          )}
        </div>
      </div>

      {/* Resumo IA */}
      <div className="bg-indigo-50/70 rounded-lg p-3 border border-indigo-100">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Bot className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Resumo IA</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">{lead.resumoIA}</p>
      </div>

      {/* Dados SPIN resumidos */}
      {(lead.doresIdentificadas.length > 0 || lead.objecoes.length > 0) && (
        <div className="space-y-2">
          {lead.doresIdentificadas.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
              <p className="text-[10px] font-semibold text-amber-700 mb-1">Dores identificadas</p>
              <div className="flex flex-wrap gap-1">
                {lead.doresIdentificadas.map((d, i) => (
                  <span key={i} className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {lead.objecoes.length > 0 && (
            <div className="bg-red-50 rounded-lg p-2.5 border border-red-100">
              <p className="text-[10px] font-semibold text-red-700 mb-1">Objeções</p>
              <div className="flex flex-wrap gap-1">
                {lead.objecoes.map((o, i) => (
                  <span key={i} className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Próxima atividade */}
      {lead.proximaAtividade && (
        <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] font-semibold text-emerald-700 uppercase">Próxima atividade</span>
          </div>
          <p className="text-xs text-slate-700">{lead.proximaAtividade.titulo}</p>
          {lead.proximaAtividade.agendadoPara && (
            <p className="text-[10px] text-emerald-600 mt-1">
              {new Date(lead.proximaAtividade.agendadoPara).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AbaImovel({ lead }: { lead: LeadPriorizado }) {
  return (
    <div className="p-4 space-y-3">
      {lead.enderecoImovel || lead.tipoImovel || lead.valorPretendido ? (
        <>
          {lead.enderecoImovel && (
            <div>
              <p className="text-[10px] text-slate-500 font-medium uppercase">Endereço</p>
              <p className="text-xs text-slate-800 mt-0.5">{lead.enderecoImovel}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {lead.tipoImovel && (
              <div>
                <p className="text-[10px] text-slate-500 font-medium uppercase">Tipo</p>
                <p className="text-xs text-slate-800 mt-0.5 capitalize">{lead.tipoImovel}</p>
              </div>
            )}
            {lead.interesseEm && (
              <div>
                <p className="text-[10px] text-slate-500 font-medium uppercase">Interesse</p>
                <p className="text-xs text-slate-800 mt-0.5">{lead.interesseEm}</p>
              </div>
            )}
            {lead.valorPretendido && (
              <div className="col-span-2">
                <p className="text-[10px] text-slate-500 font-medium uppercase">Valor pretendido</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  R$ {Number(lead.valorPretendido).toLocaleString('pt-BR')}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <Home className="w-8 h-8 mx-auto mb-2 text-slate-200" />
          <p className="text-xs">Nenhum dado do imóvel registrado ainda</p>
        </div>
      )}
    </div>
  );
}

function AbaTimeline({ lead }: { lead: LeadPriorizado }) {
  const itens: { tipo: string; texto: string; quando: string }[] = [];

  if (lead.ultimaAcaoIA && lead.ultimaAcaoIAEm) {
    itens.push({
      tipo: 'ia',
      texto: lead.ultimaAcaoIA,
      quando: lead.ultimaAcaoIAEm,
    });
  }
  if (lead.proximaAtividade?.agendadoPara) {
    itens.push({
      tipo: 'atividade',
      texto: lead.proximaAtividade.titulo,
      quando: lead.proximaAtividade.agendadoPara,
    });
  }
  itens.push({
    tipo: 'criacao',
    texto: 'Lead criado',
    quando: lead.criadoEm,
  });

  itens.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());

  return (
    <div className="p-4">
      {itens.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-200" />
          <p className="text-xs">Nenhum evento registrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {itens.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  item.tipo === 'ia' ? 'bg-indigo-500' :
                  item.tipo === 'atividade' ? 'bg-amber-500' :
                  'bg-slate-300'
                }`} />
                {i < itens.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
              </div>
              <div className="pb-3">
                <p className="text-xs text-slate-800">{item.texto}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(item.quando).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-indigo-600 h-7"
              onClick={() => window.location.href = `/dashboard/leads/${lead.id}`}
            >
              Ver timeline completa →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
