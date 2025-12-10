import { Router, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { verificarSuperAdmin } from '../middleware/middleware-auth';

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

// Configuração S3
const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Bucket para logos - usa variável específica ou fallback para o bucket geral
const S3_BUCKET_LOGOS = process.env.AWS_S3_BUCKET_LOGOS || process.env.AWS_S3_BUCKET_NAME || 'rag-eloyn';

// Helper para extrair tenantId do request
const extrairTenantId = (req: Request): string | null => {
  // Tentar do header primeiro
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  // Fallback para query
  if (req.query.tenantId) return req.query.tenantId as string;
  return null;
};

// ====================================
// HELPER: Sintetizar RAG do Perfil
// ====================================
function sintetizarPerfilRAG(tenant: any): string {
  const partes: string[] = [];
  
  // Dados gerais
  partes.push(`IMOBILIÁRIA: ${tenant.nome}`);
  if (tenant.cidade) partes.push(`Localização: ${tenant.cidade}`);
  if (tenant.tempoMercado) partes.push(`${tenant.tempoMercado} anos no mercado`);
  if (tenant.horarioAtendimento) partes.push(`Horário: ${tenant.horarioAtendimento}`);
  if (tenant.atendeFinalDeSemana) partes.push('Atende final de semana');
  
  // Diferenciais
  const diferenciais = tenant.diferenciais as string[] | null;
  if (diferenciais?.length) {
    partes.push(`Diferenciais: ${diferenciais.join(', ')}`);
  }
  
  // Contato
  const contatos: string[] = [];
  if (tenant.telefone) contatos.push(`Tel: ${tenant.telefone}`);
  if (tenant.whatsapp) contatos.push(`WhatsApp: ${tenant.whatsapp}`);
  if (tenant.email) contatos.push(`Email: ${tenant.email}`);
  if (contatos.length) partes.push(`Contato: ${contatos.join(' | ')}`);
  
  // Perfil de Locação
  const locacao = tenant.perfilLocacao as any;
  if (locacao) {
    const locParts: string[] = ['LOCAÇÃO:'];
    if (locacao.garantiasAceitas?.length) {
      locParts.push(`Garantias aceitas: ${locacao.garantiasAceitas.join(', ')}`);
    }
    if (locacao.taxaAdministracao) locParts.push(`Taxa adm: ${locacao.taxaAdministracao}%`);
    if (locacao.taxaPrimeiroAluguel) locParts.push('Cobra primeiro aluguel');
    if (locacao.prazoMinimoContrato) locParts.push(`Prazo mín: ${locacao.prazoMinimoContrato} meses`);
    if (locacao.aceitaPet) locParts.push('Aceita pet');
    partes.push(locParts.join(' | '));
  }
  
  // Perfil de Venda
  const venda = tenant.perfilVenda as any;
  if (venda) {
    const vendaParts: string[] = ['VENDA:'];
    if (venda.comissaoPadrao) vendaParts.push(`Comissão: ${venda.comissaoPadrao}%`);
    if (venda.fazAvaliacaoGratuita) vendaParts.push('Avaliação gratuita');
    if (venda.fazFotoProfissional) vendaParts.push('Fotos profissionais');
    if (venda.fazTourVirtual) vendaParts.push('Tour virtual');
    if (venda.anunciaPortais?.length) {
      vendaParts.push(`Portais: ${venda.anunciaPortais.join(', ')}`);
    }
    if (venda.temParcerias) vendaParts.push(`Parcerias: ${venda.percentualParceria || 50}%`);
    partes.push(vendaParts.join(' | '));
  }
  
  return partes.join('\n');
}

// ====================================
// GET /api/tenant/todos - Listar TODOS os tenants (SUPER_ADMIN)
// ====================================
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
    res.status(500).json({ error: 'Erro ao listar tenants' });
  }
});

// ====================================
// GET /api/tenant/perfil - Buscar perfil do tenant
// ====================================
router.get('/perfil', async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID obrigatório' });
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
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }
    
    res.json(tenant);
  } catch (error) {
    console.error('[Tenant] Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
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
      return res.status(400).json({ error: 'Tenant ID obrigatório' });
    }
    
    console.log('[Tenant] Atualizando perfil:', tenantId);
    
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
        perfilVenda: dados.perfilVenda,
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
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// ====================================
// POST /api/tenant/perfil/logo - Upload de logo para S3
// ====================================
router.post('/perfil/logo', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const tenantId = extrairTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID obrigatório' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
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
    res.status(500).json({ error: 'Erro ao fazer upload da logo', detalhes: error.message });
  }
});

export default router;
