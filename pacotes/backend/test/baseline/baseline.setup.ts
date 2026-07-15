process.env.WEBHOOK_DEBOUNCE_MS = '500';
process.env.WEBHOOK_DEBOUNCE_RAPIDO_MS = '500';
process.env.WEBHOOK_DEDUPE_RESPOSTA_JANELA_S = '1';
process.env.USAR_ORQUESTRADOR = 'true';
process.env.MODO_OUTBOUND_ONLY = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'baseline-only-secret-with-at-least-32-bytes';
