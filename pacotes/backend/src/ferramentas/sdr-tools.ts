import { z } from "zod";
import { prisma } from "../lib/db";
import { ragConversasService } from "../servicos/rag-conversas";
import { randomUUID } from "crypto";

/**
 * FERRAMENTAS DO SDR (Sales Development Representative)
 *
 * Estas ferramentas são usadas pelo SDR Worker para:
 * - Qualificar leads automaticamente
 * - Solicitar intervenção humana quando necessário
 * - Buscar informações de imóveis
 */

// ====================================
// TOOL 1: Qualificar Lead (SPIN Selling)
// ====================================

export const qualificarLeadTool = {
  name: 'qualificar_lead',
  description: `IMPORTANTE: Só use esta ferramenta DEPOIS de coletar informações através da conversa!
  
Use CONTATO_ID (que você recebe no contexto da conversa), NÃO leadId!
A ferramenta cria automaticamente o Lead se ainda não existir.

Você deve coletar durante a conversa (metodologia SPIN para CAPTAÇÃO):
1. SITUAÇÃO: interesse (vender/alugar), timeline, dados do imóvel
2. PROBLEMA: motivação para vender, dores do proprietário  
3. IMPLICAÇÃO: urgência, consequências de não vender
4. NECESSIDADE: expectativas do serviço, objeções

Classifique como:
- QUENTE: urgência alta + timeline ≤ 3 meses + sem corretor
- MORNO: interesse genuíno mas sem urgência imediata
- FRIO: sem interesse real ou timeline muito longo (>6 meses)`,

  parameters: z.object({
    contatoId: z.string().uuid().describe('ID do contato no banco de dados (OBRIGATÓRIO)'),
    leadId: z.string().uuid().optional().describe('ID do lead (opcional - será criado automaticamente se não existir)'),

    // CAMPOS OBRIGATÓRIOS
    temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).describe(
      'OBRIGATÓRIO! QUENTE: urgência + timeline curto. MORNO: interesse sem urgência. FRIO: sem interesse/timeline longo'
    ),
    interesse: z.string().min(1).describe(
      'OBRIGATÓRIO! O que o lead quer: VENDER, ALUGAR, ou AMBOS'
    ),
    timeline: z.string().min(1).describe(
      'OBRIGATÓRIO! Quando pretende: "1-2 meses", "urgente", "sem pressa", "6 meses+"'
    ),

    // DADOS DO IMÓVEL (coletar durante conversa)
    enderecoImovel: z.string().optional().describe('Endereço do imóvel para captação'),
    tipoImovel: z.string().optional().describe('Tipo: apartamento, casa, sala comercial, terreno'),
    areaImovel: z.number().optional().describe('Área em m² (número apenas)'),
    quartosImovel: z.number().optional().describe('Número de quartos'),
    vagasImovel: z.number().optional().describe('Número de vagas de garagem'),
    valorPretendido: z.number().optional().describe('Valor pretendido em reais (número apenas)'),
    ocupacaoImovel: z.string().optional().describe('Ocupação: próprio, alugado, vazio'),

    // SPIN - SITUAÇÃO
    situacaoAtual: z.string().optional().describe('Situação atual do proprietário com o imóvel'),
    tempoDecisao: z.string().optional().describe('Há quanto tempo está pensando em vender'),
    tentativasAnteriores: z.string().optional().describe('Já tentou vender antes? Com qual resultado?'),
    comCorretorAtualmente: z.boolean().optional().describe('Está com algum corretor atualmente?'),

    // SPIN - PROBLEMA
    motivacaoVenda: z.string().optional().describe('Motivo principal para vender: mudança, upgrade, dificuldade financeira, etc'),
    doresIdentificadas: z.array(z.string()).optional().describe('Lista de dores/problemas mencionados pelo proprietário'),

    // SPIN - IMPLICAÇÃO
    prazoDesejado: z.string().optional().describe('Em quanto tempo gostaria de ter vendido'),
    urgencia: z.enum(['BAIXA', 'MEDIA', 'ALTA']).optional().describe('Nível de urgência detectado'),
    consequencias: z.string().optional().describe('O que acontece se não vender no prazo'),
    custosAtuais: z.string().optional().describe('Custos que está tendo com o imóvel (condomínio, IPTU)'),
    pressaoTempo: z.string().optional().describe('Existe pressão de tempo? Qual?'),

    // SPIN - NECESSIDADE
    expectativaServico: z.string().optional().describe('O que espera de um serviço de venda'),
    objecoes: z.array(z.string()).optional().describe('Objeções ou preocupações mencionadas'),
    interesseAvaliacao: z.boolean().optional().describe('Demonstrou interesse em avaliação gratuita?'),

    // Observações gerais
    observacoesSpin: z.string().optional().describe('Outras observações relevantes da qualificação SPIN')
  }),

  execute: async (args: {
    contatoId: string;
    leadId?: string;
    temperatura: 'FRIO' | 'MORNO' | 'QUENTE';
    interesse: string;
    timeline: string;
    // Imóvel
    enderecoImovel?: string;
    tipoImovel?: string;
    areaImovel?: number;
    quartosImovel?: number;
    vagasImovel?: number;
    valorPretendido?: number;
    ocupacaoImovel?: string;
    // SPIN
    situacaoAtual?: string;
    tempoDecisao?: string;
    tentativasAnteriores?: string;
    comCorretorAtualmente?: boolean;
    motivacaoVenda?: string;
    doresIdentificadas?: string[];
    prazoDesejado?: string;
    urgencia?: 'BAIXA' | 'MEDIA' | 'ALTA';
    consequencias?: string;
    custosAtuais?: string;
    pressaoTempo?: string;
    expectativaServico?: string;
    objecoes?: string[];
    interesseAvaliacao?: boolean;
    observacoesSpin?: string;
  }) => {
    try {
      // Usar db como any para evitar problemas de cache do TypeScript
      const db: any = prisma;

      let leadId = args.leadId;
      let leadCriado = false;

      // Se recebeu contatoId, verificar se já existe Lead ou criar um novo
      if (args.contatoId) {
        const contato = await db.contato.findUnique({
          where: { id: args.contatoId },
          include: { campanha: true }
        });

        if (!contato) {
          console.error(`[TOOL] qualificar_lead - Contato ${args.contatoId} não encontrado`);
          return {
            success: false,
            error: 'Contato não encontrado'
          };
        }

        // Se contato já tem Lead, usar esse ID
        if (contato.leadId) {
          leadId = contato.leadId;
          console.log(`[TOOL] qualificar_lead - Usando Lead existente: ${leadId}`);
        } else {
          // Criar novo Lead a partir do Contato
          console.log(`[TOOL] qualificar_lead - Criando Lead para contato ${args.contatoId}`);

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

          // Atualizar contato com referência ao Lead
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

          console.log(`[TOOL] qualificar_lead - Lead criado: ${leadId}`);
        }
      }

      if (!leadId) {
        console.error('[TOOL] qualificar_lead - Nenhum leadId ou contatoId fornecido');
        return {
          success: false,
          error: 'É necessário fornecer contatoId ou leadId'
        };
      }

      console.log(
        `[TOOL] qualificar_lead - ${leadCriado ? 'Lead criado e' : 'Lead'} ${leadId} → ${args.temperatura}`
      );

      // Montar objeto de atualização do lead com dados SPIN
      const dadosAtualizacao: any = {
        temperatura: args.temperatura,
        status: "QUALIFICADO",
        ultimaInteracao: new Date(),

        // Tracking IA (Gap 1 do Playbook resolvido)
        ultimaAcaoIA: `Qualificação SPIN: ${args.temperatura} - ${args.interesse}`,
        ultimaAcaoIAEm: new Date(),

        // Interesse principal
        interesseEm: args.interesse,

        // Dados do imóvel
        ...(args.enderecoImovel && { enderecoImovel: args.enderecoImovel }),
        ...(args.tipoImovel && { tipoImovel: args.tipoImovel }),
        ...(args.areaImovel && { areaImovel: args.areaImovel }),
        ...(args.quartosImovel && { quartosImovel: args.quartosImovel }),
        ...(args.vagasImovel && { vagasImovel: args.vagasImovel }),
        ...(args.valorPretendido && { valorPretendido: args.valorPretendido }),
        ...(args.ocupacaoImovel && { ocupacaoImovel: args.ocupacaoImovel }),

        // SPIN - Situação
        ...(args.situacaoAtual && { situacaoAtual: args.situacaoAtual }),
        ...(args.tempoDecisao && { tempoDecisao: args.tempoDecisao }),
        ...(args.tentativasAnteriores && { tentativasAnteriores: args.tentativasAnteriores }),
        ...(args.comCorretorAtualmente !== undefined && { comCorretorAtualmente: args.comCorretorAtualmente }),

        // SPIN - Problema
        ...(args.motivacaoVenda && { motivacaoVenda: args.motivacaoVenda }),
        ...(args.doresIdentificadas && args.doresIdentificadas.length > 0 && { doresIdentificadas: args.doresIdentificadas }),

        // SPIN - Implicação
        ...(args.prazoDesejado && { prazoDesejado: args.prazoDesejado }),
        ...(args.urgencia && { urgencia: args.urgencia }),
        ...(args.consequencias && { consequencias: args.consequencias }),
        ...(args.custosAtuais && { custosAtuais: args.custosAtuais }),
        ...(args.pressaoTempo && { pressaoTempo: args.pressaoTempo }),

        // SPIN - Necessidade
        ...(args.expectativaServico && { expectativaServico: args.expectativaServico }),
        ...(args.objecoes && args.objecoes.length > 0 && { objecoes: args.objecoes }),
        ...(args.interesseAvaliacao !== undefined && { interesseAvaliacao: args.interesseAvaliacao }),

        // Observações
        ...(args.observacoesSpin && { observacoesSpin: args.observacoesSpin }),
      };

      // Atualizar lead com todos os dados SPIN
      await db.lead.update({
        where: { id: leadId },
        data: dadosAtualizacao,
      });

      // Montar descrição da qualificação para atividade
      const detalhes: string[] = [];
      detalhes.push(`🎯 Temperatura: ${args.temperatura}`);
      detalhes.push(`💼 Interesse: ${args.interesse}`);
      detalhes.push(`⏱️ Timeline: ${args.timeline}`);

      if (args.enderecoImovel) detalhes.push(`\n📍 IMÓVEL:`);
      if (args.enderecoImovel) detalhes.push(`  Endereço: ${args.enderecoImovel}`);
      if (args.tipoImovel) detalhes.push(`  Tipo: ${args.tipoImovel}`);
      if (args.areaImovel) detalhes.push(`  Área: ${args.areaImovel}m²`);
      if (args.valorPretendido) detalhes.push(`  Valor: R$ ${args.valorPretendido.toLocaleString('pt-BR')}`);

      if (args.motivacaoVenda || args.doresIdentificadas?.length) {
        detalhes.push(`\n🔍 PROBLEMA:`);
        if (args.motivacaoVenda) detalhes.push(`  Motivação: ${args.motivacaoVenda}`);
        if (args.doresIdentificadas?.length) detalhes.push(`  Dores: ${args.doresIdentificadas.join(', ')}`);
      }

      if (args.urgencia || args.prazoDesejado) {
        detalhes.push(`\n⚡ IMPLICAÇÃO:`);
        if (args.urgencia) detalhes.push(`  Urgência: ${args.urgencia}`);
        if (args.prazoDesejado) detalhes.push(`  Prazo: ${args.prazoDesejado}`);
        if (args.consequencias) detalhes.push(`  Consequências: ${args.consequencias}`);
      }

      if (args.interesseAvaliacao !== undefined) {
        detalhes.push(`\n✅ NECESSIDADE:`);
        detalhes.push(`  Interesse avaliação: ${args.interesseAvaliacao ? 'SIM' : 'NÃO'}`);
        if (args.expectativaServico) detalhes.push(`  Expectativa: ${args.expectativaServico}`);
        if (args.objecoes?.length) detalhes.push(`  Objeções: ${args.objecoes.join(', ')}`);
      }

      if (args.observacoesSpin) detalhes.push(`\n📝 Obs: ${args.observacoesSpin}`);

      // Registrar atividade de qualificação
      await db.atividade.create({
        data: {
          leadId: leadId,
          tipo: "NOTA",
          titulo: `Lead qualificado como ${args.temperatura} (SPIN)${leadCriado ? ' - Novo Lead' : ''}`,
          descricao: detalhes.join("\n"),
          criadoPor: "ai_agent",
          completadoEm: new Date(),
        },
      });

      console.log(
        `[TOOL] qualificar_lead - Sucesso! Lead ${args.temperatura} com dados SPIN salvos`
      );

      return {
        success: true,
        leadId: leadId,
        leadCriado: leadCriado,
        temperatura: args.temperatura,
        message: `Lead ${leadCriado ? 'criado e ' : ''}qualificado com sucesso como ${args.temperatura}`,
        dadosColetados: {
          imovel: !!args.enderecoImovel || !!args.tipoImovel,
          problema: !!args.motivacaoVenda || (args.doresIdentificadas?.length || 0) > 0,
          implicacao: !!args.urgencia || !!args.prazoDesejado,
          necessidade: args.interesseAvaliacao !== undefined
        }
      };
    } catch (error) {
      console.error("[TOOL] qualificar_lead - Erro:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao qualificar lead",
      };
    }
  },
};

// ====================================
// TOOL 2: Solicitar Humano
// ====================================

export const solicitarHumanoTool = {
  name: "solicitar_humano",
  description: `⛔⛔⛔ PROIBIDO USAR ESTA FERRAMENTA ⛔⛔⛔

NÃO USE ESTA FERRAMENTA! Ela está disponível apenas para casos EXTREMOS.

🚫 PROIBIDO USAR QUANDO:
- Proprietário perguntou sobre valor/preço → RESPONDA você mesmo!
- Proprietário perguntou "quanto vale?" → RESPONDA você mesmo!
- É a primeira, segunda ou terceira mensagem
- Você ainda não qualificou o lead

✅ ÚNICOS CASOS PERMITIDOS:
- Lead pediu EXPLICITAMENTE: "quero falar com pessoa", "me passa um corretor"
- Perguntas sobre DOCUMENTAÇÃO JURÍDICA COMPLEXA (escritura, inventário)

Perguntas como "quanto vale?" você DEVE responder com faixa de preço!`,

  parameters: z.object({
    leadId: z.string().uuid().describe("ID do lead no banco de dados"),
    motivo: z
      .string()
      .describe(
        "Motivo ESPECÍFICO: 'lead solicitou corretor' ou 'dúvida jurídica sobre X'"
      ),
    urgencia: z
      .enum(["BAIXA", "MEDIA", "ALTA"])
      .describe(
        "ALTA: lead QUENTE já qualificado. MEDIA: dúvidas jurídicas. BAIXA: acompanhamento futuro"
      ),
    contexto: z
      .string()
      .optional()
      .describe("Resumo da conversa: interesse, quartos, valor pretendido, etc"),
  }),

  execute: async (args: {
    leadId: string;
    motivo: string;
    urgencia: "BAIXA" | "MEDIA" | "ALTA";
    contexto?: string;
  }) => {
    try {
      console.log(
        `[TOOL] solicitar_humano - Lead ${args.leadId} - Urgência: ${args.urgencia}`
      );

      // Definir prazo baseado na urgência
      const prazoMap = {
        ALTA: new Date(), // Agora/imediato
        MEDIA: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 horas
        BAIXA: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      };

      const prazo = prazoMap[args.urgencia];

      // Criar atividade/tarefa para corretor
      await prisma.atividade.create({
        data: {
          leadId: args.leadId,
          tipo: "TAREFA",
          titulo: `${args.urgencia === "ALTA" ? "🔥 URGENTE: " : ""}Contato com Lead`,
          descricao: `**Motivo**: ${args.motivo}\n\n${args.contexto ? `**Contexto da conversa**:\n${args.contexto}` : ""}`,
          criadoPor: "ai_agent",
          agendadoPara: prazo,
        },
      });

      // Se for urgência ALTA, marcar conversa como concluída (transbordo)
      if (args.urgencia === "ALTA") {
        await prisma.conversa.updateMany({
          where: {
            leadId: args.leadId,
            estadoConversa: "ativa",
          },
          data: {
            estadoConversa: "concluida",
            finalizadaEm: new Date(),
          },
        });

        console.log(
          `[TOOL] solicitar_humano - Conversa finalizada para transbordo`
        );
      }

      console.log(`[TOOL] solicitar_humano - Tarefa criada com sucesso`);

      return {
        success: true,
        urgencia: args.urgencia,
        message:
          args.urgencia === "ALTA"
            ? "Um corretor será notificado imediatamente e entrará em contato em breve."
            : "Tarefa criada para nosso time. Entraremos em contato no prazo agendado.",
      };
    } catch (error) {
      console.error("[TOOL] solicitar_humano - Erro:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar tarefa para corretor",
      };
    }
  },
};

// ====================================
// TOOL 3: Buscar Informações do Imóvel
// ====================================

export const buscarImovelTool = {
  name: "buscar_imovel",
  description:
    "Busca informações detalhadas dos imóveis cadastrados para este lead. Use quando o lead perguntar sobre o imóvel dele ou quando precisar de contexto sobre a propriedade.",

  parameters: z.object({
    leadId: z.string().uuid().describe("ID do lead no banco de dados"),
  }),

  execute: async (args: { leadId: string }) => {
    try {
      console.log(`[TOOL] buscar_imovel - Lead ${args.leadId}`);

      const imoveis = await prisma.imovel.findMany({
        where: { leadId: args.leadId },
        select: {
          id: true,
          inscricaoIptu: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          nomeEdificio: true,
          areaTerreno: true,
          areaEdificada: true,
          statusCaptacao: true,
          interesse: true,
        },
        orderBy: {
          criadoEm: "desc",
        },
      });

      if (imoveis.length === 0) {
        console.log(`[TOOL] buscar_imovel - Nenhum imóvel encontrado`);
        return {
          success: false,
          message: "Ainda não temos imóveis cadastrados para este lead.",
          imoveis: [],
        };
      }

      // Formatar endereços
      const imoveisFormatados = imoveis.map((imovel) => ({
        endereco: `${imovel.logradouro}${imovel.numero ? `, ${imovel.numero}` : ""}${imovel.complemento ? ` - ${imovel.complemento}` : ""} - ${imovel.bairro}`,
        edificio: imovel.nomeEdificio,
        areaTerreno: imovel.areaTerreno ? `${imovel.areaTerreno}m²` : null,
        areaEdificada: imovel.areaEdificada
          ? `${imovel.areaEdificada}m²`
          : null,
        iptu: imovel.inscricaoIptu,
        status: imovel.statusCaptacao,
        interesse: imovel.interesse,
      }));

      console.log(
        `[TOOL] buscar_imovel - ${imoveis.length} imóvel(is) encontrado(s)`
      );

      return {
        success: true,
        totalImoveis: imoveis.length,
        imoveis: imoveisFormatados,
      };
    } catch (error) {
      console.error("[TOOL] buscar_imovel - Erro:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Erro ao buscar imóveis",
        imoveis: [],
      };
    }
  },
};

// ====================================
// TOOL 4: Registrar Opt-out
// ====================================

export const registrarOptoutTool = {
  name: 'registrar_optout',
  description: 'Registra que o contato NÃO quer mais receber mensagens. Use IMEDIATAMENTE quando o contato pedir para parar de enviar mensagens, disser "não me ligue", "para", "spam", ou qualquer variação de pedido para não ser mais contatado. RESPEITE sempre o pedido!',

  parameters: z.object({
    contatoId: z.string().describe('ID do contato ou lead no banco de dados'),
    motivo: z.enum([
      'NAO_INCOMODAR',      // "Para de me mandar mensagem"
      'JA_TEM_IMOBILIARIA', // "Já tenho imobiliária"
      'SEM_INTERESSE_AGORA', // "Não tenho interesse no momento"
      'IMOVEL_VENDIDO',     // "Já vendi o imóvel"
      'NAO_E_PROPRIETARIO', // "Não sou mais o dono"
      'OUTRO'               // Outros motivos
    ]).describe('Motivo do opt-out informado pelo contato'),
    observacao: z.string().optional().describe('Observação adicional sobre o motivo do opt-out')
  }),

  execute: async (args: {
    contatoId: string;
    motivo: string;
    observacao?: string;
  }) => {
    try {
      console.log(`[TOOL] registrar_optout - Contato ${args.contatoId} - Motivo: ${args.motivo}`);

      // Tentar atualizar como Contato primeiro (prospecção ativa)
      try {
        await prisma.contato.update({
          where: { id: args.contatoId },
          data: {
            statusProspeccao: 'OPTOUT',
            motivoDesinteresse: args.motivo,
            observacoes: args.observacao || `Opt-out registrado: ${args.motivo}`,
            atualizadoEm: new Date()
          }
        });
        console.log(`[TOOL] registrar_optout - Contato marcado como opt-out`);
      } catch {
        // Se não for Contato, tenta como Lead
        try {
          await prisma.lead.update({
            where: { id: args.contatoId },
            data: {
              status: 'PERDIDO',
              ultimaInteracao: new Date()
            }
          });

          // Registrar atividade
          await prisma.atividade.create({
            data: {
              leadId: args.contatoId,
              tipo: 'NOTA',
              titulo: 'Opt-out solicitado',
              descricao: `Lead solicitou não ser mais contatado.\nMotivo: ${args.motivo}${args.observacao ? `\nObservação: ${args.observacao}` : ''}`,
              criadoPor: 'ai_agent',
              completadoEm: new Date()
            }
          });
          console.log(`[TOOL] registrar_optout - Lead marcado como opt-out`);
        } catch (leadError) {
          console.error(`[TOOL] registrar_optout - Erro ao atualizar Lead:`, leadError);
        }
      }

      // Encerrar conversa ativa se existir
      await prisma.conversa.updateMany({
        where: {
          leadId: args.contatoId,
          estadoConversa: 'ativa'
        },
        data: {
          estadoConversa: 'concluida',
          finalizadaEm: new Date()
        }
      });

      console.log(`[TOOL] registrar_optout - Sucesso! Opt-out registrado.`);

      return {
        success: true,
        message: 'Opt-out registrado com sucesso. O contato não receberá mais mensagens.',
        motivo: args.motivo
      };

    } catch (error) {
      console.error('[TOOL] registrar_optout - Erro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao registrar opt-out'
      };
    }
  }
};

// ====================================
// TOOL 5: Converter Contato para Lead
// ====================================

export const converterParaLeadTool = {
  name: 'converter_para_lead',
  description: `FERRAMENTA PRINCIPAL para prospecção ativa! Use quando o proprietário demonstrou interesse REAL em vender ou alugar.
  
QUANDO USAR:
- Proprietário confirmou que TEM interesse em vender/alugar
- Você coletou: tipo de interesse (venda/locação), timeline aproximado, e dados básicos do imóvel

QUANDO NÃO USAR:
- Proprietário só perguntou informações
- Não confirmou interesse real
- Disse que não quer vender/alugar

Esta ferramenta converte o CONTATO (proprietário minerado) em LEAD (oportunidade qualificada).`,

  parameters: z.object({
    contatoId: z.string().describe('ID do contato que está sendo convertido'),

    // Dados da qualificação
    temperatura: z.enum(['MORNO', 'QUENTE']).describe(
      'QUENTE: quer vender/alugar em até 3 meses, urgência real. MORNO: tem interesse mas sem pressa definida'
    ),
    tipoInteresse: z.enum(['VENDA', 'LOCACAO', 'AMBOS']).describe(
      'O que o proprietário quer fazer com o imóvel'
    ),
    timeline: z.string().describe(
      'Quando pretende vender/alugar. Ex: "1 mês", "3 meses", "sem pressa", "urgente"'
    ),

    // Dados do imóvel (se coletados)
    tipoImovel: z.string().optional().describe('Tipo: apartamento, casa, terreno, comercial'),
    quartos: z.number().optional().describe('Quantidade de quartos'),
    area: z.string().optional().describe('Área aproximada em m²'),
    valorPretendido: z.string().optional().describe('Valor que pretende receber'),
    imovelOcupado: z.boolean().optional().describe('Se o imóvel está ocupado ou vazio'),

    // Contexto
    motivacao: z.string().optional().describe('Por que quer vender/alugar'),
    observacoes: z.string().optional().describe('Outras informações relevantes')
  }),

  execute: async (args: {
    contatoId: string;
    temperatura: 'MORNO' | 'QUENTE';
    tipoInteresse: 'VENDA' | 'LOCACAO' | 'AMBOS';
    timeline: string;
    tipoImovel?: string;
    quartos?: number;
    area?: string;
    valorPretendido?: string;
    imovelOcupado?: boolean;
    motivacao?: string;
    observacoes?: string;
  }) => {
    try {
      console.log(`[TOOL] converter_para_lead - Contato ${args.contatoId} → Lead ${args.temperatura}`);

      // 1. Buscar o contato
      const contato = await prisma.contato.findUnique({
        where: { id: args.contatoId },
        include: { campanha: true }
      });

      if (!contato) {
        return {
          success: false,
          error: 'Contato não encontrado'
        };
      }

      if (contato.virouLead) {
        return {
          success: false,
          error: 'Este contato já foi convertido em lead anteriormente',
          leadId: contato.leadId
        };
      }

      // 2. Criar o Lead
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
          ultimaInteracao: new Date(),
          // Tracking IA
          ultimaAcaoIA: `Contato convertido em Lead ${args.temperatura}`,
          ultimaAcaoIAEm: new Date()
        }
      });

      console.log(`[TOOL] converter_para_lead - Lead criado: ${novoLead.id}`);

      // 3. Atualizar o Contato
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

      // 4. Montar descrição da qualificação
      const detalhes: string[] = [];
      detalhes.push(`Interesse: ${args.tipoInteresse}`);
      detalhes.push(`Timeline: ${args.timeline}`);
      detalhes.push(`Temperatura: ${args.temperatura}`);
      if (args.tipoImovel) detalhes.push(`Tipo: ${args.tipoImovel}`);
      if (args.quartos) detalhes.push(`Quartos: ${args.quartos}`);
      if (args.area) detalhes.push(`Área: ${args.area}`);
      if (args.valorPretendido) detalhes.push(`Valor pretendido: ${args.valorPretendido}`);
      if (args.imovelOcupado !== undefined) detalhes.push(`Ocupado: ${args.imovelOcupado ? 'Sim' : 'Não'}`);
      if (args.motivacao) detalhes.push(`Motivação: ${args.motivacao}`);
      if (args.observacoes) detalhes.push(`Obs: ${args.observacoes}`);

      // 5. Registrar atividade
      await prisma.atividade.create({
        data: {
          leadId: novoLead.id,
          tipo: 'NOTA',
          titulo: `🎯 Lead qualificado via prospecção ativa`,
          descricao: `Origem: Campanha "${contato.campanha.nome}"\nEdifício: ${contato.nomeEdificio || 'N/A'}\n\n${detalhes.join('\n')}`,
          criadoPor: 'sdr_ia',
          completadoEm: new Date()
        }
      });

      // 6. Se QUENTE, criar tarefa para corretor
      if (args.temperatura === 'QUENTE') {
        await prisma.atividade.create({
          data: {
            leadId: novoLead.id,
            tipo: 'TAREFA',
            titulo: `🔥 URGENTE: Contato com lead quente!`,
            descricao: `Lead qualificado pelo SDR com alta urgência.\nTimeline: ${args.timeline}\n\nEntrar em contato o mais rápido possível!`,
            criadoPor: 'sdr_ia'
          }
        });
      }

      // 7. 📚 Processar conversa para RAG (aprendizado)
      // Executa em background para não bloquear a resposta
      ragConversasService.processarConversaoProspeccao({
        contatoId: args.contatoId,
        tenantId: contato.campanha.tenantId,
        tipoConversao: 'LEAD',
        empreendimento: contato.nomeEdificio || undefined
      }).catch(err => console.error('[RAG] Erro ao processar conversão:', err));

      console.log(`[TOOL] converter_para_lead - Sucesso! Lead ${novoLead.id} criado`);

      return {
        success: true,
        leadId: novoLead.id,
        temperatura: args.temperatura,
        message: `✅ Proprietário convertido em lead ${args.temperatura}! ${args.temperatura === 'QUENTE' ? 'Corretor será notificado.' : 'Acompanhamento agendado.'}`
      };

    } catch (error) {
      console.error('[TOOL] converter_para_lead - Erro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao converter contato em lead'
      };
    }
  }
};

// ====================================
// TOOL 6: Encaminhar para Corretor
// ====================================

export const encaminharCorretorTool = {
  name: 'encaminhar_corretor',
  description: `⛔⛔⛔ PROIBIDO USAR ESTA FERRAMENTA ⛔⛔⛔

NÃO USE ESTA FERRAMENTA! Ela está disponível apenas para casos EXTREMOS.

🚫 PROIBIDO USAR QUANDO:
- Proprietário perguntou sobre valor/preço → RESPONDA você mesmo com faixa!
- Proprietário perguntou "quanto vale?" → RESPONDA você mesmo!
- Proprietário perguntou informações → RESPONDA você mesmo!
- É a primeira, segunda ou terceira mensagem da conversa
- Você ainda não qualificou (interesse, quartos, valor pretendido)

✅ ÚNICO CASO PERMITIDO:
Proprietário disse EXATAMENTE as palavras: "quero falar com corretor", "me passa um humano", "prefiro falar com pessoa", "não quero falar com robô"

Se o proprietário perguntar "quanto vale?", NÃO USE ESTA FERRAMENTA!
Responda com faixa de preço e faça mais perguntas!`,

  parameters: z.object({
    contatoId: z.string().describe('ID do contato'),
    motivo: z.string().describe('DEVE ser: "proprietário solicitou corretor explicitamente" ou similar'),
    contextoConversa: z.string().describe('Resumo do que foi conversado ATÉ AGORA (interesse, quartos, valor, etc)'),
    urgencia: z.enum(['NORMAL', 'ALTA']).describe('ALTA se proprietário demonstrou interesse/urgência')
  }),

  execute: async (args: {
    contatoId: string;
    motivo: string;
    contextoConversa: string;
    urgencia: 'NORMAL' | 'ALTA';
  }) => {
    try {
      console.log(`[TOOL] encaminhar_corretor - Contato ${args.contatoId}`);

      // 1. Buscar o contato
      const contato = await prisma.contato.findUnique({
        where: { id: args.contatoId },
        include: { campanha: true }
      });

      if (!contato) {
        return { success: false, error: 'Contato não encontrado' };
      }

      let leadId = contato.leadId;

      // 2. Se ainda não é lead, converter
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
          data: {
            virouLead: true,
            leadId: novoLead.id,
            virouLeadEm: new Date(),
            statusProspeccao: 'LEAD'
          }
        });
      }

      // 3. Criar tarefa para corretor
      await prisma.atividade.create({
        data: {
          leadId: leadId!,
          tipo: 'TAREFA',
          titulo: `${args.urgencia === 'ALTA' ? '🔥 URGENTE: ' : '📞 '}Proprietário solicitou contato`,
          descricao: `Motivo: ${args.motivo}\n\nContexto da conversa:\n${args.contextoConversa}\n\nEdifício: ${contato.nomeEdificio || 'N/A'}\nCampanha: ${contato.campanha.nome}`,
          criadoPor: 'sdr_ia'
        }
      });

      console.log(`[TOOL] encaminhar_corretor - Sucesso! Tarefa criada para lead ${leadId}`);

      return {
        success: true,
        leadId,
        message: `Perfeito! Vou passar seu contato para um de nossos corretores. ${args.urgencia === 'ALTA' ? 'Ele entrará em contato em breve!' : 'Em breve entraremos em contato!'}`
      };

    } catch (error) {
      console.error('[TOOL] encaminhar_corretor - Erro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao encaminhar para corretor'
      };
    }
  }
};

// ====================================
// TOOL 7: Agendar Avaliação com Corretor
// ====================================

export const agendarAvaliacaoTool = {
  name: 'agendar_avaliacao',
  description: `Use esta ferramenta quando o proprietário demonstrar interesse em anunciar o imóvel e concordar com uma visita de avaliação.
O SDR pode agendar diretamente a visita - não precisa passar para humano.
A data/horário deve ser confirmada na conversa ANTES de usar esta ferramenta.`,

  parameters: z.object({
    contatoId: z.string().uuid().describe('ID do contato (proprietário) no banco de dados'),

    dataAvaliacao: z.string().describe(
      'Data e hora da avaliação no formato "DD/MM/YYYY HH:mm". Exemplo: "15/12/2025 10:30"'
    ),

    observacoes: z.string().optional().describe(
      'Observações para o corretor: instruções de acesso, portaria, melhor forma de contato, etc.'
    ),

    // Informações complementares
    enderecoImovel: z.string().optional().describe('Endereço completo do imóvel se diferente do cadastrado'),
    tipoImovel: z.string().optional().describe('Tipo do imóvel: apartamento, casa, sala comercial, etc.'),
    areaAproximada: z.string().optional().describe('Área aproximada em m²')
  }),

  execute: async (args: {
    contatoId: string;
    dataAvaliacao: string;
    observacoes?: string;
    enderecoImovel?: string;
    tipoImovel?: string;
    areaAproximada?: string;
  }) => {
    try {
      console.log(`[TOOL] agendar_avaliacao - Contato ${args.contatoId}`);

      // Buscar contato
      const contato = await prisma.contato.findUnique({
        where: { id: args.contatoId },
        include: {
          campanha: true
        }
      });

      if (!contato) {
        return { success: false, error: 'Contato não encontrado' };
      }

      // Parsear data no formato DD/MM/YYYY HH:mm
      const [dataParte, horaParte] = args.dataAvaliacao.split(' ');
      const [dia, mes, ano] = dataParte.split('/').map(Number);
      const [hora, minuto] = (horaParte || '10:00').split(':').map(Number);

      const dataAgendamento = new Date(ano, mes - 1, dia, hora, minuto);

      if (isNaN(dataAgendamento.getTime())) {
        return { success: false, error: 'Data inválida. Use o formato DD/MM/YYYY HH:mm' };
      }

      // Validar tenantId antes de continuar
      const tenantId = contato.campanha?.tenantId;
      if (!tenantId) {
        return { success: false, error: 'Campanha sem tenant configurado' };
      }

      // Se ainda não virou Lead, converter primeiro
      let leadId = contato.leadId;

      if (!contato.virouLead || !leadId) {
        // Criar Lead
        const novoLead = await prisma.lead.create({
          data: {
            nome: contato.nome,
            telefone: contato.telefone,
            status: 'QUALIFICADO',
            temperatura: 'QUENTE',
            origem: 'PROSPECCAO_ATIVA',
            tenantId: tenantId,
            cpf: contato.cpf
          }
        });

        leadId = novoLead.id;

        // Atualizar contato
        await prisma.contato.update({
          where: { id: args.contatoId },
          data: {
            virouLead: true,
            leadId: novoLead.id,
            statusProspeccao: 'LEAD'
          }
        });
      }

      // Montar descrição da tarefa
      const detalhes: string[] = [];
      detalhes.push(`📅 DATA: ${args.dataAvaliacao}`);
      detalhes.push(`📍 ENDEREÇO: ${args.enderecoImovel || contato.enderecoImovel || 'Confirmar com proprietário'}`);
      if (args.tipoImovel || contato.tipoImovel) {
        detalhes.push(`🏠 TIPO: ${args.tipoImovel || contato.tipoImovel}`);
      }
      if (args.areaAproximada) {
        detalhes.push(`📐 ÁREA: ${args.areaAproximada}`);
      }
      detalhes.push(`📞 TELEFONE: ${contato.telefone}`);
      if (args.observacoes) {
        detalhes.push(`\n📝 OBSERVAÇÕES:\n${args.observacoes}`);
      }

      // Gerar token único para confirmação
      const tokenConfirmacao = randomUUID();

      // Usar db como any para evitar problemas de cache do TypeScript
      const db: any = prisma;

      // Criar atividade/tarefa de avaliação com token de confirmação
      const atividade = await db.atividade.create({
        data: {
          leadId: leadId!,
          tipo: 'AVALIACAO', // Tipo específico para avaliações
          titulo: `🏠 AVALIAÇÃO AGENDADA - ${contato.nome}`,
          descricao: detalhes.join('\n'),
          criadoPor: 'sdr_agent',
          agendadoPara: dataAgendamento,
          // Campos de confirmação
          statusAgendamento: 'PENDENTE',
          tokenConfirmacao: tokenConfirmacao,
          confirmacoesEnviadas: 0
        }
      });

      // Atualizar status do contato
      await prisma.contato.update({
        where: { id: args.contatoId },
        data: {
          statusProspeccao: 'INTERESSADO',
          observacoes: `Avaliação agendada para ${args.dataAvaliacao}`
        }
      });

      // 📚 Processar conversa para RAG (aprendizado)
      // Executa em background para não bloquear a resposta
      ragConversasService.processarConversaoProspeccao({
        contatoId: args.contatoId,
        tenantId: contato.campanha.tenantId,
        tipoConversao: 'AGENDAMENTO',
        empreendimento: contato.nomeEdificio || undefined
      }).catch(err => console.error('[RAG] Erro ao processar conversão:', err));

      // Gerar link de confirmação
      const linkConfirmacao = `/confirmar/${atividade.id}/${tokenConfirmacao}`;

      console.log(`[TOOL] agendar_avaliacao - Sucesso! Agendado para ${args.dataAvaliacao}`);
      console.log(`[TOOL] agendar_avaliacao - Link confirmação: ${linkConfirmacao}`);

      return {
        success: true,
        message: `Avaliação agendada com sucesso para ${args.dataAvaliacao}`,
        leadId: leadId,
        atividadeId: atividade.id,
        dataAgendamento: dataAgendamento.toISOString(),
        linkConfirmacao: linkConfirmacao,
        tokenConfirmacao: tokenConfirmacao
      };

    } catch (error) {
      console.error('[TOOL] agendar_avaliacao - Erro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao agendar avaliação'
      };
    }
  }
};

// ====================================
// TOOL 8: Agendar Follow-up Futuro (MORNO_FUTURO)
// ====================================

export const agendarFollowupTool = {
  name: 'agendar_followup',
  description: `Use quando o proprietário demonstrar algum interesse mas NÃO quer vender/alugar agora.
Exemplos: "talvez no próximo ano", "vou pensar e te retorno", "agora não é o momento".
Esta ferramenta marca o contato como MORNO_FUTURO e agenda um recontato automático.`,

  parameters: z.object({
    contatoId: z.string().uuid().describe('ID do contato no banco de dados'),

    dataRecontato: z.string().describe(
      'Data para recontato no formato "DD/MM/YYYY". Exemplo: "15/03/2026"'
    ),

    motivo: z.string().describe(
      'Motivo pelo qual não quer agora. Exemplo: "inquilino sai em 6 meses", "precisa de reforma primeiro"'
    ),

    observacoes: z.string().optional().describe(
      'Observações adicionais para o recontato futuro'
    )
  }),

  execute: async (args: {
    contatoId: string;
    dataRecontato: string;
    motivo: string;
    observacoes?: string;
  }) => {
    try {
      console.log(`[TOOL] agendar_followup - Contato ${args.contatoId} para ${args.dataRecontato}`);

      // Parsear data
      const [dia, mes, ano] = args.dataRecontato.split('/').map(Number);
      const dataAgendamento = new Date(ano, mes - 1, dia, 9, 0); // 9h da manhã

      if (isNaN(dataAgendamento.getTime())) {
        return { success: false, error: 'Data inválida. Use o formato DD/MM/YYYY' };
      }

      // Atualizar contato
      await prisma.contato.update({
        where: { id: args.contatoId },
        data: {
          statusProspeccao: 'MORNO_FUTURO',
          dataRecontato: dataAgendamento,
          motivoRecontato: args.motivo,
          observacoes: args.observacoes ?
            `${args.observacoes}\n\n---\nMotivo do futuro: ${args.motivo}` :
            `Motivo do futuro: ${args.motivo}`
        }
      });

      console.log(`[TOOL] agendar_followup - Sucesso! Recontato em ${args.dataRecontato}`);

      return {
        success: true,
        message: `Recontato agendado para ${args.dataRecontato}. Motivo: ${args.motivo}`,
        dataRecontato: dataAgendamento.toISOString()
      };

    } catch (error) {
      console.error('[TOOL] agendar_followup - Erro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao agendar follow-up'
      };
    }
  }
};

// ====================================
// Exportar todas as ferramentas
// ====================================

export const todasFerramentasSDR = [
  qualificarLeadTool,
  solicitarHumanoTool,
  buscarImovelTool,
  registrarOptoutTool,
  converterParaLeadTool,
  encaminharCorretorTool,
  agendarAvaliacaoTool,
  agendarFollowupTool,
];
