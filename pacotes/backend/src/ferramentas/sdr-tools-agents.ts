/**
 * SDR TOOLS - Formato @openai/agents SDK
 * 
 * Este arquivo contém as ferramentas do SDR no formato compatível
 * com o framework @openai/agents.
 * 
 * @version 2.0
 * @date 16/12/2025
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import ContratoService from '../contratos/contrato-service';
import {
    ConverterParaLeadUseCase,
    MoverParaFaseUseCase,
    SalvarDadosImovelUseCase,
    AgendarFollowupUseCase,
    EncaminharCorretorUseCase,
    AtualizarDadosLeadUseCase,
    QualificarLeadUseCase,
    RegistrarOptoutUseCase
} from '../casos-de-uso/agentes';
import { sanitizeInt, sanitizeFloat, sanitizeBool, sanitizeStr, sanitizeEnum, sanitizeStringArray, temTexto } from './tool-sanitize';
import { wrapToolExecute } from './tool-wrapper';
import { avaliarPolicyAcaoSensivel, isAutoCaptadoAfterCrmEnabled } from './sensitive-action-policy';
import { AGENDA_COMMERCIAL_POLICY_VERSION, executarComandoAgenda } from '../servicos/coerencia-agenda-estado';
import { interpretarAgendamentoTemporal, mensagemContemDataHoraExplicita } from '../servicos/agenda-temporal';
import { resolverEspecialistaCampanha } from '../servicos/resolucao-especialista-campanha';
import { formatarDataHoraAgenda, montarMensagemSolicitacaoLigacao } from '../servicos/notificacao-agendamento';
import {
    formatarSugestaoHorario,
    gerarSlotsComerciaisLocais,
    selecionarSugestoesDeHorario,
} from '../servicos/sugestao-horarios-agenda';
import { consultarStatusAgendamentoCanonico } from '../servicos/consulta-status-agendamento';

async function registrarExecucaoTool(params: {
    leadId?: string;
    toolName: string;
    sucesso: boolean;
    detalhes?: string;
}) {
    if (!params.leadId) return;

    try {
        await prisma.atividade.create({
            data: {
                leadId: params.leadId,
                tipo: 'NOTA',
                titulo: `TOOL_EXEC:${params.toolName}`,
                descricao: `${params.sucesso ? 'SUCCESS' : 'FAILED'}${params.detalhes ? ` | ${params.detalhes}` : ''}`,
                criadoPor: 'ai_agent',
                completadoEm: new Date()
            }
        });
    } catch (error) {
        console.warn(`[TOOL_EXEC] Falha ao registrar ${params.toolName}:`, error);
    }
}

function resolverTenantIdDoContexto(runContext?: any): string | undefined {
    const tenantId = runContext?.context?.tenantId;
    return typeof tenantId === 'string' && tenantId.trim().length > 0 ? tenantId : undefined;
}

function resolverExecucaoDuravelDoContexto(runContext?: any): string | undefined {
    const executionId = runContext?.context?.durableExecutionId;
    return typeof executionId === 'string' && executionId.trim().length > 0 ? executionId : undefined;
}

async function validarOwnershipLeadPorTenant(params: {
    leadId: string;
    tenantId?: string;
    toolName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!params.tenantId) {
        logger.error({ tool: params.toolName, leadId: params.leadId }, '[SECURITY][TOOLS] tenantId ausente no contexto da tool');
        return { ok: false, error: 'Contexto de segurança inválido para executar esta ação.' };
    }

    const lead = await prisma.lead.findUnique({
        where: { id: params.leadId },
        select: { id: true, tenantId: true }
    });

    if (!lead) {
        return { ok: false, error: 'Lead não encontrado' };
    }

    if (lead.tenantId !== params.tenantId) {
        logger.warn({
            tool: params.toolName,
            leadId: params.leadId,
            tenantIdContexto: params.tenantId,
            tenantIdLead: lead.tenantId,
        }, '[SECURITY][TOOLS] Tentativa cross-tenant bloqueada');
        return { ok: false, error: 'Acesso negado ao lead informado.' };
    }

    return { ok: true };
}

// Sanitização importada de ./tool-sanitize (módulo unificado)

// Valores que o lead diz em resposta afirmativa — não representam dados reais do imóvel
const RESPOSTAS_AFIRMATIVAS = new Set([
    'sim', 'não', 'nao', 'ok', 'ok!', 'pode ser', 'entendi', 'claro', 'certo',
    'faz sentido', 'faz sentido sim', 'tá', 'ta', 'tudo bem', 'tudo certo',
    'combinado', 'fechado', 'beleza', 'legal', 'ótimo', 'otimo', 'perfeito',
    'pode ser', 'com certeza', 'exato', 'isso', 'isso mesmo', 'correto',
    'verdade', 'exatamente', 'com certeza', 'concordo', 'affirm', 'yes', 'no',
]);

function filtrarCampoSpin(valor: string | null | undefined): string | null {
    if (!valor) return null;
    const t = valor.trim().toLowerCase();
    if (t.length < 5) return null;
    if (RESPOSTAS_AFIRMATIVAS.has(t)) return null;
    // Respostas muito curtas que são claramente afirmativas/negativas
    if (/^(sim|não|nao|ok|ta|s|n)\s*[!.]*$/.test(t)) return null;
    return valor.trim();
}

function coletarCamposQualificacaoPresentes(input: any): string[] {
    const campos: string[] = [];

    if (temTexto(input.tipoImovel)) campos.push('tipoImovel');
    if (temTexto(input.areaImovel)) campos.push('areaImovel');
    if (input.quartosImovel !== undefined && input.quartosImovel !== null) campos.push('quartosImovel');
    if (temTexto(input.valorPretendido)) campos.push('valorPretendido');
    if (temTexto(input.ocupacaoImovel)) campos.push('ocupacaoImovel');
    if (temTexto(input.estadoConservacao)) campos.push('estadoConservacao');
    if (temTexto(input.situacaoFinanceira)) campos.push('situacaoFinanceira');

    if (Array.isArray(input.doresIdentificadas) && input.doresIdentificadas.length > 0) campos.push('doresIdentificadas');
    if (temTexto(input.situacaoAtual)) campos.push('situacaoAtual');
    if (temTexto(input.motivacaoVenda)) campos.push('motivacaoVenda');
    if (temTexto(input.consequencias)) campos.push('consequencias');
    if (temTexto(input.custosAtuais)) campos.push('custosAtuais');

    return campos;
}

// ====================================
// TOOL 1: Qualificar Lead
// ====================================

export const qualificarLeadTool = tool({
    name: 'qualificar_lead',
    description: `Use após coletar informações na conversa para qualificar o lead.
  
Classifique como:
- QUENTE: urgência alta + timeline ≤ 3 meses + sem corretor
- MORNO: interesse genuíno mas sem urgência imediata
- FRIO: sem interesse real ou timeline muito longo (>6 meses)

IMPORTANTE: Passe TODOS os dados que o lead mencionou na conversa (dores, motivação, tipo de imóvel, quartos, valor). Esses dados são salvos automaticamente no cadastro do lead no kanban.`,

    parameters: z.object({
        leadId: z.string().optional().describe('ID canônico do lead no banco'),
        contatoId: z.string().optional().describe('Alias legado para compatibilidade temporária'),
        temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).describe('Temperatura do lead'),
        interesse: z.string().describe('O que quer: VENDER, ALUGAR, ou AMBOS'),
        timeline: z.string().nullable().optional().describe('Quando pretende: "1-2 meses", "urgente", "6 meses+"'),
        observacoes: z.string().nullable().describe('Observações gerais livres sobre o lead (salvo em observacoesSpin)'),
        // Dados SPIN coletados na conversa
        // S - SITUAÇÃO
        situacaoAtual: z.string().nullable().describe('Situação atual: "10 corretores, 2 visitas em 60 dias"'),
        tempoDecisao: z.string().nullable().describe('Há quanto tempo decidiu vender: "decidiu há 3 meses"'),
        tentativasAnteriores: z.string().nullable().describe('O que já tentou: "tentou sozinho, OLX, 3 imobiliárias"'),
        comCorretorAtualmente: z.boolean().nullable().describe('true se já tem corretor(es) trabalhando o imóvel'),
        comCorretorAtualmenteEvidencia: z.string().nullable().describe('Trecho literal da fala que confirma se tem/não tem corretor'),
        // P - PROBLEMA
        motivacaoVenda: z.string().nullable().describe('Por que quer vender/alugar: "mudança de cidade"'),
        doresIdentificadas: z.string().nullable().describe('Dores (separe por vírgula): "sem visitantes, propostas baixas, imóvel parado"'),
        // I - IMPLICAÇÃO
        consequencias: z.string().nullable().describe('Consequências de não vender: "pagando condomínio sem morar"'),
        custosAtuais: z.string().nullable().describe('Custos mensais atuais: "R$ 1.200/mês em condomínio + IPTU"'),
        pressaoTempo: z.boolean().nullable().describe('true se há pressão de tempo real (divórcio, dívida, transferência)'),
        pressaoTempoEvidencia: z.string().nullable().describe('Trecho literal da fala que comprova pressão de tempo'),
        // N - NECESSIDADE
        expectativaServico: z.string().nullable().describe('O que espera do corretor/consultoria'),
        objecoes: z.string().nullable().describe('Objeções levantadas (separe por vírgula): "não dou exclusividade, comissão alta"'),
        interesseAvaliacao: z.boolean().nullable().describe('true se o lead aceitou/demonstrou interesse em avaliação'),
        interesseAvaliacaoEvidencia: z.string().nullable().describe('Trecho literal da fala que comprova interesse em avaliação'),
        // Dados do imóvel
        enderecoImovel: z.string().nullable().describe('Endereço do imóvel'),
        tipoImovel: z.string().nullable().describe('apartamento, casa, comercial, terreno'),
        areaImovel: z.string().nullable().describe('Área em m²'),
        quartosImovel: z.union([z.string(), z.number()]).nullable().describe('Número de quartos'),
        vagasImovel: z.union([z.string(), z.number()]).nullable().describe('Vagas de garagem'),
        valorPretendido: z.string().nullable().describe('Valor pretendido'),
        ocupacaoImovel: z.string().nullable().describe('"ocupado", "vazio" ou "alugado"'),
        // Qualificação adicional do imóvel
        estadoConservacao: z.enum(['excelente', 'bom', 'reforma']).nullable().describe('Estado de conservação do imóvel'),
        situacaoFinanceira: z.enum(['quitado', 'financiado']).nullable().describe('Imóvel quitado ou financiado'),
        temDividas: z.boolean().nullable().describe('true se o proprietário mencionou dívidas de IPTU ou condomínio em atraso'),
        temDividasEvidencia: z.string().nullable().describe('Trecho literal da fala que confirma se tem/não tem dívidas'),
    }),

    execute: wrapToolExecute('qualificar_lead', async (args: any, runContext?: any) => {
        const useCase = new QualificarLeadUseCase();
        const input: any = { ...args };
        const leadIdResolvido = typeof args.leadId === 'string' && args.leadId.trim().length > 0
            ? args.leadId
            : args.contatoId;
        input.leadId = leadIdResolvido;
        if (input.leadId) {
            const ownership = await validarOwnershipLeadPorTenant({
                leadId: input.leadId,
                tenantId: resolverTenantIdDoContexto(runContext),
                toolName: 'qualificar_lead'
            });
            if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
        }
        if (typeof args.doresIdentificadas === 'string') {
            input.doresIdentificadas = args.doresIdentificadas.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
        if (typeof args.objecoes === 'string') {
            input.objecoes = args.objecoes.split(',').map((o: string) => o.trim()).filter((o: string) => o);
        }
        // Sanitizar campos numéricos
        input.quartosImovel = sanitizeInt(input.quartosImovel);
        input.vagasImovel = sanitizeInt(input.vagasImovel);
        // Sanitizar campos boolean
        input.comCorretorAtualmente = sanitizeBool(input.comCorretorAtualmente);
        input.pressaoTempo = sanitizeBool(input.pressaoTempo);
        input.interesseAvaliacao = sanitizeBool(input.interesseAvaliacao);
        input.temDividas = sanitizeBool(input.temDividas);
        // Sanitizar campos string (estruturais do imóvel)
        input.enderecoImovel = sanitizeStr(input.enderecoImovel);
        input.tipoImovel = sanitizeStr(input.tipoImovel);
        input.areaImovel = sanitizeStr(input.areaImovel);
        input.valorPretendido = sanitizeStr(input.valorPretendido);
        input.ocupacaoImovel = sanitizeStr(input.ocupacaoImovel);
        input.observacoes = sanitizeStr(input.observacoes);
        input.timeline = sanitizeStr(input.timeline);
        // Campos SPIN: filtrar respostas afirmativas que o agente confunde com dados reais
        input.situacaoAtual = filtrarCampoSpin(input.situacaoAtual);
        input.tempoDecisao = filtrarCampoSpin(input.tempoDecisao);
        input.tentativasAnteriores = filtrarCampoSpin(input.tentativasAnteriores);
        input.motivacaoVenda = filtrarCampoSpin(input.motivacaoVenda);
        input.consequencias = filtrarCampoSpin(input.consequencias);
        input.custosAtuais = filtrarCampoSpin(input.custosAtuais);
        input.expectativaServico = filtrarCampoSpin(input.expectativaServico);
        // Evidências: sanitização simples (pode conter afirmativas como prova literal)
        input.comCorretorAtualmenteEvidencia = sanitizeStr(input.comCorretorAtualmenteEvidencia);
        input.pressaoTempoEvidencia = sanitizeStr(input.pressaoTempoEvidencia);
        input.interesseAvaliacaoEvidencia = sanitizeStr(input.interesseAvaliacaoEvidencia);
        input.temDividasEvidencia = sanitizeStr(input.temDividasEvidencia);
        // Sanitizar campos enum
        input.estadoConservacao = sanitizeEnum(input.estadoConservacao, ['excelente', 'bom', 'reforma']);
        input.situacaoFinanceira = sanitizeEnum(input.situacaoFinanceira, ['quitado', 'financiado']);

        const camposPresentes = coletarCamposQualificacaoPresentes(input);
        if (camposPresentes.length < 2) {
            const resposta = {
                success: false,
                error: 'Dados insuficientes para qualificar com segurança.',
                camposObrigatoriosMinimos: ['tipoImovel/areaImovel/ocupacaoImovel/valorPretendido', 'doresIdentificadas/situacaoAtual/motivacaoVenda'],
                camposRecebidos: camposPresentes
            };

            await registrarExecucaoTool({
                toolName: 'qualificar_lead',
                sucesso: false,
                detalhes: `Bloqueado por baixa completude (${camposPresentes.length} campos)`
            });

            return JSON.stringify(resposta);
        }

        const result = await useCase.execute(input);
        await registrarExecucaoTool({
            leadId: result?.leadId,
            toolName: 'qualificar_lead',
            sucesso: !!result?.success,
            detalhes: result?.message || result?.error
        });
        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 2: Registrar Opt-out
// ====================================

export const registrarOptoutTool = tool({
    name: 'registrar_optout',
    description: `Use IMEDIATAMENTE quando o contato pedir para parar de receber mensagens.
Gatilhos: "para", "não me ligue", "spam", "não quero"`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato'),
        motivo: z.enum([
            'NAO_INCOMODAR',
            'JA_TEM_IMOBILIARIA',
            'SEM_INTERESSE_AGORA',
            'IMOVEL_VENDIDO',
            'NAO_E_PROPRIETARIO',
            'OUTRO'
        ]).describe('Motivo do opt-out')
    }),

    execute: wrapToolExecute('registrar_optout', async (args, runContext?: any) => {
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.contatoId,
            tenantId: resolverTenantIdDoContexto(runContext),
            toolName: 'registrar_optout'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const useCase = new RegistrarOptoutUseCase();
        const result = await useCase.execute({
            leadId: args.contatoId,
            motivo: args.motivo
        });
        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 3: Converter para Lead
// ====================================

export const converterParaLeadTool = tool({
    name: 'converter_para_lead',
    description: `Use quando o proprietário demonstrar interesse REAL em vender ou alugar.
Deve ter coletado: tipo de interesse, timeline, dados básicos.

IMPORTANTE: Passe TODOS os dados coletados na conversa! Tipo de imóvel, quartos, metragem, valor, motivação, situação atual. Tudo será salvo automaticamente no lead do kanban.`,

    parameters: z.object({
        leadId: z.string().optional().describe('ID canônico do lead que será convertido'),
        contatoId: z.string().optional().describe('Alias legado para compatibilidade temporária'),
        temperatura: z.enum(['MORNO', 'QUENTE']).describe('QUENTE: urgência, MORNO: interesse sem pressa'),
        tipoInteresse: z.enum(['VENDA', 'LOCACAO', 'AMBOS']).describe('O que quer fazer'),
        timeline: z.string().nullable().optional().describe('Quando: "1 mês", "urgente", "sem pressa"'),
        // Dados do imóvel coletados na conversa
        enderecoImovel: z.string().nullable().describe('Endereço do imóvel'),
        tipoImovel: z.string().nullable().describe('apartamento, casa, terreno'),
        areaImovel: z.string().nullable().describe('Área m²'),
        quartosImovel: z.union([z.string(), z.number()]).nullable().describe('Número de quartos'),
        vagasImovel: z.union([z.string(), z.number()]).nullable().describe('Vagas de garagem'),
        valorPretendido: z.string().nullable().describe('Valor pretendido'),
        ocupacaoImovel: z.string().nullable().describe('"ocupado", "vazio", "alugado"'),
        // Qualificação SPIN
        motivacaoVenda: z.string().nullable().describe('Motivação'),
        situacaoAtual: z.string().nullable().describe('Situação atual'),
        prazoDesejado: z.string().nullable().describe('Prazo para venda'),
        doresIdentificadas: z.string().nullable().describe('Dores (separadas por vírgula)'),
    }),

    execute: wrapToolExecute('converter_para_lead', async (args: any, runContext?: any) => {
        const useCase = new ConverterParaLeadUseCase();
        const input: any = { ...args };
        const leadIdResolvido = typeof args.leadId === 'string' && args.leadId.trim().length > 0
            ? args.leadId
            : args.contatoId;
        input.leadId = leadIdResolvido;
        if (input.leadId) {
            const ownership = await validarOwnershipLeadPorTenant({
                leadId: input.leadId,
                tenantId: resolverTenantIdDoContexto(runContext),
                toolName: 'converter_para_lead'
            });
            if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
        }
        if (typeof args.doresIdentificadas === 'string') {
            input.doresIdentificadas = args.doresIdentificadas.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
        input.quartosImovel = sanitizeInt(input.quartosImovel);
        input.vagasImovel = sanitizeInt(input.vagasImovel);
        input.enderecoImovel = sanitizeStr(input.enderecoImovel);
        input.tipoImovel = sanitizeStr(input.tipoImovel);
        input.areaImovel = sanitizeStr(input.areaImovel);
        input.valorPretendido = sanitizeStr(input.valorPretendido);
        input.ocupacaoImovel = sanitizeStr(input.ocupacaoImovel);
        input.timeline = sanitizeStr(input.timeline);
        input.prazoDesejado = sanitizeStr(input.prazoDesejado);
        // Campos SPIN: filtrar respostas afirmativas
        input.motivacaoVenda = filtrarCampoSpin(input.motivacaoVenda);
        input.situacaoAtual = filtrarCampoSpin(input.situacaoAtual);

        const result = await useCase.execute(input);
        const conversaoIdempotente = result?.reasonCode === 'ALREADY_LEAD';
        await registrarExecucaoTool({
            leadId: result?.leadId,
            toolName: 'converter_para_lead',
            sucesso: !!result?.success || conversaoIdempotente,
            detalhes: conversaoIdempotente
                ? 'Lead já convertido anteriormente (idempotente)'
                : (result?.message || result?.error)
        });
        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 5: Agendar Follow-up
// ====================================

export const agendarFollowupTool = tool({
    name: 'agendar_followup',
    description: `Use quando proprietário demonstrar interesse mas NÃO quer agora.
Exemplos: "talvez próximo ano", "vou pensar", "agora não"`,

    parameters: z.object({
        leadId: z.string().describe('Lead.id canonico recebido do contexto'),
        timezoneIana: z.string().describe('Timezone IANA confiavel'),
        evidenciaPedido: z.string().describe('Trecho do pedido explicito do Lead'),
        policyVersion: z.literal('followup-v1').default('followup-v1'),
        followupId: z.string().optional().describe('ID do follow-up ativo quando a acao for reagendamento explicito'),
        dataRecontato: z.string().describe('Data e hora confirmadas: "DD/MM/YYYY HH:mm"'),
        mensagemEnvio: z.string().describe('Mensagem de follow-up a enviar, sem inventar fatos'),
        motivo: z.string().describe('Por que não quer agora')
    }),

    execute: wrapToolExecute('agendar_followup', async (args, runContext?: any) => {
        const durableExecutionId = resolverExecucaoDuravelDoContexto(runContext);
        if (!durableExecutionId) return JSON.stringify({ success: false, error: 'TRUSTED_REQUEST_ID_REQUIRED', reasonCode: 'TRUSTED_REQUEST_ID_REQUIRED' });
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.leadId,
            tenantId: resolverTenantIdDoContexto(runContext),
            toolName: 'agendar_followup'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const useCase = new AgendarFollowupUseCase();
        const result = await useCase.execute({
            tenantId: resolverTenantIdDoContexto(runContext)!,
            leadId: args.leadId,
            dataRecontato: args.dataRecontato,
            timezoneIana: args.timezoneIana,
            motivo: args.motivo,
            mensagemEnvio: args.mensagemEnvio,
            evidenciaPedido: args.evidenciaPedido,
            origemPedido: 'TOOL_AGENDAR_FOLLOWUP',
            requestIdentity: { source: 'INBOUND_BATCH', id: durableExecutionId },
            policyVersion: args.policyVersion,
            followupId: args.followupId
        });
        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 7: Encaminhar para Corretor
// ====================================

export const encaminharCorretorTool = tool({
    name: 'encaminhar_corretor',
    description: `USAR APENAS quando proprietário pedir EXPLICITAMENTE para falar com humano.
NÃO use para perguntas sobre valor - responda você mesmo!
Ao executar, faça passagem de bastão profissional: diga quem é o especialista e oriente salvar o contato.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato'),
        motivo: z.string().describe('Deve ser: "proprietário solicitou corretor"'),
        contextoConversa: z.string().describe('Resumo da conversa'),
        urgencia: z.enum(['NORMAL', 'ALTA']).describe('ALTA se interesse/urgência')
    }),

    execute: wrapToolExecute('encaminhar_corretor', async (args, runContext?: any) => {
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.contatoId,
            tenantId: resolverTenantIdDoContexto(runContext),
            toolName: 'encaminhar_corretor'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const useCase = new EncaminharCorretorUseCase();
        const result = await useCase.execute({
            leadId: args.contatoId,
            motivo: args.motivo,
            contextoConversa: args.contextoConversa,
            urgencia: args.urgencia
        });
        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 9: Mover Lead para Fase (Kanban)
// ====================================

export const moverParaFaseTool = tool({
    name: 'mover_para_fase',
    description: `Move o lead para próxima fase do Kanban.
    
Use quando:
- Fase 1→2: Identificou interesse + 2 dores
- Fase 2→3: Cliente disse "faz sentido" ou aceitou proposta
- Fase 3→4: Cliente aceitou avançar para contrato
- Fase 4→Captado: Contrato assinado + avaliação agendada`,

    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        faseDestino: z.enum(['FASE1', 'FASE2', 'FASE3', 'FASE4', 'CAPTADO']).describe('Fase de destino'),
        motivo: z.string().describe('Motivo da transição'),
        aprovacaoHumana: z.boolean().optional().describe('Marcar true quando operador humano aprovar ação irreversível'),
        dadosAdicionais: z.object({
            tipoAutorizacao: z.enum(['exclusiva', 'simples']).nullable().describe('Tipo de autorização acordada (ou null se não houver)'),
            prazoTrabalho: z.number().nullable().describe('Prazo em dias (ou null)'),
            comissaoAcordada: z.string().nullable().describe('Comissão (ou null)'),
            autorizouAnuncio: z.boolean().nullable().describe('Cliente autorizou publicar anúncio do imóvel? (ou null se não discutido)')
        }).nullable().describe('Dados do acordo (obrigatório passar objeto ou null)')
    }),

    execute: wrapToolExecute('mover_para_fase', async (args: any, runContext?: any) => {
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.leadId,
            tenantId: resolverTenantIdDoContexto(runContext),
            toolName: 'mover_para_fase'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
        if (args.faseDestino === 'CAPTADO') {
            const leadParaPolicy = await prisma.lead.findUnique({
                where: { id: args.leadId },
                select: { status: true, crmSyncStatus: true }
            });
            if (!leadParaPolicy) return JSON.stringify({ success: false, error: 'Lead não encontrado', reasonCode: 'LEAD_NOT_FOUND' });
            const policy = avaliarPolicyAcaoSensivel({
                acao: 'MOVER_CAPTADO',
                lead: leadParaPolicy as any,
                aprovacaoHumana: args.aprovacaoHumana === true
            });
            if (!policy.permitido) {
                return JSON.stringify({
                    success: false,
                    error: policy.error,
                    reasonCode: policy.reasonCode,
                    policyDetalhes: policy.detalhes
                });
            }
        }

        // Sanitizar dadosAdicionais
        const dadosSanitizados = args.dadosAdicionais ? {
            tipoAutorizacao: sanitizeEnum(args.dadosAdicionais.tipoAutorizacao, ['exclusiva', 'simples']),
            prazoTrabalho: sanitizeInt(args.dadosAdicionais.prazoTrabalho),
            comissaoAcordada: sanitizeStr(args.dadosAdicionais.comissaoAcordada),
            autorizouAnuncio: sanitizeBool(args.dadosAdicionais.autorizouAnuncio),
        } : undefined;

        const useCase = new MoverParaFaseUseCase();
        const result = await useCase.execute({
            leadId: args.leadId,
            faseDestino: args.faseDestino,
            motivo: args.motivo,
            dadosAdicionais: dadosSanitizados
        });

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'mover_para_fase',
            sucesso: !!result?.success,
            detalhes: result?.motivo || result?.error
        });

        return JSON.stringify(result);
    })
});

export const gerarLinkContratoTool = tool({
    name: 'gerar_link_contrato',
    description: 'gera um link único para o proprietário assinar a autorização de venda (contrato). Retorna a URL para enviar ao cliente.',
    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        tipoContrato: z.enum(['CAPTACAO']).default('CAPTACAO').describe('Tipo do contrato'),
        aprovacaoHumana: z.boolean().optional().describe('Marcar true quando operador humano aprovar geração de contrato')
    }),
    execute: wrapToolExecute('gerar_link_contrato', async (args, runContext?: any) => {
        console.log(`[TOOL] gerar_link_contrato - Lead ${args.leadId}`);
        const tenantIdContexto = resolverTenantIdDoContexto(runContext);
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.leadId,
            tenantId: tenantIdContexto,
            toolName: 'gerar_link_contrato'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const lead = await prisma.lead.findUnique({
            where: { id: args.leadId },
            include: { tenant: true }
        });

        if (!lead) {
            return JSON.stringify({ success: false, error: 'Lead não encontrado' });
        }
        const policy = avaliarPolicyAcaoSensivel({
            acao: 'GERAR_CONTRATO',
            lead: lead as any,
            aprovacaoHumana: args.aprovacaoHumana === true
        });
        if (!policy.permitido) {
            return JSON.stringify({
                success: false,
                error: policy.error,
                reasonCode: policy.reasonCode,
                policyDetalhes: policy.detalhes
            });
        }

        const contrato = await ContratoService.gerarContratoCaptacao({
            leadId: args.leadId,
            tenantId: lead.tenantId,
            tipoContrato: args.tipoContrato
        });

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'gerar_link_contrato',
            sucesso: true,
            detalhes: 'Link de contrato gerado'
        });

        return JSON.stringify({
            success: true,
            link: contrato.linkAceite,
            mensagem: "Link gerado com sucesso. Envie para o cliente."
        });
    })
});

export const atualizarDadosLeadTool = tool({
    name: 'atualizar_dados_lead',
    description: 'Atualiza dados cadastrais do lead (CPF, endereço, email, etc). Use sempre que o lead fornecer essas informações.',
    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        cpf: z.string().nullable().describe('CPF do cliente (apenas números)'),
        email: z.union([z.string().email(), z.literal(''), z.null()]).describe('Email do cliente'),
        endereco: z.string().nullable().describe('Endereço completo do imóvel'),
        nome: z.string().nullable().describe('Nome completo do cliente')
    }),
    execute: wrapToolExecute('atualizar_dados_lead', async (args: any, runContext?: any) => {
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.leadId,
            tenantId: resolverTenantIdDoContexto(runContext),
            toolName: 'atualizar_dados_lead'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const useCase = new AtualizarDadosLeadUseCase();
        const result = await useCase.execute({
            leadId: args.leadId,
            cpf: sanitizeStr(args.cpf),
            email: sanitizeStr(args.email),
            endereco: sanitizeStr(args.endereco),
            nome: sanitizeStr(args.nome)
        });

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'atualizar_dados_lead',
            sucesso: !!result?.success,
            detalhes: result?.mensagem || result?.error
        });

        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 12: Salvar Dados do Imóvel (Coleta pós-contrato)
// ====================================

export const salvarDadosImovelTool = tool({
    name: 'salvar_dados_imovel',
    description: `Salva dados completos do imóvel coletados na conversa pós-contrato.
Use após o proprietário fornecer informações sobre quartos, área, características, valor, etc.
CRITICAL: Use esta tool para cada grupo de dados recebido.`,

    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        tipo: z.string().nullable().describe('Tipo: apartamento, casa, comercial, terreno'),
        quartos: z.number().nullable().describe('Número de quartos'),
        suites: z.number().nullable().describe('Número de suítes'),
        banheiros: z.number().nullable().describe('Número de banheiros'),
        vagas: z.number().nullable().describe('Vagas de garagem'),
        areaUtil: z.number().nullable().describe('Área útil em m²'),
        areaTotal: z.number().nullable().describe('Área total em m²'),
        andar: z.number().nullable().describe('Andar do apartamento'),
        valorVenda: z.number().nullable().describe('Valor de venda em reais'),
        valorLocacao: z.number().nullable().describe('Valor de locação mensal'),
        valorCondominio: z.number().nullable().describe('Valor do condomínio'),
        valorIPTU: z.number().nullable().describe('Valor anual do IPTU'),
        caracteristicas: z.array(z.string()).nullable().describe('Lista de características: armários, varanda, churrasqueira, etc'),
        descricao: z.string().nullable().describe('Descrição detalhada do imóvel'),
        fotos: z.array(z.string()).nullable().describe('URLs das fotos enviadas')
    }),

    execute: wrapToolExecute('salvar_dados_imovel', async (args: any, runContext?: any) => {
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.leadId,
            tenantId: resolverTenantIdDoContexto(runContext),
            toolName: 'salvar_dados_imovel'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const inputSanitizado = {
            leadId: args.leadId,
            tipo: sanitizeStr(args.tipo),
            quartos: sanitizeInt(args.quartos),
            suites: sanitizeInt(args.suites),
            banheiros: sanitizeInt(args.banheiros),
            vagas: sanitizeInt(args.vagas),
            areaUtil: sanitizeFloat(args.areaUtil),
            areaTotal: sanitizeFloat(args.areaTotal),
            andar: sanitizeInt(args.andar),
            valorVenda: sanitizeFloat(args.valorVenda),
            valorLocacao: sanitizeFloat(args.valorLocacao),
            valorCondominio: sanitizeFloat(args.valorCondominio),
            valorIPTU: sanitizeFloat(args.valorIPTU),
            caracteristicas: sanitizeStringArray(args.caracteristicas),
            descricao: sanitizeStr(args.descricao),
            fotos: sanitizeStringArray(args.fotos),
        };

        const useCase = new SalvarDadosImovelUseCase();
        const result = await useCase.execute(inputSanitizado);

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'salvar_dados_imovel',
            sucesso: !!result?.success,
            detalhes: result?.message || result?.error
        });

        return JSON.stringify(result);
    })
});

// ====================================
// TOOL 13: Enviar para CRM
// ====================================

import { enviarParaCrm } from '../servicos/crm-service';

export const enviarParaCrmTool = tool({
    name: 'enviar_para_crm',
    description: `Envia o lead captado + dados do imóvel para o CRM externo.
Use APÓS:
1. Contrato assinado
2. Dados do imóvel coletados (tipo, quartos, área, valor)

O CRM criará o Proprietário + Property para publicação nos portais.`,

    parameters: z.object({
        leadId: z.string().describe('ID do lead a enviar'),
        aprovacaoHumana: z.boolean().optional().describe('Marcar true quando operador humano aprovar envio ao CRM')
    }),

    execute: wrapToolExecute('enviar_para_crm', async (args, runContext?: any) => {
        console.log(`[TOOL] enviar_para_crm - Lead ${args.leadId}`);
        const tenantIdContexto = resolverTenantIdDoContexto(runContext);
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.leadId,
            tenantId: tenantIdContexto,
            toolName: 'enviar_para_crm'
        });
        if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

        const lead = await prisma.lead.findUnique({
            where: { id: args.leadId }
        });

        if (!lead) {
            return JSON.stringify({
                success: false,
                error: 'Lead não encontrado'
            });
        }
        const policy = avaliarPolicyAcaoSensivel({
            acao: 'ENVIAR_CRM',
            lead: lead as any,
            aprovacaoHumana: args.aprovacaoHumana === true
        });
        if (!policy.permitido) {
            return JSON.stringify({
                success: false,
                error: policy.error,
                reasonCode: policy.reasonCode,
                policyDetalhes: policy.detalhes
            });
        }

        const resultado = await enviarParaCrm(args.leadId);

        if (resultado.success) {
            console.log(`[TOOL] enviar_para_crm - Sucesso! PropertyCode: ${resultado.property_code}`);

            let moveResult: any = { success: false, error: 'Movimento para CAPTADO não executado automaticamente por policy.' };
            if (isAutoCaptadoAfterCrmEnabled()) {
                const useCase = new MoverParaFaseUseCase();
                moveResult = await useCase.execute({
                    leadId: args.leadId,
                    faseDestino: 'CAPTADO',
                    motivo: `CRM sincronizado — código ${resultado.property_code}`,
                    dadosAdicionais: null,
                });
                if (!moveResult.success) {
                    console.warn(`[TOOL] enviar_para_crm - CRM ok mas CAPTADO bloqueado: ${moveResult.error}`);
                }
            }

            return JSON.stringify({
                success: true,
                crmPropertyId: resultado.property_id,
                crmPropertyCode: resultado.property_code,
                statusAtualizado: moveResult.success ? 'CAPTADO' : null,
                avisoStatus: moveResult.success ? null : moveResult.error,
                message: moveResult.success
                    ? `✅ Enviado para CRM e lead marcado como CAPTADO! Código: ${resultado.property_code}`
                    : `✅ Enviado para CRM! Código: ${resultado.property_code}. Ação CAPTADO depende de policy/aprovação.`,
            });
        } else {
            return JSON.stringify({
                success: false,
                error: resultado.error || 'Falha ao enviar para CRM'
            });
        }
    })
});

// ====================================
// TOOL 15: Registrar Indicação de Terceiro
// ====================================

export const registrarIndicacaoTool = tool({
    name: 'registrar_indicacao',
    description: `Use quando o contato INDICAR outra pessoa que quer vender ou alugar imóvel.
Exemplos: "meu vizinho quer vender", "uma amiga tá vendendo", "conheço alguém".
OBRIGATÓRIO coletar: nome e telefone do indicado.`,

    parameters: z.object({
        contatoOrigemId: z.string().describe('ID do contato que fez a indicação'),
        campanhaId: z.string().describe('ID da campanha atual'),
        nomeIndicado: z.string().describe('Nome da pessoa indicada'),
        telefoneIndicado: z.string().describe('Telefone da pessoa indicada'),
        parentesco: z.string().describe('Relação: vizinho, amigo, familiar, colega, outro'),
        observacoes: z.string().default('').describe('Detalhes extras: tipo de imóvel, urgência, etc.')
    }),

    execute: wrapToolExecute('registrar_indicacao', async (args, runContext?: any) => {
        console.log(`[TOOL] registrar_indicacao - Origem: ${args.contatoOrigemId} → Indicado: ${args.nomeIndicado} (${args.telefoneIndicado})`);
        const tenantIdContexto = resolverTenantIdDoContexto(runContext);
        if (!tenantIdContexto) {
            return JSON.stringify({ success: false, error: 'Contexto de segurança inválido para executar esta ação.', reasonCode: 'TENANT_OWNERSHIP_DENIED' });
        }

        const contatoOrigem = await prisma.lead.findUnique({
            where: { id: args.contatoOrigemId },
            select: { nome: true, campanhaOrigemId: true, tenantId: true }
        });
        if (!contatoOrigem) {
            return JSON.stringify({ success: false, error: 'Contato de origem não encontrado' });
        }
        if (contatoOrigem.tenantId !== tenantIdContexto) {
            logger.warn({
                tool: 'registrar_indicacao',
                contatoOrigemId: args.contatoOrigemId,
                tenantIdContexto,
                tenantIdOrigem: contatoOrigem.tenantId,
            }, '[SECURITY][TOOLS] Tentativa cross-tenant bloqueada em registrar_indicacao');
            return JSON.stringify({ success: false, error: 'Acesso negado ao contato de origem.', reasonCode: 'TENANT_OWNERSHIP_DENIED' });
        }

        const campanhaOrigemId = args.campanhaId || contatoOrigem?.campanhaOrigemId;
        if (!campanhaOrigemId || !contatoOrigem?.tenantId) {
            return JSON.stringify({ success: false, error: 'Campanha não encontrada' });
        }

        const telefone = args.telefoneIndicado.replace(/\D/g, '');

        const existente = await prisma.lead.findFirst({
            where: { campanhaOrigemId, telefone: { contains: telefone.slice(-8) } }
        });

        if (existente) {
            return JSON.stringify({
                success: true,
                jaExistia: true,
                contatoId: existente.id,
                mensagem: `Contato já existe na campanha: ${existente.nome}`
            });
        }

        const novoContato = await prisma.lead.create({
            data: {
                tenantId: contatoOrigem.tenantId,
                campanhaOrigemId,
                nome: args.nomeIndicado,
                telefone: telefone,
                temWhatsapp: true,
                quantidadeWhatsapp: 1,
                statusProspeccao: 'AGUARDANDO',
                observacoes: `📌 INDICAÇÃO de ${contatoOrigem?.nome || 'contato'} (${args.parentesco}). ${args.observacoes || ''}`
            }
        });

        console.log(`[TOOL] registrar_indicacao - Novo contato criado: ${novoContato.id}`);

        return JSON.stringify({
            success: true,
            jaExistia: false,
            contatoId: novoContato.id,
            nomeIndicado: args.nomeIndicado,
            indicadoPor: contatoOrigem?.nome,
            mensagem: `Indicação registrada! ${args.nomeIndicado} será contatado na próxima rodada de disparos.`
        });
    })
});

// ====================================
// TOOL 16: Consultar horários para lead flexível
// ====================================

export const consultarHorariosDisponiveisTool = tool({
    name: 'consultar_horarios_disponiveis',
    description: `Use quando o lead aceitar o atendimento, mas responder com flexibilidade em vez de informar data e hora exatas.

Exemplos: "qualquer horário", "pode escolher", "quando vocês puderem", "pra mim tanto faz", "qualquer dia".

Esta tool NÃO agenda e NÃO confirma nada. Ela retorna no máximo duas opções para você fazer uma pergunta simples ao lead. Apresente as opções e aguarde a escolha ou confirmação antes de chamar agendar_reuniao_closer.

Se o lead disser apenas um período, preserve a preferência: manhã ou tarde. NÃO volte a perguntar de forma aberta "qual dia e horário?" depois que ele já informou que possui flexibilidade.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato (mesmo usado nas outras tools)'),
        periodoPreferido: z.enum(['qualquer', 'manha', 'tarde']).default('qualquer')
            .describe('Período indicado pelo lead; use qualquer quando ele não restringir'),
    }),

    execute: wrapToolExecute('consultar_horarios_disponiveis', async (args, runContext?: any) => {
        const tenantId = resolverTenantIdDoContexto(runContext);
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.contatoId,
            tenantId,
            toolName: 'consultar_horarios_disponiveis',
        });
        if (!ownership.ok) {
            return JSON.stringify({ success: false, reasonCode: 'TENANT_OWNERSHIP_DENIED', error: ownership.error });
        }

        const contato = await prisma.lead.findUnique({
            where: { id: args.contatoId },
            select: { id: true, campanhaOrigemId: true },
        });
        if (!contato?.campanhaOrigemId) {
            return JSON.stringify({
                success: false,
                reasonCode: 'CAMPAIGN_NOT_FOUND',
                instrucaoParaAgente: 'Não repita a pergunta de data e hora. Diga que vai verificar a agenda do especialista e retornar com opções.',
            });
        }

        const especialista = await resolverEspecialistaCampanha({
            tenantId: tenantId!,
            campanhaId: contato.campanhaOrigemId,
        });
        if (!especialista) {
            return JSON.stringify({
                success: false,
                reasonCode: 'SPECIALIST_NOT_CONFIGURED',
                instrucaoParaAgente: 'Não repita a pergunta de data e hora. Diga que vai verificar a agenda do especialista e retornar com opções.',
            });
        }

        const agora = new Date();
        const fimConsulta = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
        const conflitosLocais = especialista.usuarioId
            ? await prisma.atividade.findMany({
                where: {
                    corretorAtualId: especialista.usuarioId,
                    tipo: 'REUNIAO',
                    completadoEm: null,
                    statusAgendamento: { in: ['PENDENTE', 'SOLICITADO', 'PROPOSTO', 'CONFIRMADO'] },
                    agendadoPara: { gte: agora, lte: fimConsulta },
                    lead: { tenantId: tenantId! },
                },
                select: { agendadoPara: true, duracao: true },
            })
            : [];

        let slots = gerarSlotsComerciaisLocais(agora, 7);
        let fonte: 'GOOGLE_CALENDAR_E_LOCAL' | 'AGENDA_LOCAL' = 'AGENDA_LOCAL';
        try {
            const { googleCalendarService } = require('../servicos/google-calendar');
            if (googleCalendarService.isConfigurado()) {
                slots = await googleCalendarService.consultarSlotsLivres({
                    dataInicio: agora,
                    dataFim: fimConsulta,
                });
                fonte = 'GOOGLE_CALENDAR_E_LOCAL';
            }
        } catch (error: any) {
            logger.warn({ error: error?.message }, '[TOOL] consultar_horarios_disponiveis usando agenda local');
        }

        const sugestoes = selecionarSugestoesDeHorario({
            slots,
            conflitosLocais: conflitosLocais
                .filter((item: any) => item.agendadoPara)
                .map((item: any) => ({ agendadoPara: item.agendadoPara, duracao: item.duracao })),
            periodoPreferido: args.periodoPreferido,
            limite: 2,
            agora,
        }).map((slot) => ({
            dataHora: formatarSugestaoHorario(slot),
            inicioUtc: slot.inicio,
        }));

        if (sugestoes.length === 0) {
            return JSON.stringify({
                success: false,
                reasonCode: 'NO_SLOTS_FOUND',
                especialista: especialista.nome,
                instrucaoParaAgente: 'Não pressione o lead nem repita a pergunta. Diga que vai verificar a agenda do especialista e retornar com opções.',
            });
        }

        return JSON.stringify({
            success: true,
            especialista: especialista.nome,
            fonte,
            sugestoes,
            instrucaoParaAgente: sugestoes.length === 1
                ? `Pergunte apenas: "Perfeito. Posso solicitar ${sugestoes[0].dataHora} para você?"`
                : `Ofereça somente estas opções e aguarde a escolha: ${sugestoes.map((item) => item.dataHora).join(' ou ')}.`,
        });
    }),
});

// ====================================
// TOOL 17: Agendar Reunião com Closer Humano
// (v2.0 — Integração Google Calendar + Fallback local)
// ====================================

export const agendarReuniaoCloserTool = tool({
    name: 'agendar_reuniao_closer',
    description: `🚨 CHAME ESTA TOOL SOMENTE quando o lead informar data+horário OU confirmar diretamente uma opção exata que você acabou de oferecer após consultar_horarios_disponiveis.

🔴 REGRA ABSOLUTA: A data+hora precisa ter vindo do lead ou de uma opção retornada por consultar_horarios_disponiveis e confirmada pelo lead. Exemplos válidos: "pode ser dia X às YH", "amanhã às 14h", "03/04 às 17h" ou "pode ser" como resposta direta a "posso solicitar 03/04 às 17h?".
❌ "Sim", "pode ser", "fechou", "bora", "ok" após um convite genérico NÃO são datas. Nesse caso, pergunte a preferência ou consulte horários se o lead indicar flexibilidade.
❌ NUNCA INVENTE uma data/hora. Se o lead não disse explicitamente dia e hora, NÃO chame esta tool.

NÃO confirme o agendamento em texto sem chamar esta tool primeiro. A confirmação textual só deve vir DEPOIS da tool retornar success=true.

Se a tool retornar disponivel=false, SUGIRA horários alternativos do campo 'alternativas' e peça ao lead para escolher outro horário.

FORMATO da data: preserve a expressão temporal do lead sempre que possível (ex.: "amanhã 14:00").
O backend resolverá datas relativas de forma determinística em America/Sao_Paulo usando a mensagem inbound original.

⚠️ NUNCA substitua a chamada desta tool por uma confirmação textual. Se não chamar a tool, o agendamento NÃO será registrado no sistema.

📋 SEMPRE preencha 'observacoesCloser' com o relatório da conversa (dores SPIN, interesse, objeções). O Corretor Humano usará esse relatório para decidir o tipo de atendimento.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato (mesmo usado nas outras tools)'),
        dataHora: z.string().describe('Data e hora informada pelo lead; preserve expressões relativas como "amanhã 14:00"'),
        modalidade: z.enum(['google_meet', 'whatsapp_video', 'zoom']).default('whatsapp_video').describe('Tipo de reunião virtual'),
        observacoesCloser: z.string().nullable().describe('RELATÓRIO DA CONVERSA para o Corretor Humano: dores SPIN identificadas, nível de interesse, objeções levantadas, PVAM inferido, contexto da negociação')
    }),

    execute: wrapToolExecute('agendar_reuniao_closer', async (args, runContext?: any) => {
            console.log(`[TOOL] agendar_reuniao_closer - Contato ${args.contatoId} - ${args.dataHora}`);
            const ownership = await validarOwnershipLeadPorTenant({
                leadId: args.contatoId,
                tenantId: resolverTenantIdDoContexto(runContext),
                toolName: 'agendar_reuniao_closer'
            });
            if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
            const durableExecutionId = resolverExecucaoDuravelDoContexto(runContext);
            if (!durableExecutionId) return JSON.stringify({ success: false, reasonCode: 'TRUSTED_REQUEST_ID_REQUIRED' });

            // 1. Resolver leadId a partir do contatoId
            const contato = await prisma.lead.findUnique({
                where: { id: args.contatoId },
                select: { id: true, nome: true, email: true, campanhaOrigemId: true }
            });

            if (!contato) {
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            const leadId = contato.id;
            console.log(`[TOOL] agendar_reuniao_closer - LeadId resolvido: ${leadId}`);

            // 2. Resolver a data a partir da mensagem inbound confiável. Quando o
            // modelo transforma "amanhã" em uma data errada, a evidência original
            // prevalece sobre o argumento gerado pelo LLM.
            const temporal = interpretarAgendamentoTemporal({
                mensagemAtual: runContext?.context?.mensagemAtual,
                dataHoraArgumento: args.dataHora,
                timezone: 'America/Sao_Paulo',
            });
            if (!temporal.ok) {
                return JSON.stringify({ success: false, error: 'Data ou hora inválida/ambígua. Confirme novamente com o lead.', reasonCode: temporal.reasonCode });
            }
            const agendadoPara = temporal.utc;
            const dataHoraConfirmada = temporal.dataHoraLocal;

            const tenantId = resolverTenantIdDoContexto(runContext)!;
            const especialista = contato.campanhaOrigemId
                ? await resolverEspecialistaCampanha({ tenantId, campanhaId: contato.campanhaOrigemId })
                : null;
            if (!especialista) {
                return JSON.stringify({
                    success: false,
                    reasonCode: 'SPECIALIST_NOT_CONFIGURED',
                    error: 'Nenhum especialista ativo está configurado para esta campanha. Não confirme o agendamento ainda.'
                });
            }

            // Valida o estado antes de qualquer efeito externo no Google Calendar.
            // A transação abaixo repete a checagem com compare-and-set para impedir
            // corrida entre a validação e a persistência local.
            const estadoAgenda = await prisma.lead.findFirst({
                where: { id: leadId, tenantId },
                select: { status: true }
            });
            if (!estadoAgenda) {
                return JSON.stringify({ success: false, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
            }
            if (!['NOVO', 'TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA'].includes(estadoAgenda.status)) {
                return JSON.stringify({ success: false, reasonCode: 'STATE_TRANSITION_DENIED' });
            }

            // 3. Tentar Google Calendar (se configurado)
            let linkReuniao: string | null = null;
            let eventoGoogleId: string | null = null;
            let usouGoogleCalendar = false;

            try {
                const { googleCalendarService } = require('../servicos/google-calendar');

                if (googleCalendarService.isConfigurado()) {
                    // 3a. Verificar disponibilidade
                    const { disponivel, conflito } = await googleCalendarService.verificarDisponibilidade(agendadoPara);

                    if (!disponivel) {
                        console.log(`[TOOL] agendar_reuniao_closer - Horário OCUPADO: ${conflito}`);

                        // Buscar alternativas próximas
                        const diaInicio = new Date(agendadoPara);
                        diaInicio.setHours(8, 0, 0, 0);
                        const diaFim = new Date(agendadoPara);
                        diaFim.setDate(diaFim.getDate() + 3); // próximos 3 dias

                        const slotsLivres = await googleCalendarService.consultarSlotsLivres({
                            dataInicio: diaInicio,
                            dataFim: diaFim,
                        });

                        const alternativasTexto = googleCalendarService.formatarSlotsParaWhatsApp(slotsLivres, 4);

                        return JSON.stringify({
                            success: false,
                            disponivel: false,
                            conflito,
                            alternativas: alternativasTexto,
                            mensagem: `⚠️ Esse horário (${dataHoraConfirmada}) já está ocupado. Sugira ao lead os seguintes horários disponíveis:\n\n${alternativasTexto}`
                        });
                    }

                    // 3b. Criar evento real com Google Meet
                    const participantes: string[] = [];
                    if (contato.email) participantes.push(contato.email);
                    if (especialista.email && !participantes.includes(especialista.email)) participantes.push(especialista.email);

                    const evento = await googleCalendarService.criarEventoComMeet({
                    titulo: `Atendimento ${contato.nome || 'Lead'} com ${especialista.nome} — Elyon`,
                    descricao: `Atendimento agendado via WhatsApp (Elyon AI). Especialista: ${especialista.nome}.`,
                        dataHoraInicio: agendadoPara,
                        participantes,
                        observacoesCloser: args.observacoesCloser,
                        leadNome: contato.nome || undefined,
                        leadId,
                    });

                    linkReuniao = evento.linkMeet;
                    eventoGoogleId = evento.eventoId;
                    usouGoogleCalendar = true;

                    console.log(`[TOOL] agendar_reuniao_closer - ✅ Google Calendar: evento ${eventoGoogleId}, Meet: ${linkReuniao}`);
                }
            } catch (gcalError: any) {
                // Falha no Google Calendar não é fatal — fallback para registro local
                console.warn(`[TOOL] agendar_reuniao_closer - Google Calendar indisponível (fallback local): ${gcalError.message}`);
            }

            // 4. Sem Google Calendar, não gerar links sintéticos/falsos.
            // Se não houver integração ativa, o agendamento fica registrado localmente
            // e o atendimento deve ocorrer por WhatsApp ou canal alinhado com o cliente.

            // 5. Registrar como atividade no lead (sempre — banco local)
            // Se já existir um agendamento pendente futuro, REAGENDA a mesma atividade
            // para evitar "confirmar no WhatsApp e não refletir no sistema".
            const agora = new Date();
            const atividadeAberta = await prisma.atividade.findFirst({
                where: {
                    leadId,
                    tipo: 'REUNIAO',
                    completadoEm: null,
                    statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
                    agendadoPara: { gte: agora }
                },
                orderBy: { agendadoPara: 'asc' },
                select: { id: true, agendadoPara: true, titulo: true, versao: true }
            });

            const descricaoAtividade = [
                `Data/Hora: ${dataHoraConfirmada}`,
                `Modalidade: ${args.modalidade}`,
                `Especialista: ${especialista.nome} (${especialista.origem})`,
                linkReuniao ? `Link: ${linkReuniao}` : 'Link: sem link automático (Google Calendar indisponível)',
                eventoGoogleId ? `Google Event ID: ${eventoGoogleId}` : '',
                usouGoogleCalendar ? '✅ Sincronizado com Google Calendar' : '⚠️ Apenas registro local (Google Calendar não configurado)',
                args.observacoesCloser ? `Contexto: ${args.observacoesCloser}` : ''
            ].filter(Boolean).join(' | ');

            if (atividadeAberta) {
                const result = await executarComandoAgenda({
                    operacao: 'REAGENDAR', tenantId, leadId, atividadeId: atividadeAberta.id,
                    requestIdentity: { source: 'INBOUND_BATCH', id: `${durableExecutionId}:agenda-reschedule` },
                    ator: 'ai_agent', origem: 'TOOL_AGENDAR_REUNIAO', motivo: 'Novo horario confirmado pelo Lead',
                    policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION, ocorridoEm: new Date(),
                    expectedVersion: atividadeAberta.versao, novoHorario: agendadoPara,
                    novoTitulo: `Atendimento reagendado — ${dataHoraConfirmada}`, novaDescricao: descricaoAtividade,
                    responsavelId: especialista.usuarioId || undefined,
                });
                if (!result.success) return JSON.stringify({ success: false, reasonCode: result.reasonCode });
            } else {
                const criacaoLocal = await prisma.$transaction(async (tx: any) => {
                    const leadAtual = await tx.lead.findFirst({ where: { id: leadId, tenantId }, select: { status: true } });
                    if (!leadAtual) return { success: false as const, reasonCode: 'TENANT_OWNERSHIP_DENIED' };
                    if (!['NOVO', 'TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA'].includes(leadAtual.status)) {
                        return { success: false as const, reasonCode: 'STATE_TRANSITION_DENIED' };
                    }
                    const criada = await tx.atividade.create({ data: {
                        leadId,
                        tipo: 'REUNIAO',
                        titulo: `Atendimento agendado — ${dataHoraConfirmada}`,
                        descricao: descricaoAtividade,
                        criadoPor: 'ai_agent',
                        agendadoPara,
                        statusAgendamento: 'PENDENTE',
                        statusConfirmacaoCorretor: 'PENDENTE',
                        tokenConfirmacaoCorretor: crypto.randomUUID(),
                        corretorOriginalId: especialista.usuarioId || null,
                        corretorAtualId: especialista.usuarioId || null,
                    } });
                    const leadAtualizado = await tx.lead.updateMany({
                        where: { id: leadId, tenantId, status: leadAtual.status },
                        data: { status: 'VISITA_AGENDADA' }
                    });
                    if (leadAtualizado.count !== 1) throw new Error('LEAD_CONCURRENT_WRITE');
                    await tx.milestoneAgenda.create({ data: {
                        tenantId, leadId, atividadeId: criada.id, tipo: 'VISITA_AGENDADA', ator: 'ai_agent',
                        origem: 'TOOL_AGENDAR_REUNIAO', motivo: 'Horario confirmado pelo Lead', reasonCode: 'SCHEDULED',
                        ocorridoEm: new Date(), chaveIdempotencia: crypto.createHash('sha256').update(`agenda-scheduled:${durableExecutionId}`).digest('hex'),
                    } });
                    return { success: true as const, atividadeId: criada.id };
                });
                if (!criacaoLocal.success) {
                    return JSON.stringify({ success: false, reasonCode: criacaoLocal.reasonCode });
                }
            }

            await registrarExecucaoTool({
                leadId,
                toolName: 'agendar_reuniao_closer',
                sucesso: true,
                detalhes: `${atividadeAberta ? 'Reagendado' : 'Agendado'} para ${dataHoraConfirmada} via ${args.modalidade} com ${especialista.nome}${usouGoogleCalendar ? ' (Google Calendar)' : ' (local)'}`
            });

            const mensagemPendente = montarMensagemSolicitacaoLigacao({
                dataHora: dataHoraConfirmada,
                especialistaNome: especialista.nome,
            });
            const mensagem = `✅ Solicitação registrada, aguardando confirmação do especialista. Envie ao lead: "${mensagemPendente}"`;

            return JSON.stringify({
                success: true,
                disponivel: true,
                leadId,
                dataHora: dataHoraConfirmada,
                especialista: { nome: especialista.nome, cargo: especialista.cargo, origem: especialista.origem },
                modalidade: args.modalidade,
                linkReuniao,
                eventoGoogleId,
                googleCalendar: usouGoogleCalendar,
                mensagem
            });
    })
});

// ====================================
// TOOL 17: Consultar Status do Agendamento
// ====================================

export const consultarStatusAgendamentoTool = tool({
    name: 'consultar_status_agendamento',
    description: `Use SEMPRE que o lead perguntar se possui agendamento, se ele está ativo, confirmado, pendente ou cancelado, ou perguntar data, horário ou especialista do atendimento.

Esta tool consulta o estado atual no banco e não altera dados. NUNCA responda essas perguntas usando apenas o histórico da conversa.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato/lead informado no contexto do sistema'),
    }),

    execute: wrapToolExecute('consultar_status_agendamento', async (args, runContext?: any) => JSON.stringify(
        await consultarStatusAgendamentoCanonico({
            leadId: args.contatoId,
            tenantId: resolverTenantIdDoContexto(runContext),
        })
    )),
});

// ====================================
// TOOL 18: Cancelar Agendamento Ativo
// ====================================

export const cancelarAgendamentoTool = tool({
    name: 'cancelar_agendamento',
    description: `Use quando o lead pedir explicitamente para cancelar o agendamento atual.

Se o lead apenas perguntar se é possível cancelar, esclareça e confirme a intenção antes de chamar a tool.
Quando ele disser algo como "vamos cancelar", "pode cancelar" ou "não vou poder comparecer", chame esta tool imediatamente.

REGRA ABSOLUTA: nunca afirme que o agendamento foi cancelado antes de esta tool retornar success=true.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato/lead informado no contexto do sistema'),
        motivo: z.string().trim().max(500).nullable().describe('Motivo informado pelo lead; use "Solicitação do lead" quando ele não detalhar'),
    }),

    execute: wrapToolExecute('cancelar_agendamento', async (args, runContext?: any) => {
        const tenantId = resolverTenantIdDoContexto(runContext);
        const ownership = await validarOwnershipLeadPorTenant({
            leadId: args.contatoId,
            tenantId,
            toolName: 'cancelar_agendamento',
        });
        if (!ownership.ok) {
            return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });
        }

        const durableExecutionId = resolverExecucaoDuravelDoContexto(runContext);
        if (!durableExecutionId) {
            return JSON.stringify({ success: false, reasonCode: 'TRUSTED_REQUEST_ID_REQUIRED' });
        }

        const agora = new Date();
        const atividadeAtiva = await prisma.atividade.findFirst({
            where: {
                leadId: args.contatoId,
                tipo: { in: ['REUNIAO', 'AVALIACAO'] },
                completadoEm: null,
                statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
                agendadoPara: { gt: agora },
                lead: { tenantId },
            },
            orderBy: { agendadoPara: 'asc' },
            select: { id: true, versao: true, agendadoPara: true },
        });

        if (!atividadeAtiva) {
            const atividadeIniciada = await prisma.atividade.findFirst({
                where: {
                    leadId: args.contatoId,
                    tipo: { in: ['REUNIAO', 'AVALIACAO'] },
                    completadoEm: null,
                    statusAgendamento: { in: ['PENDENTE', 'CONFIRMADO'] },
                    agendadoPara: { lte: agora },
                    lead: { tenantId },
                },
                orderBy: { agendadoPara: 'desc' },
                select: { id: true, agendadoPara: true },
            });
            if (atividadeIniciada) {
                return JSON.stringify({
                    success: false,
                    reasonCode: 'APPOINTMENT_STARTED',
                    atividadeId: atividadeIniciada.id,
                    error: 'O horÃ¡rio desse atendimento jÃ¡ chegou ou passou. NÃ£o diga ao lead que ele foi cancelado; encaminhe para registrar o resultado ou para atendimento humano.',
                });
            }
            const atividadeCancelada = await prisma.atividade.findFirst({
                where: {
                    leadId: args.contatoId,
                    tipo: { in: ['REUNIAO', 'AVALIACAO'] },
                    statusAgendamento: 'CANCELADO',
                    lead: { tenantId },
                },
                orderBy: { canceladoEm: 'desc' },
                select: { id: true, canceladoEm: true },
            });
            if (atividadeCancelada) {
                return JSON.stringify({
                    success: true,
                    jaCancelado: true,
                    atividadeId: atividadeCancelada.id,
                    mensagem: 'O agendamento já estava cancelado no sistema. Informe isso ao lead sem prometer um novo horário.',
                });
            }
            return JSON.stringify({
                success: false,
                reasonCode: 'NO_ACTIVE_APPOINTMENT',
                error: 'Não existe agendamento ativo para cancelar. Não diga ao lead que houve cancelamento.',
            });
        }

        const motivo = args.motivo?.trim() || 'Solicitação do lead';
        const result = await executarComandoAgenda({
            operacao: 'CANCELAR',
            tenantId: tenantId!,
            leadId: args.contatoId,
            atividadeId: atividadeAtiva.id,
            requestIdentity: { source: 'INBOUND_BATCH', id: `${durableExecutionId}:agenda-cancel` },
            ator: 'ai_agent',
            origem: 'TOOL_CANCELAR_AGENDAMENTO',
            motivo,
            policyVersion: AGENDA_COMMERCIAL_POLICY_VERSION,
            ocorridoEm: new Date(),
            expectedVersion: atividadeAtiva.versao,
        });

        if (!result.success) {
            return JSON.stringify({
                success: false,
                reasonCode: result.reasonCode,
                error: 'Não foi possível cancelar o agendamento no sistema. Não confirme o cancelamento ao lead.',
            });
        }

        await registrarExecucaoTool({
            leadId: args.contatoId,
            toolName: 'cancelar_agendamento',
            sucesso: true,
            detalhes: `Agendamento ${atividadeAtiva.id} cancelado a pedido do lead`,
        });

        return JSON.stringify({
            success: true,
            jaCancelado: false,
            atividadeId: atividadeAtiva.id,
            statusAgendamento: 'CANCELADO',
            mensagem: 'Agendamento cancelado com sucesso no sistema. Confirme ao lead e informe que ele pode retornar quando quiser reagendar.',
        });
    }),
});

// ====================================
// TOOL 19: Enviar Link de Agendamento (Fallback)
// Quando o lead não decide horário na conversa.
// ====================================

export const enviarLinkAgendamentoTool = tool({
    name: 'enviar_link_agendamento',
    description: `Use APENAS quando o lead NÃO conseguir decidir um horário durante a conversa.

Exemplos de gatilho:
- "Preciso ver minha agenda"
- "Te respondo depois"
- "Não sei meu horário ainda"
- "Vou ver e te falo"

Esta tool só pode usar uma página de reservas rastreável. Um link de evento
pré-preenchido do Google Calendar NÃO reserva o horário do especialista e NÃO
pode ser apresentado como agendamento confirmado.

⚠️ NUNCA use esta tool se o lead já informou data/hora — nesse caso use agendar_reuniao_closer.
⚠️ SEMPRE tente primeiro definir o horário pela conversa. Esta tool é o ÚLTIMO RECURSO.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato'),
        observacoesCloser: z.string().nullable().describe('Contexto da conversa para o Closer')
    }),

    execute: wrapToolExecute('enviar_link_agendamento', async (args, runContext?: any) => {
            console.log(`[TOOL] enviar_link_agendamento - Contato ${args.contatoId}`);
            const ownership = await validarOwnershipLeadPorTenant({
                leadId: args.contatoId,
                tenantId: resolverTenantIdDoContexto(runContext),
                toolName: 'enviar_link_agendamento'
            });
            if (!ownership.ok) return JSON.stringify({ success: false, error: ownership.error, reasonCode: 'TENANT_OWNERSHIP_DENIED' });

            const mensagemAtual = runContext?.context?.mensagemAtual;
            if (mensagemContemDataHoraExplicita(mensagemAtual)) {
                return JSON.stringify({
                    success: false,
                    reasonCode: 'EXPLICIT_DATETIME_ALREADY_PROVIDED',
                    error: 'O lead já informou data e hora. Use agendar_reuniao_closer; não envie link de fallback.',
                    instrucaoParaAgente: 'Use agendar_reuniao_closer com a data e hora informadas na mensagem atual.'
                });
            }

            const contato = await prisma.lead.findUnique({
                where: { id: args.contatoId },
                select: { id: true, nome: true }
            });

            if (!contato) {
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            return JSON.stringify({
                success: false,
                reasonCode: 'TRACKABLE_BOOKING_LINK_UNAVAILABLE',
                error: 'Autoagendamento rastreável ainda não está configurado.',
                instrucaoParaAgente: 'NÃO envie link do Google Calendar e NÃO afirme que houve reserva. Pergunte qual dia e horário o lead prefere e use agendar_reuniao_closer.'
            });
    })
});
