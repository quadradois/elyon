/**
 * WEBHOOK ROUTER
 * 
 * Rota principal para receber eventos da Evolution API.
 * Refatorado em 01/02/2026 para usar WebhookController (Pattern Controller).
 */

import { Router } from 'express';
import { webhookController } from '../controllers/webhook-controller';

const router = Router();

// POST /api/webhook
router.post('/', (req, res) => webhookController.handle(req, res));

export default router;
