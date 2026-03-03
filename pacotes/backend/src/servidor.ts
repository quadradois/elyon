// Carregar variáveis de ambiente PRIMEIRO (antes de qualquer import que use process.env)
import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
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
import rotaListas from './rotas/listas';
import rotaContatos from './rotas/contatos';
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

// Importar Prisma do módulo central (evita dependência circular)
import { prisma } from './lib/db';
export { prisma };

// Importar serviço WebSocket
import { websocketService } from './servicos/websocket';
import { schedulerSincronizacaoMapa } from './servicos/scheduler-sincronizacao-mapa';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());

// CORS - Permitir múltiplas origens
const allowedOrigins = [
  'http://localhost:5173',  // Frontend Elyon (Vite)
  'http://localhost:3001',  // Admin Dashboard (serve)
  'http://127.0.0.1:3001',  // Admin alternativo
  'http://elyon.quadradois.com.br',     // Produção Elyon
  'https://elyon.quadradois.com.br',    // Produção Elyon HTTPS
  'http://admin.quadradois.com.br',     // Produção Admin
  'https://admin.quadradois.com.br',    // Produção Admin HTTPS
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

// ⚠️ IMPORTANTE: Limite grande para webhooks do Evolution API
// que podem incluir mídia (áudio, imagens) em base64
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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

// Registrar Rotas
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
app.use('/api/listas', rotaListas);         // Listas de contatos minerados
app.use('/api/contatos', rotaContatos);     // Busca global de contatos
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
app.use('/webhooks', rotaWebhook);
app.use('/webhooks', rotaWebhookManus);     // Webhooks do Manus (pesquisa IA)

// Error handler global para PayloadTooLargeError
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    console.warn(`[WARN] PayloadTooLargeError em ${req.path} - Tamanho: ${req.headers['content-length']} bytes`);
    return res.status(413).json({
      error: 'Payload muito grande',
      maxSize: '100mb',
      received: req.headers['content-length']
    });
  }
  next(err);
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

    // REMOVIDO: Autoconfiguração global de webhook
    // Cada sessão WhatsApp configura seu próprio webhook individualmente
    // Isso mantém o contexto multi-tenant e evita conflitos de instâncias
  });
}

export default app;
export { server };
