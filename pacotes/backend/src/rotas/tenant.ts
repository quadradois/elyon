import { responderErro } from '../utilitarios/resposta';
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client as s3 } from '../lib/s3';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { verificarSuperAdmin, verificarAutenticacao } from '../middleware/middleware-auth';
import { sintetizarFalaTenant } from '../servicos/servico-voz';

const router = Router();

// Configuração Multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const tiposPermitidos = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (tiposPermitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PNG, JPG, GIF ou WEBP.'));
    }
  }
});

// Bucket para logos - usa variável específica ou fallback para o bucket geral
const S3_BUCKET_LOGOS = process.env.AWS_S3_BUCKET_LOGOS || process.env.AWS_S3_BUCKET_NAME || 'rag-eloyn';

// Helper para extrair tenantId do request
const extrairTenantId = (req: Request): string | null => {
  return req.tenantId || req.usuario?.tenantId || null;
};

// ====================================
// HELPER: Sintetizar RAG do Perfil
// Usa a versão COMPLETA do sintetizarPerfil.ts
// ====================================
import { sintetizarPerfilRAG as sintetizarPerfilCompleto } from '../utilitarios/sintetizarPerfil';

type ModalidadeVenda = 'NAO_EXCLUSIVA' | 'EXCLUSIVA';

function normalizarPerfilVenda(perfilVenda: any): any {
  const base = perfilVenda || {};

  const modalidades: ModalidadeVenda[] = Array.isArray(base.modalidadesVenda)
    ? Array.from(new Set(base.modalidadesVenda)).filter((m: unknown): m is ModalidadeVenda => m === 'NAO_EXCLUSIVA' || m === 'EXCLUSIVA')
    : [];

  const modalidadesResolvidas = modalidades.length > 0
    ? modalidades
    : (base.aceitaExclusividade ? ['NAO_EXCLUSIVA', 'EXCLUSIVA'] : ['NAO_EXCLUSIVA']);

  const modalidadePreferencial: ModalidadeVenda =
    base.modalidadePreferencial && modalidadesResolvidas.includes(base.modalidadePreferencial)
      ? base.modalidadePreferencial
      : (modalidadesResolvidas.includes('EXCLUSIVA') ? 'EXCLUSIVA' : 'NAO_EXCLUSIVA');

  const especialistaHandoff = base.especialistaHandoff || {};
  const especialistaHandoffNormalizado = {
    ativo: !!especialistaHandoff.ativo,
    nome: typeof especialistaHandoff.nome === 'string' ? especialistaHandoff.nome.trim() : '',
    telefone: typeof especialistaHandoff.telefone === 'string' ? especialistaHandoff.telefone.trim() : '',
    cargo: typeof especialistaHandoff.cargo === 'string' && especialistaHandoff.cargo.trim().length > 0
      ? especialistaHandoff.cargo.trim()
      : 'Especialista',
    email: typeof especialistaHandoff.email === 'string' ? especialistaHandoff.email.trim() : '',
  };

  return {
    ...base,
    modalidadesVenda: modalidadesResolvidas,
    modalidadePreferencial,
    estrategiaOferta: base.estrategiaOferta === 'DIRETA' ? 'DIRETA' : 'CONTEXTUAL',
    politicaModalidades: base.politicaModalidades || {},
    termosProibidosAgente: Array.isArray(base.termosProibidosAgente) ? base.termosProibidosAgente : [],
    respostaEmAudioAtiva: !!base.respostaEmAudioAtiva,
    provedorVozTenant: base.provedorVozTenant === 'elevenlabs' ? 'elevenlabs' : 'openai',
    vozPadraoTenant: typeof base.vozPadraoTenant === 'string' && base.vozPadraoTenant.trim().length > 0
      ? base.vozPadraoTenant.trim()
      : 'onyx',
    elevenLabsVoiceId: typeof base.elevenLabsVoiceId === 'string' ? base.elevenLabsVoiceId.trim() : '',
    elevenLabsModelId: typeof base.elevenLabsModelId === 'string' && base.elevenLabsModelId.trim().length > 0
      ? base.elevenLabsModelId.trim()
      : 'eleven_multilingual_v2',
    perfilVozTenant: base.perfilVozTenant || 'vendas_alta_energia',
    especialistaHandoff: especialistaHandoffNormalizado,
    // Compatibilidade legado
    aceitaExclusividade: modalidadesResolvidas.includes('EXCLUSIVA'),
    tempoExclusividade: base.tempoExclusividade || base.politicaModalidades?.EXCLUSIVA?.prazoDias || 180,
  };
}

function sintetizarPerfilRAG(tenant: any): string {
  // Adaptar formato flat do tenant para o formato PerfilImobiliaria
  const perfilEstruturado = {
    dadosGerais: {
      nomeImobiliaria: tenant.nome || '',
      diferenciais: (tenant.diferenciais as string[]) || [],
      tempoMercado: tenant.tempoMercado,
      atendeFinalDeSemana: tenant.atendeFinalDeSemana || false,
      horarioAtendimento: tenant.horarioAtendimento,
      trabalhaComLocacao: !!(tenant.perfilLocacao),
      trabalhaComVenda: !!(tenant.perfilVenda),
      endereco: tenant.endereco,
      cidade: tenant.cidade,
      telefone: tenant.telefone,
      whatsapp: tenant.whatsapp,
      email: tenant.email,
      site: tenant.site,
      instagram: tenant.instagram,
      facebook: tenant.facebook,
    },
    locacao: tenant.perfilLocacao || {
      garantiasAceitas: [],
      taxaAdministracao: 10,
      taxaPrimeiroAluguel: false,
      prazoMinimoContrato: 30,
      aceitaPet: false,
      fazVistoriaEntrada: true,
      fazVistoriaSaida: true,
      tempoMedioContrato: 30,
    },
    venda: normalizarPerfilVenda(tenant.perfilVenda || {
      aceitaExclusividade: true,
      tempoExclusividade: 180,
      modalidadesVenda: ['NAO_EXCLUSIVA', 'EXCLUSIVA'],
      modalidadePreferencial: 'EXCLUSIVA',
      estrategiaOferta: 'CONTEXTUAL',
      politicaModalidades: {},
      termosProibidosAgente: ['contrato simples'],
      fazAvaliacaoGratuita: true,
      fazFotoProfissional: true,
      fazTourVirtual: false,
      anunciaPortais: [],
      temParcerias: true,
      percentualParceria: 50,
    }),
  };

  return sintetizarPerfilCompleto(perfilEstruturado);
}

// ====================================
// GET /api/tenant/meu - Buscar dados do tenant do usuário logado
// ====================================
router.get('/meu', verificarAutenticacao, async (req: Request, res: Response) => {
  try {
    const tenantId = req.usuario?.tenantId || req.tenantId;

    if (!tenantId) {
      return responderErro(res, 400, 'Usuário não vinculado a um tenant');
    }

    // Buscar tenant com dados completos (incluindo billing/plano)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        // Incluir contaCreditos se fosse uma relação separada, mas aqui está no próprio tenant
        // Se houver tabelas relacionadas importantes, inclua aqui
      }
    });

    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    // Estruturar resposta para compatibilidade com frontend
    // O frontend espera: response.data.tenant.contaCreditos?.planoTipo OU response.data.tenant.plano

    const resposta = {
      tenant: {
        ...tenant,
        // Mock de contaCreditos para compatibilidade se necessário, mas já incluimos planoTipo no objeto raiz
        contaCreditos: {
          planoTipo: tenant.planoTipo,
          creditosMensais: tenant.creditosMensais,
          creditosPrepagos: tenant.creditosPrepagos,
          creditosBonus: tenant.creditosBonus
        }
      }
    };

    res.json(resposta);
  } catch (error) {
    console.error('[Tenant] Erro ao buscar dados do tenant logado:', error);
    responderErro(res, 500, 'Erro ao buscar dados do tenant');
  }
});

router.get('/todos', verificarSuperAdmin, async (req: Request, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        nome: true,
        slug: true,
        status: true,
        plano: true,
        // Campos de Billing
        creditosMensais: true,
        creditosPrepagos: true,
        creditosBonus: true,
        planoTipo: true,
        valorPlano: true,
        dataRenovacao: true,
        statusPagamento: true,
        asaasClienteId: true,
        // Outros campos úteis
        cidade: true,
        email: true,
        criadoEm: true,
      }
    });

    res.json(tenants);
  } catch (error) {
    console.error('[Tenant] Erro ao listar todos:', error);
    responderErro(res, 500, 'Erro ao listar tenants');
  }
});

// ====================================
// GET /api/tenant/perfil - Buscar perfil do tenant
// ====================================
router.get('/perfil', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);

    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        nome: true,
        slug: true,
        status: true,
        plano: true,
        cnpj: true,
        endereco: true,
        cidade: true,
        telefone: true,
        whatsapp: true,
        email: true,
        site: true,
        instagram: true,
        facebook: true,
        logoUrl: true,
        diferenciais: true,
        horarioAtendimento: true,
        atendeFinalDeSemana: true,
        tempoMercado: true,
        perfilLocacao: true,
        perfilVenda: true,
        ragPerfilTexto: true,
        criadoEm: true,
        atualizadoEm: true,
      }
    });

    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    res.json({
      ...tenant,
      perfilVenda: normalizarPerfilVenda(tenant.perfilVenda || {})
    });
  } catch (error) {
    console.error('[Tenant] Erro ao buscar perfil:', error);
    responderErro(res, 500, 'Erro ao buscar perfil');
  }
});

// ====================================
// PUT /api/tenant/perfil - Atualizar perfil do tenant
// ====================================
router.put('/perfil', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);
    const dados = req.body;

    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }

    console.log('[Tenant] Atualizando perfil:', tenantId);

    const perfilVendaNormalizado = normalizarPerfilVenda(dados.perfilVenda);

    // Atualizar tenant com todos os campos
    const tenantAtualizado = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        nome: dados.nome,
        cnpj: dados.cnpj,
        endereco: dados.endereco,
        cidade: dados.cidade,
        telefone: dados.telefone,
        whatsapp: dados.whatsapp,
        email: dados.email,
        site: dados.site,
        instagram: dados.instagram,
        facebook: dados.facebook,
        logoUrl: dados.logoUrl,
        diferenciais: dados.diferenciais,
        horarioAtendimento: dados.horarioAtendimento,
        atendeFinalDeSemana: dados.atendeFinalDeSemana,
        tempoMercado: dados.tempoMercado,
        perfilLocacao: dados.perfilLocacao,
        perfilVenda: perfilVendaNormalizado,
      }
    });

    // Gerar RAG sintetizado
    const ragTexto = sintetizarPerfilRAG(tenantAtualizado);

    // Salvar RAG no tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { ragPerfilTexto: ragTexto }
    });

    console.log('[Tenant] ✅ Perfil atualizado com RAG:', ragTexto.substring(0, 100));

    res.json({
      success: true,
      tenant: tenantAtualizado,
      ragGerado: ragTexto
    });
  } catch (error) {
    console.error('[Tenant] Erro ao atualizar perfil:', error);
    responderErro(res, 500, 'Erro ao atualizar perfil');
  }
});

// ====================================
// POST /api/tenant/perfil/logo - Upload de logo para S3
// ====================================
router.post('/perfil/logo', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);

    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }

    if (!req.file) {
      return responderErro(res, 400, 'Nenhum arquivo enviado');
    }

    console.log('[Tenant] 📤 Fazendo upload de logo para tenant:', tenantId);
    console.log('[Tenant] 📦 Bucket S3:', S3_BUCKET_LOGOS);

    // Gerar nome único para o arquivo
    const extensao = path.extname(req.file.originalname) || '.png';
    const nomeArquivo = `logos/${tenantId}/${uuidv4()}${extensao}`;

    // Fazer upload para S3
    const comando = new PutObjectCommand({
      Bucket: S3_BUCKET_LOGOS,
      Key: nomeArquivo,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      // Nota: ACL 'public-read' requer que o bucket tenha ACLs habilitadas
      // Se não funcionar, remova a linha ACL e configure o bucket com políticas públicas
    });

    await s3.send(comando);

    // Gerar URL pública
    const logoUrl = `https://${S3_BUCKET_LOGOS}.s3.${process.env.AWS_S3_REGION || 'us-east-2'}.amazonaws.com/${nomeArquivo}`;

    // Atualizar tenant com nova logo
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl }
    });

    console.log('[Tenant] ✅ Logo atualizada:', logoUrl);

    res.json({
      success: true,
      logoUrl,
      message: 'Logo atualizada com sucesso'
    });
  } catch (error: any) {
    console.error('[Tenant] ❌ Erro no upload de logo:', error.message);
    console.error('[Tenant] Detalhes:', error);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ====================================
// POST /api/tenant/perfil/voz/preview - Gera áudio de prévia da voz
// ====================================
router.post('/perfil/voz/preview', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID obrigatório');
    }

    const voz = typeof req.body?.voz === 'string' && req.body.voz.trim().length > 0
      ? req.body.voz.trim()
      : 'onyx';
    const provedor = req.body?.provedor === 'elevenlabs' ? 'elevenlabs' : 'openai';
    const elevenLabsVoiceId = typeof req.body?.elevenLabsVoiceId === 'string'
      ? req.body.elevenLabsVoiceId.trim()
      : '';
    const elevenLabsModelId = typeof req.body?.elevenLabsModelId === 'string'
      ? req.body.elevenLabsModelId.trim()
      : undefined;
    const textoEntrada = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
    const textoPreview = textoEntrada.length > 0
      ? textoEntrada.slice(0, 280)
      : 'Perfeito, eu vou te mostrar como a gente pode vender seu imóvel com mais estratégia, alcance e segurança.';

    const audioBase64 = await sintetizarFalaTenant(textoPreview, {
      provedor,
      vozOpenAI: voz,
      elevenLabsVoiceId,
      elevenLabsModelId,
      perfil: 'vendas_alta_energia',
    });
    if (!audioBase64) {
      return responderErro(res, 502, 'Não foi possível gerar a prévia de áudio');
    }

    res.json({
      sucesso: true,
      provedor,
      voz,
      texto: textoPreview,
      mimeType: 'audio/mpeg',
      audioBase64,
    });
  } catch (error) {
    console.error('[Tenant] Erro ao gerar prévia de voz:', error);
    responderErro(res, 500, 'Erro ao gerar prévia de voz');
  }
});

export default router;
