import { api } from './api';

// Usa a mesma instância axios do api.ts (baseURL: '/api')
// NÃO criar instância separada — causa CORS com VITE_API_URL


export interface EventoAgenda {
    id: string;
    title: string;
    start: string | Date;
    end: string | Date;
    allDay: boolean;
    backgroundColor?: string;
    extendedProps?: {
        tipo: 'REUNIAO' | 'VISITA' | 'AVALIACAO' | 'TAREFA' | 'BLOQUEIO';
        status: string;
        leadId: string;
        leadNome: string;
        leadTelefone: string;
        descricao?: string;
    };
}

export const agendaService = {
    listarEventos: async (start: Date, end: Date): Promise<EventoAgenda[]> => {
        const response = await api.get('/agenda', {
            params: { start: start.toISOString(), end: end.toISOString() }
        });
        return response.data.map((evt: any) => ({
            ...evt,
            start: new Date(evt.start),
            end: new Date(evt.end)
        }));
    },

    criarBloqueio: async (inicio: Date, fim: Date, motivo: string) => {
        const response = await api.post('/agenda/bloqueio', {
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            motivo
        });
        return response.data;
    },

    verificarConflitos: async (horario: Date) => {
        const response = await api.get('/agenda/conflitos', {
            params: { horario: horario.toISOString() }
        });
        return response.data;
    },

    aprovarAgendamento: async (id: string): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/aprovar`);
        return response.data;
    },

    cancelarAgendamento: async (
        id: string,
        payload: { motivo?: string; avisarCliente?: boolean } = {}
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/cancelar`, payload);
        return response.data;
    },

    reagendarAgendamento: async (
        id: string,
        payload: { novoHorario: Date; motivo?: string; avisarCliente?: boolean }
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/reagendar`, {
            ...payload,
            novoHorario: payload.novoHorario.toISOString(),
        });
        return response.data;
    },

    proporNovoHorario: async (
        id: string,
        payload: { horarioProposto: Date; mensagem?: string }
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/propor-horario`, {
            ...payload,
            horarioProposto: payload.horarioProposto.toISOString(),
        });
        return response.data;
    },

    listarBloqueios: async (): Promise<Array<{
        id: string;
        titulo: string;
        agendadoPara: string;
        duracao: number;
        descricao?: string;
    }>> => {
        const response = await api.get('/agenda/bloqueios');
        return response.data;
    },

    excluirBloqueio: async (id: string): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.delete(`/agenda/bloqueio/${id}`);
        return response.data;
    },

    obterExpediente: async (): Promise<{
        dias: Array<{ diaSemana: number; ativo: boolean; inicio: string; fim: string }>;
        almocoAtivo: boolean;
        almocoInicio: string;
        almocoFim: string;
    }> => {
        const response = await api.get('/agenda/expediente');
        return response.data;
    },

    salvarExpediente: async (expediente: {
        dias: Array<{ diaSemana: number; ativo: boolean; inicio: string; fim: string }>;
        almocoAtivo: boolean;
        almocoInicio: string;
        almocoFim: string;
    }): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.put('/agenda/expediente', expediente);
        return response.data;
    }
};
