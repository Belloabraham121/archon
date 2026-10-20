const SENSITIVE = /secret|password|private.?key|seed|mnemonic|token|credential|authorization|cookie/i;

export function redactForJudgment(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForJudgment);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
    key,
    SENSITIVE.test(key) ? '[REDACTED]' : redactForJudgment(nested),
  ]));
}
