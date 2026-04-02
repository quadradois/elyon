import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info', // Níveis: fatal, error, warn, info, debug, trace
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty', // Saída formatada/colorida para desenvolvimento local
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined, // Em produção imprime JSON puro e otimizado pra ingestão (Datadog/CloudWatch)
});
