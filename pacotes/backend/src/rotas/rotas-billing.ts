// Rotas de Billing - Elyon
// Endpoints para gerenciar créditos, assinaturas e recargas

import { responderErro } from '../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import { prisma as prismaClient } from '../lib/db';
import { servicoCreditos } from '../servicos/servico-creditos';
import * as servicoGestaoClientes from '../servicos/servico-gestao-clientes';
import * as servicoAsaas from '../servicos/servico-asaas';
import {
  verificarSuperAdmin,
  verificarAutenticacao
} from '../middleware/middleware-auth';
import {
  autenticarWebhookAsaas,
  concluirEventoWebhook,
  hashPayload,
  liberarEventoWebhook,
  registrarEventoWebhook,
} from '../servicos/webhook-seguranca';

// Cast para evitar erros de tipo até regenerar Prisma
const prisma = prismaClient as any;

const router = Router();

// ====================================
// CONSULTAR SALDO
// ====================================

/**
 * GET /billing/saldo
 * Retorna o saldo atual de créditos do tenant
 */
router.get('/saldo', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      console.warn('[Billing] Tentativa de consultar saldo sem tenantId. Usuario:', req.usuario?.email);
      return responderErro(res, 401, 'Não autorizado',
        {mensagem: 'Tenant não identificado para este usuário'});
    }

    const saldo = await servicoCreditos.consultarSaldo(tenantId);

    res.json({
      sucesso: true,
      saldo: {
        mensais: saldo.mensais,
        prepagos: saldo.prepagos,
        bonus: saldo.bonus,
        total: saldo.total
      },
      plano: saldo.plano,
      dataRenovacao: saldo.dataRenovacao,
      creditosPorPlano: servicoCreditos.CREDITOS_POR_PLANO[saldo.plano]
    });
  } catch (erro) {
    console.error('Erro ao consultar saldo:', erro);
    responderErro(res, 500, 'Erro ao consultar saldo');
  }
});

// ====================================
// LISTAR PACOTES DE RECARGA
// ====================================

/**
 * GET /billing/pacotes
 * Lista todos os pacotes de recarga disponíveis
 */
router.get('/pacotes', async (req: Request, res: Response) => {
  try {
    const pacotes = await prisma.pacote.findMany({
      where: { ativo: true },
      orderBy: { creditos: 'asc' }
    });

    // Calcular se tem promoção ativa
    const hoje = new Date();
    const isDia15 = hoje.getDate() === 15;

    const pacotesComPromocao = pacotes.map((pacote: any) => {
      const promocao = servicoCreditos.calcularCreditosRecarga(pacote.creditos, hoje);
      return {
        ...pacote,
        valor: Number(pacote.valor),
        creditosTotal: promocao.total,
        creditosBonus: promocao.creditosBonus,
        promocaoAtiva: isDia15,
        promocao: promocao.promocaoAplicada
      };
    });

    res.json({
      sucesso: true,
      pacotes: pacotesComPromocao,
      promocaoDia15Ativa: isDia15
    });
  } catch (erro) {
    console.error('Erro ao listar pacotes:', erro);
    responderErro(res, 500, 'Erro ao listar pacotes');
  }
});

// ====================================
// LISTAR TRANSAÇÕES
// ====================================

/**
 * GET /billing/transacoes
 * Lista histórico de transações do tenant
 */
router.get('/transacoes', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const { limite = 20, pagina = 1 } = req.query;
    const skip = (Number(pagina) - 1) * Number(limite);

    const [transacoes, total] = await Promise.all([
      prisma.transacao.findMany({
        where: { tenantId },
        orderBy: { criadoEm: 'desc' },
        take: Number(limite),
        skip
      }),
      prisma.transacao.count({ where: { tenantId } })
    ]);

    res.json({
      sucesso: true,
      transacoes: transacoes.map((t: any) => ({
        ...t,
        valor: Number(t.valor)
      })),
      paginacao: {
        total,
        pagina: Number(pagina),
        limite: Number(limite),
        totalPaginas: Math.ceil(total / Number(limite))
      }
    });
  } catch (erro) {
    console.error('Erro ao listar transações:', erro);
    responderErro(res, 500, 'Erro ao listar transações');
  }
});

// ====================================
// CRIAR RECARGA (Link de Pagamento)
// ====================================

/**
 * POST /billing/recarga
 * Cria uma transação pendente e retorna link de pagamento Asaas
 */
router.post('/recarga', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const { pacoteId } = req.body;

    if (!pacoteId) {
      return responderErro(res, 400, 'pacoteId é obrigatório');
    }

    // Buscar pacote
    const pacote = await prisma.pacote.findUnique({
      where: { id: pacoteId }
    });

    if (!pacote || !pacote.ativo) {
      return responderErro(res, 404, 'Pacote não encontrado ou inativo');
    }

    // Calcular créditos com promoção
    const promocao = servicoCreditos.calcularCreditosRecarga(pacote.creditos);

    // Criar transação pendente
    const transacao = await prisma.transacao.create({
      data: {
        tenantId,
        tipo: 'RECARGA',
        descricao: `Recarga: ${pacote.nome}`,
        valor: pacote.valor,
        creditos: promocao.total,
        tipoCredito: 'PREPAGOS',
        promocaoAplicada: promocao.promocaoAplicada,
        creditosBonus: promocao.creditosBonus,
        status: 'PENDENTE'
      }
    });

    // TODO: Integrar com Asaas para gerar link de pagamento
    // Por enquanto, retornar transação criada

    res.json({
      sucesso: true,
      transacao: {
        id: transacao.id,
        valor: Number(transacao.valor),
        creditos: transacao.creditos,
        creditosBonus: transacao.creditosBonus,
        promocao: transacao.promocaoAplicada
      },
      // linkPagamento: asaasLink, // TODO
      mensagem: 'Transação criada. Aguardando integração Asaas.'
    });
  } catch (erro) {
    console.error('Erro ao criar recarga:', erro);
    responderErro(res, 500, 'Erro ao criar recarga');
  }
});

// ====================================
// WEBHOOK ASAAS (Confirmação de Pagamento)
// ====================================

/**
 * POST /billing/webhook/asaas
 * Recebe notificações de pagamento do Asaas
 * Eventos suportados:
 * - PAYMENT_CONFIRMED / PAYMENT_RECEIVED: Pagamento confirmado
 * - PAYMENT_OVERDUE: Pagamento atrasado
 * - SUBSCRIPTION_CREATED: Assinatura criada
 * - SUBSCRIPTION_RENEWED: Assinatura renovada
 * - SUBSCRIPTION_DELETED: Assinatura cancelada
 */
const EVENTOS_PAGAMENTO_ASAAS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_RESTORED',
  'PAYMENT_CHARGEBACK_REQUESTED',
]);

const EVENTOS_ASSINATURA_ASAAS = new Set([
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED',
]);

export async function processarWebhookAsaas(req: Request, res: Response): Promise<unknown> {
  let registroId: string | undefined = req.get('x-elyon-inbox-id');
  try {
    const { event, payment, subscription } = req.body;
    const eventId = req.body?.id;
    if (typeof eventId !== 'string' || !eventId || typeof event !== 'string' || !event) {
      return res.status(400).json({ erro: 'Payload invalido' });
    }

    if (EVENTOS_PAGAMENTO_ASAAS.has(event) && !payment?.id) {
      return res.status(400).json({ erro: 'Payload de pagamento invalido' });
    }
    if (EVENTOS_ASSINATURA_ASAAS.has(event) && !subscription?.id) {
      return res.status(400).json({ erro: 'Payload de assinatura invalido' });
    }

    if (!registroId) {
      const payloadHash = hashPayload(req.rawBody || Buffer.from(JSON.stringify(req.body)));
      const registro = await registrarEventoWebhook({
        provedor: 'ASAAS',
        eventoId: eventId,
        tipo: event,
        payloadHash,
        payload: req.body,
      });

      if (registro.duplicado) return res.sendStatus(200);
      return res.status(202).json({ aceito: true, eventoId: registro.registroId });
    }

    if (!EVENTOS_PAGAMENTO_ASAAS.has(event) && !EVENTOS_ASSINATURA_ASAAS.has(event)) {
      if (registroId) await concluirEventoWebhook(registroId);
      return res.status(202).json({ ignorado: true });
    }
    const timestamp = new Date().toISOString();

    console.log(`[Webhook Asaas] ${timestamp} | Evento: ${event} | ID: ${payment?.id || subscription?.id}`);

    // ========================================
    // EVENTOS DE PAGAMENTO
    // ========================================

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      // Buscar transação pelo ID do pagamento Asaas
      const transacao = await prisma.transacao.findFirst({
        where: { asaasPagamentoId: payment.id }
      });

      if (!transacao) {
        if (registroId) await concluirEventoWebhook(registroId);
        console.warn('[Webhook Asaas] Transação não encontrada para payment:', payment.id);
        return res.sendStatus(200);
      }

      // Verificar se já foi processado
      if (transacao.status === 'CONFIRMADO') {
        if (registroId) await concluirEventoWebhook(registroId);
        console.log('[Webhook Asaas] Transação já confirmada, ignorando duplicata');
        return res.sendStatus(200);
      }

      // Confirmar transação
      const creditado = await prisma.$transaction(async (tx: any) => {
        const atualizado = await tx.transacao.updateMany({
          where: { id: transacao.id, status: { not: 'CONFIRMADO' } },
          data: { status: 'CONFIRMADO', confirmadoEm: new Date() },
        });
        if (atualizado.count === 0) return false;

        const campoCredito = transacao.tipoCredito === 'MENSAIS'
          ? 'creditosMensais'
          : transacao.tipoCredito === 'BONUS'
            ? 'creditosBonus'
            : 'creditosPrepagos';

        await tx.tenant.update({
          where: { id: transacao.tenantId },
          data: { [campoCredito]: { increment: transacao.creditos } },
        });
        return true;
      });

      if (!creditado) {
        if (registroId) await concluirEventoWebhook(registroId);
        return res.sendStatus(200);
      }

      // Adicionar créditos

      console.log(
        `[Webhook Asaas] ✅ PAGAMENTO CONFIRMADO | ${transacao.creditos} créditos → tenant ${transacao.tenantId}`
      );
    }

    // Cobrança criada
    if (event === 'PAYMENT_CREATED') {
      console.log(`[Webhook Asaas] 📝 COBRANÇA CRIADA | Payment: ${payment.id} | Valor: R$ ${payment.value}`);
      // Log apenas - a transação já foi criada no momento da compra
    }

    // Cobrança atualizada (valor ou vencimento alterado)
    if (event === 'PAYMENT_UPDATED') {
      console.log(`[Webhook Asaas] ✏️ COBRANÇA ATUALIZADA | Payment: ${payment.id}`);

      // Atualizar valor na transação se mudou
      if (payment.value) {
        await prisma.transacao.updateMany({
          where: { asaasPagamentoId: payment.id },
          data: { valor: payment.value }
        });
      }
    }

    // Pagamento atrasado
    if (event === 'PAYMENT_OVERDUE') {
      console.log(`[Webhook Asaas] ⚠️ PAGAMENTO ATRASADO | Payment: ${payment.id}`);

      // Marcar transação como atrasada
      await prisma.transacao.updateMany({
        where: { asaasPagamentoId: payment.id },
        data: { status: 'ATRASADO' }
      });

      // Buscar tenant pela transação
      const transacao = await prisma.transacao.findFirst({
        where: { asaasPagamentoId: payment.id },
        include: { tenant: true }
      });

      if (transacao?.tenant) {
        // Atualizar status de pagamento do tenant
        await prisma.tenant.update({
          where: { id: transacao.tenantId },
          data: { statusPagamento: 'ATRASADO' }
        });

        console.log(`[Webhook Asaas] Tenant ${transacao.tenant.nome} marcado como ATRASADO`);
      }
    }

    // Cobrança removida/cancelada
    if (event === 'PAYMENT_DELETED') {
      console.log(`[Webhook Asaas] 🗑️ COBRANÇA REMOVIDA | Payment: ${payment.id}`);

      // Marcar transação como cancelada
      await prisma.transacao.updateMany({
        where: { asaasPagamentoId: payment.id },
        data: { status: 'CANCELADO' }
      });
    }

    // Cobrança estornada
    if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_PARTIALLY_REFUNDED') {
      const parcial = event === 'PAYMENT_PARTIALLY_REFUNDED';
      console.log(`[Webhook Asaas] 💸 ESTORNO ${parcial ? 'PARCIAL' : 'TOTAL'} | Payment: ${payment.id}`);

      const transacao = await prisma.transacao.findFirst({
        where: { asaasPagamentoId: payment.id }
      });

      if (transacao && transacao.status === 'CONFIRMADO') {
        // Marcar como estornado
        await prisma.transacao.update({
          where: { id: transacao.id },
          data: { status: 'ESTORNADO' }
        });

        // Remover créditos (se já foram adicionados)
        // Nota: Isso pode resultar em saldo negativo, tratar no serviço de créditos
        console.log(`[Webhook Asaas] ⚠️ Transação ${transacao.id} estornada - considerar remover créditos`);
      }
    }

    // Cobrança restaurada (após estar vencida ou deletada)
    if (event === 'PAYMENT_RESTORED') {
      console.log(`[Webhook Asaas] ♻️ COBRANÇA RESTAURADA | Payment: ${payment.id}`);

      // Restaurar para pendente
      await prisma.transacao.updateMany({
        where: { asaasPagamentoId: payment.id },
        data: { status: 'PENDENTE' }
      });
    }

    // Chargeback recebido (disputa de cartão)
    if (event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      console.log(`[Webhook Asaas] 🚨 CHARGEBACK RECEBIDO | Payment: ${payment.id}`);

      // Tratar como estorno potencial
      await prisma.transacao.updateMany({
        where: { asaasPagamentoId: payment.id },
        data: { status: 'DISPUTA' }
      });
    }

    // ========================================
    // EVENTOS DE ASSINATURA
    // ========================================

    if (event === 'SUBSCRIPTION_CREATED') {
      console.log(`[Webhook Asaas] 📝 ASSINATURA CRIADA | ID: ${subscription.id}`);
      // Log apenas, a assinatura já foi salva no momento da criação
    }

    if (event === 'SUBSCRIPTION_UPDATED') {
      console.log(`[Webhook Asaas] ✏️ ASSINATURA ATUALIZADA | ID: ${subscription.id}`);

      // Buscar tenant pela assinatura
      const tenant = await prisma.tenant.findFirst({
        where: { asaasAssinaturaId: subscription.id }
      });

      if (tenant) {
        // Atualizar valor se mudou
        if (subscription.value) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { valorPlano: subscription.value }
          });
          console.log(`[Webhook Asaas] Valor atualizado para R$ ${subscription.value}`);
        }
      }
    }

    if (event === 'SUBSCRIPTION_RENEWED') {
      console.log(`[Webhook Asaas] 🔄 ASSINATURA RENOVADA | ID: ${subscription.id}`);

      // Buscar tenant pela assinatura
      const tenant = await prisma.tenant.findFirst({
        where: { asaasAssinaturaId: subscription.id }
      });

      if (tenant) {
        // Renovar créditos do plano
        await servicoCreditos.renovarPlano(tenant.id);
        console.log(`[Webhook Asaas] ✅ Plano renovado para tenant ${tenant.nome}`);
      } else {
        console.warn(`[Webhook Asaas] Tenant não encontrado para assinatura ${subscription.id}`);
      }
    }

    if (event === 'SUBSCRIPTION_INACTIVATED') {
      console.log(`[Webhook Asaas] ⏸️ ASSINATURA INATIVADA | ID: ${subscription.id}`);

      // Buscar tenant pela assinatura
      const tenant = await prisma.tenant.findFirst({
        where: { asaasAssinaturaId: subscription.id }
      });

      if (tenant) {
        // Marcar assinatura como inativa (mas não cancelada)
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { statusPagamento: 'PENDENTE' }
        });

        console.log(`[Webhook Asaas] Tenant ${tenant.nome} com assinatura inativa`);
      }
    }

    if (event === 'SUBSCRIPTION_DELETED') {
      console.log(`[Webhook Asaas] ❌ ASSINATURA REMOVIDA | ID: ${subscription.id}`);

      // Buscar tenant pela assinatura
      const tenant = await prisma.tenant.findFirst({
        where: { asaasAssinaturaId: subscription.id }
      });

      if (tenant) {
        // Marcar tenant como cancelado e limpar referência da assinatura
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            statusPagamento: 'CANCELADO',
            asaasAssinaturaId: null // Limpar referência
          }
        });

        console.log(`[Webhook Asaas] Tenant ${tenant.nome} marcado para cancelamento`);
      }
    }

    if (registroId) await concluirEventoWebhook(registroId);
    res.sendStatus(200);
  } catch (erro) {
    if (registroId) await liberarEventoWebhook(registroId).catch(() => undefined);
    console.error('[Webhook Asaas] ❌ Erro:', erro);
    // Retornar 200 mesmo com erro para Asaas não retentar
    res.sendStatus(500);
  }
}

router.post('/webhook/asaas', autenticarWebhookAsaas, processarWebhookAsaas);

// ====================================
// TESTAR CONEXÃO ASAAS (Admin)
// ====================================

/**
 * GET /billing/admin/testar-asaas
 * Testa a conexão com a API do Asaas
 */
router.get('/admin/testar-asaas', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const resultado = await servicoAsaas.testarConexao();

    if (resultado.sucesso) {
      res.json({
        sucesso: true,
        mensagem: resultado.mensagem,
        detalhes: resultado.detalhes,
        webhookUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/billing/webhook/asaas`,
        instrucoes: {
          painel: 'Configure o webhook no painel ASAAS em: Integrações → Webhooks',
          eventos: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_DELETED']
        }
      });
    } else {
      res.status(500).json({
        sucesso: false,
        erro: resultado.mensagem,
        instrucoes: 'Configure as variáveis ASAAS_API_URL e ASAAS_API_KEY no arquivo .env'
      });
    }
  } catch (erro: any) {
    console.error('[Billing] Erro ao testar Asaas:', erro);
    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});

// ====================================
// ADMIN: ADICIONAR CRÉDITOS MANUAL
// ====================================

/**
 * POST /billing/admin/adicionar-creditos
 * Adiciona créditos manualmente (APENAS SUPER_ADMIN)
 */
router.post('/admin/adicionar-creditos', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {

    const { tenantId, quantidade, tipo, descricao } = req.body;

    if (!tenantId || !quantidade || !tipo) {
      return responderErro(res, 400, 'tenantId, quantidade e tipo são obrigatórios');
    }

    const saldo = await servicoCreditos.adicionarCreditos(tenantId, {
      quantidade: Number(quantidade),
      tipo: tipo,
      descricao: descricao || 'Créditos adicionados manualmente'
    });

    // Registrar transação
    await prisma.transacao.create({
      data: {
        tenantId,
        tipo: 'BONUS',
        descricao: descricao || 'Créditos adicionados manualmente',
        valor: 0,
        creditos: Number(quantidade),
        tipoCredito: tipo,
        status: 'CONFIRMADO',
        confirmadoEm: new Date()
      }
    });

    res.json({
      sucesso: true,
      mensagem: `${quantidade} créditos adicionados com sucesso`,
      saldo
    });
  } catch (erro) {
    console.error('Erro ao adicionar créditos:', erro);
    responderErro(res, 500, 'Erro ao adicionar créditos');
  }
});

// ====================================
// ADMIN: SIMULAR PAGAMENTO (para testes locais)
// ====================================

/**
 * POST /billing/admin/simular-pagamento
 * Simula confirmação de pagamento para testes sem webhook
 * Confirma transação pendente e adiciona créditos
 */
router.post('/admin/simular-pagamento', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const simulacaoHabilitada =
      process.env.NODE_ENV !== 'production' || process.env.BILLING_ALLOW_SIMULATION === 'true';

    if (!simulacaoHabilitada) {
      return responderErro(res, 403, 'Simulação de pagamento desabilitada neste ambiente');
    }

    const { transacaoId } = req.body;

    if (!transacaoId) {
      return responderErro(res, 400, 'transacaoId é obrigatório');
    }

    // Buscar transação
    const transacao = await prisma.transacao.findUnique({
      where: { id: transacaoId }
    });

    if (!transacao) {
      return responderErro(res, 404, 'Transação não encontrada');
    }

    if (transacao.status === 'CONFIRMADO') {
      return responderErro(res, 400, 'Transação já foi confirmada');
    }

    // Confirmar transação
    await prisma.transacao.update({
      where: { id: transacaoId },
      data: {
        status: 'CONFIRMADO',
        confirmadoEm: new Date()
      }
    });

    // Adicionar créditos
    await servicoCreditos.adicionarCreditos(transacao.tenantId, {
      quantidade: transacao.creditos,
      tipo: transacao.tipoCredito || 'PREPAGOS',
      descricao: transacao.descricao || 'Pagamento confirmado (simulação)'
    });

    const saldo = await servicoCreditos.consultarSaldo(transacao.tenantId);

    console.log(`[SIMULAÇÃO] Pagamento confirmado: ${transacao.creditos} créditos para tenant ${transacao.tenantId}`);

    res.json({
      sucesso: true,
      mensagem: `Pagamento simulado! ${transacao.creditos} créditos adicionados.`,
      transacao: {
        id: transacao.id,
        creditos: transacao.creditos,
        valor: Number(transacao.valor)
      },
      saldo
    });
  } catch (erro: any) {
    console.error('Erro ao simular pagamento:', erro);
    responderErro(res, 500, 'Erro ao simular pagamento');
  }
});

// ====================================
// ADMIN: RENOVAR PLANO MANUAL
// ====================================

/**
 * POST /billing/admin/renovar
 * Força renovação manual do plano (APENAS SUPER_ADMIN)
 */
router.post('/admin/renovar', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {

    const { tenantId } = req.body;

    if (!tenantId) {
      return responderErro(res, 400, 'tenantId é obrigatório');
    }

    await servicoCreditos.renovarPlano(tenantId);
    const saldo = await servicoCreditos.consultarSaldo(tenantId);

    res.json({
      sucesso: true,
      mensagem: 'Plano renovado com sucesso',
      saldo
    });
  } catch (erro) {
    console.error('Erro ao renovar plano:', erro);
    responderErro(res, 500, 'Erro ao renovar plano');
  }
});

// ====================================
// ADMIN: LISTAR TODAS AS TRANSAÇÕES
// ====================================

/**
 * GET /billing/admin/transacoes
 * Lista TODAS as transações de TODOS os tenants (SUPER_ADMIN)
 */
router.get('/admin/transacoes', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { limite = 50, pagina = 1 } = req.query;
    const skip = (Number(pagina) - 1) * Number(limite);

    const [transacoes, total] = await Promise.all([
      prisma.transacao.findMany({
        orderBy: { criadoEm: 'desc' },
        take: Number(limite),
        skip,
        include: {
          tenant: {
            select: { nome: true, slug: true }
          }
        }
      }),
      prisma.transacao.count()
    ]);

    res.json({
      sucesso: true,
      transacoes: transacoes.map((t: any) => ({
        ...t,
        valor: Number(t.valor),
        tenantNome: t.tenant?.nome
      })),
      paginacao: {
        total,
        pagina: Number(pagina),
        limite: Number(limite),
        totalPaginas: Math.ceil(total / Number(limite))
      }
    });
  } catch (erro) {
    console.error('Erro ao listar transações admin:', erro);
    responderErro(res, 500, 'Erro ao listar transações');
  }
});

// ====================================
// ADMIN: CRIAR NOVO CLIENTE
// ====================================

/**
 * POST /billing/admin/clientes
 * Cria novo cliente (tenant + usuário admin)
 */
router.post('/admin/clientes', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const {
      nomeEmpresa,
      slug,
      cnpj,
      email,
      telefone,
      cidade,
      planoTipo,
      nomeAdmin,
      emailAdmin,
      senhaAdmin,
      integrarAsaas
    } = req.body;

    if (!nomeEmpresa || !email || !planoTipo || !nomeAdmin || !emailAdmin) {
      return responderErro(res, 400, 'Campos obrigatórios: nomeEmpresa, email, planoTipo, nomeAdmin, emailAdmin');
    }

    const resultado = await servicoGestaoClientes.criarCliente({
      nomeEmpresa,
      slug,
      cnpj,
      email,
      telefone,
      cidade,
      planoTipo,
      nomeAdmin,
      emailAdmin,
      senhaAdmin,
      integrarAsaas
    });

    res.status(201).json({
      sucesso: true,
      mensagem: 'Cliente criado com sucesso',
      ...resultado
    });

  } catch (erro: any) {
    console.error('Erro ao criar cliente:', erro);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ====================================
// ADMIN: EDITAR CLIENTE
// ====================================

/**
 * PUT /billing/admin/clientes/:id
 * Edita dados de um cliente
 */
router.put('/admin/clientes/:id', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dados = req.body;

    const tenant = await servicoGestaoClientes.editarCliente(id, dados);

    res.json({
      sucesso: true,
      mensagem: 'Cliente atualizado',
      tenant
    });

  } catch (erro: any) {
    console.error('Erro ao editar cliente:', erro);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ====================================
// ADMIN: SUSPENDER CLIENTE
// ====================================

/**
 * POST /billing/admin/clientes/:id/suspender
 * Suspende um cliente
 */
router.post('/admin/clientes/:id/suspender', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const tenant = await servicoGestaoClientes.desativarCliente(id, motivo);

    res.json({
      sucesso: true,
      mensagem: 'Cliente suspenso',
      tenant
    });

  } catch (erro: any) {
    console.error('Erro ao suspender cliente:', erro);
    responderErro(res, 500, 'Erro ao suspender cliente');
  }
});

// ====================================
// ADMIN: REATIVAR CLIENTE
// ====================================

/**
 * POST /billing/admin/clientes/:id/reativar
 * Reativa um cliente suspenso
 */
router.post('/admin/clientes/:id/reativar', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await servicoGestaoClientes.reativarCliente(id);

    res.json({
      sucesso: true,
      mensagem: 'Cliente reativado',
      tenant
    });

  } catch (erro: any) {
    console.error('Erro ao reativar cliente:', erro);
    responderErro(res, 500, 'Erro ao reativar cliente');
  }
});

// ====================================
// ADMIN: RESETAR SENHA
// ====================================

/**
 * POST /billing/admin/clientes/:id/senha
 * Reseta a senha do admin do cliente
 */
router.post('/admin/clientes/:id/senha', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { novaSenha } = req.body;

    const resultado = await servicoGestaoClientes.resetarSenha(id, novaSenha);

    res.json({
      sucesso: true,
      mensagem: 'Senha resetada com sucesso',
      ...resultado
    });

  } catch (erro: any) {
    console.error('Erro ao resetar senha:', erro);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ====================================
// ADMIN: VER CONSUMO DO CLIENTE
// ====================================

/**
 * GET /billing/admin/clientes/:id/consumo
 * Retorna dados de consumo detalhados do cliente
 */
router.get('/admin/clientes/:id/consumo', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const consumo = await servicoGestaoClientes.buscarConsumo(id);

    res.json({
      sucesso: true,
      consumo
    });

  } catch (erro: any) {
    console.error('Erro ao buscar consumo:', erro);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ====================================
// ADMIN: LISTAR CONFIGURAÇÃO DE PLANOS
// ====================================

/**
 * GET /billing/admin/planos
 * Lista configurações dos planos disponíveis
 */
router.get('/admin/planos', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    res.json({
      sucesso: true,
      planos: servicoGestaoClientes.CONFIGURACOES_PLANOS
    });
  } catch (erro) {
    responderErro(res, 500, 'Erro ao listar planos');
  }
});

// ====================================
// CALCULAR UPGRADE PRO-RATA
// ====================================

/**
 * GET /billing/calcular-upgrade
 * Calcula o valor pro-rata para upgrade de plano
 */
router.get('/calcular-upgrade', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const { novoPlano } = req.query;

    if (!novoPlano || !['STARTER', 'GROWTH', 'PRO'].includes(novoPlano as string)) {
      return responderErro(res, 400, 'novoPlano inválido. Use: STARTER, GROWTH ou PRO');
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    const planoAtual = tenant.planoTipo || 'STARTER';
    const configAtual = servicoGestaoClientes.CONFIGURACOES_PLANOS[planoAtual as keyof typeof servicoGestaoClientes.CONFIGURACOES_PLANOS];
    const configNovo = servicoGestaoClientes.CONFIGURACOES_PLANOS[novoPlano as keyof typeof servicoGestaoClientes.CONFIGURACOES_PLANOS];

    // Verificar se é upgrade (não downgrade)
    if (configNovo.valorMensal <= configAtual.valorMensal) {
      return responderErro(res, 400, 'Só é possível fazer upgrade para um plano mais caro', {
        planoAtual,
        novoPlano
      });
    }

    // Calcular dias restantes
    const hoje = new Date();
    const dataRenovacao = tenant.dataRenovacao ? new Date(tenant.dataRenovacao) : new Date();
    const diasRestantes = Math.max(0, Math.ceil((dataRenovacao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));

    // Calcular valor pro-rata
    const valorDiarioAtual = configAtual.valorMensal / 30;
    const valorDiarioNovo = configNovo.valorMensal / 30;
    const diferencaDiaria = valorDiarioNovo - valorDiarioAtual;
    const valorUpgrade = Math.round(diferencaDiaria * diasRestantes * 100) / 100;

    // Calcular economia mensal em créditos
    const economiasPorCredito = configAtual.custoPorCreditoExtra - configNovo.custoPorCreditoExtra;

    res.json({
      sucesso: true,
      planoAtual: {
        nome: planoAtual,
        valorMensal: configAtual.valorMensal,
        creditosMensais: configAtual.creditosMensais,
        custoPorCredito: configAtual.custoPorCreditoExtra
      },
      novoPlano: {
        nome: novoPlano,
        valorMensal: configNovo.valorMensal,
        creditosMensais: configNovo.creditosMensais,
        custoPorCredito: configNovo.custoPorCreditoExtra
      },
      calculo: {
        diasRestantes,
        dataRenovacao: tenant.dataRenovacao,
        valorUpgradeProRata: valorUpgrade
      },
      beneficios: {
        creditosImediatos: configNovo.creditosMensais, // Opção A: créditos completos
        economiaPorCredito: economiasPorCredito,
        mensagem: `Economia de R$ ${economiasPorCredito.toFixed(2)} por crédito extra!`
      }
    });
  } catch (erro: any) {
    console.error('Erro ao calcular upgrade:', erro);
    responderErro(res, 500, 'Erro ao calcular upgrade');
  }
});

// ====================================
// CONTRATAR AGENTE EXTRA
// ====================================

/**
 * POST /billing/contratar-agente-extra
 * Cria uma assinatura para um agente extra (R$ 99/mês)
 */
router.post('/contratar-agente-extra', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    if (!tenant.asaasClienteId) {
      return responderErro(res, 400, 'Cliente não possui cadastro financeiro',
        {mensagem: 'Complete seu cadastro financeiro antes de contratar.'});
    }

    // Criar assinatura no Asaas
    console.log(`[Billing] Criando assinatura de Agente Extra para tenant ${tenant.nome}...`);

    const assinatura = await servicoAsaas.criarAssinatura({
      clienteId: tenant.asaasClienteId,
      valor: 99.00,
      ciclo: 'MONTHLY',
      descricao: 'Assinatura Adicional: Agente IA Extra'
    });

    console.log(`[Billing] Assinatura criada: ${assinatura.id}`);

    // Incrementar contador de agentes extras
    // Liberamos imediatamente para melhor UX
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        agentesExtras: { increment: 1 }
      }
    });

    return res.json({
      sucesso: true,
      mensagem: 'Agente extra contratado com sucesso!',
      assinaturaId: assinatura.id,
      novoLimite: 1 + (tenant.agentesExtras + 1)
    });

  } catch (erro: any) {
    console.error('[Billing] Erro ao contratar agente extra:', erro);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ====================================
// COMPRAR CRÉDITOS (VALOR LIVRE)
// ====================================

/**
 * POST /billing/comprar-creditos
 * Cria transação para compra de créditos com quantidade livre
 */
router.post('/comprar-creditos', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const { quantidade } = req.body;

    if (!quantidade || quantidade < 10) {
      return responderErro(res, 400, 'Quantidade mínima: 10 créditos');
    }

    if (quantidade > 10000) {
      return responderErro(res, 400, 'Quantidade máxima: 10.000 créditos por transação');
    }

    // Buscar tenant e configuração do plano
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    const plano = tenant.planoTipo || 'STARTER';
    const config = servicoGestaoClientes.CONFIGURACOES_PLANOS[plano as keyof typeof servicoGestaoClientes.CONFIGURACOES_PLANOS];

    const valorTotal = quantidade * config.custoPorCreditoExtra;

    // Calcular comparativo PRO (para marketing)
    let comparativoPro = null;
    if (plano !== 'PRO') {
      const configPro = servicoGestaoClientes.CONFIGURACOES_PLANOS.PRO;
      const valorSeFossePro = quantidade * configPro.custoPorCreditoExtra;
      const economia = valorTotal - valorSeFossePro;
      comparativoPro = {
        valorSeFossePro,
        economia,
        mensagem: `Se fosse PRO, economizaria R$ ${economia.toFixed(2)}`
      };
    }

    // Criar transação pendente
    const transacao = await prisma.transacao.create({
      data: {
        tenantId,
        tipo: 'RECARGA',
        descricao: `Compra: ${quantidade} créditos`,
        valor: valorTotal,
        creditos: quantidade,
        tipoCredito: 'PREPAGOS',
        status: 'PENDENTE'
      }
    });

    // Integrar com Asaas para gerar cobrança PIX
    let pagamento = null;
    try {
      // Verificar se tenant tem cliente Asaas, senão criar
      let asaasClienteId = tenant.asaasClienteId;

      if (!asaasClienteId) {
        // Criar cliente no Asaas
        const clienteAsaas = await servicoAsaas.criarCliente({
          nome: tenant.nome || 'Cliente Elyon',
          email: tenant.email || 'cliente@elyon.com.br',
          telefone: tenant.telefone,
          cpfCnpj: tenant.cnpj
        });

        asaasClienteId = clienteAsaas.id;

        // Salvar ID do cliente Asaas no tenant
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { asaasClienteId }
        });
      }

      // Criar cobrança PIX
      const cobranca = await servicoAsaas.criarCobranca({
        clienteId: asaasClienteId,
        valor: valorTotal,
        descricao: `Compra de ${quantidade} créditos - Elyon`,
        tipoPagamento: 'PIX'
      });

      // Gerar QR Code PIX
      const pixData = await servicoAsaas.gerarPixQrCode(cobranca.id);

      // Atualizar transação com ID do pagamento Asaas
      await prisma.transacao.update({
        where: { id: transacao.id },
        data: { asaasPagamentoId: cobranca.id }
      });

      pagamento = {
        id: cobranca.id,
        pixQrCode: pixData.qrCodeUrl,
        pixPayload: pixData.payload,
        invoiceUrl: cobranca.invoiceUrl
      };

      console.log('[Billing] Cobrança PIX criada:', cobranca.id);
    } catch (erroAsaas: any) {
      console.error('[Billing] Erro Asaas:', erroAsaas.message);
      // Continua sem pagamento Asaas (fallback)
    }

    res.json({
      sucesso: true,
      transacao: {
        id: transacao.id,
        quantidade,
        valorUnitario: config.custoPorCreditoExtra,
        valorTotal,
        plano
      },
      comparativoPro,
      pagamento,
      mensagem: pagamento ? 'Escaneie o QR Code PIX para pagar' : 'Transação criada. Configure Asaas para pagamento.'
    });
  } catch (erro: any) {
    console.error('Erro ao comprar créditos:', erro);
    responderErro(res, 500, 'Erro ao comprar créditos');
  }
});

// ====================================
// EXECUTAR UPGRADE DE PLANO
// ====================================

/**
 * POST /billing/upgrade
 * Executa o upgrade de plano com pagamento pro-rata
 */
router.post('/upgrade', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado');
    }

    const { novoPlano } = req.body;

    if (!novoPlano || !['GROWTH', 'PRO'].includes(novoPlano)) {
      return responderErro(res, 400, 'novoPlano inválido. Use: GROWTH ou PRO');
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    const planoAtual = tenant.planoTipo || 'STARTER';
    const configAtual = servicoGestaoClientes.CONFIGURACOES_PLANOS[planoAtual as keyof typeof servicoGestaoClientes.CONFIGURACOES_PLANOS];
    const configNovo = servicoGestaoClientes.CONFIGURACOES_PLANOS[novoPlano as keyof typeof servicoGestaoClientes.CONFIGURACOES_PLANOS];

    // Verificar se é upgrade
    if (configNovo.valorMensal <= configAtual.valorMensal) {
      return responderErro(res, 400, 'Só é possível fazer upgrade');
    }

    // Calcular valor pro-rata
    const hoje = new Date();
    const dataRenovacao = tenant.dataRenovacao ? new Date(tenant.dataRenovacao) : new Date();
    const diasRestantes = Math.max(0, Math.ceil((dataRenovacao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
    const diferencaDiaria = (configNovo.valorMensal - configAtual.valorMensal) / 30;
    const valorUpgrade = Math.round(diferencaDiaria * diasRestantes * 100) / 100;

    // Criar transação de upgrade
    const transacao = await prisma.transacao.create({
      data: {
        tenantId,
        tipo: 'UPGRADE',
        descricao: `Upgrade: ${planoAtual} → ${novoPlano}`,
        valor: valorUpgrade,
        creditos: configNovo.creditosMensais, // Créditos que serão adicionados
        tipoCredito: 'MENSAIS',
        status: 'PENDENTE'
      }
    });

    // TODO: Integrar com Asaas para gerar link de pagamento
    // Por enquanto, simular confirmação automática para teste

    // SIMULAÇÃO: Confirmar upgrade imediatamente (remover em produção)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planoTipo: novoPlano,
        plano: novoPlano,
        valorPlano: configNovo.valorMensal,
        creditosMensais: configNovo.creditosMensais // Opção A: créditos completos imediatamente
      }
    });

    await prisma.transacao.update({
      where: { id: transacao.id },
      data: {
        status: 'CONFIRMADO',
        confirmadoEm: new Date()
      }
    });

    const saldo = await servicoCreditos.consultarSaldo(tenantId);

    res.json({
      sucesso: true,
      upgrade: {
        de: planoAtual,
        para: novoPlano,
        valorPago: valorUpgrade,
        creditosAdicionados: configNovo.creditosMensais
      },
      saldo,
      mensagem: `Upgrade realizado! Você agora é ${novoPlano} com ${configNovo.creditosMensais} créditos mensais.`
    });
  } catch (erro: any) {
    console.error('Erro ao executar upgrade:', erro);
    responderErro(res, 500, 'Erro ao executar upgrade');
  }
});

export default router;
