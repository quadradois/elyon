import { prisma } from '../lib/db';

// Helper simplificado sem Zod-to-Json-Schema (para evitar deps extras)
function criarDefinicaoTool(nome: string, descricao: string, parameters: any) {
    return {
        type: 'function' as const,
        function: {
            name: nome,
            description: descricao,
            parameters: parameters, // JSON Schema direto
        }
    };
}

// ============================================================================
// TOOL: Consultar Agenda
// ============================================================================
const consultarAgenda = {
    def: criarDefinicaoTool(
        'consultarAgenda',
        'Verifica se existem agendamentos (atividades) no intervalo especificado. Retorna slots ocupados.',
        {
            type: "object",
            properties: {
                dataInicio: { type: "string", description: "Data e hora de início no formato ISO 8601" },
                dataFim: { type: "string", description: "Data e hora de fim no formato ISO 8601" }
            },
            required: ["dataInicio", "dataFim"]
        }
    ),
    run: async ({ dataInicio, dataFim }: { dataInicio: string, dataFim: string }) => {
        const start = new Date(dataInicio);
        const end = new Date(dataFim);

        const atividades = await prisma.atividade.findMany({
            where: {
                AND: [
                    { agendadoPara: { gte: start } },
                    { agendadoPara: { lt: end } },
                    { statusAgendamento: { not: 'CANCELADO' } }
                ]
            },
            select: {
                agendadoPara: true,
                duracao: true,
                titulo: true
            }
        });

        if (atividades.length === 0) {
            return JSON.stringify({ status: 'livre', mensagem: 'Nenhum conflito encontrado. Horário livre.' });
        }

        return JSON.stringify({
            status: 'ocupado',
            conflitos: atividades.map(a => `${a.agendadoPara?.toISOString()} - ${a.titulo}`)
        });
    }
};

// ============================================================================
// TOOL: Buscar Lead
// ============================================================================
const buscarLead = {
    def: criarDefinicaoTool(
        'buscarLead',
        'Busca dados básicos de um Lead no CRM pelo nome, CPF ou Telefone.',
        {
            type: "object",
            properties: {
                identificador: { type: "string", description: "Nome, CPF ou Telefone do Lead para buscar" }
            },
            required: ["identificador"]
        }
    ),
    run: async ({ identificador }: { identificador: string }) => {
        const leads = await prisma.lead.findMany({
            where: {
                OR: [
                    { nome: { contains: identificador, mode: 'insensitive' } },
                    { cpf: identificador },
                    { telefone: { contains: identificador } }
                ]
            },
            take: 3,
            select: {
                id: true,
                nome: true,
                telefone: true,
                imoveis: {
                    select: {
                        tipoImovel: true,
                        bairro: true
                    }
                }
            }
        });

        if (leads.length === 0) {
            return JSON.stringify({ encontrado: false, mensagem: 'Nenhum lead encontrado com esse dado.' });
        }

        return JSON.stringify({ encontrado: true, leads });
    }
};

// ============================================================================
// TOOL: Agendar Reunião
// ============================================================================
const agendarReuniao = {
    def: criarDefinicaoTool(
        'agendarReuniao',
        'Agenda uma nova atividade do tipo REUNIAO para o Lead.',
        {
            type: "object",
            properties: {
                leadId: { type: "string", description: "ID do Lead para qual a reunião será agendada" },
                dataHora: { type: "string", description: "Data e hora da reunião (ISO 8601)" },
                motivo: { type: "string", description: "Motivo da reunião (ex: Visita, Assinatura, Avaliação)" }
            },
            required: ["leadId", "dataHora", "motivo"]
        }
    ),
    run: async ({ leadId, dataHora, motivo }: { leadId: string, dataHora: string, motivo: string }) => {
        try {
            console.log('==================================================');
            console.log(`[agendarReuniao] FERRAMENTA CHAMADA!`);
            console.log(`[agendarReuniao] Lead ID: ${leadId}`);
            console.log(`[agendarReuniao] Data/Hora recebida: ${dataHora}`);
            console.log(`[agendarReuniao] Motivo: ${motivo}`);
            console.log('==================================================');
            let finalLeadId = leadId;

            // 1. Verificar se é um Lead existente
            const leadExistente = await prisma.lead.findUnique({ where: { id: leadId } });

            if (!leadExistente) {
                console.log(`[Ferramenta] ID ${leadId} não é um Lead. Verificando se é Contato...`);
                // 2. Verificar se é um Contato
                const contato = await prisma.contato.findUnique({ where: { id: leadId } });

                if (contato) {
                    // É um contato! Precisamos converter para Lead agora.
                    console.log(`[Ferramenta] Contato encontrado. Convertendo para Lead...`);

                    if (contato.virouLead && contato.leadId) {
                        // Já tinha virado lead, mas o agente mandou o ID do contato
                        finalLeadId = contato.leadId;
                    } else {
                        // Criar novo Lead
                        const novoLead = await prisma.lead.create({
                            data: {
                                tenantId: (await prisma.campanha.findUnique({ where: { id: contato.campanhaId }, select: { tenantId: true } }))?.tenantId || '',
                                nome: contato.nome,
                                telefone: contato.telefone || '',
                                status: 'VISITA_AGENDADA', // Já nasce com visita
                                temperatura: 'QUENTE',
                                urgencia: 'ALTA',
                                origem: 'PROSPECCAO_ATIVA'
                            }
                        });

                        // Atualizar contato
                        await prisma.contato.update({
                            where: { id: contato.id },
                            data: {
                                virouLead: true,
                                leadId: novoLead.id,
                                statusProspeccao: 'LEAD'
                            }
                        });

                        finalLeadId = novoLead.id;
                        console.log(`[Ferramenta] Contato convertido com sucesso. Novo Lead ID: ${finalLeadId}`);
                    }
                } else {
                    return JSON.stringify({ sucesso: false, erro: 'ID não encontrado nem como Lead nem como Contato.' });
                }
            }

            // 3. Verificar se já existe agendamento pendente neste horário (anti-duplicata)
            const dataAgendamento = new Date(dataHora);
            const margemMinutos = 30; // 30 min de margem
            const inicioRange = new Date(dataAgendamento.getTime() - margemMinutos * 60000);
            const fimRange = new Date(dataAgendamento.getTime() + margemMinutos * 60000);

            const agendamentoExistente = await prisma.atividade.findFirst({
                where: {
                    leadId: finalLeadId,
                    statusAgendamento: 'PENDENTE',
                    agendadoPara: {
                        gte: inicioRange,
                        lte: fimRange
                    }
                }
            });

            if (agendamentoExistente) {
                console.log(`[Ferramenta] Agendamento duplicado detectado. ID existente: ${agendamentoExistente.id}`);
                return JSON.stringify({
                    sucesso: true,
                    id: agendamentoExistente.id,
                    mensagem: 'Você já possui um agendamento neste horário. Deseja cancelar e remarcar para outro horário?',
                    jáExistia: true
                });
            }

            // 4. VALIDAR EXPEDIENTE - Verificar se o horário está dentro do expediente configurado
            const lead = await prisma.lead.findUnique({ where: { id: finalLeadId }, select: { tenantId: true } });
            if (lead?.tenantId) {
                const tenant = await prisma.tenant.findUnique({
                    where: { id: lead.tenantId },
                    select: { expedienteSemanal: true }
                });

                if (tenant?.expedienteSemanal) {
                    const expediente = tenant.expedienteSemanal as {
                        dias: Array<{ diaSemana: number; ativo: boolean; inicio: string; fim: string }>;
                        almocoAtivo?: boolean;
                        almocoInicio?: string;
                        almocoFim?: string;
                    };
                    // Converter para horário de Brasília (UTC-3) antes de validar
                    // getUTCHours retorna hora em UTC, subtraímos 3 para Brasília
                    const offsetBrasilia = -3;
                    const horaUTC = dataAgendamento.getUTCHours();
                    const minutoUTC = dataAgendamento.getUTCMinutes();
                    let horaBrasilia = horaUTC + offsetBrasilia;
                    if (horaBrasilia < 0) horaBrasilia += 24; // Ajuste para dia anterior

                    console.log(`[Ferramenta] Validando expediente - Hora UTC: ${horaUTC}:${minutoUTC}, Hora Brasília: ${horaBrasilia}:${minutoUTC}`);

                    const diaSemana = dataAgendamento.getUTCDay(); // Usa UTC para consistência
                    const diaConfig = expediente.dias.find(d => d.diaSemana === diaSemana);

                    if (!diaConfig || !diaConfig.ativo) {
                        const diasAtivos = expediente.dias.filter(d => d.ativo).map(d =>
                            ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.diaSemana]
                        ).join(', ');
                        return JSON.stringify({
                            sucesso: false,
                            erro: `Não trabalhamos neste dia. Nossos dias de atendimento são: ${diasAtivos}. Por favor, escolha outro dia.`
                        });
                    }

                    // Converter hora do agendamento (já em Brasília) para minutos
                    const horaAgendamentoMinutos = horaBrasilia * 60 + minutoUTC;

                    const [inicioHora, inicioMin] = diaConfig.inicio.split(':').map(Number);
                    const [fimHora, fimMin] = diaConfig.fim.split(':').map(Number);
                    const inicioMinutos = inicioHora * 60 + inicioMin;
                    const fimMinutos = fimHora * 60 + fimMin;

                    if (horaAgendamentoMinutos < inicioMinutos || horaAgendamentoMinutos > fimMinutos) {
                        console.log(`[agendarReuniao] REJEITADO: ${horaBrasilia}:00 está fora de ${diaConfig.inicio}-${diaConfig.fim}`);
                        return JSON.stringify({
                            sucesso: false,
                            erro: `HORÁRIO INDISPONÍVEL. Nosso expediente é EXCLUSIVAMENTE das ${diaConfig.inicio} às ${diaConfig.fim} (somente este horário, nenhum outro). Por favor, escolha um horário dentro desse intervalo.`,
                            horarioDisponivel: { inicio: diaConfig.inicio, fim: diaConfig.fim }
                        });
                    }

                    // Verificar horário de almoço
                    if (expediente.almocoAtivo && expediente.almocoInicio && expediente.almocoFim) {
                        const [almocoInicioH, almocoInicioM] = expediente.almocoInicio.split(':').map(Number);
                        const [almocoFimH, almocoFimM] = expediente.almocoFim.split(':').map(Number);
                        const almocoInicioMin = almocoInicioH * 60 + almocoInicioM;
                        const almocoFimMin = almocoFimH * 60 + almocoFimM;

                        if (horaAgendamentoMinutos >= almocoInicioMin && horaAgendamentoMinutos < almocoFimMin) {
                            return JSON.stringify({
                                sucesso: false,
                                erro: `Este horário é nosso intervalo de almoço (${expediente.almocoInicio} às ${expediente.almocoFim}). Por favor, escolha outro horário.`
                            });
                        }
                    }

                    console.log(`[Ferramenta] Horário validado: dentro do expediente.`);
                }
            }

            // 5. Criar o agendamento
            const agendamento = await prisma.atividade.create({
                data: {
                    leadId: finalLeadId,
                    titulo: `Agendamento IA: ${motivo}`,
                    tipo: 'AVALIACAO',
                    agendadoPara: dataAgendamento,
                    descricao: `Agendado automaticamente pelo Agente via ferramenta.`,
                    statusAgendamento: 'PENDENTE',
                    criadoPor: 'sistema-ia'
                }
            });

            // 4. Se for Lead, atualizar status
            await prisma.lead.update({
                where: { id: finalLeadId },
                data: { status: 'VISITA_AGENDADA' }
            });

            return JSON.stringify({
                sucesso: true,
                id: agendamento.id,
                mensagem: 'Enviamos sua solicitação ao corretor responsável. Você será notificado assim que ele confirmar a visita!'
            });
        } catch (error) {
            console.error('[Ferramenta] Erro ao agendar:', error);
            return JSON.stringify({ sucesso: false, erro: 'Falha interna ao criar registro no banco.' });
        }
    }
};

// ============================================================================
// TOOL: Listar Agendamentos do Lead
// ============================================================================
const listarAgendamentos = {
    def: criarDefinicaoTool(
        'listarAgendamentos',
        'Lista todos os agendamentos PENDENTES do lead atual. Use antes de cancelar para saber o ID.',
        {
            type: "object",
            properties: {
                leadId: { type: "string", description: "ID do Lead para listar agendamentos" }
            },
            required: ["leadId"]
        }
    ),
    run: async ({ leadId }: { leadId: string }) => {
        try {
            const agendamentos = await prisma.atividade.findMany({
                where: {
                    leadId: leadId,
                    statusAgendamento: 'PENDENTE',
                    agendadoPara: { gte: new Date() } // Somente futuros
                },
                orderBy: { agendadoPara: 'asc' },
                select: {
                    id: true,
                    titulo: true,
                    agendadoPara: true,
                    tipo: true
                }
            });

            if (agendamentos.length === 0) {
                return JSON.stringify({ encontrados: 0, mensagem: 'Nenhum agendamento pendente encontrado.' });
            }

            return JSON.stringify({
                encontrados: agendamentos.length,
                agendamentos: agendamentos.map(a => ({
                    id: a.id,
                    titulo: a.titulo,
                    data: a.agendadoPara?.toISOString(),
                    tipo: a.tipo
                }))
            });
        } catch (error) {
            console.error('[Ferramenta] Erro ao listar agendamentos:', error);
            return JSON.stringify({ erro: 'Falha ao consultar agendamentos.' });
        }
    }
};

// ============================================================================
// TOOL: Cancelar Agendamento
// ============================================================================
const cancelarAgendamento = {
    def: criarDefinicaoTool(
        'cancelarAgendamento',
        'Cancela um agendamento existente pelo ID. Use listarAgendamentos primeiro para obter o ID.',
        {
            type: "object",
            properties: {
                agendamentoId: { type: "string", description: "ID do agendamento a ser cancelado" },
                motivo: { type: "string", description: "Motivo do cancelamento (ex: Reagendamento, Desistência)" }
            },
            required: ["agendamentoId"]
        }
    ),
    run: async ({ agendamentoId, motivo }: { agendamentoId: string, motivo?: string }) => {
        try {
            console.log(`[Ferramenta] Cancelando agendamento: ${agendamentoId}`);

            const agendamento = await prisma.atividade.findUnique({
                where: { id: agendamentoId }
            });

            if (!agendamento) {
                return JSON.stringify({ sucesso: false, erro: 'Agendamento não encontrado.' });
            }

            if (agendamento.statusAgendamento === 'CANCELADO') {
                return JSON.stringify({ sucesso: false, erro: 'Este agendamento já foi cancelado anteriormente.' });
            }

            await prisma.atividade.update({
                where: { id: agendamentoId },
                data: {
                    statusAgendamento: 'CANCELADO',
                    canceladoPor: 'sistema-ia',
                    canceladoEm: new Date(),
                    motivoCancelamento: motivo || 'Cancelado via IA'
                }
            });

            console.log(`[Ferramenta] Agendamento ${agendamentoId} cancelado com sucesso.`);

            return JSON.stringify({
                sucesso: true,
                mensagem: 'Agendamento cancelado com sucesso.'
            });
        } catch (error) {
            console.error('[Ferramenta] Erro ao cancelar:', error);
            return JSON.stringify({ sucesso: false, erro: 'Falha ao cancelar agendamento.' });
        }
    }
};

// Exportar definições e mapa de execução
export const toolsDefinition = [
    consultarAgenda.def,
    buscarLead.def,
    agendarReuniao.def,
    listarAgendamentos.def,
    cancelarAgendamento.def
];
export const toolsExecution: Record<string, (args: any) => Promise<string>> = {
    'consultarAgenda': consultarAgenda.run,
    'buscarLead': buscarLead.run,
    'agendarReuniao': agendarReuniao.run,
    'listarAgendamentos': listarAgendamentos.run,
    'cancelarAgendamento': cancelarAgendamento.run
};
