/**
 * Card de lead priorizado — Design Premium v2.0
 * Visual rico, hierarquia clara, ações evidentes.
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
  ChevronRight,
} from 'lucide-react';
import type { LeadPriorizado, CategoriaUrgencia } from '../../ganchos/useLeadsPriorizados';

interface CardLeadPriorizadoProps {
  lead: LeadPriorizado;
  selecionado: boolean;
  onSelecionar: (lead: LeadPriorizado) => void;
  onAbrirChat: (lead: LeadPriorizado) => void;
}

const CATEGORIA_CONFIG: Record<CategoriaUrgencia, {
  gradient: string;
  badge: string;
  badgeText: string;
  label: string;
  pulsar: boolean;
}> = {
  URGENTE: {
    gradient: 'from-red-50 via-orange-50 to-white border-l-red-500',
    badge: 'bg-red-100 text-red-700 ring-1 ring-red-200',
    badgeText: '🔴 Ação urgente',
    label: 'URGENTE',
    pulsar: false,
  },
  ATENCAO: {
    gradient: 'from-amber-50 via-yellow-50 to-white border-l-amber-400',
    badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    badgeText: '🟡 Atenção',
    label: 'ATENÇÃO',
    pulsar: false,
  },
  IA_ATIVA: {
    gradient: 'from-indigo-50 via-blue-50 to-white border-l-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200',
    badgeText: '🤖 IA trabalhando',
    label: 'IA ATIVA',
    pulsar: true,
  },
  SEM_ACAO: {
    gradient: 'from-slate-50 via-white to-white border-l-slate-300',
    badge: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
    badgeText: '⚪ Em espera',
    label: 'EM ESPERA',
    pulsar: false,
  },
};

const TEMP_CONFIG = {
  QUENTE: {
    icon: <Flame className="w-4 h-4 text-red-500" />,
    label: 'Quente',
    pill: 'bg-red-100 text-red-700',
  },
  MORNO: {
    icon: <Zap className="w-4 h-4 text-amber-500" />,
    label: 'Morno',
    pill: 'bg-amber-100 text-amber-700',
  },
  FRIO: {
    icon: <Snowflake className="w-4 h-4 text-blue-400" />,
    label: 'Frio',
    pill: 'bg-blue-100 text-blue-600',
  },
};

function formatarHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)}min`;
  if (horas < 24) return `${Math.round(horas)}h`;
  return `${Math.round(horas / 24)}d`;
}

function formatarDataHora(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function CardLeadPriorizado({
  lead,
  selecionado,
  onSelecionar,
  onAbrirChat,
}: CardLeadPriorizadoProps) {
  const cfg = CATEGORIA_CONFIG[lead.categoriaUrgencia];
  const temp = TEMP_CONFIG[lead.temperatura as keyof typeof TEMP_CONFIG] || TEMP_CONFIG.FRIO;

  return (
    <div
      onClick={() => onSelecionar(lead)}
      className={`
        group relative border-l-4 rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        bg-gradient-to-r ${cfg.gradient}
        ${selecionado
          ? 'shadow-lg shadow-indigo-100 ring-2 ring-indigo-400 scale-[1.01]'
          : 'shadow-sm hover:shadow-md hover:scale-[1.005] border border-slate-100'
        }
      `}
    >
      <div className="p-4">
        {/* Linha 1: Badge urgência + Tempo sem resposta */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
              {cfg.badgeText}
              {cfg.pulsar && (
                <span className="relative flex h-1.5 w-1.5 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600" />
                </span>
              )}
            </span>
          </div>

          {lead.horasSemResposta !== null && lead.horasSemResposta > 1 && (
            <div className={`
              flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full
              ${lead.horasSemResposta > 4 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}
            `}>
              <Clock className="w-3 h-3" />
              {formatarHoras(lead.horasSemResposta)} sem resp.
            </div>
          )}
        </div>

        {/* Linha 2: Nome + Temperatura */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-base truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h3>
            {lead.telefone && (
              <p className="text-xs text-slate-400 mt-0.5">{lead.telefone}</p>
            )}
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ml-3 flex-shrink-0 ${temp.pill}`}>
            {temp.icon}
            {temp.label}
          </div>
        </div>

        {/* Linha 3: Resumo IA */}
        <div className="flex items-start gap-2.5 mb-3 bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 flex-1">
            {lead.resumoIA}
          </p>
        </div>

        {/* Linha 4: Ação recomendada */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
          <p className="text-xs text-slate-600 font-medium">{lead.motivoUrgencia}</p>
        </div>

        {/* Agendamento */}
        {lead.proximaAtividade && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100 mb-3">
            <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-800 font-medium truncate flex-1">{lead.proximaAtividade.titulo}</span>
            {lead.proximaAtividade.agendadoPara && (
              <span className="text-[10px] text-amber-500 font-bold flex-shrink-0">
                {formatarDataHora(lead.proximaAtividade.agendadoPara)}
              </span>
            )}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-black/5">
          {lead.telefone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://wa.me/55${lead.telefone!.replace(/\D/g, '')}`, '_blank');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              WhatsApp
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAbrirChat(lead); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSelecionar(lead); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors ml-auto"
          >
            <Eye className="w-3.5 h-3.5" />
            Detalhes
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
