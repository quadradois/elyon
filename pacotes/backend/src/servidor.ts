// Carregar variáveis de ambiente PRIMEIRO (antes de qualquer import que use process.env)
import { responderErro } from './utilitarios/resposta';
import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import rotaAutenticacao from './rotas/autenticacao';
import rotaMineracao from './rotas/mineracao';
import rotaSincronizacao from './rotas/sincronizacao';
import rotaLeads from './rotas/leads';
import rotaAgenda from './rotas/agenda'; // Rota para calendário
import rotaWebhook from './rotas/webhook';
import rotaWebhookManus from './rotas/webhook-manus';
import rotaWhatsapp from './rotas/whatsapp';
import rotaSessoesWhatsapp from './rotas/sessoes-whatsapp';
import rotaChat from './rotas/chat';
import rotaCampanhas from './rotas/campanhas';
import rotaMetricas from './rotas/metricas';
import rotaAgentes from './rotas/agentes';
import rotaMetricasAgentes from './rotas/metricas-agentes';
import rotaDocumentos from './rotas/documentos';
import rotaDocumentosLead from './rotas/documentos-lead';
import rotaListas from './rotas/listas';
import rotaContatos from './rotas/contatos';
import rotaProprietarios from './rotas/proprietarios';
import rotaBlacklist from './rotas/blacklist';
import rotaAlertas from './rotas/alertas';
import rotaPesquisas from './rotas/pesquisas';
import rotaTenant from './rotas/tenant';
import rotaJobs from './rotas/jobs';
import rotasBilling from './rotas/rotas-billing';
import rotaLeadsVip from './rotas/rotas-leads-vip';
import rotaJobsMineracao from './rotas/mineracao/jobs.rotas';
import rotaJobsUnidades from './rotas/mineracao/unidades-jobs.rotas';
import rotaContratos from './rotas/contratos';
import rotaClientes from './rotas/clientes';
import rotaConfiguracaoIntegracao from './rotas/configuracao-integracao';
import rotaConfiguracaoLLM from './rotas/configuracao-llm';
import rotaMetricasIA from './rotas/metricas-ia.rotas';
import rotaUsuarios from './rotas/usuarios';
import rotaAdminAuditoria from './rotas/admin-auditoria';

// Importar Prisma do módulo central (evita dependência circular)
import { prisma } from './lib/db';
export { prisma };

// Importar serviço WebSocket
import { websocketService } from './servicos/websocket';
import { schedulerSincronizacaoMapa } from './servicos/scheduler-sincronizacao-mapa';
import { schedulerLimpezaCache } from './servicos/scheduler-limpeza-cache';
import { resolverTrustProxy } from './utils/trust-proxy';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// A API de produção recebe tráfego por exatamente um proxy confiável (Traefik).
// Em outros ambientes, o proxy permanece desabilitado por padrão.
app.set('trust proxy', resolverTrustProxy());

// Middlewares
app.use(helmet());

// CORS - Permitir múltiplas origens
const allowedOrigins = [
  'http://localhost:5173',  // Frontend Elyon (Vite)
  'http://localhost:3001',  // Admin Dashboard (serve)
  'http://127.0.0.1:3001',  // Admin alternativo
  // Produção: HTTPS apenas para evitar MitM
  'https://crm.elyon.ia.br',           // CRM Elyon HTTPS
  'https://elyon.ia.br',               // Landing Page HTTPS
  'https://www.elyon.ia.br',           // Landing Page www HTTPS
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (ex: Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origem bloqueada: ${origin}`);
      callback(new Error('Origem não permitida pelo CORS'));
    }
  },
  credentials: true
}));

// ✅ TASK-15: Rate Limiting Global — Proteção contra DoS com custo financeiro
// (ex: alguém chamando /exportar-csv ou Smart Discovery em loop consumindo créditos Assertiva)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,            // 200 req/min por IP de origem validado pelo Express
  message: { erro: 'Muitas requisições. Aguarde um momento e tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const endereco = req.ip || req.socket.remoteAddress || 'unknown';
    return ipKeyGenerator(endereco);
  },
  skip: (req) => process.env.NODE_ENV !== 'production'
});
app.use(globalLimiter);

// ⚠️ Rate Limiting específico — Proteção contra brute-force no login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // Máximo 10 tentativas por IP
  message: { erro: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production'
});

// ✅ TASK-06 (corrigido): Limite de 50MB ANTES do global para /webhooks.
// A Evolution API envia mídia (imagens, documentos) via base64 no body JSON,
// o que pode gerar payloads grandes. 50MB cobre arquivos de até ~37MB (overhead base64).
// O limite global de 1MB protege todas as outras rotas da API.
app.use('/webhooks', express.json({ limit: '50mb' }));
app.use('/webhooks', express.urlencoded({ limit: '50mb', extended: true }));

// Limite global de 1MB para todas as demais rotas.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Rota de Health Check
app.get('/api/saude', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Health check simplificado para Docker/Kubernetes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Registrar Rotas (autenticação com rate-limit no login)
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', rotaAutenticacao);
app.use('/api/mineracao', rotaMineracao);
app.use('/api/mineracao/jobs', rotaJobsMineracao);  // Jobs assíncronos de mineração
app.use('/api/mineracao/unidades/jobs', rotaJobsUnidades); // Jobs de busca de unidades
app.use('/api/sincronizacao', rotaSincronizacao); // Sincronização Base Local
app.use('/api/leads', rotaLeads);
app.use('/api/leads', rotaChat); // Monta rota de chat também em /api/leads
app.use('/api/agenda', rotaAgenda);
app.use('/api/whatsapp', rotaWhatsapp);
app.use('/api/sessoes-whatsapp', rotaSessoesWhatsapp);
app.use('/api/campanhas', rotaCampanhas); // Gestão de campanhas
app.use('/api/metricas', rotaMetricas);   // Dashboard de métricas
app.use('/api/agentes', rotaAgentes);     // Configuração de agentes IA
app.use('/api/metricas-agentes', rotaMetricasAgentes); // Métricas dos agentes IA
app.use('/api/documentos', rotaDocumentos); // Upload de documentos para RAG
app.use('/api/leads', rotaDocumentosLead);  // Documentos capturados via WhatsApp por lead
app.use('/api/listas', rotaListas);         // Listas de contatos minerados
app.use('/api/contatos', rotaContatos);     // Busca global de contatos
app.use('/api/proprietarios', rotaProprietarios); // Recurso unificado de proprietários (contatos + leads)
app.use('/api/blacklist', rotaBlacklist);   // Blacklist de telefones
app.use('/api/alertas', rotaAlertas);       // Alertas de escalação para corretores
app.use('/api/pesquisas', rotaPesquisas);   // Pesquisas de empreendimento via Manus
app.use('/api/tenant', rotaTenant);         // Perfil da imobiliária/tenant
app.use('/api/jobs', rotaJobs);             // Jobs/tarefas agendadas (recontato, etc)
app.use('/api/billing', rotasBilling);      // Créditos, assinaturas, recargas
app.use('/api/leads-vip', rotaLeadsVip);    // Leads do site de vendas (Supabase)
app.use('/api/contratos', rotaContratos);   // Geração de contratos digitais
app.use('/api/clientes', rotaClientes);     // Clientes (Carteira)
app.use('/api/configuracao/integracao', rotaConfiguracaoIntegracao); // Config integrações CRM
app.use('/api/configuracao/llm', rotaConfiguracaoLLM);               // Config BYOK (LLM próprio)
app.use('/api/metricas-ia', rotaMetricasIA);                          // Métricas da IA (performance agentes, tools, conversões)
app.use('/api/usuarios', rotaUsuarios);                               // Gestão de usuários da equipe
app.use('/api/admin/auditoria', rotaAdminAuditoria);                  // Log de Auditoria do sistema (Super Admin)
app.use('/webhooks', rotaWebhook);
app.use('/webhooks', rotaWebhookManus);     // Webhooks do Manus (pesquisa IA)

// ✅ TASK-16: Error handler global completo
// Previne que crashes não tratados gerem stack traces no frontend ou respostas em texto puro
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 1. Limite de Payload
  if (err.type === 'entity.too.large') {
    console.warn(`[WARN] PayloadTooLargeError em ${req.path} - Tamanho: ${req.headers['content-length']} bytes`);
    return responderErro(res, 413, 'Payload muito grande', { maxSize: '1mb', received: req.headers['content-length'] });
  }

  // 2. Erros de Validação (Zod)
  if (err.name === 'ZodError') {
    return responderErro(res, 400, 'Erro de validação de dados', { detalhes: err.errors });
  }

  // 3. Erros de Banco de Dados (Prisma)
  if (err.name === 'PrismaClientKnownRequestError') {
    console.error(`[Prisma ERROR] Code ${err.code} em ${req.path}`);
    if (err.code === 'P2002') {
      return responderErro(res, 409, 'Registro já existe (violação de restrição única)', { 
        alvo: err.meta?.target 
      });
    }
    return responderErro(res, 500, 'Erro na base de dados', { codigo: err.code });
  }

  // 4. Erros de APIs Externas (Axios)
  if (err.isAxiosError) {
    console.error(`[Axios ERROR] Erro chamando ${err.config?.url}: ${err.message}`);
    const statusApiExt = err.response?.status || 502;
    return responderErro(res, statusApiExt, 'Falha de comunicação com serviço externo', {
      api: err.config?.url,
      detalhes: err.response?.data || err.message
    });
  }

  // 5. Uncaught genérico
  console.error(`[FATAL] Erro não tratado na rota ${req.method} ${req.path}:`, err);
  return responderErro(res, 500, 'Erro interno no servidor', {
    mensagem: err.message || 'Erro inesperado'
  });

});

// Iniciar servidor
if (require.main === module) {
  // Inicializar WebSocket no servidor HTTP
  websocketService.inicializar(server);

  server.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🔌 WebSocket ativo para alertas em tempo real`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/saude`);
    schedulerSincronizacaoMapa.iniciar();
    schedulerLimpezaCache.iniciar();

    // REMOVIDO: Autoconfiguração global de webhook
    // Cada sessão WhatsApp configura seu próprio webhook individualmente
    // Isso mantém o contexto multi-tenant e evita conflitos de instâncias
  });
}

export default app;
export { server };
