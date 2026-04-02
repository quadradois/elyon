import { toast } from "sonner";

interface AcaoNotificacao {
  label: string;
  onClick: () => void;
}

interface OpcoesNotificacao {
  descricao?: string;
  duracao?: number;
  acoes?: AcaoNotificacao[];
}

/**
 * Hook personalizado para notificações elegantes
 * Substitui alert() e outros métodos de notificação
 */
export function useNotificacao() {
  
  const sucesso = (titulo: string, opcoes?: OpcoesNotificacao) => {
    toast.success(titulo, {
      description: opcoes?.descricao,
      duration: opcoes?.duracao || 5000,
      action: opcoes?.acoes?.[0] ? {
        label: opcoes.acoes[0].label,
        onClick: opcoes.acoes[0].onClick,
      } : undefined,
    });
  };

  const erro = (titulo: string, opcoes?: OpcoesNotificacao) => {
    toast.error(titulo, {
      description: opcoes?.descricao,
      duration: opcoes?.duracao || 8000,
      action: opcoes?.acoes?.[0] ? {
        label: opcoes.acoes[0].label,
        onClick: opcoes.acoes[0].onClick,
      } : undefined,
    });
  };

  const aviso = (titulo: string, opcoes?: OpcoesNotificacao) => {
    toast.warning(titulo, {
      description: opcoes?.descricao,
      duration: opcoes?.duracao || 6000,
      action: opcoes?.acoes?.[0] ? {
        label: opcoes.acoes[0].label,
        onClick: opcoes.acoes[0].onClick,
      } : undefined,
    });
  };

  const info = (titulo: string, opcoes?: OpcoesNotificacao) => {
    toast.info(titulo, {
      description: opcoes?.descricao,
      duration: opcoes?.duracao || 5000,
      action: opcoes?.acoes?.[0] ? {
        label: opcoes.acoes[0].label,
        onClick: opcoes.acoes[0].onClick,
      } : undefined,
    });
  };

  const carregando = (titulo: string, promise: Promise<any>, opcoes?: {
    sucesso?: string;
    erro?: string;
    descricao?: string;
  }) => {
    return toast.promise(promise, {
      loading: titulo,
      success: opcoes?.sucesso || "Concluído!",
      error: opcoes?.erro || "Ocorreu um erro",
      description: opcoes?.descricao,
    });
  };

  const mineracaoSucesso = (quantidade: number, nomeEmpreendimento?: string) => {
    toast.success(`🎉 ${quantidade} leads minerados com sucesso!`, {
      description: nomeEmpreendimento 
        ? `Empreendimento: ${nomeEmpreendimento}`
        : "Os leads foram salvos e estão disponíveis para campanhas.",
      duration: 8000,
      action: {
        label: "Ver Leads",
        onClick: () => window.location.href = "/dashboard/leads",
      },
    });
  };

  const campanhaCreiada = (nomeCampanha: string, idCampanha: string) => {
    toast.success(`📢 Campanha "${nomeCampanha}" criada!`, {
      description: "Briefing gerado automaticamente com IA.",
      duration: 8000,
      action: {
        label: "Ver Campanha",
        onClick: () => window.location.href = `/dashboard/campanhas/${idCampanha}`,
      },
    });
  };

  const economiaCache = (valor: number, consultas: number) => {
    toast.info(`💰 Economia: R$ ${valor.toFixed(2)}`, {
      description: `${consultas} consultas evitadas (dados já conhecidos)`,
      duration: 6000,
    });
  };

  return {
    sucesso,
    erro,
    aviso,
    info,
    carregando,
    // Notificações específicas do domínio
    mineracaoSucesso,
    campanhaCreiada,
    economiaCache,
  };
}

// Exportar função direta para uso fora de componentes
export const notificar = {
  sucesso: (titulo: string, descricao?: string) => toast.success(titulo, { description: descricao }),
  erro: (titulo: string, descricao?: string) => toast.error(titulo, { description: descricao }),
  aviso: (titulo: string, descricao?: string) => toast.warning(titulo, { description: descricao }),
  info: (titulo: string, descricao?: string) => toast.info(titulo, { description: descricao }),
};
