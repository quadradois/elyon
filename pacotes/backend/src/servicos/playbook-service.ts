/**
 * PLAYBOOK SERVICE
 * 
 * Serviço para carregar e injetar playbooks dinamicamente no agente.
 * Permite que o SDR siga scripts estruturados durante a conversa.
 * 
 * @version 1.0
 * @date 07/02/2026
 */

import { prisma } from '../lib/db';

export interface PlaybookContexto {
    etapaAtual: string;
    itensColetados: string[];
    objecoesEncontradas: string[];
    proximasPerguntas: string[];
    promptInjection: string;
}

export interface PlaybookStage {
    id: string;
    nome: string;
    descricao: string | null;
    icone: string | null;
    ordem: number;
    itens: PlaybookItem[];
    objecoes: PlaybookObjection[];
}

export interface PlaybookItem {
    pergunta: string;
    tipoDado: string;
    obrigatorio: boolean;
    aiPreencherAuto: boolean;
    ordem: number;
}

export interface PlaybookObjection {
    gatilho: string;
    resposta: string;
    ordem: number;
}

class PlaybookService {
    private cache = new Map<string, { playbook: any; expiresAt: number }>();
    private CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    /**
     * Busca o playbook ativo para um tenant e tipo específico
     */
    async buscarPlaybookAtivo(tenantId: string, tipo: 'CAPTACAO' | 'VENDA' | 'LOCACAO' | 'GERAL' = 'CAPTACAO'): Promise<any | null> {
        const cacheKey = `${tenantId}:${tipo}`;
        const cached = this.cache.get(cacheKey);

        if (cached && cached.expiresAt > Date.now()) {
            return cached.playbook;
        }

        const playbook = await prisma.playbook.findFirst({
            where: {
                tenantId,
                tipo: tipo as any,
                estaAtivo: true
            },
            include: {
                etapas: {
                    orderBy: { ordem: 'asc' },
                    include: {
                        itens: {
                            orderBy: { ordem: 'asc' }
                        },
                        objecoes: true
                    }
                }
            }
        });

        if (playbook) {
            this.cache.set(cacheKey, {
                playbook,
                expiresAt: Date.now() + this.CACHE_TTL
            });
        }

        return playbook;
    }

    /**
     * Gera o contexto do playbook para injetar no prompt do agente
     */
    async gerarContextoParaAgente(
        tenantId: string,
        tipo: 'CAPTACAO' | 'VENDA' | 'LOCACAO' | 'GERAL' = 'CAPTACAO',
        dadosColetados: Record<string, any> = {}
    ): Promise<PlaybookContexto | null> {
        const playbook = await this.buscarPlaybookAtivo(tenantId, tipo);

        if (!playbook || !playbook.etapas?.length) {
            return null;
        }

        // Determinar etapa atual baseado nos dados já coletados
        let etapaAtualIndex = 0;
        const itensColetados: string[] = [];

        for (let i = 0; i < playbook.etapas.length; i++) {
            const etapa = playbook.etapas[i];
            const itensObrigatorios = etapa.itens.filter((item: any) => item.obrigatorio);
            const todosColetados = itensObrigatorios.every((item: any) =>
                dadosColetados[this.normalizarChave(item.pergunta)]
            );

            if (todosColetados) {
                etapaAtualIndex = i + 1;
                itensObrigatorios.forEach((item: any) => itensColetados.push(item.pergunta));
            }
        }

        // Pegar etapa atual ou última se passou de todas
        const etapaAtual = playbook.etapas[Math.min(etapaAtualIndex, playbook.etapas.length - 1)];

        // Gerar próximas perguntas (itens não coletados da etapa atual)
        const proximasPerguntas = etapaAtual.itens
            .filter((item: any) => !dadosColetados[this.normalizarChave(item.pergunta)])
            .map((item: any) => item.pergunta);

        // Gerar prompt injection com estrutura do playbook
        const promptInjection = this.gerarPromptInjection(playbook, etapaAtual, proximasPerguntas);

        return {
            etapaAtual: etapaAtual.nome,
            itensColetados,
            objecoesEncontradas: [],
            proximasPerguntas,
            promptInjection
        };
    }

    /**
     * Detecta se uma mensagem contém uma objeção conhecida e retorna a resposta
     */
    async detectarObjecao(
        tenantId: string,
        mensagem: string,
        tipo: 'CAPTACAO' | 'VENDA' | 'LOCACAO' | 'GERAL' = 'CAPTACAO'
    ): Promise<{ detectada: boolean; resposta?: string; gatilho?: string }> {
        const playbook = await this.buscarPlaybookAtivo(tenantId, tipo);

        if (!playbook) {
            return { detectada: false };
        }

        const mensagemLower = mensagem.toLowerCase();

        for (const etapa of playbook.etapas) {
            for (const objecao of etapa.objecoes) {
                // Verifica se o gatilho está na mensagem
                const gatilhoLower = objecao.gatilho.toLowerCase();
                const palavrasGatilho = gatilhoLower.split(/\s+/);

                // Match se 70%+ das palavras do gatilho estão na mensagem
                const matches = palavrasGatilho.filter((p: string) =>
                    p.length > 3 && mensagemLower.includes(p)
                );

                if (matches.length >= palavrasGatilho.length * 0.7) {
                    return {
                        detectada: true,
                        resposta: objecao.resposta,
                        gatilho: objecao.gatilho
                    };
                }
            }
        }

        return { detectada: false };
    }

    /**
     * Gera o prompt para injetar no system prompt do agente
     */
    private gerarPromptInjection(playbook: any, etapaAtual: any, proximasPerguntas: string[]): string {
        let prompt = `\n\n# 📋 PLAYBOOK: ${playbook.nome}\n`;
        prompt += `Você está na etapa: **${etapaAtual.nome}**\n`;

        if (etapaAtual.descricao) {
            prompt += `*${etapaAtual.descricao}*\n`;
        }

        if (proximasPerguntas.length > 0) {
            prompt += `\n## Informações a Coletar (em ordem de prioridade):\n`;
            proximasPerguntas.forEach((p, i) => {
                prompt += `${i + 1}. ${p}\n`;
            });
            prompt += `\n⚠️ Colete UMA informação por vez de forma natural na conversa.\n`;
        }

        if (etapaAtual.objecoes?.length > 0) {
            prompt += `\n## Objeções Comuns e Respostas:\n`;
            etapaAtual.objecoes.slice(0, 3).forEach((obj: any) => {
                prompt += `- Se disser "${obj.gatilho}": ${obj.resposta}\n`;
            });
        }

        return prompt;
    }

    /**
     * Normaliza uma string para usar como chave
     */
    private normalizarChave(texto: string): string {
        return texto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .substring(0, 50);
    }

    /**
     * Limpa o cache
     */
    limparCache(): void {
        this.cache.clear();
    }
}

export const playbookService = new PlaybookService();
