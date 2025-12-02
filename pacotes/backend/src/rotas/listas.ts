import { Router } from 'express';
import { prisma } from '../servidor';
import { z } from 'zod';

const router = Router();

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
    nome: z.string().min(1).default('Proprietário'),
    cpf: z.string().optional().nullable(),
    inscricaoIptu: z.string().optional().nullable(),
    unidade: z.string().optional().nullable(),
    box: z.string().optional().nullable(),
    enderecoImovel: z.string().optional().nullable(),
    bairroImovel: z.string().optional().nullable(),
    telefone: z.string().optional().nullable(),
    telefone2: z.string().optional().nullable(),
    telefone3: z.string().optional().nullable(),
    telefone4: z.string().optional().nullable(),
    telefone5: z.string().optional().nullable(),
    telefonesJson: z.any().optional().nullable(),
    email: z.string().optional().nullable(),
    email2: z.string().optional().nullable(),
    email3: z.string().optional().nullable(),
    email4: z.string().optional().nullable(),
    email5: z.string().optional().nullable(),
    emailsJson: z.any().optional().nullable(),
    temWhatsapp: z.boolean().optional().default(false),
    quantidadeWhatsapp: z.number().optional().default(0),
  })).optional().default([]),
});

// ====================================
// ROTAS
// ====================================

/**
 * GET /api/listas
 * Lista todas as listas do tenant
 */
router.get('/', async (req, res) => {
  try {
    // Buscar tenant (simplificado - usar o primeiro disponível)
    const tenant = await prisma.tenant.findFirst();
    
    if (!tenant) {
      return res.status(400).json({ erro: 'Nenhum tenant configurado' });
    }

    const listas = await prisma.lista.findMany({
      where: { tenantId: tenant.id },
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: { contatos: true }
        }
      }
    });

    // Formatar resposta
    const listasFormatadas = listas.map(lista => ({
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.status(400).json({ erro: 'Nenhum tenant configurado' });
    }

    // Calcular estatísticas
    const contatos = dados.contatos || [];
    const totalEnriquecidos = contatos.filter(c => c.telefone).length;
    const totalComWhatsapp = contatos.filter(c => c.temWhatsapp).length;

    // Criar lista
    const lista = await prisma.lista.create({
      data: {
        tenantId: tenant.id,
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
        data: contatos.map(c => ({
          listaId: lista.id,
          nome: c.nome,
          cpf: c.cpf?.replace(/\D/g, ''),
          inscricaoIptu: c.inscricaoIptu,
          unidade: c.unidade,
          box: c.box,
          enderecoImovel: c.enderecoImovel,
          bairroImovel: c.bairroImovel,
          telefone: c.telefone,
          telefone2: c.telefone2,
          telefone3: c.telefone3,
          telefone4: c.telefone4,
          telefone5: c.telefone5,
          telefonesJson: c.telefonesJson,
          email: c.email,
          email2: c.email2,
          email3: c.email3,
          email4: c.email4,
          email5: c.email5,
          emailsJson: c.emailsJson,
          temWhatsapp: c.temWhatsapp || false,
          quantidadeWhatsapp: c.quantidadeWhatsapp || 0,
        })),
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
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    
    return res.status(500).json({ erro: 'Erro ao criar lista' });
  }
});

/**
 * DELETE /api/listas/:id
 * Exclui uma lista e seus contatos
 */
router.delete('/:id', async (req, res) => {
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
router.post('/:id/adicionar-campanha', async (req, res) => {
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
    const cpfsExistentes = await prisma.contato.findMany({
      where: { campanhaId },
      select: { cpf: true }
    });
    const cpfsNaCampanha = new Set(cpfsExistentes.map(c => c.cpf?.replace(/\D/g, '')));

    // Filtrar contatos não duplicados
    const contatosNovos = contatosLista.filter(c => {
      const cpfLimpo = c.cpf?.replace(/\D/g, '');
      return cpfLimpo && !cpfsNaCampanha.has(cpfLimpo);
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
          telefonesJson: contato.telefonesJson,
          email: contato.email,
          email2: contato.email2,
          email3: contato.email3,
          email4: contato.email4,
          email5: contato.email5,
          emailsJson: contato.emailsJson,
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
