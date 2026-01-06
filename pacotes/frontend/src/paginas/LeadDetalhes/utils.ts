/**
 * Funções utilitárias para formatação de dados
 */

export const formatarTelefone = (numero: string): string => {
    const limpo = numero.replace(/\D/g, '');
    if (limpo.length === 13) { // Com código do país
        return `+${limpo.slice(0, 2)} (${limpo.slice(2, 4)}) ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
    }
    if (limpo.length === 11) {
        return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    }
    if (limpo.length === 10) {
        return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    }
    return numero;
};

export const formatarMoeda = (valor: number): string => {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
};

export const formatarData = (data: string): string => {
    return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

export const formatarDataHora = (data: string): string => {
    return new Date(data).toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const formatarDataCompacta = (data: string): string => {
    return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
    });
};

export const tempoRelativo = (data: string): string => {
    const agora = new Date();
    const dataEvento = new Date(data);
    const diffMs = agora.getTime() - dataEvento.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHora = Math.floor(diffMs / 3600000);
    const diffDia = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHora < 24) return `${diffHora}h atrás`;
    if (diffDia < 7) return `${diffDia}d atrás`;
    return formatarData(data);
};

export const formatarCPF = (cpf: string): string => {
    const limpo = cpf.replace(/\D/g, '');
    return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

export const formatarCNPJ = (cnpj: string): string => {
    const limpo = cnpj.replace(/\D/g, '');
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};
