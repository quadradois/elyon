import { prisma } from '../../lib/db';

export interface SalvarDadosImovelInput {
    leadId: string;
    tipo?: string | null;
    quartos?: number | null;
    suites?: number | null;
    banheiros?: number | null;
    vagas?: number | null;
    areaUtil?: number | null;
    areaTotal?: number | null;
    andar?: number | null;
    valorVenda?: number | null;
    valorLocacao?: number | null;
    valorCondominio?: number | null;
    valorIPTU?: number | null;
    caracteristicas?: string[] | null;
    descricao?: string | null;
    fotos?: string[] | null;
}

export interface SalvarDadosImovelOutput {
    success: boolean;
    camposSalvos?: string[];
    message?: string;
    error?: string;
}

export class SalvarDadosImovelUseCase {
    async execute(input: SalvarDadosImovelInput): Promise<SalvarDadosImovelOutput> {
        try {
            console.log(`[UseCase] salvar_dados_imovel - Lead ${input.leadId}`);

            const updateData: any = {};

            if (input.tipo) updateData.tipoImovel = input.tipo;
            if (input.quartos != null) updateData.quartosImovel = input.quartos;
            if (input.suites != null) updateData.imovelSuites = input.suites;
            if (input.banheiros != null) updateData.imovelBanheiros = input.banheiros;
            if (input.vagas != null) updateData.vagasImovel = input.vagas;
            if (input.areaUtil != null) updateData.imovelAreaTotal = input.areaUtil;
            if (input.areaTotal != null) updateData.imovelAreaTotal = input.areaTotal;
            if (input.andar != null) updateData.imovelAndar = input.andar;
            if (input.valorVenda != null) updateData.valorPretendido = `R$ ${input.valorVenda.toLocaleString('pt-BR')}`;
            if (input.valorLocacao != null) updateData.imovelValorLocacao = input.valorLocacao;
            if (input.valorCondominio != null) updateData.imovelValorCondominio = input.valorCondominio;
            if (input.valorIPTU != null) updateData.imovelValorIPTU = input.valorIPTU;
            if (input.caracteristicas) updateData.imovelCaracteristicas = input.caracteristicas;
            if (input.descricao) updateData.imovelDescricao = input.descricao;
            if (input.fotos) updateData.imovelFotos = input.fotos;

            updateData.dadosImovelColetadosEm = new Date();
            updateData.ultimaInteracao = new Date();

            if (Object.keys(updateData).length <= 2) {
                return {
                    success: false,
                    error: 'Nenhum dado do imóvel fornecido'
                };
            }

            await prisma.lead.update({
                where: { id: input.leadId },
                data: updateData
            });

            const camposSalvos = Object.keys(updateData).filter(k => !['dadosImovelColetadosEm', 'ultimaInteracao'].includes(k));
            console.log(`[UseCase] salvar_dados_imovel - Campos salvos: ${camposSalvos.join(', ')}`);

            return {
                success: true,
                camposSalvos,
                message: `✓ Dados salvos: ${camposSalvos.length} campos`
            };

        } catch (error: any) {
            console.error('[UseCase] salvar_dados_imovel - Erro:', error);
            return {
                success: false,
                error: error.message || 'Erro ao salvar dados do imóvel'
            };
        }
    }
}
