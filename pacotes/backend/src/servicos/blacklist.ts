/**
 * Serviço de Blacklist de Telefones
 * 
 * Gerencia telefones bloqueados para não receber mensagens:
 * - Opt-out (pessoa pediu para não receber)
 * - Números inválidos
 * - Reclamações
 * - Bloqueados pelo WhatsApp
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// TIPOS
// ============================================

export type MotivoBlacklist =
  | 'OPTOUT'              // Pessoa pediu para sair
  | 'INVALIDO'            // Número inválido/não existe
  | 'RECLAMACAO'          // Reclamação formal
  | 'BLOQUEADO_WHATSAPP'  // Bloqueado pelo WhatsApp
  | 'MANUAL'              // Adicionado manualmente
  | 'CONTATO_PESSOAL';    // Contato pessoal (não enviar durante testes)

interface AdicionarBlacklistParams {
  telefone: string;
  motivo: MotivoBlacklist;
  tenantId?: string;
  nomeContato?: string;
  campanhaOrigem?: string;
  observacoes?: string;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Normaliza telefone para comparação (apenas últimos 8 dígitos)
 */
function normalizarTelefone(telefone: string): string {
  // Remove tudo que não é número
  const apenasNumeros = telefone.replace(/\D/g, '');

  // Retorna últimos 8 dígitos (mais confiável para comparação)
  return apenasNumeros.slice(-8);
}

/**
 * Normaliza telefone completo (com código do país)
 */
function normalizarTelefoneCompleto(telefone: string): string {
  let numero = telefone.replace(/\D/g, '');

  // Se tiver 10 ou 11 dígitos, adiciona 55 (Brasil)
  if (numero.length === 10 || numero.length === 11) {
    numero = `55${numero}`;
  }

  return numero;
}

// ============================================
// SERVIÇO PRINCIPAL
// ============================================

export class BlacklistService {

  /**
   * Verifica se um telefone está na blacklist
   */
  async estaBlacklist(telefone: string, tenantId?: string): Promise<boolean> {
    const telefoneNormalizado = normalizarTelefone(telefone);

    const encontrado = await prisma.telefoneBlacklist.findFirst({
      where: {
        telefone: { contains: telefoneNormalizado },
        OR: [
          { tenantId: tenantId },
          { tenantId: null } // Blacklist global
        ]
      }
    });

    return !!encontrado;
  }

  /**
   * Adiciona telefone à blacklist
   */
  async adicionar(params: AdicionarBlacklistParams): Promise<void> {
    const telefoneNormalizado = normalizarTelefoneCompleto(params.telefone);

    try {
      await prisma.telefoneBlacklist.upsert({
        where: {
          tenantId_telefone: {
            tenantId: params.tenantId || '',
            telefone: telefoneNormalizado
          }
        },
        update: {
          motivo: params.motivo,
          observacoes: params.observacoes,
          atualizadoEm: new Date()
        },
        create: {
          telefone: telefoneNormalizado,
          motivo: params.motivo,
          tenantId: params.tenantId,
          nomeContato: params.nomeContato,
          campanhaOrigem: params.campanhaOrigem,
          observacoes: params.observacoes
        }
      });

      console.log(`[Blacklist] ✅ Telefone ${telefoneNormalizado} adicionado (motivo: ${params.motivo})`);

    } catch (error: any) {
      // Ignora erro de duplicata
      if (!error.message.includes('Unique constraint')) {
        throw error;
      }
    }
  }

  /**
   * Remove telefone da blacklist
   */
  async remover(telefone: string, tenantId?: string): Promise<boolean> {
    const telefoneNormalizado = normalizarTelefoneCompleto(telefone);

    const resultado = await prisma.telefoneBlacklist.deleteMany({
      where: {
        telefone: telefoneNormalizado,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      }
    });

    if (resultado.count > 0) {
      console.log(`[Blacklist] ❌ Telefone ${telefoneNormalizado} removido da blacklist`);
      return true;
    }

    return false;
  }

  /**
   * Registra opt-out a partir de uma resposta do contato
   */
  async registrarOptout(
    telefone: string,
    nomeContato?: string,
    campanhaId?: string,
    tenantId?: string
  ): Promise<void> {
    await this.adicionar({
      telefone,
      motivo: 'OPTOUT',
      nomeContato,
      campanhaOrigem: campanhaId,
      tenantId,
      observacoes: 'Opt-out solicitado pelo contato'
    });

    // Atualizar contatos com esse telefone para status OPTOUT
    const telefoneNormalizado = normalizarTelefone(telefone);

    await prisma.contato.updateMany({
      where: {
        OR: [
          { telefone: { contains: telefoneNormalizado } },
          { telefone2: { contains: telefoneNormalizado } },
          { telefone3: { contains: telefoneNormalizado } },
          { telefone4: { contains: telefoneNormalizado } },
          { telefone5: { contains: telefoneNormalizado } },
        ]
      },
      data: {
        statusProspeccao: 'OPTOUT'
      }
    });
  }

  /**
   * Registra número inválido
   */
  async registrarInvalido(
    telefone: string,
    motivo: string = 'Número não existe no WhatsApp'
  ): Promise<void> {
    await this.adicionar({
      telefone,
      motivo: 'INVALIDO',
      observacoes: motivo
    });
  }

  /**
   * Lista telefones na blacklist (com paginação e filtros)
   */
  async listar(
    tenantId?: string,
    pagina: number = 1,
    limite: number = 50,
    busca?: string,
    motivo?: string
  ): Promise<{ telefones: any[]; total: number }> {
    // Base where clause - tenant filter
    const whereBase: any = tenantId
      ? { OR: [{ tenantId }, { tenantId: null }] }
      : {};

    // Build where conditions
    const whereConditions: any[] = [whereBase];

    // Filter by motivo
    if (motivo) {
      whereConditions.push({ motivo });
    }

    // Filter by busca (phone or name)
    if (busca && busca.trim()) {
      const buscaNormalizada = busca.trim().replace(/\D/g, ''); // Remove non-digits for phone search
      whereConditions.push({
        OR: [
          { telefone: { contains: buscaNormalizada } },
          { nomeContato: { contains: busca.trim(), mode: 'insensitive' } }
        ]
      });
    }

    // Combine all conditions with AND
    const where = whereConditions.length > 1
      ? { AND: whereConditions }
      : whereBase;

    const [telefones, total] = await Promise.all([
      prisma.telefoneBlacklist.findMany({
        where,
        skip: (pagina - 1) * limite,
        take: limite,
        orderBy: { criadoEm: 'desc' }
      }),
      prisma.telefoneBlacklist.count({ where })
    ]);

    return { telefones, total };
  }

  /**
   * Conta telefones na blacklist por motivo
   */
  async contarPorMotivo(tenantId?: string): Promise<Record<string, number>> {
    const where = tenantId
      ? { OR: [{ tenantId }, { tenantId: null }] }
      : {};

    const contagens = await prisma.telefoneBlacklist.groupBy({
      by: ['motivo'],
      where,
      _count: true
    });

    const resultado: Record<string, number> = {};
    for (const item of contagens) {
      resultado[item.motivo] = item._count;
    }

    return resultado;
  }

  /**
   * Filtra lista de telefones removendo os que estão na blacklist
   */
  async filtrarTelefones(
    telefones: string[],
    tenantId?: string
  ): Promise<{ permitidos: string[]; bloqueados: string[] }> {
    const permitidos: string[] = [];
    const bloqueados: string[] = [];

    for (const telefone of telefones) {
      if (await this.estaBlacklist(telefone, tenantId)) {
        bloqueados.push(telefone);
      } else {
        permitidos.push(telefone);
      }
    }

    return { permitidos, bloqueados };
  }
}

// Instância singleton
export const blacklistService = new BlacklistService();
