import { conhecimentoCuradoService } from '../../servicos/conhecimento-curado';

export class BuscarEstrategiaCaptacaoUseCase {
    private conhecimentoService: typeof conhecimentoCuradoService;

    constructor() {
        this.conhecimentoService = conhecimentoCuradoService;
    }

    async execute(params: {
        objecaoOuTopico: string;
    }): Promise<any> {
        try {
            const estrategias = await this.conhecimentoService.buscar({
                query: params.objecaoOuTopico,
                categoria: 'Captacao_Outbound',
                limite: 3
            });

            if (!estrategias || estrategias.length === 0) {
                return {
                    sucesso: true,
                    estrategias: [],
                    mensagem: "Nenhum script exato encontrado na base de conhecimento curado. Use sua inteligência comercial avançada baseada nos guardrails padrão."
                };
            }

            return {
                sucesso: true,
                estrategias: estrategias.map((e: any) => ({
                    titulo: e.titulo,
                    argumento_captacao: e.texto,
                    contexto_ideal: e.contextoUso,
                    exemplo_pratico: e.exemplo,
                    efetividade: e.scoreEficacia
                }))
            };
        } catch (error: any) {
            console.error('[BuscarEstrategiaCaptacaoUseCase] Erro:', error);
            return { sucesso: false, erro: error.message };
        }
    }
}
