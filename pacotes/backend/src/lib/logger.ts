import pino, { DestinationStream, Logger, LoggerOptions } from 'pino';
import { getLogContext } from './log-context';

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY = /(?:^|_)(?:authorization|cookie|set-cookie|token|api-?key|password|senha|secret|telefone|phone|celular|whatsapp|email|cpf|cnpj|nome|mensagem|conteudo|content|payload|body|args|arguments|result|input|output|prompt|reasoning|briefing|motivo|description)(?:_|$)/i;
const SENSITIVE_CAMEL_KEY = /(?:accessToken|refreshToken|apiKey|clientSecret|leadNome|leadName|phoneNumber|instanceToken|rawBody|rawMessage|messageContent|userMessage|currentSituation)/i;

const TEXT_PATTERNS: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /(?<!\d)(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)9\d{4}[\s.-]?\d{4}(?!\d)/g,
  /\b(?:\d{3}[.-]?){3}\d{2}\b/g,
  /\b\d{2}[.]?\d{3}[.]?\d{3}[\/]?\d{4}[-]?\d{2}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(?:sk|key|token|secret)[-_][A-Za-z0-9_-]{12,}\b/gi,
];

const LABELED_VALUE = /\b(authorization|cookie|set-cookie|token|api[_ -]?key|password|senha|secret|telefone|phone|celular|whatsapp|email|e-mail|cpf|cnpj|nome|mensagem|message|conte[uú]do|content|payload|body)\s*([:=])\s*("[^"]*"|'[^']*'|[^,;|\s]+)/gi;
const MESSAGE_CONTENT = /(mensagem\s+de\s+)[^:]+:\s*("[^"]*"|'[^']*'|.+)$/gi;

export function redactSensitiveText(value: string): string {
  let result = value;
  for (const pattern of TEXT_PATTERNS) result = result.replace(pattern, REDACTED);
  result = result.replace(LABELED_VALUE, (_match, label: string, separator: string) => `${label}${separator}${REDACTED}`);
  result = result.replace(MESSAGE_CONTENT, (_match, prefix: string) => `${prefix}${REDACTED}`);
  return result;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return SENSITIVE_KEY.test(normalized) || SENSITIVE_CAMEL_KEY.test(key);
}

export function redactSensitiveValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (depth > 8) return '[TRUNCATED]';

  if (value instanceof Error) {
    return {
      type: value.constructor.name,
      name: value.name,
      message: redactSensitiveText(value.message),
      stack: value.stack ? redactSensitiveText(value.stack) : undefined,
    };
  }

  if (Buffer.isBuffer(value)) return `[BUFFER ${value.length} bytes]`;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item, seen, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveKey(key)
      ? REDACTED
      : redactSensitiveValue(item, seen, depth + 1);
  }
  return output;
}

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'elyon-backend' },
  redact: {
    paths: [
      'req.headers',
      'request.headers',
      'headers.authorization',
      'headers.cookie',
      'headers.set-cookie',
      'config.headers',
      'response.config.headers',
    ],
    censor: REDACTED,
  },
  serializers: {
    err: (error) => redactSensitiveValue(error),
    error: (error) => redactSensitiveValue(error),
    req: (req: { id?: string; method?: string; url?: string; ip?: string }) => ({
      id: req.id,
      method: req.method,
      path: req.url?.split('?')[0],
      remoteAddress: req.ip,
    }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  },
  mixin() {
    return getLogContext() ?? {};
  },
  hooks: {
    logMethod(inputArgs, method) {
      const safeArgs = inputArgs.map((arg) => redactSensitiveValue(arg));
      method.apply(this, safeArgs as Parameters<typeof method>);
    },
  },
};

export function createSecureLogger(destination?: DestinationStream): Logger {
  if (destination) return pino(options, destination);

  if (process.env.NODE_ENV === 'development') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    });
  }

  return pino(options);
}

export const logger = createSecureLogger();

let consoleBridgeInstalled = false;

export function installSecureConsoleBridge(): void {
  if (consoleBridgeInstalled || process.env.NODE_ENV === 'test') return;
  consoleBridgeInstalled = true;

  const relay = (level: 'info' | 'warn' | 'error' | 'debug') => {
    const method = logger[level].bind(logger) as unknown as (...args: unknown[]) => void;
    return (...args: unknown[]) => method(...args);
  };

  console.log = relay('info');
  console.info = relay('info');
  console.warn = relay('warn');
  console.error = relay('error');
  console.debug = relay('debug');
}
