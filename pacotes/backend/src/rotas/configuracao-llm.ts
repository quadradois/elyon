import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../lib/db';
import { criptografar, descriptografar } from '../lib/crypto';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { verificarAutenticacao } from '../middleware/middleware-auth';

const router = Router();
router.use(verificarAutenticacao);

// Provedores suportados
const PROVEDORES_SUPORTADOS: any = {
  openai: {
    nome: 'OpenAI',
    modelos: ['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    nome: 'Anthropic',
    modelos: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    baseUrl: 'https://api.anthropic.com/v1'
  },
  moonshot: {
    nome: 'Moonshot AI (Kimi)',
    modelos: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      'moonshot-v1-auto',
      'moonshot-v1-8k-vision-preview',
      'moonshot-v1-32k-vision-preview',
      'moonshot-v1-128k-vision-preview',
      'kimi-k2.5',
      'kimi-k2-0905-preview',
      'kimi-k2-0711-preview',
      'kimi-k2-turbo-preview',
      'kimi-k2-thinking',
      'kimi-k2-thinking-turbo'
    ],
    baseUrl: 'https://api.moonshot.ai/v1'
  },
  openrouter: {
    nome: 'OpenRouter',
    modelos: [], // Busca dinâmica
    baseUrl: 'https://openrouter.ai/api/v1'
  }
};

// GET /configuracao-llm
router.get('/', async (req: any, res) => {
  try {
    const tenantId = req.tenantId; // Injetado pelo middleware de autenticação

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        llmProvedor: true,
        llmModelo: true,
        llmBaseUrl: true,
        llmApiKeyCriptografada: true,
        openaiApiKeyCriptografada: true,
        usarChavePrincipalParaAudio: true,
        usarChavePrincipalParaRag: true
      }
    });

    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    // Não retornamos a API Key real, apenas indicamos se existe
    const configuracao = {
      provedor: tenant.llmProvedor || 'openai',
      modelo: tenant.llmModelo || 'gpt-3.5-turbo',
      baseUrl: tenant.llmBaseUrl,
      temApiKey: !!tenant.llmApiKeyCriptografada,
      usando_padrao: !tenant.llmApiKeyCriptografada,
      temOpenaiApiKey: !!tenant.openaiApiKeyCriptografada,
      usarChavePrincipalParaAudio: tenant.usarChavePrincipalParaAudio ?? true,
      usarChavePrincipalParaRag: tenant.usarChavePrincipalParaRag ?? true
    };

    return res.json({
      success: true,
      config: configuracao,
      provedores: PROVEDORES_SUPORTADOS
    });
  } catch (error) {
    console.error('Erro ao buscar configuração LLM:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

// POST /configuracao-llm
router.post('/', async (req: any, res) => {
  try {
    const tenantId = req.tenantId;
    const { provedor, modelo, apiKey, baseUrl, openaiApiKey, usarChavePrincipalParaAudio, usarChavePrincipalParaRag } = req.body;

    if (!provedor || !modelo) {
      return responderErro(res, 400, 'Provedor e modelo são obrigatórios');
    }

    if (!PROVEDORES_SUPORTADOS[provedor]) {
      return responderErro(res, 400, 'Provedor não suportado');
    }

    const dadosAtualizacao: any = {
      llmProvedor: provedor,
      llmModelo: modelo,
      llmBaseUrl: baseUrl || PROVEDORES_SUPORTADOS[provedor].baseUrl,
      usarChavePrincipalParaAudio: typeof usarChavePrincipalParaAudio === 'boolean' ? usarChavePrincipalParaAudio : true,
      usarChavePrincipalParaRag: typeof usarChavePrincipalParaRag === 'boolean' ? usarChavePrincipalParaRag : true,
    };

    // Se uma nova API Key for fornecida, criptografa e salva
    if (apiKey && apiKey.trim() !== '') {
        // Validação básica da chave Moonshot
        if (provedor === 'moonshot' && !apiKey.startsWith('sk-')) {
            return responderErro(res, 400, 'API Key da Moonshot deve começar com sk-');
        }
        dadosAtualizacao.llmApiKeyCriptografada = criptografar(apiKey);
    }
    
    // Se uma chave openAI secundaria for fornecida, criptografa
    if (openaiApiKey && openaiApiKey.trim() !== '') {
        dadosAtualizacao.openaiApiKeyCriptografada = criptografar(openaiApiKey);
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: dadosAtualizacao
    });

    return res.json({
      success: true,
      message: 'Configuração LLM atualizada com sucesso',
      configuracao: {
        provedor: tenant.llmProvedor,
        modelo: tenant.llmModelo,
        baseUrl: tenant.llmBaseUrl,
        temApiKey: !!tenant.llmApiKeyCriptografada,
        temOpenaiApiKey: !!tenant.openaiApiKeyCriptografada,
        usarChavePrincipalParaAudio: tenant.usarChavePrincipalParaAudio,
        usarChavePrincipalParaRag: tenant.usarChavePrincipalParaRag
      }
    });
  } catch (error) {
    console.error('Erro ao salvar configuração LLM:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

router.post('/testar', async (req: any, res) => {
  try {
    const tenantId = req.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        llmProvedor: true,
        llmModelo: true,
        llmBaseUrl: true,
        llmApiKeyCriptografada: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
    }

    if (!tenant.llmApiKeyCriptografada) {
      return res.status(400).json({ success: false, error: 'API Key não configurada' });
    }

    let apiKey = '';
    try {
      apiKey = descriptografar(tenant.llmApiKeyCriptografada);
    } catch {
      return res.status(400).json({ success: false, error: 'Falha ao descriptografar API Key' });
    }

    const provedor = tenant.llmProvedor || 'openai';
    const modelo = tenant.llmModelo || 'gpt-3.5-turbo';
    const baseUrl = tenant.llmBaseUrl || PROVEDORES_SUPORTADOS[provedor]?.baseUrl;

    if (provedor === 'anthropic') {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: modelo,
        max_tokens: 1,
        system: 'ping',
        messages: [{ role: 'user', content: 'ping' }]
      });
      return res.json({ success: true, message: 'Conexão Anthropic OK' });
    }

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl
    });

    await client.chat.completions.create({
      model: modelo,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }]
    });

    return res.json({ success: true, message: 'Conexão LLM OK' });
  } catch (error: any) {
    const message = error?.message || 'Falha no teste de conexão';
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /configuracao-llm/modelos/:provedor
router.get('/modelos/:provedor', async (req: any, res) => {
    try {
        const { provedor } = req.params;
        const tenantId = req.tenantId;

        if (!PROVEDORES_SUPORTADOS[provedor]) {
            return responderErro(res, 400, 'Provedor não suportado');
        }

        // Se for Moonshot, tentamos buscar modelos da API se tivermos chave
        if (provedor === 'moonshot') {
             const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { llmApiKeyCriptografada: true }
            });

            if (tenant?.llmApiKeyCriptografada) {
                try {
                    const apiKey = descriptografar(tenant.llmApiKeyCriptografada);
                    // IMPORTANTE: Endpoint Global da Moonshot
                    const client = new OpenAI({
                        apiKey: apiKey,
                        baseURL: "https://api.moonshot.ai/v1"
                    });
                    
                    const models = await client.models.list();
                    return res.json({ 
                        modelos: models.data.map((m: any) => ({ id: m.id, name: m.id })),
                        source: 'api'
                    });
                } catch (apiError) {
                    console.error('Erro ao buscar modelos Moonshot:', apiError);
                    // Fallback para estático em caso de erro
                }
            }
        }

        // Retorna modelos estáticos se não for possível buscar dinamicamente
        const modelos = PROVEDORES_SUPORTADOS[provedor].modelos.map((m: string) => ({
            id: m,
            name: m
        }));

        return res.json({ modelos, source: 'static' });
    } catch (error) {
        console.error('Erro ao listar modelos:', error);
        return responderErro(res, 500, 'Erro interno do servidor');
    }
});

export default router;
