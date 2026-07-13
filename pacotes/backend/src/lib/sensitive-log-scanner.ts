export interface SensitiveLogFinding {
  type: 'email' | 'phone' | 'cpf-cnpj' | 'bearer' | 'jwt' | 'secret-label';
  line: number;
}

const PATTERNS: Array<{ type: SensitiveLogFinding['type']; pattern: RegExp }> = [
  { type: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { type: 'phone', pattern: /(?<!\d)(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)9\d{4}[\s.-]?\d{4}(?!\d)/ },
  { type: 'cpf-cnpj', pattern: /\b(?:\d{3}[.-]?){3}\d{2}\b|\b\d{2}[.]?\d{3}[.]?\d{3}[\/]?\d{4}[-]?\d{2}\b/ },
  { type: 'bearer', pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i },
  { type: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
  {
    type: 'secret-label',
    pattern: /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|senha|secret)\s*[:=]\s*(?!\[REDACTED\])\S+/i,
  },
];

export function scanSensitiveLog(text: string): SensitiveLogFinding[] {
  const findings: SensitiveLogFinding[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line) return;
    for (const { type, pattern } of PATTERNS) {
      if (pattern.test(line)) findings.push({ type, line: index + 1 });
    }
  });
  return findings;
}
