/**
 * Constantes e configurações para a página de Detalhes do Lead
 */

import React from 'react';
import {
    Phone,
    MessageSquare,
    Home,
    RefreshCw,
    Calendar,
    CheckCircle2,
    Edit,
    Target,
    Flame,
    Sun,
    Snowflake,
} from "lucide-react";

// ============================================
// CONFIGURAÇÃO DE STATUS
// ============================================

export const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    // Funil de Captação (Playbook)
    NOVO: { label: 'Interesse Confirmado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    TENTATIVA_AGENDAMENTO: { label: 'Alinhamento', color: 'text-violet-700', bgColor: 'bg-violet-100' },
    VISITA_AGENDADA: { label: 'Visita Agendada', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    AVALIACAO_EM_ANDAMENTO: { label: 'Avaliação', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    DOCUMENTACAO: { label: 'Documentação', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    CAPTADO: { label: 'Captado', color: 'text-green-700', bgColor: 'bg-green-100' },
    PERDIDO: { label: 'Perdido', color: 'text-red-700', bgColor: 'bg-red-100' },
    ARQUIVADO: { label: 'Arquivado', color: 'text-gray-500', bgColor: 'bg-gray-50' },
    // Legado (compatibilidade)
    QUALIFICANDO: { label: 'Qualificando', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    QUALIFICADO: { label: 'Qualificado', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
    NAO_QUALIFICADO: { label: 'Não Qualificado', color: 'text-red-700', bgColor: 'bg-red-100' },
    AGENDADO: { label: 'Agendado', color: 'text-violet-700', bgColor: 'bg-violet-100' },
    CONVERTIDO: { label: 'Captado', color: 'text-green-700', bgColor: 'bg-green-100' },
};

// ============================================
// CONFIGURAÇÃO DE TEMPERATURA
// ============================================

export const temperaturaConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    QUENTE: { label: 'Quente', icon: <Flame className="w-4 h-4" />, color: 'text-orange-500' },
    MORNO: { label: 'Morno', icon: <Sun className="w-4 h-4" />, color: 'text-yellow-500' },
    FRIO: { label: 'Frio', icon: <Snowflake className="w-4 h-4" />, color: 'text-blue-500' },
};

// ============================================
// CONFIGURAÇÃO DE TIPOS DE ATIVIDADE
// ============================================

export const tipoAtividadeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    LIGACAO: { label: 'Ligação', icon: <Phone className="w-4 h-4" />, color: 'text-blue-500' },
    MENSAGEM: { label: 'Mensagem', icon: <MessageSquare className="w-4 h-4" />, color: 'text-green-500' },
    AVALIACAO: { label: 'Avaliação', icon: <Home className="w-4 h-4" />, color: 'text-violet-500' },
    FOLLOW_UP: { label: 'Follow-up', icon: <RefreshCw className="w-4 h-4" />, color: 'text-orange-500' },
    REUNIAO: { label: 'Reunião', icon: <Calendar className="w-4 h-4" />, color: 'text-indigo-500' },
    TAREFA: { label: 'Tarefa', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-slate-500' },
    NOTA: { label: 'Nota', icon: <Edit className="w-4 h-4" />, color: 'text-slate-400' },
    OUTRO: { label: 'Outro', icon: <Target className="w-4 h-4" />, color: 'text-gray-500' },
};

// ============================================
// CONFIGURAÇÃO DE STATUS DE AGENDAMENTO
// ============================================

export const statusAgendamentoConfig: Record<string, { label: string; color: string }> = {
    PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
    CONFIRMADO: { label: 'Confirmado', color: 'bg-green-100 text-green-700' },
    CANCELADO: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    REALIZADO: { label: 'Realizado', color: 'bg-blue-100 text-blue-700' },
    NAO_COMPARECEU: { label: 'Não Compareceu', color: 'bg-gray-100 text-gray-700' },
};

// ============================================
// OPÇÕES DE FORMULÁRIO
// ============================================

export const motivosPerdaOptions = [
    'Expectativa Irreal de Preço',
    'Fechou com Concorrente',
    'Não quer vender agora',
    'Desistiu de vender',
    'Não conseguimos contato',
    'Imóvel já vendido',
    'Condições Comerciais',
    'Futuro/Nutrição',
    'Outro'
];

export const tipoAutorizacaoOptions = [
    { value: 'exclusiva', label: 'Exclusiva' },
    { value: 'simples', label: 'Simples (Sem exclusividade)' },
];

export const situacaoFinanceiraOptions = [
    { value: 'quitado', label: 'Quitado' },
    { value: 'financiado', label: 'Financiado' },
];

export const estadoConservacaoOptions = [
    { value: 'excelente', label: 'Excelente' },
    { value: 'bom', label: 'Bom' },
    { value: 'reforma', label: 'Precisa de reforma' },
];

export const prazoTrabalhoOptions = [
    { value: 30, label: '30 dias' },
    { value: 60, label: '60 dias' },
    { value: 90, label: '90 dias' },
    { value: 120, label: '120 dias' },
    { value: 180, label: '180 dias' },
];

// ============================================
// FASES DO PLAYBOOK
// ============================================

export const fasesPlaybook = [
    {
        status: 'NOVO',
        fase: 1,
        nome: 'Prospectar',
        descricao: 'Interesse Confirmado',
        corBorda: 'border-l-blue-500',
        corFundo: 'bg-blue-50'
    },
    {
        status: 'TENTATIVA_AGENDAMENTO',
        fase: 2,
        nome: 'Qualificar',
        descricao: 'Alinhamento de Captação',
        corBorda: 'border-l-violet-500',
        corFundo: 'bg-violet-50'
    },
    {
        status: 'DOCUMENTACAO',
        fase: 3,
        nome: 'Converter',
        descricao: 'Validação do Imóvel',
        corBorda: 'border-l-amber-500',
        corFundo: 'bg-amber-50'
    },
    {
        status: 'CAPTADO',
        fase: 4,
        nome: 'Finalizar',
        descricao: 'Captado (Ativo)',
        corBorda: 'border-l-green-500',
        corFundo: 'bg-green-50'
    },
];
