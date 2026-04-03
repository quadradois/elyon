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
import { prisma } from '../lib/db';
import { buscarConfiguracaoTenant } from '../agentes/orchestrator';
import ContratoService from '../contratos/contrato-service';
import { ragConversasService } from '../servicos/rag-conversas';
import { randomUUID } from 'crypto';
import {
    ConverterParaLeadUseCase,
    AgendarAvaliacaoUseCase,
    MoverParaFaseUseCase,
    SalvarDadosImovelUseCase,
    AgendarFollowupUseCase,
    EncaminharCorretorUseCase,
    AtualizarDadosLeadUseCase,
    QualificarLeadUseCase,
    RegistrarOptoutUseCase
} from '../casos-de-uso/agentes';

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

function temTexto(valor?: string): boolean {
    return typeof valor === 'string' && valor.trim().length > 0;
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

    strict: false,
    parameters: {
        type: 'object',
        properties: {
            contatoId: { type: 'string', description: 'ID do contato no banco' },
            temperatura: { type: 'string', enum: ['FRIO', 'MORNO', 'QUENTE'], description: 'Temperatura do lead' },
            interesse: { type: 'string', description: 'O que quer: VENDER, ALUGAR, ou AMBOS' },
            timeline: { type: 'string', description: 'Quando pretende: "1-2 meses", "urgente", "6 meses+"' },
            observacoes: { type: 'string', description: 'Observações gerais livres sobre o lead (salvo em observacoesSpin)' },
            // Dados SPIN coletados na conversa
            // S - SITUAÇÃO
            situacaoAtual: { type: 'string', description: 'Situação atual: "10 corretores, 2 visitas em 60 dias"' },
            tempoDecisao: { type: 'string', description: 'Há quanto tempo decidiu vender: "decidiu há 3 meses"' },
            tentativasAnteriores: { type: 'string', description: 'O que já tentou: "tentou sozinho, OLX, 3 imobiliárias"' },
            comCorretorAtualmente: { type: 'boolean', description: 'true se já tem corretor(es) trabalhando o imóvel' },
            // P - PROBLEMA
            motivacaoVenda: { type: 'string', description: 'Por que quer vender/alugar: "mudança de cidade"' },
            doresIdentificadas: { type: 'string', description: 'Dores (separe por vírgula): "sem visitantes, propostas baixas, imóvel parado"' },
            // I - IMPLICAÇÃO
            consequencias: { type: 'string', description: 'Consequências de não vender: "pagando condomínio sem morar"' },
            custosAtuais: { type: 'string', description: 'Custos mensais atuais: "R$ 1.200/mês em condomínio + IPTU"' },
            pressaoTempo: { type: 'boolean', description: 'true se há pressão de tempo real (divórcio, dívida, transferência)' },
            // N - NECESSIDADE
            expectativaServico: { type: 'string', description: 'O que espera do corretor/consultoria' },
            objecoes: { type: 'string', description: 'Objeções levantadas (separe por vírgula): "não dou exclusividade, comissão alta"' },
            interesseAvaliacao: { type: 'boolean', description: 'true se o lead aceitou/demonstrou interesse em avaliação' },
            // Dados do imóvel
            enderecoImovel: { type: 'string', description: 'Endereço do imóvel' },
            tipoImovel: { type: 'string', description: 'apartamento, casa, comercial, terreno' },
            areaImovel: { type: 'string', description: 'Área em m²' },
            quartosImovel: { description: 'Número de quartos' },
            vagasImovel: { description: 'Vagas de garagem' },
            valorPretendido: { type: 'string', description: 'Valor pretendido' },
            ocupacaoImovel: { type: 'string', description: '"ocupado", "vazio" ou "alugado"' },
            // Qualificação adicional do imóvel
            estadoConservacao: { type: 'string', enum: ['excelente', 'bom', 'reforma'], description: 'Estado de conservação do imóvel: excelente, bom ou precisa de reforma' },
            situacaoFinanceira: { type: 'string', enum: ['quitado', 'financiado'], description: 'Imóvel quitado ou financiado' },
            temDividas: { type: 'boolean', description: 'true se o proprietário mencionou dívidas de IPTU ou condomínio em atraso' }
        },
        required: ['contatoId', 'temperatura', 'interesse', 'timeline']
    } as any,

    execute: async (args: any) => {
        const useCase = new QualificarLeadUseCase();
        const input: any = { ...args };
        if (typeof args.doresIdentificadas === 'string') {
            input.doresIdentificadas = args.doresIdentificadas.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
        if (typeof args.objecoes === 'string') {
            input.objecoes = args.objecoes.split(',').map((o: string) => o.trim()).filter((o: string) => o);
        }
        // Tratar numbers vindos como strings dos LLMs
        if (input.quartosImovel && typeof input.quartosImovel === 'string') input.quartosImovel = parseInt(input.quartosImovel, 10) || undefined;
        if (input.vagasImovel && typeof input.vagasImovel === 'string') input.vagasImovel = parseInt(input.vagasImovel, 10) || undefined;

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
    }
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

    execute: async (args) => {
        const useCase = new RegistrarOptoutUseCase();
        const result = await useCase.execute({
            contatoId: args.contatoId,
            motivo: args.motivo
        });
        return JSON.stringify(result);
    }
});

// ====================================
// TOOL 3: Converter para Lead
// ====================================

export const converterParaLeadTool = tool({
    name: 'converter_para_lead',
    description: `Use quando o proprietário demonstrar interesse REAL em vender ou alugar.
Deve ter coletado: tipo de interesse, timeline, dados básicos.

IMPORTANTE: Passe TODOS os dados coletados na conversa! Tipo de imóvel, quartos, metragem, valor, motivação, situação atual. Tudo será salvo automaticamente no lead do kanban.`,

    strict: false,
    parameters: {
        type: 'object',
        properties: {
            contatoId: { type: 'string', description: 'ID do contato que será convertido' },
            temperatura: { type: 'string', enum: ['MORNO', 'QUENTE'], description: 'QUENTE: urgência, MORNO: interesse sem pressa' },
            tipoInteresse: { type: 'string', enum: ['VENDA', 'LOCACAO', 'AMBOS'], description: 'O que quer fazer' },
            timeline: { type: 'string', description: 'Quando: "1 mês", "urgente", "sem pressa"' },
            // Dados do imóvel coletados na conversa
            enderecoImovel: { type: 'string', description: 'Endereço do imóvel' },
            tipoImovel: { type: 'string', description: 'apartamento, casa, terreno' },
            areaImovel: { type: 'string', description: 'Área m²' },
            quartosImovel: { description: 'Número de quartos' },
            vagasImovel: { description: 'Vagas de garagem' },
            valorPretendido: { type: 'string', description: 'Valor pretendido' },
            ocupacaoImovel: { type: 'string', description: '"ocupado", "vazio", "alugado"' },
            // Qualificação SPIN
            motivacaoVenda: { type: 'string', description: 'Motivação' },
            situacaoAtual: { type: 'string', description: 'Situação atual' },
            prazoDesejado: { type: 'string', description: 'Prazo para venda' },
            doresIdentificadas: { type: 'string', description: 'Dores (separadas por vírgula)' }
        },
        required: ['contatoId', 'temperatura', 'tipoInteresse', 'timeline']
    } as any,

    execute: async (args: any) => {
        const useCase = new ConverterParaLeadUseCase();
        const input: any = { ...args };
        if (typeof args.doresIdentificadas === 'string') {
            input.doresIdentificadas = args.doresIdentificadas.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
        // Tratar numbers vindos como strings
        if (input.quartosImovel && typeof input.quartosImovel === 'string') input.quartosImovel = parseInt(input.quartosImovel, 10) || undefined;
        if (input.vagasImovel && typeof input.vagasImovel === 'string') input.vagasImovel = parseInt(input.vagasImovel, 10) || undefined;

        const result = await useCase.execute(input);
        await registrarExecucaoTool({
            leadId: result?.leadId,
            toolName: 'converter_para_lead',
            sucesso: !!result?.success,
            detalhes: result?.message || result?.error
        });
        return JSON.stringify(result);
    }
});

// ====================================
// TOOL 4: Agendar Avaliação
// ====================================

export const agendarAvaliacaoTool = tool({
    name: 'agendar_avaliacao',
    description: `Agenda visita de avaliação quando proprietário concordar.
A data/hora DEVE ser confirmada na conversa ANTES de usar!`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato'),
        dataAvaliacao: z.string().describe('Data/hora: "DD/MM/YYYY HH:mm"')
    }),

    execute: async (args) => {
        const useCase = new AgendarAvaliacaoUseCase();
        const result = await useCase.execute({
            contatoId: args.contatoId,
            dataAvaliacao: args.dataAvaliacao
        });

        await registrarExecucaoTool({
            leadId: result?.leadId,
            toolName: 'agendar_avaliacao',
            sucesso: !!result?.success,
            detalhes: result?.message || result?.error
        });

        return JSON.stringify(result);
    }
});

// ====================================
// TOOL 5: Agendar Follow-up
// ====================================

export const agendarFollowupTool = tool({
    name: 'agendar_followup',
    description: `Use quando proprietário demonstrar interesse mas NÃO quer agora.
Exemplos: "talvez próximo ano", "vou pensar", "agora não"`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato'),
        dataRecontato: z.string().describe('Data: "DD/MM/YYYY"'),
        motivo: z.string().describe('Por que não quer agora')
    }),

    execute: async (args) => {
        const useCase = new AgendarFollowupUseCase();
        const result = await useCase.execute({
            contatoId: args.contatoId,
            dataRecontato: args.dataRecontato,
            motivo: args.motivo
        });
        return JSON.stringify(result);
    }
});

// ====================================
// TOOL 7: Encaminhar para Corretor
// ====================================

export const encaminharCorretorTool = tool({
    name: 'encaminhar_corretor',
    description: `USAR APENAS quando proprietário pedir EXPLICITAMENTE para falar com humano.
NÃO use para perguntas sobre valor - responda você mesmo!`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato'),
        motivo: z.string().describe('Deve ser: "proprietário solicitou corretor"'),
        contextoConversa: z.string().describe('Resumo da conversa'),
        urgencia: z.enum(['NORMAL', 'ALTA']).describe('ALTA se interesse/urgência')
    }),

    execute: async (args) => {
        const useCase = new EncaminharCorretorUseCase();
        const result = await useCase.execute({
            contatoId: args.contatoId,
            motivo: args.motivo,
            contextoConversa: args.contextoConversa,
            urgencia: args.urgencia
        });
        return JSON.stringify(result);
    }
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
        dadosAdicionais: z.object({
            tipoAutorizacao: z.enum(['exclusiva', 'simples']).nullable().describe('Tipo de autorização acordada (ou null se não houver)'),
            prazoTrabalho: z.number().nullable().describe('Prazo em dias (ou null)'),
            comissaoAcordada: z.string().nullable().describe('Comissão (ou null)'),
            autorizouAnuncio: z.boolean().nullable().describe('Cliente autorizou publicar anúncio do imóvel? (ou null se não discutido)')
        }).nullable().describe('Dados do acordo (obrigatório passar objeto ou null)')
    }),

    execute: async (args) => {
        const useCase = new MoverParaFaseUseCase();
        const result = await useCase.execute({
            leadId: args.leadId,
            faseDestino: args.faseDestino,
            motivo: args.motivo,
            dadosAdicionais: args.dadosAdicionais
        });

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'mover_para_fase',
            sucesso: !!result?.success,
            detalhes: result?.motivo || result?.error
        });

        return JSON.stringify(result);
    }
});

export const gerarLinkContratoTool = tool({
    name: 'gerar_link_contrato',
    description: 'gera um link único para o proprietário assinar a autorização de venda (contrato). Retorna a URL para enviar ao cliente.',
    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        tipoContrato: z.enum(['CAPTACAO']).default('CAPTACAO').describe('Tipo do contrato')
    }),
    execute: async (args) => {
        try {
            console.log(`[TOOL] gerar_link_contrato - Lead ${args.leadId}`);

            // Buscar tenantId do lead
            const lead = await prisma.lead.findUnique({
                where: { id: args.leadId },
                include: { tenant: true }
            });

            if (!lead) {
                return JSON.stringify({ success: false, error: 'Lead não encontrado' });
            }

            // Gerar contrato usando o service
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

        } catch (error: any) {
            console.error('[TOOL] Erro ao gerar contrato:', error);
            await registrarExecucaoTool({
                leadId: args.leadId,
                toolName: 'gerar_link_contrato',
                sucesso: false,
                detalhes: error?.message || 'Erro ao gerar link'
            });
            // Se já existir, tentar recuperar (lógica simplificada: retornar erro e pedir para usar o existente)
            // Mas o create do ContratoService lança erro se pendente.
            // Idealmente retornaríamos o link existente se o erro for "pendente".
            // Para MVP, vamos retornar o erro.
            return JSON.stringify({
                success: false,
                error: error.message || 'Erro ao gerar link do contrato'
            });
        }
    }
});

export const atualizarDadosLeadTool = tool({
    name: 'atualizar_dados_lead',
    description: 'Atualiza dados cadastrais do lead (CPF, endereço, email, etc). Use sempre que o lead fornecer essas informações.',
    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        cpf: z.string().nullable().describe('CPF do cliente (apenas números)'),
        email: z.string().email().nullable().describe('Email do cliente'),
        endereco: z.string().nullable().describe('Endereço completo do imóvel'),
        nome: z.string().nullable().describe('Nome completo do cliente')
    }),
    execute: async (args) => {
        const useCase = new AtualizarDadosLeadUseCase();
        const result = await useCase.execute({
            leadId: args.leadId,
            cpf: args.cpf,
            email: args.email,
            endereco: args.endereco,
            nome: args.nome
        });

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'atualizar_dados_lead',
            sucesso: !!result?.success,
            detalhes: result?.mensagem || result?.error
        });

        return JSON.stringify(result);
    }
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

    execute: async (args) => {
        const useCase = new SalvarDadosImovelUseCase();
        const result = await useCase.execute(args);

        await registrarExecucaoTool({
            leadId: args.leadId,
            toolName: 'salvar_dados_imovel',
            sucesso: !!result?.success,
            detalhes: result?.message || result?.error
        });

        return JSON.stringify(result);
    }
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
        leadId: z.string().describe('ID do lead a enviar')
    }),

    execute: async (args) => {
        try {
            console.log(`[TOOL] enviar_para_crm - Lead ${args.leadId}`);

            // Verificar se lead tem dados mínimos
            const lead = await prisma.lead.findUnique({
                where: { id: args.leadId }
            });

            if (!lead) {
                return JSON.stringify({
                    success: false,
                    error: 'Lead não encontrado'
                });
            }

            if (lead.status !== 'CAPTADO') {
                return JSON.stringify({
                    success: false,
                    error: `Lead ainda não está CAPTADO (status atual: ${lead.status}). Finalize o onboarding primeiro.`
                });
            }

            if (!lead.tipoImovel && !lead.quartosImovel) {
                return JSON.stringify({
                    success: false,
                    error: 'Dados do imóvel incompletos. Colete tipo e características antes de enviar.'
                });
            }

            // Enviar para CRM
            const resultado = await enviarParaCrm(args.leadId);

            if (resultado.success) {
                console.log(`[TOOL] enviar_para_crm - Sucesso! PropertyCode: ${resultado.property_code}`);
                return JSON.stringify({
                    success: true,
                    crmPropertyId: resultado.property_id,
                    crmPropertyCode: resultado.property_code,
                    message: `✅ Enviado para CRM! Código: ${resultado.property_code}`
                });
            } else {
                return JSON.stringify({
                    success: false,
                    error: resultado.error || 'Falha ao enviar para CRM'
                });
            }

        } catch (error: any) {
            console.error('[TOOL] enviar_para_crm - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error.message || 'Erro ao enviar para CRM'
            });
        }
    }
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

    execute: async (args) => {
        try {
            console.log(`[TOOL] registrar_indicacao - Origem: ${args.contatoOrigemId} → Indicado: ${args.nomeIndicado} (${args.telefoneIndicado})`);

            // Buscar dados do contato que indicou
            const contatoOrigem = await prisma.contato.findUnique({
                where: { id: args.contatoOrigemId },
                select: { nome: true, campanhaId: true }
            });

            const campanhaId = args.campanhaId || contatoOrigem?.campanhaId;
            if (!campanhaId) {
                return JSON.stringify({ success: false, error: 'Campanha não encontrada' });
            }

            // Limpar telefone
            const telefone = args.telefoneIndicado.replace(/\D/g, '');

            // Verificar se já existe contato com esse telefone na campanha
            const existente = await prisma.contato.findFirst({
                where: { campanhaId, telefone: { contains: telefone.slice(-8) } }
            });

            if (existente) {
                return JSON.stringify({
                    success: true,
                    jaExistia: true,
                    contatoId: existente.id,
                    mensagem: `Contato já existe na campanha: ${existente.nome}`
                });
            }

            // Criar novo contato
            const novoContato = await prisma.contato.create({
                data: {
                    campanhaId,
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

        } catch (error: any) {
            console.error('[TOOL] registrar_indicacao - Erro:', error);
            return JSON.stringify({ success: false, error: error.message });
        }
    }
});

// ====================================
// TOOL 16: Agendar Reunião com Closer Humano
// ====================================

export const agendarReuniaoCloserTool = tool({
    name: 'agendar_reuniao_closer',
    description: `🚨 CHAME ESTA TOOL IMEDIATAMENTE quando o lead mencionar qualquer data e horário para reunião.

GATILHO OBRIGATÓRIO: Se o lead disse qualquer coisa como "pode ser dia X às YH", "dia X às Y horas", "03/04 às 17h", "amanhã às 14h" — CHAME ESTA TOOL AGORA antes de responder qualquer texto.

NÃO confirme a reunião em texto sem chamar esta tool primeiro. A confirmação textual só deve vir DEPOIS da tool retornar success=true.

FORMATO da data: "DD/MM/YYYY HH:mm" — Se o lead não informou o ano, use o ano atual (2026).

⚠️ NUNCA substitua a chamada desta tool por uma confirmação textual. Se não chamar a tool, o agendamento NÃO será registrado no sistema.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato (mesmo usado nas outras tools)'),
        dataHora: z.string().describe('Data e hora confirmada: "DD/MM/YYYY HH:mm"'),
        modalidade: z.enum(['google_meet', 'whatsapp_video', 'zoom']).default('google_meet').describe('Tipo de reunião virtual'),
        observacoesCloser: z.string().optional().describe('Contexto da conversa para o Closer: dores identificadas, interesse, objeções')
    }),

    execute: async (args) => {
        try {
            console.log(`[TOOL] agendar_reuniao_closer - Contato ${args.contatoId} - ${args.dataHora}`);

            // Resolver leadId a partir do contatoId (o LLM sempre conhece o contatoId)
            const contato = await prisma.contato.findUnique({
                where: { id: args.contatoId },
                select: { id: true, leadId: true, nome: true }
            });

            if (!contato) {
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            if (!contato.leadId) {
                return JSON.stringify({ success: false, error: 'Contato ainda não convertido em lead. Use converter_para_lead antes de agendar.' });
            }

            const leadId = contato.leadId;
            console.log(`[TOOL] agendar_reuniao_closer - LeadId resolvido: ${leadId}`);

            // Parse data "DD/MM/YYYY HH:mm"
            let agendadoPara: Date | null = null;
            try {
                const [dataParte, horaParte] = args.dataHora.split(' ');
                if (dataParte) {
                    const [dia, mes, ano] = dataParte.split('/').map(Number);
                    if (dia && mes && ano) {
                        const [hora, minuto] = (horaParte || '10:00').split(':').map(Number);
                        agendadoPara = new Date(ano, mes - 1, dia, hora || 10, minuto || 0);
                    }
                }
            } catch (e) {
                console.warn('[TOOL] agendar_reuniao_closer - Erro no parse da data:', e);
            }

            // Gerar link simulável (MVP): usar Google Meet com código baseado no leadId
            // TODO: integrar com Google Calendar API ou Calendly webhook para link real
            const meetCode = `elyon-${leadId.substring(0, 8)}`;
            const linkReuniao = args.modalidade === 'google_meet'
                ? `https://meet.google.com/${meetCode}`
                : args.modalidade === 'zoom'
                ? `https://zoom.us/j/${meetCode}`
                : null; // whatsapp_video: sem link prévio

            // Registrar como atividade no lead
            await prisma.atividade.create({
                data: {
                    leadId,
                    tipo: 'REUNIAO',
                    titulo: `Reunião com Closer — ${args.dataHora}`,
                    descricao: [
                        `Data/Hora: ${args.dataHora}`,
                        `Modalidade: ${args.modalidade}`,
                        linkReuniao ? `Link: ${linkReuniao}` : 'Link: WhatsApp Video (sem link prévio)',
                        args.observacoesCloser ? `Contexto: ${args.observacoesCloser}` : ''
                    ].filter(Boolean).join(' | '),
                    criadoPor: 'ai_agent',
                    agendadoPara: agendadoPara || undefined,
                    statusAgendamento: agendadoPara ? 'PENDENTE' : undefined
                }
            });

            await registrarExecucaoTool({
                leadId,
                toolName: 'agendar_reuniao_closer',
                sucesso: true,
                detalhes: `Agendado para ${args.dataHora} via ${args.modalidade}`
            });

            const mensagem = linkReuniao
                ? `✅ Reunião agendada! Envie ao lead: "Ótimo! Nossa conversa está marcada para ${args.dataHora}. Aqui está o link: ${linkReuniao} 😊"`
                : `✅ Reunião agendada! Nosso consultor entrará em contato pelo WhatsApp no dia ${args.dataHora}.`;

            return JSON.stringify({
                success: true,
                leadId,
                contatoId: args.contatoId,
                dataHora: args.dataHora,
                modalidade: args.modalidade,
                linkReuniao,
                mensagem
            });

        } catch (error: any) {
            console.error('[TOOL] agendar_reuniao_closer - Erro:', error);
            await registrarExecucaoTool({
                toolName: 'agendar_reuniao_closer',
                sucesso: false,
                detalhes: error?.message || 'Erro ao agendar'
            });
            return JSON.stringify({ success: false, error: error.message || 'Erro ao agendar reunião' });
        }
    }
});




