/**
 * Card de lead priorizado — Design Premium v2.0
 * Visual rico, hierarquia clara, ações evidentes.
 */

import {
  Clock,
  Calendar,
  Flame,
  Zap,
  Snowflake,
  Bot,
  Megaphone,
} from 'lucide-react';
import type { LeadPriorizado, CategoriaUrgencia } from '../../ganchos/useLeadsPriorizados';
import { getStatusLeadUI, getTemperaturaLeadUI } from './lead-ui';

interface CardLeadPriorizadoProps {
  lead: LeadPriorizado;
  selecionado: boolean;
  onSelecionar: (lead: LeadPriorizado) => void;
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
}: CardLeadPriorizadoProps) {
  const cfg = CATEGORIA_CONFIG[lead.categoriaUrgencia];
  const temp = getTemperaturaLeadUI(lead.temperatura);
  const status = getStatusLeadUI(lead.status);
  const tempIcon =
    temp.icon === 'quente'
      ? <Flame className="w-4 h-4 text-red-500" />
      : temp.icon === 'morno'
      ? <Zap className="w-4 h-4 text-amber-500" />
      : <Snowflake className="w-4 h-4 text-blue-400" />;

  return (
    <div
      onClick={() => onSelecionar(lead)}
      className={`
        group relative border-l-4 rounded-xl overflow-hidden cursor-pointer
        transition-all duration-200 ease-out
        bg-gradient-to-r ${cfg.gradient}
        ${selecionado
          ? 'shadow-md shadow-indigo-100 ring-2 ring-indigo-400'
          : 'shadow-sm hover:shadow-md hover:scale-[1.005] border border-slate-100'
        }
      `}
    >
      <div className="p-3">
        {/* Linha 1: Badge urgência + Tempo sem resposta */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
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
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-[15px] truncate leading-tight">
              {lead.nome || 'Sem nome'}
            </h3>
            {lead.telefone && (
              <p className="text-xs text-slate-400 mt-0.5">{lead.telefone}</p>
            )}
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ml-3 flex-shrink-0 ${temp.pillClass}`}>
            {tempIcon}
            {temp.label}
          </div>
        </div>

        {/* Status padronizado */}
        <div className="mb-2">
          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
            {status.label}
          </span>
        </div>

        {/* Linha 3: Campanha + Score Composto */}
        {(lead.campanhaOrigem || lead.scoreComposto != null) && (
          <div className="flex items-center justify-between mb-2">
            {lead.campanhaOrigem ? (
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                <Megaphone className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[160px]">{lead.campanhaOrigem.nome}</span>
              </div>
            ) : <div />}
            {lead.scoreComposto != null && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                lead.scoreComposto >= 60 ? 'bg-emerald-100 text-emerald-700' :
                lead.scoreComposto >= 35 ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                Score {lead.scoreComposto}
              </span>
            )}
          </div>
        )}

        {/* Linha 4: Resumo IA */}
        <div className="flex items-start gap-2 mb-2 bg-white rounded-lg p-2 border border-slate-100 shadow-sm">
          <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed line-clamp-2 flex-1">
            {lead.resumoIA}
          </p>
        </div>

        {/* Agendamento */}
        {lead.proximaAtividade && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 rounded-lg border border-amber-100 mb-2">
            <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-[11px] text-amber-800 font-medium truncate flex-1">{lead.proximaAtividade.titulo}</span>
            {lead.proximaAtividade.agendadoPara && (
              <span className="text-[10px] text-amber-500 font-bold flex-shrink-0">
                {formatarDataHora(lead.proximaAtividade.agendadoPara)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
