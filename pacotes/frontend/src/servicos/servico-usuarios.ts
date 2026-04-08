import { api } from './api';

export interface Usuario {
    id: string;
    nome: string;
    email: string;
    papel: 'SUPER_ADMIN' | 'ADMIN' | 'CORRETOR' | 'VISUALIZADOR';
    telefone?: string;
    avatar?: string;
    estaAtivo: boolean;
    criadoEm: string;
    ultimoLoginEm?: string;
}

export interface CriarUsuarioPayload {
    nome: string;
    email: string;
    papel: 'ADMIN' | 'CORRETOR' | 'VISUALIZADOR';
    telefone?: string;
}

export interface AtualizarUsuarioPayload {
    nome?: string;
    papel?: 'ADMIN' | 'CORRETOR' | 'VISUALIZADOR';
    telefone?: string;
    avatar?: string;
    estaAtivo?: boolean;
}

export interface ListaUsuariosResponse {
    dados: Usuario[];
    paginacao: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

export const servicoUsuarios = {
    listar: async (params?: { pagina?: number; busca?: string }): Promise<ListaUsuariosResponse> => {
        const query = new URLSearchParams();
        if (params?.pagina) query.set('pagina', String(params.pagina));
        if (params?.busca) query.set('busca', params.busca);
        const { data } = await api.get(`/usuarios?${query.toString()}`);
        return data;
    },

    buscar: async (id: string): Promise<Usuario> => {
        const { data } = await api.get(`/usuarios/${id}`);
        return data;
    },

    criar: async (payload: CriarUsuarioPayload): Promise<Usuario & { senhaTemporaria: string }> => {
        const { data } = await api.post('/usuarios', payload);
        return data;
    },

    atualizar: async (id: string, payload: AtualizarUsuarioPayload): Promise<Usuario> => {
        const { data } = await api.put(`/usuarios/${id}`, payload);
        return data;
    },

    desativar: async (id: string): Promise<void> => {
        await api.delete(`/usuarios/${id}`);
    },

    resetarSenha: async (id: string): Promise<{ senhaTemporaria: string }> => {
        const { data } = await api.post(`/usuarios/${id}/resetar-senha`);
        return data;
    },

    atualizarPerfil: async (payload: AtualizarUsuarioPayload): Promise<Usuario> => {
        const { data } = await api.put('/usuarios/me', payload);
        return data;
    },

    uploadAvatar: async (id: string | 'me', arquivo: File): Promise<{ avatarUrl: string }> => {
        const formData = new FormData();
        formData.append('arquivo', arquivo);
        const { data } = await api.post(`/usuarios/${id}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },
};
