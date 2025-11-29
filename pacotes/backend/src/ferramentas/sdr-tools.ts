import { z } from "zod";
import { prisma } from "../servidor";

/**
 * FERRAMENTAS DO SDR (Sales Development Representative)
 *
 * Estas ferramentas são usadas pelo SDR Worker para:
 * - Qualificar leads automaticamente
 * - Solicitar intervenção humana quando necessário
 * - Buscar informações de imóveis
 */

// ====================================
// TOOL 1: Qualificar Lead
// ====================================

export const qualificarLeadTool = {
  name: 'qualificar_lead',
  description: 'IMPORTANTE: Só use esta ferramenta DEPOIS de coletar TODAS as informações através da conversa! Você DEVE ter perguntado e recebido respostas sobre: interesse (VENDER/ALUGAR), timeline (quando pretende) e orçamento (faixa de valor). Se ainda não coletou essas informações, NÃO chame esta ferramenta - continue a conversa!',
  
  parameters: z.object({
    leadId: z.string().uuid().describe('ID do lead no banco de dados'),
    
    // CAMPOS OBRIGATÓRIOS - GPT DEVE coletar antes de chamar!
    temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).describe(
      'OBRIGATÓRIO! QUENTE: timeline ≤ 3 meses + urgência. MORNO: interesse genuíno sem urgência. FRIO: sem interesse ou timeline muito longo'
    ),
    interesse: z.string().min(1).describe(
      'OBRIGATÓRIO! O que o lead quer: VENDER, ALUGAR, COMPRAR, ou AMBOS. Você DEVE ter perguntado isso!'
    ),
    timeline: z.string().min(1).describe(
      'OBRIGATÓRIO! Quando pretende vender/alugar. Exemplos: "2 meses", "urgente", "sem pressa", "6 meses". Você DEVE ter perguntado isso!'
    ),
    
    // Opcionais mas recomendados
    orcamento: z.string().optional().describe('Faixa de valor mencionada pelo lead'),
    motivacao: z.string().optional().describe('Motivo para vender/alugar (ex: "mudança de cidade", "upgrade")'),
    estadoImovel: z.string().optional().describe('Estado do imóvel: ocupado ou vazio'),
    observacoes: z.string().optional().describe('Outras observações relevantes da conversa')
  }),

  execute: async (args: {
    leadId: string;
    temperatura: 'FRIO' | 'MORNO' | 'QUENTE';
    interesse: string;
    timeline: string;
    orcamento?: string;
    motivacao?: string;
    estadoImovel?: string;
    observacoes?: string;
  }) => {
    try {
      console.log(
        `[TOOL] qualificar_lead - Lead ${args.leadId} → ${args.temperatura}`
      );

      // Atualizar lead
      await prisma.lead.update({
        where: { id: args.leadId },
        data: {
          temperatura: args.temperatura,
          status: "QUALIFICADO",
          ultimaInteracao: new Date(),
        },
      });

      // Montar descrição da qualificação
      const detalhes: string[] = [];
      detalhes.push(`Interesse: ${args.interesse}`);
      detalhes.push(`Timeline: ${args.timeline}`);
      if (args.orcamento) detalhes.push(`Orçamento: ${args.orcamento}`);
      if (args.motivacao) detalhes.push(`Motivação: ${args.motivacao}`);
      if (args.estadoImovel) detalhes.push(`Estado: ${args.estadoImovel}`);
      if (args.observacoes) detalhes.push(`Obs: ${args.observacoes}`);

      // Registrar atividade de qualificação
      await prisma.atividade.create({
        data: {
          leadId: args.leadId,
          tipo: "NOTA",
          titulo: `Lead classificado como ${args.temperatura}`,
          descricao: detalhes.join("\n"),
          criadoPor: "ai_agent",
          completadoEm: new Date(),
        },
      });

      console.log(
        `[TOOL] qualificar_lead - Sucesso! Lead agora é ${args.temperatura}`
      );

      return {
        success: true,
        temperatura: args.temperatura,
        message: `Lead qualificado com sucesso como ${args.temperatura}`,
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
  description:
    "Solicita intervenção de um corretor humano. Use quando: lead está QUENTE (alta urgência), lead solicita falar com pessoa, ou lead tem perguntas complexas sobre documentação/valores que você não pode responder.",

  parameters: z.object({
    leadId: z.string().uuid().describe("ID do lead no banco de dados"),
    motivo: z
      .string()
      .describe(
        "Motivo detalhado para solicitar humano. Seja específico sobre o que o lead precisa."
      ),
    urgencia: z
      .enum(["BAIXA", "MEDIA", "ALTA"])
      .describe(
        "ALTA: lead QUENTE ou solicitou corretor. MEDIA: dúvidas complexas. BAIXA: acompanhamento futuro"
      ),
    contexto: z
      .string()
      .optional()
      .describe("Resumo da conversa até agora para o corretor"),
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
            status: "ATIVA",
          },
          data: {
            status: "CONCLUIDA",
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
// Exportar todas as ferramentas
// ====================================

export const todasFerramentasSDR = [
  qualificarLeadTool,
  solicitarHumanoTool,
  buscarImovelTool,
];
