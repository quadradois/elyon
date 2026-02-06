
import { api } from '../servicos/api';

export interface ConfiguracaoAgente {
    id: string;
    tenantId: string;
    nome: string;
    avatar?: string;
    genero?: string;
    personalidade: {
        tom: 'formal' | 'amigavel' | 'entusiasta';
        usarEmojis: boolean;
        nivelFormalidade?: number;
        usarGirias?: boolean;
    };
    expertise: {
        bairros: string[];
        tiposImovel: string[];
        faixaPreco?: { min: number; max: number };
    };
    scripts: {
        saudacao: string;
        despedida: string;
    };
    regrasNegocio: {
        horaEscalacao?: string;
        corretorResponsavel?: string;
    };
    estaAtivo: boolean;
    perfilImobiliaria?: any;
}

class AgenteService {
    /**
     * Busca a configuração do agente do tenant atual
     */
    async obterAgente(): Promise<ConfiguracaoAgente | null> {
        try {
            const response = await api.get('/agentes');
            return response.data.agente;
        } catch (error) {
            console.error('Erro ao buscar agente:', error);
            return null;
        }
    }

    /**
     * Cria ou atualiza a configuração do agente
     */
    async salvarAgente(dados: Partial<ConfiguracaoAgente>): Promise<ConfiguracaoAgente> {
        const response = await api.post('/agentes', dados);
        return response.data.agente;
    }

    /**
     * Reseta/Remove a configuração (opcional)
     */
    async removerAgente(): Promise<void> {
        await api.delete('/agentes');
    }
}

export const agenteService = new AgenteService();
