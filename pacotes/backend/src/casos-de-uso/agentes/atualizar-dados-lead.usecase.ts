import { prisma } from '../../lib/db';

export interface AtualizarDadosLeadInput {
    leadId: string;
    cpf?: string | null;
    email?: string | null;
    endereco?: string | null;
    nome?: string | null;
}

export interface AtualizarDadosLeadOutput {
    success: boolean;
    mensagem?: string;
    error?: string;
}

export class AtualizarDadosLeadUseCase {
    async execute(input: AtualizarDadosLeadInput): Promise<AtualizarDadosLeadOutput> {
        try {
            console.log(`[UseCase] atualizar_dados_lead - Lead ${input.leadId}`);

            const data: any = {};
            if (input.cpf) data.cpf = input.cpf.replace(/\D/g, '');
            if (input.email) data.email = input.email;
            if (input.endereco) data.enderecoPrincipal = input.endereco;
            if (input.nome) data.nome = input.nome;

            if (Object.keys(data).length === 0) {
                return { success: false, error: 'Nenhum dado fornecido para atualização' };
            }

            data.ultimaInteracao = new Date();

            await prisma.lead.update({
                where: { id: input.leadId },
                data
            });

            return {
                success: true,
                mensagem: "Dados atualizados com sucesso"
            };
        } catch (error: any) {
            console.error('[UseCase] Erro ao atualizar lead:', error);
            return { success: false, error: 'Erro ao atualizar dados' };
        }
    }
}
