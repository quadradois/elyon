/**
 * Serviço de Score e Persistência de Respostas do SDR
 * 
 * Responsável por:
 * 1. Salvar respostas extraídas pelo AI Parser
 * 2. Calcular pontuação do Lead
 * 3. Atualizar campos do Lead/Contato
 */

import { prisma } from '../lib/db';

interface RespostaSalva {
    sucesso: boolean;
    scoreGanho: number;
    novoScoreTotal: number;
}

export class LeadScoreService {

    /**
     * Salva uma resposta extraída e recalcula score
     */
    async salvarResposta(
        contatoId: string,
        playbookId: string,
        itemId: string,
        resposta: string,
        respostaOriginal: string,
        scoreDoItem: number
    ): Promise<RespostaSalva> {

        // 1. Verificar se já respondeu este item (evitar pontos duplicados)
        const respostaExistente = await prisma.leadPlaybookResponse.findFirst({
            where: {
                contatoId,
                playbookId,
                playbookItemId: itemId
            }
        });

        if (respostaExistente) {
            // Atualizar resposta existente (não soma score novo, ajusta diferença se mudar)
            // Simplificação: Apenas atualiza o conteúdo, mantendo score original
            await prisma.leadPlaybookResponse.update({
                where: { id: respostaExistente.id },
                data: {
                    resposta,
                    respostaOriginal
                }
            });

            return { sucesso: true, scoreGanho: 0, novoScoreTotal: await this.getScoreTotal(contatoId) };
        }

        // 2. Criar nova resposta
        await prisma.leadPlaybookResponse.create({
            data: {
                contatoId,
                playbookId,
                playbookItemId: itemId,
                resposta,
                respostaOriginal,
                scoreGerado: scoreDoItem
            }
        });

        // 3. Atualizar Score Total do Contato
        const novoTotal = await this.recalcularScoreTotal(contatoId);

        return {
            sucesso: true,
            scoreGanho: scoreDoItem,
            novoScoreTotal: novoTotal
        };
    }

    /**
     * Recalcula o score total somando todas as respostas
     */
    private async recalcularScoreTotal(contatoId: string): Promise<number> {
        const respostas = await prisma.leadPlaybookResponse.findMany({
            where: { contatoId },
            select: { scoreGerado: true }
        });

        const total = respostas.reduce((acc: number, curr: { scoreGerado: number }) => acc + curr.scoreGerado, 0);

        // Atualizar no Contato (assumindo campo scoreQualificacao)
        await prisma.contato.update({
            where: { id: contatoId },
            data: {
                scoreQualificacao: total
            }
        });

        return total;
    }

    /**
     * Retorna score atual sem recalcular
     */
    async getScoreTotal(contatoId: string): Promise<number> {
        const contato = await prisma.contato.findUnique({
            where: { id: contatoId },
            select: { scoreQualificacao: true }
        });
        return contato?.scoreQualificacao || 0;
    }
}

export const leadScoreService = new LeadScoreService();
