/**
 * Rotas de Documentos do Agente
 * 
 * Upload, listagem e exclusão de documentos para RAG personalizado
 * Armazenamento: AWS S3
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer, { FileFilterCallback } from 'multer';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../lib/s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// @ts-ignore - Tipo será reconhecido após prisma migrate
const prisma = new PrismaClient() as any;
const router = Router();

// ============================================
// HELPER PARA TENANT
// ============================================

import { getTenantId } from '../utils/tenant';

/**
 * Verifica se o agente pertence ao tenant
 */
const verificarAgenteTenant = async (agenteId: string, tenantId: string | null): Promise<any | 'forbidden' | null> => {
  if (!tenantId) return 'forbidden';
  
  const agente = await prisma.configuracaoAgente.findUnique({ where: { id: agenteId } });
  if (!agente) return null;
  if (agente.tenantId !== tenantId) return 'forbidden';
  
  return agente;
};

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'rag-eloyn';

/**
 * Corrige encoding de nomes de arquivos
 * Trata casos como "INTRODUÃÃO" -> "INTRODUÇÃO"
 */
function corrigirEncodingNome(nome: string): string {
  try {
    // Tenta decodificar como latin1 -> utf8 (comum em uploads)
    const buffer = Buffer.from(nome, 'latin1');
    const utf8Nome = buffer.toString('utf8');
    
    // Verifica se a conversão fez sentido (tem caracteres válidos)
    if (utf8Nome && !utf8Nome.includes('�') && /[a-zA-ZÀ-ÿ]/.test(utf8Nome)) {
      return utf8Nome;
    }
  } catch (e) {
    // Ignora erro de conversão
  }
  
  // Se não conseguiu converter, retorna o original
  return nome;
}

// ===== CONFIGURAÇÃO MULTER (memória) =====
const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const tiposPermitidos = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  if (tiposPermitidos.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Faz upload do arquivo para o S3
 */
async function uploadParaS3(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });
  
  await s3Client.send(command);
  
  // Retorna a URL do arquivo (sem assinatura, apenas referência)
  return `s3://${BUCKET_NAME}/${key}`;
}

/**
 * Baixa arquivo do S3
 */
async function baixarDoS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  const response = await s3Client.send(command);
  
  // Converter stream para buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Deleta arquivo do S3
 */
async function deletarDoS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  await s3Client.send(command);
}

/**
 * Extrai texto de um buffer de arquivo
 */
async function extrairTexto(buffer: Buffer, mimeType: string, nomeArquivo: string): Promise<string> {
  try {
    if (mimeType === 'text/plain') {
      // Arquivo de texto simples
      return buffer.toString('utf-8');
    }
    
    if (mimeType === 'application/pdf') {
      // Para PDF, usar pdf-parse
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text || '';
      } catch (pdfError) {
        console.error('[Documentos] Erro ao extrair PDF:', pdfError);
        return `[Conteúdo do PDF não pôde ser extraído automaticamente. Arquivo: ${nomeArquivo}]`;
      }
    }
    
    if (mimeType.includes('word') || mimeType.includes('document')) {
      // Para DOCX, retornar placeholder (implementar com mammoth.js se necessário)
      return `[Documento Word - extração de texto em desenvolvimento. Arquivo: ${nomeArquivo}]`;
    }
    
    return `[Tipo de arquivo não suportado para extração: ${mimeType}]`;
  } catch (error) {
    console.error('[Documentos] Erro na extração:', error);
    throw error;
  }
}

/**
 * GET /documentos/:agenteId
 * Lista todos os documentos de um agente
 */
router.get('/:agenteId', async (req: Request, res: Response) => {
  try {
    const { agenteId } = req.params;
    const tenantId = getTenantId(req);
    
    // ✅ Verificar ownership do agente
    const agente = await verificarAgenteTenant(agenteId, tenantId);
    if (agente === null) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }
    if (agente === 'forbidden') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    
    const documentos = await prisma.documentoAgente.findMany({
      where: { agenteId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        nomeOriginal: true,
        mimeType: true,
        tamanhoBytes: true,
        totalCaracteres: true,
        status: true,
        erroProcessamento: true,
        criadoEm: true,
        processadoEm: true,
      },
    });
    
    res.json({ documentos });
  } catch (error: any) {
    console.error('[Documentos] Erro ao listar:', error);
    res.status(500).json({ erro: 'Erro ao listar documentos', detalhes: error.message });
  }
});

/**
 * POST /documentos/:agenteId/upload
 * Upload de um novo documento para S3
 */
router.post('/:agenteId/upload', upload.single('arquivo'), async (req: Request, res: Response) => {
  try {
    const { agenteId } = req.params;
    const arquivo = req.file;
    
    if (!arquivo) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }
    
    // Verificar se o agente existe
    const agente = await prisma.configuracaoAgente.findUnique({
      where: { id: agenteId },
    });
    
    if (!agente) {
      return res.status(404).json({ erro: 'Agente não encontrado' });
    }
    
    // Corrigir encoding do nome do arquivo
    const nomeCorrigido = corrigirEncodingNome(arquivo.originalname);
    
    // Gerar chave única para o S3
    const extensao = path.extname(arquivo.originalname);
    const s3Key = `documentos/${agenteId}/${uuidv4()}${extensao}`;
    
    // Upload para S3
    console.log(`[Documentos] Enviando para S3: ${s3Key}`);
    await uploadParaS3(arquivo.buffer, s3Key, arquivo.mimetype);
    console.log(`[Documentos] ✅ Upload S3 concluído: ${s3Key}`);
    
    // Criar registro do documento
    const documento = await prisma.documentoAgente.create({
      data: {
        agenteId,
        nomeOriginal: nomeCorrigido,
        nomeStorage: s3Key, // Agora é a chave do S3
        mimeType: arquivo.mimetype,
        tamanhoBytes: arquivo.size,
        status: 'PROCESSANDO',
      },
    });
    
    // Extrair texto do documento
    try {
      const textoExtraido = await extrairTexto(arquivo.buffer, arquivo.mimetype, nomeCorrigido);
      
      await prisma.documentoAgente.update({
        where: { id: documento.id },
        data: {
          textoExtraido,
          totalCaracteres: textoExtraido.length,
          status: 'SUCESSO',
          processadoEm: new Date(),
        },
      });
      
      console.log(`[Documentos] ✅ Documento ${documento.id} processado: ${textoExtraido.length} caracteres`);
      
      res.json({
        documento: {
          id: documento.id,
          nomeOriginal: nomeCorrigido,
          totalCaracteres: textoExtraido.length,
          status: 'SUCESSO',
          storage: 's3',
        },
        textoExtraido: textoExtraido.substring(0, 500) + (textoExtraido.length > 500 ? '...' : ''),
      });
      
    } catch (extractError: any) {
      await prisma.documentoAgente.update({
        where: { id: documento.id },
        data: {
          status: 'ERRO',
          erroProcessamento: extractError.message,
        },
      });
      
      res.status(500).json({
        erro: 'Erro ao processar documento',
        detalhes: extractError.message,
        documentoId: documento.id,
      });
    }
    
  } catch (error: any) {
    console.error('[Documentos] Erro no upload:', error);
    res.status(500).json({ erro: 'Erro no upload', detalhes: error.message });
  }
});

/**
 * DELETE /documentos/:agenteId/:documentoId
 * Remove um documento do S3 e do banco
 */
router.delete('/:agenteId/:documentoId', async (req: Request, res: Response) => {
  try {
    const { agenteId, documentoId } = req.params;
    
    const documento = await prisma.documentoAgente.findFirst({
      where: { id: documentoId, agenteId },
    });
    
    if (!documento) {
      return res.status(404).json({ erro: 'Documento não encontrado' });
    }
    
    // Remover arquivo do S3
    try {
      console.log(`[Documentos] Deletando do S3: ${documento.nomeStorage}`);
      await deletarDoS3(documento.nomeStorage);
      console.log(`[Documentos] ✅ Arquivo removido do S3`);
    } catch (s3Error: any) {
      console.error('[Documentos] Erro ao deletar do S3:', s3Error);
      // Continua mesmo se falhar no S3 (arquivo pode já não existir)
    }
    
    // Remover do banco
    await prisma.documentoAgente.delete({
      where: { id: documentoId },
    });
    
    res.json({ sucesso: true, mensagem: 'Documento removido' });
    
  } catch (error: any) {
    console.error('[Documentos] Erro ao deletar:', error);
    res.status(500).json({ erro: 'Erro ao deletar documento', detalhes: error.message });
  }
});

/**
 * GET /documentos/:agenteId/rag-texto
 * Retorna todo o texto RAG combinado dos documentos
 */
router.get('/:agenteId/rag-texto', async (req: Request, res: Response) => {
  try {
    const { agenteId } = req.params;
    
    const documentos = await prisma.documentoAgente.findMany({
      where: { 
        agenteId,
        status: 'SUCESSO',
        textoExtraido: { not: null },
      },
      select: {
        nomeOriginal: true,
        textoExtraido: true,
      },
    });
    
    if (documentos.length === 0) {
      return res.json({ textoRag: null, totalDocumentos: 0 });
    }
    
    // Combinar textos com separadores
    const textoRag = documentos
      .map((doc: { nomeOriginal: string; textoExtraido: string }) => `\n\n## DOCUMENTO: ${doc.nomeOriginal}\n\n${doc.textoExtraido}`)
      .join('\n\n---\n');
    
    res.json({
      textoRag,
      totalDocumentos: documentos.length,
      totalCaracteres: textoRag.length,
    });
    
  } catch (error: any) {
    console.error('[Documentos] Erro ao gerar RAG:', error);
    res.status(500).json({ erro: 'Erro ao gerar texto RAG', detalhes: error.message });
  }
});

export default router;
