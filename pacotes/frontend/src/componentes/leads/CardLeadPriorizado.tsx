/**
 * Card de lead individual no feed priorizado.
 * Mostra urgência, resumo IA, ação recomendada e botões rápidos.
 */

import {
  Phone,
  MessageSquare,
  Eye,
  Clock,
  Calendar,
  Flame,
  Zap,
  Snowflake,
  Bot,
} from 'lucide-react';
import { Button } from '../ui/button';
import type { LeadPriorizado, CategoriaUrgencia } from '../../ganchos/useLeadsPriorizados';

interface CardLeadPriorizadoProps {
  lead: LeadPriorizado;
  selecionado: boolean;
  onSelecionar: (lead: LeadPriorizado) => void;
  onAbrirChat: (lead: LeadPriorizado) => void;
}

const CATEGORIA_CONFIG: Record<CategoriaUrgencia, {
  cor: string;
  corBorda: string;
  corFundo: string;
  icone: string;
  label: string;
}> = {
  URGENTE: {
    cor: 'text-red-600',
    corBorda: 'border-l-red-500',
    corFundo: 'bg-red-50/60',
    icone: '🔴',
    label: 'URGENTE',
  },
  ATENCAO: {
    cor: 'text-amber-600',
    corBorda: 'border-l-amber-400',
    corFundo: 'bg-amber-50/40',
    icone: '🟡',
    label: 'ATENÇÃO',
  },
  IA_ATIVA: {
    cor: 'text-indigo-600',
    corBorda: 'border-l-indigo-400',
    corFundo: 'bg-indigo-50/40',
    icone: '🟢',
    label: 'IA ATIVA',
  },
  SEM_ACAO: {
    cor: 'text-slate-500',
    corBorda: 'border-l-slate-300',
    corFundo: 'bg-white',
    icone: '⚪',
    label: 'EM ESPERA',
  },
};

function TemperaturaIcone({ temperatura }: { temperatura: string | null }) {
  if (temperatura === 'QUENTE') return <Flame className="w-3.5 h-3.5 text-red-500" />;
  if (temperatura === 'MORNO') return <Zap className="w-3.5 h-3.5 text-amber-500" />;
  return <Snowflake className="w-3.5 h-3.5 text-blue-400" />;
}

function TemperaturaLabel({ temperatura }: { temperatura: string | null }) {
  if (temperatura === 'QUENTE') return <span className="text-red-600 font-medium">Quente</span>;
  if (temperatura === 'MORNO') return <span className="text-amber-600 font-medium">Morno</span>;
  return <span className="text-blue-500 font-medium">Frio</span>;
}

export function CardLeadPriorizado({
  lead,
  selecionado,
  onSelecionar,
  onAbrirChat,
}: CardLeadPriorizadoProps) {
  const config = CATEGORIA_CONFIG[lead.categoriaUrgencia];

  return (
    <div
      className={`
        group relative border-l-4 rounded-xl p-4 cursor-pointer
        transition-all duration-200 ease-out
        hover:shadow-lg hover:scale-[1.01]
        ${config.corBorda} ${config.corFundo}
        ${selecionado
          ? 'ring-2 ring-indigo-400 shadow-md bg-white'
          : 'hover:bg-white'
        }
      `}
      onClick={() => onSelecionar(lead)}
    >
      {/* Header: Categoria + SLA */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wide">{config.icone} {config.label}</span>
          {lead.categoriaUrgencia === 'IA_ATIVA' && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
          )}
        </div>
        {lead.horasSemResposta !== null && lead.horasSemResposta > 1 && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{Math.round(lead.horasSemResposta)}h sem resp.</span>
          </div>
        )}
      </div>

      {/* Nome + Temperatura */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-900 text-sm truncate max-w-[70%]">
          {lead.nome || 'Sem nome'}
        </h3>
        <div className="flex items-center gap-1.5 text-xs">
          <TemperaturaIcone temperatura={lead.temperatura} />
          <TemperaturaLabel temperatura={lead.temperatura} />
        </div>
      </div>

      {/* Resumo IA */}
      <div className="flex items-start gap-2 mb-3 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
        <Bot className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
          {lead.resumoIA}
        </p>
      </div>

      {/* Motivo urgência (ação recomendada) */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[11px] text-slate-500">💡</span>
        <span className="text-xs text-slate-600 font-medium">{lead.motivoUrgencia}</span>
      </div>

      {/* Agendamento se houver */}
      {lead.proximaAtividade && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-100">
          <Calendar className="w-3 h-3" />
          <span className="font-medium">{lead.proximaAtividade.titulo}</span>
          {lead.proximaAtividade.agendadoPara && (
            <span className="text-amber-500 ml-auto">
              {new Date(lead.proximaAtividade.agendadoPara).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
        </div>
      )}

      {/* Botões de ação rápida */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-slate-100">
        {lead.telefone && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={(e) => {
              e.stopPropagation();
              const numero = lead.telefone!.replace(/\D/g, '');
              window.open(`https://wa.me/55${numero}`, '_blank');
            }}
          >
            <Phone className="w-3 h-3" />
            WhatsApp
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
          onClick={(e) => {
            e.stopPropagation();
            onAbrirChat(lead);
          }}
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1 text-slate-600 hover:text-slate-800 ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            onSelecionar(lead);
          }}
        >
          <Eye className="w-3 h-3" />
          Ver
        </Button>
      </div>
    </div>
  );
}
