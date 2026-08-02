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
        especialistaId?: string | null;
        especialistaNome?: string | null;
        statusConfirmacaoCorretor?: string | null;
        versao: number;
        faseTemporal?: 'FUTURO' | 'INICIADO' | 'ENCERRADO' | null;
        allowedActions?: Array<'CANCELAR' | 'REAGENDAR' | 'REALIZAR' | 'NAO_COMPARECEU' | 'CORRIGIR'>;
        policyReasonCode?: string;
        lifecyclePolicyEnabled?: boolean;
        lifecycleCommandsEnabled?: boolean;
    };
}

export type AgendaCommandName = 'SOLICITAR' | 'PROPOR' | 'RECUSAR' | 'CONFIRMAR_ATRIBUICAO' | 'CANCELAR'
    | 'REAGENDAR' | 'REALIZAR' | 'NAO_COMPARECEU' | 'CORRIGIR';

export async function executarComandoAgenda(
    id: string,
    payload: {
        command: AgendaCommandName;
        expectedVersion: number;
        reasonCode: string;
        channel?: 'WHATSAPP' | 'PAINEL' | 'LINK_PUBLICO' | 'JOB' | 'INTEGRACAO';
        scheduledFor?: Date;
        responsibleId?: string;
        justification?: string;
        correctedStatus?: 'REALIZADO' | 'NAO_COMPARECEU' | 'CANCELADO';
        leadManifestation?: 'HORARIO_ESCOLHIDO' | 'HORARIO_ACEITO';
    },
    idempotencyKey = crypto.randomUUID(),
) {
    const response = await api.post(`/agenda/${id}/commands`, {
        ...payload,
        channel: payload.channel || 'PAINEL',
        scheduledFor: payload.scheduledFor?.toISOString(),
    }, { headers: { 'Idempotency-Key': idempotencyKey } });
    return response.data;
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

    listarPendenciasVencidas: async (): Promise<Array<{
        id: string; leadNome: string; scheduledFor: string; status: string; version: number;
        temporalPhase: 'INICIADO' | 'ENCERRADO'; allowedActions: string[];
        pendingAgeMinutes: number; responsibleId?: string | null; operationalReason: string;
    }>> => {
        const response = await api.get('/agenda/pendencias/vencidas');
        return response.data;
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
        payload: { motivo?: string; avisarCliente?: boolean; requestId: string; expectedVersion: number }
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/cancelar`, payload, {
            headers: { 'Idempotency-Key': payload.requestId },
        });
        return response.data;
    },

    reagendarAgendamento: async (
        id: string,
        payload: { novoHorario: Date; motivo?: string; avisarCliente?: boolean; requestId: string; expectedVersion: number }
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/reagendar`, {
            ...payload,
            novoHorario: payload.novoHorario.toISOString(),
        }, { headers: { 'Idempotency-Key': payload.requestId } });
        return response.data;
    },

    proporNovoHorario: async (
        id: string,
        payload: { horarioProposto: Date; mensagem?: string; expectedVersion?: number }
    ): Promise<{ sucesso: boolean; mensagem: string }> => {
        const response = await api.post(`/agenda/${id}/propor-horario`, {
            horarioProposto: payload.horarioProposto.toISOString(),
            mensagem: payload.mensagem,
            expectedVersion: payload.expectedVersion,
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
