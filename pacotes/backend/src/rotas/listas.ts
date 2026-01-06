import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { Lista } from '@prisma/client';

const router = Router();

// ====================================
// HELPER PARA TENANT
// ====================================

/**
 * Extrai o tenantId do request
 * Ordem de prioridade: header > query > body > fallback para último tenant
 */
const getTenantId = async (req: Request): Promise<string> => {
  // 1. Header x-tenant-id
  if (req.headers['x-tenant-id']) {
    return req.headers['x-tenant-id'] as string;
  }

  // 2. Query param
  if (req.query.tenantId) {
    return req.query.tenantId as string;
  }

  // 3. Body
  if (req.body?.tenantId) {
    return req.body.tenantId;
  }

  // 4. Fallback: buscar o último tenant criado (mais provável ser o ativo)
  const tenant = await prisma.tenant.findFirst({
    orderBy: { criadoEm: 'desc' }
  });

  return tenant?.id || '';
};

// ====================================
// SCHEMAS DE VALIDAÇÃO
// ====================================

const criarListaSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  nomeEdificio: z.string().min(2, 'Nome do edifício obrigatório'),
  localizacao: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  dadosPesquisa: z.any().optional().nullable(),
  contatos: z.array(z.object({
    nome: z.any().optional().nullable(),
    cpf: z.any().optional().nullable(),
    inscricaoIptu: z.any().optional().nullable(),
    unidade: z.any().optional().nullable(),
    box: z.any().optional().nullable(),
    enderecoImovel: z.any().optional().nullable(),
    bairroImovel: z.any().optional().nullable(),
    telefone: z.any().optional().nullable(),
    telefone2: z.any().optional().nullable(),
    telefone3: z.any().optional().nullable(),
    telefone4: z.any().optional().nullable(),
    telefone5: z.any().optional().nullable(),
    telefonesJson: z.any().optional().nullable(),
    email: z.any().optional().nullable(),
    email2: z.any().optional().nullable(),
    email3: z.any().optional().nullable(),
    email4: z.any().optional().nullable(),
    email5: z.any().optional().nullable(),
    emailsJson: z.any().optional().nullable(),
    temWhatsapp: z.any().optional().nullable(),
    quantidadeWhatsapp: z.any().optional().nullable(),
  }).passthrough()).optional().default([]),
});

type ContatoInput = z.infer<typeof criarListaSchema>['contatos'][number];

// ====================================
// ROTAS
// ====================================

/**
 * GET /api/listas
 * Lista todas as listas do tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ erro: 'Nenhum tenant configurado' });
    }

    const listas = await prisma.lista.findMany({
      where: { tenantId },
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: { contatos: true }
        }
      }
    });

    // Formatar resposta
    const listasFormatadas = listas.map((lista: any) => ({
      id: lista.id,
      nome: lista.nome,
      nomeEdificio: lista.nomeEdificio,
      localizacao: lista.localizacao,
      totalContatos: lista.totalContatos,
      totalEnriquecidos: lista.totalEnriquecidos,
      totalComWhatsapp: lista.totalComWhatsapp,
      totalUsados: lista.totalUsados,
      criadoEm: lista.criadoEm,
    }));

    return res.json(listasFormatadas);
  } catch (error: any) {
    console.error('[Listas] Erro ao listar:', error);
    return res.status(500).json({ erro: 'Erro ao buscar listas' });
  }
});

/**
 * GET /api/listas/:id
 * Busca uma lista específica com seus contatos
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pagina = '1', limite = '50' } = req.query;

    const paginaNum = parseInt(pagina as string) || 1;
    const limiteNum = parseInt(limite as string) || 50;
    const skip = (paginaNum - 1) * limiteNum;

    const lista = await prisma.lista.findUnique({
      where: { id },
      include: {
        _count: {
          select: { contatos: true }
        }
      }
    });

    if (!lista) {
      return res.status(404).json({ erro: 'Lista não encontrada' });
    }

    // Buscar contatos paginados
    const contatos = await prisma.contatoLista.findMany({
      where: { listaId: id },
      orderBy: { nome: 'asc' },
      skip,
      take: limiteNum,
    });

    const totalContatos = await prisma.contatoLista.count({
      where: { listaId: id }
    });

    return res.json({
      ...lista,
      contatos,
      paginacao: {
        pagina: paginaNum,
        limite: limiteNum,
        total: totalContatos,
        totalPaginas: Math.ceil(totalContatos / limiteNum),
      }
    });
  } catch (error: any) {
    console.error('[Listas] Erro ao buscar lista:', error);
    return res.status(500).json({ erro: 'Erro ao buscar lista' });
  }
});

/**
 * POST /api/listas
 * Cria uma nova lista com contatos
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('[Listas] Criando nova lista...');
    console.log('[Listas] Body recebido:', {
      nome: req.body.nome,
      nomeEdificio: req.body.nomeEdificio,
      localizacao: req.body.localizacao,
      contatosLength: req.body.contatos?.length,
    });

    const dados = criarListaSchema.parse(req.body);

    // Buscar tenant
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ erro: 'Nenhum tenant configurado' });
    }

    // Calcular estatísticas
    const contatos: ContatoInput[] = dados.contatos || [];
    const totalEnriquecidos = contatos.filter((c: ContatoInput) => c.telefone).length;
    const totalComWhatsapp = contatos.filter((c: ContatoInput) => c.temWhatsapp).length;

    // Criar lista
    const lista = await prisma.lista.create({
      data: {
        tenantId,
        nome: dados.nome,
        nomeEdificio: dados.nomeEdificio,
        localizacao: dados.localizacao,
        cep: dados.cep,
        dadosPesquisa: dados.dadosPesquisa,
        totalContatos: contatos.length,
        totalEnriquecidos,
        totalComWhatsapp,
      }
    });

    // Criar contatos
    if (contatos.length > 0) {
      await prisma.contatoLista.createMany({
        data: contatos.map((c: ContatoInput) => {
          // Garantir que strings são strings
          const str = (v: any): string | undefined => {
            if (v === null || v === undefined) return undefined;
            if (typeof v === 'string') return v || undefined;
            return String(v);
          };

          // Garantir que CPF é só números
          const cpfLimpo = str(c.cpf)?.replace(/\D/g, '') || undefined;

          return {
            listaId: lista.id,
            nome: str(c.nome) || 'Proprietário',
            cpf: cpfLimpo,
            inscricaoIptu: str(c.inscricaoIptu),
            unidade: str(c.unidade),
            box: str(c.box),
            enderecoImovel: str(c.enderecoImovel),
            bairroImovel: str(c.bairroImovel),
            telefone: str(c.telefone),
            telefone2: str(c.telefone2),
            telefone3: str(c.telefone3),
            telefone4: str(c.telefone4),
            telefone5: str(c.telefone5),
            telefonesJson: c.telefonesJson || undefined,
            email: str(c.email),
            email2: str(c.email2),
            email3: str(c.email3),
            email4: str(c.email4),
            email5: str(c.email5),
            emailsJson: c.emailsJson || undefined,
            temWhatsapp: Boolean(c.temWhatsapp),
            quantidadeWhatsapp: Number(c.quantidadeWhatsapp) || 0,
          };
        }),
        skipDuplicates: true,
      });
    }

    console.log(`[Listas] ✅ Lista "${lista.nome}" criada com ${contatos.length} contatos`);

    return res.status(201).json({
      sucesso: true,
      lista: {
        id: lista.id,
        nome: lista.nome,
        nomeEdificio: lista.nomeEdificio,
        totalContatos: lista.totalContatos,
        totalEnriquecidos,
        totalComWhatsapp,
      }
    });
  } catch (error: any) {
    console.error('[Listas] Erro ao criar lista:', error);
    console.error('[Listas] Error name:', error.name);
    console.error('[Listas] Error message:', error.message);

    if (error.name === 'ZodError') {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }

    // Erro de unique constraint (CPF duplicado na lista)
    if (error.code === 'P2002') {
      return res.status(400).json({
        erro: 'Contato duplicado na lista',
        detalhes: 'Já existe um contato com o mesmo CPF nesta lista'
      });
    }

    // Erro de foreign key (tenant não existe)
    if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
      console.error('[Listas] Tenant não encontrado:', error.message);
      return res.status(401).json({
        erro: 'Sessão expirada',
        detalhes: 'Faça login novamente para atualizar sua sessão'
      });
    }

    return res.status(500).json({ erro: 'Erro ao criar lista', detalhes: error.message });
  }
});

/**
 * DELETE /api/listas/:id
 * Exclui uma lista e seus contatos
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lista = await prisma.lista.findUnique({
      where: { id },
      include: { _count: { select: { contatos: true } } }
    });

    if (!lista) {
      return res.status(404).json({ erro: 'Lista não encontrada' });
    }

    // Contatos são excluídos automaticamente pelo onDelete: Cascade
    await prisma.lista.delete({ where: { id } });

    console.log(`[Listas] ✅ Lista "${lista.nome}" excluída`);

    return res.json({
      sucesso: true,
      mensagem: `Lista "${lista.nome}" excluída com sucesso`,
      contatosExcluidos: lista._count.contatos
    });
  } catch (error: any) {
    console.error('[Listas] Erro ao excluir lista:', error);
    return res.status(500).json({ erro: 'Erro ao excluir lista' });
  }
});

/**
 * POST /api/listas/:id/adicionar-campanha
 * Adiciona contatos de uma lista a uma campanha
 */
router.post('/:id/adicionar-campanha', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { campanhaId, contatoIds } = req.body;

    if (!campanhaId) {
      return res.status(400).json({ erro: 'campanhaId é obrigatório' });
    }

    // Verificar se lista existe
    const lista = await prisma.lista.findUnique({ where: { id } });
    if (!lista) {
      return res.status(404).json({ erro: 'Lista não encontrada' });
    }

    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({ where: { id: campanhaId } });
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Buscar contatos da lista (todos ou específicos)
    const whereContatos: any = { listaId: id };
    if (contatoIds && contatoIds.length > 0) {
      whereContatos.id = { in: contatoIds };
    }

    const contatosLista = await prisma.contatoLista.findMany({
      where: whereContatos
    });

    // Buscar CPFs já existentes na campanha
    // Buscar dados para verificação de duplicidade (CPF, IPTU, Telefone)
    const contatosExistentes = await prisma.contato.findMany({
      where: { campanhaId },
      select: {
        cpf: true,
        inscricaoIptu: true,
        telefone: true
      }
    });

    const cpfsNaCampanha = new Set(contatosExistentes.map(c => c.cpf?.replace(/\D/g, '')).filter(Boolean));
    const iptusNaCampanha = new Set(contatosExistentes.map(c => c.inscricaoIptu?.replace(/\D/g, '')).filter(Boolean));
    const telefonesNaCampanha = new Set(contatosExistentes.map(c => c.telefone?.replace(/\D/g, '')).filter(Boolean));

    // Filtrar contatos não duplicados
    const contatosNovos = contatosLista.filter((c: any) => {
      const cpfLimpo = c.cpf?.replace(/\D/g, '');
      const iptuLimpo = c.inscricaoIptu?.replace(/\D/g, '');
      const telLimpo = c.telefone?.replace(/\D/g, '');

      // 1. Verifica duplicidade por CPF (se existir)
      if (cpfLimpo && cpfsNaCampanha.has(cpfLimpo)) {
        return false;
      }

      // 2. Verifica duplicidade por IPTU (se existir)
      if (iptuLimpo && iptusNaCampanha.has(iptuLimpo)) {
        return false;
      }

      // 3. Verifica duplicidade por Telefone (se existir)
      if (telLimpo && telefonesNaCampanha.has(telLimpo)) {
        return false;
      }

      // Se passou por todas as verificações, permite importar
      // (Mesmo que não tenha CPF, desde que tenha passado pelas outras checagens)
      return true;
    });

    let adicionados = 0;

    // Criar contatos na campanha
    for (const contato of contatosNovos) {
      await prisma.contato.create({
        data: {
          campanhaId,
          nome: contato.nome,
          cpf: contato.cpf,
          inscricaoIptu: contato.inscricaoIptu,
          unidade: contato.unidade,
          box: contato.box,
          enderecoImovel: contato.enderecoImovel,
          bairroImovel: contato.bairroImovel,
          telefone: contato.telefone,
          telefone2: contato.telefone2,
          telefone3: contato.telefone3,
          telefone4: contato.telefone4,
          telefone5: contato.telefone5,
          telefonesJson: contato.telefonesJson || undefined,
          email: contato.email,
          email2: contato.email2,
          email3: contato.email3,
          email4: contato.email4,
          email5: contato.email5,
          emailsJson: contato.emailsJson || undefined,
          temWhatsapp: contato.temWhatsapp,
          quantidadeWhatsapp: contato.quantidadeWhatsapp,
          statusProspeccao: 'AGUARDANDO',
        }
      });

      // Marcar contato como usado
      await prisma.contatoLista.update({
        where: { id: contato.id },
        data: {
          usadoEmCampanha: true,
          campanhaId: campanhaId
        }
      });

      adicionados++;
    }

    // Atualizar contadores
    await prisma.campanha.update({
      where: { id: campanhaId },
      data: { totalContatos: { increment: adicionados } }
    });

    await prisma.lista.update({
      where: { id },
      data: { totalUsados: { increment: adicionados } }
    });

    console.log(`[Listas] ✅ ${adicionados} contatos adicionados à campanha "${campanha.nome}"`);

    return res.json({
      sucesso: true,
      adicionados,
      duplicados: contatosLista.length - adicionados,
      mensagem: `${adicionados} contatos adicionados à campanha`
    });
  } catch (error: any) {
    console.error('[Listas] Erro ao adicionar à campanha:', error);
    return res.status(500).json({ erro: 'Erro ao adicionar contatos à campanha' });
  }
});

export default router;
