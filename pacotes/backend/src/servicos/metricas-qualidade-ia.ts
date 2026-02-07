/**
 * MÉTRICAS DE QUALIDADE IA
 * 
 * Serviço para registrar e consultar métricas de qualidade do agente IA:
 * - Taxa de alucinações (via Output Validator)
 * - Scores de validação
 * - Detecções de bot (via Detector IA)
 * - Refinamentos do Supervisor
 * 
 * NOTA: Usa storage in-memory por ora. Para persistência, criar migration.
 * 
 * @version 1.0
 * @date 08/02/2026
 */

export interface MetricaQualidadeIA {
    tenantId: string;
    leadId?: string;
    conversaId?: string;

    // Output Validator
    scoreValidacao: number;
    alucinacaoDetectada: boolean;
    tiposAlerta: string[];

    // Detector IA
    scoreSuspeitaBot: number;
    acaoDetector: 'CONTINUAR' | 'CAPTCHA' | 'PAUSAR' | 'BLOQUEAR';

    // Supervisor
    acaoSupervisor: 'APROVAR' | 'REFINAR' | 'ESCALAR_HUMANO';
    confiancaSupervisor: number;

    // Geral
    tempoProcessamentoMs: number;
    criadoEm?: Date;
}

interface EstatisticasQualidade {
    periodo: string;
    totalMensagens: number;
    taxaAlucinacao: number;
    scoreValidacaoMedio: number;
    taxaRefinamento: number;
    taxaEscalacao: number;
    taxaDeteccaoBot: number;
    confiancaMedia: number;
    tempoMedioMs: number;
    alertasPorTipo: Record<string, number>;
}

class MetricasQualidadeIAService {
    // Storage in-memory (para produção, usar Prisma com migration)
    private metricsStorage: MetricaQualidadeIA[] = [];
    private MAX_STORAGE = 10000; // Limitar memória

    /**
     * Registra uma métrica de qualidade
     */
    async registrar(metrica: MetricaQualidadeIA): Promise<void> {
        metrica.criadoEm = new Date();
        this.metricsStorage.push(metrica);

        // Limitar tamanho do storage
        if (this.metricsStorage.length > this.MAX_STORAGE) {
            this.metricsStorage = this.metricsStorage.slice(-this.MAX_STORAGE / 2);
        }

        console.log(`[MetricasQualidadeIA] Registrada: score=${metrica.scoreValidacao}, alucinacao=${metrica.alucinacaoDetectada}`);
    }

    /**
     * Obtém estatísticas de qualidade para um tenant
     */
    async obterEstatisticas(tenantId: string, dias: number = 7): Promise<EstatisticasQualidade> {
        const dataInicial = new Date();
        dataInicial.setDate(dataInicial.getDate() - dias);

        // Filtrar métricas do tenant e período
        const metricas = this.metricsStorage.filter(m =>
            m.tenantId === tenantId &&
            m.criadoEm && m.criadoEm >= dataInicial
        );

        if (metricas.length === 0) {
            return this.estatisticasVazias(dias);
        }

        // Calcular estatísticas
        const totalMensagens = metricas.length;
        const alucinacoes = metricas.filter(m => m.alucinacaoDetectada).length;
        const refinamentos = metricas.filter(m => m.acaoSupervisor === 'REFINAR').length;
        const escalacoes = metricas.filter(m => m.acaoSupervisor === 'ESCALAR_HUMANO').length;
        const deteccoesBot = metricas.filter(m => m.acaoDetector !== 'CONTINUAR').length;

        const somaScoreValidacao = metricas.reduce((acc: number, m: MetricaQualidadeIA) => acc + m.scoreValidacao, 0);
        const somaConfianca = metricas.reduce((acc: number, m: MetricaQualidadeIA) => acc + m.confiancaSupervisor, 0);
        const somaTempo = metricas.reduce((acc: number, m: MetricaQualidadeIA) => acc + m.tempoProcessamentoMs, 0);

        // Contar alertas por tipo
        const alertasPorTipo: Record<string, number> = {};
        metricas.forEach((m: MetricaQualidadeIA) => {
            m.tiposAlerta.forEach((tipo: string) => {
                alertasPorTipo[tipo] = (alertasPorTipo[tipo] || 0) + 1;
            });
        });

        return {
            periodo: `${dias}d`,
            totalMensagens,
            taxaAlucinacao: Math.round((alucinacoes / totalMensagens) * 100),
            scoreValidacaoMedio: Math.round(somaScoreValidacao / totalMensagens),
            taxaRefinamento: Math.round((refinamentos / totalMensagens) * 100),
            taxaEscalacao: Math.round((escalacoes / totalMensagens) * 100),
            taxaDeteccaoBot: Math.round((deteccoesBot / totalMensagens) * 100),
            confiancaMedia: Math.round(somaConfianca / totalMensagens),
            tempoMedioMs: Math.round(somaTempo / totalMensagens),
            alertasPorTipo
        };
    }

    /**
     * Retorna estatísticas vazias
     */
    private estatisticasVazias(dias: number): EstatisticasQualidade {
        return {
            periodo: `${dias}d`,
            totalMensagens: 0,
            taxaAlucinacao: 0,
            scoreValidacaoMedio: 100,
            taxaRefinamento: 0,
            taxaEscalacao: 0,
            taxaDeteccaoBot: 0,
            confiancaMedia: 100,
            tempoMedioMs: 0,
            alertasPorTipo: {}
        };
    }

    /**
     * Obtém tendência de qualidade (comparação entre períodos)
     */
    async obterTendencia(tenantId: string, dias: number = 7): Promise<{
        atual: EstatisticasQualidade;
        anterior: EstatisticasQualidade;
        melhorias: Record<string, string>;
    }> {
        const atual = await this.obterEstatisticas(tenantId, dias);

        // Período anterior
        const anterior = await this.obterEstatisticasAnterior(tenantId, dias);

        // Calcular melhorias
        const melhorias: Record<string, string> = {
            alucinacao: this.formatarMelhoria(anterior.taxaAlucinacao, atual.taxaAlucinacao, true),
            validacao: this.formatarMelhoria(anterior.scoreValidacaoMedio, atual.scoreValidacaoMedio),
            confianca: this.formatarMelhoria(anterior.confiancaMedia, atual.confiancaMedia)
        };

        return { atual, anterior, melhorias };
    }

    /**
     * Obtém estatísticas do período anterior
     */
    private async obterEstatisticasAnterior(tenantId: string, dias: number): Promise<EstatisticasQualidade> {
        const dataFim = new Date();
        dataFim.setDate(dataFim.getDate() - dias);

        const dataInicio = new Date(dataFim);
        dataInicio.setDate(dataInicio.getDate() - dias);

        const metricas = this.metricsStorage.filter(m =>
            m.tenantId === tenantId &&
            m.criadoEm && m.criadoEm >= dataInicio && m.criadoEm < dataFim
        );

        if (metricas.length === 0) {
            return this.estatisticasVazias(dias);
        }

        // Mesmos cálculos do obterEstatisticas
        const totalMensagens = metricas.length;
        const alucinacoes = metricas.filter(m => m.alucinacaoDetectada).length;
        const refinamentos = metricas.filter(m => m.acaoSupervisor === 'REFINAR').length;
        const escalacoes = metricas.filter(m => m.acaoSupervisor === 'ESCALAR_HUMANO').length;
        const deteccoesBot = metricas.filter(m => m.acaoDetector !== 'CONTINUAR').length;

        const somaScoreValidacao = metricas.reduce((acc: number, m: MetricaQualidadeIA) => acc + m.scoreValidacao, 0);
        const somaConfianca = metricas.reduce((acc: number, m: MetricaQualidadeIA) => acc + m.confiancaSupervisor, 0);
        const somaTempo = metricas.reduce((acc: number, m: MetricaQualidadeIA) => acc + m.tempoProcessamentoMs, 0);

        return {
            periodo: `${dias}d anterior`,
            totalMensagens,
            taxaAlucinacao: Math.round((alucinacoes / totalMensagens) * 100),
            scoreValidacaoMedio: Math.round(somaScoreValidacao / totalMensagens),
            taxaRefinamento: Math.round((refinamentos / totalMensagens) * 100),
            taxaEscalacao: Math.round((escalacoes / totalMensagens) * 100),
            taxaDeteccaoBot: Math.round((deteccoesBot / totalMensagens) * 100),
            confiancaMedia: Math.round(somaConfianca / totalMensagens),
            tempoMedioMs: Math.round(somaTempo / totalMensagens),
            alertasPorTipo: {}
        };
    }

    /**
     * Formata melhoria como string percentual
     */
    private formatarMelhoria(anterior: number, atual: number, inverter = false): string {
        if (anterior === 0) return atual === 0 ? '0%' : '+100%';
        const diff = atual - anterior;
        const percentual = Math.round((diff / anterior) * 100);
        const sinal = (inverter ? -percentual : percentual) > 0 ? '+' : '';
        return `${sinal}${inverter ? -percentual : percentual}%`;
    }
}

export const metricasQualidadeIAService = new MetricasQualidadeIAService();
