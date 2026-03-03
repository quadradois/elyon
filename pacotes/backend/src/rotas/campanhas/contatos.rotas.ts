/**
 * Rotas de Contatos - Gestão de Contatos de Campanhas
 * 
 * Responsabilidades:
 * - Listar, atualizar, registrar tentativas
 * - Importar contatos (JSON e CSV)
 * - Vincular leads minerados
 * - Vincular leads do banco
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/db';
import { z } from 'zod';
import multer from 'multer';
import Papa from 'papaparse';
import { normalizarTelefone } from '../../utils/telefone';

const router = Router();

// ============================================
// HELPER PARA TENANT
// ============================================

/**
 * Extrai o tenantId do request
 */
const getTenantId = (req: Request): string | null => {
  if ((req as any).tenantId) return (req as any).tenantId;
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  if (req.query.tenantId) return req.query.tenantId as string;
  return null;
};

/**
 * Verifica se a campanha pertence ao tenant
 * Retorna a campanha se válida, null se não encontrada, ou 'forbidden' se não pertence ao tenant
 */
const verificarCampanhaTenant = async (campanhaId: string, tenantId: string | null): Promise<any | 'forbidden' | null> => {
  if (!tenantId) return 'forbidden';

  const campanha = await prisma.campanha.findUnique({ where: { id: campanhaId } });
  if (!campanha) return null;
  if (campanha.tenantId !== tenantId) return 'forbidden';

  return campanha;
};

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'));
    }
  }
});

// ============================================
// TEMPLATE CSV
// ============================================

/**
 * GET /template-csv
 * Retorna um arquivo CSV modelo para importação de contatos
 */
router.get('/template-csv', (req, res) => {
  const template = `nome;telefone;telefone2;email;cpf;endereco;bairro;unidade;bloco
João Silva;62999998888;62988887777;joao@email.com;12345678901;Rua A 123;Setor Bueno;1001;A
Maria Santos;62977776666;;maria@email.com;98765432100;Av B 456;Jardim Goiás;502;B`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo_contatos.csv"');
  res.send('\ufeff' + template); // BOM para Excel reconhecer UTF-8
});

// ============================================
// LISTAR E BUSCAR CONTATOS
// ============================================

/**
 * GET /:id/contatos
 * Lista todos os contatos da campanha com paginação
 */
router.get('/:id/contatos', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // ✅ Verificar ownership da campanha
    const campanha = await verificarCampanhaTenant(id, tenantId);
    if (campanha === null) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }
    if (campanha === 'forbidden') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const where: any = { campanhaId: id };
    if (status) {
      where.statusProspeccao = status;
    }

    const [contatosBrutos, total] = await Promise.all([
      prisma.contato.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contato.count({ where })
    ]);

    const contatos = contatosBrutos.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      telefone: c.telefone,
      telefone2: c.telefone2,
      telefone3: c.telefone3,
      telefone4: c.telefone4,
      telefone5: c.telefone5,
      telefonesJson: c.telefonesJson,
      temWhatsapp: c.temWhatsapp,
      quantidadeWhatsapp: c.quantidadeWhatsapp,
      email: c.email,
      email2: c.email2,
      email3: c.email3,
      email4: c.email4,
      email5: c.email5,
      emailsJson: c.emailsJson,
      inscricaoIptu: c.inscricaoIptu,
      enderecoImovel: c.enderecoImovel,
      bairroImovel: c.bairroImovel,
      areaTerreno: c.areaTerreno,
      areaConstruida: c.areaConstruida,
      tipoImovel: c.tipoImovel,
      valorVenal: c.valorVenal,
      nomeEdificio: c.nomeEdificio,
      apartamento: c.apartamento,
      bloco: c.bloco,
      unidade: c.unidade,
      box: c.box,
      quadra: c.quadra,
      lote: c.lote,
      scoreAssertiva: c.scoreAssertiva,
      statusProspeccao: c.statusProspeccao,
      tentativasContato: c.tentativasContato,
      ultimaTentativa: c.ultimaTentativa,
      respondeu: c.respondeu,
      manifestouInteresse: c.manifestouInteresse,
      virouLead: c.virouLead,
      observacoes: c.observacoes,
      criadoEm: c.criadoEm,
    }));

    const estatisticas = await prisma.contato.groupBy({
      by: ['statusProspeccao'],
      where: { campanhaId: id },
      _count: true
    });

    const stats = {
      total,
      porStatus: Object.fromEntries(
        estatisticas.map(e => [e.statusProspeccao, e._count])
      )
    };

    return res.json({
      contatos,
      paginacao: { pagina: page, limite: limit, total, totalPaginas: Math.ceil(total / limit) },
      estatisticas: stats
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao listar contatos:', error);
    return res.status(500).json({ erro: 'Erro ao listar contatos' });
  }
});

/**
 * PATCH /:campanhaId/contatos/:contatoId
 * Atualiza um contato específico
 */
router.patch('/:campanhaId/contatos/:contatoId', async (req, res) => {
  try {
    const { campanhaId, contatoId } = req.params;
    const tenantId = getTenantId(req);

    // ✅ Verificar ownership da campanha
    const campanha = await verificarCampanhaTenant(campanhaId, tenantId);
    if (campanha === null) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }
    if (campanha === 'forbidden') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const contatoExistente = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId }
    });

    if (!contatoExistente) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    const { nome, telefone, telefone2, email, endereco, statusProspeccao, observacoes, manifestouInteresse } = req.body;

    const contato = await prisma.contato.update({
      where: { id: contatoId },
      data: {
        ...(nome && { nome }),
        ...(telefone && { telefone }),
        ...(telefone2 && { telefone2 }),
        ...(email && { email }),
        ...(endereco && { endereco }),
        ...(statusProspeccao && { statusProspeccao }),
        ...(observacoes !== undefined && { observacoes }),
        ...(manifestouInteresse !== undefined && { manifestouInteresse }),
      }
    });

    return res.json({ sucesso: true, contato });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao atualizar contato:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar contato' });
  }
});

/**
 * POST /:campanhaId/contatos/:contatoId/registrar-tentativa
 * Registra uma tentativa de contato
 */
router.post('/:campanhaId/contatos/:contatoId/registrar-tentativa', async (req, res) => {
  try {
    const { campanhaId, contatoId } = req.params;
    const { respondeu, manifestouInteresse, observacoes } = req.body;

    const contato = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    const novoStatus = respondeu
      ? (manifestouInteresse ? 'INTERESSADO' : 'SEM_INTERESSE')
      : 'CONTATANDO';

    const contatoAtualizado = await prisma.contato.update({
      where: { id: contatoId },
      data: {
        tentativasContato: { increment: 1 },
        ultimaTentativa: new Date(),
        statusProspeccao: novoStatus,
        ...(respondeu && {
          respondeu: true,
          primeiraResposta: contato.primeiraResposta || new Date()
        }),
        ...(manifestouInteresse !== undefined && { manifestouInteresse }),
        ...(observacoes && { observacoes }),
      }
    });

    return res.json({ sucesso: true, contato: contatoAtualizado });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao registrar tentativa:', error);
    return res.status(500).json({ erro: 'Erro ao registrar tentativa' });
  }
});

// ============================================
// IMPORTAÇÃO DE CONTATOS
// ============================================

/**
 * POST /:id/importar-contatos
 * Importar lista de contatos para a campanha (JSON)
 */
router.post('/:id/importar-contatos', async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      contatos: z.array(z.object({
        nome: z.string().min(1, 'Nome é obrigatório'),
        telefone: z.string().min(8, 'Telefone inválido'),
        email: z.string().email().optional().or(z.literal('')),
        cargo: z.string().optional(),
        empresa: z.string().optional(),
        linkedin: z.string().optional(),
      })),
    });

    const { contatos } = schema.parse(req.body);

    // ✅ Verificar ownership da campanha
    const tenantId = getTenantId(req);
    const campanha = await verificarCampanhaTenant(id, tenantId);
    if (campanha === null) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }
    if (campanha === 'forbidden') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    let importados = 0;
    let erros = 0;

    for (const contato of contatos) {
      try {
        await prisma.contato.create({
          data: {
            campanhaId: id,
            nome: contato.nome,
            telefone: normalizarTelefone(contato.telefone), // Normaliza telefone
            email: contato.email || null,
            statusProspeccao: 'AGUARDANDO',
          }
        });
        importados++;
      } catch (e) {
        console.error(`Erro ao importar contato ${contato.nome}:`, e);
        erros++;
      }
    }

    await prisma.campanha.update({
      where: { id },
      data: { totalContatos: { increment: importados } }
    });

    return res.json({
      sucesso: true,
      mensagem: `${importados} contatos importados com sucesso. ${erros > 0 ? `${erros} falhas.` : ''}`,
      totalImportado: importados,
      totalFalhas: erros
    });

  } catch (error: any) {
    console.error('Erro ao importar contatos:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    return res.status(500).json({ erro: 'Erro ao importar contatos' });
  }
});

/**
 * POST /:id/importar-csv
 * Importa contatos de um arquivo CSV para a campanha
 */
router.post('/:id/importar-csv', upload.single('arquivo'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }

    console.log(`[Campanhas] Importando CSV para campanha ${id}...`);
    console.log(`[Campanhas] Arquivo: ${file.originalname}, Tamanho: ${file.size} bytes`);

    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    const csvContent = file.buffer.toString('utf-8');

    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        return header
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '_');
      }
    });

    if (parsed.errors.length > 0) {
      console.error('[Campanhas] Erros no CSV:', parsed.errors);
      return res.status(400).json({ erro: 'Erro ao processar CSV', detalhes: parsed.errors.slice(0, 5) });
    }

    const rows = parsed.data as Record<string, string>[];
    console.log(`[Campanhas] ${rows.length} linhas encontradas no CSV`);

    const mapearColuna = (row: Record<string, string>, opcoes: string[]): string | null => {
      for (const opcao of opcoes) {
        if (row[opcao] && row[opcao].trim()) {
          return row[opcao].trim();
        }
      }
      return null;
    };

    const contatosExistentes = await prisma.contato.findMany({
      where: { campanhaId: id },
      select: { cpf: true, telefone: true }
    });
    const cpfsExistentes = new Set(contatosExistentes.map(c => c.cpf?.replace(/\D/g, '')).filter(Boolean));
    const telefonesExistentes = new Set(contatosExistentes.map(c => c.telefone?.replace(/\D/g, '')).filter(Boolean));

    const contatosParaCriar: any[] = [];
    const erros: { linha: number; motivo: string }[] = [];
    let duplicados = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linhaNum = i + 2;

      const nome = mapearColuna(row, ['nome', 'name', 'nome_completo', 'proprietario']);
      const telefone = mapearColuna(row, ['telefone', 'phone', 'celular', 'tel', 'fone', 'telefone1', 'telefone_1']);
      const telefone2 = mapearColuna(row, ['telefone2', 'telefone_2', 'phone2', 'celular2']);
      const telefone3 = mapearColuna(row, ['telefone3', 'telefone_3', 'phone3']);
      const email = mapearColuna(row, ['email', 'e_mail', 'mail', 'email1', 'email_1']);
      const email2 = mapearColuna(row, ['email2', 'email_2']);
      const cpf = mapearColuna(row, ['cpf', 'documento', 'doc']);
      const endereco = mapearColuna(row, ['endereco', 'endereco_imovel', 'address', 'logradouro', 'rua']);
      const bairro = mapearColuna(row, ['bairro', 'bairro_imovel', 'neighborhood']);
      const unidade = mapearColuna(row, ['unidade', 'apartamento', 'apto', 'apt', 'unit']);
      const bloco = mapearColuna(row, ['bloco', 'torre', 'block']);

      if (!nome) {
        erros.push({ linha: linhaNum, motivo: 'Nome obrigatório' });
        continue;
      }

      if (!telefone && !email) {
        erros.push({ linha: linhaNum, motivo: 'Telefone ou email obrigatório' });
        continue;
      }

      const cpfLimpo = cpf?.replace(/\D/g, '');
      if (cpfLimpo && cpfsExistentes.has(cpfLimpo)) {
        duplicados++;
        continue;
      }

      const telLimpo = telefone?.replace(/\D/g, '');
      if (telLimpo && telefonesExistentes.has(telLimpo)) {
        duplicados++;
        continue;
      }

      contatosParaCriar.push({
        campanhaId: id,
        nome,
        cpf: cpfLimpo || null,
        telefone: telLimpo || null,
        telefone2: telefone2?.replace(/\D/g, '') || null,
        telefone3: telefone3?.replace(/\D/g, '') || null,
        email: email || null,
        email2: email2 || null,
        enderecoImovel: endereco || null,
        bairroImovel: bairro || null,
        unidade: unidade || null,
        bloco: bloco || null,
        temWhatsapp: false,
        quantidadeWhatsapp: 0,
        statusProspeccao: 'AGUARDANDO',
      });

      if (cpfLimpo) cpfsExistentes.add(cpfLimpo);
      if (telLimpo) telefonesExistentes.add(telLimpo);
    }

    let inseridos = 0;
    if (contatosParaCriar.length > 0) {
      const result = await prisma.contato.createMany({
        data: contatosParaCriar,
        skipDuplicates: true,
      });
      inseridos = result.count;

      await prisma.campanha.update({
        where: { id },
        data: { totalContatos: { increment: inseridos } }
      });
    }

    console.log(`[Campanhas] ✅ Importação concluída: ${inseridos} inseridos, ${duplicados} duplicados, ${erros.length} erros`);

    return res.json({
      sucesso: true,
      importados: inseridos,
      duplicados,
      erros: erros.slice(0, 10),
      totalErros: erros.length,
      mensagem: `${inseridos} contatos importados com sucesso`
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao importar CSV:', error);
    return res.status(500).json({ erro: 'Erro ao processar arquivo CSV' });
  }
});

// ============================================
// VINCULAR LEADS
// ============================================

const vincularLeadsMineradosSchema = z.object({
  leads: z.array(z.object({
    nome: z.string(),
    cpf: z.string().optional(),
    telefones: z.array(z.object({
      numero: z.string(),
      tipo: z.enum(['CELULAR', 'FIXO']),
      whatsapp: z.boolean().optional()
    })).optional(),
    emails: z.array(z.string()).optional(),
    inscricaoIptu: z.string().optional(),
    enderecoImovel: z.string().optional(),
    bairroImovel: z.string().optional(),
    nomeEdificio: z.string().optional(),
    apartamento: z.string().optional(),
    bloco: z.string().optional(),
    unidade: z.string().optional(),
    box: z.string().optional(),
    quadra: z.string().optional(),
    lote: z.string().optional(),
    areaTerreno: z.number().optional(),
    areaConstruida: z.number().optional(),
    tipoImovel: z.string().optional(),
    valorVenal: z.number().optional(),
    anoConstituicao: z.number().optional(),
    score: z.number().optional(),
    dataNascimento: z.string().optional(),
    idade: z.number().optional(),
    sexo: z.string().optional(),
    signo: z.string().optional(),
    situacaoCadastral: z.string().optional(),
    obitoProvavel: z.boolean().optional(),
    nomeMae: z.string().optional(),
    ppe: z.boolean().optional(),
    rendaEstimada: z.number().optional(),
    faixaSalarial: z.string().optional(),
    profissao: z.string().optional(),
    setor: z.string().optional(),
    empresaAtual: z.string().optional(),
    cnpjEmpresa: z.string().optional(),
    endereco: z.object({
      logradouro: z.string().optional(),
      numero: z.string().optional(),
      complemento: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
      uf: z.string().optional(),
      cep: z.string().optional(),
    }).optional(),
    participacoesEmpresas: z.array(z.object({
      cnpj: z.string(),
      razaoSocial: z.string(),
      participacao: z.string()
    })).optional(),
    redesSociais: z.array(z.object({
      rede: z.string(),
      url: z.string()
    })).optional(),
    fonteEnriquecimento: z.string().optional(),
  }))
});

/**
 * POST /:id/vincular-leads-minerados
 * Vincula leads enriquecidos (da mineração) à campanha
 */
router.post('/:id/vincular-leads-minerados', async (req, res) => {
  try {
    const { id } = req.params;

    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    const { leads } = vincularLeadsMineradosSchema.parse(req.body);

    console.log(`[Campanhas] Vinculando ${leads.length} leads minerados à campanha ${id}...`);

    let vinculados = 0;
    let erros = 0;

    for (const lead of leads) {
      try {
        const telefones = lead.telefones || [];
        const telefonesOrdenados = [...telefones].sort((a, b) => {
          if (a.whatsapp && !b.whatsapp) return -1;
          if (!a.whatsapp && b.whatsapp) return 1;
          if (a.tipo === 'CELULAR' && b.tipo !== 'CELULAR') return -1;
          if (a.tipo !== 'CELULAR' && b.tipo === 'CELULAR') return 1;
          return 0;
        });

        const emails = lead.emails || [];
        const quantidadeWhatsapp = telefones.filter(t => t.whatsapp === true).length;

        let enderecoCompleto: string | undefined;
        if (lead.endereco) {
          const e = lead.endereco;
          enderecoCompleto = [
            e.logradouro, e.numero ? `nº ${e.numero}` : null, e.complemento,
            e.bairro, e.cidade, e.uf, e.cep ? `CEP: ${e.cep}` : null
          ].filter(Boolean).join(', ');
        }

        const dadosContato: any = {
          campanhaId: id,
          nome: lead.nome,
          cpf: lead.cpf?.replace(/\D/g, ''),
          telefone: normalizarTelefone(telefonesOrdenados[0]?.numero) || null,
          telefone2: normalizarTelefone(telefonesOrdenados[1]?.numero) || null,
          telefone3: normalizarTelefone(telefonesOrdenados[2]?.numero) || null,
          telefone4: normalizarTelefone(telefonesOrdenados[3]?.numero) || null,
          telefone5: normalizarTelefone(telefonesOrdenados[4]?.numero) || null,
          telefonesJson: telefones.length > 0 ? telefones : undefined,
          temWhatsapp: quantidadeWhatsapp > 0,
          quantidadeWhatsapp,
          email: emails[0] || null,
          email2: emails[1] || null,
          email3: emails[2] || null,
          email4: emails[3] || null,
          email5: emails[4] || null,
          emailsJson: emails.length > 0 ? emails : undefined,
          inscricaoIptu: lead.inscricaoIptu,
          enderecoImovel: lead.enderecoImovel,
          bairroImovel: lead.bairroImovel,
          nomeEdificio: lead.nomeEdificio,
          apartamento: lead.apartamento,
          bloco: lead.bloco,
          unidade: lead.unidade,
          box: lead.box,
          quadra: lead.quadra,
          lote: lead.lote,
          areaTerreno: lead.areaTerreno,
          areaConstruida: lead.areaConstruida,
          tipoImovel: lead.tipoImovel,
          valorVenal: lead.valorVenal,
          anoConstituicao: lead.anoConstituicao,
          dataNascimento: lead.dataNascimento ? new Date(lead.dataNascimento.split('/').reverse().join('-')) : null,
          idade: lead.idade,
          sexo: lead.sexo,
          signo: lead.signo,
          situacaoCadastral: lead.situacaoCadastral,
          obitoProvavel: lead.obitoProvavel || false,
          nomeMae: lead.nomeMae,
          ppe: lead.ppe || false,
          rendaEstimada: lead.rendaEstimada,
          faixaSalarial: lead.faixaSalarial,
          profissao: lead.profissao,
          setor: lead.setor,
          empresaAtual: lead.empresaAtual,
          cnpjEmpresa: lead.cnpjEmpresa,
          endereco: enderecoCompleto,
          cidade: lead.endereco?.cidade,
          estado: lead.endereco?.uf,
          cep: lead.endereco?.cep,
          participacoesEmpresas: lead.participacoesEmpresas,
          redesSociais: lead.redesSociais,
          scoreAssertiva: lead.score,
          fonteEnriquecimento: lead.fonteEnriquecimento || 'ASSERTIVA',
          enriquecidoEm: new Date(),
          statusProspeccao: 'AGUARDANDO',
        };

        await prisma.contato.create({ data: dadosContato });
        vinculados++;
      } catch (e: any) {
        console.error(`[Campanhas] Erro ao vincular lead ${lead.nome}:`, e.message);
        erros++;
      }
    }

    await prisma.campanha.update({
      where: { id },
      data: { totalContatos: { increment: vinculados } }
    });

    console.log(`[Campanhas] ✅ ${vinculados} leads vinculados, ${erros} erros`);

    return res.json({
      sucesso: true,
      vinculados,
      erros,
      mensagem: `${vinculados} leads vinculados à campanha.${erros > 0 ? ` ${erros} falhas.` : ''}`
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao vincular leads:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ erro: 'Dados inválidos', detalhes: error.errors });
    }
    return res.status(500).json({ erro: 'Erro ao vincular leads' });
  }
});

/**
 * POST /:id/vincular-leads-banco
 * Vincula todos os leads do banco de dados à campanha
 */
router.post('/:id/vincular-leads-banco', async (req, res) => {
  try {
    const { id } = req.params;
    const { edificio } = req.body;

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.status(400).json({ erro: 'Nenhum tenant configurado' });
    }

    const campanha = await prisma.campanha.findUnique({
      where: { id },
      include: { _count: { select: { contatos: true } } }
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    console.log(`[Campanhas] Vinculando leads do banco à campanha "${campanha.nome}"...`);

    const whereLeads: any = { tenantId: tenant.id };

    let leadIdsDoEdificio: string[] = [];
    if (edificio) {
      const imoveisDoEdificio = await prisma.imovel.findMany({
        where: { nomeEdificio: { contains: edificio, mode: 'insensitive' } },
        select: { leadId: true }
      });
      leadIdsDoEdificio = imoveisDoEdificio.map(i => i.leadId).filter((id): id is string => id !== null);

      if (leadIdsDoEdificio.length > 0) {
        whereLeads.id = { in: leadIdsDoEdificio };
      }
    }

    const cpfsExistentes = await prisma.contato.findMany({
      where: { campanhaId: id },
      select: { cpf: true }
    });
    const cpfsNaCampanha = new Set(cpfsExistentes.map(c => c.cpf?.replace(/\D/g, '')));

    const leads = await prisma.lead.findMany({
      where: whereLeads,
      select: { id: true, nome: true, cpf: true, telefone: true, email: true }
    });

    const leadsNovos = leads.filter(lead => {
      const cpfLimpo = lead.cpf?.replace(/\D/g, '');
      return cpfLimpo && !cpfsNaCampanha.has(cpfLimpo);
    });

    console.log(`[Campanhas] ${leadsNovos.length} leads novos para vincular`);

    let vinculados = 0;

    for (const lead of leadsNovos) {
      let telefone = lead.telefone;
      let telefone2: string | null = null;
      let telefone3: string | null = null;
      let telefone4: string | null = null;
      let telefone5: string | null = null;
      let temWhatsapp = false;
      let quantidadeWhatsapp = 0;
      let email = lead.email;
      let email2: string | null = null;
      let email3: string | null = null;
      let email4: string | null = null;
      let email5: string | null = null;
      let telefonesJson: any = null;
      let emailsJson: any = null;
      let inscricaoIptu: string | null = null;
      let enderecoImovel: string | null = null;
      let bairroImovel: string | null = null;
      let unidade: string | null = null;
      let box: string | null = null;
      let tipoImovel: string | null = null;
      let valorVenal: any = null;
      let nomeEdificio: string | null = null;
      let dataNascimento: Date | null = null;
      let idade: number | null = null;
      let sexo: string | null = null;
      let signo: string | null = null;
      let nomeMae: string | null = null;
      let situacaoCadastral: string | null = null;
      let obitoProvavel = false;
      let ppe = false;
      let profissao: string | null = null;
      let rendaEstimada: any = null;
      let faixaSalarial: string | null = null;
      let setor: string | null = null;
      let empresaAtual: string | null = null;
      let cnpjEmpresa: string | null = null;
      let scoreAssertiva: number | null = null;
      let enderecoPessoal: string | null = null;
      let cidadePessoal: string | null = null;
      let estadoPessoal: string | null = null;
      let cepPessoal: string | null = null;
      let temCacheAssertiva = false;

      if (lead.cpf) {
        const cpfLimpo = lead.cpf.replace(/\D/g, '');

        const cache = await prisma.cacheCpf.findFirst({ where: { cpf: cpfLimpo } });

        if (cache && cache.dados) {
          temCacheAssertiva = true;
          const dados = cache.dados as any;
          const telefones = dados.telefones || [];
          const emails = dados.emails || [];

          const telefonesOrdenados = [...telefones].sort((a: any, b: any) => {
            if (a.whatsapp && !b.whatsapp) return -1;
            if (!a.whatsapp && b.whatsapp) return 1;
            if (a.tipo === 'CELULAR' && b.tipo !== 'CELULAR') return -1;
            if (a.tipo !== 'CELULAR' && b.tipo === 'CELULAR') return 1;
            return 0;
          });

          telefone = normalizarTelefone(telefonesOrdenados[0]?.numero || lead.telefone);
          telefone2 = normalizarTelefone(telefonesOrdenados[1]?.numero) || null;
          telefone3 = normalizarTelefone(telefonesOrdenados[2]?.numero) || null;
          telefone4 = normalizarTelefone(telefonesOrdenados[3]?.numero) || null;
          telefone5 = normalizarTelefone(telefonesOrdenados[4]?.numero) || null;
          quantidadeWhatsapp = telefones.filter((t: any) => t.whatsapp === true).length;
          temWhatsapp = quantidadeWhatsapp > 0;
          telefonesJson = telefones.length > 0 ? telefones : null;

          email = emails[0] || lead.email;
          email2 = emails[1] || null;
          email3 = emails[2] || null;
          email4 = emails[3] || null;
          email5 = emails[4] || null;
          emailsJson = emails.length > 0 ? emails : null;

          inscricaoIptu = dados.nrinscr || null;
          enderecoImovel = dados.endereco_imovel || dados.nmlogradou || null;
          bairroImovel = dados.nmbairro || null;
          unidade = dados.unidade || null;
          box = dados.box || null;
          tipoImovel = dados.tipo_imovel || dados.tipoImovel || null;
          valorVenal = dados.vlvenal || dados.valorVenal || null;

          if (dados.dataNascimento) {
            try {
              const partes = dados.dataNascimento.split('/');
              dataNascimento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
            } catch (e) { /* ignora */ }
          }
          idade = dados.idade || null;
          sexo = dados.sexo || null;
          signo = dados.signo || null;
          nomeMae = dados.nomeMae || null;
          situacaoCadastral = dados.situacaoCadastral || null;
          obitoProvavel = dados.obitoProvavel || false;
          ppe = dados.ppe || false;
          profissao = dados.profissao || null;
          rendaEstimada = dados.rendaEstimada || null;
          faixaSalarial = dados.faixaSalarial || null;
          setor = dados.setor || null;
          empresaAtual = dados.empresaAtual || null;
          cnpjEmpresa = dados.cnpjEmpresa || null;
          scoreAssertiva = dados.score || null;

          if (dados.endereco) {
            const end = dados.endereco;
            enderecoPessoal = [end.tipoLogradouro, end.logradouro, end.numero, end.complemento]
              .filter(Boolean).join(' ').trim() || null;
            cidadePessoal = end.cidade || null;
            estadoPessoal = end.uf || null;
            cepPessoal = end.cep || null;
          }
        }

        const imovel = await prisma.imovel.findFirst({ where: { leadId: lead.id } });

        if (imovel) {
          inscricaoIptu = inscricaoIptu || imovel.inscricaoIptu;
          enderecoImovel = enderecoImovel || imovel.logradouro;
          bairroImovel = bairroImovel || imovel.bairro;
          nomeEdificio = nomeEdificio || imovel.nomeEdificio;
        }
      }

      await prisma.contato.create({
        data: {
          campanhaId: id,
          nome: lead.nome,
          cpf: lead.cpf?.replace(/\D/g, ''),
          telefone,
          telefone2,
          telefone3,
          telefone4,
          telefone5,
          telefonesJson,
          temWhatsapp,
          quantidadeWhatsapp,
          email,
          email2,
          email3,
          email4,
          email5,
          emailsJson,
          inscricaoIptu,
          enderecoImovel,
          bairroImovel,
          nomeEdificio,
          tipoImovel,
          valorVenal,
          unidade,
          box,
          dataNascimento,
          idade,
          sexo,
          signo,
          nomeMae,
          situacaoCadastral,
          obitoProvavel,
          ppe,
          profissao,
          rendaEstimada,
          faixaSalarial,
          setor,
          empresaAtual,
          cnpjEmpresa,
          scoreAssertiva,
          endereco: enderecoPessoal,
          cidade: cidadePessoal,
          estado: estadoPessoal,
          cep: cepPessoal,
          fonteEnriquecimento: temCacheAssertiva ? 'ASSERTIVA' : null,
          enriquecidoEm: temCacheAssertiva ? new Date() : null,
          statusProspeccao: 'AGUARDANDO',
          leadId: lead.id,
        }
      });
      vinculados++;
    }

    await prisma.campanha.update({
      where: { id },
      data: { totalContatos: { increment: vinculados } }
    });

    console.log(`[Campanhas] ✅ ${vinculados} leads vinculados com sucesso`);

    return res.json({
      sucesso: true,
      vinculados,
      total: campanha._count.contatos + vinculados,
      mensagem: `${vinculados} contatos vinculados à campanha`
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao vincular leads:', error);
    return res.status(500).json({ erro: 'Erro ao vincular leads do banco' });
  }
});

// ============================================
// LIMPAR HISTÓRICO DE CONVERSA
// ============================================

/**
 * POST /:id/contatos/:contatoId/limpar-historico
 * Limpa todo o histórico de mensagens de um contato para reiniciar a conversa do zero
 */
router.post('/:id/contatos/:contatoId/limpar-historico', async (req, res) => {
  try {
    const { id, contatoId } = req.params;

    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({
      where: { id }
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Verificar se contato existe e pertence à campanha
    const contato = await prisma.contato.findFirst({
      where: {
        id: contatoId,
        campanhaId: id
      },
      include: {
        _count: { select: { mensagens: true } }
      }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado nesta campanha' });
    }

    const totalMensagensAntes = contato._count.mensagens;

    // Deletar todas as mensagens do contato
    await prisma.mensagemProspeccao.deleteMany({
      where: { contatoId }
    });

    // Resetar status do contato para permitir novo envio
    await prisma.contato.update({
      where: { id: contatoId },
      data: {
        statusProspeccao: 'AGUARDANDO',
        tentativasContato: 0,
        ultimaTentativa: null,
        // Manter dados do contato, apenas resetar conversa
      }
    });

    console.log(`[Campanhas] 🧹 Histórico limpo para contato ${contato.nome} (${totalMensagensAntes} mensagens removidas)`);

    return res.json({
      sucesso: true,
      mensagem: `Histórico de ${contato.nome} limpo com sucesso`,
      mensagensRemovidas: totalMensagensAntes,
      novoStatus: 'AGUARDANDO'
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao limpar histórico:', error);
    return res.status(500).json({ erro: 'Erro ao limpar histórico de conversa' });
  }
});

/**
 * POST /:id/limpar-todos-historicos
 * Limpa o histórico de TODOS os contatos da campanha
 */
router.post('/:id/limpar-todos-historicos', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({
      where: { id },
      include: {
        _count: { select: { contatos: true } }
      }
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Buscar todos os contatos da campanha
    const contatos = await prisma.contato.findMany({
      where: { campanhaId: id },
      select: { id: true }
    });

    const contatoIds = contatos.map(c => c.id);

    // Deletar todas as mensagens de todos os contatos
    const resultado = await prisma.mensagemProspeccao.deleteMany({
      where: { contatoId: { in: contatoIds } }
    });

    // Resetar status de todos os contatos
    await prisma.contato.updateMany({
      where: { campanhaId: id },
      data: {
        statusProspeccao: 'AGUARDANDO',
        tentativasContato: 0,
        ultimaTentativa: null,
        respondeu: false,
      }
    });

    console.log(`[Campanhas] 🧹 Histórico de ${contatoIds.length} contatos limpo (${resultado.count} mensagens removidas)`);

    return res.json({
      sucesso: true,
      mensagem: `Histórico de todos os ${contatoIds.length} contatos limpo`,
      contatosAfetados: contatoIds.length,
      mensagensRemovidas: resultado.count,
      novoStatus: 'AGUARDANDO'
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao limpar históricos:', error);
    return res.status(500).json({ erro: 'Erro ao limpar históricos de conversa' });
  }
});

// ============================================
// CONTROLE DE ATENDIMENTO (IA vs HUMANO)
// ============================================

/**
 * POST /:id/contatos/:contatoId/assumir-humano
 * Corretor assume a conversa - pausa o SDR
 */
router.post('/:id/contatos/:contatoId/assumir-humano', async (req, res) => {
  try {
    const { id, contatoId } = req.params;
    const { atendente, motivo } = req.body;

    const contato = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId: id }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    await prisma.contato.update({
      where: { id: contatoId },
      data: {
        modoAtendimento: 'HUMANO',
        atendidoPor: atendente || 'Corretor',
        pausadoEm: new Date(),
        motivoPausa: motivo || 'Atendimento manual solicitado'
      }
    });

    console.log(`[Campanhas] 👤 Conversa de ${contato.nome} assumida por humano`);

    return res.json({
      sucesso: true,
      mensagem: `Você assumiu a conversa com ${contato.nome}`,
      modoAtendimento: 'HUMANO',
      aviso: 'O SDR está pausado. Mensagens recebidas não serão respondidas automaticamente.'
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao assumir conversa:', error);
    return res.status(500).json({ erro: 'Erro ao assumir conversa' });
  }
});

/**
 * POST /:id/contatos/:contatoId/devolver-ia
 * Devolve a conversa para o SDR
 */
router.post('/:id/contatos/:contatoId/devolver-ia', async (req, res) => {
  try {
    const { id, contatoId } = req.params;
    const { limparHistorico } = req.body; // Opcional: limpar histórico ao devolver

    const contato = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId: id }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    // Limpar histórico se solicitado
    if (limparHistorico) {
      await prisma.mensagemProspeccao.deleteMany({
        where: { contatoId }
      });
    }

    await prisma.contato.update({
      where: { id: contatoId },
      data: {
        modoAtendimento: 'IA',
        atendidoPor: null,
        pausadoEm: null,
        motivoPausa: null
      }
    });

    console.log(`[Campanhas] 🤖 Conversa de ${contato.nome} devolvida para IA`);

    return res.json({
      sucesso: true,
      mensagem: `Conversa com ${contato.nome} devolvida para o SDR`,
      modoAtendimento: 'IA',
      historicoLimpo: !!limparHistorico,
      aviso: 'O SDR voltará a responder automaticamente.'
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao devolver conversa:', error);
    return res.status(500).json({ erro: 'Erro ao devolver conversa para IA' });
  }
});

/**
 * POST /:id/contatos/:contatoId/pausar
 * Pausa a conversa sem assumir (nem IA nem humano responde)
 */
router.post('/:id/contatos/:contatoId/pausar', async (req, res) => {
  try {
    const { id, contatoId } = req.params;
    const { motivo } = req.body;

    const contato = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId: id }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    await prisma.contato.update({
      where: { id: contatoId },
      data: {
        modoAtendimento: 'PAUSADO',
        pausadoEm: new Date(),
        motivoPausa: motivo || 'Conversa pausada'
      }
    });

    console.log(`[Campanhas] ⏸️ Conversa de ${contato.nome} pausada`);

    return res.json({
      sucesso: true,
      mensagem: `Conversa com ${contato.nome} pausada`,
      modoAtendimento: 'PAUSADO'
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao pausar conversa:', error);
    return res.status(500).json({ erro: 'Erro ao pausar conversa' });
  }
});

/**
 * GET /:id/contatos/:contatoId/modo-atendimento
 * Retorna o modo atual de atendimento do contato
 */
router.get('/:id/contatos/:contatoId/modo-atendimento', async (req, res) => {
  try {
    const { id, contatoId } = req.params;

    const contato = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId: id },
      select: {
        id: true,
        nome: true,
        modoAtendimento: true,
        atendidoPor: true,
        pausadoEm: true,
        motivoPausa: true
      }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    return res.json(contato);

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar modo de atendimento:', error);
    return res.status(500).json({ erro: 'Erro ao buscar modo de atendimento' });
  }
});

// ====================================
// EXCLUSÃO DE CONTATOS
// ====================================

// Excluir um contato específico
router.delete('/:id/contatos/:contatoId', async (req, res) => {
  try {
    const { id, contatoId } = req.params;

    // Verificar se o contato existe e pertence à campanha
    const contato = await prisma.contato.findFirst({
      where: {
        id: contatoId,
        campanhaId: id
      },
      include: {
        mensagens: true
      }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado nesta campanha' });
    }

    // Deletar mensagens do contato primeiro
    if (contato.mensagens.length > 0) {
      await prisma.mensagemProspeccao.deleteMany({
        where: { contatoId }
      });
    }

    // Se o contato virou lead, também deletar o lead e suas dependências
    if (contato.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: contato.leadId },
        include: { conversas: true }
      });

      if (lead) {
        // Deletar mensagens das conversas
        for (const conversa of lead.conversas) {
          await prisma.mensagem.deleteMany({ where: { conversaId: conversa.id } });
        }

        // Deletar conversas
        await prisma.conversa.deleteMany({ where: { leadId: lead.id } });

        // Deletar atividades
        await prisma.atividade.deleteMany({ where: { leadId: lead.id } });

        // Desvincular cliente
        await prisma.cliente.updateMany({
          where: { origemLeadId: lead.id },
          data: { origemLeadId: null }
        });

        // Desvincular imóveis associados
        await prisma.imovel.updateMany({
          where: { leadId: lead.id },
          data: { leadId: null }
        });

        // Deletar contratos associados
        await prisma.contrato.deleteMany({ where: { leadId: lead.id } });

        // Desvincular o contato do lead para evitar erro de foreign key
        await prisma.contato.updateMany({
          where: { leadId: lead.id },
          data: { leadId: null }
        });

        // Deletar o lead (Cascades lidarão com Cliente, etc)
        await prisma.lead.delete({ where: { id: lead.id } });
      }
    }

    // Deletar o contato
    await prisma.contato.delete({
      where: { id: contatoId }
    });

    console.log(`[Campanhas] 🗑️ Contato ${contato.nome} excluído da campanha ${id}`);

    return res.json({
      sucesso: true,
      mensagem: `Contato ${contato.nome} excluído com sucesso`
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao excluir contato:', error);
    return res.status(500).json({ erro: 'Erro ao excluir contato' });
  }
});

// Excluir múltiplos contatos
router.delete('/:id/contatos', async (req, res) => {
  try {
    const { id } = req.params;
    const { contatoIds } = req.body;

    if (!contatoIds || !Array.isArray(contatoIds) || contatoIds.length === 0) {
      return res.status(400).json({ erro: 'Lista de IDs de contatos é obrigatória' });
    }

    // Buscar contatos com seus leads
    const contatos = await prisma.contato.findMany({
      where: {
        id: { in: contatoIds },
        campanhaId: id
      },
      select: {
        id: true,
        nome: true,
        leadId: true
      }
    });

    if (contatos.length === 0) {
      return res.status(404).json({ erro: 'Nenhum contato encontrado' });
    }

    const idsEncontrados = contatos.map(c => c.id);
    const leadIds = contatos.filter(c => c.leadId).map(c => c.leadId as string);

    // Deletar mensagens de prospecção
    await prisma.mensagemProspeccao.deleteMany({
      where: { contatoId: { in: idsEncontrados } }
    });

    // Deletar leads e suas dependências
    if (leadIds.length > 0) {
      // Buscar conversas dos leads
      const conversas = await prisma.conversa.findMany({
        where: { leadId: { in: leadIds } },
        select: { id: true }
      });
      const conversaIds = conversas.map(c => c.id);

      // Deletar mensagens das conversas
      if (conversaIds.length > 0) {
        await prisma.mensagem.deleteMany({
          where: { conversaId: { in: conversaIds } }
        });
      }

      // Deletar conversas
      await prisma.conversa.deleteMany({
        where: { leadId: { in: leadIds } }
      });

      // Deletar atividades
      await prisma.atividade.deleteMany({
        where: { leadId: { in: leadIds } }
      });

      // Desvincular cliente
      await prisma.cliente.updateMany({
        where: { origemLeadId: { in: leadIds } },
        data: { origemLeadId: null }
      });

      // Desvincular imóveis associados
      await prisma.imovel.updateMany({
        where: { leadId: { in: leadIds } },
        data: { leadId: null }
      });

      // Deletar contratos associados
      await prisma.contrato.deleteMany({
        where: { leadId: { in: leadIds } }
      });

      // Desvincular o contato do lead para evitar erro de foreign key
      await prisma.contato.updateMany({
        where: { leadId: { in: leadIds } },
        data: { leadId: null }
      });

      // Deletar leads
      await prisma.lead.deleteMany({
        where: { id: { in: leadIds } }
      });
    }

    // Deletar contatos
    const resultado = await prisma.contato.deleteMany({
      where: { id: { in: idsEncontrados } }
    });

    console.log(`[Campanhas] 🗑️ ${resultado.count} contatos excluídos da campanha ${id}`);

    return res.json({
      sucesso: true,
      mensagem: `${resultado.count} contatos excluídos com sucesso`,
      excluidos: resultado.count
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao excluir contatos:', error);
    return res.status(500).json({ erro: 'Erro ao excluir contatos' });
  }
});

// Excluir TODOS os contatos de uma campanha
router.delete('/:id/contatos/todos', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmar } = req.body;

    if (confirmar !== true) {
      return res.status(400).json({
        erro: 'Confirmação obrigatória. Envie { confirmar: true } no body'
      });
    }

    // Buscar todos os contatos da campanha
    const contatos = await prisma.contato.findMany({
      where: { campanhaId: id },
      select: { id: true, leadId: true }
    });

    if (contatos.length === 0) {
      return res.json({
        sucesso: true,
        mensagem: 'Nenhum contato para excluir',
        excluidos: 0
      });
    }

    const contatoIds = contatos.map(c => c.id);
    const leadIds = contatos.filter(c => c.leadId).map(c => c.leadId as string);

    // Deletar mensagens de prospecção
    await prisma.mensagemProspeccao.deleteMany({
      where: { contatoId: { in: contatoIds } }
    });

    // Deletar leads e suas dependências
    if (leadIds.length > 0) {
      const conversas = await prisma.conversa.findMany({
        where: { leadId: { in: leadIds } },
        select: { id: true }
      });
      const conversaIds = conversas.map(c => c.id);

      if (conversaIds.length > 0) {
        await prisma.mensagem.deleteMany({
          where: { conversaId: { in: conversaIds } }
        });
      }

      await prisma.conversa.deleteMany({
        where: { leadId: { in: leadIds } }
      });

      await prisma.atividade.deleteMany({
        where: { leadId: { in: leadIds } }
      });

      await prisma.cliente.updateMany({
        where: { origemLeadId: { in: leadIds } },
        data: { origemLeadId: null }
      });

      await prisma.imovel.updateMany({
        where: { leadId: { in: leadIds } },
        data: { leadId: null }
      });

      await prisma.contrato.deleteMany({
        where: { leadId: { in: leadIds } }
      });

      await prisma.contato.updateMany({
        where: { leadId: { in: leadIds } },
        data: { leadId: null }
      });

      await prisma.lead.deleteMany({
        where: { id: { in: leadIds } }
      });
    }

    // Deletar todos os contatos
    const resultado = await prisma.contato.deleteMany({
      where: { campanhaId: id }
    });

    console.log(`[Campanhas] 🗑️ TODOS os ${resultado.count} contatos excluídos da campanha ${id}`);

    return res.json({
      sucesso: true,
      mensagem: `Todos os ${resultado.count} contatos foram excluídos`,
      excluidos: resultado.count
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao excluir todos contatos:', error);
    return res.status(500).json({ erro: 'Erro ao excluir contatos' });
  }
});

// ============================================
// PROMOÇÃO MANUAL DE CONTATO -> LEAD
// ============================================

/**
 * POST /:campanhaId/contatos/:contatoId/promover
 * Promove manualmente um contato para Lead (sem passar pela IA)
 */
router.post('/:campanhaId/contatos/:contatoId/promover', async (req, res) => {
  try {
    const { campanhaId, contatoId } = req.params;
    const tenantId = getTenantId(req);

    const campanha = await verificarCampanhaTenant(campanhaId, tenantId);
    if (!campanha || campanha === 'forbidden') {
      return res.status(403).json({ erro: 'Acesso negado à campanha' });
    }

    const contato = await prisma.contato.findUnique({
      where: { id: contatoId }
    });

    if (!contato) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    if (contato.virouLead && contato.leadId) {
      return res.status(400).json({
        erro: 'Contato já promovido',
        leadId: contato.leadId
      });
    }

    // Criar o Lead
    const novoLead = await prisma.lead.create({
      data: {
        tenantId: campanha.tenantId,
        nome: contato.nome,
        telefone: contato.telefone,
        email: contato.email,
        cpf: contato.cpf,
        origem: `MINERACAO_MANUAL`,
        campanhaOrigemId: campanhaId,
        // contatoOrigemId: contatoId, // Campo não existe no schema ainda (revisar) ou usar connect se for relation
        contatoOrigem: { connect: { id: contatoId } }, // Usando connect relation
        status: 'NOVO',
        temperatura: 'QUENTE', // Promovido manualmente = Quente

        // Dados do Imóvel
        enderecoImovel: contato.enderecoImovel,
        tipoImovel: contato.tipoImovel,
        areaImovel: contato.areaConstruida ? String(contato.areaConstruida) : null,
        valorPretendido: contato.valorVenal ? String(contato.valorVenal) : null,

        // Dados de Empresa (Atualmente ficam apenas no Contato)
        // cnpjEmpresa: contato.cnpjEmpresa,
        // empresaAtual: contato.empresaAtual,
        // setor: contato.setor,
        // profissao: contato.profissao,
        // participacoesEmpresas: contato.participacoesEmpresas ?? undefined,
      }
    });

    // Atualizar o Contato
    await prisma.contato.update({
      where: { id: contatoId },
      data: {
        virouLead: true,
        virouLeadEm: new Date(),
        leadId: novoLead.id, // O Prisma já deve ter atualizado via connect, mas reforçamos
        statusProspeccao: 'LEAD',
        modoAtendimento: 'HUMANO' // Sai da mão da IA
      }
    });

    // Registrar Atividade Inicial
    const db: any = prisma; // Workaround type
    await db.atividade.create({
      data: {
        leadId: novoLead.id,
        tipo: 'NOTA',
        titulo: '🚀 Promovido Manualmente',
        descricao: 'Contato promovido a Lead manualmente pelo corretor.',
        criadoPor: 'corretor',
        completadoEm: new Date()
      }
    });

    console.log(`[Campanhas] ✅ Contato ${contato.nome} promovido a Lead ${novoLead.id}`);

    return res.json({
      sucesso: true,
      mensagem: 'Contato promovido com sucesso!',
      leadId: novoLead.id
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao promover contato:', error);
    return res.status(500).json({ erro: 'Erro ao promover contato: ' + error.message });
  }
});

export default router;
