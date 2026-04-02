import { prisma } from '../../lib/db';

export interface BuscarImovelInput {
    leadId: string;
}

export interface ImovelFormatado {
    endereco: string;
    edificio: string | null;
    area: string | null;
    status: string | null;
    interesse: string | null;
}

export interface BuscarImovelOutput {
    success: boolean;
    message?: string;
    totalImoveis?: number;
    imoveis?: ImovelFormatado[];
    error?: string;
}

export class BuscarImovelUseCase {
    async execute(input: BuscarImovelInput): Promise<BuscarImovelOutput> {
        try {
            console.log(`[UseCase] buscar_imovel - Lead ${input.leadId}`);

            const imoveis = await prisma.imovel.findMany({
                where: { leadId: input.leadId },
                select: {
                    id: true,
                    logradouro: true,
                    numero: true,
                    bairro: true,
                    nomeEdificio: true,
                    areaTerreno: true,
                    areaEdificada: true,
                    statusCaptacao: true,
                    interesse: true
                },
                orderBy: { criadoEm: 'desc' }
            });

            if (imoveis.length === 0) {
                return {
                    success: false,
                    message: 'Nenhum imóvel cadastrado para este lead.',
                    imoveis: []
                };
            }

            const imoveisFormatados = imoveis.map(i => ({
                endereco: `${i.logradouro}${i.numero ? `, ${i.numero}` : ''} - ${i.bairro}`,
                edificio: i.nomeEdificio,
                area: i.areaEdificada ? `${i.areaEdificada}m²` : null,
                status: i.statusCaptacao,
                interesse: i.interesse
            }));

            return {
                success: true,
                totalImoveis: imoveis.length,
                imoveis: imoveisFormatados
            };
        } catch (error: any) {
            console.error('[UseCase] buscar_imovel - Erro:', error);
            return {
                success: false,
                error: error.message || 'Erro ao buscar imóveis'
            };
        }
    }
}
