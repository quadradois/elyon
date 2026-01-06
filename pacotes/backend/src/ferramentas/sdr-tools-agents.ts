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

// ====================================
// TOOL 1: Qualificar Lead
// ====================================

export const qualificarLeadTool = tool({
    name: 'qualificar_lead',
    description: `Use após coletar informações na conversa para qualificar o lead.
  
Classifique como:
- QUENTE: urgência alta + timeline ≤ 3 meses + sem corretor
- MORNO: interesse genuíno mas sem urgência imediata
- FRIO: sem interesse real ou timeline muito longo (>6 meses)`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato no banco'),
        temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).describe('Temperatura do lead'),
        interesse: z.string().describe('O que quer: VENDER, ALUGAR, ou AMBOS'),
        timeline: z.string().describe('Quando pretende: "1-2 meses", "urgente", "6 meses+"'),
        observacoes: z.string().describe('Detalhes adicionais como tipo de imóvel, quartos, valor pretendido, motivação')
    }),


    execute: async (args) => {
        try {
            const db: any = prisma;

            let leadId = undefined;
            let leadCriado = false;

            // Buscar contato
            const contato = await db.contato.findUnique({
                where: { id: args.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            // Se contato já tem Lead, usar esse ID
            if (contato.leadId) {
                leadId = contato.leadId;
            } else {
                // Criar novo Lead
                const novoLead = await db.lead.create({
                    data: {
                        tenantId: contato.campanha.tenantId,
                        nome: contato.nome,
                        telefone: contato.telefone,
                        email: contato.email,
                        cpf: contato.cpf,
                        enderecoPrincipal: contato.enderecoImovel || contato.endereco,
                        origem: 'prospeccao_ativa',
                        campanhaOrigemId: contato.campanhaId,
                        status: 'QUALIFICADO',
                        temperatura: args.temperatura,
                        estagio: 'qualificado_sdr',
                        primeiroContato: contato.criadoEm,
                        ultimaInteracao: new Date()
                    }
                });

                leadId = novoLead.id;
                leadCriado = true;

                await db.contato.update({
                    where: { id: args.contatoId },
                    data: {
                        virouLead: true,
                        leadId: novoLead.id,
                        virouLeadEm: new Date(),
                        statusProspeccao: 'LEAD',
                        manifestouInteresse: true
                    }
                });
            }

            // Atualizar lead
            await db.lead.update({
                where: { id: leadId },
                data: {
                    temperatura: args.temperatura,
                    status: 'QUALIFICADO',
                    ultimaInteracao: new Date(),
                    interesseEm: args.interesse
                }
            });

            // Registrar atividade
            await db.atividade.create({
                data: {
                    leadId: leadId,
                    tipo: 'NOTA',
                    titulo: `Lead qualificado como ${args.temperatura}`,
                    descricao: `Interesse: ${args.interesse}\nTimeline: ${args.timeline}${args.observacoes ? `\nObs: ${args.observacoes}` : ''}`,
                    criadoPor: 'ai_agent',
                    completadoEm: new Date()
                }
            });

            console.log(`[TOOL] qualificar_lead - Lead ${args.temperatura} qualificado`);

            return JSON.stringify({
                success: true,
                leadId,
                leadCriado,
                temperatura: args.temperatura,
                message: `Lead ${leadCriado ? 'criado e ' : ''}qualificado como ${args.temperatura}`
            });
        } catch (error) {
            console.error('[TOOL] qualificar_lead - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao qualificar lead'
            });
        }
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
        try {
            console.log(`[TOOL] registrar_optout - Contato ${args.contatoId}`);

            // Tentar como Contato
            try {
                await prisma.contato.update({
                    where: { id: args.contatoId },
                    data: {
                        statusProspeccao: 'OPTOUT',
                        motivoDesinteresse: args.motivo,
                        observacoes: `Opt-out: ${args.motivo}`,
                        atualizadoEm: new Date()
                    }
                });
            } catch {
                // Tentar como Lead
                await prisma.lead.update({
                    where: { id: args.contatoId },
                    data: {
                        status: 'PERDIDO',
                        ultimaInteracao: new Date()
                    }
                });
            }

            // Encerrar conversa ativa
            await prisma.conversa.updateMany({
                where: { leadId: args.contatoId, estadoConversa: 'ativa' },
                data: { estadoConversa: 'concluida', finalizadaEm: new Date() }
            });

            console.log(`[TOOL] registrar_optout - Sucesso!`);

            return JSON.stringify({
                success: true,
                message: 'Opt-out registrado. O contato não receberá mais mensagens.'
            });
        } catch (error) {
            console.error('[TOOL] registrar_optout - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao registrar opt-out'
            });
        }
    }
});

// ====================================
// TOOL 3: Converter para Lead
// ====================================

export const converterParaLeadTool = tool({
    name: 'converter_para_lead',
    description: `Use quando o proprietário demonstrar interesse REAL em vender ou alugar.
Deve ter coletado: tipo de interesse, timeline, dados básicos.`,

    parameters: z.object({
        contatoId: z.string().describe('ID do contato que será convertido'),
        temperatura: z.enum(['MORNO', 'QUENTE']).describe('QUENTE: urgência, MORNO: interesse sem pressa'),
        tipoInteresse: z.enum(['VENDA', 'LOCACAO', 'AMBOS']).describe('O que quer fazer'),
        timeline: z.string().describe('Quando: "1 mês", "urgente", "sem pressa"')
    }),

    execute: async (args) => {
        try {
            console.log(`[TOOL] converter_para_lead - Contato ${args.contatoId}`);

            const contato = await prisma.contato.findUnique({
                where: { id: args.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            if (contato.virouLead) {
                return JSON.stringify({ success: false, error: 'Contato já é lead', leadId: contato.leadId });
            }

            // Criar Lead
            const novoLead = await prisma.lead.create({
                data: {
                    tenantId: contato.campanha.tenantId,
                    nome: contato.nome,
                    telefone: contato.telefone,
                    email: contato.email,
                    cpf: contato.cpf,
                    enderecoPrincipal: contato.endereco,
                    origem: 'prospeccao_ativa',
                    campanhaOrigemId: contato.campanhaId,
                    status: 'NOVO',
                    temperatura: args.temperatura,
                    estagio: 'qualificado_sdr',
                    primeiroContato: contato.criadoEm,
                    ultimaInteracao: new Date()
                }
            });

            // Atualizar Contato
            await prisma.contato.update({
                where: { id: args.contatoId },
                data: {
                    virouLead: true,
                    leadId: novoLead.id,
                    virouLeadEm: new Date(),
                    statusProspeccao: 'LEAD',
                    manifestouInteresse: true
                }
            });

            // Registrar atividade
            await prisma.atividade.create({
                data: {
                    leadId: novoLead.id,
                    tipo: 'NOTA',
                    titulo: '🎯 Lead qualificado via prospecção ativa',
                    descricao: `Interesse: ${args.tipoInteresse}\nTimeline: ${args.timeline}\nTemperatura: ${args.temperatura}`,
                    criadoPor: 'sdr_ia',
                    completadoEm: new Date()
                }
            });

            // Se QUENTE, criar tarefa urgente
            if (args.temperatura === 'QUENTE') {
                await prisma.atividade.create({
                    data: {
                        leadId: novoLead.id,
                        tipo: 'TAREFA',
                        titulo: '🔥 URGENTE: Contato com lead quente!',
                        descricao: `Timeline: ${args.timeline}\nEntrar em contato o mais rápido possível!`,
                        criadoPor: 'sdr_ia'
                    }
                });
            }

            // RAG (background)
            ragConversasService.processarConversaoProspeccao({
                contatoId: args.contatoId,
                tenantId: contato.campanha.tenantId,
                tipoConversao: 'LEAD',
                empreendimento: contato.nomeEdificio || undefined
            }).catch(err => console.error('[RAG] Erro:', err));

            console.log(`[TOOL] converter_para_lead - Lead ${novoLead.id} criado`);

            return JSON.stringify({
                success: true,
                leadId: novoLead.id,
                temperatura: args.temperatura,
                message: `Proprietário convertido em lead ${args.temperatura}!`
            });
        } catch (error) {
            console.error('[TOOL] converter_para_lead - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao converter'
            });
        }
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
        try {
            console.log(`[TOOL] agendar_avaliacao - ID: ${args.contatoId}`);

            // Tentar buscar como Contato primeiro
            let contato = await prisma.contato.findUnique({
                where: { id: args.contatoId },
                include: { campanha: true }
            });

            // Se não encontrar como contato, pode ser um leadId - buscar contato pelo leadId
            if (!contato) {
                console.log(`[TOOL] agendar_avaliacao - Não é contato, buscando por leadId...`);
                contato = await prisma.contato.findFirst({
                    where: { leadId: args.contatoId },
                    include: { campanha: true }
                });
            }

            if (!contato) {
                console.log(`[TOOL] agendar_avaliacao - ERRO: Contato não encontrado para ID ${args.contatoId}`);
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            // Parsear data - aceita formatos variados
            let dataAgendamento: Date;
            const dataStr = args.dataAvaliacao.toLowerCase();

            // Detectar "amanhã" ou "hoje"
            const hoje = new Date();
            if (dataStr.includes('amanhã') || dataStr.includes('amanha')) {
                dataAgendamento = new Date(hoje);
                dataAgendamento.setDate(dataAgendamento.getDate() + 1);
                // Extrair hora se presente (ex: "amanhã às 10:00")
                const horaMatch = dataStr.match(/(\d{1,2})[:\s]*(\d{2})?/);
                if (horaMatch) {
                    dataAgendamento.setHours(parseInt(horaMatch[1]), parseInt(horaMatch[2] || '0'), 0, 0);
                } else {
                    dataAgendamento.setHours(10, 0, 0, 0); // Default 10:00
                }
            } else if (dataStr.includes('hoje')) {
                dataAgendamento = new Date(hoje);
                const horaMatch = dataStr.match(/(\d{1,2})[:\s]*(\d{2})?/);
                if (horaMatch) {
                    dataAgendamento.setHours(parseInt(horaMatch[1]), parseInt(horaMatch[2] || '0'), 0, 0);
                } else {
                    dataAgendamento.setHours(14, 0, 0, 0); // Default 14:00
                }
            } else {
                // Formato DD/MM/YYYY HH:mm
                const [dataParte, horaParte] = args.dataAvaliacao.split(' ');
                const [dia, mes, ano] = dataParte.split('/').map(Number);
                const [hora, minuto] = (horaParte || '10:00').split(':').map(Number);
                dataAgendamento = new Date(ano || hoje.getFullYear(), (mes || hoje.getMonth() + 1) - 1, dia || hoje.getDate(), hora || 10, minuto || 0);
            }

            if (isNaN(dataAgendamento.getTime())) {
                console.log(`[TOOL] agendar_avaliacao - ERRO: Data inválida: ${args.dataAvaliacao}`);
                return JSON.stringify({ success: false, error: 'Data inválida. Use DD/MM/YYYY HH:mm ou "amanhã às 10:00"' });
            }

            const tenantId = contato.campanha?.tenantId;
            if (!tenantId) {
                return JSON.stringify({ success: false, error: 'Campanha sem tenant' });
            }

            let leadId = contato.leadId;

            // Converter para Lead se necessário
            if (!contato.virouLead || !leadId) {
                const novoLead = await prisma.lead.create({
                    data: {
                        nome: contato.nome,
                        telefone: contato.telefone,
                        status: 'QUALIFICADO',
                        temperatura: 'QUENTE',
                        origem: 'PROSPECCAO_ATIVA',
                        tenantId,
                        cpf: contato.cpf
                    }
                });

                leadId = novoLead.id;

                await prisma.contato.update({
                    where: { id: args.contatoId },
                    data: { virouLead: true, leadId: novoLead.id, statusProspeccao: 'LEAD' }
                });
            }

            const db: any = prisma;
            const tokenConfirmacao = randomUUID();

            // Criar atividade de avaliação
            const atividade = await db.atividade.create({
                data: {
                    leadId: leadId!,
                    tipo: 'AVALIACAO',
                    titulo: `🏠 AVALIAÇÃO - ${contato.nome}`,
                    descricao: `📅 ${args.dataAvaliacao}\n📍 ${contato.enderecoImovel || 'Confirmar'}\n📞 ${contato.telefone}`,
                    criadoPor: 'sdr_agent',
                    agendadoPara: dataAgendamento,
                    statusAgendamento: 'PENDENTE',
                    tokenConfirmacao,
                    confirmacoesEnviadas: 0
                }
            });

            // Atualizar contato
            await prisma.contato.update({
                where: { id: args.contatoId },
                data: { statusProspeccao: 'INTERESSADO', observacoes: `Avaliação: ${args.dataAvaliacao}` }
            });

            // RAG (background)
            ragConversasService.processarConversaoProspeccao({
                contatoId: args.contatoId,
                tenantId,
                tipoConversao: 'AGENDAMENTO',
                empreendimento: contato.nomeEdificio || undefined
            }).catch(err => console.error('[RAG] Erro:', err));

            console.log(`[TOOL] agendar_avaliacao - Agendado para ${args.dataAvaliacao}`);

            return JSON.stringify({
                success: true,
                message: `Avaliação agendada para ${args.dataAvaliacao}`,
                leadId,
                atividadeId: atividade.id,
                dataAgendamento: dataAgendamento.toISOString()
            });
        } catch (error) {
            console.error('[TOOL] agendar_avaliacao - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao agendar'
            });
        }
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
        try {
            console.log(`[TOOL] agendar_followup - Contato ${args.contatoId}`);

            const [dia, mes, ano] = args.dataRecontato.split('/').map(Number);
            const dataAgendamento = new Date(ano, mes - 1, dia, 9, 0);

            if (isNaN(dataAgendamento.getTime())) {
                return JSON.stringify({ success: false, error: 'Data inválida. Use DD/MM/YYYY' });
            }

            await prisma.contato.update({
                where: { id: args.contatoId },
                data: {
                    statusProspeccao: 'MORNO_FUTURO',
                    dataRecontato: dataAgendamento,
                    motivoRecontato: args.motivo,
                    observacoes: `Futuro: ${args.motivo}`
                }
            });

            console.log(`[TOOL] agendar_followup - Recontato em ${args.dataRecontato}`);

            return JSON.stringify({
                success: true,
                message: `Recontato agendado para ${args.dataRecontato}`,
                dataRecontato: dataAgendamento.toISOString()
            });
        } catch (error) {
            console.error('[TOOL] agendar_followup - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao agendar follow-up'
            });
        }
    }
});

// ====================================
// TOOL 6: Buscar Imóvel
// ====================================

export const buscarImovelTool = tool({
    name: 'buscar_imovel',
    description: 'Busca informações dos imóveis cadastrados para este lead.',

    parameters: z.object({
        leadId: z.string().describe('ID do lead')
    }),

    execute: async (args) => {
        try {
            console.log(`[TOOL] buscar_imovel - Lead ${args.leadId}`);

            const imoveis = await prisma.imovel.findMany({
                where: { leadId: args.leadId },
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
                return JSON.stringify({
                    success: false,
                    message: 'Nenhum imóvel cadastrado para este lead.',
                    imoveis: []
                });
            }

            const imoveisFormatados = imoveis.map(i => ({
                endereco: `${i.logradouro}${i.numero ? `, ${i.numero}` : ''} - ${i.bairro}`,
                edificio: i.nomeEdificio,
                area: i.areaEdificada ? `${i.areaEdificada}m²` : null,
                status: i.statusCaptacao,
                interesse: i.interesse
            }));

            return JSON.stringify({
                success: true,
                totalImoveis: imoveis.length,
                imoveis: imoveisFormatados
            });
        } catch (error) {
            console.error('[TOOL] buscar_imovel - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao buscar imóveis'
            });
        }
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
        try {
            console.log(`[TOOL] encaminhar_corretor - Contato ${args.contatoId}`);

            const contato = await prisma.contato.findUnique({
                where: { id: args.contatoId },
                include: { campanha: true }
            });

            if (!contato) {
                return JSON.stringify({ success: false, error: 'Contato não encontrado' });
            }

            let leadId = contato.leadId;

            // Converter se necessário
            if (!contato.virouLead) {
                const novoLead = await prisma.lead.create({
                    data: {
                        tenantId: contato.campanha.tenantId,
                        nome: contato.nome,
                        telefone: contato.telefone,
                        email: contato.email,
                        cpf: contato.cpf,
                        enderecoPrincipal: contato.endereco,
                        origem: 'prospeccao_ativa',
                        campanhaOrigemId: contato.campanhaId,
                        status: 'NOVO',
                        temperatura: args.urgencia === 'ALTA' ? 'QUENTE' : 'MORNO',
                        estagio: 'encaminhado_corretor',
                        primeiroContato: contato.criadoEm,
                        ultimaInteracao: new Date()
                    }
                });

                leadId = novoLead.id;

                await prisma.contato.update({
                    where: { id: args.contatoId },
                    data: { virouLead: true, leadId: novoLead.id, virouLeadEm: new Date(), statusProspeccao: 'LEAD' }
                });
            }

            // Criar tarefa
            await prisma.atividade.create({
                data: {
                    leadId: leadId!,
                    tipo: 'TAREFA',
                    titulo: `${args.urgencia === 'ALTA' ? '🔥 URGENTE: ' : '📞 '}Proprietário solicitou contato`,
                    descricao: `Motivo: ${args.motivo}\n\nContexto:\n${args.contextoConversa}`,
                    criadoPor: 'sdr_ia'
                }
            });

            console.log(`[TOOL] encaminhar_corretor - Tarefa criada para lead ${leadId}`);

            return JSON.stringify({
                success: true,
                leadId,
                message: `Corretor será notificado ${args.urgencia === 'ALTA' ? 'imediatamente' : 'em breve'}!`
            });
        } catch (error) {
            console.error('[TOOL] encaminhar_corretor - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Erro ao encaminhar'
            });
        }
    }
});

// ====================================
// TOOL 8: Solicitar Humano (Desativado)
// ====================================

export const solicitarHumanoTool = tool({
    name: 'solicitar_humano',
    description: `⛔ PROIBIDO! Use encaminhar_corretor se proprietário pedir explicitamente.`,

    parameters: z.object({
        leadId: z.string().describe('ID do lead'),
        motivo: z.string().describe('Motivo')
    }),

    execute: async (args) => {
        console.log(`[TOOL] solicitar_humano - BLOQUEADO! Use encaminhar_corretor`);
        return JSON.stringify({
            success: false,
            error: 'Use encaminhar_corretor se proprietário pedir para falar com humano'
        });
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
            comissaoAcordada: z.string().nullable().describe('Comissão (ou null)')
        }).nullable().describe('Dados do acordo (obrigatório passar objeto ou null)')
    }),

    execute: async (args) => {
        try {
            const db: any = prisma;

            console.log(`[TOOL] mover_para_fase - Lead ${args.leadId} → ${args.faseDestino}`);

            // Mapear fase para status
            const faseParaStatus: Record<string, string> = {
                'FASE1': 'NOVO',
                'FASE2': 'TENTATIVA_AGENDAMENTO',
                'FASE3': 'DOCUMENTACAO',
                'FASE4': 'ONBOARDING',
                'CAPTADO': 'CAPTADO'
            };

            const novoStatus = faseParaStatus[args.faseDestino];

            if (!novoStatus) {
                return JSON.stringify({ success: false, error: 'Fase inválida' });
            }

            // Preparar dados de atualização
            const updateData: any = {
                status: novoStatus,
                ultimaInteracao: new Date(),
                ultimaAcaoIA: `Movido para ${args.faseDestino}: ${args.motivo}`,
                ultimaAcaoIAEm: new Date()
            };

            // Se tiver dados adicionais (contrato), salvar no Lead
            if (args.dadosAdicionais) {
                if (args.dadosAdicionais.tipoAutorizacao) updateData.tipoAutorizacao = args.dadosAdicionais.tipoAutorizacao;
                if (args.dadosAdicionais.prazoTrabalho) updateData.prazoTrabalho = args.dadosAdicionais.prazoTrabalho;
                if (args.dadosAdicionais.comissaoAcordada) updateData.comissaoAcordada = args.dadosAdicionais.comissaoAcordada;
            }

            // Atualizar lead
            await db.lead.update({
                where: { id: args.leadId },
                data: updateData
            });

            // Se o lead foi convertido em CAPTADO, criar registro na tabela Cliente
            if (novoStatus === 'CAPTADO') {
                try {
                    // Verificar se já existe cliente para este lead
                    const clienteExistente = await db.cliente.findUnique({
                        where: { origemLeadId: args.leadId }
                    });

                    if (!clienteExistente) {
                        // Buscar dados completos do lead para copiar
                        const leadCompleto = await db.lead.findUnique({
                            where: { id: args.leadId }
                        });

                        if (leadCompleto) {
                            await db.cliente.create({
                                data: {
                                    tenantId: leadCompleto.tenantId,
                                    nome: leadCompleto.nome,
                                    cpf: leadCompleto.cpf,
                                    email: leadCompleto.email,
                                    telefone: leadCompleto.telefone,
                                    endereco: leadCompleto.enderecoPrincipal,
                                    origemLeadId: leadCompleto.id,
                                    status: 'ATIVO'
                                }
                            });
                            console.log(`[TOOL] mover_para_fase - Cliente criado com sucesso para o lead ${args.leadId}`);
                        }
                    }
                } catch (err: any) {
                    console.error('[TOOL] Erro ao criar registro de Cliente:', err);
                    // Não falhar a ação principal, apenas logar erro
                }
            }

            console.log(`[TOOL] mover_para_fase - Sucesso: ${args.leadId} agora em ${novoStatus}`);

            return JSON.stringify({
                success: true,
                faseAnterior: args.faseDestino,
                novoStatus,
                motivo: args.motivo
            });

        } catch (error: any) {
            console.error(`[TOOL] mover_para_fase - Erro:`, error);
            return JSON.stringify({
                success: false,
                error: error.message || 'Erro ao mover lead'
            });
        }
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

            return JSON.stringify({
                success: true,
                link: contrato.linkAceite,
                mensagem: "Link gerado com sucesso. Envie para o cliente."
            });

        } catch (error: any) {
            console.error('[TOOL] Erro ao gerar contrato:', error);
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
        cpf: z.string().optional().describe('CPF do cliente (apenas números)'),
        email: z.string().email().optional().describe('Email do cliente'),
        endereco: z.string().optional().describe('Endereço completo do imóvel'),
        nome: z.string().optional().describe('Nome completo do cliente')
    }),
    execute: async (args) => {
        try {
            console.log(`[TOOL] atualizar_dados_lead - Lead ${args.leadId}`);

            const data: any = {};
            if (args.cpf) data.cpf = args.cpf.replace(/\D/g, '');
            if (args.email) data.email = args.email;
            if (args.endereco) data.enderecoPrincipal = args.endereco;
            if (args.nome) data.nome = args.nome;

            if (Object.keys(data).length === 0) {
                return JSON.stringify({ success: false, error: 'Nenhum dado fornecido para atualização' });
            }

            data.ultimaInteracao = new Date();

            await prisma.lead.update({
                where: { id: args.leadId },
                data
            });

            return JSON.stringify({
                success: true,
                mensagem: "Dados atualizados com sucesso"
            });
        } catch (error: any) {
            console.error('[TOOL] Erro ao atualizar lead:', error);
            return JSON.stringify({ success: false, error: 'Erro ao atualizar dados' });
        }
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
        tipo: z.string().optional().describe('Tipo: apartamento, casa, comercial, terreno'),
        quartos: z.number().optional().describe('Número de quartos'),
        suites: z.number().optional().describe('Número de suítes'),
        banheiros: z.number().optional().describe('Número de banheiros'),
        vagas: z.number().optional().describe('Vagas de garagem'),
        areaUtil: z.number().optional().describe('Área útil em m²'),
        areaTotal: z.number().optional().describe('Área total em m²'),
        andar: z.number().optional().describe('Andar do apartamento'),
        valorVenda: z.number().optional().describe('Valor de venda em reais'),
        valorLocacao: z.number().optional().describe('Valor de locação mensal'),
        valorCondominio: z.number().optional().describe('Valor do condomínio'),
        valorIPTU: z.number().optional().describe('Valor anual do IPTU'),
        caracteristicas: z.array(z.string()).optional().describe('Lista de características: armários, varanda, churrasqueira, etc'),
        descricao: z.string().optional().describe('Descrição detalhada do imóvel'),
        fotos: z.array(z.string()).optional().describe('URLs das fotos enviadas')
    }),

    execute: async (args) => {
        try {
            console.log(`[TOOL] salvar_dados_imovel - Lead ${args.leadId}`);

            const updateData: any = {};

            if (args.tipo) updateData.tipoImovel = args.tipo;
            if (args.quartos !== undefined) updateData.quartosImovel = args.quartos;
            if (args.suites !== undefined) updateData.imovelSuites = args.suites;
            if (args.banheiros !== undefined) updateData.imovelBanheiros = args.banheiros;
            if (args.vagas !== undefined) updateData.vagasImovel = args.vagas;
            if (args.areaUtil !== undefined) updateData.imovelAreaTotal = args.areaUtil;
            if (args.areaTotal !== undefined) updateData.imovelAreaTotal = args.areaTotal;
            if (args.andar !== undefined) updateData.imovelAndar = args.andar;
            if (args.valorVenda !== undefined) updateData.valorPretendido = `R$ ${args.valorVenda.toLocaleString('pt-BR')}`;
            if (args.valorLocacao !== undefined) updateData.imovelValorLocacao = args.valorLocacao;
            if (args.valorCondominio !== undefined) updateData.imovelValorCondominio = args.valorCondominio;
            if (args.valorIPTU !== undefined) updateData.imovelValorIPTU = args.valorIPTU;
            if (args.caracteristicas) updateData.imovelCaracteristicas = args.caracteristicas;
            if (args.descricao) updateData.imovelDescricao = args.descricao;
            if (args.fotos) updateData.imovelFotos = args.fotos;

            updateData.dadosImovelColetadosEm = new Date();
            updateData.ultimaInteracao = new Date();

            if (Object.keys(updateData).length <= 2) {
                return JSON.stringify({
                    success: false,
                    error: 'Nenhum dado do imóvel fornecido'
                });
            }

            await prisma.lead.update({
                where: { id: args.leadId },
                data: updateData
            });

            const camposSalvos = Object.keys(updateData).filter(k => !['dadosImovelColetadosEm', 'ultimaInteracao'].includes(k));
            console.log(`[TOOL] salvar_dados_imovel - Campos salvos: ${camposSalvos.join(', ')}`);

            return JSON.stringify({
                success: true,
                camposSalvos,
                message: `✓ Dados salvos: ${camposSalvos.length} campos`
            });

        } catch (error: any) {
            console.error('[TOOL] salvar_dados_imovel - Erro:', error);
            return JSON.stringify({
                success: false,
                error: error.message || 'Erro ao salvar dados do imóvel'
            });
        }
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
// Exportar todas as tools
// ====================================

export const todasToolsSDR = [
    qualificarLeadTool,
    registrarOptoutTool,
    converterParaLeadTool,
    agendarAvaliacaoTool,
    agendarFollowupTool,
    buscarImovelTool,
    encaminharCorretorTool,
    solicitarHumanoTool,
    moverParaFaseTool,
    atualizarDadosLeadTool,
    gerarLinkContratoTool,
    salvarDadosImovelTool,  // 🆕 Coleta de dados do imóvel
    enviarParaCrmTool       // 🆕 Envio para CRM
];

