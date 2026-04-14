/**
 * Serviço de Disparo de Campanhas de Prospecção Ativa
 * 
 * Orquestra o envio de mensagens em massa com:
 * - Rate limiting para não ser bloqueado pelo WhatsApp
 * - Fila de processamento assíncrono
 * - Registro de tentativas e status
 * - Suporte a múltiplas tentativas (follow-ups)
 * - Verificação de janela de horário comercial
 * - Blacklist de telefones
 */

import { Contato, Campanha } from '@prisma/client';
import { prisma } from '../lib/db';
import { getWhatsAppService } from './whatsapp';
import { blacklistService } from './blacklist';
import {
  gerarPrimeiraMensagem,
  gerarFollowUp,
  substituirVariaveis,
  VariaveisTemplate
} from '../agentes/templates-prospeccao';

// ============================================
// CACHE DO NOME DO AGENTE
// ============================================

// Cache simples para evitar múltiplas consultas ao banco
const cacheNomeAgente: Map<string, { nome: string; expiraEm: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Busca o nome do agente configurado para o tenant
 * Usa cache para evitar consultas repetidas
 */
async function buscarNomeAgente(tenantId: string): Promise<string> {
  // Verificar cache
  const cached = cacheNomeAgente.get(tenantId);
  if (cached && cached.expiraEm > Date.now()) {
    return cached.nome;
  }

  // Buscar do banco
  const agente = await prisma.configuracaoAgente.findFirst({
    where: {
      tenantId,
      estaAtivo: true
    },
    select: { nome: true }
  });

  // Usar nome do banco OU o config padrão do SDR Worker (Sofia)
  const nome = agente?.nome || 'Sofia';

  // Salvar no cache
  cacheNomeAgente.set(tenantId, {
    nome,
    expiraEm: Date.now() + CACHE_TTL_MS
  });

  return nome;
}

// ============================================
// CONFIGURAÇÕES PADRÃO
// ============================================

const CONFIG_PADRAO = {
  // Rate limiting
  MENSAGENS_POR_MINUTO: 20,
  DELAY_ENTRE_MENSAGENS_MS: 3000, // 3 segundos entre mensagens
  DELAY_APOS_LOTE_MS: 60000, // 1 minuto após cada lote de 20

  // Limites
  MAX_TENTATIVAS: 3,
  HORAS_ENTRE_PRIMEIRO_FOLLOWUP: 2, // 1º follow-up: 2h após primeira mensagem
  HORAS_ENTRE_SEGUNDO_FOLLOWUP: 24, // 2º follow-up: 24h após o primeiro follow-up
  DIAS_ENTRE_TENTATIVAS: 2, // Esperar 2 dias entre follow-ups

  // Tamanho do lote
  TAMANHO_LOTE: 20,

  // Janela de horário (horário de Brasília)
  HORARIO_INICIO: '08:00',
  HORARIO_FIM: '18:00',
  DIAS_SEMANA: ['seg', 'ter', 'qua', 'qui', 'sex'], // Segunda a Sexta
};

// Mapeamento de dia da semana
const DIAS_SEMANA_MAP: Record<number, string> = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab'
};

// ============================================
// TIPOS
// ============================================

interface ConfigDisparo {
  mensagensPorMinuto?: number;
  atrasoEntreMensagens?: number;
  maxTentativas?: number;
  horasEntrePrimeiroFollowup?: number;
  horasEntreSegundoFollowup?: number;
  diasEntreTentativas?: number;
  horarioInicio?: string;
  horarioFim?: string;
  diasSemana?: string[];
}

interface ResultadoDisparo {
  sucesso: boolean;
  contatoId: string;
  telefone: string;
  erro?: string;
  messageId?: string;
}

interface StatusCampanha {
  total: number;
  aguardando: number;
  contatando: number;
  respondeu: number;
  semInteresse: number;
  interessado: number;
  optout: number;
  falha: number;
}

interface ResultadoDisparoCampanha {
  campanhaId: string;
  iniciado: boolean;
  totalContatos: number;
  contatosEnviados: number;
  erros: number;
  status: StatusCampanha;
  mensagem: string;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Delay assíncrono
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formata telefone para o padrão WhatsApp
 */
function formatarTelefone(telefone: string): string {
  let numero = telefone.replace(/\D/g, '');

  // Se tiver 10 ou 11 dígitos, adiciona 55 (Brasil)
  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  }

  return numero;
}

/**
 * Verifica se o horário atual está dentro da janela de disparo
 */
function estaDentroDoHorario(config: ConfigDisparo): boolean {
  const agora = new Date();

  // Converter para horário de Brasília (UTC-3)
  const horaBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

  const horaAtual = horaBrasilia.getHours();
  const minutoAtual = horaBrasilia.getMinutes();
  const diaSemana = horaBrasilia.getDay();

  // Verificar dia da semana
  const diaAtual = DIAS_SEMANA_MAP[diaSemana];
  const diasPermitidos = config.diasSemana || CONFIG_PADRAO.DIAS_SEMANA;

  if (!diasPermitidos.includes(diaAtual)) {
    console.log(`[Disparo] ⏰ Dia ${diaAtual} não está na lista de dias permitidos`);
    return false;
  }

  // Verificar horário
  const [horaInicio, minInicio] = (config.horarioInicio || CONFIG_PADRAO.HORARIO_INICIO).split(':').map(Number);
  const [horaFim, minFim] = (config.horarioFim || CONFIG_PADRAO.HORARIO_FIM).split(':').map(Number);

  const minutosAtual = horaAtual * 60 + minutoAtual;
  const minutosInicio = horaInicio * 60 + minInicio;
  const minutosFim = horaFim * 60 + minFim;

  if (minutosAtual < minutosInicio || minutosAtual >= minutosFim) {
    console.log(`[Disparo] ⏰ Horário ${horaAtual}:${minutoAtual.toString().padStart(2, '0')} fora da janela ${config.horarioInicio || CONFIG_PADRAO.HORARIO_INICIO}-${config.horarioFim || CONFIG_PADRAO.HORARIO_FIM}`);
    return false;
  }

  return true;
}

/**
 * Calcula tempo em ms até o próximo horário de disparo permitido
 */
function calcularTempoAteProximaJanela(config: ConfigDisparo): number {
  const agora = new Date();
  const horaBrasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

  const [horaInicio, minInicio] = (config.horarioInicio || CONFIG_PADRAO.HORARIO_INICIO).split(':').map(Number);
  const [horaFim, minFim] = (config.horarioFim || CONFIG_PADRAO.HORARIO_FIM).split(':').map(Number);

  const horaAtual = horaBrasilia.getHours();
  const minutoAtual = horaBrasilia.getMinutes();

  // Se já passou do horário fim, próxima janela é amanhã no horário início
  if (horaAtual >= horaFim || (horaAtual === horaFim && minutoAtual >= minFim)) {
    const amanha = new Date(horaBrasilia);
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(horaInicio, minInicio, 0, 0);
    return amanha.getTime() - horaBrasilia.getTime();
  }

  // Se ainda não chegou no horário início
  if (horaAtual < horaInicio || (horaAtual === horaInicio && minutoAtual < minInicio)) {
    const proximoInicio = new Date(horaBrasilia);
    proximoInicio.setHours(horaInicio, minInicio, 0, 0);
    return proximoInicio.getTime() - horaBrasilia.getTime();
  }

  // Está dentro da janela
  return 0;
}

/**
 * Verifica se pode enviar follow-up (passou tempo mínimo)
 */
function podeEnviarFollowUp(contato: Contato, maxTentativas: number = CONFIG_PADRAO.MAX_TENTATIVAS): boolean {
  if (!contato.ultimaTentativa) return true;
  if (contato.tentativasContato >= maxTentativas) return false;

  // Primeiro follow-up (tentativa 2): janela curta de 2 horas
  if (contato.tentativasContato === 1) {
    const horasDesdeUltima = (Date.now() - contato.ultimaTentativa.getTime()) / (1000 * 60 * 60);
    return horasDesdeUltima >= CONFIG_PADRAO.HORAS_ENTRE_PRIMEIRO_FOLLOWUP;
  }

  // Segundo follow-up (tentativa 3): 24 horas após o primeiro follow-up
  if (contato.tentativasContato === 2) {
    const horasDesdeUltima = (Date.now() - contato.ultimaTentativa.getTime()) / (1000 * 60 * 60);
    return horasDesdeUltima >= CONFIG_PADRAO.HORAS_ENTRE_SEGUNDO_FOLLOWUP;
  }

  const diasDesdeUltima = Math.floor(
    (Date.now() - contato.ultimaTentativa.getTime()) / (1000 * 60 * 60 * 24)
  );

  return diasDesdeUltima >= CONFIG_PADRAO.DIAS_ENTRE_TENTATIVAS;
}

/**
 * Retorna a janela mínima (em horas) entre tentativas, de acordo com a tentativa anterior.
 * tentativasContato=1 => 2h, tentativasContato=2 => 24h, demais => dias configurados.
 */
export function obterAtrasoMinimoFollowupHoras(tentativasContato: number): number {
  if (tentativasContato <= 1) return CONFIG_PADRAO.HORAS_ENTRE_PRIMEIRO_FOLLOWUP;
  if (tentativasContato === 2) return CONFIG_PADRAO.HORAS_ENTRE_SEGUNDO_FOLLOWUP;
  return CONFIG_PADRAO.DIAS_ENTRE_TENTATIVAS * 24;
}

/**
 * Busca o telefone válido do contato (tenta em ordem)
 */
function obterTelefoneValido(contato: Contato): string | null {
  const telefones = [
    contato.telefone,
    contato.telefone2,
    contato.telefone3,
    contato.telefone4,
    contato.telefone5
  ].filter(Boolean) as string[];

  // Se tiver telefonesJson, prioriza os com WhatsApp
  if (contato.telefonesJson) {
    try {
      const lista = contato.telefonesJson as any[];
      const comWhatsapp = lista.filter(t => t.whatsapp === true);
      if (comWhatsapp.length > 0) {
        return comWhatsapp[0].numero;
      }
    } catch (e) {
      // Ignora erro de parsing
    }
  }

  return telefones[0] || null;
}

// ============================================
// SERVIÇO PRINCIPAL
// ============================================

export class DisparoCampanhaService {

  /**
   * Busca status atual da campanha
   */
  async obterStatusCampanha(campanhaId: string): Promise<StatusCampanha> {
    const contagens = await prisma.contato.groupBy({
      by: ['statusProspeccao'],
      where: { campanhaId },
      _count: true
    });

    const status: StatusCampanha = {
      total: 0,
      aguardando: 0,
      contatando: 0,
      respondeu: 0,
      semInteresse: 0,
      interessado: 0,
      optout: 0,
      falha: 0
    };

    for (const item of contagens) {
      const count = item._count;
      status.total += count;

      switch (item.statusProspeccao) {
        case 'AGUARDANDO': status.aguardando = count; break;
        case 'CONTATANDO': status.contatando = count; break;
        case 'RESPONDEU': status.respondeu = count; break;
        case 'SEM_INTERESSE': status.semInteresse = count; break;
        case 'INTERESSADO': status.interessado = count; break;
        case 'OPTOUT': status.optout = count; break;
        case 'FALHA': status.falha = count; break;
      }
    }

    return status;
  }

  /**
   * Busca contatos elegíveis para disparo
   */
  async buscarContatosParaDisparo(
    campanhaId: string,
    limite: number = CONFIG_PADRAO.TAMANHO_LOTE,
    maxTentativas: number = CONFIG_PADRAO.MAX_TENTATIVAS,
    configFollowup?: Pick<ConfigDisparo, 'horasEntrePrimeiroFollowup' | 'horasEntreSegundoFollowup' | 'diasEntreTentativas'>
  ): Promise<Contato[]> {
    // Contatos AGUARDANDO (nunca contatados)
    const aguardando = await prisma.contato.findMany({
      where: {
        campanhaId,
        statusProspeccao: 'AGUARDANDO',
        telefone: { not: null },
        modoAtendimento: 'IA'
      },
      take: limite,
      orderBy: { criadoEm: 'asc' }
    });

    if (aguardando.length >= limite) {
      return aguardando;
    }

    // Se não tiver suficiente, buscar para follow-up
    const restante = limite - aguardando.length;
    const horasPrimeiroFollowup = configFollowup?.horasEntrePrimeiroFollowup ?? CONFIG_PADRAO.HORAS_ENTRE_PRIMEIRO_FOLLOWUP;
    const horasSegundoFollowup = configFollowup?.horasEntreSegundoFollowup ?? CONFIG_PADRAO.HORAS_ENTRE_SEGUNDO_FOLLOWUP;
    const diasDemaisFollowups = configFollowup?.diasEntreTentativas ?? CONFIG_PADRAO.DIAS_ENTRE_TENTATIVAS;

    const dataLimitePrimeiroFollowup = new Date();
    dataLimitePrimeiroFollowup.setHours(
      dataLimitePrimeiroFollowup.getHours() - horasPrimeiroFollowup
    );
    const dataLimiteSegundoFollowup = new Date();
    dataLimiteSegundoFollowup.setHours(
      dataLimiteSegundoFollowup.getHours() - horasSegundoFollowup
    );
    const dataLimiteDemaisFollowups = new Date();
    dataLimiteDemaisFollowups.setDate(
      dataLimiteDemaisFollowups.getDate() - diasDemaisFollowups
    );

    const paraFollowUp = await prisma.contato.findMany({
      where: {
        campanhaId,
        statusProspeccao: 'CONTATANDO',
        respondeu: false,
        tentativasContato: { lt: maxTentativas },
        OR: [
          {
            tentativasContato: 1,
            ultimaTentativa: { lt: dataLimitePrimeiroFollowup },
          },
          {
            tentativasContato: { gt: 1 },
            OR: [
              { tentativasContato: 2, ultimaTentativa: { lt: dataLimiteSegundoFollowup } },
              { tentativasContato: { gt: 2 }, ultimaTentativa: { lt: dataLimiteDemaisFollowups } },
            ],
          },
        ],
        telefone: { not: null },
        modoAtendimento: 'IA'
      },
      take: restante,
      orderBy: { ultimaTentativa: 'asc' }
    });

    return [...aguardando, ...paraFollowUp];
  }

  /**
   * Envia mensagem para um contato específico
   */
  async enviarMensagem(
    contato: Contato,
    campanha: Campanha
  ): Promise<ResultadoDisparo> {
    const telefone = obterTelefoneValido(contato);

    if (!telefone) {
      return {
        sucesso: false,
        contatoId: contato.id,
        telefone: '',
        erro: 'Nenhum telefone válido encontrado'
      };
    }

    if ((contato as any).modoAtendimento && (contato as any).modoAtendimento !== 'IA') {
      return {
        sucesso: false,
        contatoId: contato.id,
        telefone,
        erro: 'Contato não elegível para atendimento por IA'
      };
    }

    // Verificar se telefone está na blacklist
    const tenantId = (campanha as any).tenantId;
    if (await blacklistService.estaBlacklist(telefone, tenantId)) {
      console.log(`[Disparo] ⛔ Telefone ${telefone} está na blacklist, pulando...`);

      // Marcar contato como OPTOUT
      await prisma.contato.update({
        where: { id: contato.id },
        data: { statusProspeccao: 'OPTOUT' }
      });

      return {
        sucesso: false,
        contatoId: contato.id,
        telefone,
        erro: 'Telefone na blacklist'
      };
    }

    try {
      const agenteAtivo = await prisma.configuracaoAgente.findFirst({
        where: { tenantId, estaAtivo: true, status: 'ATIVO' },
        select: { id: true }
      });

      if (!agenteAtivo) {
        return {
          sucesso: false,
          contatoId: contato.id,
          telefone,
          erro: 'Agente pausado ou inexistente para este tenant'
        };
      }

      // 🆕 Buscar sessão WhatsApp ativa do tenant
      let sessao = await prisma.sessaoWhatsapp.findFirst({
        where: {
          tenantId: tenantId,
          status: 'CONECTADO'
        }
      });

      // Fallback: se não achou CONECTADO no DB, verificar na Evolution API
      // (protege contra status stale — DB diz CONECTANDO mas Evolution está open)
      if (!sessao) {
        const sessaoCandidata = await prisma.sessaoWhatsapp.findFirst({
          where: { tenantId: tenantId, status: { in: ['CONECTANDO', 'DESCONECTADO'] } }
        });
        if (sessaoCandidata) {
          try {
            const service = getWhatsAppService(sessaoCandidata.instanceName);
            const statusReal = await service.verificarStatus();
            if (statusReal?.instance?.state === 'open') {
              await prisma.sessaoWhatsapp.update({
                where: { id: sessaoCandidata.id },
                data: { status: 'CONECTADO', ultimoStatus: new Date() }
              });
              sessao = { ...sessaoCandidata, status: 'CONECTADO' } as typeof sessaoCandidata;
              console.log(`[Disparo] 🔄 Sessão ${sessaoCandidata.instanceName} status corrigido: ${sessaoCandidata.status} → CONECTADO`);
            }
          } catch (evoErr) {
            console.warn(`[Disparo] ⚠️ Erro ao verificar Evolution para ${sessaoCandidata.instanceName}:`, evoErr);
          }
        }
      }

      if (!sessao) {
        console.log(`[Disparo] ⚠️ Nenhuma sessão WhatsApp conectada para tenant ${tenantId}`);
        return {
          sucesso: false,
          contatoId: contato.id,
          telefone,
          erro: 'Nenhuma sessão WhatsApp conectada para este tenant'
        };
      }

      // Determinar qual mensagem enviar
      const tentativa = contato.tentativasContato + 1;
      let mensagem: string;

      // Buscar nome do agente e da imobiliária
      const nomeAgente = await buscarNomeAgente(tenantId);

      // Buscar nome da imobiliária do tenant
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nome: true } });

      // Dados para substituição de variáveis
      const dados: VariaveisTemplate = {
        nome: contato.nome.split(' ')[0], // Primeiro nome
        agente: nomeAgente, // Nome dinâmico do agente
        empreendimento: contato.nomeEdificio || campanha.nomeEmpreendimento || 'região',
        bairro: contato.bairroImovel || campanha.localizacao || 'região',
        imobiliaria: tenant?.nome || 'nossa imobiliária',
      };

      if (tentativa === 1) {
        // Primeira mensagem - usar template de storytelling
        mensagem = gerarPrimeiraMensagem(dados, 'storytelling');
      } else {
        // Follow-up (só aceita 1 ou 2)
        const tentativaFollowUp = tentativa <= 2 ? tentativa as 1 | 2 : 2;
        mensagem = gerarFollowUp(dados, tentativaFollowUp);
      }

      // Substituir variáveis restantes
      mensagem = substituirVariaveis(mensagem, dados);

      console.log(`[Disparo] Enviando para ${contato.nome} (${telefone}) - Tentativa ${tentativa}`);
      console.log(`[Disparo] Usando instância WhatsApp: ${sessao.instanceName}`);

      // 🆕 Obter serviço WhatsApp para a instância do tenant
      const whatsappService = getWhatsAppService(sessao.instanceName);

      // Enviar via WhatsApp
      const resultado = await whatsappService.enviarMensagemTexto(
        formatarTelefone(telefone),
        mensagem
      );

      // Atualizar contato
      await prisma.contato.update({
        where: { id: contato.id },
        data: {
          statusProspeccao: 'CONTATANDO',
          tentativasContato: tentativa,
          ultimaTentativa: new Date(),
        }
      });

      // 🆕 Salvar mensagem de SAÍDA no histórico
      try {
        await prisma.mensagemProspeccao.create({
          data: {
            contatoId: contato.id,
            direcao: 'SAIDA',
            conteudo: mensagem,
            tipo: 'TEXTO',
            messageId: resultado?.key?.id,
            telefone: formatarTelefone(telefone)
          }
        });
      } catch (e) {
        console.error('[Disparo] Erro ao salvar histórico de mensagem:', e);
      }

      console.log(`[Disparo] ✅ Enviado para ${contato.nome}`);

      return {
        sucesso: true,
        contatoId: contato.id,
        telefone,
        messageId: resultado?.key?.id
      };

    } catch (error: any) {
      console.error(`[Disparo] ❌ Erro ao enviar para ${contato.nome}:`, error.message);

      // Marcar como falha após várias tentativas de envio
      if (contato.tentativasContato >= CONFIG_PADRAO.MAX_TENTATIVAS - 1) {
        await prisma.contato.update({
          where: { id: contato.id },
          data: {
            statusProspeccao: 'FALHA',
            observacoes: `Falha no envio: ${error.message}`
          }
        });
      }

      return {
        sucesso: false,
        contatoId: contato.id,
        telefone,
        erro: error.message
      };
    }
  }

  /**
   * Dispara campanha para um lote de contatos
   * Usa rate limiting para não ser bloqueado
   * Respeita janela de horário configurada
   */
  async dispararLote(campanhaId: string, configOverride?: ConfigDisparo): Promise<ResultadoDisparoCampanha> {
    console.log(`\n[Disparo] ========================================`);
    console.log(`[Disparo] Iniciando disparo para campanha ${campanhaId}`);
    console.log(`[Disparo] ========================================\n`);

    // Buscar campanha
    const campanha = await prisma.campanha.findUnique({
      where: { id: campanhaId }
    });

    if (!campanha) {
      throw new Error('Campanha não encontrada');
    }

    if (campanha.status !== 'ATIVA') {
      throw new Error(`Campanha não está ativa (status: ${campanha.status})`);
    }

    // Mesclar configurações (configOverride > campanha.configDisparo > CONFIG_PADRAO)
    const configCampanha = ((campanha as any).configDisparo as ConfigDisparo) || {};
    const config: ConfigDisparo = {
      ...configOverride,
      ...configCampanha
    };

    // Verificar janela de horário
    if (!estaDentroDoHorario(config)) {
      const tempoEspera = calcularTempoAteProximaJanela(config);
      const horasEspera = Math.ceil(tempoEspera / (1000 * 60 * 60));

      const status = await this.obterStatusCampanha(campanhaId);
      return {
        campanhaId,
        iniciado: false,
        totalContatos: status.total,
        contatosEnviados: 0,
        erros: 0,
        status,
        mensagem: `Fora da janela de horário. Próximo disparo em aproximadamente ${horasEspera}h`
      };
    }

    // Configurações de rate limiting
    const delayEntreMensagens = config.atrasoEntreMensagens || CONFIG_PADRAO.DELAY_ENTRE_MENSAGENS_MS;
    const mensagensPorMinuto = config.mensagensPorMinuto || CONFIG_PADRAO.MENSAGENS_POR_MINUTO;
    const maxTentativas = config.maxTentativas || CONFIG_PADRAO.MAX_TENTATIVAS;

    // Buscar contatos elegíveis
    const contatos = await this.buscarContatosParaDisparo(
      campanhaId,
      mensagensPorMinuto,
      maxTentativas,
      {
        horasEntrePrimeiroFollowup: config.horasEntrePrimeiroFollowup,
        horasEntreSegundoFollowup: config.horasEntreSegundoFollowup,
        diasEntreTentativas: config.diasEntreTentativas,
      }
    );

    if (contatos.length === 0) {
      const status = await this.obterStatusCampanha(campanhaId);
      return {
        campanhaId,
        iniciado: false,
        totalContatos: status.total,
        contatosEnviados: 0,
        erros: 0,
        status,
        mensagem: 'Nenhum contato elegível para disparo'
      };
    }

    console.log(`[Disparo] ${contatos.length} contatos para processar`);
    console.log(`[Disparo] Rate limiting: ${delayEntreMensagens}ms entre mensagens, ${mensagensPorMinuto} msgs/lote`);

    let enviados = 0;
    let erros = 0;

    // Processar contatos com rate limiting
    for (let i = 0; i < contatos.length; i++) {
      const contato = contatos[i];

      // Verificar se ainda está dentro do horário (pode ter passado durante o disparo)
      if (!estaDentroDoHorario(config)) {
        console.log(`[Disparo] ⏰ Saiu da janela de horário, pausando...`);
        break;
      }

      const resultado = await this.enviarMensagem(contato, campanha);

      if (resultado.sucesso) {
        enviados++;
      } else {
        erros++;
      }

      // Rate limiting: delay entre mensagens
      if (i < contatos.length - 1) {
        await delay(delayEntreMensagens);
      }

      // Pausa maior após cada lote
      if ((i + 1) % mensagensPorMinuto === 0 && i < contatos.length - 1) {
        console.log(`[Disparo] Pausa de 1 minuto após ${i + 1} mensagens...`);
        await delay(CONFIG_PADRAO.DELAY_APOS_LOTE_MS);
      }
    }

    // Atualizar métricas da campanha
    const status = await this.obterStatusCampanha(campanhaId);

    await prisma.campanha.update({
      where: { id: campanhaId },
      data: {
        totalContatos: status.total,
        totalLeads: status.interessado
      }
    });

    console.log(`\n[Disparo] ========================================`);
    console.log(`[Disparo] Disparo finalizado!`);
    console.log(`[Disparo] Enviados: ${enviados} | Erros: ${erros}`);
    console.log(`[Disparo] ========================================\n`);

    return {
      campanhaId,
      iniciado: true,
      totalContatos: status.total,
      contatosEnviados: enviados,
      erros,
      status,
      mensagem: `Disparo concluído: ${enviados} enviados, ${erros} erros`
    };
  }

  /**
   * Agenda disparo contínuo (para rodar em background)
   */
  async iniciarDisparosContinuos(campanhaId: string): Promise<void> {
    console.log(`[Disparo] Iniciando disparos contínuos para campanha ${campanhaId}`);

    let continuar = true;

    while (continuar) {
      try {
        const resultado = await this.dispararLote(campanhaId);

        if (resultado.contatosEnviados === 0) {
          console.log('[Disparo] Sem mais contatos para enviar, aguardando 30 minutos...');
          await delay(30 * 60 * 1000); // 30 minutos

          // Verificar se campanha ainda está ativa
          const campanha = await prisma.campanha.findUnique({
            where: { id: campanhaId }
          });

          if (!campanha || campanha.status !== 'ATIVA') {
            console.log('[Disparo] Campanha não está mais ativa, encerrando...');
            continuar = false;
          }
        }

      } catch (error: any) {
        console.error('[Disparo] Erro no lote:', error.message);
        await delay(5 * 60 * 1000); // 5 minutos em caso de erro
      }
    }
  }

  /**
   * Para os disparos de uma campanha
   */
  async pararDisparos(campanhaId: string): Promise<void> {
    await prisma.campanha.update({
      where: { id: campanhaId },
      data: { status: 'PAUSADA' }
    });
    console.log(`[Disparo] Campanha ${campanhaId} pausada`);
  }
}

// Instância singleton
export const disparoCampanhaService = new DisparoCampanhaService();
