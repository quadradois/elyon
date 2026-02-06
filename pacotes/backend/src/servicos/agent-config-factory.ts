import { AgenteConfiguracao } from '../agentes/types';
import { ConfiguracaoOrquestrador, ContextoConversa } from '../agentes/orchestrator';

export class AgentConfigFactory {

    /**
     * Converte a configuração legada (ConfiguracaoOrquestrador) para a nova (AgenteConfiguracao)
     * permitindo o uso do Builder com dados antigos.
     */
    static createFromLegacy(
        legacyConfig: ConfiguracaoOrquestrador,
        contexto: ContextoConversa
    ): AgenteConfiguracao {

        // 0. CHECK FOR BUILDER CONFIG (Advanced Mode)
        // Se o frontend enviou uma configuração explícita do Builder via regrasNegocio
        if (legacyConfig.regrasNegocio?.builderConfig) {
            const builderConfig = legacyConfig.regrasNegocio.builderConfig;
            return {
                id: `builder-${legacyConfig.tenantId}-${builderConfig.especialista.id}`,
                tenantId: legacyConfig.tenantId,
                especialista: builderConfig.especialista.id,
                subtipo: builderConfig.especialista.subtipo,
                skills: builderConfig.skills || [],
                parametrosGlobais: {
                    nomeAgente: legacyConfig.nomeAgente,
                    nomeEmpresa: legacyConfig.nomeImobiliaria,
                    cidade: legacyConfig.cidade,
                    comissao: legacyConfig.comissaoPadrao,
                    empreendimento: contexto.empreendimento,
                    leadNome: builderConfig.especialista.id === 'SALES' ? 'Cliente' : 'Proprietário'
                },
                versaoConfig: 2
            };
        }

        // ===============================================
        // FALLBACK: LÓGICA LEGADA DE DEDUÇÃO
        // ===============================================

        // 1. Determinar Especialista e Subtipo baseados no status/contexto

        // 1. Determinar Especialista e Subtipo baseados no status/contexto

        // Detectar tipo de fluxo baseado na campanha ou contexto
        // MVP: Se o nome do empreendimento estiver presente E não for uma campanha de captação explícita -> VENDA
        // Em produção, isso viria de `contexto.campanha.tipo` ('LEAD_LANCAMENTO', 'LEAD_PRONTO', 'CAPTACAO')

        let especialista: 'SALES' | 'CAPTURE' = 'CAPTURE';
        let subtipo = 'VENDA'; // Default para Capture (Captação para Venda)

        const tipoCampanha = contexto.campanha?.tipo || '';

        if (tipoCampanha.includes('VENDA') || (contexto.empreendimento && !tipoCampanha.includes('CAPTACAO'))) {
            especialista = 'SALES';
            subtipo = tipoCampanha.includes('LANCAMENTO') ? 'LANCAMENTO' : 'PRONTO';
        }

        // 2. Mapear Skills baseadas no Especialista
        const skills: AgenteConfiguracao['skills'] = [];

        if (especialista === 'SALES') {
            skills.push({ id: 'PERFIL_COMPRADOR', versao: '1.0.0' });
            // Sales agent sempre precisa de agendamento forte
            skills.push({
                id: 'AGENDAMENTO',
                versao: '1.0.0',
                parametros: {
                    horarioInicio: '09:00',
                    horarioFim: '19:00', // Vendas atende até mais tarde
                    diasDisponiveis: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
                }
            });
        } else {
            // CAPTURE
            skills.push({ id: 'QUALIFICACAO', versao: '1.0.0' });

            // Só adiciona agendamento se já evoluiu funil
            if (['TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'AVALIACAO_EM_ANDAMENTO'].includes(contexto.statusLead || '')) {
                skills.push({
                    id: 'AGENDAMENTO',
                    versao: '1.0.0',
                    parametros: {
                        horarioInicio: '08:00',
                        horarioFim: '18:00'
                    }
                });
            }
        }

        // Adiciona RAG sempre
        skills.push({ id: 'RAG_SEARCH', versao: '1.0.0' });

        return {
            id: `legacy-migration-${legacyConfig.tenantId}-${especialista}`,
            tenantId: legacyConfig.tenantId,
            especialista: especialista,
            subtipo: subtipo,
            skills: skills,
            parametrosGlobais: {
                nomeAgente: legacyConfig.nomeAgente,
                nomeEmpresa: legacyConfig.nomeImobiliaria,
                cidade: legacyConfig.cidade,
                comissao: legacyConfig.comissaoPadrao,
                // Injetar dados do contexto também
                empreendimento: contexto.empreendimento,
                leadNome: especialista === 'SALES' ? 'Cliente' : 'Proprietário'
            },
            versaoConfig: 1
        };
    }
}
