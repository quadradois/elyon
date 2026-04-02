import { Response } from 'express';

export function responderErro(res: Response, status: number, mensagem: string, extras?: Record<string, any>) {
  return res.status(status).json({
    sucesso: false,
    erro: mensagem,
    ...extras
  });
}
