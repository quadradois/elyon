import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { prisma } from '../lib/db';
import { criptografar, descriptografar } from '../lib/crypto';
import OpenAI from 'openai';
import { verificarAutenticacao } from '../middleware/middleware-auth';
import { MODELO_PADRAO_PRINCIPAL } from '../agentes/byok-resolver';

const router = Router();
router.use(verificarAutenticacao);

// ====================================
// PROVEDORES SUPORTADOS
// Apenas provedores 100% compatíveis com o SDK @openai/agents:
//   - OpenAI (nativo)
//   - OpenRouter (proxy OpenAI-compatible)
// Moonshot e Anthropic foram removidos por incompatibilidades com
// Structured Outputs, function calling nativo e reasoning_content.
// ====================================
const PROVEDORES_SUPORTADOS: any = {
  openai: {
    nome: 'OpenAI',
    modelos: [
      // Família GPT-4.1 (recomendados — mesmo default da plataforma)
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      // Família GPT-5
      'gpt-5',
      'gpt-5-mini',
      // Família o (raciocínio)
      'o3-mini',
      'o4-mini',
      // Família GPT-4o (legado)
      'gpt-4o',
      'gpt-4o-mini',
      // Legado (não recomendados)
      'gpt-4-turbo',
      'gpt-3.5-turbo',
    ],
    baseUrl: 'https://api.openai.com/v1'
  },
  openrouter: {
    nome: 'OpenRouter',
    modelos: [], // Busca dinâmica via API
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
        llmApiKeyCriptografada: true
      }
    });

    if (!tenant) {
      return responderErro(res, 404, 'Tenant não encontrado');
    }

    // Não retornamos a API Key real, apenas indicamos se existe
    const configuracao = {
      provedor: tenant.llmProvedor || 'openai',
      modelo: tenant.llmModelo || MODELO_PADRAO_PRINCIPAL,
      baseUrl: tenant.llmBaseUrl,
      temApiKey: !!tenant.llmApiKeyCriptografada,
      usando_padrao: !tenant.llmApiKeyCriptografada
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
    const { provedor, modelo, apiKey, baseUrl } = req.body;

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
    };

    // Se uma nova API Key for fornecida, criptografa e salva
    if (apiKey && apiKey.trim() !== '') {
        dadosAtualizacao.llmApiKeyCriptografada = criptografar(apiKey);
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
        temApiKey: !!tenant.llmApiKeyCriptografada
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
    const modelo = tenant.llmModelo || MODELO_PADRAO_PRINCIPAL;
    const baseUrl = tenant.llmBaseUrl || PROVEDORES_SUPORTADOS[provedor]?.baseUrl;

    // Todos os provedores suportados usam a API OpenAI-compatible
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl
    });

    await client.chat.completions.create({
      model: modelo,
      max_completion_tokens: 10,
      messages: [{ role: 'user', content: 'Responda apenas: ok' }]
    });

    return res.json({ success: true, message: 'Conexão LLM OK' });
  } catch (error: any) {
    const message = error?.message || 'Falha no teste de conexão';
    return res.status(500).json({ success: false, error: message });
  }
});

// ====================================
// CACHE DE MODELOS OPENROUTER (TTL 5 min)
// Evita chamadas repetidas à API do OpenRouter a cada requisição do dashboard.
// ====================================
let openRouterModelosCache: { id: string; name: string }[] = [];
let openRouterCacheTimestamp = 0;
const OPENROUTER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Busca modelos disponíveis no OpenRouter via API pública.
 * Filtra apenas modelos compatíveis com function calling (chat completions).
 */
async function buscarModelosOpenRouter(): Promise<{ id: string; name: string }[]> {
    const agora = Date.now();
    if (openRouterModelosCache.length > 0 && (agora - openRouterCacheTimestamp) < OPENROUTER_CACHE_TTL_MS) {
        return openRouterModelosCache;
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) {
            console.warn(`[LLM-CONFIG] OpenRouter /models respondeu ${response.status}. Usando cache anterior.`);
            return openRouterModelosCache;
        }

        const body = await response.json() as { data?: Array<{ id: string; name?: string }> };
        if (!body.data || !Array.isArray(body.data)) {
            return openRouterModelosCache;
        }

        // Filtrar modelos relevantes: priorizar OpenAI, Google, Anthropic, Meta, Mistral, DeepSeek
        const provedoresPrioritarios = /^(openai|google|anthropic|meta-llama|mistralai|deepseek)/i;
        const modelosFiltrados = body.data
            .filter((m) => provedoresPrioritarios.test(m.id))
            .map((m) => ({ id: m.id, name: m.name || m.id }))
            .sort((a, b) => a.id.localeCompare(b.id));

        openRouterModelosCache = modelosFiltrados;
        openRouterCacheTimestamp = agora;
        console.log(`[LLM-CONFIG] ✅ OpenRouter: ${modelosFiltrados.length} modelos carregados (TTL 5min)`);

        return modelosFiltrados;
    } catch (err: any) {
        console.warn(`[LLM-CONFIG] ⚠️ Falha ao buscar modelos OpenRouter: ${err?.message}. Usando cache.`);
        return openRouterModelosCache;
    }
}

// GET /configuracao-llm/modelos/:provedor
router.get('/modelos/:provedor', async (req: any, res) => {
    try {
        const { provedor } = req.params;

        if (!PROVEDORES_SUPORTADOS[provedor]) {
            return responderErro(res, 400, 'Provedor não suportado');
        }

        // OpenRouter: busca dinâmica com cache de 5 min
        if (provedor === 'openrouter') {
            const modelos = await buscarModelosOpenRouter();
            if (modelos.length > 0) {
                return res.json({ modelos, source: 'dynamic' });
            }
            // Fallback: sem resultados da API, retorna lista vazia com aviso
            return res.json({ modelos: [], source: 'dynamic', aviso: 'Nenhum modelo retornado pela API OpenRouter' });
        }

        // OpenAI e demais: lista estática
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
