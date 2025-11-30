import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rotaAutenticacao from './rotas/autenticacao';
import rotaMineracao from './rotas/mineracao';
import rotaLeads from './rotas/leads';
import rotaWebhook from './rotas/webhook';
import rotaWhatsapp from './rotas/whatsapp';
import rotaChat from './rotas/chat';
import rotaCampanhas from './rotas/campanhas';
import rotaMetricas from './rotas/metricas';
import rotaAgentes from './rotas/agentes';
import rotaMetricasAgentes from './rotas/metricas-agentes';

// Carregar variáveis de ambiente (Forçar override para ignorar variáveis de sistema antigas)
dotenv.config({ override: true });

// Inicializar Prisma
export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Rota de Health Check
app.get('/api/saude', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Registrar Rotas
app.use('/api/auth', rotaAutenticacao);
app.use('/api/mineracao', rotaMineracao);
app.use('/api/leads', rotaLeads);
app.use('/api/leads', rotaChat); // Monta rota de chat também em /api/leads
app.use('/api/whatsapp', rotaWhatsapp);
app.use('/api/campanhas', rotaCampanhas); // Gestão de campanhas
app.use('/api/metricas', rotaMetricas);   // Dashboard de métricas
app.use('/api/agentes', rotaAgentes);     // Configuração de agentes IA
app.use('/api/metricas-agentes', rotaMetricasAgentes); // Métricas dos agentes IA
app.use('/webhooks', rotaWebhook);

// Iniciar servidor
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/saude`);

    // Autoconfiguração do Webhook em Produção
    if (process.env.WEBHOOK_URL) {
      try {
        console.log('🔄 Configurando webhook automaticamente...');
        // Importação dinâmica para evitar ciclo ou carregar antes da hora
        const { whatsappService } = await import('./servicos/whatsapp');
        await whatsappService.configurarWebhook(process.env.WEBHOOK_URL);
        console.log('✅ Webhook configurado com sucesso no startup!');
      } catch (error) {
        console.error('⚠️ Falha ao configurar webhook no startup (pode ser ignorado se a Evolution não estiver pronta):', error);
      }
    }
  });
}

export default app;
