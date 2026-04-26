export function getStatusLeadUI(status: string | null | undefined): { label: string; className: string } {
  const key = String(status || '').toUpperCase();
  const mapa: Record<string, { label: string; className: string }> = {
    NOVO: { label: 'Novo', className: 'bg-indigo-100 text-indigo-700' },
    QUALIFICADO: { label: 'Qualificado', className: 'bg-indigo-100 text-indigo-700' },
    TENTATIVA_AGENDAMENTO: { label: 'Tentando Agendar', className: 'bg-amber-100 text-amber-700' },
    VISITA_AGENDADA: { label: 'Visita Agendada', className: 'bg-amber-100 text-amber-700' },
    CONTATANDO: { label: 'Contatando', className: 'bg-amber-100 text-amber-700' },
    AVALIACAO_EM_ANDAMENTO: { label: 'Avaliação', className: 'bg-violet-100 text-violet-700' },
    DOCUMENTACAO: { label: 'Documentação', className: 'bg-violet-100 text-violet-700' },
    EM_NEGOCIACAO: { label: 'Negociação', className: 'bg-violet-100 text-violet-700' },
    ONBOARDING: { label: 'Onboarding', className: 'bg-emerald-100 text-emerald-700' },
    CAPTADO: { label: 'Captado', className: 'bg-emerald-100 text-emerald-700' },
    PERDIDO: { label: 'Perdido', className: 'bg-red-100 text-red-700' },
    ARQUIVADO: { label: 'Arquivado', className: 'bg-slate-100 text-slate-600' },
  };
  return mapa[key] || { label: key || 'Sem status', className: 'bg-slate-100 text-slate-600' };
}

export function getTemperaturaLeadUI(temp: string | null | undefined): {
  label: string;
  pillClass: string;
  icon: 'quente' | 'morno' | 'frio';
} {
  const key = String(temp || '').toUpperCase();
  if (key === 'QUENTE') return { label: 'Quente', pillClass: 'bg-red-100 text-red-700', icon: 'quente' };
  if (key === 'MORNO') return { label: 'Morno', pillClass: 'bg-amber-100 text-amber-700', icon: 'morno' };
  return { label: 'Frio', pillClass: 'bg-blue-100 text-blue-600', icon: 'frio' };
}
