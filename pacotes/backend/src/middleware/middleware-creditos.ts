// Middleware de Verificação de Créditos
// Bloqueia requisições se tenant não tem créditos suficientes

import { responderErro } from '../utilitarios/resposta';
import { Request, Response, NextFunction } from 'express';
import { servicoCreditos } from '../servicos/servico-creditos';

// Extender Request para incluir tenantId e saldo
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      saldoCreditos?: number;
    }
  }
}

/**
 * Middleware que verifica se o tenant tem créditos disponíveis
 * Deve ser usado em rotas que consomem créditos (ex: consulta CPF)
 */
export const verificarCreditos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      responderErro(res, 401, 'Não autorizado',
        {mensagem: 'TenantId não encontrado na requisição'});
      return;
    }

    const saldo = await servicoCreditos.consultarSaldo(tenantId);

    if (saldo.total <= 0) {
      res.status(402).json({
        erro: 'Créditos insuficientes',
        mensagem: 'Você não tem créditos disponíveis. Faça uma recarga para continuar.',
        saldo: {
          mensais: saldo.mensais,
          prepagos: saldo.prepagos,
          bonus: saldo.bonus,
          total: 0
        },
        plano: saldo.plano,
        dataRenovacao: saldo.dataRenovacao
      });
      return;
    }

    // Anexar saldo à requisição para uso posterior
    req.saldoCreditos = saldo.total;
    
    next();
  } catch (erro) {
    console.error('Erro ao verificar créditos:', erro);
    responderErro(res, 500, 'Erro interno',
      {mensagem: 'Não foi possível verificar os créditos'});
  }
};

/**
 * Middleware que alerta se créditos estão baixos (menos de 10)
 * Não bloqueia, apenas adiciona header de aviso
 */
export const alertarCreditosBaixos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      next();
      return;
    }

    const saldo = await servicoCreditos.consultarSaldo(tenantId);

    if (saldo.total > 0 && saldo.total <= 10) {
      res.setHeader('X-Creditos-Restantes', saldo.total.toString());
      res.setHeader('X-Creditos-Alerta', 'baixo');
    }

    next();
  } catch (erro) {
    // Não bloqueia se der erro, apenas loga
    console.error('Erro ao alertar créditos baixos:', erro);
    next();
  }
};
