import { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/db';
import { responderErro } from '../utilitarios/resposta';

declare global {
  namespace Express {
    interface Request {
      chaveApi?: {
        id: string;
        nome: string;
        escopos: string[];
      };
    }
  }
}

interface RotaPermitida {
  metodo: string;
  caminho: RegExp;
}

// Allowlist fechada por escopo (mesmo espírito de ROTAS_PUBLICAS do default-deny):
// toda rota nasce FORA de todo escopo. Inclusões aqui exigem revisão de segurança.
// Regex exatos de propósito: a fronteira é por método + caminho completo, nunca
// por prefixo. `/unidades/\d+` não casa `/unidades/jobs/...`, e as três rotas de
// job liberadas abaixo não abrem as vizinhas (`/jobs/:id` cru, sufixo extra,
// outro método) — há teste para cada uma dessas fronteiras.
const ROTAS_POR_ESCOPO: Readonly<Record<string, readonly RotaPermitida[]>> = Object.freeze({
  'mineracao:read': Object.freeze([
    { metodo: 'GET', caminho: /^\/api\/mineracao\/bairros$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/edificios\/\d+$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/unidades\/\d+$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/buscar-imoveis$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/condominios$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/casas\/\d+$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/endereco$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/unidades-lote$/ },
    { metodo: 'POST', caminho: /^\/api\/mineracao\/proprietarios-base$/ },
    { metodo: 'POST', caminho: /^\/api\/mineracao\/fotos-empreendimentos$/ },
    // Unidades por job. E o unico caminho que lista casas de condominio
    // horizontal: `/casas/:cdbairro` devolve zero em producao.
    // Sem credito e sem tenant (as rotas nao tocam req.tenantId nem cobranca —
    // o que cobra e devolve CPF e `/api/mineracao/jobs/*`, que segue negada).
    // Le o banco local; com `MINERACAO_LOCAL_ONLY=false` o ramo tipo:'edificio'
    // tem fallback para a API da Prefeitura — mesma superficie ja alcancavel
    // por `GET /unidades/:cd`, que tambem esta liberada.
    // O job tem teto de unidades (job-unidades.ts) para o cruzamento por nome
    // nao virar varredura de tabela.
    { metodo: 'POST', caminho: /^\/api\/mineracao\/unidades\/jobs\/iniciar$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/unidades\/jobs\/[\w-]+\/status$/ },
    { metodo: 'GET', caminho: /^\/api\/mineracao\/unidades\/jobs\/[\w-]+\/resultado$/ }
  ])
});

function normalizarCaminho(caminho: string): string {
  if (caminho.length > 1 && caminho.endsWith('/')) return caminho.slice(0, -1);
  return caminho;
}

function escopoCobre(escopos: string[], req: Pick<Request, 'method' | 'path'>): boolean {
  const metodo = req.method.toUpperCase();
  const caminho = normalizarCaminho(req.path);
  return escopos.some((escopo) =>
    (ROTAS_POR_ESCOPO[escopo] ?? []).some((rota) => rota.metodo === metodo && rota.caminho.test(caminho))
  );
}

export function hashChaveApi(chave: string): string {
  return createHash('sha256').update(chave).digest('hex');
}

/**
 * Autentica chamadas máquina-a-máquina pelo header `x-api-key`.
 * Nunca cai para o fluxo JWT: chave presente e inválida é 401 terminal.
 * Não injeta usuário nem tenant — o contexto M2M é só a chave e seus escopos.
 */
export async function autenticarApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const valor = req.headers['x-api-key'];
  if (typeof valor !== 'string' || !valor.trim()) {
    responderErro(res, 401, 'Chave de API não fornecida');
    return;
  }

  const chave = await prisma.chaveApi.findUnique({ where: { chaveHash: hashChaveApi(valor.trim()) } });
  if (!chave || !chave.ativa || (chave.expiraEm && chave.expiraEm.getTime() <= Date.now())) {
    responderErro(res, 401, 'Chave de API inválida');
    return;
  }

  if (!escopoCobre(chave.escopos, req)) {
    responderErro(res, 403, 'Escopo da chave não cobre esta rota');
    return;
  }

  try {
    await prisma.chaveApi.update({
      where: { id: chave.id },
      data: { ultimoUsoEm: new Date(), contadorUso: { increment: 1 } }
    });
  } catch {
    // Telemetria de uso nunca bloqueia a chamada autorizada.
  }

  req.chaveApi = { id: chave.id, nome: chave.nome, escopos: chave.escopos };
  next();
}
