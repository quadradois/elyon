import { Router } from 'express';
import { prisma } from '../servidor'; // Prisma com novos campos
import { consultaCEP } from '../servicos/cep';
import { z } from 'zod';
import multer from 'multer';
import Papa from 'papaparse';

const router = Router();

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
// ENDPOINT DE CONSULTA DE CEP
// ============================================

/**
 * GET /api/campanhas/cep/:cep
 * Consulta dados de endereço pelo CEP (ViaCEP)
 */
router.get('/cep/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    
    const dados = await consultaCEP.consultar(cep);
    
    if (!dados) {
      return res.status(404).json({ 
        erro: 'CEP não encontrado',
        cep 
      });
    }
    
    return res.json({
      sucesso: true,
      dados
    });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao consultar CEP:', error);
    return res.status(500).json({ erro: 'Erro ao consultar CEP' });
  }
});

/**
 * GET /api/campanhas/template-csv
 * Retorna um arquivo CSV modelo para importação de contatos
 */
router.get('/template-csv', (req, res) => {
  const csvContent = `nome,telefone,email,cpf,endereco,bairro
João Silva,62999991234,joao@email.com,12345678901,Rua das Flores 123,Centro
Maria Santos,62988887777,maria@email.com,,Av. Goiás 456,Setor Sul
Pedro Oliveira,62977776666,,,Rua 10 Quadra 5,Jardim América`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=modelo-contatos.csv');
  res.send(csvContent);
});

/**
 * POST /api/campanhas/criar-com-pesquisa
 * Cria uma campanha e automaticamente pesquisa dados do empreendimento
 * @deprecated - Usar POST /api/campanhas para criar campanha sem pesquisa IA
 */
const criarCampanhaSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  nomeEmpreendimento: z.string().min(3, 'Nome do empreendimento obrigatório'),
  
  // Endereço separado (novo padrão)
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro obrigatório'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  estado: z.string().length(2, 'Estado deve ter 2 letras (UF)').default('GO'),
  
  // Campo legado (para compatibilidade)
  localizacao: z.string().optional(),
  
  tipoImovel: z.string().optional().default('Apartamento'),
  perfilImovel: z.string().optional(),
});

import { ragEmpreendimentos } from '../servicos/rag-empreendimentos';

// ============================================
// CRIAR CAMPANHA (MODO MANUAL - SEM IA)
// ============================================

/**
 * POST /api/campanhas
 * Cria uma campanha para preenchimento manual do briefing
 */
router.post('/', async (req, res) => {
  try {
    console.log('[Campanhas] Criando campanha (modo manual)...');
    
    const dados = criarCampanhaSchema.parse(req.body);
    
    // Montar localização a partir dos campos separados
    const localizacaoCompleta = dados.localizacao || 
      `${dados.bairro}, ${dados.cidade} - ${dados.estado}`;
    
    // 1. Buscar tenant
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.status(400).json({ 
        erro: 'Nenhum tenant encontrado. Configure um tenant primeiro.' 
      });
    }

    // 2. Criar campanha (sem briefing - será preenchido manualmente)
    const campanha = await prisma.campanha.create({
      data: {
        tenantId: tenant.id,
        nome: dados.nome,
        tipo: 'MINERACAO',
        status: 'ATIVA',
        nomeEmpreendimento: dados.nomeEmpreendimento,
        // Campos separados de endereço
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.estado,
        // Campo legado
        localizacao: localizacaoCompleta,
        tipoImovel: dados.tipoImovel,
        perfilImovel: dados.perfilImovel,
        // Briefing será preenchido manualmente via EditorBriefing
        // Não definimos valores - Prisma usa undefined = campo não alterado
      },
    });

    console.log(`[Campanhas] ✅ Campanha criada (modo manual): ${campanha.id}`);

    return res.status(201).json({
      sucesso: true,
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
        nomeEmpreendimento: campanha.nomeEmpreendimento,
        status: campanha.status,
      },
      mensagem: 'Campanha criada! Preencha o briefing do empreendimento.',
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao criar campanha:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        erro: 'Dados inválidos', 
        detalhes: error.errors 
      });
    }
    
    return res.status(500).json({ erro: 'Erro interno ao criar campanha' });
  }
});

// ============================================
// CRIAR CAMPANHA COM PESQUISA IA (LEGADO/DESATIVADO)
// ============================================

/**
 * POST /api/campanhas/criar-com-pesquisa
 * @deprecated - Mantido para compatibilidade. Use POST /api/campanhas
 */
router.post('/criar-com-pesquisa', async (req, res) => {
  // Redireciona para a rota nova (sem pesquisa IA)
  console.log('[Campanhas] ⚠️ Rota legada /criar-com-pesquisa chamada - redirecionando...');
  
  try {
    const dados = criarCampanhaSchema.parse(req.body);
    
    const localizacaoCompleta = dados.localizacao || 
      `${dados.bairro}, ${dados.cidade} - ${dados.estado}`;
    
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return res.status(400).json({ 
        erro: 'Nenhum tenant encontrado.' 
      });
    }

    const campanha = await prisma.campanha.create({
      data: {
        tenantId: tenant.id,
        nome: dados.nome,
        tipo: 'MINERACAO',
        status: 'ATIVA',
        nomeEmpreendimento: dados.nomeEmpreendimento,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.estado,
        localizacao: localizacaoCompleta,
        tipoImovel: dados.tipoImovel,
        perfilImovel: dados.perfilImovel,
      },
    });

    return res.status(201).json({
      sucesso: true,
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
      },
      mensagem: 'Campanha criada. Pesquisa IA desativada - preencha o briefing manualmente.',
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro:', error);
    return res.status(500).json({ erro: 'Erro ao criar campanha' });
  }
});

/**
 * GET /api/campanhas/:id
 * Busca detalhes de uma campanha
 */
router.get('/:id', async (req, res) => {
  try {
    const campanha = await prisma.campanha.findUnique({
      where: { id: req.params.id },
      include: {
        contatos: {
          take: 10,
          orderBy: { criadoEm: 'desc' },
        },
        _count: {
          select: {
            contatos: true,
            leads: true,
          },
        },
      },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    const campanhaFormatada = {
      id: campanha.id,
      nome: campanha.nome,
      tenantId: campanha.tenantId,
      tipo: campanha.tipo,
      parametrosBusca: campanha.parametrosBusca,
      nomeEmpreendimento: campanha.nomeEmpreendimento,
      tipoImovel: campanha.tipoImovel,
      localizacao: campanha.localizacao,
      perfilImovel: campanha.perfilImovel,
      briefingCompleto: campanha.briefingCompleto,
      briefingEstruturado: campanha.briefingEstruturado,
      briefingGeradoEm: campanha.briefingGeradoEm,
      briefingConfiabilidade: campanha.briefingConfiabilidade
        ? parseFloat(campanha.briefingConfiabilidade.toString())
        : null,
      briefingValidado: campanha.briefingValidado,
      validadoPor: campanha.validadoPor,
      validadoEm: campanha.validadoEm,
      editadoPor: campanha.editadoPor,
      editadoEm: campanha.editadoEm,
      totalContatos: campanha._count.contatos,
      totalLeads: campanha._count.leads,
      status: campanha.status,
      criadoEm: campanha.criadoEm,
      atualizadoEm: campanha.atualizadoEm,
    };

    return res.json({ campanha: campanhaFormatada });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao buscar campanha:', error);
    return res.status(500).json({ erro: 'Erro ao buscar campanha' });
  }
});

/**
 * GET /api/campanhas
 * Lista todas as campanhas
 */
router.get('/', async (req, res) => {
  try {
    const campanhas = await prisma.campanha.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: {
          select: {
            contatos: true,
            leads: true,
          },
        },
      },
    });

    return res.json({
      total: campanhas.length,
      campanhas: campanhas.map(c => ({
        id: c.id,
        nome: c.nome,
        empreendimento: c.nomeEmpreendimento,
        status: c.status,
        totalContatos: c._count.contatos,
        totalLeads: c._count.leads,
        temBriefing: !!c.briefingCompleto,
        confiabilidade: c.briefingConfiabilidade 
          ? parseFloat(c.briefingConfiabilidade.toString())
          : null,
        criadoEm: c.criadoEm,
      })),
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao listar campanhas:', error);
    return res.status(500).json({ erro: 'Erro ao listar campanhas' });
  }
});

/**
 * PUT /api/campanhas/:id/briefing
 * Atualizar e validar briefing da campanha
 */
router.put('/:id/briefing', async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = (req as any).usuario?.id || 'sistema';

    const schema = z.object({
      briefingCompleto: z.string().optional(),
      briefingEstruturado: z.any().optional(),
      validar: z.boolean().optional(),
    });

    const dados = schema.parse(req.body);

    const campanha = await prisma.campanha.findUnique({
      where: { id },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Extrair confiabilidade do briefingEstruturado se existir
    const novaConfiabilidade = dados.briefingEstruturado?.confiabilidade;

    // Atualizar campanha
    const campanhaAtualizada = await prisma.campanha.update({
      where: { id },
      data: {
        ...(dados.briefingCompleto && { briefingCompleto: dados.briefingCompleto }),
        ...(dados.briefingEstruturado && {
          briefingEstruturado: dados.briefingEstruturado as any,
        }),
        // Atualizar confiabilidade se foi fornecida
        ...(novaConfiabilidade !== undefined && {
          briefingConfiabilidade: String(novaConfiabilidade),
        }),
        editadoPor: usuarioId,
        editadoEm: new Date(),
        ...(dados.validar && {
          briefingValidado: true,
          validadoPor: usuarioId,
          validadoEm: new Date(),
        }),
      },
    });

    // ATUALIZAR RAG SE HOUVER VÍNCULO
    if (campanha.empreendimentoId) {
      console.log(`[RAG] Atualizando conhecimento vinculado: ${campanha.empreendimentoId}`);
      try {
        await ragEmpreendimentos.atualizar(campanha.empreendimentoId, {
          briefingCompleto: dados.briefingCompleto,
          briefingEstruturado: dados.briefingEstruturado,
          validado: dados.validar,
          validadoPor: dados.validar ? usuarioId : undefined
        });
        console.log('✅ [RAG] Conhecimento atualizado com sucesso!');
      } catch (ragError) {
        console.error('⚠️ [RAG] Falha ao atualizar conhecimento:', ragError);
      }
    }

    return res.json({
      sucesso: true,
      campanha: campanhaAtualizada,
    });
  } catch (error) {
    console.error('Erro ao atualizar briefing:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar briefing' });
  }
});

/**
 * PATCH /api/campanhas/:id/status
 * Atualizar status da campanha (pausar, ativar, finalizar)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    
    const schema = z.object({
      status: z.enum(['ATIVA', 'PAUSADA', 'FINALIZADA']),
    });

    const { status } = schema.parse(req.body);

    const campanha = await prisma.campanha.findUnique({
      where: { id },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    const campanhaAtualizada = await prisma.campanha.update({
      where: { id },
      data: { status },
    });

    return res.json({
      sucesso: true,
      campanha: {
        id: campanhaAtualizada.id,
        nome: campanhaAtualizada.nome,
        status: campanhaAtualizada.status,
      },
    });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar status da campanha' });
  }
});

/**
 * POST /api/campanhas/:id/importar-contatos
 * Importar lista de contatos para a campanha
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

    const campanha = await prisma.campanha.findUnique({
      where: { id },
    });

    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Criar contatos em transação
    // Nota: Idealmente usaríamos createMany, mas para garantir relações futuras e validações, faremos map
    // Como é MVP e volume baixo (<1000), ok. Para volume alto, usar createMany.
    
    let importados = 0;
    let erros = 0;

    for (const contato of contatos) {
      try {
        await prisma.contato.create({
          data: {
            campanhaId: id,
            // tenantId removido pois Contato não tem esse campo direto (acessa via campanha)
            nome: contato.nome,
            telefone: contato.telefone,
            email: contato.email || null,
            // Campos removidos pois não existem no schema atual
            statusProspeccao: 'AGUARDANDO',
          }
        });
        importados++;
      } catch (e) {
        console.error(`Erro ao importar contato ${contato.nome}:`, e);
        erros++;
      }
    }

    // Atualizar contador da campanha
    await prisma.campanha.update({
      where: { id },
      data: {
        totalContatos: { increment: importados }
      }
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
 * POST /api/campanhas/:id/vincular-leads-minerados
 * Vincula leads enriquecidos (da mineração) à campanha com TODOS os dados da Assertiva
 */
const vincularLeadsMineradosSchema = z.object({
  leads: z.array(z.object({
    // Dados básicos
    nome: z.string(),
    cpf: z.string().optional(),
    
    // Telefones (da Assertiva)
    telefones: z.array(z.object({
      numero: z.string(),
      tipo: z.enum(['CELULAR', 'FIXO']),
      whatsapp: z.boolean().optional()
    })).optional(),
    
    // Emails
    emails: z.array(z.string()).optional(),
    
    // Dados do Imóvel (da Mineração/IPTU)
    inscricaoIptu: z.string().optional(),
    enderecoImovel: z.string().optional(),
    bairroImovel: z.string().optional(),
    areaTerreno: z.number().optional(),
    areaConstruida: z.number().optional(),
    tipoImovel: z.string().optional(),
    valorVenal: z.number().optional(),
    anoConstituicao: z.number().optional(),
    
    // Score
    score: z.number().optional(),
    
    // NOVOS: Dados Cadastrais (da Assertiva)
    dataNascimento: z.string().optional(),
    idade: z.number().optional(),
    sexo: z.string().optional(),
    signo: z.string().optional(),
    situacaoCadastral: z.string().optional(),
    obitoProvavel: z.boolean().optional(),
    nomeMae: z.string().optional(),
    ppe: z.boolean().optional(),
    
    // NOVOS: Dados Profissionais (da Assertiva)
    rendaEstimada: z.number().optional(),
    faixaSalarial: z.string().optional(),
    profissao: z.string().optional(),
    setor: z.string().optional(),
    empresaAtual: z.string().optional(),
    cnpjEmpresa: z.string().optional(),
    
    // NOVOS: Endereço pessoal (da Assertiva)
    endereco: z.object({
      logradouro: z.string().optional(),
      numero: z.string().optional(),
      complemento: z.string().optional(),
      bairro: z.string().optional(),
      cidade: z.string().optional(),
      uf: z.string().optional(),
      cep: z.string().optional(),
    }).optional(),
    
    // NOVOS: Participações e Redes Sociais
    participacoesEmpresas: z.array(z.object({
      cnpj: z.string(),
      razaoSocial: z.string(),
      participacao: z.string()
    })).optional(),
    redesSociais: z.array(z.object({
      rede: z.string(),
      url: z.string()
    })).optional(),
    
    // Fonte
    fonteEnriquecimento: z.string().optional(),
  }))
});

router.post('/:id/vincular-leads-minerados', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({
      where: { id }
    });
    
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }
    
    const { leads } = vincularLeadsMineradosSchema.parse(req.body);
    
    console.log(`[Campanhas] Vinculando ${leads.length} leads minerados à campanha ${id}...`);
    
    let vinculados = 0;
    let erros = 0;
    
    for (const lead of leads) {
      try {
        // Extrair telefones - ordenar por prioridade (WhatsApp celular primeiro)
        const telefones = lead.telefones || [];
        const telefonesOrdenados = [...telefones].sort((a, b) => {
          // WhatsApp primeiro
          if (a.whatsapp && !b.whatsapp) return -1;
          if (!a.whatsapp && b.whatsapp) return 1;
          // Celular antes de fixo
          if (a.tipo === 'CELULAR' && b.tipo !== 'CELULAR') return -1;
          if (a.tipo !== 'CELULAR' && b.tipo === 'CELULAR') return 1;
          return 0;
        });
        
        // Extrair emails
        const emails = lead.emails || [];
        
        // Contar quantos têm WhatsApp
        const quantidadeWhatsapp = telefones.filter(t => t.whatsapp === true).length;
        
        // Montar endereço completo (se disponível)
        let enderecoCompleto: string | undefined;
        if (lead.endereco) {
          const e = lead.endereco;
          enderecoCompleto = [
            e.logradouro,
            e.numero ? `nº ${e.numero}` : null,
            e.complemento,
            e.bairro,
            e.cidade,
            e.uf,
            e.cep ? `CEP: ${e.cep}` : null
          ].filter(Boolean).join(', ');
        }
        
        // Criar dados do contato - TODOS os telefones e emails
        const dadosContato: any = {
          campanhaId: id,
          nome: lead.nome,
          cpf: lead.cpf?.replace(/\D/g, ''),
          
          // Telefones (até 5)
          telefone: telefonesOrdenados[0]?.numero || null,
          telefone2: telefonesOrdenados[1]?.numero || null,
          telefone3: telefonesOrdenados[2]?.numero || null,
          telefone4: telefonesOrdenados[3]?.numero || null,
          telefone5: telefonesOrdenados[4]?.numero || null,
          telefonesJson: telefones.length > 0 ? telefones : undefined,
          temWhatsapp: quantidadeWhatsapp > 0,
          quantidadeWhatsapp,
          
          // Emails (até 5)
          email: emails[0] || null,
          email2: emails[1] || null,
          email3: emails[2] || null,
          email4: emails[3] || null,
          email5: emails[4] || null,
          emailsJson: emails.length > 0 ? emails : undefined,
          
          // Dados do Imóvel
          inscricaoIptu: lead.inscricaoIptu,
          enderecoImovel: lead.enderecoImovel,
          bairroImovel: lead.bairroImovel,
          areaTerreno: lead.areaTerreno,
          areaConstruida: lead.areaConstruida,
          tipoImovel: lead.tipoImovel,
          valorVenal: lead.valorVenal,
          anoConstituicao: lead.anoConstituicao,
          
          // NOVOS: Dados Cadastrais
          dataNascimento: lead.dataNascimento ? new Date(lead.dataNascimento.split('/').reverse().join('-')) : null,
          idade: lead.idade,
          sexo: lead.sexo,
          signo: lead.signo,
          situacaoCadastral: lead.situacaoCadastral,
          obitoProvavel: lead.obitoProvavel || false,
          nomeMae: lead.nomeMae,
          ppe: lead.ppe || false,
          
          // NOVOS: Dados Profissionais
          rendaEstimada: lead.rendaEstimada,
          faixaSalarial: lead.faixaSalarial,
          profissao: lead.profissao,
          setor: lead.setor,
          empresaAtual: lead.empresaAtual,
          cnpjEmpresa: lead.cnpjEmpresa,
          
          // NOVOS: Endereço pessoal
          endereco: enderecoCompleto,
          cidade: lead.endereco?.cidade,
          estado: lead.endereco?.uf,
          cep: lead.endereco?.cep,
          
          // NOVOS: Participações e Redes Sociais (JSON)
          participacoesEmpresas: lead.participacoesEmpresas,
          redesSociais: lead.redesSociais,
          
          // Score e Metadados
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
    
    // Atualizar contador da campanha
    await prisma.campanha.update({
      where: { id },
      data: {
        totalContatos: { increment: vinculados }
      }
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
 * GET /api/campanhas/:id/contatos
 * Lista todos os contatos da campanha com paginação
 */
router.get('/:id/contatos', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    
    const where: any = { campanhaId: id };
    if (status) {
      where.statusProspeccao = status;
    }
    
    // Buscar contatos (todos os campos serão retornados)
    const [contatosBrutos, total] = await Promise.all([
      prisma.contato.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contato.count({ where })
    ]);
    
    // Mapear para incluir campos relevantes
    const contatos = contatosBrutos.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      // Telefones (até 5)
      telefone: c.telefone,
      telefone2: c.telefone2,
      telefone3: c.telefone3,
      telefone4: c.telefone4,
      telefone5: c.telefone5,
      telefonesJson: c.telefonesJson,
      temWhatsapp: c.temWhatsapp,
      quantidadeWhatsapp: c.quantidadeWhatsapp,
      // Emails (até 5)
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
      // Novos campos de unidade/box
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
    
    // Estatísticas por status
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
      paginacao: {
        pagina: page,
        limite: limit,
        total,
        totalPaginas: Math.ceil(total / limit)
      },
      estatisticas: stats
    });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao listar contatos:', error);
    return res.status(500).json({ erro: 'Erro ao listar contatos' });
  }
});

/**
 * PATCH /api/campanhas/:campanhaId/contatos/:contatoId
 * Atualiza um contato específico
 */
router.patch('/:campanhaId/contatos/:contatoId', async (req, res) => {
  try {
    const { campanhaId, contatoId } = req.params;
    
    // Verificar se contato existe e pertence à campanha
    const contatoExistente = await prisma.contato.findFirst({
      where: { id: contatoId, campanhaId }
    });
    
    if (!contatoExistente) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }
    
    // Campos permitidos para atualização
    const { 
      nome, telefone, telefone2, email, endereco,
      statusProspeccao, observacoes, manifestouInteresse 
    } = req.body;
    
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
 * POST /api/campanhas/:campanhaId/contatos/:contatoId/registrar-tentativa
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

/**
 * DELETE /api/campanhas/:id
 * Exclui uma campanha e todos os seus contatos
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({
      where: { id },
      include: { _count: { select: { contatos: true } } }
    });
    
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }
    
    console.log(`[Campanhas] Excluindo campanha "${campanha.nome}" com ${campanha._count.contatos} contatos...`);
    
    // Contatos são excluídos automaticamente pelo onDelete: Cascade no schema
    await prisma.campanha.delete({
      where: { id }
    });
    
    console.log(`[Campanhas] ✅ Campanha "${campanha.nome}" excluída com sucesso`);
    
    return res.json({ 
      sucesso: true, 
      mensagem: `Campanha "${campanha.nome}" excluída com sucesso`,
      contatosExcluidos: campanha._count.contatos
    });
    
  } catch (error: any) {
    console.error('[Campanhas] Erro ao excluir campanha:', error);
    return res.status(500).json({ erro: 'Erro ao excluir campanha' });
  }
});

/**
 * POST /api/campanhas/:id/vincular-leads-banco
 * Vincula todos os leads do banco de dados à campanha
 * Útil quando a campanha foi criada mas os leads não foram vinculados
 */
router.post('/:id/vincular-leads-banco', async (req, res) => {
  try {
    const { id } = req.params;
    const { edificio } = req.body; // Opcional: filtrar por edifício
    
    // Buscar tenant (simplificado - usar o primeiro disponível)
    const tenant = await prisma.tenant.findFirst();
    
    if (!tenant) {
      return res.status(400).json({ erro: 'Nenhum tenant configurado' });
    }
    
    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({
      where: { id },
      include: { _count: { select: { contatos: true } } }
    });
    
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }
    
    console.log(`[Campanhas] Vinculando leads do banco à campanha "${campanha.nome}"...`);
    
    // Buscar leads do tenant que ainda não estão na campanha
    const whereLeads: any = { tenantId: tenant.id };
    
    // Se especificou edifício, filtrar por ele usando os imóveis
    let leadIdsDoEdificio: string[] = [];
    if (edificio) {
      const imoveisDoEdificio = await prisma.imovel.findMany({
        where: { 
          nomeEdificio: { contains: edificio, mode: 'insensitive' }
        },
        select: { leadId: true }
      });
      leadIdsDoEdificio = imoveisDoEdificio
        .map(i => i.leadId)
        .filter((id): id is string => id !== null);
      
      if (leadIdsDoEdificio.length > 0) {
        whereLeads.id = { in: leadIdsDoEdificio };
      }
    }
    
    // Buscar CPFs que já estão na campanha
    const cpfsExistentes = await prisma.contato.findMany({
      where: { campanhaId: id },
      select: { cpf: true }
    });
    const cpfsNaCampanha = new Set(cpfsExistentes.map(c => c.cpf?.replace(/\D/g, '')));
    
    // Buscar leads
    const leads = await prisma.lead.findMany({
      where: whereLeads,
      select: { id: true, nome: true, cpf: true, telefone: true, email: true }
    });
    
    // Filtrar leads que não estão na campanha (por CPF)
    const leadsNovos = leads.filter(lead => {
      const cpfLimpo = lead.cpf?.replace(/\D/g, '');
      return cpfLimpo && !cpfsNaCampanha.has(cpfLimpo);
    });
    
    console.log(`[Campanhas] ${leadsNovos.length} leads novos para vincular`);
    
    let vinculados = 0;
    
    for (const lead of leadsNovos) {
      // Buscar dados enriquecidos do cache
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
      
      // Buscar dados do imóvel
      let inscricaoIptu: string | null = null;
      let enderecoImovel: string | null = null;
      let bairroImovel: string | null = null;
      let unidade: string | null = null;
      let box: string | null = null;
      
      if (lead.cpf) {
        const cpfLimpo = lead.cpf.replace(/\D/g, '');
        
        // Buscar cache
        const cache = await prisma.cacheCpf.findFirst({
          where: { cpf: cpfLimpo }
        });
        
        if (cache && cache.dados) {
          const dados = cache.dados as any;
          const telefones = dados.telefones || [];
          const emails = dados.emails || [];
          
          // Ordenar: WhatsApp primeiro
          const telefonesOrdenados = [...telefones].sort((a: any, b: any) => {
            if (a.whatsapp && !b.whatsapp) return -1;
            if (!a.whatsapp && b.whatsapp) return 1;
            if (a.tipo === 'CELULAR' && b.tipo !== 'CELULAR') return -1;
            if (a.tipo !== 'CELULAR' && b.tipo === 'CELULAR') return 1;
            return 0;
          });
          
          telefone = telefonesOrdenados[0]?.numero || lead.telefone;
          telefone2 = telefonesOrdenados[1]?.numero || null;
          telefone3 = telefonesOrdenados[2]?.numero || null;
          telefone4 = telefonesOrdenados[3]?.numero || null;
          telefone5 = telefonesOrdenados[4]?.numero || null;
          quantidadeWhatsapp = telefones.filter((t: any) => t.whatsapp === true).length;
          temWhatsapp = quantidadeWhatsapp > 0;
          telefonesJson = telefones.length > 0 ? telefones : null;
          
          email = emails[0] || lead.email;
          email2 = emails[1] || null;
          email3 = emails[2] || null;
          email4 = emails[3] || null;
          email5 = emails[4] || null;
          emailsJson = emails.length > 0 ? emails : null;
          
          // Dados do imóvel do cache
          inscricaoIptu = dados.nrinscr || null;
          enderecoImovel = dados.endereco_imovel || dados.nmlogradou || null;
          bairroImovel = dados.nmbairro || null;
          unidade = dados.unidade || null;
          box = dados.box || null;
        }
        
        // Buscar imóvel do lead
        const imovel = await prisma.imovel.findFirst({
          where: { leadId: lead.id }
        });
        
        if (imovel) {
          inscricaoIptu = inscricaoIptu || imovel.inscricaoIptu;
          enderecoImovel = enderecoImovel || imovel.logradouro;
          bairroImovel = bairroImovel || imovel.bairro;
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
          unidade,
          box,
          statusProspeccao: 'AGUARDANDO',
          leadId: lead.id,
        }
      });
      vinculados++;
    }
    
    // Atualizar contador
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

/**
 * POST /api/campanhas/:id/importar-csv
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

    // Verificar se campanha existe
    const campanha = await prisma.campanha.findUnique({ where: { id } });
    if (!campanha) {
      return res.status(404).json({ erro: 'Campanha não encontrada' });
    }

    // Converter buffer para string
    const csvContent = file.buffer.toString('utf-8');

    // Parse do CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Normalizar headers para minúsculo e sem acentos
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
      return res.status(400).json({ 
        erro: 'Erro ao processar CSV', 
        detalhes: parsed.errors.slice(0, 5) 
      });
    }

    const rows = parsed.data as Record<string, string>[];
    console.log(`[Campanhas] ${rows.length} linhas encontradas no CSV`);
    console.log(`[Campanhas] Colunas detectadas:`, Object.keys(rows[0] || {}));

    // Mapear colunas (flexível para diferentes nomes)
    const mapearColuna = (row: Record<string, string>, opcoes: string[]): string | null => {
      for (const opcao of opcoes) {
        if (row[opcao] && row[opcao].trim()) {
          return row[opcao].trim();
        }
      }
      return null;
    };

    // Buscar CPFs já existentes na campanha
    const contatosExistentes = await prisma.contato.findMany({
      where: { campanhaId: id },
      select: { cpf: true, telefone: true }
    });
    const cpfsExistentes = new Set(contatosExistentes.map(c => c.cpf?.replace(/\D/g, '')).filter(Boolean));
    const telefonesExistentes = new Set(contatosExistentes.map(c => c.telefone?.replace(/\D/g, '')).filter(Boolean));

    // Processar linhas
    const contatosParaCriar: any[] = [];
    const erros: { linha: number; motivo: string }[] = [];
    let duplicados = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linhaNum = i + 2; // +2 porque i começa em 0 e tem header

      // Extrair dados com mapeamento flexível
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

      // Validações
      if (!nome) {
        erros.push({ linha: linhaNum, motivo: 'Nome obrigatório' });
        continue;
      }

      if (!telefone && !email) {
        erros.push({ linha: linhaNum, motivo: 'Telefone ou email obrigatório' });
        continue;
      }

      // Verificar duplicados por CPF
      const cpfLimpo = cpf?.replace(/\D/g, '');
      if (cpfLimpo && cpfsExistentes.has(cpfLimpo)) {
        duplicados++;
        continue;
      }

      // Verificar duplicados por telefone
      const telLimpo = telefone?.replace(/\D/g, '');
      if (telLimpo && telefonesExistentes.has(telLimpo)) {
        duplicados++;
        continue;
      }

      // Adicionar à lista
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

      // Adicionar aos sets para evitar duplicados no mesmo arquivo
      if (cpfLimpo) cpfsExistentes.add(cpfLimpo);
      if (telLimpo) telefonesExistentes.add(telLimpo);
    }

    // Inserir em lote
    let inseridos = 0;
    if (contatosParaCriar.length > 0) {
      const result = await prisma.contato.createMany({
        data: contatosParaCriar,
        skipDuplicates: true,
      });
      inseridos = result.count;

      // Atualizar contador da campanha
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
      erros: erros.slice(0, 10), // Retornar só os 10 primeiros erros
      totalErros: erros.length,
      mensagem: `${inseridos} contatos importados com sucesso`
    });

  } catch (error: any) {
    console.error('[Campanhas] Erro ao importar CSV:', error);
    return res.status(500).json({ erro: 'Erro ao processar arquivo CSV' });
  }
});

/**
 * GET /api/campanhas/template-csv
 * Gera um template CSV para download
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
// ENDPOINTS DE GERENCIAMENTO DE CACHE RAG
// ============================================

/**
 * GET /api/campanhas/cache-empreendimentos
 * Lista todos os conhecimentos em cache
 */
router.get('/cache-empreendimentos', async (req, res) => {
  try {
    const conhecimentos = await ragEmpreendimentos.listarTodos();
    return res.json({
      sucesso: true,
      total: conhecimentos.length,
      conhecimentos
    });
  } catch (error: any) {
    console.error('[Campanhas] Erro ao listar cache:', error);
    return res.status(500).json({ erro: 'Erro ao listar cache de empreendimentos' });
  }
});

/**
 * DELETE /api/campanhas/cache-empreendimentos/:id
 * Deleta um conhecimento específico do cache
 */
router.delete('/cache-empreendimentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ragEmpreendimentos.deletar(id);
    return res.json({
      sucesso: true,
      mensagem: 'Conhecimento removido do cache'
    });
  } catch (error: any) {
    console.error('[Campanhas] Erro ao deletar cache:', error);
    return res.status(500).json({ erro: 'Erro ao deletar conhecimento do cache' });
  }
});

/**
 * POST /api/campanhas/limpar-cache-empreendimento
 * Limpa o cache de um empreendimento pelo nome e localização
 */
router.post('/limpar-cache-empreendimento', async (req, res) => {
  try {
    const { nome, localizacao } = req.body;
    
    if (!nome || !localizacao) {
      return res.status(400).json({ erro: 'Nome e localização são obrigatórios' });
    }
    
    const deletado = await ragEmpreendimentos.deletarPorNome(nome, localizacao);
    
    if (deletado) {
      return res.json({
        sucesso: true,
        mensagem: `Cache do empreendimento "${nome}" limpo com sucesso`
      });
    } else {
      return res.json({
        sucesso: false,
        mensagem: `Nenhum cache encontrado para "${nome}" em "${localizacao}"`
      });
    }
  } catch (error: any) {
    console.error('[Campanhas] Erro ao limpar cache:', error);
    return res.status(500).json({ erro: 'Erro ao limpar cache do empreendimento' });
  }
});

export default router;
