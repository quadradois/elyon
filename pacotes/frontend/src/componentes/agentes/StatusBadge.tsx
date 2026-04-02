import { cn } from '../../lib/utils';
import { StatusAgente } from './wizard/types';

interface StatusBadgeProps {
  status: StatusAgente;
  tamanho?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CONFIG_STATUS = {
  RASCUNHO: {
    label: 'Rascunho',
    emoji: '📝',
    cor: 'bg-slate-100 text-slate-700 border-slate-200',
    descricao: 'Configuração em andamento'
  },
  ATIVO: {
    label: 'Ativo',
    emoji: '✅',
    cor: 'bg-green-100 text-green-700 border-green-200',
    descricao: 'Atendendo automaticamente'
  },
  PAUSADO: {
    label: 'Pausado',
    emoji: '⏸️',
    cor: 'bg-amber-100 text-amber-700 border-amber-200',
    descricao: 'Conversas vão para humanos'
  }
} as const;

export function StatusBadge({ status, tamanho = 'md', className }: StatusBadgeProps) {
  const config = CONFIG_STATUS[status] || CONFIG_STATUS.RASCUNHO;
  
  const tamanhoClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        config.cor,
        tamanhoClasses[tamanho],
        className
      )}
      title={config.descricao}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}

// Componente de descrição de status para uso em cards
export function StatusDescricao({ status }: { status: StatusAgente }) {
  const config = CONFIG_STATUS[status] || CONFIG_STATUS.RASCUNHO;
  return (
    <p className="text-xs text-slate-500">{config.descricao}</p>
  );
}

// Hook para cores do status (para uso em outros componentes)
export function useStatusConfig(status: StatusAgente) {
  return CONFIG_STATUS[status] || CONFIG_STATUS.RASCUNHO;
}
